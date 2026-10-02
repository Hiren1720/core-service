import {
  AttendanceModel,
  UserHistoryModel,
  UserModel,
} from "./infrastructure/database/models";

export const createMissingUserStatusHistory = async () => {
  try {
    const users = await UserModel.find({
      role: { $ne: "OWNER" },
    })
      .select("_id status")
      .lean();

    console.log(`Found ${users.length} users`);

    let created = 0;
    let skipped = 0;
    let noAttendance = 0;

    for (const user of users) {
      const userId = user._id;

      // Check whether user already has at least one status history
      const existingHistory = await UserHistoryModel.findOne({
        fieldId: userId.toString(),
        field: "userStatus",
      })
        .select("_id")
        .lean();

      if (existingHistory) {
        skipped++;
        continue;
      }

      // Find first attendance record
      const firstAttendance = await AttendanceModel.findOne({
        userId,
      })
        .sort({ createdAt: 1 })
        .select("createdAt")
        .lean();

      if (!firstAttendance) {
        noAttendance++;
        continue;
      }

      // History date = one day after first attendance
      const historyDate = new Date(firstAttendance.createdAt);
      historyDate.setDate(historyDate.getDate() - 1);

      await UserHistoryModel.create({
        userId,
        field: "userStatus",
        fieldId: userId.toString(),
        fieldValue: user.status,
        remarks: "Initial user status history created from attendance record.",
        assignedBy: userId,

        // If your schema has timestamps: true
        createdAt: historyDate,
        updatedAt: historyDate,
      });

      created++;

      console.log(
        `Created history for ${userId} | attendance: ${firstAttendance.createdAt} | history: ${historyDate}`,
      );
    }

    console.log("=================================");
    console.log("Migration completed");
    console.log(`Created: ${created}`);
    console.log(`Skipped: ${skipped}`);
    console.log(`No attendance: ${noAttendance}`);
    console.log("=================================");
  } catch (error) {
    console.error("Migration failed:", error);
    throw error;
  }
};

createMissingUserStatusHistory();