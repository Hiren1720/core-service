import { normalizeDate } from "../../../shared/helpers/dateHelper";
import { CompanyModel } from "../../../infrastructure/database/models";
import { status } from "../../../types/types";
import { attendanceQueue } from "../queues/attendance.queue";

export const registerAttendanceScheduler = async () => {
  const today = normalizeDate(new Date());

  const companies = await CompanyModel.find({
    status: status.ACTIVE,
  })
    .select("_id companyName")
    .lean();

  for (const company of companies) {
    await attendanceQueue.add(
      "createCompanyDailyAttendance",
      {
        companyId: company._id.toString(),
        attendanceDate: today.toISOString(),
      },
      {
        jobId: `attendance-${company._id}-${today.toISOString()}`,
      },
    );
  }

  console.log(`Attendance jobs queued for ${companies.length} companies`);
};

export const registerAttendanceAutoCloseScheduler = async () => {
  const today = normalizeDate(new Date());

  const companies = await CompanyModel.find({
    status: status.ACTIVE,
  })
    .select("_id")
    .lean();

  for (const company of companies) {
    await attendanceQueue.add(
      "autoCloseAttendance",
      {
        companyId: company._id.toString(),
        attendanceDate: today.toISOString(),
      },
      {
        jobId: `auto-close-${company._id}-${today.toISOString()}`,
      },
    );
  }

  console.log(`Auto-close jobs queued for ${companies.length} companies`);
};
