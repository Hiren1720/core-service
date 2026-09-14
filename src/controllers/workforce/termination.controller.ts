import { NextFunction, Request, Response } from "express";
import {
  TerminationModel,
  UserModel,
} from "../../infrastructure/database/models";
import { ApiResponse } from "../../shared/response/api-response";
import { addUserHistory } from "../../shared/services/userHistory.service";
import { terminationStatus } from "../../types/types";
import { sendMail } from "../../shared/services/mail.service";
import { terminationTemplate } from "../../shared/templates/termination";
import { normalizeDate } from "../../shared/helpers/dateHelper";
import { downloadCsv } from "../../shared/utils/csvDownload";
import { getMyManagedUserIdList } from "../../shared/services/users.service";

export const createTermination = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { id: assignedBy } = req.user!;
    const { userId, terminationType, lastWorkingDate, reason } = req.body;

    const termination = await TerminationModel.create({
      companyId: req.user!.companyId,
      userId,
      terminationType,
      lastWorkingDate: normalizeDate(lastWorkingDate),
      reason,
    });

    await addUserHistory({
      userId: userId,
      field: "terminationStatus",
      fieldValue: terminationStatus.TERMINATE,
      remarks: "",
      fieldId: termination._id.toString(),
      assignedBy,
    });

    return res
      .status(201)
      .json(
        ApiResponse.success(termination, "Termination created successfully"),
      );
  } catch (error) {
    next(error);
  }
};

export const getTerminations = async (
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
      status: { $ne: terminationStatus.CANCEL },
    };

    if (role === "EMPLOYEE") {
      filter.userId = id;
    } else if (role === "MANAGER") {
      const userIds = await getMyManagedUserIdList(id);
      filter.userId = { $in: [...userIds, id] };
    }

    if (search) {
      const users = await UserModel.find({
        companyId: req.user!.companyId,
        $or: [
          {
            firstName: {
              $regex: search,
              $options: "i",
            },
          },
          {
            lastName: {
              $regex: search,
              $options: "i",
            },
          },
        ],
      }).select("_id");

      const searchUserIds = users.map((user) => user._id);

      if (role === "EMPLOYEE") {
        filter.userId = {
          $in: searchUserIds.filter(
            (userId) => userId.toString() === id.toString(),
          ),
        };
      } else if (role === "MANAGER") {
        const managedUserIds = await getMyManagedUserIdList(id);

        const allowedUserIds = [...managedUserIds, id].map((id) =>
          id.toString(),
        );

        filter.userId = {
          $in: searchUserIds.filter((userId) =>
            allowedUserIds.includes(userId.toString()),
          ),
        };
      } else {
        filter.userId = {
          $in: searchUserIds,
        };
      }
    }

    if (status) {
      filter.status = status;
    }

    const terminationQuery = TerminationModel.find(filter)
      .populate({
        path: "userId",
        select: "firstName lastName role profileImage departmentId userId",
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
      terminationQuery.skip(skip).limit(limit);
    }

    const [terminations, total] = await Promise.all([
      terminationQuery,
      TerminationModel.countDocuments(filter),
    ]);

    if (isDownload) {
      const data = terminations.map((termination: any) => ({
        Name: termination.userId.firstName + termination.userId.lastName,
        TerminationType: termination.terminationType,
        Status: termination.status,
        Reason: termination.reason,
        LastWorkingDay: termination.lastWorkingDate.toLocaleDateString(),
      }));

      return downloadCsv(res, data, "terminations", csvPassword);
    }

    return res.status(200).json(
      ApiResponse.success(
        {
          terminations,
          total,
        },
        "Terminations fetched successfully",
      ),
    );
  } catch (error) {
    next(error);
  }
};

export const getTerminationCount = async (
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

    const [terminate, hold] = await Promise.all([
      TerminationModel.countDocuments({
        ...filter,
        status: "TERMINATE" as terminationStatus,
      }),
      TerminationModel.countDocuments({
        ...filter,
        status: "HOLD" as terminationStatus,
      }),
      // TerminationModel.countDocuments({
      //   ...filter,
      //   status: "CANCEL" as terminationStatus,
      // }),
    ]);

    return res.status(200).json(
      ApiResponse.success(
        {
          total: terminate + hold,
          terminate,
          hold,
          // cancel,
        },
        "Termination counts fetched successfully",
      ),
    );
  } catch (error) {
    next(error);
  }
};

