import { NextFunction, Request, Response } from "express";
import { ResignationModel } from "../../infrastructure/database/models";
import { ApiResponse } from "../../shared/response/api-response";
import { addUserHistory } from "../../shared/services/userHistory.service";
import { resignationStatus } from "../../types/types";

export const createResignation = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { userId, lastWorkingDate, reason } = req.body;

    const resignation = await ResignationModel.create({
      companyId: req.user!.companyId,
      userId,
      lastWorkingDate,
      reason,
    });

    return res
      .status(201)
      .json(
        ApiResponse.success(resignation, "Resignation created successfully"),
      );
  } catch (error) {
    next(error);
  }
};

export const getResignations = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const page = Number(req.query.page) || 1;

    const limit = Number(req.query.limit) || 10;

    const skip = (page - 1) * limit;

    const search = req.query.search?.toString() || "";

    const status = req.query.status?.toString();

    const filter: any = {
      companyId: req.user!.companyId,
    };

    // if (search) {
    //   filter.name = {
    //     $regex: search,
    //     $options: "i",
    //   };
    // }

    if (status) {
      filter.status = status;
    }

    const [resignations, total] = await Promise.all([
      ResignationModel.find(filter)
        .populate({
          path: "userId",
          select: "firstName lastName role profileImage departmentId",
          populate: {
            path: "departmentId",
            select: "name",
          },
        })
        .sort({
          createdAt: -1,
        })
        .skip(skip)
        .limit(limit)
        .lean(),

      ResignationModel.countDocuments(filter),
    ]);

    return res.status(200).json(
      ApiResponse.success(
        {
          resignations,
          total,
        },
        "Resignations fetched successfully",
      ),
    );
  } catch (error) {
    next(error);
  }
};

export const getResignationCount = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const filter: any = {
      companyId: req.user!.companyId,
    };

    const [pending, accept, reject] = await Promise.all([
      ResignationModel.countDocuments({
        ...filter,
        status: "PENDING" as resignationStatus,
      }),
      ResignationModel.countDocuments({
        ...filter,
        status: "ACCEPTED" as resignationStatus,
      }),
      ResignationModel.countDocuments({
        ...filter,
        status: "REJECTED" as resignationStatus,
      }),
    ]);

    return res.status(200).json(
      ApiResponse.success(
        {
          total: pending + accept + reject,
          pending,
          accept,
          reject,
        },
        "Resignation counts fetched successfully",
      ),
    );
  } catch (error) {
    next(error);
  }
};

export const getResignationById = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const resignation = await ResignationModel.findOne({
      _id: req.params.resignationId,
      companyId: req.user!.companyId,
    }).populate("userId", "firstName lastName role profileImage");

    if (!resignation) {
      return res.status(404).json(ApiResponse.error("Resignation not found"));
    }

    return res
      .status(200)
      .json(
        ApiResponse.success(resignation, "Resignation fetched successfully"),
      );
  } catch (error) {
    next(error);
  }
};

export const updateResignation = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const resignation = await ResignationModel.findOne({
      _id: req.params.resignationId,
      companyId: req.user!.companyId,
    });

    if (!resignation) {
      return res.status(404).json(ApiResponse.error("Resignation not found"));
    }

    const { userId, resignationType, lastWorkingDate, reason } = req.body;

    if (userId !== undefined) resignation.userId = userId;

    if (lastWorkingDate !== undefined)
      resignation.lastWorkingDate = lastWorkingDate;

    if (reason !== undefined) resignation.reason = reason;

    await resignation.save();

    return res
      .status(200)
      .json(ApiResponse.success(null, "Resignation updated successfully"));
  } catch (error) {
    next(error);
  }
};

export const updateResignationStatus = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { status, remarks } = req.body;
    const assignedBy = req.user!.id;

    const resignation = await ResignationModel.findOne({
      _id: req.params.resignationId,
      companyId: req.user!.companyId,
    });

    if (!resignation) {
      return res.status(404).json(ApiResponse.error("Resignation not found"));
    }

    resignation.status = status;

    await addUserHistory({
      userId: req.user!.id as string,
      field: "resignationStatus",
      fieldValue: status,
      remarks,
      assignedBy,
    });
    await resignation.save();

    return res
      .status(200)
      .json(ApiResponse.success(null, "Status updated successfully"));
  } catch (error) {
    next(error);
  }
};
