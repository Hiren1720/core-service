import { Schema, model } from "mongoose";

const UserPayslipSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    salary: {
      type: Number,
      required: true,
    },
    effectiveFromMonth: {
      type: Number,
      required: true,
      default: () => new Date().getMonth() + 1, // 1-12
    },
    effectiveFromYear: {
      type: Number,
      required: true,
      default: () => new Date().getFullYear(),
    },
    payslipId: {
      type: Schema.Types.ObjectId,
      ref: "Payslip",
      required: true,
    },
    allowPFDeduction: {
      type: Boolean,
      default: false,
    },
    allowESICDeduction: {
      type: Boolean,
      default: false,
    },
    remarks: {
      type: String,
      default: "",
    },

    assignedBy: {
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

UserPayslipSchema.index({
  userId: 1,
  effectiveFromYear: -1,
  effectiveFromMonth: -1,
});

UserPayslipSchema.index({ createdAt: -1 });

export const UserPayslipModel = model("UserPayslip", UserPayslipSchema);
