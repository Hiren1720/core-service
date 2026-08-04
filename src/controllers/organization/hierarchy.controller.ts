import { NextFunction, Request, Response } from "express";
import mongoose from "mongoose";
import {
  BranchModel,
  DepartmentModel,
  ShiftModel,
  UserAssignmentModel,
} from "../../infrastructure/database/models";
import { ApiResponse } from "../../shared/response/api-response";
import { status } from "../../types/types";

export const getDepartmentEmployeeList = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const companyId = req.user!.companyId;
    const { branchId, shiftId } = req.query;

    const assignmentMatch: any = {};
    const departmentFilter: any = {
      companyId,
      status: { $ne: status.DELETED },
    };

    if (branchId) {
      departmentFilter["assignments.branchId"] = new mongoose.Types.ObjectId(
        branchId as string,
      );
      assignmentMatch["assignments.branchId"] = new mongoose.Types.ObjectId(
        branchId as string,
      );
    }

    if (shiftId) {
      departmentFilter["assignments.shiftIds"] = new mongoose.Types.ObjectId(
        shiftId as string,
      );
      assignmentMatch["assignments.shiftId"] = new mongoose.Types.ObjectId(
        shiftId as string,
      );
    }

    const [departments, userAssignments] = await Promise.all([
      DepartmentModel.find(departmentFilter)
        .select("_id name assignments status")
        .lean(),

      UserAssignmentModel.aggregate([
        {
          $match: {
            companyId: new mongoose.Types.ObjectId(companyId),
          },
        },
        {
          $sort: {
            createdAt: -1,
          },
        },
        {
          $group: {
            _id: "$userId",
            assignment: {
              $first: "$$ROOT",
            },
          },
        },
        {
          $replaceRoot: {
            newRoot: "$assignment",
          },
        },
        ...(Object.keys(assignmentMatch).length
          ? [
              {
                $match: assignmentMatch,
              },
            ]
          : []),
        {
          $lookup: {
            from: "users", // User collection name
            localField: "userId",
            foreignField: "_id",
            as: "user",
          },
        },
        {
          $unwind: {
            path: "$user",
            preserveNullAndEmptyArrays: true,
          },
        },
        {
          $match: {
            "user.status": {
              $in: [status.ACTIVE, status.INACTIVE],
            },
          },
        },
        {
          $project: {
            userId: 1,
            companyId: 1,
            assignments: 1,
            createdAt: 1,

            "user._id": 1,
            "user.role": 1,
            "user.firstName": 1,
            "user.lastName": 1,
            "user.profileImage": 1,
            "user.status": 1,
          },
        },
      ]),
    ]);

    const departmentCountMap = new Map<string, number>();
    const departmentManagerMap = new Map<string, any>();
    const departmentEmployeeMap = new Map<string, any[]>();

    for (const user of userAssignments) {
      for (const assignment of user.assignments) {
        const isManager = user.user.role === "MANAGER";
        const departmentKey = assignment.departmentId.toString();

        if (isManager) {
          //avoid count because only employee count returning
          if (!assignment.isReporting) {
            //For manager exclude reporting data only manged fields for manager data
            departmentManagerMap.set(departmentKey, user.user);
          }
        } else {
          if (!departmentEmployeeMap.has(departmentKey)) {
            departmentEmployeeMap.set(departmentKey, []);
          }

          departmentEmployeeMap.get(departmentKey)!.push(user.user);
          departmentCountMap.set(
            departmentKey,
            (departmentCountMap.get(departmentKey) || 0) + 1,
          );
        }
      }
    }

    const data = departments.map((department: any) => {
      const departmentId = department._id.toString();
      return {
        _id: department._id,
        name: department.name,
        status: department.status,
        count: departmentCountMap.get(departmentId) || 0,
        manager: departmentManagerMap.get(departmentId),
        employee: departmentEmployeeMap.get(departmentId) || [],
      };
    });

    return res
      .status(200)
      .json(
        ApiResponse.success(
          data,
          "Branch shift department options fetched successfully",
        ),
      );
  } catch (error) {
    next(error);
  }
};

