import { NextFunction, Request, Response } from "express";
import {
  AttendanceModel,
  LeaveRequestModel,
  PromotionModel,
  ResignationModel,
  TerminationModel,
  UserModel,
} from "../../infrastructure/database/models";
import {
  attendanceType,
  leaveStatusType,
  promotionStatus,
  resignationStatus,
  status,
  terminationStatus,
  userStatus,
} from "../../types/types";
import { ApiResponse } from "../../shared/response/api-response";
import { normalizeDate } from "../../shared/helpers/dateHelper";

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
      // deletedEmployee,
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
      // UserModel.countDocuments({ ...filter, status: "DELETED" as status }),
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
            total: activeEmployee + inactiveEmployee,
            active: activeEmployee,
            inactive: inactiveEmployee,
            // deleted: deletedEmployee,
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

export const attendanceOverview = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const companyId = req.user!.companyId;
    const { date } = req.query;

    if (!date) {
      res
        .status(400)
        .json(ApiResponse.error("Date needed to fetch attendance"));
    }

    const attendanceFilter: any = {
      companyId,
      attendanceDate: normalizeDate(new Date(date as string)),
    };

    const leavesFilter: any = {
      companyId,
      status: leaveStatusType.APPROVED,
      startDate: {
        $lte: normalizeDate(new Date(date as string)),
      },
      endDate: {
        $gte: normalizeDate(new Date(date as string)),
      },
    };

    const [attendances, leaves] = await Promise.all([
      AttendanceModel.find(attendanceFilter)
        .populate("userId", "firstName lastName profileImage")
        .select("attendanceStatus")
        .lean(),
      LeaveRequestModel.find(leavesFilter)
        .populate("userId", "firstName lastName profileImage")
        .select("userId")
        .lean(),
    ]);

    const totalEmployee = attendances.length;
    const totalLeaves = leaves.length;
    let totalPresent = 0;
    let totalAbsent = 0;
    let totalManual = 0;

    for (const attendance of attendances) {
      if (attendance.isManual) {
        totalManual++;
        continue;
      }

      switch (attendance.attendanceStatus) {
        case attendanceType.ABSENT:
          totalAbsent++;
          break;

        case attendanceType.PRESENT:
          totalPresent++;
          break;
      }
    }

    return res
      .status(200)
      .json(
        ApiResponse.success(
          {
            totalEmployee,
            totalLeaves,
            totalAbsent,
            totalPresent,
            totalManual,
            attendanceList: attendances,
            leavesList: leaves,
          },
          "Attendance overview fetched",
        ),
      );
  } catch (error) {
    next(error);
  }
};
