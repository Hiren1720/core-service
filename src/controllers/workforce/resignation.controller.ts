import { NextFunction, Request, Response } from "express";
import {
  ResignationModel,
  UserModel,
} from "../../infrastructure/database/models";
import { ApiResponse } from "../../shared/response/api-response";
import { addUserHistory } from "../../shared/services/userHistory.service";
import { resignationStatus } from "../../types/types";
import { sendMail } from "../../shared/services/mail.service";
import { resignationAcceptedTemplate } from "../../shared/templates/resignationAccepted";
import { normalizeDate } from "../../shared/helpers/dateHelper";
import { downloadCsv } from "../../shared/utils/csvDownload";
import { getMyManagedUserIdList } from "../../shared/services/users.service";

export const createResignation = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { id: assignedBy } = req.user!;
    const { userId, lastWorkingDate, reason } = req.body;

    const existing = await ResignationModel.findOne({ userId })
      .lean()
      .select("status")
      .sort({ createdAt: -1 });
    if (existing?.status === resignationStatus.PENDING) {
      return res
        .json(400)
        .json(ApiResponse.error("Last resignation still in pending state"));
    }

    const resignation = await ResignationModel.create({
      companyId: req.user!.companyId,
      userId,
      lastWorkingDate: normalizeDate(lastWorkingDate),
      reason,
    });

    await addUserHistory({
      userId: userId,
      field: "resignationStatus",
      fieldId: resignation._id.toString(),
      fieldValue: resignationStatus.PENDING,
      remarks: "",
      assignedBy,
    });

    return res
      .status(201)
      .json(
        ApiResponse.success(resignation, "Resignation created successfully"),
      );
  } catch (error) {
    next(error);
  }
};

export const getResignations = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { role, id } = req.user!;
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 10;

    const skip = (page - 1) * limit;

    const search = req.query.search?.toString() || "";
    const status = req.query.status?.toString();
    const isDownload = req.query.isDownload === "true";
    const csvPassword = req.query.csvPassword
      ? String(req.query.csvPassword)
      : undefined;

    const filter: any = {
      companyId: req.user!.companyId,
    };

    // if (search) {
    //   filter.name = {
    //     $regex: search,
    //     $options: "i",
    //   };
    // }

    if (role === "EMPLOYEE") {
      filter.userId = id;
    } else if (role === "MANAGER") {
      const userIds = await getMyManagedUserIdList(id);
      filter.userId = { $in: [...userIds, id] };
    }

    if (status) {
      filter.status = status;
    }

    const resignationQuery = ResignationModel.find(filter)
      .populate({
        path: "userId",
        select: "firstName lastName role profileImage departmentId",
        populate: {
          path: "departmentId",
          select: "name",
        },
      })
      .sort({
        createdAt: -1,
      })
      .lean();

    if (!isDownload) {
      resignationQuery.skip(skip).limit(limit);
    }

    const [resignations, total] = await Promise.all([
      resignationQuery,
      ResignationModel.countDocuments(filter),
    ]);

    if (isDownload) {
      const data = resignations.map((resignation: any) => ({
        Name: resignation.userId.firstName + resignation.userId.lastName,
        Status: resignation.status,
        Reason: resignation.reason,
        LastWorkingDay: resignation.lastWorkingDate.toLocaleDateString(),
      }));

      return downloadCsv(res, data, "resignations", csvPassword);
    }

    return res.status(200).json(
      ApiResponse.success(
        {
          resignations,
          total,
        },
        "Resignations fetched successfully",
      ),
    );
  } catch (error) {
    next(error);
  }
};

export const getResignationCount = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { role, id } = req.user!;

    const filter: any = {
      companyId: req.user!.companyId,
    };

    if (role === "EMPLOYEE") {
      filter.userId = id;
    } else if (role === "MANAGER") {
      const userIds = await getMyManagedUserIdList(id);
      filter.userId = { $in: [...userIds, id] };
    }

    const [pending, accept, reject] = await Promise.all([
      ResignationModel.countDocuments({
        ...filter,
        status: "PENDING" as resignationStatus,
      }),
      ResignationModel.countDocuments({
        ...filter,
        status: "ACCEPTED" as resignationStatus,
      }),
      ResignationModel.countDocuments({
        ...filter,
        status: "REJECTED" as resignationStatus,
      }),
    ]);

    return res.status(200).json(
      ApiResponse.success(
        {
          total: pending + accept + reject,
          pending,
          accept,
          reject,
        },
        "Resignation counts fetched successfully",
      ),
    );
  } catch (error) {
    next(error);
  }
};

