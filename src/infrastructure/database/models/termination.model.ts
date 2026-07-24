import { Schema, model } from "mongoose";
import { terminationStatus } from "../../../types/types";

const TerminationSchema = new Schema(
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
    terminationType: {
      type: String,
      trim: true,
      required: true,
    },

    lastWorkingDate: {
      type: Date,
      required: true,
    },

    reason: {
      type: String,
      trim: true,
    },
    mailSent: {
      type: Boolean,
      default: false,
    },
    mailSentAt: {
      type: Date,
      default: null,
    },
    status: {
      type: String,
      enum: Object.values(terminationStatus),
      default: terminationStatus.HOLD,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

TerminationSchema.index({
  companyId: 1,
  status: 1,
});

export const TerminationModel = model("Termination", TerminationSchema);
