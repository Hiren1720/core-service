import { Schema, model } from "mongoose";
import { attendanceType } from "../../../types/types";

const AttendanceSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    attendanceDate: {
      type: Date,
      required: true,
      index: true,
    },

    inTime: {
      type: Date,
      required: true,
    },

    outTime: {
      type: Date,
      default: null,
    },

    inLocation: {
      latitude: Number,
      longitude: Number,
      address: String,
    },

    outLocation: {
      latitude: Number,
      longitude: Number,
      address: String,
    },

    inMethod: {
      type: String,
      enum: ["MOBILE", "WEB", "BIOMETRIC", "QR"],
      default: "MOBILE",
    },

    outMethod: {
      type: String,
      enum: ["MOBILE", "WEB", "BIOMETRIC", "QR"],
      default: null,
    },

    totalWorkedMinutes: {
      type: Number,
      default: 0,
    },

    overtimeMinutes: {
      type: Number,
      default: 0,
    },

    lateMinutes: {
      type: Number,
      default: 0,
    },

    earlyExitMinutes: {
      type: Number,
      default: 0,
    },

    attendanceStatus: {
      type: String,
      enum: Object.values(attendanceType),
      default: attendanceType.PRESENT,
    },

    autoClosed: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

AttendanceSchema.index({
  userId: 1,
  attendanceDate: 1,
});

export const AttendanceModel = model("Attendance", AttendanceSchema);