export const getBranchShiftDepartmentList = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const companyId = req.user!.companyId;

    const [branches, shifts, departments, userAssignments] = await Promise.all([
      BranchModel.find({
        companyId,
        status: { $ne: status.DELETED },
      })
        .select("_id name address status branchType")
        .lean(),

      ShiftModel.find({
        companyId,
        status: { $ne: status.DELETED },
      })
        .select(
          "_id name branchIds startTime endTime breakStartTime breakEndTime status",
        )
        .lean(),

      DepartmentModel.find({
        companyId,
        status: { $ne: status.DELETED },
      })
        .select("_id name assignments status")
        .lean(),

      UserAssignmentModel.aggregate([
        {
          $match: {
            companyId: new mongoose.Types.ObjectId(companyId),
          },
        },
        {
          $sort: {
            createdAt: -1,
          },
        },
        {
          $group: {
            _id: "$userId",
            assignment: {
              $first: "$$ROOT",
            },
          },
        },
        {
          $replaceRoot: {
            newRoot: "$assignment",
          },
        },
        {
          $lookup: {
            from: "users", // User collection name
            localField: "userId",
            foreignField: "_id",
            as: "user",
          },
        },
        {
          $unwind: {
            path: "$user",
            preserveNullAndEmptyArrays: true,
          },
        },
        {
          $match: {
            "user.status": {
              $in: [status.ACTIVE, status.INACTIVE],
            },
          },
        },
        {
          $project: {
            userId: 1,
            companyId: 1,
            assignments: 1,
            createdAt: 1,

            "user._id": 1,
            "user.role": 1,
            "user.firstName": 1,
            "user.lastName": 1,
            "user.profileImage": 1,
            "user.status": 1,
          },
        },
      ]),
    ]);

    const branchCountMap = new Map<string, number>();
    const shiftCountMap = new Map<string, number>();
    const departmentCountMap = new Map<string, number>();
    const departmentManagerMap = new Map<string, number>();
    const departmentEmployeeMap = new Map<string, any[]>();

    for (const user of userAssignments) {
      for (const assignment of user.assignments) {
        const manager = user.user.role === "MANAGER";
        const branchKey = assignment.branchId.toString();
        const shiftKey = `${assignment.branchId}_${assignment.shiftId}`;
        const departmentKey = `${assignment.branchId}_${assignment.shiftId}_${assignment.departmentId}`;

        if (manager) {
          //avoid count because only employee count returning
          if (!assignment.isReporting) {
            //For manager exclude reporting data only manged fields for manager data
            departmentManagerMap.set(departmentKey, user.user);
          }
          continue;
        } else {
          if (!departmentEmployeeMap.has(departmentKey)) {
            departmentEmployeeMap.set(departmentKey, []);
          }

          departmentEmployeeMap.get(departmentKey)!.push(user.user);
          branchCountMap.set(
            branchKey,
            (branchCountMap.get(branchKey) || 0) + 1,
          );
          shiftCountMap.set(shiftKey, (shiftCountMap.get(shiftKey) || 0) + 1);
          departmentCountMap.set(
            departmentKey,
            (departmentCountMap.get(departmentKey) || 0) + 1,
          );
        }
      }
    }

    const data = branches
      .map((branch: any) => {
        const branchShifts = shifts
          .filter((shift: any) =>
            shift.branchIds.some(
              (id: any) => id.toString() === branch._id.toString(),
            ),
          )
          .map((shift: any) => {
            const shiftDepartments = departments
              .filter((department: any) =>
                department.assignments.some(
                  (assignment: any) =>
                    assignment.branchId.toString() === branch._id.toString() &&
                    assignment.shiftIds.some(
                      (id: any) => id.toString() === shift._id.toString(),
                    ),
                ),
              )
              .map((department: any) => ({
                _id: department._id,
                name: department.name,
                status: department.status,
                count:
                  departmentCountMap.get(
                    `${branch._id}_${shift._id}_${department._id}`,
                  ) || 0,
                manager: departmentManagerMap.get(
                  `${branch._id}_${shift._id}_${department._id}`,
                ),
                employee:
                  departmentEmployeeMap.get(
                    `${branch._id}_${shift._id}_${department._id}`,
                  ) || [],
              }));

            return {
              _id: shift._id,
              name: shift.name,
              startTime: shift.startTime,
              endTime: shift.endTime,
              breakStartTime: shift.breakStartTime,
              breakEndTime: shift.breakEndTime,
              departments: shiftDepartments,
              status: shift.status,
              count: shiftCountMap.get(`${branch._id}_${shift._id}`) || 0,
            };
          })

        return {
          _id: branch._id,
          name: branch.name,
          shifts: branchShifts,
          address: branch.address,
          status: branch.status,
          branchType: branch.branchType,
          count: branchCountMap.get(branch._id.toString()) || 0,
        };
      })

    return res
      .status(200)
      .json(
        ApiResponse.success(
          data,
          "Branch shift department options fetched successfully",
        ),
      );
  } catch (error) {
    next(error);
  }
};