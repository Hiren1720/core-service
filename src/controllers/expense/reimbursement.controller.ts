import { Request, Response, NextFunction } from "express";
import mongoose from "mongoose";
import { ApiResponse } from "../../shared/response/api-response";
import { saveFile } from "../../shared/services/file.service";
import { ReimbursementModel } from "../../infrastructure/database/models";
import { addUserHistory } from "../../shared/services/userHistory.service";
import { expenseStatus } from "../../types/types";

export const createReimbursement = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    const { companyId, id: assignedBy } = req.user!;

    const { name, userId, branchId, date, description, amount } = req.body;

    if (!name?.trim()) {
      return res
        .status(400)
        .json(ApiResponse.error("Reimbursement name is required"));
    }

    if (!date) {
      return res.status(400).json(ApiResponse.error("Date is required"));
    }

    if (!amount || Number(amount) <= 0) {
      return res
        .status(400)
        .json(ApiResponse.error("Amount must be greater than 0"));
    }

    const files = req.files as Record<string, Express.Multer.File[]>;

    const documents: string[] = [];

    if (files?.["documents"]?.length) {
      files["documents"].forEach((file, index) => {
        documents.push(
          saveFile({
            file,
            folder: "reimbursements",
            entityId: userId.toString(),
            fileName: `document-${index + 1}`,
          }),
        );
      });
    }

    await ReimbursementModel.create(
      [
        {
          companyId,
          branchId,
          userId,
          name: name.trim(),
          date,
          description: description?.trim() || "",
          amount: Number(amount),
          documents,
          assignedBy,
        },
      ],
      { session },
    );

    await session.commitTransaction();

    return res
      .status(201)
      .json(
        ApiResponse.success(
          null,
          "Reimbursement request submitted successfully",
        ),
      );
  } catch (error) {
    await session.abortTransaction();
    next(error);
  } finally {
    session.endSession();
  }
};

export const getReimbursements = async (
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

    const month = req.query.month ? Number(req.query.month) : undefined;
    const year = req.query.year ? Number(req.query.year) : undefined;

    const filter: any = {
      companyId: req.user!.companyId,
    };

    if (search) {
      filter.name = {
        $regex: search,
        $options: "i",
      };
    }

    if (year && month) {
      filter.date = {
        $gte: new Date(year, month - 1, 1),
        $lt: new Date(year, month, 1),
      };
    }

    if (status) {
      filter.status = status;
    }

    const [reimbursements, total] = await Promise.all([
      ReimbursementModel.find(filter)
        .populate("userId", "firstName lastName profileImage role")
        .sort({
          createdAt: -1,
        })
        .skip(skip)
        .limit(limit)
        .lean(),

      ReimbursementModel.countDocuments(filter),
    ]);

    return res.status(200).json(
      ApiResponse.success(
        {
          reimbursements,
          total,
        },
        "Reimbursements fetched successfully",
      ),
    );
  } catch (error) {
    next(error);
  }
};

export const getReimbursementsCount = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const filter: any = {
      companyId: new mongoose.Types.ObjectId(req.user!.companyId),
    };

    const month = req.query.month ? Number(req.query.month) : undefined;
    const year = req.query.year ? Number(req.query.year) : undefined;

    if (year && month) {
      filter.date = {
        $gte: new Date(year, month - 1, 1),
        $lt: new Date(year, month, 1),
      };
    }

    const [
      pending,
      approved,
      rejected,
      pendingAmount,
      approvedAmount,
      rejectedAmount,
    ] = await Promise.all([
      ReimbursementModel.countDocuments({
        ...filter,
        status: "PENDING" as expenseStatus,
      }),
      ReimbursementModel.countDocuments({
        ...filter,
        status: "APPROVED" as expenseStatus,
      }),
      ReimbursementModel.countDocuments({
        ...filter,
        status: "REJECTED" as expenseStatus,
      }),
      ReimbursementModel.aggregate([
        { $match: { ...filter, status: "PENDING" as expenseStatus } },
        { $group: { _id: null, totalAmount: { $sum: "$amount" } } },
      ]),
      ReimbursementModel.aggregate([
        { $match: { ...filter, status: "APPROVED" as expenseStatus } },
        { $group: { _id: null, totalAmount: { $sum: "$amount" } } },
      ]),
      ReimbursementModel.aggregate([
        { $match: { ...filter, status: "REJECTED" as expenseStatus } },
        { $group: { _id: null, totalAmount: { $sum: "$amount" } } },
      ]),
    ]);

    return res.status(200).json(
      ApiResponse.success(
        {
          total: pending + approved + rejected,
          pending,
          approved,
          rejected,
          amount: {
            pending: pendingAmount[0]?.totalAmount || 0,
            approved: approvedAmount[0]?.totalAmount || 0,
            rejected: rejectedAmount[0]?.totalAmount || 0,
            total:
              (pendingAmount[0]?.totalAmount || 0) +
              (approvedAmount[0]?.totalAmount || 0) +
              (rejectedAmount[0]?.totalAmount || 0),
          },
        },
        "Reimbursement counts fetched successfully",
      ),
    );
  } catch (error) {
    next(error);
  }
};

export const getReimbursementById = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const reimbursement = await ReimbursementModel.findOne({
      _id: req.params.reimbursementId,
      companyId: req.user!.companyId,
    })
      .populate("userId", "firstName lastName profileImage role")
      .populate("branchId", "name");

    if (!reimbursement) {
      return res.status(404).json(ApiResponse.error("Reimbursement not found"));
    }

    return res
      .status(200)
      .json(
        ApiResponse.success(
          reimbursement,
          "Reimbursement fetched successfully",
        ),
      );
  } catch (error) {
    next(error);
  }
};

export const updateReimbursementStatus = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { status, remarks } = req.body;
    const assignedBy = req.user!.id;

    const reimbursement = await ReimbursementModel.findOne({
      _id: req.params.reimbursementId,
      companyId: req.user!.companyId,
    });

    if (!reimbursement) {
      return res.status(404).json(ApiResponse.error("Reimbursement not found"));
    }

    reimbursement.status = status;

    await addUserHistory({
      userId: req.user!.id as string,
      field: "reimbursementStatus",
      fieldId: reimbursement._id.toString(),
      fieldValue: status,
      remarks,
      assignedBy,
    });
    await reimbursement.save();

    return res
      .status(200)
      .json(ApiResponse.success(null, "Status updated successfully"));
  } catch (error) {
    next(error);
  }
};
