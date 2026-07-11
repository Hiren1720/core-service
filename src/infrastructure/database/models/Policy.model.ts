import { Schema, model } from "mongoose";

const PolicySchema = new Schema(
  {
    name: {
      type: String,
      required: true,
    }
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

export const PolicyModel = model("Policy", PolicySchema);
