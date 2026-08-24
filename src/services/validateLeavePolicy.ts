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
    $or: [
      // Previous years
      {
        effectiveFromYear: { $lt: new Date().getFullYear() },
      },
      // Same year, requested month or earlier
      {
        effectiveFromYear: new Date().getFullYear(), // currunt year
        effectiveFromMonth: { $lte: new Date().getMonth() + 1 }, // currunt month
      },
    ],
  })
    .sort({
      effectiveFromYear: -1,
      effectiveFromMonth: -1,
    })
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
  excludeLeaveRequestId?: string,
) => {
  const filter: any = {
    userId,
    status: {
      $ne: leaveStatusType.REJECTED,
    },
    startDate: {
      $lte: endDate,
    },
    endDate: {
      $gte: startDate,
    },
  };

  if (excludeLeaveRequestId) {
    filter._id = {
      $ne: excludeLeaveRequestId,
    };
  }

  const existingLeave = await LeaveRequestModel.findOne(filter);
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

    endDate: {
      $gte: new Date(startDate.getTime() - maxLeaves * 86400000),
    },

    startDate: {
      $lte: new Date(endDate.getTime() + maxLeaves * 86400000),
    },
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
