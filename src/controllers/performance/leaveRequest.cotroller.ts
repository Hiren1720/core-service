import { NextFunction, Request, Response } from "express";
import mongoose from "mongoose";
import {
  LeaveRequestModel,
  UserLeaveBalanceModel,
} from "../../infrastructure/database/models";
import { ApiResponse } from "../../shared/response/api-response";
import {
  validateContinuousLeave,
  validateLeaveOverlap,
  validateLeavePolicy,
} from "../../services/validateLeavePolicy";
import { calculateLeaveDays } from "../../services/calculateLeaveDays";
import { addUserHistory } from "../../shared/services/userHistory.service";

export const applyLeave = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    const id = req.user!.id;
    const companyId = req.user!.companyId;
    const {
      userId: bodyUserId, // comes when manager apply leave
      leaveId,
      startDate,
      endDate,
      duration,
      reason,
    } = req.body;
    const userId = bodyUserId ?? id;

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (start > end) {
      return res.status(400).json(ApiResponse.error("Invalid date range"));
    }

    const { policy } = await validateLeavePolicy({
      userId,
      leaveId,
      startDate: start,
    });

    await validateLeaveOverlap(userId, start, end);

    const totalDays = await calculateLeaveDays({
      companyId: companyId as string,
      startDate: start,
      endDate: end,
      duration,
      weeklyOffs: policy.workHours.weeklyOffs,
    });

    if (totalDays <= 0) {
      return res
        .status(400)
        .json(
          ApiResponse.error(
            "Selected dates contain only holidays or weekly offs",
          ),
        );
    }

    const userLeave = await UserLeaveBalanceModel.find({
      userId,
      year: new Date().getFullYear()
    });

    if (!userLeave) {
      return res.status(404).json(ApiResponse.error("Leave balance not found"));
    }

    const leaveBalance = userLeave.find(
      (x: any) => x.leaveId.toString() === leaveId,
    );

    if (!leaveBalance) {
      return res.status(400).json(ApiResponse.error("Leave not assigned"));
    }

    if ((leaveBalance.allocated - leaveBalance.used) < totalDays) {
      return res
        .status(400)
        .json(ApiResponse.error("Insufficient leave balance"));
    }

    await validateContinuousLeave({
      userId,
      startDate: start,
      endDate: end,
      enabled: policy.continuousLeave.enabled,
      maxLeaves: policy.continuousLeave.maxLeaves,
    });

    await LeaveRequestModel.create(
      [
        {
          userId,
          leaveId,
          startDate: start,
          endDate: end,
          duration,
          totalDays,
          reason,
        },
      ],
      {
        session,
      },
    );

    // leaveBalance.pending += totalDays;

    // await userLeave.save({ session });

    // await addUserHistory(
    //   {
    //     userId,
    //     field: "LeaveApplication",
    //     fieldValue: leaveId,
    //     remarks: reason,
    //     assignedBy: userId,
    //   },
    //   session,
    // );

    await session.commitTransaction();

    return res
      .status(201)
      .json(ApiResponse.success(null, "Leave applied successfully"));
  } catch (error) {
    await session.abortTransaction();
    next(error);
  } finally {
    session.endSession();
  }
};
