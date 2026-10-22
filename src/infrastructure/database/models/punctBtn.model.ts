import { Schema, model } from "mongoose";

const PunctBtnSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    btnClickTime: {
      type: Date,
      required: true,
      default: Date.now,
    },
    punchType: {
      type: String,
      enum: ["IN", "OUT"],
      required: true,
    },
    btnClickComplete: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
    versionKey: false,
    collection: "punctBtn",
  },
);

export const PunctBtnModel = model("PunctBtn", PunctBtnSchema);
