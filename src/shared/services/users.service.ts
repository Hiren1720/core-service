import {
  UserAssignmentModel,
  UserModel,
} from "../../infrastructure/database/models";

export const getMyManagedUserIdList = async (id: string) => {
  const assignment = await UserAssignmentModel.findOne({
    userId: id,
  })
    .sort({ createdAt: -1 })
    .select("assignments")
    .lean();

  if (!assignment) {
    return [];
  }

  const managesAssignments = assignment.assignments.filter(
    (el) => !el.isReporting,
  );

  const managerManagedFilter: any = {
    branchId: { $in: managesAssignments.map((el) => el.branchId.toString()) },
    shiftId: { $in: managesAssignments.map((el) => el.shiftId.toString()) },
    departmentId: {
      $in: managesAssignments.map((el) => el.departmentId.toString()),
    },
    role: "EMPLOYEE",
  };

  const users = await UserModel.find(managerManagedFilter).select("_id").lean();

  return users;
};
