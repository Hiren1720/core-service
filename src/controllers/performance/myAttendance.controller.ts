import { NextFunction, Request, Response } from "express";
import mongoose from "mongoose";
import {
  AttendanceModel,
  UserModel,
  UserPolicyModel,
} from "../../infrastructure/database/models";
import { ApiResponse } from "../../shared/response/api-response";
import { attendanceType } from "../../types/types";
import { createUserDaySpecificAttendance } from "../../services/attendance.service";
import { normalizeDate } from "../../shared/helpers/dateHelper";

const statusPriority: Record<string, number> = {
  PRESENT: 1,
  HALF_DAY: 2,
  ABSENT: 3,
};

export const punchInOut = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    const { id: userId } = req.user!;
    const { latitude, longitude, address, method = "MOBILE" } = req.body;

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
      await session.abortTransaction();
      return res
        .status(404)
        .json(ApiResponse.error("Attendance not generated for today"));
    }

    if (!shift) {
      await session.abortTransaction();
      return res.status(404).json(ApiResponse.error("Shift not assigned"));
    }

    if (!policy) {
      await session.abortTransaction();
      return res.status(404).json(ApiResponse.error("Policy not assigned"));
    }

    // Don't allow punch in for finalized attendance
    const restrictedStatus = [
      attendanceType.HOLIDAY,
      attendanceType.WEEK_OFF,
      attendanceType.LEAVE,
    ];

    if (
      !attendance.inTime &&
      restrictedStatus.includes(attendance.attendanceStatus)
    ) {
      await session.abortTransaction();
      return res
        .status(400)
        .json(
          ApiResponse.error(
            `Punch not allowed. Today is ${attendance.attendanceStatus
              .replace("_", " ")
              .toLowerCase()}.`,
          ),
        );
    }

    // ===========================================
    // Punch In
    // ===========================================
    if (!attendance.inTime) {
      const shiftStart = new Date(attendanceDate);
      const [startHour, startMinute] = shift.startTime.split(":").map(Number);
      shiftStart.setHours(startHour, startMinute, 0, 0);

      // Late Minutes
      const lateMinutes = Math.max(
        0,
        Math.floor((now.getTime() - shiftStart.getTime()) / 60000),
      );

      attendance.inTime = now;
      attendance.inLocation = {
        latitude,
        longitude,
        address,
      };
      attendance.inMethod = method;
      attendance.lateMinutes = lateMinutes;

      // Late Mark
      attendance.isLate = lateMinutes > policy.lateRule.allowedLateMinutes;
      attendance.attendanceStatus = attendanceType.PRESENT;

      await attendance.save({ session });

      await session.commitTransaction();
      return res
        .status(200)
        .json(ApiResponse.success({}, "Punch in successful"));
    }

    // ============================
    // Punch Out
    // ============================
    if (attendance.outTime) {
      await session.abortTransaction();
      return res.status(400).json(ApiResponse.error("Already punched out"));
    }

    const shiftEnd = new Date(attendanceDate);
    const [hour, minute] = shift.endTime.split(":").map(Number);
    shiftEnd.setHours(hour, minute, 0, 0);

    attendance.outTime = now;
    attendance.outMethod = method;
    attendance.outLocation = {
      latitude,
      longitude,
      address,
    };

    // Working Minutes
    const workedMinutes = Math.max(
      0,
      Math.floor(
        (attendance.outTime.getTime() - attendance.inTime.getTime()) / 60000,
      ),
    );

    attendance.totalWorkedMinutes = workedMinutes;

    // Early Exit
    attendance.earlyExitMinutes = Math.max(
      0,
      Math.floor((shiftEnd.getTime() - attendance.outTime.getTime()) / 60000),
    );

    // Overtime
    attendance.overtimeMinutes = Math.max(
      0,
      Math.floor((attendance.outTime.getTime() - shiftEnd.getTime()) / 60000),
    );

    // Late Mark
    if (attendance.earlyExitMinutes > policy.lateRule.allowedEarlyMinutes) {
      attendance.isLate = true;
    }

    // Attendance Status
    const workedHours = workedMinutes / 60;

    attendance.attendanceStatus = attendanceType.PRESENT;

    // Absent
    if (workedHours < policy.lateRule.fullDayMinHours) {
      attendance.attendanceStatus = attendanceType.ABSENT;
    }

    // Half Day
    else if (
      workedHours >= policy.lateRule.halfDayWorkMinHours &&
      workedHours <= policy.lateRule.halfDayWorkMaxHours
    ) {
      attendance.attendanceStatus = attendanceType.PRESENT;
      attendance.isHalfDay = true;
    }

    await attendance.save({ session });
    await session.commitTransaction();

    return res
      .status(200)
      .json(ApiResponse.success(attendance, "Punch out successful"));
  } catch (error) {
    await session.abortTransaction();
    next(error);
  } finally {
    session.endSession();
  }
};