export const getTerminationById = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const termination = await TerminationModel.findOne({
      _id: req.params.terminationId,
      companyId: req.user!.companyId,
    }).populate({
      path: "userId",
      select: "firstName lastName role profileImage createdAt",
      populate: { path: "designationId", select: "name" },
    });

    if (!termination) {
      return res.status(404).json(ApiResponse.error("Termination not found"));
    }

    return res
      .status(200)
      .json(
        ApiResponse.success(termination, "Termination fetched successfully"),
      );
  } catch (error) {
    next(error);
  }
};

export const updateTermination = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const termination = await TerminationModel.findOne({
      _id: req.params.terminationId,
      companyId: req.user!.companyId,
    });

    if (!termination) {
      return res.status(404).json(ApiResponse.error("Termination not found"));
    }

    const { userId, terminationType, lastWorkingDate, reason } = req.body;

    if (userId !== undefined) termination.userId = userId;

    if (terminationType !== undefined)
      termination.terminationType = terminationType;

    if (lastWorkingDate !== undefined)
      termination.lastWorkingDate = normalizeDate(lastWorkingDate);

    if (reason !== undefined) termination.reason = reason;

    await termination.save();

    return res
      .status(200)
      .json(ApiResponse.success(null, "Termination updated successfully"));
  } catch (error) {
    next(error);
  }
};

export const updateTerminationStatus = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { id } = req.user!;
    const { status, remarks } = req.body;
    const assignedBy = req.user!.id;

    const termination = await TerminationModel.findOne({
      _id: req.params.terminationId,
      companyId: req.user!.companyId,
    });

    if (!termination) {
      return res.status(404).json(ApiResponse.error("Termination not found"));
    }

    if (id.toString() === termination.userId.toString()) {
      return res
        .status(404)
        .json(ApiResponse.error("Cannot update own status"));
    }

    termination.status = status;

    await addUserHistory({
      userId: req.user!.id as string,
      field: "terminationStatus",
      fieldValue: status,
      fieldId: termination._id.toString(),
      remarks,
      assignedBy,
    });
    await termination.save();

    return res
      .status(200)
      .json(ApiResponse.success(null, "Status updated successfully"));
  } catch (error) {
    next(error);
  }
};

export const sendTerminationMail = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { userId, email } = req.body;
    const { id: senderId } = req.user!;

    const [user, sender, termination] = await Promise.all([
      UserModel.findById(userId).select("email firstName lastName"),
      UserModel.findById(senderId).select("firstName lastName role"),
      TerminationModel.findOne({ userId }).sort({ createdAt: -1 }),
    ]);

    if (!user) {
      return res.status(404).json(ApiResponse.error("Employee not found"));
    }

    if (!sender) {
      return res.status(404).json(ApiResponse.error("Sender not found"));
    }

    if (!termination) {
      return res
        .status(404)
        .json(ApiResponse.error("Termination record not found"));
    }

    const beneficiaryEmail = email || user.email;

    const beneficiaryName = `${user.firstName} ${user.lastName}`.trim();
    const senderName = `${sender.firstName} ${sender.lastName}`.trim();

    const lastWorkingDay =
      termination.lastWorkingDate.toLocaleDateString("en-GB");

    await sendMail({
      to: beneficiaryEmail,
      subject: "Termination",
      html: terminationTemplate({
        employeeName: beneficiaryName,
        terminationDate: lastWorkingDay,
        reason: termination.reason || "",
        managerName: senderName,
        managerDesignation: sender.role,
      }),
    });

    termination.mailSent = true;
    termination.mailSentAt = new Date();

    await addUserHistory({
      userId: req.user!.id as string,
      field: "terminationMail",
      fieldValue: lastWorkingDay,
      fieldId: termination._id.toString(),
      remarks: "",
      assignedBy: senderId,
    });
    await termination.save();

    return res
      .status(200)
      .json(ApiResponse.success(null, "Termination email sent successfully"));
  } catch (error) {
    next(error);
  }
};
