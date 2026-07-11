import { Schema, model } from "mongoose";
import { status } from "../../../types/types";

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
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

PolicySchema.index({
  companyId: 1,
  status: 1,
});

export const PolicyModel = model("Policy", PolicySchema);
