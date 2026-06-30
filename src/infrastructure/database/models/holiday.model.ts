import { Schema, model } from "mongoose";
import { status } from "../../../types/types";

const HolidaySchema = new Schema(
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
        description: {
            type: String,
            required: true,
            trim: true,
        },
        startDate: {
            type: Date,
            required: true,
        },
        endDate: {
            type: Date,
            required: true,
        },
        effectiveYear: {
            type: Number,
            default: null
        },
        status: {
            type: String,
            enum: Object.values(status),
            default: status.ACTIVE,
        },
    },
    {
        timestamps: true,
        versionKey: false,
    }
);

HolidaySchema.index({
    companyId: 1,
    status: 1,
});

export const HolidayModel = model(
    "Holiday",
    HolidaySchema
);