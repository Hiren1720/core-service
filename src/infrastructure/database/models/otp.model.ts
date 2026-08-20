import { Schema, model } from "mongoose";

const OtpSchema = new Schema({
  userId: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true,
    index: true,
  },

  type: {
    type: String,
    default: "forgotPassword",
  },

  otp: {
    type: String,
    required: true,
  },

  token: {
    type: String,
    default: null,
  },

  createdAt: {
    type: Date,
    default: Date.now,
    expires: "5m", // auto expires in 5 min
  },
});

OtpSchema.index({ userId: 1, type: 1 });
OtpSchema.index({ token: 1, type: 1 });

export const OtpModel = model("Otp", OtpSchema);
