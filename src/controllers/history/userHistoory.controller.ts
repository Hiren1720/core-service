import { NextFunction, Request, Response } from "express";
import {
  UserAssignmentModel,
  UserHistoryModel,
} from "../../infrastructure/database/models";
import { ApiResponse } from "../../shared/response/api-response";

export const getUserHistoryByType = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { field, fieldId } = req.query;

    const query: any = {
      field,
      fieldId,
    };
    if (field === "designation") {
      delete query.fieldId;
      query.userId = fieldId;
    }
    const data = await UserHistoryModel.find(query)
      .populate("assignedBy", "firstName lastName profileImage")
      .sort({ createdAt: -1 })
      .lean();

    return res
      .status(200)
      .json(ApiResponse.success(data, "History fetch successfully"));
  } catch (err) {
    next(err);
  }
};

export const getUserAssignmentHistory = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { userId } = req.query;

    const data = await UserAssignmentModel.find({ userId: userId as string })
      .populate("assignments.branchId", "name")
      .populate(
        "assignments.shiftId",
        "name startTime endTime breakStartTime breakEndTime",
      )
      .populate("assignments.assignedBy", "firstName lastName profileImage")
      .populate(
        "assignments.reportingManagerId",
        "firstName, lastName, profileImage",
      )
      .populate("assignments.departmentId", "name")
      .select("assignments createdAt")
      .sort({ createdAt: -1 })
      .lean();

    return res
      .status(200)
      .json(ApiResponse.success(data, "History fetch successfully"));
  } catch (err) {
    next(err);
  }
};
