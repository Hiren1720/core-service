import mongoose from "mongoose";
import { normalizeDate } from "../shared/helpers/dateHelper";
import {
  AttendanceModel,
  HolidayModel,
  LeaveRequestModel,
  UserModel,
  UserPolicyModel,
} from "../infrastructure/database/models";
import { attendanceType, leaveStatusType, userStatus } from "../types/types";
import { getSaturdayRule, weekDays } from "./attendance.service";

export const processCompanyDailyAttendance = async ({
  companyId,
  attendanceDate,
}: {
  companyId: string;
  attendanceDate: Date;
}) => {
  console.log("called worker for attendance")
  const companyObjectId = new mongoose.Types.ObjectId(companyId);
  const date = normalizeDate(attendanceDate);

  // 1. Get active employees
  const users = await UserModel.find({
    companyId: companyObjectId,
    status: userStatus.ACTIVE,
    role: { $ne: "OWNER" },
  })
    .select("_id companyId")
    .lean();

  if (!users.length) {
    console.log(`No active employees for company ${companyId}`);
    return;
  }

  const userIds = users.map((user) => user._id);

  // 2. Get existing attendance
  const existingAttendance = await AttendanceModel.find({
    companyId: companyObjectId,
    attendanceDate: date,
  })
    .select("userId")
    .lean();

  const existingUserIds = new Set(
    existingAttendance.map((item) => item.userId.toString()),
  );

  // 3. Get approved leaves
  const leaves = await LeaveRequestModel.find({
    companyId: companyObjectId,
    userId: { $in: userIds },
    status: leaveStatusType.APPROVED,

    startDate: {
      $lte: date,
    },

    endDate: {
      $gte: date,
    },
  })
    .select("_id userId startDate endDate duration")
    .lean();

  const leaveMap = new Map<string, any>();

  for (const leave of leaves) {
    leaveMap.set(leave.userId.toString(), leave);
  }

  // 4. Check company holiday ONCE
  const holiday = await HolidayModel.exists({
    companyId: companyObjectId,

    startDate: {
      $lte: date,
    },

    endDate: {
      $gte: date,
    },
  });

  const isHoliday = !!holiday;

  // 5. Get latest user policies
  const userPolicies = await UserPolicyModel.find({
    userId: { $in: userIds },
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
    .populate({
      path: "policyId",
      select: "workHours.weeklyOffs",
    })
    .lean();

  // 6. Build policy map
  const policyMap = new Map<string, any>();

  for (const userPolicy of userPolicies) {
    const userId = userPolicy.userId.toString();

    // First record is latest because of sorting
    if (!policyMap.has(userId)) {
      policyMap.set(userId, userPolicy.policyId);
    }
  }

  // 7. Prepare bulk operations
  const bulkOperations: any[] = [];

  const weekday = weekDays[date.getDay()];
  const saturdayRule = getSaturdayRule(date);

  // 8. Calculate attendance in memory
  for (const user of users) {
    const userId = user._id.toString();

    // Already created
    if (existingUserIds.has(userId)) {
      continue;
    }

    let attendanceStatus = attendanceType.ABSENT;

    let leaveRequestId = null;
    let isHalfDay = false;

    // Leave
    const leave = leaveMap.get(userId);

    if (leave) {
      attendanceStatus = attendanceType.LEAVE;

      leaveRequestId = leave._id;

      if (leave.duration === "FIRST_HALF" || leave.duration === "SECOND_HALF") {
        attendanceStatus = attendanceType.ABSENT;

        isHalfDay = true;
      }
    }

    // Holiday
    if (attendanceStatus === attendanceType.ABSENT) {
      if (isHoliday) {
        attendanceStatus = attendanceType.HOLIDAY;
      }
    }

    // Weekly Off
    if (attendanceStatus === attendanceType.ABSENT) {
      const policy = policyMap.get(userId);

      if (policy) {
        const weeklyOffs = policy.workHours?.weeklyOffs || [];

        if (
          weeklyOffs.includes(weekday) ||
          (saturdayRule && weeklyOffs.includes(saturdayRule))
        ) {
          attendanceStatus = attendanceType.WEEK_OFF;
        }
      }
    }

    // Prepare insert
    bulkOperations.push({
      insertOne: {
        document: {
          userId: user._id,
          companyId: companyObjectId,

          attendanceDate: date,
          attendanceStatus,
          leaveRequestId,
          isHalfDay,

          inTime: null,
          outTime: null,

          totalWorkedMinutes: 0,
          overtimeMinutes: 0,
          overtimeApproved: false,

          lateMinutes: 0,
          isLate: false,
          earlyExitMinutes: 0,
          autoClosed: false,
        },
      },
    });
  }

  // 9. Bulk insert
  if (!bulkOperations.length) {
    console.log(`Attendance already exists for company ${companyId}`);
    return;
  }

  await AttendanceModel.bulkWrite(bulkOperations, {
    ordered: false,
  });

  console.log(
    `Created ${bulkOperations.length} attendance records for company ${companyId}`,
  );
};
