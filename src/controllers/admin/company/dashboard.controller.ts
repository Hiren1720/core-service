import { NextFunction, Request, Response } from "express";
import { status, userStatus } from "../../../types/types";
import {
  BranchModel,
  DepartmentModel,
  ShiftModel,
  UserAssignmentModel,
  UserModel,
} from "../../../infrastructure/database/models";
import { ApiResponse } from "../../../shared/response/api-response";
import mongoose from "mongoose";

export const getEmployeeList = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const companyId = new mongoose.Types.ObjectId(
      req.query.companyId as string,
    );

    // role, branch, shift, department filetr
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 10;

    const skip = (page - 1) * limit;
    const status = req.query.status?.toString();

    const filter: any = {
      companyId,
      status: {
        $in: [userStatus.ACTIVE, userStatus.INACTIVE],
      },
    };

    if (status) {
      filter.status = status;
    }

    const [employee, total] = await Promise.all([
      UserModel.find(filter)
        .select("firstName lastName role profileImage userId status")
        .populate("branchId", "name")
        .populate("shiftId", "name startTime endTime")
        .populate("designationId", "name")
        .populate("departmentId", "name")
        .sort({
          createdAt: -1,
        })
        .skip(skip)
        .limit(limit)
        .lean(),

      UserModel.countDocuments(filter),
    ]);

    const [active, inactive] = await Promise.all([
      UserModel.countDocuments({
        ...filter,
        status: userStatus.ACTIVE,
        role: { $ne: "OWNER" },
      }),
      UserModel.countDocuments({ ...filter, status: userStatus.INACTIVE }),
    ]);

    return res.status(200).json(
      ApiResponse.success(
        {
          employee,
          total,
          stats: {
            total: active + inactive,
            active,
            inactive,
          },
        },
        "Employee fetched successfully",
      ),
    );
  } catch (error) {
    next(error);
  }
};

export const getBranchShiftDepartmentList = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const companyId = req.query.companyId as string;

    if (!companyId) {
      return res.status(400).json(ApiResponse.error("Company ID is required"));
    }

    const companyObjectId = new mongoose.Types.ObjectId(companyId);

    const [branches, shifts, departments, users] = await Promise.all([
      // Branches
      BranchModel.find({
        companyId: companyObjectId,
        status: { $ne: status.DELETED },
      })
        .select("_id name address")
        .lean(),

      // Shifts
      ShiftModel.find({
        companyId: companyObjectId,
        status: { $ne: status.DELETED },
      })
        .select("_id name branchIds")
        .lean(),

      // Departments
      DepartmentModel.find({
        companyId: companyObjectId,
        status: { $ne: status.DELETED },
      })
        .select("_id name assignments")
        .lean(),

      UserModel.find({
        companyId: companyObjectId,
        role: { $ne: "OWNER" },
        status: { $ne: userStatus.DELETED },
      })
        .select("branchId")
        .lean(),
    ]);

    const data = branches.map((branch: any) => {
      const count = users.filter(
        (user) => user.branchId?.toString() === branch._id.toString(),
      ).length;
      const branchShifts = shifts
        .filter((shift: any) =>
          shift.branchIds?.some(
            (branchId: any) => branchId.toString() === branch._id.toString(),
          ),
        )
        .map((shift: any) => {
          const shiftDepartments = departments
            .filter((department: any) =>
              department.assignments?.some(
                (assignment: any) =>
                  assignment.branchId?.toString() === branch._id.toString() &&
                  assignment.shiftIds?.some(
                    (shiftId: any) =>
                      shiftId.toString() === shift._id.toString(),
                  ),
              ),
            )
            .map((department: any) => ({
              _id: department._id,
              name: department.name,
            }));

          return {
            _id: shift._id,
            name: shift.name,
            departments: shiftDepartments,
          };
        });

      return {
        _id: branch._id,
        name: branch.name,
        address: branch.address,
        shifts: branchShifts,
        count,
      };
    });

    return res.status(200).json(
      ApiResponse.success(
        {
          list: data,
        },
        "Branch shift department options fetched successfully",
      ),
    );
  } catch (error) {
    next(error);
  }
};
