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
