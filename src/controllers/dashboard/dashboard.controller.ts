import { NextFunction, Request, Response } from "express";
import {
  PromotionModel,
  ResignationModel,
  TerminationModel,
  UserModel,
} from "../../infrastructure/database/models";
import {
  promotionStatus,
  resignationStatus,
  status,
  terminationStatus,
  userStatus,
} from "../../types/types";
import { ApiResponse } from "../../shared/response/api-response";

export const workforceOverview = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const companyId = req.user!.companyId;
    const filter: any = {
      companyId,
    };

    const [
      activeEmployee,
      inactiveEmployee,
      deletedEmployee,
      pendingOnboardingCount,
      pendingOnboardingList,
      pendingResignationCount,
      pendingResignationList,
      pendingTerminationCount,
      pendingTerminationList,
      pendingPromotionCount,
      pendingPromotionList,
    ] = await Promise.all([
      UserModel.countDocuments({
        ...filter,
        status: "ACTIVE" as status,
        role: { $ne: "OWNER" },
      }),
      UserModel.countDocuments({ ...filter, status: "INACTIVE" as status }),
      UserModel.countDocuments({ ...filter, status: "DELETED" as status }),
      UserModel.countDocuments({ ...filter, status: "PENDING" as userStatus }),
      UserModel.find({ ...filter, status: "PENDING" as userStatus })
        .select("profileImage firstName lastName")
        .sort({
          createdAt: -1,
        })
        .limit(3)
        .lean(),
      ResignationModel.countDocuments({
        ...filter,
        status: "PENDING" as resignationStatus,
      }),
      ResignationModel.find({
        ...filter,
        status: "PENDING" as resignationStatus,
      })
        .populate({
          path: "userId",
          select: "firstName lastName profileImage",
        })
        .sort({
          createdAt: -1,
        })
        .limit(3)
        .lean(),
      TerminationModel.countDocuments({
        ...filter,
        status: "HOLD" as terminationStatus,
      }),
      TerminationModel.find({
        ...filter,
        status: "HOLD" as terminationStatus,
      })
        .populate({
          path: "userId",
          select: "firstName lastName profileImage",
        })
        .sort({
          createdAt: -1,
        })
        .limit(3)
        .lean(),
      PromotionModel.countDocuments({
        ...filter,
        status: "HOLD" as promotionStatus,
      }),
      PromotionModel.find({
        ...filter,
        status: "HOLD" as promotionStatus,
      })
        .populate("userId", "firstName lastName  profileImage")
        .sort({
          createdAt: -1,
        })
        .limit(3)
        .lean(),
    ]);

    return res.status(200).json(
      ApiResponse.success(
        {
          employee: {
            total: activeEmployee + inactiveEmployee + deletedEmployee,
            active: activeEmployee,
            inactive: inactiveEmployee,
            deleted: deletedEmployee,
          },
          onboarding: {
            count: pendingOnboardingCount,
            list: pendingOnboardingList,
          },
          resignation: {
            count: pendingResignationCount,
            list: pendingResignationList.map((el) => el.userId),
          },
          termination: {
            count: pendingTerminationCount,
            list: pendingTerminationList.map((el) => el.userId),
          },
          promotion: {
            count: pendingPromotionCount,
            list: pendingPromotionList.map((el) => el.userId),
          },
        },
        "Workforce fetched successfully",
      ),
    );
  } catch (error) {
    next(error);
  }
};