import { Schema, model } from "mongoose";
import { status } from "../../../types/types";

const BankAccountSchema = new Schema(
    {
        accountNo: {
            type: Number,
            required: true,
            trim: true,
        },

        ifscCode: {
            type: String,
            trim: true,
            default: "",
        },

        accountHolderName: {
            type: String,
            default: "",
            trim: true,
        },

        accountType: {
            type: String,
            default: "",
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

export const BankAccountModel = model(
    "BankAccount",
    BankAccountSchema
);