import { Schema, model } from "mongoose";
import { status } from "../../../types/types";

const LeaveSchema = new Schema(
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

    isPaid: {
      type: Boolean,
      default: false,
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

LeaveSchema.index({
  companyId: 1,
  status: 1,
});

export const LeaveModel = model("Leave", LeaveSchema);
