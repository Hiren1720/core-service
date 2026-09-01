import { NextFunction, Request, Response } from "express";
import { ApiResponse } from "../../../shared/response/api-response";
import {
  AdminModel,
  InvoiceModel,
  MonthlyEmployeeSnapshotModel,
} from "../../../infrastructure/database/models";
import { Types } from "mongoose";

export const getCompanyEmployeeStatusHistory = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const month = Number(req.query.month);
    const year = Number(req.query.year);
    const companyId = req.query.companyId?.toString();

    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 10;

    if (!month || !year || month < 1 || month > 12 || !companyId) {
      return res
        .status(400)
        .json(
          ApiResponse.error("Valid companyId, month and year are required"),
        );
    }

    const skip = (page - 1) * limit;

    const [list, total] = await Promise.all([
      MonthlyEmployeeSnapshotModel.find({
        year,
        month,
      })
        .select(
          " -createdAt -updatedAt -__v -activePeriods -inactivePeriods -deletedPeriods",
        )
        .populate({
          path: "userId",
          select: "firstName lastName profileImage role status ",
        })
        .skip(skip)
        .limit(limit)
        .lean(),
      MonthlyEmployeeSnapshotModel.countDocuments({
        year,
        month,
      }),
    ]);
    return res
      .status(200)
      .json(
        ApiResponse.success(
          { list, total },
          "Employee status history fetched successfully",
        ),
      );
  } catch (error) {
    next(error);
  }
};

export const getInvoiceList = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const month = Number(req.query.month);
    const year = Number(req.query.year);
    const statusFilter = req.query.status?.toString();

    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 10;

    if (!month || !year || month < 1 || month > 12) {
      return res
        .status(400)
        .json(ApiResponse.error("Valid month and year are required"));
    }

    const filter = {
      billingYear: year,
      billingMonth: month,
      ...(statusFilter
        ? { status: statusFilter as "GENERATED" | "SENDED" }
        : {}),
    };

    const [list, total, amount] = await Promise.all([
      InvoiceModel.find(filter)
        .select("invoiceNumber status totalAmount")
        .populate({
          path: "companyId",
          select: "companyName companyAddress companyLogo",
          populate: [
            {
              path: "companyRepresentative",
              select: "firstName lastName profileImage",
            },
            {
              path: "assignedBankAccount",
              select: "ifscCode accountHolderName accountNo",
            },
          ],
        })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      InvoiceModel.countDocuments(filter),
      InvoiceModel.aggregate([
        {
          $match: {
            billingYear: year,
            billingMonth: month,
          },
        },
        {
          $group: {
            _id: "$status",
            totalAmount: {
              $sum: "$totalAmount",
            },
          },
        },
      ]),
    ]);

    const stats = {
      generated: amount.find((a) => a._id === "GENERATED")?.totalAmount || 0,
      sended: amount.find((a) => a._id === "SENDED")?.totalAmount || 0,
      total: amount.reduce((acc, a) => acc + a.totalAmount, 0),
    };
    return res
      .status(200)
      .json(ApiResponse.success({ list, total, stats }, "Invoice fetched"));
  } catch (error) {
    next(error);
  }
};

export const getInvoiceDetails = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { invoiceId } = req.params;

    if (!Types.ObjectId.isValid(invoiceId as string)) {
      return res.status(400).json(ApiResponse.error("Invalid invoice ID"));
    }

    const invoice = await InvoiceModel.findById(invoiceId)
      .populate({
        path: "companyId",
        select:
          "companyName companyAddress companyLogo companyEmail employeePrice",
        populate: [
          {
            path: "companyRepresentative",
            select: "firstName lastName profileImage",
          },
          {
            path: "assignedBankAccount",
            select: "-createdAt -updatedAt",
          },
        ],
      })
      .lean();

    if (!invoice) {
      return res.status(404).json(ApiResponse.error("Invoice not found"));
    }

    const admin = await AdminModel.findOne().lean().select("company");

    return res
      .status(200)
      .json(
        ApiResponse.success(
          { invoice, admin: admin?.company },
          "Invoice details fetched",
        ),
      );
  } catch (error) {
    next(error);
  }
};
