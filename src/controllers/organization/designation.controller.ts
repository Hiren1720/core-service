import { NextFunction, Request, Response } from "express";
import { ApiResponse } from "../../shared/response/api-response";
import {
  DesignationModel,
  UserModel,
} from "../../infrastructure/database/models";
import { addUserHistory } from "../../shared/services/userHistory.service";
import { status } from "../../types/types";

export const createDesignation = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { name, description } = req.body;

    const designation = await DesignationModel.create({
      companyId: req.user!.companyId,
      name,
      description,
    });

    await addUserHistory({
      userId: req.user!.id as string,
      field: "designationStatus",
      fieldId: designation._id.toString(),
      fieldValue: status.ACTIVE,
      remarks: "",
      assignedBy: req.user!.id as string,
    });

    return res
      .status(201)
      .json(
        ApiResponse.success(designation, "Designation created successfully"),
      );
  } catch (error) {
    next(error);
  }
};

export const getDesignations = async (
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

    const [designations, total] = await Promise.all([
      DesignationModel.find(filter)
        .sort({
          createdAt: -1,
        })
        .skip(skip)
        .limit(limit)
        .lean(),

      DesignationModel.countDocuments(filter),
    ]);

    return res.status(200).json(
      ApiResponse.success(
        {
          designations,
          total,
        },
        "Designations fetched successfully",
      ),
    );
  } catch (error) {
    next(error);
  }
};

export const getDesignationById = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const designation = await DesignationModel.findOne({
      _id: req.params.designationId,
      companyId: req.user!.companyId,
    });

    if (!designation) {
      return res.status(404).json(ApiResponse.error("Designation not found"));
    }

    return res
      .status(200)
      .json(
        ApiResponse.success(designation, "Designation fetched successfully"),
      );
  } catch (error) {
    next(error);
  }
};

export const updateDesignation = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const designation = await DesignationModel.findOne({
      _id: req.params.designationId,
      companyId: req.user!.companyId,
    });

    if (!designation) {
      return res.status(404).json(ApiResponse.error("Designation not found"));
    }

    const { name, description } = req.body;

    if (name !== undefined) designation.name = name;

    if (description !== undefined) designation.description = description;

    await designation.save();

    return res
      .status(200)
      .json(ApiResponse.success(null, "Designation updated successfully"));
  } catch (error) {
    next(error);
  }
};

export const updateDesignationStatus = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { status, remarks } = req.body;
    const assignedBy = req.user!.id;

    const designation = await DesignationModel.findOne({
      _id: req.params.designationId,
      companyId: req.user!.companyId,
    });

    if (!designation) {
      return res.status(404).json(ApiResponse.error("Designation not found"));
    }

    if (status !== "ACTIVE") {
      const userCount = await UserModel.countDocuments({
        designationId: designation._id,
        companyId: req.user!.companyId,
      });
      if (userCount > 0) {
        return res
          .status(400)
          .json(
            ApiResponse.error(
              `Cannot update status. Users(${userCount}) are assigned to this designation.`,
            ),
          );
      }
    }

    designation.status = status;

    await addUserHistory({
      userId: req.user!.id as string,
      field: "designationStatus",
      fieldId: designation._id.toString(),
      fieldValue: status,
      remarks,
      assignedBy,
    });
    await designation.save();

    return res
      .status(200)
      .json(ApiResponse.success(null, "Status updated successfully"));
  } catch (error) {
    next(error);
  }
};
