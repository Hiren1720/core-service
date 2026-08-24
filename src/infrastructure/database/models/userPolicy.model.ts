import { Schema, model } from "mongoose";

const UserPolicySchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    policyId: {
      type: Schema.Types.ObjectId,
      ref: "Policy",
      required: true,
    },
    effectiveFromMonth: {
      type: Number,
      required: true,
      default: () => new Date().getMonth() + 1, // 1-12
    },
    effectiveFromYear: {
      type: Number,
      required: true,
      default: () => new Date().getFullYear(),
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

UserPolicySchema.index({ createdAt: -1 });

export const UserPolicyModel = model("UserPolicy", UserPolicySchema);
