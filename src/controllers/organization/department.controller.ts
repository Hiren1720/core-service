import { NextFunction, Response, Request } from "express";
import {
  BranchModel,
  DepartmentModel,
  ShiftModel,
  UserModel,
} from "../../infrastructure/database/models";
import { ApiResponse } from "../../shared/response/api-response";
import { status } from "../../types/types";
import { addUserHistory } from "../../shared/services/userHistory.service";
import { downloadCsv } from "../../shared/utils/csvDownload";

export const createDepartment = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { name, assignments } = req.body;

    const existing = await DepartmentModel.findOne({
      companyId: req.user!.companyId,
      name,
    });

    if (existing) {
      return res
        .status(400)
        .json(ApiResponse.error("Department already exists"));
    }

    const department = await DepartmentModel.create({
      companyId: req.user!.companyId,
      name,
      assignments,
    });

    await addUserHistory({
      userId: req.user!.id as string,
      field: "departmentStatus",
      fieldId: department._id.toString(),
      fieldValue: status.ACTIVE,
      remarks: "",
      assignedBy: req.user!.id as string,
    });

    return res
      .status(201)
      .json(ApiResponse.success(department, "Department created successfully"));
  } catch (error) {
    next(error);
  }
};

export const getDepartments = async (
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

    const departmentQ = DepartmentModel.find(filter)
      .sort({
        createdAt: -1,
      })
      .lean();

    if (!isDownload) {
      departmentQ.skip(skip).limit(limit);
    } else {
      departmentQ
        .populate({
          path: "assignments.branchId",
          select: "name",
        })
        .populate({
          path: "assignments.shiftIds",
          select: "name",
        });
    }

    const [departments, total] = await Promise.all([
      departmentQ,
      DepartmentModel.countDocuments(filter),
    ]);

    if (isDownload) {
      const data = departments.map((department) => ({
        Name: department.name,
        Status: department.status,
        Assignments: department.assignments
          .map((assign: any) => {
            const branchName = assign.branchId?.name || "";

            const shifts =
              assign.shiftIds?.length > 0
                ? `(${assign.shiftIds.map((shift: any) => shift.name).join(", ")})`
                : "";

            return `${branchName} ${shifts}`.trim();
          })
          .join(", "),
      }));

      return downloadCsv(res, data, "department", csvPassword);
    }

    return res.status(200).json(
      ApiResponse.success(
        {
          departments,
          total,
        },
        "Departments fetched successfully",
      ),
    );
  } catch (error) {
    next(error);
  }
};

export const getDepartmentById = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const department = await DepartmentModel.findOne({
      _id: req.params.departmentId,
      companyId: req.user!.companyId,
    })
      .populate("assignments.branchId", "name address")
      .populate("assignments.shiftIds", "name startTime endTime");

    if (!department) {
      return res.status(404).json(ApiResponse.error("Department not found"));
    }

    return res
      .status(200)
      .json(ApiResponse.success(department, "Department fetched successfully"));
  } catch (error) {
    next(error);
  }
};

export const updateDepartment = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const department = await DepartmentModel.findOne({
      _id: req.params.departmentId,
      companyId: req.user!.companyId,
    });

    if (!department) {
      return res.status(404).json(ApiResponse.error("Department not found"));
    }

    const { name, assignments } = req.body;

    if (name !== undefined) department.name = name;

    if (assignments !== undefined) department.assignments = assignments;

    await department.save();

    return res
      .status(200)
      .json(ApiResponse.success(department, "Department updated successfully"));
  } catch (error) {
    next(error);
  }
};

export const updateDepartmentStatus = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { status, remarks } = req.body;
    const assignedBy = req.user!.id;

    const department = await DepartmentModel.findOne({
      _id: req.params.departmentId,
      companyId: req.user!.companyId,
    });

    if (!department) {
      return res.status(404).json(ApiResponse.error("Department not found"));
    }

    if (status !== "ACTIVE") {
      const userCount = await UserModel.countDocuments({
        departmentId: department._id,
        companyId: req.user!.companyId,
      });
      if (userCount > 0) {
        return res
          .status(400)
          .json(
            ApiResponse.error(
              `Cannot update status. Users(${userCount}) are assigned to this department.`,
            ),
          );
      }
    }

    department.status = status;

    await addUserHistory({
      userId: req.user!.id as string,
      field: "departmentStatus",
      fieldId: department._id.toString(),
      fieldValue: status,
      remarks,
      assignedBy,
    });
    await department.save();

    return res
      .status(200)
      .json(ApiResponse.success(null, "Status updated successfully"));
  } catch (error) {
    next(error);
  }
};

export const getBranchShiftOptions = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const companyId = req.user!.companyId;

    const [branches, shifts] = await Promise.all([
      BranchModel.find({
        companyId,
        status: "ACTIVE" as status,
      })
        .select("name address branchType")
        .lean(),

      ShiftModel.find({
        companyId,
        status: "ACTIVE" as status,
      })
        .select("name branchIds startTime endTime")
        .lean(),
    ]);

    const data = branches.map((branch: any) => ({
      _id: branch._id,
      name: branch.name,
      address: branch.address,
      branchType: branch.branchType,

      shifts: shifts
        .filter((shift: any) =>
          shift.branchIds.some(
            (branchId: any) => branchId.toString() === branch._id.toString(),
          ),
        )
        .map((shift: any) => ({
          _id: shift._id,
          name: shift.name,
          startTime: shift.startTime,
          endTime: shift.endTime,
        })),
    }));

    return res
      .status(200)
      .json(
        ApiResponse.success(data, "Branch shift options fetched successfully"),
      );
  } catch (error) {
    next(error);
  }
};
