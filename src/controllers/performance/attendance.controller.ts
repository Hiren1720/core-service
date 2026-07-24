import { NextFunction, Request, Response } from "express";
import mongoose from "mongoose";
import {
  AttendanceModel,
  UserModel,
  UserPolicyModel,
} from "../../infrastructure/database/models";
import { ApiResponse } from "../../shared/response/api-response";
import { attendanceType } from "../../types/types";

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
    const attendanceDate = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    );

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

    // ============================
    // Punch In
    // ============================
    if (!attendance) {
      const shiftStart = new Date(attendanceDate);
      const [startHour, startMinute] = shift.startTime.split(":").map(Number);

      shiftStart.setHours(startHour, startMinute, 0, 0);

      const diffMinutes = Math.max(
        0,
        Math.floor((now.getTime() - shiftStart.getTime()) / 60000),
      );

      let attendanceStatus: attendanceType = attendanceType.PRESENT;
      switch (true) {
        case diffMinutes >= policy.lateRule.absentAfterMinutes:
          attendanceStatus = attendanceType.ABSENT;
          break;

        case diffMinutes >= policy.lateRule.halfDayAfterMinutes:
          attendanceStatus = attendanceType.HALF_DAY;
          break;

        default:
          attendanceStatus = attendanceType.PRESENT;
      }
      await AttendanceModel.create(
        [
          {
            userId,
            attendanceDate,
            lateMinutes: diffMinutes,
            inTime: now,
            attendanceStatus,
            inLocation: {
              latitude,
              longitude,
              address,
            },

            inMethod: method,
          },
        ],
        { session },
      );

      await session.commitTransaction();
      return res
        .status(200)
        .json(ApiResponse.success({}, "Punch in successful"));
    }

    // ============================
    // Already Punched Out
    // ============================
    if (attendance.outTime) {
      await session.abortTransaction();
      return res
        .status(400)
        .json(ApiResponse.error("Already punched out today"));
    }

    // ============================
    // Punch Out
    // ============================
    const shiftEnd = new Date(attendanceDate);
    const [endHour, endMinute] = shift.endTime.split(":").map(Number);
    shiftEnd.setHours(endHour, endMinute, 0, 0);

    attendance.earlyExitMinutes = Math.max(
      0,
      Math.floor((shiftEnd.getTime() - now.getTime()) / 60000),
    );
    attendance.overtimeMinutes = Math.max(
      0,
      Math.floor((now.getTime() - shiftEnd.getTime()) / 60000),
    );
    attendance.outTime = now;
    attendance.outLocation = {
      latitude,
      longitude,
      address,
    };
    attendance.outMethod = method;
    attendance.totalWorkedMinutes = Math.max(
      0,
      Math.floor(
        (attendance.outTime.getTime() - attendance.inTime.getTime()) /
          (1000 * 60),
      ),
    );

    let attendanceStatus = attendance.attendanceStatus;
    switch (true) {
      case attendance.totalWorkedMinutes <
        policy.workHours.minimumHoursForHalfDay * 60:
        attendanceStatus = attendanceType.ABSENT;
        break;

      case attendance.totalWorkedMinutes <
        policy.workHours.minimumHoursForFullDay * 60:
        attendanceStatus = attendanceType.HALF_DAY;
        break;

      default:
        attendanceStatus = attendanceType.PRESENT;
    }

    /* Why compare priorities?
    Example:
        Employee logs in 2.5 hours late → HALF_DAY
        Then works until midnight

        They should remain HALF_DAY, not become PRESENT.

        Similarly:

        Logged in 3+ hours late → ABSENT
        Worked 8 hours afterwards

        Still ABSENT according to your policy. */

    if (
      statusPriority[attendanceStatus] >
      statusPriority[attendance.attendanceStatus]
    ) {
      attendance.attendanceStatus = attendanceStatus;
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
