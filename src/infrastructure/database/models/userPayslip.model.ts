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

    payslipId: {
      type: Schema.Types.ObjectId,
      ref: "Policy",
      required: true,
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

UserPayslipSchema.index({ createdAt: -1 });

export const UserPayslipModel = model("UserPayslip", UserPayslipSchema);
