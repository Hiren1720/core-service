import mongoose from "mongoose";
import {
  AttendanceModel,
  LeaveRequestModel,
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

    UserPolicyModel.findOne({
      userId,
      $or: [
        // Previous years
        {
          effectiveFromYear: { $lt: new Date().getFullYear() },
        },
        // Same year, requested month or earlier
        {
          effectiveFromYear: new Date().getFullYear(), // currunt year
          effectiveFromMonth: { $lte: new Date().getMonth() + 1 }, // currunt month
        },
      ],
    })
      .sort({
        effectiveFromYear: -1,
        effectiveFromMonth: -1,
      })
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

  // ========================================================
  // Calculate complete shift start/end
  // ========================================================

  const shiftStart = new Date(attendanceDate);

  const [startHour, startMinute] = shift.startTime.split(":").map(Number);

  shiftStart.setHours(startHour, startMinute, 0, 0);

  const shiftEnd = new Date(attendanceDate);

  const [endHour, endMinute] = shift.endTime.split(":").map(Number);

  shiftEnd.setHours(endHour, endMinute, 0, 0);

  // ========================================================
  // Determine applicable punch-in time
  //
  // Normal day:
  //     Shift start
  //
  // SECOND_HALF leave:
  //     Employee works first half
  //     → Shift start
  //
  // FIRST_HALF leave:
  //     Employee works second half
  //     → Second-half start
  // ========================================================

  let applicableStart = new Date(shiftStart);

  if (attendance.isHalfDay && attendance.leaveRequestId) {
    const leaveRequest = await LeaveRequestModel.findById(
      attendance.leaveRequestId,
    )
      .select("duration")
      .session(session)
      .lean();

    if (!leaveRequest) {
      throw new Error("Half-day leave request not found");
    }

    const shiftDurationMinutes = Math.max(
      0,
      Math.floor((shiftEnd.getTime() - shiftStart.getTime()) / 60000),
    );

    const halfShiftMinutes = Math.floor(shiftDurationMinutes / 2);

    // ------------------------------------------------------
    // FIRST_HALF leave
    //
    // Employee works SECOND HALF.
    //
    // Example:
    // Shift: 09:00 - 18:00
    //
    // FIRST_HALF leave
    // Employee starts at 13:30
    // ------------------------------------------------------

    if (leaveRequest.duration === "FIRST_HALF") {
      applicableStart = new Date(shiftStart);

      applicableStart.setMinutes(
        applicableStart.getMinutes() + halfShiftMinutes,
      );
    }

    // ------------------------------------------------------
    // SECOND_HALF leave
    //
    // Employee works FIRST HALF.
    //
    // Example:
    // Shift: 09:00 - 18:00
    //
    // SECOND_HALF leave
    // Employee starts at 09:00
    // ------------------------------------------------------

    if (leaveRequest.duration === "SECOND_HALF") {
      applicableStart = new Date(shiftStart);
    }
  }

  // ========================================================
  // Calculate late minutes
  // ========================================================

  const lateMinutes = Math.max(
    0,
    Math.floor((now.getTime() - applicableStart.getTime()) / 60000),
  );

  // ========================================================
  // Late mark
  // ========================================================

  const isLate = lateMinutes > policy.lateRule.allowedLateMinutes;

  // ========================================================
  // Save punch-in
  // ========================================================

  attendance.inTime = now;
  attendance.inLocation = location;
  attendance.inMethod = method;

  attendance.lateMinutes = lateMinutes;

  // Keep existing value if this is half-day leave.
  //
  // If:
  //     isHalfDay = true
  //     leaveRequestId exists
  //
  // it means half-day leave, so don't reset it.
  attendance.isLate = attendance.isLate || isLate;

  // Punch-in does NOT determine attendance half-day.
  //
  // For normal attendance, status starts as PRESENT
  // and punch-out will calculate final status.

  attendance.attendanceStatus = attendanceType.PRESENT;
  await attendance.save({ session });

  return attendance;
};

