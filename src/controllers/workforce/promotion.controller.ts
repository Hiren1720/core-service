import { NextFunction, Request, Response } from "express";
import {
  PromotionModel,
  UserAssignmentModel,
  UserModel,
} from "../../infrastructure/database/models";
import { ApiResponse } from "../../shared/response/api-response";
import { addUserHistory } from "../../shared/services/userHistory.service";
import { promotionStatus } from "../../types/types";
import el from "zod/v4/locales/el.js";

export const createPromotion = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { userId, designationId, effectiveDate, reason } = req.body;

    const promotion = await PromotionModel.create({
      companyId: req.user!.companyId,
      userId,
      designationId,
      effectiveDate,
      reason,
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

    const filter: any = {
      companyId: req.user!.companyId,
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

    const [promotions, total] = await Promise.all([
      PromotionModel.find(filter)
        .populate("userId", "firstName lastName role profileImage")
        .populate("designationId", "name")
        .sort({
          createdAt: -1,
        })
        .skip(skip)
        .limit(limit)
        .lean(),

      PromotionModel.countDocuments(filter),
    ]);

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

    const [promoted, hold, cancel] = await Promise.all([
      PromotionModel.countDocuments({
        ...filter,
        status: "PROMOTED" as promotionStatus,
      }),
      PromotionModel.countDocuments({
        ...filter,
        status: "HOLD" as promotionStatus,
      }),
      PromotionModel.countDocuments({
        ...filter,
        status: "CANCEL" as promotionStatus,
      }),
    ]);

    return res.status(200).json(
      ApiResponse.success(
        {
          total: promoted + hold + cancel,
          promoted,
          hold,
          cancel,
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

    if (effectiveDate !== undefined) promotion.effectiveDate = effectiveDate;

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