export const getResignationById = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const resignation = await ResignationModel.findOne({
      _id: req.params.resignationId,
      companyId: req.user!.companyId,
    }).populate("userId", "firstName lastName role profileImage");

    if (!resignation) {
      return res.status(404).json(ApiResponse.error("Resignation not found"));
    }

    return res
      .status(200)
      .json(
        ApiResponse.success(resignation, "Resignation fetched successfully"),
      );
  } catch (error) {
    next(error);
  }
};

export const updateResignation = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { id } = req.user!;

    const resignation = await ResignationModel.findOne({
      _id: req.params.resignationId,
      companyId: req.user!.companyId,
    });

    if (!resignation) {
      return res.status(404).json(ApiResponse.error("Resignation not found"));
    }

    if (id.toString() === resignation.toString()) {
      return res
        .status(404)
        .json(ApiResponse.error("Cannot update own status"));
    }

    const { userId, lastWorkingDate, reason } = req.body;

    if (userId !== undefined) resignation.userId = userId;

    if (lastWorkingDate !== undefined)
      resignation.lastWorkingDate = normalizeDate(lastWorkingDate);

    if (reason !== undefined) resignation.reason = reason;

    await resignation.save();

    return res
      .status(200)
      .json(ApiResponse.success(null, "Resignation updated successfully"));
  } catch (error) {
    next(error);
  }
};

export const updateResignationStatus = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { status, remarks } = req.body;
    const assignedBy = req.user!.id;

    const resignation = await ResignationModel.findOne({
      _id: req.params.resignationId,
      companyId: req.user!.companyId,
    });

    if (!resignation) {
      return res.status(404).json(ApiResponse.error("Resignation not found"));
    }

    resignation.status = status;

    await addUserHistory({
      userId: req.user!.id as string,
      field: "resignationStatus",
      fieldId: resignation._id.toString(),
      fieldValue: status,
      remarks,
      assignedBy,
    });
    await resignation.save();

    return res
      .status(200)
      .json(ApiResponse.success(null, "Status updated successfully"));
  } catch (error) {
    next(error);
  }
};

export const sendResignationAcceptedMail = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { userId, email } = req.body;
    const { id: senderId } = req.user!;

    const [user, sender, resignation] = await Promise.all([
      UserModel.findById(userId).select("email firstName lastName"),
      UserModel.findById(senderId).select("firstName lastName role"),
      ResignationModel.findOne({ userId }).sort({ createdAt: -1 }),
    ]);

    if (!user) {
      return res.status(404).json(ApiResponse.error("Employee not found"));
    }

    if (!sender) {
      return res.status(404).json(ApiResponse.error("Sender not found"));
    }

    if (!resignation) {
      return res
        .status(404)
        .json(ApiResponse.error("Resignation record not found"));
    }

    const beneficiaryEmail = email || user.email;

    const beneficiaryName = `${user.firstName} ${user.lastName}`.trim();
    const senderName = `${sender.firstName} ${sender.lastName}`.trim();

    const lastWorkingDay =
      resignation.lastWorkingDate.toLocaleDateString("en-GB");

    await sendMail({
      to: beneficiaryEmail,
      subject: "Resignation Accepted",
      html: resignationAcceptedTemplate({
        employeeName: beneficiaryName,
        lastWorkingDay,
        managerName: senderName,
        managerDesignation: sender.role,
      }),
    });

    resignation.mailSent = true;
    resignation.mailSentAt = new Date();

    await addUserHistory({
      userId: req.user!.id as string,
      field: "resignationMail",
      fieldId: resignation._id.toString(),
      fieldValue: lastWorkingDay,
      remarks: "",
      assignedBy: senderId,
    });
    await resignation.save();

    return res
      .status(200)
      .json(ApiResponse.success(null, "Resignation email sent successfully"));
  } catch (error) {
    next(error);
  }
};
