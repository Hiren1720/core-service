import mongoose from "mongoose";
import {
  AttendanceModel,
  HolidayModel,
  LeaveRequestModel,
  UserModel,
  UserPolicyModel,
} from "../infrastructure/database/models";
import { attendanceType, leaveStatusType, userStatus } from "../types/types";
import { getSaturdayRule, weekDays } from "../services/attendance.service";

export const generateUserMonthlyPunchTestData = async (
  userId: string,
  month: number,
  year: number,
) => {
  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    const user = await UserModel.findOne({
      _id: userId,
      status: userStatus.ACTIVE,
    })
      .select("_id companyId shiftId")
      .populate("shiftId", "startTime endTime")
      .lean();

    if (!user) {
      throw new Error("Active user not found");
    }

    const userPolicy = await UserPolicyModel.findOne({
      userId,
    })
      .sort({ createdAt: -1 })
      .populate("policyId")
      .lean();

    const policy: any = userPolicy?.policyId;

    if (!policy) {
      throw new Error("Policy not assigned");
    }

    const shift: any = user.shiftId;

    if (!shift) {
      throw new Error("Shift not assigned");
    }

    // --------------------------------------------------
    // Month
    // --------------------------------------------------

    const monthStart = new Date(year, month - 1, 1);
    const monthEnd = new Date(year, month, 0);

    monthStart.setHours(0, 0, 0, 0);
    monthEnd.setHours(23, 59, 59, 999);

    // --------------------------------------------------
    // Existing attendance
    // --------------------------------------------------

    const existing = await AttendanceModel.find({
      userId,
      attendanceDate: {
        $gte: monthStart,
        $lte: monthEnd,
      },
    })
      .select("attendanceDate")
      .lean();

    const existingDates = new Set(
      existing.map((item) =>
        new Date(item.attendanceDate).toISOString().slice(0, 10),
      ),
    );

    // --------------------------------------------------
    // Holidays
    // --------------------------------------------------

    const holidays = await HolidayModel.find({
      companyId: user.companyId,
      startDate: { $lte: monthEnd },
      endDate: { $gte: monthStart },
    })
      .select("startDate endDate")
      .lean();

    const holidaySet = new Set<string>();

    for (const holiday of holidays) {
      const date = new Date(holiday.startDate);
      const end = new Date(holiday.endDate);

      date.setHours(0, 0, 0, 0);
      end.setHours(0, 0, 0, 0);

      while (date <= end) {
        holidaySet.add(date.toISOString().slice(0, 10));

        date.setDate(date.getDate() + 1);
      }
    }

    // --------------------------------------------------
    // Leaves
    // --------------------------------------------------

    const leaves = await LeaveRequestModel.find({
      userId,
      status: leaveStatusType.APPROVED,
      startDate: { $lte: monthEnd },
      endDate: { $gte: monthStart },
    })
      .select("_id startDate endDate duration")
      .lean();

    // --------------------------------------------------
    // Shift time
    // --------------------------------------------------

    const [startHour, startMinute] = shift.startTime.split(":").map(Number);

    const [endHour, endMinute] = shift.endTime.split(":").map(Number);

    const shiftDurationMinutes =
      endHour * 60 + endMinute - (startHour * 60 + startMinute);

    // --------------------------------------------------
    // Bulk operations
    // --------------------------------------------------

    const operations: any[] = [];

    const current = new Date(monthStart);

    while (current <= monthEnd) {
      const attendanceDate = new Date(current);

      attendanceDate.setHours(0, 0, 0, 0);

      const dateKey = attendanceDate.toISOString().slice(0, 10);

      if (existingDates.has(dateKey)) {
        current.setDate(current.getDate() + 1);
        continue;
      }

      let attendanceStatus = attendanceType.ABSENT;
      let isHalfDay = false;
      let leaveRequestId = null;

      let inTime: Date | null = null;
      let outTime: Date | null = null;

      let lateMinutes = 0;
      let earlyExitMinutes = 0;
      let overtimeMinutes = 0;

      let totalWorkedMinutes = 0;

      // ==================================================
      // Leave
      // ==================================================

      const leave = leaves.find((item) => {
        const start = new Date(item.startDate);
        const end = new Date(item.endDate);

        start.setHours(0, 0, 0, 0);
        end.setHours(0, 0, 0, 0);

        return attendanceDate >= start && attendanceDate <= end;
      });

      // ==================================================
      // Full day leave
      // ==================================================

      if (leave && leave.duration === "FULL_DAY") {
        attendanceStatus = attendanceType.LEAVE;
        leaveRequestId = leave._id;
      }

      // ==================================================
      // Half day leave
      // ==================================================
      else if (
        leave &&
        (leave.duration === "FIRST_HALF" || leave.duration === "SECOND_HALF")
      ) {
        attendanceStatus = attendanceType.ABSENT;
        isHalfDay = true;
        leaveRequestId = leave._id;

        // ----------------------------------------------
        // Generate working half-day punch
        // ----------------------------------------------

        if (leave.duration === "FIRST_HALF") {
          // Employee works second half

          const halfMinutes = Math.floor(shiftDurationMinutes / 2);

          const punchIn = new Date(attendanceDate);

          punchIn.setHours(startHour, startMinute, 0, 0);

          punchIn.setMinutes(punchIn.getMinutes() + halfMinutes);

          inTime = new Date(punchIn);

          const punchOut = new Date(attendanceDate);

          punchOut.setHours(endHour, endMinute, 0, 0);

          outTime = new Date(punchOut);
        } else {
          // Employee works first half

          const punchIn = new Date(attendanceDate);

          punchIn.setHours(startHour, startMinute, 0, 0);

          inTime = new Date(punchIn);

          const halfMinutes = Math.floor(shiftDurationMinutes / 2);

          const punchOut = new Date(attendanceDate);

          punchOut.setHours(startHour, startMinute, 0, 0);

          punchOut.setMinutes(punchOut.getMinutes() + halfMinutes);

          outTime = new Date(punchOut);
        }

        totalWorkedMinutes = Math.floor(
          (outTime.getTime() - inTime.getTime()) / 60000,
        );

        attendanceStatus = attendanceType.PRESENT;
      }

      // ==================================================
      // Normal working day
      // ==================================================
      else if (!holidaySet.has(dateKey)) {
        const weekday = weekDays[attendanceDate.getDay()];

        const weeklyOffs = policy.workHours?.weeklyOffs || [];

        const saturdayRule = getSaturdayRule(attendanceDate);

        const isWeeklyOff =
          weeklyOffs.includes(weekday) ||
          (saturdayRule && weeklyOffs.includes(saturdayRule));

        // ----------------------------------------------
        // Weekly off
        // ----------------------------------------------

        if (isWeeklyOff) {
          attendanceStatus = attendanceType.WEEK_OFF;
        }

        // ----------------------------------------------
        // Working day
        // ----------------------------------------------
        else {
          const punchIn = new Date(attendanceDate);
          punchIn.setHours(startHour, startMinute, 0, 0);

          // Random late variation for testing
          const randomLate = Math.random() > 0.8 ? 10 : 0;

          punchIn.setMinutes(punchIn.getMinutes() + randomLate);
          inTime = new Date(punchIn);
          lateMinutes = randomLate;

          // --------------------------------------------
          // Normal punch out
          // --------------------------------------------

          const punchOut = new Date(attendanceDate);

          punchOut.setHours(endHour, endMinute, 0, 0);

          // Random early exit / overtime
          const randomType = Math.random();

          if (randomType < 0.1) {
            // 10% early exit

            punchOut.setMinutes(punchOut.getMinutes() - 20);
          } else if (randomType > 0.9) {
            // 10% overtime

            punchOut.setMinutes(punchOut.getMinutes() + 60);
          }

          outTime = new Date(punchOut);

          totalWorkedMinutes = Math.floor(
            (outTime.getTime() - inTime.getTime()) / 60000,
          );

          // --------------------------------------------
          // Early exit
          // --------------------------------------------

          earlyExitMinutes = Math.max(
            0,
            Math.floor(
              (new Date(attendanceDate).setHours(endHour, endMinute, 0, 0) -
                outTime.getTime()) /
                60000,
            ),
          );

          // --------------------------------------------
          // Overtime
          // --------------------------------------------

          overtimeMinutes = Math.max(
            0,
            Math.floor(
              (outTime.getTime() -
                new Date(attendanceDate).setHours(endHour, endMinute, 0, 0)) /
                60000,
            ),
          );

          attendanceStatus = attendanceType.PRESENT;

          // --------------------------------------------
          // Test actual half-day
          // --------------------------------------------

          const fullDayMinimumMinutes = Math.ceil(
            (shiftDurationMinutes * policy.lateRule.minFullDayPercentage) / 100,
          );

          const halfDayMinimumMinutes = Math.ceil(
            (shiftDurationMinutes * policy.lateRule.minHalfDayPercentage) / 100,
          );

          if (totalWorkedMinutes < halfDayMinimumMinutes) {
            attendanceStatus = attendanceType.ABSENT;

            isHalfDay = false;
          } else if (totalWorkedMinutes < fullDayMinimumMinutes) {
            attendanceStatus = attendanceType.PRESENT;

            isHalfDay = true;
          }
        }
      }

      // ==================================================
      // Holiday
      // ==================================================
      else {
        attendanceStatus = attendanceType.HOLIDAY;
      }

      // ==================================================
      // Late mark
      // ==================================================

      if (lateMinutes > policy.lateRule.allowedLateMinutes) {
        // For test data
        // late mark is based on actual punch-in

        // Don't override half-day leave
        if (!leave) {
          // isLate field can be set here
        }
      }

      // ==================================================
      // Build attendance
      // ==================================================

      operations.push({
        insertOne: {
          document: {
            userId: user._id,
            companyId: user.companyId,

            attendanceDate,

            inTime,
            outTime,

            inMethod: inTime ? "MOBILE" : "MOBILE",

            outMethod: outTime ? "MOBILE" : null,

            totalWorkedMinutes,

            overtimeMinutes,

            overtimeApproved: overtimeMinutes > 0,

            lateMinutes,

            isLate: lateMinutes > policy.lateRule.allowedLateMinutes,

            isHalfDay,

            earlyExitMinutes,

            attendanceStatus,

            leaveRequestId,

            autoClosed: false,
          },
        },
      });

      current.setDate(current.getDate() + 1);
    }

    if (operations.length) {
      await AttendanceModel.bulkWrite(operations, {
        session,
        ordered: false,
      });
    }

    await session.commitTransaction();

    return {
      userId,
      month,
      year,
      createdRecords: operations.length,
    };
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    await session.endSession();
  }
};
