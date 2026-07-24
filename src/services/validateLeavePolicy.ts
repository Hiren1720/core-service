import { leaveStatusType } from "../types/types";
import {
  UserPolicyModel,
  LeaveRequestModel,
} from "../infrastructure/database/models";

interface ValidateLeaveProps {
  userId: string;
  leaveId: string;
  startDate: Date;
}

export const validateLeavePolicy = async ({
  userId,
  leaveId,
  startDate,
}: ValidateLeaveProps) => {
  const userPolicy = await UserPolicyModel.findOne({
    userId,
  })
    .sort({ createdAt: -1 })
    .populate("policyId");

  if (!userPolicy) {
    throw new Error("Policy not assigned");
  }

  const policy: any = userPolicy.policyId;

  if (!policy) {
    throw new Error("Policy not found");
  }

  const leavePolicy = policy.leaves.find(
    (leave: any) => leave.leaveId.toString() === leaveId,
  );

  if (!leavePolicy) {
    throw new Error("This leave type is not allowed in your policy");
  }

  const hoursBeforeLeave =
    (startDate.getTime() - Date.now()) / (1000 * 60 * 60);

  if (hoursBeforeLeave < leavePolicy.hoursBeforeLeave) {
    throw new Error(
      `Leave must be applied at least ${leavePolicy.hoursBeforeLeave} hours before`,
    );
  }

  return {
    policy,
    leavePolicy,
  };
};

export const validateLeaveOverlap = async (
  userId: string,
  startDate: Date,
  endDate: Date,
) => {
  const existingLeave = await LeaveRequestModel.findOne({
    userId,
    status: {
      $nin: [leaveStatusType.REJECTED],
    },
    startDate: {
      $lte: endDate,
    },
    endDate: {
      $gte: startDate,
    },
  });

  if (existingLeave) {
    throw new Error("Leave already exists for selected dates");
  }
};

interface ValidateContinuousProps {
  userId: string;
  startDate: Date;
  endDate: Date;
  maxLeaves: number;
  enabled: boolean;
}

export const validateContinuousLeave = async ({
  userId,
  startDate,
  endDate,
  maxLeaves,
  enabled,
}: ValidateContinuousProps) => {
  if (!enabled) return;

  const previousLeaves = await LeaveRequestModel.find({
    userId,
    status: leaveStatusType.APPROVED,
  }).select("startDate endDate");

  const leaveDates = new Set<string>();

  for (const leave of previousLeaves) {
    const current = new Date(leave.startDate);

    while (current <= leave.endDate) {
      leaveDates.add(current.toISOString().slice(0, 10));
      current.setDate(current.getDate() + 1);
    }
  }

  const current = new Date(startDate);

  while (current <= endDate) {
    leaveDates.add(current.toISOString().slice(0, 10));
    current.setDate(current.getDate() + 1);
  }

  const dates = [...leaveDates].sort().map((date) => new Date(date));

  let consecutive = 1;

  for (let i = 1; i < dates.length; i++) {
    const diff =
      (dates[i].getTime() - dates[i - 1].getTime()) / (1000 * 60 * 60 * 24);

    if (diff === 1) {
      consecutive++;

      if (consecutive > maxLeaves) {
        throw new Error(
          `Maximum ${maxLeaves} continuous leave(s) are allowed.`,
        );
      }
    } else {
      consecutive = 1;
    }
  }
};
