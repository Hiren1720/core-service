import { ClientSession, Types } from "mongoose";
import {
  PolicyModel,
  UserLeaveBalanceModel,
} from "../infrastructure/database/models";

interface IGenerateUserLeaveBalance {
  userId: string;
  policyId: string;
  session?: ClientSession;
}

export const generateUserLeaveBalance = async ({
  userId,
  policyId,
  session,
}: IGenerateUserLeaveBalance) => {
  const year = new Date().getFullYear();

  const policy = await PolicyModel.findById(policyId)
    .select("leaves")
    .lean()
    .session(session || null);

  if (!policy) {
    throw new Error("Policy not found");
  }

  if (!policy.leaves.length) {
    return;
  }

  const objectIdUserId = new Types.ObjectId(userId);

  const operations = policy.leaves.map((leave) => ({
    updateOne: {
      filter: {
        userId: objectIdUserId,
        leaveId: leave.leaveId,
        year,
      },
      update: {
        $setOnInsert: {
          userId: objectIdUserId,
          leaveId: leave.leaveId,
          year,

          allocated: leave.limit,
          used: 0,
          pendingApproval: 0,
          carryForward: 0,
          encashed: 0,
        },
      },
      upsert: true,
    },
  }));

  await UserLeaveBalanceModel.bulkWrite(operations, {
    session,
  });
};


export const validateLeaveBalance = async (
  userId: string,
  leaveId: string,
  totalDays: number,
) => {
  const currentYear = new Date().getFullYear();

  const leaveBalance =
    await UserLeaveBalanceModel.findOne({
      userId,
      leaveId,
      year: currentYear,
    });

  if (!leaveBalance) {
    throw new Error("Leave balance not found");
  }

  const remaining =
    leaveBalance.allocated +
    leaveBalance.carryForward -
    leaveBalance.used -
    leaveBalance.pendingApproval -
    leaveBalance.encashed;

  if (remaining < totalDays) {
    throw new Error(
      "Insufficient leave balance",
    );
  }

  return leaveBalance;
};