import { Schema, model } from "mongoose";
import { expenseStatus } from "../../../types/types";

const ReimbursementSchema = new Schema(
  {
    companyId: {
      type: Schema.Types.ObjectId,
      ref: "Company",
      required: true,
      index: true,
    },
    branchId: {
      type: Schema.Types.ObjectId,
      ref: "Branch",
      required: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    date: {
      type: Date,
      required: true,
    },
    description: {
      type: String,
      trim: true,
    },

    amount: {
      type: Number,
      default: 0,
    },

    status: {
      type: String,
      enum: Object.values(expenseStatus),
      default: expenseStatus.PENDING,
    },

    documents: {
      type: [String],
      default: [],
    },
    assignedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

ReimbursementSchema.index({
  companyId: 1,
  status: 1,
});

export const ReimbursementModel = model("Reimbursement", ReimbursementSchema);
