import { Schema, model } from "mongoose";
import { status } from "../../../types/types";

const AdminSchema = new Schema(
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

        company: {
            companyName: {
                type: String,
                trim: true,
                default: ""
            },
            gstin: {
                type: String,
                trim: true,
                default: ""
            },
            companyEmail: {
                type: String,
                trim: true,
                default: ""
            },
            companyLogo: {
                type: String,
                default: ""
            },
            default: {},
        }
    },
    {
        timestamps: true,
        versionKey: false,
    }
);

export const AdminModel = model(
    "Admin",
    AdminSchema
);