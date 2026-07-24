import { Schema, model } from "mongoose";

const UserLeaveBalanceSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    leaveId: {
      type: Schema.Types.ObjectId,
      ref: "Leave",
      required: true,
    },

    year: {
      type: Number,
      required: true,
    },

    allocated: {
      type: Number,
      default: 0,
    },

    used: {
      type: Number,
      default: 0,
    },

    pendingApproval: {
      type: Number,
      default: 0,
    },

    carryForward: {
      type: Number,
      default: 0,
    },

    encashed: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

UserLeaveBalanceSchema.index(
  {
    userId: 1,
    leaveId: 1,
    year: 1,
  },
  {
    unique: true,
  },
);

export const UserLeaveBalanceModel = model(
  "UserLeaveBalance",
  UserLeaveBalanceSchema,
);
