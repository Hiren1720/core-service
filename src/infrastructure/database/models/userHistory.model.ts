import { Schema, model } from "mongoose";

const UserHistorySchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    field: {
      type: String, // role, employmentType, probationPeriod
      required: true,
    },

    fieldValue: {
      type: Schema.Types.Mixed,
      default: "",
    },
    fieldId: {
      type: String,
      required: false,
    },

    remarks: {
      type: String,
      default: "",
    },

    assignedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

UserHistorySchema.index({ createdAt: -1 });
UserHistorySchema.index({ field: 1, fieldId: 1 });

export const UserHistoryModel = model("UserHistory", UserHistorySchema);
