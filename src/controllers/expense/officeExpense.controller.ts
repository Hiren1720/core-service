import { Request, Response, NextFunction } from "express";
import mongoose from "mongoose";
import { ApiResponse } from "../../shared/response/api-response";
import { saveFile } from "../../shared/services/file.service";
import { OfficeExpenseModel } from "../../infrastructure/database/models";
import { addUserHistory } from "../../shared/services/userHistory.service";
import { expenseStatus } from "../../types/types";

export const createOfficeExpense = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    const { companyId, id: assignedBy } = req.user!;

    const {
      name,
      branchId,
      date,
      description,
      amount,
      paymentMode,
      transactionId,
    } = req.body;

    if (!name?.trim()) {
      return res
        .status(400)
        .json(ApiResponse.error("OfficeExpense name is required"));
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
            folder: "officeExpenses",
            entityId: assignedBy.toString(),
            fileName: `document-${index + 1}`,
          }),
        );
      });
    }

    await OfficeExpenseModel.create(
      [
        {
          companyId,
          branchId,
          name: name.trim(),
          date,
          description: description?.trim() || "",
          amount: Number(amount),
          paymentMode,
          transactionId,
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
          "OfficeExpense request submitted successfully",
        ),
      );
  } catch (error) {
    await session.abortTransaction();
    next(error);
  } finally {
    session.endSession();
  }
};

export const getOfficeExpenses = async (
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

    const [officeExpenses, total] = await Promise.all([
      OfficeExpenseModel.find(filter)
        .populate("assignedBy", "firstName lastName profileImage role")
        .populate("branchId", "name")
        .sort({
          createdAt: -1,
        })
        .skip(skip)
        .limit(limit)
        .lean(),

      OfficeExpenseModel.countDocuments(filter),
    ]);

    return res.status(200).json(
      ApiResponse.success(
        {
          officeExpenses,
          total,
        },
        "OfficeExpenses fetched successfully",
      ),
    );
  } catch (error) {
    next(error);
  }
};

export const getOfficeExpensesCount = async (
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
      OfficeExpenseModel.countDocuments({
        ...filter,
        status: "PENDING" as expenseStatus,
      }),
      OfficeExpenseModel.countDocuments({
        ...filter,
        status: "APPROVED" as expenseStatus,
      }),
      OfficeExpenseModel.countDocuments({
        ...filter,
        status: "REJECTED" as expenseStatus,
      }),
      OfficeExpenseModel.aggregate([
        { $match: { ...filter, status: "PENDING" as expenseStatus } },
        { $group: { _id: null, totalAmount: { $sum: "$amount" } } },
      ]),
      OfficeExpenseModel.aggregate([
        { $match: { ...filter, status: "APPROVED" as expenseStatus } },
        { $group: { _id: null, totalAmount: { $sum: "$amount" } } },
      ]),
      OfficeExpenseModel.aggregate([
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
        "OfficeExpense counts fetched successfully",
      ),
    );
  } catch (error) {
    next(error);
  }
};

export const getOfficeExpenseById = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const officeExpense = await OfficeExpenseModel.findOne({
      _id: req.params.officeExpenseId,
      companyId: req.user!.companyId,
    })
      .populate("assignedBy", "firstName lastName profileImage role")
      .populate("branchId", "name");

    if (!officeExpense) {
      return res.status(404).json(ApiResponse.error("OfficeExpense not found"));
    }

    return res
      .status(200)
      .json(
        ApiResponse.success(
          officeExpense,
          "OfficeExpense fetched successfully",
        ),
      );
  } catch (error) {
    next(error);
  }
};

export const updateOfficeExpenseStatus = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { status, remarks } = req.body;
    const assignedBy = req.user!.id;

    const officeExpense = await OfficeExpenseModel.findOne({
      _id: req.params.officeExpenseId,
      companyId: req.user!.companyId,
    });

    if (!officeExpense) {
      return res.status(404).json(ApiResponse.error("OfficeExpense not found"));
    }

    officeExpense.status = status;

    await addUserHistory({
      userId: req.user!.id as string,
      field: "officeExpenseStatus",
      fieldId: officeExpense._id.toString(),
      fieldValue: status,
      remarks,
      assignedBy,
    });
    await officeExpense.save();

    return res
      .status(200)
      .json(ApiResponse.success(null, "Status updated successfully"));
  } catch (error) {
    next(error);
  }
};