// let attendanceStatus = attendance.attendanceStatus;

/* Why compare priorities?
Example:
    Employee logs in 2.5 hours late → HALF_DAY
    Then works until midnight

    They should remain HALF_DAY, not become PRESENT.

    Similarly:

    Logged in 3+ hours late → ABSENT
    Worked 8 hours afterwards

    Still ABSENT according to your policy. */

// if (
//   statusPriority[attendanceStatus] >
//   statusPriority[attendance.attendanceStatus]
// ) {
//   attendance.attendanceStatus = attendanceStatus;
// }

// attendance.overtimeMinutes =
// Math.max(
// 0,
// Math.floor(
// (now.getTime()-shiftEnd.getTime())/60000
// )
// );

// attendance.isOvertime =
// attendance.overtimeMinutes > 0;

export const getMyTodayStatus = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { id: userId } = req.user!;

    const today = new Date();
    const attendanceDate = normalizeDate(today)

    const attendance = await AttendanceModel.findOne({
      userId,
      attendanceDate,
    }).lean();

    if (!attendance) {
      return res
        .status(404)
        .json(ApiResponse.error("Attendance not generated for today"));
    }

    return res
      .status(200)
      .json(ApiResponse.success(attendance, "Attendance fetched successfully"));
  } catch (error) {
    next(error);
  }
};

export const getAttendanceByMonth = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { userId } = req.query;
    const { month, year } = req.query;

    if (!userId || !month || !year) {
      return res.status(400).json({
        message: "userId, month and year are required",
      });
    }

    const monthNumber = Number(month);
    const yearNumber = Number(year);

    if (monthNumber < 1 || monthNumber > 12 || !yearNumber) {
      return res.status(400).json({
        message: "Invalid month or year",
      });
    }

    const startDate = new Date(yearNumber, monthNumber - 1, 1);

    const endDate = new Date(yearNumber, monthNumber, 0);

    endDate.setHours(23, 59, 59, 999);

    const filter: any = {
      companyId: req.user!.companyId,
      userId,
      attendanceDate: {
        $gte: startDate,
        $lte: endDate,
      },
    };

    const [attendanceRecords, generatedDays] = await Promise.all([
      AttendanceModel.find(filter)
        .populate("userId", "firstName lastName profileImage role status")
        .populate([
          {
            path: "leaveRequestId",
            select: "duration",
            populate: {
              path: "leaveId",
              select: "name",
            },
          },
        ])
        .select(
          "attendanceDate inTime outTime inLocation outLocation inMethod outMethod attendanceStatus isHalfDay totalWorkedMinutes lateMinutes isLate earlyExitMinutes leaveRequestId",
        )
        .sort({ attendanceDate: 1 })
        .lean(),

      // Generate missing/future days
      createMonthlyDaySpecificAttendance(userId as string, startDate, endDate),
    ]);

    return res.status(200).json(
      ApiResponse.success(
        {
          list: [...attendanceRecords,...generatedDays],
        },
        "Attendance fetched successfully",
      ),
    );
  } catch (error) {
    next(error);
  }
};

const createMonthlyDaySpecificAttendance = async (
  userId: string,
  startDate: Date,
  endDate: Date,
) => {
  const result: any[] = [];

  const today = new Date();

  // Remove time for date-only comparison
  today.setHours(0, 0, 0, 0);

  let currentDate: Date;

  // Requested month is completely in the past
  if (endDate < today) {
    return result;
  }

  // Requested month is the current month
  if (
    startDate.getFullYear() === today.getFullYear() &&
    startDate.getMonth() === today.getMonth()
  ) {
    currentDate = new Date(today);

    // Start from tomorrow
    currentDate.setDate(currentDate.getDate() + 1);
  } else {
    // Future month
    currentDate = new Date(startDate);
  }

  const dates: Date[] = [];
  while (currentDate <= endDate) {
    dates.push(new Date(currentDate));
    currentDate.setDate(currentDate.getDate() + 1);
  }

  const attendanceResults = await Promise.all(
    dates.map((date) => createUserDaySpecificAttendance(userId, date)),
  );

  return attendanceResults.filter((attendance) => attendance !== null);
};
