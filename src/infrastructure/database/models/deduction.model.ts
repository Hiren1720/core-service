import { Schema, model } from "mongoose";
import { payslipValueType } from "../../../types/types";

const DeductionSchema = new Schema(
  {
    companyId: {
      type: Schema.Types.ObjectId,
      ref: "Company",
      required: true,
      index: true,
      unique: true
    },
    details: [
      {
        name: {
          type: String,
          trim: true,
          default: "",
        },
        value: {
          type: Number,
          default: null,
        },
        valueType: {
          type: String,
          enum: Object.values(payslipValueType),
          default: payslipValueType.PERCENTAGE,
        },
      },
    ],
    incomeDetails: [
      {
        from: {
          type: Number,
          default: null,
        },
        to: {
          type: Number,
          default: null,
        },
        taxRate: {
          type: Number,
          default: null,
        },
      },
    ],
  },
  {
    timestamps: true,
    versionKey: false,
  },
);


export const DeductionModel = model("Deduction", DeductionSchema);
