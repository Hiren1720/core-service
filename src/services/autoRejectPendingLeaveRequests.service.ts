import mongoose from "mongoose";
import {
  LeaveRequestModel,
  UserLeaveBalanceModel,
} from "../infrastructure/database/models";
import { addUserHistory } from "../shared/services/userHistory.service";
import { leaveStatusType } from "../types/types";

interface IAutoRejectPendingLeaveRequests {
  year: number;
  month: number;
}

export const autoRejectPendingLeaveRequests = async ({
  year,
  month,
}: IAutoRejectPendingLeaveRequests) => {
  const startOfMonth = new Date(Date.UTC(year, month - 1, 1) - 330 * 60 * 1000);
  const pendingLeaveRequests = await LeaveRequestModel.find({
    status: leaveStatusType.PENDING,
    startDate: { $lt: startOfMonth },
  })
    .select("_id")
    .lean();

  for (const { _id } of pendingLeaveRequests) {
    const session = await mongoose.startSession();

    try {
      await session.withTransaction(async () => {
        const leaveRequest = await LeaveRequestModel.findOne({
          _id,
          status: leaveStatusType.PENDING,
          startDate: { $lt: startOfMonth },
        }).session(session);

        if (!leaveRequest) return;

        const yearOfLeave = leaveRequest.startDate.getFullYear();
        const leaveBalance = await UserLeaveBalanceModel.findOneAndUpdate(
          {
            userId: leaveRequest.userId,
            leaveId: leaveRequest.leaveId,
            year: yearOfLeave,
            pendingApproval: { $gte: leaveRequest.totalDays },
          },
          { $inc: { pendingApproval: -leaveRequest.totalDays } },
          { new: true, session },
        );

        if (!leaveBalance) {
          throw new Error(
            `Unable to release pending leave balance for request ${leaveRequest._id}`,
          );
        }

        const remarks = "Automatically rejected at month end";
        leaveRequest.status = leaveStatusType.REJECTED;
        leaveRequest.approvedAt = new Date();
        leaveRequest.remarks = remarks;
        await leaveRequest.save({ session });

        await addUserHistory(
          {
            userId: leaveRequest.userId.toString(),
            field: "leaveApplicationStatus",
            fieldValue: leaveStatusType.REJECTED,
            fieldId: leaveRequest._id.toString(),
            remarks,
            assignedBy: leaveRequest.userId.toString(),
          },
          session,
        );
      });
    } finally {
      await session.endSession();
    }
  }

  console.log(
    `Auto-rejected ${pendingLeaveRequests.length} pending leave requests`,
  );
};
