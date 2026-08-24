import { Schema, model } from "mongoose";
import { status } from "../../../types/types";

const BranchSchema = new Schema(
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
        address: {
            type: String,
            trim: true,
            default: "",
        },
        branchType: {
            type: String,
            enum: ["HEAD_OFFICE", "BRANCH"],
            default: "BRANCH",
        },

        status: {
            type: String,
            enum: Object.values(status),
            default: status.ACTIVE,
        }
    },
    {
        timestamps: true,
        versionKey: false,
    }
);

export const BranchModel = model(
    "Branch",
    BranchSchema
);