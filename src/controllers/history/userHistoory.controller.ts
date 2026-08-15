import { NextFunction, Request, Response } from "express";
import { UserHistoryModel } from "../../infrastructure/database/models";
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
