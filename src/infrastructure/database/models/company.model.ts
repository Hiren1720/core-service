import { Schema, model } from "mongoose";

export enum CompanyStatus {
    ACTIVE = "ACTIVE",
    INACTIVE = "INACTIVE",
}

const CompanySchema = new Schema(
    {
        status: {
            type: String,
            enum: Object.values(CompanyStatus),
            default: CompanyStatus.ACTIVE,
        },

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
            required: true,
            trim: true,
            lowercase: true
        },
        companyPhone: {
            type: Number,
            default: null
        },
        companyAddress: {
            type: String,
            trim: true,
            default: ""
        },
        companyLogo: {
            type: String,
            default: ""
        },
        modules: {
            type: [String],
            enum: ["EMPLOYEE", "PRODUCTION"],
            default: []
        },
        employeePrice: {
            type: Number,
            default: 0
        },
        productionPrice: {
            type: Number,
            default: 0
        },
        companyRepresentative: {
            type: Schema.Types.ObjectId,
            ref: "User"
        }
    },
    {
        timestamps: true,
        versionKey: false,
    }
);

export const CompanyModel = model(
    "Company",
    CompanySchema
);