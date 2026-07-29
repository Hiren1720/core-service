import { NextFunction, Request, Response } from "express";
import mongoose from "mongoose";
import {
  DepartmentModel,
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

    const [departments, userAssignments] = await Promise.all([
      DepartmentModel.find({
        companyId,
        status: status.ACTIVE,
      })
        .select("_id name assignments")
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
