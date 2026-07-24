// attendance.service.ts

import mongoose from "mongoose";

import {
  UserModel,
  AttendanceModel,
  LeaveRequestModel,
  HolidayModel,
  UserPolicyModel,
} from "../infrastructure/database/models";
import { leaveStatusType, userStatus } from "../types/types";

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

      let attendanceStatus = "ABSENT";

      //---------------------------------------
      // Leave
      //---------------------------------------
      const leave = await LeaveRequestModel.exists({
        userId: user._id,
        status: leaveStatusType.APPROVED,
        fromDate: { $lte: attendanceDate },
        toDate: { $gte: attendanceDate },
      });

      if (leave) {
        attendanceStatus = "LEAVE";
      }

      //---------------------------------------
      // Holiday
      //---------------------------------------

      if (attendanceStatus === "ABSENT") {
        const holiday = await HolidayModel.exists({
          companyId: user.companyId,
          date: attendanceDate,
        });

        if (holiday) {
          attendanceStatus = "HOLIDAY";
        }
      }

      //---------------------------------------
      // Weekly Off
      //---------------------------------------

      if (attendanceStatus === "ABSENT") {
        const userPolicy = await UserPolicyModel.findOne({ userId: user._id })
          .sort({ createdAt: -1 })
          .populate("policyId");

        const policy: any = userPolicy?.policyId;

        if (policy) {
          const weekday = today
            .toLocaleDateString("en-US", {
              weekday: "long",
            })
            .toUpperCase();

          if (policy.workHours.weeklyOffs.includes(weekday)) {
            attendanceStatus = "WEEK_OFF";
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
  } catch (e) {
    await session.abortTransaction();

    throw e;
  } finally {
    session.endSession();
  }
};
