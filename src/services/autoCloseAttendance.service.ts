import { AttendanceModel } from "../infrastructure/database/models";
import { attendanceType } from "../types/types";
import { normalizeDate } from "../shared/helpers/dateHelper";
import { PunchOutFn } from "./punch.service";

const BATCH_SIZE = 500;

export const processAutoCloseAttendance = async ({
  companyId,
  attendanceDate,
}: {
  companyId: string;
  attendanceDate: Date;
}) => {
  const date = normalizeDate(attendanceDate);

  let processed = 0;
  let closed = 0;

  while (true) {
    const attendances = await AttendanceModel.find({
      companyId,
      attendanceDate: date,

      // Employee punched in
      inTime: { $ne: null },

      // Employee has not punched out
      outTime: null,

      // Only actual working attendance
      attendanceStatus: attendanceType.PRESENT,
    })
      .sort({ _id: 1 })
      .select("userId")
      .limit(BATCH_SIZE)
      .lean();

    if (!attendances.length) {
      break;
    }

    for (const attendance of attendances) {
      try {
        PunchOutFn(
          attendance.userId.toString(),
          null,
          "SYSTEM",
          null,
          null,
          true,
        );

        closed++;
      } catch (error) {
        console.error(
          `Auto close failed for attendance ${attendance._id}`,
          error,
        );
      }

      processed++;
    }
  }

  console.log(
    `Auto close completed | company=${companyId} | processed=${processed} | closed=${closed}`,
  );

  return {
    processed,
    closed,
  };
};
