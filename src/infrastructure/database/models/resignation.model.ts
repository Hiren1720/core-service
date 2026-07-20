import { Schema, model } from "mongoose";
import { resignationStatus } from "../../../types/types";

const ResignationSchema = new Schema(
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

    lastWorkingDate: {
      type: Date,
      required: true,
    },

    reason: {
      type: String,
      trim: true,
    },

    status: {
      type: String,
      enum: Object.values(resignationStatus),
      default: resignationStatus.PENDING,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

ResignationSchema.index({
  companyId: 1,
  status: 1,
});

export const ResignationModel = model("Resignation", ResignationSchema);
