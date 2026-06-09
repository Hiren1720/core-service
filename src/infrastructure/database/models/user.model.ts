import { Schema, model } from "mongoose";

export enum UserStatus {
    ACTIVE = "ACTIVE",
    INACTIVE = "INACTIVE",
}

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
            enum: Object.values(UserStatus),
            default: UserStatus.ACTIVE,
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