export const PunchOutFn = async (
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

  // Get attendance, shift and policy
  const [attendance, userShift, userPolicy] = await Promise.all([
    AttendanceModel.findOne({
      userId,
      attendanceDate,
    }).session(session),

    UserModel.findById(userId)
      .select("shiftId")
      .populate("shiftId", "startTime endTime breakStartTime breakEndTime"),

    UserPolicyModel.findOne({
      userId,
      $or: [
        // Previous years
        {
          effectiveFromYear: { $lt: new Date().getFullYear() },
        },
        // Same year, requested month or earlier
        {
          effectiveFromYear: new Date().getFullYear(), // currunt year
          effectiveFromMonth: { $lte: new Date().getMonth() + 1 }, // currunt month
        },
      ],
    })
      .sort({
        effectiveFromYear: -1,
        effectiveFromMonth: -1,
      })
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

  if (!attendance.inTime) {
    throw new Error("Punch-in time is missing");
  }

  if (attendance.outTime) {
    throw new Error("Already punched out");
  }

  // ========================================================
  // Shift start / end
  // ========================================================

  const shiftStart = new Date(attendanceDate);
  const [startHour, startMinute] = shift.startTime.split(":").map(Number);

  shiftStart.setHours(startHour, startMinute, 0, 0);

  const shiftEnd = new Date(attendanceDate);
  const [endHour, endMinute] = shift.endTime.split(":").map(Number);

  shiftEnd.setHours(endHour, endMinute, 0, 0);

  // ========================================================
  // Shift duration
  // ========================================================

  const shiftDurationMinutes = Math.max(
    0,
    Math.floor((shiftEnd.getTime() - shiftStart.getTime()) / 60000),
  );

  // ========================================================
  // Determine applicable working window
  //
  // Normal:
  //   shiftStart -> shiftEnd
  //
  // FIRST_HALF leave:
  //   employee works second half
  //
  // SECOND_HALF leave:
  //   employee works first half
  // ========================================================

  let applicableStart = new Date(shiftStart);
  let applicableEnd = new Date(shiftEnd);

  let halfDayLeave = false;

  if (attendance.isHalfDay && attendance.leaveRequestId) {
    const leaveRequest = await LeaveRequestModel.findById(
      attendance.leaveRequestId,
    )
      .select("duration")
      .session(session)
      .lean();

    if (!leaveRequest) {
      throw new Error("Half-day leave request not found");
    }

    if (
      leaveRequest.duration === "FIRST_HALF" ||
      leaveRequest.duration === "SECOND_HALF"
    ) {
      halfDayLeave = true;

      const halfShiftMinutes = Math.floor(shiftDurationMinutes / 2);

      if (leaveRequest.duration === "FIRST_HALF") {
        // Employee works second half
        applicableStart = new Date(shiftStart);

        applicableStart.setMinutes(
          applicableStart.getMinutes() + halfShiftMinutes,
        );

        applicableEnd = new Date(shiftEnd);
      }

      if (leaveRequest.duration === "SECOND_HALF") {
        // Employee works first half
        applicableStart = new Date(shiftStart);

        applicableEnd = new Date(shiftStart);

        applicableEnd.setMinutes(applicableEnd.getMinutes() + halfShiftMinutes);
      }
    }
  }

  // ========================================================
  // Save punch-out information
  // ========================================================

  attendance.outTime = now;
  attendance.outMethod = method;
  attendance.outLocation = location;

  // ========================================================
  // Total worked minutes
  // ========================================================

  const workedMinutes = Math.max(
    0,
    Math.floor(
      (attendance.outTime.getTime() - attendance.inTime.getTime()) / 60000,
    ),
  );

  attendance.totalWorkedMinutes = workedMinutes;

  // ========================================================
  // Late login
  //
  // Compare against applicable working start.
  // ========================================================

  const lateMinutes = Math.max(
    0,
    Math.floor(
      (attendance.inTime.getTime() - applicableStart.getTime()) / 60000,
    ),
  );

  attendance.lateMinutes = lateMinutes;

  if (lateMinutes > policy.lateRule.allowedLateMinutes) {
    attendance.isLate = true;
  }

  // ========================================================
  // Early logout
  //
  // Compare against applicable working end.
  // ========================================================

  const earlyExitMinutes = Math.max(
    0,
    Math.floor(
      (applicableEnd.getTime() - attendance.outTime.getTime()) / 60000,
    ),
  );

  attendance.earlyExitMinutes = earlyExitMinutes;

  if (earlyExitMinutes > policy.lateRule.allowedEarlyMinutes) {
    attendance.isLate = true;
  }

  // ========================================================
  // Overtime
  //
  // Only normal/full-day attendance can generate overtime.
  // Half-day leave should not generate overtime.
  // ========================================================

  if (!halfDayLeave) {
    const overtimeEnabled = policy?.overtime?.enable === true;

    const overtimeMinimumMinutes = policy?.overtime?.minimumMinutes ?? 0;

    if (overtimeEnabled && workedMinutes > shiftDurationMinutes) {
      const extraMinutes = workedMinutes - shiftDurationMinutes;

      if (extraMinutes >= overtimeMinimumMinutes) {
        attendance.overtimeMinutes = extraMinutes;
      } else {
        attendance.overtimeMinutes = 0;
      }
    } else {
      attendance.overtimeMinutes = 0;
    }
  } else {
    attendance.overtimeMinutes = 0;
  }

  // ========================================================
  // Attendance status
  // ========================================================

  // --------------------------------------------------------
  // HALF-DAY LEAVE
  //
  // isHalfDay = true
  // leaveRequestId exists
  //
  // Here we only decide whether the worked half is
  // PRESENT or ABSENT.
  //
  // We DO NOT run normal half-day attendance rules.
  // --------------------------------------------------------
  const fullDayMinimumMinutes = Math.ceil(
    (shiftDurationMinutes * policy.lateRule.minFullDayPercentage) / 100,
  );

  if (halfDayLeave) {
    const requiredHalfDayMinutes = Math.ceil(fullDayMinimumMinutes / 2);

    if (workedMinutes >= requiredHalfDayMinutes) {
      attendance.attendanceStatus = attendanceType.PRESENT;
    } else {
      attendance.attendanceStatus = attendanceType.ABSENT;
    }

    // Keep true because this represents half-day leave
    attendance.isHalfDay = true;
  }

  // --------------------------------------------------------
  // NORMAL FULL-DAY ATTENDANCE
  // --------------------------------------------------------
  else {
    const halfDayMinimumMinutes = Math.ceil(
      (shiftDurationMinutes * policy.lateRule.minHalfDayPercentage) / 100,
    );

    // Less than minimum half-day requirement
    if (workedMinutes < halfDayMinimumMinutes) {
      attendance.attendanceStatus = attendanceType.ABSENT;

      attendance.isHalfDay = false;
    }

    // Worked half day but not full day
    else if (workedMinutes < fullDayMinimumMinutes) {
      attendance.attendanceStatus = attendanceType.PRESENT;

      attendance.isHalfDay = true;
    }

    // Full day
    else {
      attendance.attendanceStatus = attendanceType.PRESENT;

      attendance.isHalfDay = false;
    }
  }

  await attendance.save({ session });

  return attendance;
};
