import { NextFunction, Request, Response } from "express";
import { ApiResponse } from "../../shared/response/api-response";
import { PolicyModel } from "../../infrastructure/database/models";
import { status } from "../../types/types";
import { addUserHistory } from "../../shared/services/userHistory.service";

export const createPolicy = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { name } = req.body;

    const policy = await PolicyModel.create({
      companyId: req.user!.companyId,
      name,
    });

    return res
      .status(201)
      .json(ApiResponse.success(policy, "Policy created successfully"));
  } catch (error) {
    next(error);
  }
};

export const getPolicies = async (
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
    }

    const [policies, total] = await Promise.all([
      PolicyModel.find(filter)
        .sort({
          createdAt: -1,
        })
        .skip(skip)
        .limit(limit)
        .lean(),

      PolicyModel.countDocuments(filter),
    ]);

    return res.status(200).json(
      ApiResponse.success(
        {
          policies,
          total,
        },
        "Policies fetched successfully",
      ),
    );
  } catch (error) {
    next(error);
  }
};

export const getPolicyCount = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const filter: any = {
      companyId: req.user!.companyId,
    };

    const [active, inactive, deleted] = await Promise.all([
      PolicyModel.countDocuments({ ...filter, status: "ACTIVE" as status }),
      PolicyModel.countDocuments({ ...filter, status: "INACTIVE" as status }),
      PolicyModel.countDocuments({ ...filter, status: "DELETED" as status }),
    ]);

    return res.status(200).json(
      ApiResponse.success(
        {
          total: active + inactive + deleted,
          active,
          inactive,
          deleted,
        },
        "Policy counts fetched successfully",
      ),
    );
  } catch (error) {
    next(error);
  }
};

export const getPolicyById = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const policy = await PolicyModel.findOne({
      _id: req.params.policyId,
      companyId: req.user!.companyId,
    });

    if (!policy) {
      return res.status(404).json(ApiResponse.error("Policy not found"));
    }

    return res
      .status(200)
      .json(ApiResponse.success(policy, "Policy fetched successfully"));
  } catch (error) {
    next(error);
  }
};

export const updatePolicy = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const policy = await PolicyModel.findOne({
      _id: req.params.policyId,
      companyId: req.user!.companyId,
    });

    if (!policy) {
      return res.status(404).json(ApiResponse.error("Policy not found"));
    }

    const { name, description, isPaid } = req.body;

    if (name !== undefined) policy.name = name;

    // if (description !== undefined) policy.description = description;

    // if (isPaid !== undefined) policy.isPaid = isPaid;

    await policy.save();

    return res
      .status(200)
      .json(ApiResponse.success(null, "Policy updated successfully"));
  } catch (error) {
    next(error);
  }
};

export const updatePolicyStatus = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { status, remarks } = req.body;
    const assignedBy = req.user!.id;

    const policy = await PolicyModel.findOne({
      _id: req.params.policyId,
      companyId: req.user!.companyId,
    });

    if (!policy) {
      return res.status(404).json(ApiResponse.error("Policy not found"));
    }

    policy.status = status;

    await addUserHistory({
      userId: req.params.userId as string,
      field: "policyStatus",
      fieldValue: status,
      remarks,
      assignedBy,
    });
    await policy.save();

    return res
      .status(200)
      .json(ApiResponse.success(null, "Status updated successfully"));
  } catch (error) {
    next(error);
  }
};
