import { NextFunction, Request, Response } from "express";
import { AttendanceModel } from "../../infrastructure/database/models";
import { ApiResponse } from "../../shared/response/api-response";
import { attendanceType } from "../../types/types";
import { normalizeDate } from "../../shared/helpers/dateHelper";

export const getAttendanceByDate = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { date } = req.query;

    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    if (!date)
      return res.status(400).json(ApiResponse.error("Date is required"));

    const filter: any = {
      companyId: req.user!.companyId,
      attendanceDate: normalizeDate(new Date(date as string)),
    };

    const [result, count] = await Promise.all([
      AttendanceModel.find(filter)
        .populate("userId", "firstName lastName profileImage role status")
        .populate([
          {
            path: "leaveRequestId",
            select: "duration",
            populate: {
              path: "leaveId",
              select: "name",
            },
          },
        ])
        .select(
          "attendanceDate inTime outTime inLocation outLocation inMethod outMethod attendanceStatus isHalfDay totalWorkedMinutes lateMinutes isLate earlyExitMinutes leaveRequestId isManualPunchIn inManualPunchOut",
        )
        .skip(skip)
        .limit(limit)
        .lean(),
      AttendanceModel.countDocuments(filter),
    ]);

    return res.status(200).json(
      ApiResponse.success(
        {
          attendance: result,
          total: count,
        },
        "Attendance fetched successfully",
      ),
    );
  } catch (error) {
    next(error);
  }
};

export const getAttendanceCountByDate = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { date } = req.query;

    if (!date)
      return res.status(400).json(ApiResponse.error("Date is required"));

    const filter: any = {
      companyId: req.user!.companyId,
      attendanceDate: normalizeDate(new Date(date as string)),
    };

    const [present, absent, leave] = await Promise.all([
      AttendanceModel.countDocuments({
        ...filter,
        attendanceStatus: attendanceType.PRESENT,
      }),
      AttendanceModel.countDocuments({
        ...filter,
        attendanceStatus: attendanceType.ABSENT,
      }),
      AttendanceModel.countDocuments({
        ...filter,
        attendanceStatus: attendanceType.LEAVE,
      }),
    ]);

    return res.status(200).json(
      ApiResponse.success(
        {
          total: present + absent + leave,
          present,
          absent,
          leave,
        },
        "Attendance stats fetched successfully",
      ),
    );
  } catch (error) {
    next(error);
  }
};
