import { Schema, model } from "mongoose";

const AssignmentSchema = new Schema(
  {
    branchId: {
      type: Schema.Types.ObjectId,
      ref: "Branch",
      required: true,
    },

    shiftId: {
      type: Schema.Types.ObjectId,
      ref: "Shift",
      required: true,
    },

    departmentId: {
      type: Schema.Types.ObjectId,
      ref: "Department",
      required: true,
    },

    reportingManagerId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    isReporting: {
      type: Boolean,
      default: false,
    },

    joinedAt: {
      type: Date,
      default: Date.now,
    },

    assignedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    remarks: {
      type: String,
      default: "",
    },
  },
  {
    _id: false,
  },
);

const UserAssignmentSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    companyId: {
      type: Schema.Types.ObjectId,
      ref: "Company",
      required: true,
      index: true,
    },

    assignments: {
      type: [AssignmentSchema],
      default: [],
    },

  },
  {
    timestamps: true,
    versionKey: false,
  },
);

export const UserAssignmentModel = model(
  "UserAssignment",
  UserAssignmentSchema,
);
