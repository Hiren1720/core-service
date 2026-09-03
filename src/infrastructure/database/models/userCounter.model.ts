import mongoose, { Schema } from "mongoose";

const UserCounterSchema = new Schema(
  {
    _id: {
      type: String,
      default: "USER",
    },
    sequence: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  },
);

export const UserCounterModel = mongoose.model(
  "UserCounter",
  UserCounterSchema,
);
