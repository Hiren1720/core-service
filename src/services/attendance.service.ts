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
  if (date.getDay() !== 6) return null;

  const occurrence = Math.ceil(date.getDate() / 7);

  return `${occurrence}SATURDAY`;
};

export const createDailyAttendance = async () => {
  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    const today = new Date();

    const attendanceDate = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate(),
    );

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
            attendanceDate,
            attendanceStatus,
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
