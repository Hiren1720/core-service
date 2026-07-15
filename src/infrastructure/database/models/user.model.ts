import { Schema, model } from "mongoose";
import { employmentTypeType, userStatus } from "../../../types/types";

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
      type: Number,
      default: null,
    },
    gender: {
      type: String,
      enum: ["male", "female", "other"],
      default: "other",
    },
    password: {
      type: String,
      select: false,
    },
    profileImage: {
      type: String,
      default: "",
    },
    address: {
      type: String,
      default: "",
    },
    status: {
      type: String,
      enum: Object.values(userStatus),
      default: userStatus.ACTIVE,
    },
    lastLoginAt: {
      type: Date,
      default: null,
    },
    passwordChangedAt: {
      type: Date,
      default: null,
    },
    resetPasswordToken: {
      type: String,
      default: null,
    },
    resetPasswordExpires: {
      type: Date,
      default: null,
    },
    role: {
      type: String,
      enum: ["OWNER", "MANAGER", "EMPLOYEE"],
      default: "EMPLOYEE",
    },

    companyId: {
      type: Schema.Types.ObjectId,
      ref: "Company",
      required: true,
    },
    branchId: {
      type: Schema.Types.ObjectId,
      ref: "Branch",
      default: null,
    },
    shiftId: {
      type: Schema.Types.ObjectId,
      ref: "Shift",
      default: null,
    },
    departmentId: {
      type: Schema.Types.ObjectId,
      ref: "Department",
      default: null,
    },
    designationId: {
      type: Schema.Types.ObjectId,
      ref: "Designation",
      default: null,
    },
    employmentType: {
      type: String,
      enum: Object.values(employmentTypeType),
    },
    probationPeriod: {
      type: Number,
      default: null,
    },
    //extra fields for profile details
    dob: {
      type: Date,
      default: null,
    },
    isMarried: {
      type: Boolean,
      default: false,
    },
    alternatePhone: {
      type: Number,
      default: null,
    },
    bloodGroup: {
      type: String,
      default: "",
    },
    isPhysicallyDisabled: {
      type: Boolean,
      default: false,
    },
    permanentAddress: {
      type: String,
      default: "",
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

export const UserModel = model("User", UserSchema);
