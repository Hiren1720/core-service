import { NextFunction, Request, Response } from "express";
import mongoose from "mongoose";
import { AttendanceModel } from "../../infrastructure/database/models";
import { ApiResponse } from "../../shared/response/api-response";
import { createUserDaySpecificAttendance } from "../../services/attendance.service";
import { normalizeDate } from "../../shared/helpers/dateHelper";
import { PunchInFn, PunchOutFn } from "../../services/punch.service";

export const punchIn = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    const { id: userId } = req.user!;
    const { latitude, longitude, address, method = "MOBILE" } = req.body;

    const attendance = await PunchInFn(
      userId,
      latitude !== undefined && longitude !== undefined
        ? {
            latitude,
            longitude,
            address: address || "",
          }
        : null,
      method,
      session,
    );

    await session.commitTransaction();

    return res
      .status(200)
      .json(ApiResponse.success(attendance, "Punch in successful"));
  } catch (error) {
    await session.abortTransaction();
    next(error);
  } finally {
    await session.endSession();
  }
};

export const punchOut = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    const { id: userId } = req.user!;
    const { latitude, longitude, address, method = "MOBILE" } = req.body;

    const attendance = await PunchOutFn(
      userId,
      latitude !== undefined && longitude !== undefined
        ? {
            latitude,
            longitude,
            address: address || "",
          }
        : null,
      method,
      session,
    );

    await session.commitTransaction();

    return res
      .status(200)
      .json(ApiResponse.success(attendance, "Punch out successful"));
  } catch (error) {
    await session.abortTransaction();
    next(error);
  } finally {
    await session.endSession();
  }
};

export const getMyTodayStatus = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { id: userId } = req.user!;

    const today = new Date();
    const attendanceDate = normalizeDate(today);

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
          list: [...generatedDays],
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
