import { NextFunction, Request, Response } from "express";
import { ApiResponse } from "../../shared/response/api-response";
import { LeaveModel } from "../../infrastructure/database/models";
import { status } from "../../types/types";
import { addUserHistory } from "../../shared/services/userHistory.service";
import { downloadCsv } from "../../shared/utils/csvDownload";

export const createLeave = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { name, description, isPaid } = req.body;

    const leave = await LeaveModel.create({
      companyId: req.user!.companyId,
      name,
      description,
      isPaid,
    });

    await addUserHistory({
      userId: req.user!.id as string,
      field: "leaveStatus",
      fieldId: leave._id.toString(),
      fieldValue: status.ACTIVE,
      remarks: "",
      assignedBy: req.user!.id as string,
    });

    return res
      .status(201)
      .json(ApiResponse.success(leave, "Leave created successfully"));
  } catch (error) {
    next(error);
  }
};

export const getLeaves = async (
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

    const leaveQuery = LeaveModel.find(filter)
      .sort({
        createdAt: -1,
      })
      .lean();

    if (!isDownload) {
      leaveQuery.skip(skip).limit(limit);
    }

    const [leaves, total] = await Promise.all([
      leaveQuery,
      LeaveModel.countDocuments(filter),
    ]);

    if (isDownload) {
      const data = leaves.map((leave) => ({
        Name: leave.name,
        Address: leave.description,
        Status: leave.status,
        Paid: leave.isPaid.toString(),
      }));

      return downloadCsv(res, data, "leave");
    }
    
    return res.status(200).json(
      ApiResponse.success(
        {
          leaves,
          total,
        },
        "Leaves fetched successfully",
      ),
    );
  } catch (error) {
    next(error);
  }
};

export const getLeavesCount = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const filter: any = {
      companyId: req.user!.companyId,
    };

    const [active, inactive] = await Promise.all([
      LeaveModel.countDocuments({ ...filter, status: "ACTIVE" as status }),
      LeaveModel.countDocuments({ ...filter, status: "INACTIVE" as status }),
      // LeaveModel.countDocuments({ ...filter, status: "DELETED" as status }),
    ]);

    return res.status(200).json(
      ApiResponse.success(
        {
          total: active + inactive,
          active,
          inactive,
          // deleted,
        },
        "Leave counts fetched successfully",
      ),
    );
  } catch (error) {
    next(error);
  }
};

export const getLeaveById = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const leave = await LeaveModel.findOne({
      _id: req.params.leaveId,
      companyId: req.user!.companyId,
    });

    if (!leave) {
      return res.status(404).json(ApiResponse.error("Leave not found"));
    }

    return res
      .status(200)
      .json(ApiResponse.success(leave, "Leave fetched successfully"));
  } catch (error) {
    next(error);
  }
};

export const updateLeave = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const leave = await LeaveModel.findOne({
      _id: req.params.leaveId,
      companyId: req.user!.companyId,
    });

    if (!leave) {
      return res.status(404).json(ApiResponse.error("Leave not found"));
    }

    const { name, description, isPaid } = req.body;

    if (name !== undefined) leave.name = name;

    if (description !== undefined) leave.description = description;

    if (isPaid !== undefined) leave.isPaid = isPaid;

    await leave.save();

    return res
      .status(200)
      .json(ApiResponse.success(null, "Leave updated successfully"));
  } catch (error) {
    next(error);
  }
};

export const updateLeaveStatus = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { status, remarks } = req.body;
    const assignedBy = req.user!.id;

    const leave = await LeaveModel.findOne({
      _id: req.params.leaveId,
      companyId: req.user!.companyId,
    });

    if (!leave) {
      return res.status(404).json(ApiResponse.error("Leave not found"));
    }

    leave.status = status;

    await addUserHistory({
      userId: req.user!.id as string,
      field: "leaveStatus",
      fieldId: leave._id.toString(),
      fieldValue: status,
      remarks,
      assignedBy,
    });
    await leave.save();

    return res
      .status(200)
      .json(ApiResponse.success(null, "Status updated successfully"));
  } catch (error) {
    next(error);
  }
};
