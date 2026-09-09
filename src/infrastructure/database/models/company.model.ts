import { Schema, model } from "mongoose";
import { status } from "../../../types/types";

const CompanySchema = new Schema(
  {
    status: {
      type: String,
      enum: Object.values(status),
      default: status.ACTIVE,
    },

    companyName: {
      type: String,
      trim: true,
      default: "",
    },
    gstin: {
      type: String,
      trim: true,
      default: "",
    },
    companyEmail: {
      type: String,
      trim: true,
      lowercase: true,
    },
    invoiceEmail: {
      type: String,
      default: null,
    },
    companyPhone: {
      type: Number,
      default: null,
    },
    companyAddress: {
      type: String,
      trim: true,
      default: "",
    },
    companyLogo: {
      type: String,
      default: "",
    },
    modules: {
      type: [String],
      enum: ["EMPLOYEE", "PRODUCTION"],
      default: [],
    },
    employeePrice: {
      type: Number,
      default: 0,
    },
    productionPrice: {
      type: Number,
      default: 0,
    },
    assignedBankAccount: {
      type: Schema.Types.ObjectId,
      ref: "BankAccount",
    },
    generateInvoiceWithGST: {
      type: Boolean,
      default: false,
    },
    companyRepresentative: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

export const CompanyModel = model("Company", CompanySchema);
