import { Schema, model } from "mongoose";
import { promotionStatus } from "../../../types/types";

const PromotionSchema = new Schema(
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
    designationId: {
      type: Schema.Types.ObjectId,
      ref: "Designation",
      required: true,
    },

    effectiveDate: {
      type: Date,
      required: true,
    },

    reason: {
      type: String,
      trim: true,
    },

    status: {
      type: String,
      enum: Object.values(promotionStatus),
      default: promotionStatus.HOLD,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

PromotionSchema.index({
  companyId: 1,
  status: 1,
});

export const PromotionModel = model("Promotion", PromotionSchema);
