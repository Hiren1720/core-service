import { Schema, model } from "mongoose";
import { expenseStatus } from "../../../types/types";

const PayrollSchema = new Schema(
  {
    companyId: {
      type: Schema.Types.ObjectId,
      ref: "Company",
      required: true,
      index: true,
    },

    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    payrollMonth: {
      type: Number,
      required: true,
      min: 1,
      max: 12,
    },

    payrollYear: {
      type: Number,
      required: true,
    },
    periodStart: {
      type: Date,
      required: true,
    },

    periodEnd: {
      type: Date,
      required: true,
    },

    status: {
      type: String,
      enum: ["DRAFT", "PROCESSED", "APPROVED", "PAID", "CANCELLED"],
      default: "DRAFT",
    },

    // ------------------------------------------------
    // ATTENDANCE SUMMARY
    // ------------------------------------------------

    attendance: {
      totalWorkingDays: {
        type: Number,
        default: 0,
      },

      presentDays: {
        type: Number,
        default: 0,
      },

      absentDays: {
        type: Number,
        default: 0,
      },

      halfDays: {
        type: Number,
        default: 0,
      },

      weeklyOffDays: {
        type: Number,
        default: 0,
      },
      holidays: {
        type:Number,
        default: 0
      },

      paidLeaveDays: {
        type: Number,
        default: 0,
      },

      unpaidLeaveDays: {
        type: Number,
        default: 0,
      },

      lateMinutes: {
        type: Number,
        default: 0,
      },

      earlyExitMinutes: {
        type: Number,
        default: 0,
      },

      overtimeMinutes: {
        type: Number,
        default: 0,
      },

      overtimeMinutesAmount: {
        type: Number,
        default: 0,
      },
      lateCount: {
        type: Number,
        default: 0,
      },
      lateSalaryCutDays: {
        type: Number,
        default: 0,
      },
    },

    // ------------------------------------------------
    // EARNINGS
    // ------------------------------------------------

    earnings: [
      {
        type: {
          type: String,
        },
        name: String,
        amount: {
          type: Number,
          required: true,
        },
        calculation: {
          type: String,
        },
        source: {
          type: String,
          enum: [
            "SALARY",
            "POLICY",
            "ATTENDANCE",
            "LEAVE",
            "REIMBURSEMENT",
            "OTHER",
          ],
        },
        sourceId: {
          type: Schema.Types.ObjectId,
        },
        metadata: Schema.Types.Mixed,
      },
    ],

    // ------------------------------------------------
    // DEDUCTIONS
    // ------------------------------------------------

    deductions: [
      {
        type: {
          type: String,
          enum: [
            "ABSENT",
            "HALF_DAY",
            "LATE",
            "EARLY_EXIT",
            "UNPAID_LEAVE",
            "TAX",
            "PF",
            "ESI",
            "LOP",
            "OTHER",
          ],
        },
        name: String,
        amount: {
          type: Number,
          required: true,
        },
        calculation: {
          type: String,
        },
        source: {
          type: String,
          enum: ["POLICY", "ATTENDANCE", "LEAVE", "TAX", "OTHER"],
        },
        sourceId: Schema.Types.ObjectId,
        metadata: Schema.Types.Mixed,
      },
    ],

    // ------------------------------------------------
    // REIMBURSEMENTS
    // ------------------------------------------------
    reimbursements: [{ type: Schema.Types.ObjectId, ref: "Reimbursement" }],

    // ------------------------------------------------
    // FINAL TOTALS
    // ------------------------------------------------

    totals: {
      totalEarnings: {
        type: Number,
        default: 0,
      },

      totalReimbursements: {
        type: Number,
        default: 0,
      },

      totalDeductions: {
        type: Number,
        default: 0,
      },

      netPay: {
        type: Number,
        default: 0,
      },
    },

    // ------------------------------------------------
    // POLICY SNAPSHOT
    // ------------------------------------------------

    generatedAt: Date,
    approvedAt: Date,
    paidAt: Date,
    approvedBy: Schema.Types.ObjectId,
  },
  {
    timestamps: true,
  },
);

PayrollSchema.index(
  {
    companyId: 1,
    userId: 1,
    payrollMonth: 1,
    payrollYear: 1,
  },
  {
    unique: true,
  },
);

export const PayrollModel = model("Payroll", PayrollSchema);
