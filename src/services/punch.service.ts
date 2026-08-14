import mongoose from "mongoose";
import {
  AttendanceModel,
  UserModel,
  UserPolicyModel,
} from "../infrastructure/database/models";
import { attendanceType } from "../types/types";
import { normalizeDate } from "../shared/helpers/dateHelper";

export const PunchInFn = async (
  userId: string,
  location: {
    latitude: number;
    longitude: number;
    address: string;
  } | null,
  method: "MOBILE" | "WEB" | "BIOMETRIC" = "MOBILE",
  session: mongoose.ClientSession,
) => {
  const now = new Date();
  const attendanceDate = normalizeDate(now);

  const [attendance, userShift, userPolicy] = await Promise.all([
    AttendanceModel.findOne({
      userId,
      attendanceDate,
    }).session(session),

    UserModel.findById(userId)
      .select("shiftId")
      .populate("shiftId", "startTime endTime"),

    UserPolicyModel.findOne({ userId })
      .sort({ createdAt: -1 })
      .select("policyId")
      .populate("policyId"),
  ]);

  const shift: any = userShift?.shiftId;
  const policy: any = userPolicy?.policyId;

  if (!attendance) {
    throw new Error("Attendance not generated for today");
  }

  if (!shift) {
    throw new Error("Shift not assigned");
  }

  if (!policy) {
    throw new Error("Policy not assigned");
  }

  // Already punched in
  if (attendance.inTime) {
    throw new Error("Already punched in today");
  }

  // ------------------------------------------------
  // Calculate shift start time
  // ------------------------------------------------

  const shiftStart = new Date(attendanceDate);

  const [startHour, startMinute] = shift.startTime.split(":").map(Number);

  shiftStart.setHours(startHour, startMinute, 0, 0);

  // ------------------------------------------------
  // Calculate late minutes
  // ------------------------------------------------

  const lateMinutes = Math.max(
    0,
    Math.floor((now.getTime() - shiftStart.getTime()) / 60000),
  );

  // ------------------------------------------------
  // Late mark
  //
  // Example:
  // Shift starts: 09:00
  // Allowed late: 15 minutes
  //
  // Punch at 09:10 -> isLate false
  // Punch at 09:20 -> isLate true
  // ------------------------------------------------

  const isLate = lateMinutes > policy.lateRule.allowedLateMinutes;

  attendance.inTime = now;
  attendance.inLocation = location;
  attendance.inMethod = method;
  attendance.lateMinutes = lateMinutes;
  attendance.isLate = isLate;

  // Punch-in does not determine half-day.
  // Half-day is calculated at punch-out based on
  // total worked minutes.
  attendance.isHalfDay = false;
  attendance.attendanceStatus = attendanceType.PRESENT;

  await attendance.save({ session });

  return attendance;
};
