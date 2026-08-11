import { Request, Response, NextFunction } from "express";
import mongoose from "mongoose";
import { ApiResponse } from "../../shared/response/api-response";
import {
  validateContinuousLeave,
  validateLeaveOverlap,
  validateLeavePolicy,
} from "../../services/validateLeavePolicy";
import { calculateLeaveDays } from "../../services/calculateLeaveDays";
import {
  LeaveRequestModel,
  UserLeaveBalanceModel,
} from "../../infrastructure/database/models";
import { leaveStatusType } from "../../types/types";
import { validateLeaveBalance } from "../../services/leave.service";
import { addUserHistory } from "../../shared/services/userHistory.service";
import { normalizeDate } from "../../shared/helpers/dateHelper";

export const applyLeave = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    const companyId = req.user!.companyId as string;

    const {
      leaveId,
      userId,
      startDate,
      endDate,
      duration = "FULL_DAY",
      reason = "",
    } = req.body;

    if (!leaveId || !startDate || !endDate) {
      await session.abortTransaction();

      return res
        .status(400)
        .json(ApiResponse.error("leaveId, startDate and endDate are required"));
    }

    const start = normalizeDate(startDate);
    const end = normalizeDate(endDate);

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      await session.abortTransaction();

      return res
        .status(400)
        .json(ApiResponse.error("Invalid start or end date"));
    }

    if (start > end) {
      await session.abortTransaction();

      return res
        .status(400)
        .json(ApiResponse.error("Start date cannot be greater than end date"));
    }

    // --------------------------------------------------
    // Get user's current leave policy
    // --------------------------------------------------
    const { policy } = await validateLeavePolicy({
      userId,
      leaveId,
      startDate: start,
    });

    // --------------------------------------------------
    // Get weekly offs from policy
    // --------------------------------------------------
    const weeklyOffs = policy.workHours?.weeklyOffs || [];

    // --------------------------------------------------
    // Calculate actual leave days.
    // Weekly offs and company holidays are excluded.
    // --------------------------------------------------
    const totalDays = await calculateLeaveDays({
      companyId,
      startDate: start,
      endDate: end,
      duration,
      weeklyOffs,
    });

    if (totalDays <= 0) {
      await session.abortTransaction();

      return res
        .status(400)
        .json(
          ApiResponse.error("No working days available for selected dates"),
        );
    }

    // --------------------------------------------------
    // Check overlapping leave
    // --------------------------------------------------
    await validateLeaveOverlap(userId, start, end);

    // --------------------------------------------------
    // Check continuous leave rule
    // --------------------------------------------------
    if (policy.continuousLeave?.enabled) {
      await validateContinuousLeave({
        userId,
        startDate: start,
        endDate: end,
        maxLeaves: policy.continuousLeave.maxLeaves,
        enabled: policy.continuousLeave.enabled,
      });
    }

    // --------------------------------------------------
    // Check available leave balance
    // --------------------------------------------------
    const leaveBalance = await validateLeaveBalance(userId, leaveId, totalDays);

    // --------------------------------------------------
    // Create leave request
    // --------------------------------------------------
    const [leaveRequest] = await LeaveRequestModel.create(
      [
        {
          userId,
          leaveId,
          startDate: start,
          endDate: end,
          duration,
          totalDays,
          reason,
          status: leaveStatusType.PENDING,
        },
      ],
      {
        session,
      },
    );

    // --------------------------------------------------
    // Reserve leave days as pending
    // --------------------------------------------------

    leaveBalance.pendingApproval += totalDays;

    await leaveBalance.save({
      session,
    });

    // --------------------------------------------------
    // History
    // --------------------------------------------------
    await addUserHistory(
      {
        userId,
        field: "leaveApplicationStatus",
        fieldValue: "PENDING",
        remarks: reason,
        assignedBy: userId,
      },
      session,
    );

    await session.commitTransaction();

    return res
      .status(201)
      .json(ApiResponse.success(leaveRequest, "Leave applied successfully"));
  } catch (error: any) {
    await session.abortTransaction();

    return res
      .status(400)
      .json(ApiResponse.error(error?.message || "Failed to apply leave"));
  } finally {
    session.endSession();
  }
};

