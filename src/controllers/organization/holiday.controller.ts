import { NextFunction, Request, Response } from "express";
import { HolidayModel } from "../../infrastructure/database/models";
import { ApiResponse } from "../../shared/response/api-response";
import { status } from "../../types/types";
import { addUserHistory } from "../../shared/services/userHistory.service";
import { normalizeDate } from "../../shared/helpers/dateHelper";
import { downloadCsv } from "../../shared/utils/csvDownload";

export const createHoliday = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { name, description, effectiveYear, startDate, endDate } = req.body;

    const holiday = await HolidayModel.create({
      companyId: req.user!.companyId,
      name,
      startDate: normalizeDate(startDate),
      endDate: normalizeDate(endDate),
      description,
      effectiveYear,
    });

    await addUserHistory({
      userId: req.user!.id as string,
      field: "holidayStatus",
      fieldId: holiday._id.toString(),
      fieldValue: status.ACTIVE,
      remarks: "",
      assignedBy: req.user!.id as string,
    });

    return res
      .status(201)
      .json(ApiResponse.success(holiday, "Holiday created successfully"));
  } catch (error) {
    next(error);
  }
};

export const getHolidays = async (
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

    const effectiveYear =
      req.query.effectiveYear ?? Number(req.query.effectiveYear);

    const filter: any = {
      companyId: req.user!.companyId,
    };

    if (search) {
      filter.name = {
        $regex: search,
        $options: "i",
      };
    }

    if (effectiveYear) {
      filter.effectiveYear = effectiveYear;
    }

    if (status) {
      filter.status = status;
    } else {
      filter.status = { $ne: "DELETED" as status };
    }

    const holidayQuery = HolidayModel.find(filter)
      .sort({
        createdAt: -1,
      })
      .skip(skip)
      .limit(limit)
      .lean();

    if (!isDownload) {
      holidayQuery.skip(skip).limit(limit);
    }

    const [holidays, total] = await Promise.all([
      holidayQuery,
      HolidayModel.countDocuments(filter),
    ]);

    if (isDownload) {
      const data = holidays.map((holiday) => ({
        Name: holiday.name,
        Address: holiday.description,
        Status: holiday.status,
        EffectiveYear: holiday.effectiveYear,
        StartDate: holiday.startDate.toLocaleDateString(),
        EndDate: holiday.endDate.toLocaleDateString(),
      }));

      return downloadCsv(res, data, "holiday", csvPassword);
    }
    return res.status(200).json(
      ApiResponse.success(
        {
          holidays,
          total,
        },
        "Holidays fetched successfully",
      ),
    );
  } catch (error) {
    next(error);
  }
};

export const getHolidaysCount = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const filter: any = {
      companyId: req.user!.companyId,
    };

    const effectiveYear =
      req.query.effectiveYear ?? Number(req.query.effectiveYear);

    if (effectiveYear) {
      filter.effectiveYear = effectiveYear;
    }

    const [active, inactive] = await Promise.all([
      HolidayModel.countDocuments({ ...filter, status: "ACTIVE" as status }),
      HolidayModel.countDocuments({ ...filter, status: "INACTIVE" as status }),
      HolidayModel.countDocuments({ ...filter, status: "DELETED" as status }),
    ]);

    return res.status(200).json(
      ApiResponse.success(
        {
          total: active + inactive,
          active,
          inactive,
        },
        "Holiday counts fetched successfully",
      ),
    );
  } catch (error) {
    next(error);
  }
};

export const getHolidayById = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const holiday = await HolidayModel.findOne({
      _id: req.params.holidayId,
      companyId: req.user!.companyId,
    });

    if (!holiday) {
      return res.status(404).json(ApiResponse.error("Holiday not found"));
    }

    return res
      .status(200)
      .json(ApiResponse.success(holiday, "Holiday fetched successfully"));
  } catch (error) {
    next(error);
  }
};

export const updateHoliday = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const holiday = await HolidayModel.findOne({
      _id: req.params.holidayId,
      companyId: req.user!.companyId,
    });

    if (!holiday) {
      return res.status(404).json(ApiResponse.error("Holiday not found"));
    }

    const { name, startDate, endDate, description, effectiveYear } = req.body;

    if (name !== undefined) holiday.name = name;

    if (startDate !== undefined) holiday.startDate = normalizeDate(startDate);

    if (endDate !== undefined) holiday.endDate = normalizeDate(endDate);

    if (description !== undefined) holiday.description = description;

    if (effectiveYear !== undefined) holiday.effectiveYear = effectiveYear;

    await holiday.save();

    return res
      .status(200)
      .json(ApiResponse.success(null, "Holiday updated successfully"));
  } catch (error) {
    next(error);
  }
};

export const updateHolidayStatus = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { status, remarks } = req.body;
    const assignedBy = req.user!.id;

    const holiday = await HolidayModel.findOne({
      _id: req.params.holidayId,
      companyId: req.user!.companyId,
    });

    if (!holiday) {
      return res.status(404).json(ApiResponse.error("Holiday not found"));
    }

    holiday.status = status;

    await addUserHistory({
      userId: req.user!.id as string,
      field: "holidayStatus",
      fieldId: holiday._id.toString(),
      fieldValue: status,
      remarks,
      assignedBy,
    });
    await holiday.save();

    return res
      .status(200)
      .json(ApiResponse.success(null, "Status updated successfully"));
  } catch (error) {
    next(error);
  }
};
