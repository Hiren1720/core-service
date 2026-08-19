import { Schema, model } from "mongoose";
import { status } from "../../../types/types";

const ShiftSchema = new Schema(
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

    startTime: {
      type: String,
      required: true,
    },

    endTime: {
      type: String,
      required: true,
    },

    breakStartTime: {
      type: String,
      default: "",
    },

    breakEndTime: {
      type: String,
      default: "",
    },
    minutes: {
      type: Number,
      default: 0,
    },

    branchIds: [
      {
        type: Schema.Types.ObjectId,
        ref: "Branch",
      },
    ],

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

ShiftSchema.index({
  companyId: 1,
  status: 1,
});

export const ShiftModel = model("Shift", ShiftSchema);
