import { NextFunction, Request, Response } from "express";
import {
  BranchModel,
  UserAssignmentModel,
  UserModel,
} from "../../infrastructure/database/models";
import { status } from "../../types/types";
import { ApiResponse } from "../../shared/response/api-response";
import { addUserHistory } from "../../shared/services/userHistory.service";

export const createBranch = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { name, address, shiftApplicable, branchType } = req.body;

    const companyId = req.user!.companyId;

    if (branchType === "HEAD_OFFICE") {
      const headOffice = await BranchModel.findOne({
        companyId,
        branchType: "HEAD_OFFICE",
        status: {
          $ne: "DELETED" as status,
        },
      });

      if (headOffice) {
        return res
          .status(400)
          .json(ApiResponse.error("Head office already exists"));
      }
    }

    const branch = await BranchModel.create({
      companyId,
      name,
      address,
      shiftApplicable,
      branchType,
    });

    await addUserHistory({
      userId: req.user!.id as string,
      field: "branchStatus",
      fieldId: branch._id.toString(),
      fieldValue: status.ACTIVE,
      remarks: "",
      assignedBy: req.user!.id as string,
    });

    return res
      .status(201)
      .json(ApiResponse.success(branch, "Branch created successfully"));
  } catch (error) {
    next(error);
  }
};

export const getBranches = async (
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

    const [branches, total] = await Promise.all([
      BranchModel.find(filter)
        .sort({
          createdAt: -1,
        })
        .skip(skip)
        .limit(limit)
        .lean(),

      BranchModel.countDocuments(filter),
    ]);

    return res.status(200).json(
      ApiResponse.success(
        {
          branches,
          total,
        },
        "Branches fetched successfully",
      ),
    );
  } catch (error) {
    next(error);
  }
};

export const getBranchById = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const branch = await BranchModel.findOne({
      _id: req.params.branchId,
      companyId: req.user!.companyId,
    });

    if (!branch) {
      return res.status(404).json(ApiResponse.error("Branch not found"));
    }

    return res
      .status(200)
      .json(ApiResponse.success(branch, "Branch fetched successfully"));
  } catch (error) {
    next(error);
  }
};

export const updateBranch = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const branch = await BranchModel.findOne({
      _id: req.params.branchId,
      companyId: req.user!.companyId,
    });

    if (!branch) {
      return res.status(404).json(ApiResponse.error("Branch not found"));
    }

    const { name, address, shiftApplicable, branchType } = req.body;

    if (name !== undefined) branch.name = name;

    if (address !== undefined) branch.address = address;

    if (shiftApplicable !== undefined) branch.shiftApplicable = shiftApplicable;

    if (branchType === "HEAD_OFFICE") {
      const headOffice = await BranchModel.findOne({
        _id: { $ne: req.params.branchId },
        companyId: branch.companyId,
        branchType: "HEAD_OFFICE",
        status: {
          $ne: "DELETED" as status,
        },
      });

      if (headOffice) {
        return res
          .status(400)
          .json(ApiResponse.error("Head office already exists"));
      }
      branch.branchType = branchType;
    }

    await branch.save();

    return res
      .status(200)
      .json(ApiResponse.success(branch, "Branch updated successfully"));
  } catch (error) {
    next(error);
  }
};

export const updateBranchStatus = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { status, remarks } = req.body;
    const assignedBy = req.user!.id;

    const branch = await BranchModel.findOne({
      _id: req.params.branchId,
      companyId: req.user!.companyId,
    });

    if (!branch) {
      return res.status(404).json(ApiResponse.error("Branch not found"));
    }

    if (status !== "ACTIVE") {
      const userCount = await UserModel.countDocuments({
        branchId: branch._id,
        companyId: req.user!.companyId,
      });
      if (userCount > 0) {
        return res
          .status(400)
          .json(
            ApiResponse.error(
              `Cannot update status. Users(${userCount}) are assigned to this branch.`,
            ),
          );
      }
    }

    branch.status = status;

    await addUserHistory({
      userId: req.user!.id as string,
      field: "branchStatus",
      fieldId: branch._id.toString(),
      fieldValue: status,
      remarks,
      assignedBy,
    });
    await branch.save();

    return res
      .status(200)
      .json(ApiResponse.success(null, "Status updated successfully"));
  } catch (error) {
    next(error);
  }
};

export const myManagedBranchList = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const userId = req.user!.id;
    const role = req.user!.role;

    if (role === "OWNER") {
      const branches = await BranchModel.find({
        companyId: req.user!.companyId,
        status: "ACTIVE" as status,
      }).lean();

      return res.status(200).json(
        ApiResponse.success(
          branches.map((el) => ({
            branchId: el._id,
            name: el.name,
          })),
          "Branches fetched successfully",
        ),
      );
    }

    const branches = await UserAssignmentModel.findOne({
      userId,
    })
      .sort({ createdAt: -1 })
      .populate("assignments.branchId", "name")
      .lean();

    if (!branches) {
      return res
        .status(404)
        .json(ApiResponse.error("No branches found for the user"));
    }

    return res.status(200).json(
      ApiResponse.success(
        branches.assignments
          .filter((el) => !el.isReporting)
          .map((el: any) => ({
            branchId: el.branchId._id,
            name: el.branchId.name,
          })),
        "Branches fetched successfully",
      ),
    );
  } catch (error) {
    next(error);
  }
};
