import { Schema, model } from "mongoose";
import { status } from "../../../types/types";

const UserSchema = new Schema(
    {
        firstName: {
            type: String,
            required: true,
            trim: true,
        },
        lastName: {
            type: String,
            trim: true,
            default: "",
        },
        email: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true,
        },
        phone: {
            type: String,
            default: "",
        },
        gender: {
            type: String,
            enum: ["male", "female", "other"],
            default: "other"
        },
        password: {
            type: String,
            required: true,
            select: false,
        },
        profileImage: {
            type: String,
            default: "",
        },
        status: {
            type: String,
            enum: Object.values(status),
            default: status.ACTIVE,
        },
        lastLoginAt: {
            type: Date,
            default: null,
        },
        passwordChangedAt: {
            type: Date,
            default: null,
        },

        companyId: {
            type: Schema.Types.ObjectId,
            ref: "Company",
        }
    },
    {
        timestamps: true,
        versionKey: false,
    }
);

export const UserModel = model(
    "User",
    UserSchema
);