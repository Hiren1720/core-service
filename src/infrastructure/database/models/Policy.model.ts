import { Schema, model } from "mongoose";
import { status } from "../../../types/types";

/* ---------------- Attendance ---------------- */

const AttendanceSchema = new Schema(
  {
    enableAttendance: {
      type: Boolean,
      default: true,
    },

    biometricRequired: {
      type: Boolean,
      default: false,
    },

    selfieRequired: {
      type: Boolean,
      default: false,
    },

    locationRequired: {
      type: Boolean,
      default: false,
    },

    allowRegularization: {
      type: Boolean,
      default: true,
    },

    regularizationDays: {
      type: Number,
      default: 3,
    },
  },
  { _id: false },
);

/* ---------------- Work Hours ---------------- */
const WorkHourSchema = new Schema(
  {
    workingHours: {
      type: Number,
      default: 8,
    },

    startTime: {
      type: String,
      required: true,
    },

    endTime: {
      type: String,
      required: true,
    },

    weeklyOffs: [
      {
        type: String,
        enum: [
          "MONDAY",
          "TUESDAY",
          "WEDNESDAY",
          "THURSDAY",
          "FRIDAY",
          "SATURDAY",
          "SUNDAY",
        ],
      },
    ],

    minimumHoursForHalfDay: {
      type: Number,
      default: 4,
    },

    minimumHoursForFullDay: {
      type: Number,
      default: 8,
    },
  },
  { _id: false },
);

/* ---------------- Late Rules ---------------- */
const LateRuleSchema = new Schema(
  {
    graceLoginMinutes: {
      type: Number,
      default: 15,
    },

    graceLogoutMinutes: {
      type: Number,
      default: 15,
    },

    maxGracePerMonth: {
      type: Number,
      default: 3,
    },

    deductionValue: {
      // more than maxGracePerMonth passed than cut
      type: Number,
      default: 0.5, // Half day salary
    },

    halfDayAfterMinutes: {
      //login
      type: Number,
      default: 120,
    },

    halfDayBeforeMinutes: {
      //logout
      type: Number,
      default: 120,
    },

    absentAfterMinutes: {
      type: Number,
      default: 180,
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

/* ---------------- Leave ---------------- */
const LeaveSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
    },

    shortName: {
      type: String,
      required: true,
    },

    yearlyLimit: {
      type: Number,
      default: 0,
    },

    carryForward: {
      type: Boolean,
      default: false,
    },

    maxCarryForward: {
      type: Number,
      default: 0,
    },

    encashable: {
      type: Boolean,
      default: false,
    },

    allowHalfDay: {
      type: Boolean,
      default: true,
    },

    minimumNoticeDays: {
      type: Number,
      default: 0,
    },

    approvalRequired: {
      type: Boolean,
      default: true,
    },

    paid: {
      type: Boolean,
      default: true,
    },
  },
  { _id: false },
);

/* ---------------- Holiday ---------------- */
const HolidaySchema = new Schema(
  {
    weekendIncludedInLeave: {
      type: Boolean,
      default: false,
    },

    holidayIncludedInLeave: {
      type: Boolean,
      default: false,
    },
  },
  { _id: false },
);

/* ---------------- Approval ---------------- */
const ApprovalSchema = new Schema(
  {
    reportingManagerRequired: {
      type: Boolean,
      default: true,
    },

    hrApprovalRequired: {
      type: Boolean,
      default: false,
    },

    directorApprovalRequired: {
      type: Boolean,
      default: false,
    },
  },
  { _id: false },
);

/* ---------------- Payroll ---------------- */
const PayrollSchema = new Schema(
  {
    salaryCycleDay: {
      type: Number,
      default: 1,
    },

    overtimePaid: {
      type: Boolean,
      default: false,
    },

    deductLateComing: {
      type: Boolean,
      default: false,
    },

    deductEarlyLeaving: {
      type: Boolean,
      default: false,
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

    // attendance: AttendanceSchema,

    workHours: WorkHourSchema,

    lateRule: LateRuleSchema,

    overtime: OvertimeSchema,

    leaves: {
      type: [LeaveSchema],
      default: [],
    },

    holidays: HolidaySchema,

    approval: ApprovalSchema,

    payroll: PayrollSchema,

    status: {
      type: String,
      enum: Object.values(status),
      default: status.ACTIVE,
    },

    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
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

PolicySchema.index(
  {
    companyId: 1,
    name: 1,
  },
  {
    unique: true,
  },
);

export const PolicyModel = model("Policy", PolicySchema);
