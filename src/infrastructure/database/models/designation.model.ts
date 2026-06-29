import { Schema, model } from "mongoose";
import { status } from "../../../types/types";

const DesignationSchema = new Schema(
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

    description: {
      type: String,
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

DesignationSchema.index({
  companyId: 1,
  status: 1,
});

export const DesignationModel = model("Designation", DesignationSchema);
