import { NextFunction, Request, Response } from "express";
import {
  PromotionModel,
  UserAssignmentModel,
  UserModel,
} from "../../infrastructure/database/models";
import { ApiResponse } from "../../shared/response/api-response";
import { addUserHistory } from "../../shared/services/userHistory.service";
import { promotionStatus } from "../../types/types";
import { sendMail } from "../../shared/services/mail.service";
import { promotionTemplate } from "../../shared/templates/promotion";
import { normalizeDate } from "../../shared/helpers/dateHelper";
import { downloadCsv } from "../../shared/utils/csvDownload";

export const createPromotion = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { id: assignedBy } = req.user!;
    const { userId, designationId, effectiveDate, reason } = req.body;

    const promotion = await PromotionModel.create({
      companyId: req.user!.companyId,
      userId,
      designationId,
      effectiveDate: normalizeDate(effectiveDate),
      reason,
    });

    await addUserHistory({
      userId: userId,
      field: "promotionStatus",
      fieldId: promotion._id.toString(),
      fieldValue: promotionStatus.HOLD,
      remarks: "",
      assignedBy,
    });

    return res
      .status(201)
      .json(ApiResponse.success(promotion, "Promotion created successfully"));
  } catch (error) {
    next(error);
  }
};

export const getPromotions = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 10;

    const skip = (page - 1) * limit;

    const search = req.query.search?.toString() || "";
    const status = req.query.status?.toString();
    const isDownload = req.query.isDownload === "true";
    const csvPassword = req.query.csvPassword  ? String(req.query.csvPassword) : undefined;

    const filter: any = {
      companyId: req.user!.companyId,
      status: { $ne: promotionStatus.CANCEL },
    };

    // if (search) {
    //   filter.name = {
    //     $regex: search,
    //     $options: "i",
    //   };
    // }

    if (status) {
      filter.status = status;
    }

    const promotionQuery = PromotionModel.find(filter)
      .populate("userId", "firstName lastName role profileImage")
      .populate("designationId", "name")
      .sort({
        createdAt: -1,
      });

    if (!isDownload) {
      promotionQuery.skip(skip).limit(limit);
    }

    const [promotions, total] = await Promise.all([
      promotionQuery,
      PromotionModel.countDocuments(filter),
    ]);

    if (isDownload) {
      const data = promotions.map((promotion: any) => ({
        Name: promotion.userId.firstName + promotion.userId.lastName,
        Designation: promotion.designationId.name,
        Status: promotion.status,
        Reason: promotion.reason,
        EffectiveDate: promotion.effectiveDate.toLocaleDateString(),
      }));

      return downloadCsv(res, data, "promotions", csvPassword);
    }

    return res.status(200).json(
      ApiResponse.success(
        {
          promotions,
          total,
        },
        "Promotions fetched successfully",
      ),
    );
  } catch (error) {
    next(error);
  }
};

export const getPromotionCount = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const filter: any = {
      companyId: req.user!.companyId,
    };

    const [promoted, hold] = await Promise.all([
      PromotionModel.countDocuments({
        ...filter,
        status: "PROMOTED" as promotionStatus,
      }),
      PromotionModel.countDocuments({
        ...filter,
        status: "HOLD" as promotionStatus,
      }),
      // PromotionModel.countDocuments({
      //   ...filter,
      //   status: "CANCEL" as promotionStatus,
      // }),
    ]);

    return res.status(200).json(
      ApiResponse.success(
        {
          total: promoted + hold,
          promoted,
          hold,
          // cancel,
        },
        "Promotion counts fetched successfully",
      ),
    );
  } catch (error) {
    next(error);
  }
};

export const getPromotionById = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const promotion = await PromotionModel.findOne({
      _id: req.params.promotionId,
      companyId: req.user!.companyId,
    })
      .populate("userId", "firstName lastName role profileImage")
      .populate("designationId", "name");

    if (!promotion) {
      return res.status(404).json(ApiResponse.error("Promotion not found"));
    }

    return res
      .status(200)
      .json(ApiResponse.success(promotion, "Promotion fetched successfully"));
  } catch (error) {
    next(error);
  }
};

