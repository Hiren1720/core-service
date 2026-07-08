import { Schema, model } from "mongoose";
import { payslipValueType, status } from "../../../types/types";

const PayslipSchema = new Schema(
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
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

PayslipSchema.index({
  companyId: 1,
  status: 1,
});

export const PayslipModel = model("Payslip", PayslipSchema);
