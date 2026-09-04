import { NextFunction, Request, Response } from "express";
import { AttendanceModel } from "../../infrastructure/database/models";
import { ApiResponse } from "../../shared/response/api-response";
import { attendanceType } from "../../types/types";
import { normalizeDate } from "../../shared/helpers/dateHelper";
import { getMyManagedUserIdList } from "../../shared/services/users.service";

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
        .populate("userId", "firstName lastName profileImage role status userId")
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
          "attendanceDate inTime outTime inLocation outLocation inMethod outMethod attendanceStatus isHalfDay totalWorkedMinutes lateMinutes isLate earlyExitMinutes leaveRequestId isManualPunchIn isManualPunchOut",
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

export const getManualPunchList = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { role, id } = req.user!;
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 10;
    const { month, year } = req.query;

    const skip = (page - 1) * limit;
    const monthNumber = Number(month);
    const yearNumber = Number(year);

    if (monthNumber < 1 || monthNumber > 12 || !yearNumber) {
      return res.status(400).json({
        message: "Invalid month or year",
      });
    }

    const startDate = new Date(yearNumber, monthNumber - 1, 1);
    const endDate = new Date(yearNumber, monthNumber, 0);
    endDate.setHours(23, 59, 59, 999);

    const filter: any = {
      companyId: req.user!.companyId,
      attendanceDate: {
        $gte: startDate,
        $lte: endDate,
      },
      $or: [{ isManualPunchIn: true, isManualPunchOut: true }],
    };

    if (role === "EMPLOYEE") {
      filter.userId = id;
    } else if (role === "MANAGER") {
      const userIds = await getMyManagedUserIdList(id);
      filter.userId = { $in: [...userIds, id] };
    }

    const [list, count] = await Promise.all([
      AttendanceModel.find(filter)
        .populate("userId", "firstName lastName role profileImage userId")
        .select(
          "attendanceDate inTime outTime  attendanceStatus  totalWorkedMinutes  isManualPunchIn isManualPunchOut updatedAt",
        )
        .skip(skip)
        .limit(limit)
        .lean(),
      AttendanceModel.countDocuments(filter),
    ]);

    return res.status(200).json(
      ApiResponse.success(
        {
          list,
          total: count,
        },
        "Leave applications fetched successfully",
      ),
    );
  } catch (error) {
    next(error);
  }
};

export const rejectAttendance = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { attendanceId } = req.params;

    const attendance = await AttendanceModel.findById(attendanceId);
    if (!attendance) {
      return res.status(404).json(ApiResponse.error("Attendance not found"));
    }
    await AttendanceModel.findByIdAndUpdate(attendanceId, {
      $set: { attendanceStatus: attendanceType.REJECTED },
    });

    return res
      .status(200)
      .json(ApiResponse.success(null, "Attendance rejected successfully"));
  } catch (error) {
    next(error);
  }
};
