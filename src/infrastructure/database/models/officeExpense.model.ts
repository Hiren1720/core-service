import { Schema, model } from "mongoose";
import { expenseStatus } from "../../../types/types";

const OfficeExpenseSchema = new Schema(
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
    expenseType: {
      type: String,
      required: true,
      trim: true,
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
    serviceType: {
      type: String,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },

    vendor: {
      name: {
        type: String,
        trim: true,
      },
      company: {
        type: String,
        trim: true,
      },
      phone: {
        type: String,
        trim: true,
      },
      isOnWarranty: {
        type: Boolean,
        default: false,
      },
      startDate: {
        type: Date,
        default: null,
      },
      endDate: {
        type: Date,
        default: null,
      },
      description: {
        type: String,
        trim: true,
      },
    },

    amount: {
      type: Number,
      default: 0,
    },
    paymentMode: {
      type: String,
      trim: true,
    },
    transactionId: {
      type: String,
      trim: true,
    },
    documents: {
      type: [String],
      default: [],
    },

    status: {
      type: String,
      enum: Object.values(expenseStatus),
      default: expenseStatus.PENDING,
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

OfficeExpenseSchema.index({
  companyId: 1,
  status: 1,
});

export const OfficeExpenseModel = model("OfficeExpense", OfficeExpenseSchema);
