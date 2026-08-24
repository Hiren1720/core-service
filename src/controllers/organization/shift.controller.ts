import { NextFunction, Request, Response } from "express";
import { ShiftModel, UserModel } from "../../infrastructure/database/models";
import { ApiResponse } from "../../shared/response/api-response";
import { addUserHistory } from "../../shared/services/userHistory.service";
import { status } from "../../types/types";
import { downloadCsv } from "../../shared/utils/csvDownload";
import { getTimeDifferenceInMinutes } from "../../shared/helpers/dateHelper";

export const createShift = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const {
      name,
      startTime,
      endTime,
      breakStartTime,
      breakEndTime,
      branchIds,
    } = req.body;

    const shift = await ShiftModel.create({
      companyId: req.user!.companyId,

      name,
      startTime,
      endTime,
      breakStartTime,
      breakEndTime,
      branchIds,
      minutes: getTimeDifferenceInMinutes(startTime, endTime),
    });

    await addUserHistory({
      userId: req.user!.id as string,
      field: "shiftStatus",
      fieldId: shift._id.toString(),
      fieldValue: status.ACTIVE,
      remarks: "",
      assignedBy: req.user!.id as string,
    });
    return res
      .status(201)
      .json(ApiResponse.success(shift, "Shift created successfully"));
  } catch (error) {
    next(error);
  }
};

export const getShifts = async (
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
    const isDownload = req.query.isDownload === "true";
    const csvPassword = req.query.csvPassword  ? String(req.query.csvPassword) : undefined;

    const filter: any = {
      companyId: req.user!.companyId,
    };

    if (search) {
      filter.name = {
        $regex: search,
        $options: "i",
      };
    }

    if (status) {
      filter.status = status;
    } else {
      filter.status = { $ne: "DELETED" as status };
    }

    const shifyQuery = ShiftModel.find(filter)
      .populate("branchIds", "name")
      .sort({
        createdAt: -1,
      })
      .lean();

    if (!isDownload) {
      shifyQuery.skip(skip).limit(limit);
    }

    const [shifts, total] = await Promise.all([
      ShiftModel.find(filter)
        .populate("branchIds", "name")
        .sort({
          createdAt: -1,
        })
        .skip(skip)
        .limit(limit)
        .lean(),

      ShiftModel.countDocuments(filter),
    ]);

    if (isDownload) {
      const data = shifts.map((shift) => ({
        Name: shift.name,
        StartTime: shift.startTime,
        EndTime: shift.endTime,
        BreakStartTime: shift.breakStartTime,
        BreakEndTime: shift.breakEndTime,
        Status: shift.status,
        Branch: shift.branchIds.map((b: any) => b.name).join(", "),
      }));

      return downloadCsv(res, data, "shift", csvPassword);
    }

    return res.status(200).json(
      ApiResponse.success(
        {
          shifts,
          total,
        },
        "Shifts fetched successfully",
      ),
    );
  } catch (error) {
    next(error);
  }
};

export const getShiftById = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const shift = await ShiftModel.findOne({
      _id: req.params.shiftId,
      companyId: req.user!.companyId,
    }).populate("branchIds", "name");

    if (!shift) {
      return res.status(404).json(ApiResponse.error("Shift not found"));
    }

    return res
      .status(200)
      .json(ApiResponse.success(shift, "Shift fetched successfully"));
  } catch (error) {
    next(error);
  }
};

export const updateShift = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const shift = await ShiftModel.findOne({
      _id: req.params.shiftId,
      companyId: req.user!.companyId,
    });

    if (!shift) {
      return res.status(404).json(ApiResponse.error("Shift not found"));
    }

    const {
      name,
      startTime,
      endTime,
      breakStartTime,
      breakEndTime,
      branchIds,
    } = req.body;

    if (name !== undefined) shift.name = name;

    if (startTime !== undefined) shift.startTime = startTime;

    if (endTime !== undefined) shift.endTime = endTime;

    if (breakStartTime !== undefined) shift.breakStartTime = breakStartTime;

    if (breakEndTime !== undefined) shift.breakEndTime = breakEndTime;

    if (branchIds !== undefined) shift.branchIds = branchIds;
    shift.minutes = getTimeDifferenceInMinutes(startTime, endTime);

    await shift.save();

    return res
      .status(200)
      .json(ApiResponse.success(null, "Shift updated successfully"));
  } catch (error) {
    next(error);
  }
};

export const updateShiftStatus = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { status, remarks } = req.body;
    const assignedBy = req.user!.id;

    const shift = await ShiftModel.findOne({
      _id: req.params.shiftId,
      companyId: req.user!.companyId,
    });

    if (!shift) {
      return res.status(404).json(ApiResponse.error("Shift not found"));
    }

    if (status !== "ACTIVE") {
      const userCount = await UserModel.countDocuments({
        shiftId: shift._id,
        companyId: req.user!.companyId,
      });
      if (userCount > 0) {
        return res
          .status(400)
          .json(
            ApiResponse.error(
              `Cannot update status. Users(${userCount}) are assigned to this shift.`,
            ),
          );
      }
    }

    shift.status = status;

    await addUserHistory({
      userId: req.user!.id as string,
      field: "shiftStatus",
      fieldId: shift._id.toString(),
      fieldValue: status,
      remarks,
      assignedBy,
    });
    await shift.save();

    return res
      .status(200)
      .json(ApiResponse.success(null, "Status updated successfully"));
  } catch (error) {
    next(error);
  }
};
