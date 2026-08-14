import { NextFunction, Request, Response } from "express";
import mongoose from "mongoose";
import { ApiResponse } from "../../shared/response/api-response";
import {
  LeaveModel,
  PolicyModel,
  UserPolicyModel,
} from "../../infrastructure/database/models";
import { addUserHistory } from "../../shared/services/userHistory.service";
import { status } from "../../types/types";

export const createPolicy = async (req: Request, res: Response) => {
  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    const companyId = req.user!.companyId;
    const { name, leaves = [], ...payload } = req.body;

    const policyExists = await PolicyModel.exists({
      companyId,
      name: name.trim(),
    });

    if (policyExists) {
      await session.abortTransaction();

      return res
        .status(409)
        .json(ApiResponse.error("Policy with same name already exists."));
    }

    if (leaves.length) {
      const leaveIds = leaves.map((x: any) => x.leaveId);

      const count = await LeaveModel.countDocuments({
        _id: { $in: leaveIds },
      });

      if (count !== leaveIds.length) {
        await session.abortTransaction();

        return res
          .status(400)
          .json(ApiResponse.error("One or more leave types are invalid."));
      }
    }

    const policy = await PolicyModel.create(
      [
        {
          companyId,
          name: name.trim(),
          leaves,
          ...payload,
        },
      ],
      { session },
    );

    await addUserHistory({
      userId: req.user!.id as string,
      field: "policyStatus",
      fieldId: policy?.[0]?._id?.toString(),
      fieldValue: status.ACTIVE,
      remarks: "",
      assignedBy: req.user!.id as string,
    });

    await session.commitTransaction();

    return res
      .status(201)
      .json(ApiResponse.success(policy[0], "Policy created successfully."));
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
};

export const updatePolicy = async (req: Request, res: Response) => {
  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    const companyId = req.user!.companyId;
    const { policyId } = req.params;

    const { name, leaves = [], ...payload } = req.body;

    const policy = await PolicyModel.findOne({
      _id: policyId,
      companyId,
    });

    if (!policy) {
      await session.abortTransaction();

      return res.status(404).json(ApiResponse.error("Policy not found."));
    }

    if (name) {
      const duplicate = await PolicyModel.exists({
        _id: { $ne: policyId },
        companyId,
        name: name.trim(),
      });

      if (duplicate) {
        await session.abortTransaction();

        return res
          .status(409)
          .json(ApiResponse.error("Policy name already exists."));
      }
    }

    if (leaves.length) {
      const leaveIds = leaves.map((x: any) => x.leaveId);

      const count = await LeaveModel.countDocuments({
        _id: {
          $in: leaveIds,
        },
      });

      if (count !== leaveIds.length) {
        await session.abortTransaction();

        return res
          .status(400)
          .json(ApiResponse.error("One or more leave types are invalid."));
      }
    }

    Object.assign(policy, {
      ...payload,
      ...(name && { name: name.trim() }),
      leaves,
    });

    await policy.save({ session });

    await session.commitTransaction();

    return res
      .status(200)
      .json(ApiResponse.success(policy, "Policy updated successfully."));
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
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
    } else {
      filter.status = { $ne: "DELETED" as status };
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

    const [active, inactive] = await Promise.all([
      PolicyModel.countDocuments({ ...filter, status: "ACTIVE" as status }),
      PolicyModel.countDocuments({ ...filter, status: "INACTIVE" as status }),
      // PolicyModel.countDocuments({ ...filter, status: "DELETED" as status }),
    ]);

    return res.status(200).json(
      ApiResponse.success(
        {
          total: active + inactive,
          active,
          inactive,
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

    if (status !== "ACTIVE") {
      const assignedUsers = await UserPolicyModel.aggregate([
        {
          $sort: {
            createdAt: -1,
          },
        },
        {
          $group: {
            _id: "$userId",
            latestPolicy: {
              $first: "$policyId",
            },
          },
        },
        {
          $match: {
            latestPolicy: new mongoose.Types.ObjectId(policy._id),
          },
        },
        {
          $limit: 1,
        },
      ]);
      if (assignedUsers.length > 0) {
        return res
          .status(400)
          .json(
            ApiResponse.error(
              "This policy is currently assigned to one or more employees.",
            ),
          );
      }
    }

    policy.status = status;

    await addUserHistory({
      userId: req.user!.id as string,
      field: "policyStatus",
      fieldId: policy._id.toString(),
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
