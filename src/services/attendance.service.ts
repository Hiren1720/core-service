import mongoose from "mongoose";

import {
  AttendanceModel,
  HolidayModel,
  LeaveRequestModel,
  PolicyModel,
  UserModel,
  UserPolicyModel,
} from "../infrastructure/database/models";

import { attendanceType, leaveStatusType, userStatus } from "../types/types";
import { normalizeDate } from "../shared/helpers/dateHelper";

const weekDays = [
  "SUNDAY",
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
];

const getSaturdayRule = (date: Date) => {
  const day = date.getDay();

  // Sunday
  if (day === 0) {
    return "SUNDAY";
  }

  // Not Saturday
  if (day !== 6) {
    return null;
  }

  const occurrence = Math.ceil(date.getDate() / 7);

  const ordinalMap: Record<number, string> = {
    1: "1st",
    2: "2nd",
    3: "3rd",
    4: "4th",
    5: "5th",
  };

  return `${ordinalMap[occurrence]}SATURDAY`;
};

export const createDailyAttendance = async () => {
  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    const today = new Date();

    const attendanceDate = normalizeDate(today);

    const users = await UserModel.find({
      status: userStatus.ACTIVE,
      role: { $ne: "OWNER" },
    })
      .select("_id companyId")
      .lean();

    const bulkOperations = [];

    for (const user of users) {
      const exists = await AttendanceModel.exists({
        userId: user._id,
        attendanceDate,
      });

      if (exists) continue;

      let attendanceStatus = attendanceType.ABSENT;

      //---------------------------------------
      // Leave
      //---------------------------------------
      let leaveRequestId = null;
      const leave = await LeaveRequestModel.exists({
        userId: user._id,
        status: leaveStatusType.APPROVED,
        startDate: {
          $lte: attendanceDate,
        },
        endDate: {
          $gte: attendanceDate,
        },
      });

      if (leave) {
        attendanceStatus = attendanceType.LEAVE;
        leaveRequestId = leave._id;
      }

      //---------------------------------------
      // Holiday
      //---------------------------------------

      if (attendanceStatus === attendanceType.ABSENT) {
        const holiday = await HolidayModel.exists({
          companyId: user.companyId,
          startDate: {
            $lte: attendanceDate,
          },
          endDate: {
            $gte: attendanceDate,
          },
        });

        if (holiday) {
          attendanceStatus = attendanceType.HOLIDAY;
        }
      }

      //---------------------------------------
      // Weekly Off
      //---------------------------------------

      if (attendanceStatus === attendanceType.ABSENT) {
        const userPolicy = await UserPolicyModel.findOne({
          userId: user._id,
        })
          .sort({
            createdAt: -1,
          })
          .populate("policyId");

        const policy: any = userPolicy?.policyId;

        if (policy) {
          const weekday = weekDays[today.getDay()];
          const saturdayRule = getSaturdayRule(today);
          const weeklyOffs = policy.workHours?.weeklyOffs || [];

          if (
            weeklyOffs.includes(weekday) ||
            (saturdayRule && weeklyOffs.includes(saturdayRule))
          ) {
            attendanceStatus = attendanceType.WEEK_OFF;
          }
        }
      }

      bulkOperations.push({
        insertOne: {
          document: {
            userId: user._id,
            companyId: user.companyId,
            attendanceDate,
            attendanceStatus,
            leaveRequestId,
          },
        },
      });
    }

    if (bulkOperations.length) {
      await AttendanceModel.bulkWrite(bulkOperations, {
        session,
      });
    }

    await session.commitTransaction();
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
};

export const createUserDaySpecificAttendance = async (
  userId: string,
  date: Date,
) => {
  try {
    const today = new Date(date);
    const attendanceDate = normalizeDate(date);

    const user = await UserModel.findById(userId)
      .select("_id companyId")
      .lean();

    if (!user) return null;

    const exists = await AttendanceModel.exists({
      userId: user._id,
      attendanceDate,
    });

    if (exists) return null;

    let attendanceStatus = attendanceType.ABSENT;

    //---------------------------------------
    // Leave
    //---------------------------------------
    let leaveRequestId = null;
    const leave = await LeaveRequestModel.exists({
      userId: user._id,
      status: leaveStatusType.APPROVED,
      startDate: {
        $lte: attendanceDate,
      },
      endDate: {
        $gte: attendanceDate,
      },
    });

    if (leave) {
      attendanceStatus = attendanceType.LEAVE;
      leaveRequestId = leave._id;
    }

    //---------------------------------------
    // Holiday
    //---------------------------------------
    if (attendanceStatus === attendanceType.ABSENT) {
      const holiday = await HolidayModel.exists({
        companyId: user.companyId,
        startDate: {
          $lte: attendanceDate,
        },
        endDate: {
          $gte: attendanceDate,
        },
      });

      if (holiday) {
        attendanceStatus = attendanceType.HOLIDAY;
      }
    }

    //---------------------------------------
    // Weekly Off
    //---------------------------------------
    if (attendanceStatus === attendanceType.ABSENT) {
      const userPolicy = await UserPolicyModel.findOne({
        userId: user._id,
      })
        .sort({
          createdAt: -1,
        })
        .populate("policyId");

      const policy: any = userPolicy?.policyId;

      if (policy) {
        const weekday = weekDays[today.getDay()];
        const saturdayRule = getSaturdayRule(today);

        const weeklyOffs = policy.workHours?.weeklyOffs || [];

        if (
          weeklyOffs.includes(weekday) ||
          (saturdayRule && weeklyOffs.includes(saturdayRule))
        ) {
          attendanceStatus = attendanceType.WEEK_OFF;
        }
      }
    }

    if (attendanceType.ABSENT === attendanceStatus) return null;

    const attendance = new AttendanceModel({
      userId: user._id,
      companyId: user.companyId,
      attendanceDate,
      attendanceStatus,
      leaveRequestId,
    });

    if (leaveRequestId) {
      await attendance.populate({
        path: "leaveRequestId",
        select: "duration",
        populate: {
          path: "leaveId",
          select: "name",
        },
      });
    }

    return attendance.toObject();
  } catch (error) {
    throw error;
  }
};