export const updateLeaveApplicationStatus = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    const { status, remarks = "" } = req.body;
    const leaveRequestId = req.params.leaveRequestId;
    // --------------------------------------------------
    // Validate requested status
    // --------------------------------------------------

    if (
      ![leaveStatusType.APPROVED, leaveStatusType.REJECTED].includes(status)
    ) {
      await session.abortTransaction();
      return res
        .status(400)
        .json(
          ApiResponse.error(
            "Invalid status. Only APPROVED or REJECTED is allowed",
          ),
        );
    }

    // --------------------------------------------------
    // Find pending leave request
    // --------------------------------------------------
    const leaveRequest =
      await LeaveRequestModel.findById(leaveRequestId).session(session);

    if (!leaveRequest) {
      await session.abortTransaction();
      return res.status(404).json(ApiResponse.error("Leave request not found"));
    }

    // --------------------------------------------------
    // Only PENDING requests can be processed
    // --------------------------------------------------
    if (leaveRequest.status !== leaveStatusType.PENDING) {
      await session.abortTransaction();
      return res.status(400).json(ApiResponse.error("Leave already processed"));
    }

    // --------------------------------------------------
    // Find user's leave balance
    // --------------------------------------------------

    const year = leaveRequest.startDate.getFullYear();

    const leaveBalance = await UserLeaveBalanceModel.findOne({
      userId: leaveRequest.userId,
      leaveId: leaveRequest.leaveId,
      year,
    }).session(session);

    if (!leaveBalance) {
      await session.abortTransaction();
      return res
        .status(404)
        .json(ApiResponse.error("User leave balance not found"));
    }

    const totalDays = leaveRequest.totalDays;

    // --------------------------------------------------
    // APPROVE
    // --------------------------------------------------

    if (status === leaveStatusType.APPROVED) {
      if (leaveBalance.pendingApproval < totalDays) {
        await session.abortTransaction();

        return res
          .status(400)
          .json(ApiResponse.error("Invalid pending leave balance"));
      }

      leaveBalance.pendingApproval -= totalDays;
      leaveBalance.used += totalDays;
    }

    // --------------------------------------------------
    // REJECT
    // --------------------------------------------------

    if (status === leaveStatusType.REJECTED) {
      if (leaveBalance.pendingApproval < totalDays) {
        await session.abortTransaction();

        return res
          .status(400)
          .json(ApiResponse.error("Invalid pending leave balance"));
      }

      leaveBalance.pendingApproval -= totalDays;
    }

    // --------------------------------------------------
    // Update leave request
    // --------------------------------------------------

    leaveRequest.status = status;
    leaveRequest.approvedBy = new mongoose.Types.ObjectId(req.user!.id);
    leaveRequest.approvedAt = new Date();
    leaveRequest.remarks = remarks;

    // --------------------------------------------------
    // Save everything in same transaction
    // --------------------------------------------------

    await Promise.all([
      leaveRequest.save({
        session,
      }),

      leaveBalance.save({
        session,
      }),

      addUserHistory(
        {
          userId: leaveRequest.userId.toString(),
          field: "leaveApplicationStatus",
          fieldValue: status,
          remarks,
          assignedBy: req.user!.id,
        },
        session,
      ),
    ]);

    await session.commitTransaction();

    return res
      .status(200)
      .json(
        ApiResponse.success(null, `Leave ${status.toLowerCase()} successfully`),
      );
  } catch (error) {
    await session.abortTransaction();

    next(error);
  } finally {
    session.endSession();
  }
};

export const getLeavesApplications = async (
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

    const filter: any = {};

    // if (search) {
    //   filter.name = {
    //     $regex: search,
    //     $options: "i",
    //   };
    // }

    if (status) {
      filter.status = status;
    }

    const [leaves, total] = await Promise.all([
      LeaveRequestModel.find(filter)
        .populate("userId", "firstName lastName profileImage role")
        .sort({
          createdAt: -1,
        })
        .skip(skip)
        .limit(limit)
        .lean(),

      LeaveRequestModel.countDocuments(filter),
    ]);

    return res.status(200).json(
      ApiResponse.success(
        {
          leaves,
          total,
        },
        "Leave applications fetched successfully",
      ),
    );
  } catch (error) {
    next(error);
  }
};

export const getLeaveApplicationCount = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const filter: any = {};

    const [approved, rejected, pending] = await Promise.all([
      LeaveRequestModel.countDocuments({
        ...filter,
        status: leaveStatusType.APPROVED,
      }),
      LeaveRequestModel.countDocuments({
        ...filter,
        status: leaveStatusType.REJECTED,
      }),
      LeaveRequestModel.countDocuments({
        ...filter,
        status: leaveStatusType.PENDING,
      }),
    ]);

    return res.status(200).json(
      ApiResponse.success(
        {
          total: approved + rejected + pending,
          approved,
          rejected,
          pending,
        },
        "Leave application counts fetched successfully",
      ),
    );
  } catch (error) {
    next(error);
  }
};

export const getLeaveApplicationById = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const leaveRequestId = req.params.leaveRequestId;

    const leaveRequest = await LeaveRequestModel.findById(leaveRequestId)
      .populate("userId", "firstName lastName profileImage role")
      .lean();

    if (!leaveRequest) {
      return res
        .status(404)
        .json(ApiResponse.error("Leave application not found"));
    }

    return res
      .status(200)
      .json(
        ApiResponse.success(
          leaveRequest,
          "Leave application fetched successfully",
        ),
      );
  } catch (error) {
    next(error);
  }
};
