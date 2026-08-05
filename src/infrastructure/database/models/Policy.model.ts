import { Schema, model } from "mongoose";
import { status } from "../../../types/types";

/* ---------------- Work Hours ---------------- */
const WorkHourSchema = new Schema(
  {
    weeklyOffs: [
      {
        type: String,
        enum: [
          "MONDAY",
          "TUESDAY",
          "WEDNESDAY",
          "THURSDAY",
          "FRIDAY",
          "1stSATURDAY",
          "2ndSATURDAY",
          "3rdSATURDAY",
          "4thSATURDAY",
          "5thSATURDAY",
          "SUNDAY",
        ],
      },
    ],
  },
  { _id: false },
);

/* ---------------- Late Rules ---------------- */
const LateRuleSchema = new Schema(
  {
    allowedLateMinutes: {
      type: Number,
      default: 0,
    },
    allowedEarlyMinutes: {
      type: Number,
      default: 0,
    },
    allowedLateCount: {
      type: Number,
      default: 0,
    },
    fullDayMinHours: {
      type: Number,
      default: 0,
    },
    halfDayWorkMaxHours: {
      type: Number,
      default: 0,
    },
    halfDayWorkMinHours: {
      type: Number,
      default: 0,
    },
    onAbsentSlarayDaysCut: {
      type: Number,
      default: 0,
    },
  },
  { _id: false },
);

/* ---------------- Overtime ---------------- */
const OvertimeSchema = new Schema(
  {
    enabled: {
      type: Boolean,
      default: false,
    },

    minimumMinutes: {
      type: Number,
      default: 60,
    },

    overtimeRate: {
      //in percent
      type: Number,
      default: 1,
    },
  },
  { _id: false },
);

/* ---------------- Sandwich Rule ---------------- */
const SandwichRuleSchema = new Schema(
  {
    enabled: {
      type: Boolean,
      default: false,
    },

    beforeAfterWeekOff: {
      type: Boolean,
      default: false,
    },

    beforeAfterHoliday: {
      type: Boolean,
      default: false,
    },
  },
  { _id: false },
);

/* ---------------- Carry forward leave ---------------- */
const CarryForwardLeaveSchema = new Schema(
  {
    enabled: {
      type: Boolean,
      default: false,
    },

    maxLeaves: {
      type: Number,
      default: 1,
    },
  },
  { _id: false },
);

/* ---------------- Continuous Leave ---------------- */
const ContinuousLeaveSchema = new Schema(
  {
    enabled: {
      type: Boolean,
      default: false,
    },

    maxLeaves: {
      type: Number,
      default: 1,
    },

    allowedInProbation: {
      type: Boolean,
      default: false,
    },
  },
  { _id: false },
);

/* ---------------- Leave ---------------- */
const LeaveSchema = new Schema(
  {
    leaveId: {
      type: Schema.Types.ObjectId,
      ref: "Leave",
      required: true,
    },
    limit: {
      type: Number,
      default: 1,
    },

    hoursBeforeLeave: {
      type: Number,
      default: 24,
    },
  },
  { _id: false },
);

/* ---------------- Manual Punch ---------------- */
const ManualPunchSchema = new Schema(
  {
    enabled: {
      type: Boolean,
      default: false,
    },

    limit: {
      type: Number,
      default: 1,
    },
  },
  { _id: false },
);

/* ---------------- Main Policy ---------------- */
const PolicySchema = new Schema(
  {
    companyId: {
      type: Schema.Types.ObjectId,
      ref: "Company",
      required: true,
      index: true,
    },

    name: {
      type: String,
      required: true,
      trim: true,
    },

    status: {
      type: String,
      enum: Object.values(status),
      default: status.ACTIVE,
    },

    workHours: WorkHourSchema,
    lateRule: LateRuleSchema,
    overtime: OvertimeSchema,
    sandwichRule: SandwichRuleSchema,
    carryForwardLeave: CarryForwardLeaveSchema,
    continuousLeave: ContinuousLeaveSchema,
    leaves: [LeaveSchema],
    manualPunch: ManualPunchSchema,
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

PolicySchema.index({
  companyId: 1,
  name: 1,
});

export const PolicyModel = model("Policy", PolicySchema);
