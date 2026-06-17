import { Schema, model } from "mongoose";
import { status } from "../../../types/types";

const DepartmentSchema = new Schema(
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

        assignments: [
            {
                branchId: {
                    type: Schema.Types.ObjectId,
                    ref: "Branch",
                    required: true,
                },

                shiftIds: [
                    {
                        type: Schema.Types.ObjectId,
                        ref: "Shift",
                    },
                ],
            },
        ],

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

DepartmentSchema.index({
    companyId: 1,
    name: 1,
});

DepartmentSchema.index(
    {
        companyId: 1,
        name: 1,
    },
    {
        unique: true,
    }
);

export const DepartmentModel = model(
    "Department",
    DepartmentSchema
);