export const updatePromotion = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const promotion = await PromotionModel.findOne({
      _id: req.params.promotionId,
      companyId: req.user!.companyId,
    });

    if (!promotion) {
      return res.status(404).json(ApiResponse.error("Promotion not found"));
    }

    const { userId, designationId, effectiveDate, reason } = req.body;

    if (userId !== undefined) promotion.userId = userId;

    if (designationId !== undefined) promotion.designationId = designationId;

    if (effectiveDate !== undefined)
      promotion.effectiveDate = normalizeDate(effectiveDate);

    if (reason !== undefined) promotion.reason = reason;

    await promotion.save();

    return res
      .status(200)
      .json(ApiResponse.success(null, "Promotion updated successfully"));
  } catch (error) {
    next(error);
  }
};

export const updatePromotionStatus = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { status, remarks } = req.body;
    const assignedBy = req.user!.id;

    const promotion = await PromotionModel.findOne({
      _id: req.params.promotionId,
      companyId: req.user!.companyId,
    });

    if (!promotion) {
      return res.status(404).json(ApiResponse.error("Promotion not found"));
    }

    promotion.status = status;

    if (status === promotionStatus.PROMOTED) {
      // Update user's current designation
      await UserModel.findByIdAndUpdate(promotion.userId, {
        designationId: promotion.designationId,
      });

      // Get latest assignment
      const existingAssignment = await UserAssignmentModel.findOne({
        userId: promotion.userId,
      })
        .sort({ createdAt: -1 })
        .lean();

      if (existingAssignment) {
        const { _id, createdAt, updatedAt, ...assignmentData } =
          existingAssignment;

        await UserAssignmentModel.create({
          ...assignmentData,
          assignments: assignmentData.assignments.map((assignment: any) => ({
            ...assignment,
            designationId: promotion.designationId,
          })),
        });
      }
    }

    await addUserHistory({
      userId: req.user!.id as string,
      field: "promotionStatus",
      fieldId: promotion._id.toString(),
      fieldValue: status,
      remarks,
      assignedBy,
    });
    await promotion.save();

    return res
      .status(200)
      .json(ApiResponse.success(null, "Status updated successfully"));
  } catch (error) {
    next(error);
  }
};

export const sendPromotionMail = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { userId, email } = req.body;
    const { id: senderId } = req.user!;

    const [user, sender, promotion]: any[] = await Promise.all([
      UserModel.findById(userId).select("email firstName lastName"),
      UserModel.findById(senderId).select("firstName lastName role"),
      PromotionModel.findOne({ userId })
        .sort({ createdAt: -1 })
        .populate("designationId", "name"),
    ]);

    if (!user) {
      return res.status(404).json(ApiResponse.error("Employee not found"));
    }

    if (!sender) {
      return res.status(404).json(ApiResponse.error("Sender not found"));
    }

    if (!promotion) {
      return res
        .status(404)
        .json(ApiResponse.error("Promotion record not found"));
    }

    const beneficiaryEmail = email || user.email;

    const beneficiaryName = `${user.firstName} ${user.lastName}`.trim();
    const senderName = `${sender.firstName} ${sender.lastName}`.trim();

    const effectiveFrom = promotion.effectiveDate.toLocaleDateString("en-GB");

    await sendMail({
      to: beneficiaryEmail,
      subject: "Promotion",
      html: promotionTemplate({
        employeeName: beneficiaryName,
        newDesignation: promotion.designationId?.name,
        effectiveFrom,
        managerName: senderName,
        managerDesignation: sender.role,
      }),
    });

    promotion.mailSent = true;
    promotion.mailSentAt = new Date();

    await addUserHistory({
      userId: req.user!.id as string,
      field: "promotionMail",
      fieldId: promotion._id.toString(),
      fieldValue: effectiveFrom,
      remarks: "",
      assignedBy: senderId,
    });
    await promotion.save();

    return res
      .status(200)
      .json(ApiResponse.success(null, "Promotion email sent successfully"));
  } catch (error) {
    next(error);
  }
};
