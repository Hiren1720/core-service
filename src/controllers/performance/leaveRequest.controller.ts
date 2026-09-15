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
  UserModel,
} from "../../infrastructure/database/models";
import { leaveStatusType } from "../../types/types";
import { validateLeaveBalance } from "../../services/leave.service";
import { addUserHistory } from "../../shared/services/userHistory.service";
import { normalizeDate } from "../../shared/helpers/dateHelper";
import { downloadCsv } from "../../shared/utils/csvDownload";
import { getMyManagedUserIdList } from "../../shared/services/users.service";

export const getMyLeavesBucket = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { year, userId } = req.query;

    const list = await UserLeaveBalanceModel.find({
      userId: String(userId),
      year: Number(year),
    })
      .populate("leaveId", "name isPaid")
      .select("allocated used pendingApproval")
      .lean();

    return res
      .status(200)
      .json(ApiResponse.success(list, "Leave bucket fetched"));
  } catch (error: any) {
    next(error);
  }
};

export const applyLeave = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    const companyId = req.user!.companyId as string;

    const { userId, reason = "", leaves } = req.body;

    if (!userId || !Array.isArray(leaves) || leaves.length === 0) {
      throw new Error("userId and leaves are required");
    }

    // Prevent duplicate dates in same request
    const dates = leaves.map((leave: any) => leave.date);

    const uniqueDates = new Set(dates);

    if (uniqueDates.size !== dates.length) {
      throw new Error("Duplicate leave date found");
    }

    const createdLeaveRequests = [];

    for (const leave of leaves) {
      const { date, leaveId, duration = "FULL_DAY" } = leave;

      if (!date || !leaveId) {
        throw new Error("Each leave must contain date and leaveId");
      }

      if (!["FULL_DAY", "FIRST_HALF", "SECOND_HALF"].includes(duration)) {
        throw new Error(`Invalid duration for ${date}`);
      }

      const leaveDate = normalizeDate(date);

      if (Number.isNaN(leaveDate.getTime())) {
        throw new Error(`Invalid leave date: ${date}`);
      }

      // --------------------------------------------------
      // Validate leave policy for this particular date
      // --------------------------------------------------

      const { policy } = await validateLeavePolicy({
        userId,
        leaveId,
        startDate: leaveDate,
      });

      const weeklyOffs = policy.workHours?.weeklyOffs || [];

      // --------------------------------------------------
      // Calculate leave day
      // --------------------------------------------------

      const totalDays = await calculateLeaveDays({
        companyId,
        startDate: leaveDate,
        endDate: leaveDate,
        duration,
        weeklyOffs,
      });

      if (totalDays <= 0) {
        throw new Error(`No working day available for ${date}`);
      }

      // --------------------------------------------------
      // Check overlap for this date
      // --------------------------------------------------

      await validateLeaveOverlap(userId, leaveDate, leaveDate, session);

      // --------------------------------------------------
      // Continuous leave rule
      // --------------------------------------------------
      await validateContinuousLeave(
        {
          userId,
          startDate: leaveDate,
          endDate: leaveDate,
          maxLeaves: policy.continuousLeave?.enabled
            ? 0
            : policy.continuousLeave.maxLeaves,
          enabled: policy.continuousLeave.enabled,
        },
        session,
      );

      // --------------------------------------------------
      // Validate balance for this particular leave type
      // --------------------------------------------------

      const leaveBalance = await validateLeaveBalance(
        userId,
        leaveId,
        totalDays,
        session,
      );

      // --------------------------------------------------
      // Create individual leave request
      // --------------------------------------------------

      const [leaveRequest] = await LeaveRequestModel.create(
        [
          {
            userId,
            leaveId,
            companyId,
            startDate: leaveDate,
            endDate: leaveDate,
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
      // Reserve pending balance
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
          fieldId: leaveRequest._id.toString(),
          remarks: reason,
          assignedBy: userId,
        },
        session,
      );

      createdLeaveRequests.push(leaveRequest);
    }

    await session.commitTransaction();

    return res
      .status(201)
      .json(
        ApiResponse.success(
          createdLeaveRequests,
          "Leaves applied successfully",
        ),
      );
  } catch (error: any) {
    await session.abortTransaction();

    return res
      .status(400)
      .json(ApiResponse.error(error?.message || "Failed to apply leaves"));
  } finally {
    await session.endSession();
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
          fieldId: leaveRequest._id.toString(),
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
    const { role, companyId, id } = req.user!;

    const search = req.query.search?.toString() || "";
    const status = req.query.status?.toString();
    const isDownload = req.query.isDownload === "true";
    const csvPassword = req.query.csvPassword
      ? String(req.query.csvPassword)
      : undefined;

    const filter: any = {
      companyId,
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
        filter.userId = id;
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
    } else {
    }

    if (status) {
      filter.status = status;
    }

    const leaveRequestQuery = LeaveRequestModel.find(filter)
      .populate("userId", "firstName lastName profileImage role userId")
      .populate("leaveId", "name")
      .sort({
        createdAt: -1,
      })
      .lean();

    if (!isDownload) {
      leaveRequestQuery.skip(skip).limit(limit);
    }

    const [leaves, total] = await Promise.all([
      leaveRequestQuery,
      LeaveRequestModel.countDocuments(filter),
    ]);

    if (isDownload) {
      const data = leaves.map((leave: any) => ({
        Name: leave.userId.firstName + leave.userId.lastName,
        duration: leave.duration,
        Status: leave.status,
        Reason: leave.reason,
        Date: leave.startDate?.toLocaleDateString(),
        ApprovedAt: leave.approvedAt?.toLocaleDateString(),
      }));

      return downloadCsv(res, data, "leaveApllications", csvPassword);
    }

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
      .populate("userId", "firstName lastName profileImage role userId")
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

export const deleteLeaveRequest = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const leaveRequestId = req.params.leaveRequestId;

    const leaveRequest = await LeaveRequestModel.findById(leaveRequestId);
    if (!leaveRequest || leaveRequest.status !== "PENDING") {
      return res
        .status(404)
        .json(ApiResponse.error("Pending leave application not found"));
    }

    await LeaveRequestModel.findByIdAndDelete(leaveRequestId);

    return res
      .status(200)
      .json(
        ApiResponse.success(null, "Leave application Deleted successfully"),
      );
    // await UserLeaveBalanceModel.findOneAndUpdate(leaveRequest.leaveId, {})
  } catch (error) {
    next(error);
  }
};
