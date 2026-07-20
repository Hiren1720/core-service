import { NextFunction, Request, Response } from "express";
import { TerminationModel } from "../../infrastructure/database/models";
import { ApiResponse } from "../../shared/response/api-response";
import { addUserHistory } from "../../shared/services/userHistory.service";
import { terminationStatus } from "../../types/types";

export const createTermination = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { userId, terminationType, lastWorkingDate, reason } = req.body;

    const termination = await TerminationModel.create({
      companyId: req.user!.companyId,
      userId,
      terminationType,
      lastWorkingDate,
      reason,
    });

    return res
      .status(201)
      .json(
        ApiResponse.success(termination, "Termination created successfully"),
      );
  } catch (error) {
    next(error);
  }
};

export const getTerminations = async (
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

    const [terminations, total] = await Promise.all([
      TerminationModel.find(filter)
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

      TerminationModel.countDocuments(filter),
    ]);

    return res.status(200).json(
      ApiResponse.success(
        {
          terminations,
          total,
        },
        "Terminations fetched successfully",
      ),
    );
  } catch (error) {
    next(error);
  }
};

export const getTerminationCount = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const filter: any = {
      companyId: req.user!.companyId,
    };

    const [terminate, hold, cancel] = await Promise.all([
      TerminationModel.countDocuments({
        ...filter,
        status: "TERMINATE" as terminationStatus,
      }),
      TerminationModel.countDocuments({
        ...filter,
        status: "HOLD" as terminationStatus,
      }),
      TerminationModel.countDocuments({
        ...filter,
        status: "CANCEL" as terminationStatus,
      }),
    ]);

    return res.status(200).json(
      ApiResponse.success(
        {
          total: terminate + hold + cancel,
          terminate,
          hold,
          cancel,
        },
        "Termination counts fetched successfully",
      ),
    );
  } catch (error) {
    next(error);
  }
};

export const getTerminationById = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const termination = await TerminationModel.findOne({
      _id: req.params.terminationId,
      companyId: req.user!.companyId,
    }).populate("userId", "firstName lastName role profileImage");

    if (!termination) {
      return res.status(404).json(ApiResponse.error("Termination not found"));
    }

    return res
      .status(200)
      .json(
        ApiResponse.success(termination, "Termination fetched successfully"),
      );
  } catch (error) {
    next(error);
  }
};

export const updateTermination = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const termination = await TerminationModel.findOne({
      _id: req.params.terminationId,
      companyId: req.user!.companyId,
    });

    if (!termination) {
      return res.status(404).json(ApiResponse.error("Termination not found"));
    }

    const { userId, terminationType, lastWorkingDate, reason } = req.body;

    if (userId !== undefined) termination.userId = userId;

    if (terminationType !== undefined)
      termination.terminationType = terminationType;

    if (lastWorkingDate !== undefined)
      termination.lastWorkingDate = lastWorkingDate;

    if (reason !== undefined) termination.reason = reason;

    await termination.save();

    return res
      .status(200)
      .json(ApiResponse.success(null, "Termination updated successfully"));
  } catch (error) {
    next(error);
  }
};

export const updateTerminationStatus = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { status, remarks } = req.body;
    const assignedBy = req.user!.id;

    const termination = await TerminationModel.findOne({
      _id: req.params.terminationId,
      companyId: req.user!.companyId,
    });

    if (!termination) {
      return res.status(404).json(ApiResponse.error("Termination not found"));
    }

    termination.status = status;

    await addUserHistory({
      userId: req.user!.id as string,
      field: "terminationStatus",
      fieldValue: status,
      remarks,
      assignedBy,
    });
    await termination.save();

    return res
      .status(200)
      .json(ApiResponse.success(null, "Status updated successfully"));
  } catch (error) {
    next(error);
  }
};
