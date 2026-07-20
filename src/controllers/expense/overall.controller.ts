import { NextFunction, Request, Response } from "express";
import mongoose from "mongoose";
import {
  OfficeExpenseModel,
  ReimbursementModel,
} from "../../infrastructure/database/models";
import { expenseStatus } from "../../types/types";
import { ApiResponse } from "../../shared/response/api-response";

export const getOverallExpensesCount = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const currentFilter: any = {
      companyId: new mongoose.Types.ObjectId(req.user!.companyId),
    };

    const pastFilter: any = {
      companyId: new mongoose.Types.ObjectId(req.user!.companyId),
    };

    const month = req.query.month ? Number(req.query.month) : undefined;
    const year = req.query.year ? Number(req.query.year) : undefined;

    if (year && month) {
      // Current Month
      currentFilter.date = {
        $gte: new Date(year, month - 1, 1),
        $lt: new Date(year, month, 1),
      };

      // Previous Month
      let previousMonth = month - 1;
      let previousYear = year;

      if (previousMonth === 0) {
        previousMonth = 12;
        previousYear--;
      }

      pastFilter.date = {
        $gte: new Date(previousYear, previousMonth - 1, 1),
        $lt: new Date(previousYear, previousMonth, 1),
      };
    }

    console.log(currentFilter, pastFilter);

    const [reimbursement, officeExpense, pastReimbursement, pastOfficeExpense] =
      await Promise.all([
        ReimbursementModel.aggregate([
          { $match: { ...currentFilter, status: "APPROVED" as expenseStatus } },
          { $group: { _id: null, totalAmount: { $sum: "$amount" } } },
        ]),
        OfficeExpenseModel.aggregate([
          { $match: { ...currentFilter, status: "APPROVED" as expenseStatus } },
          { $group: { _id: null, totalAmount: { $sum: "$amount" } } },
        ]),
        ReimbursementModel.aggregate([
          { $match: { ...pastFilter, status: "APPROVED" as expenseStatus } },
          { $group: { _id: null, totalAmount: { $sum: "$amount" } } },
        ]),
        OfficeExpenseModel.aggregate([
          { $match: { ...pastFilter, status: "APPROVED" as expenseStatus } },
          { $group: { _id: null, totalAmount: { $sum: "$amount" } } },
        ]),
      ]);

    return res.status(200).json(
      ApiResponse.success(
        {
          total:
            (reimbursement[0]?.totalAmount || 0) +
            (officeExpense[0]?.totalAmount || 0),
          reimbursement: reimbursement[0]?.totalAmount || 0,
          officeExpense: officeExpense[0]?.totalAmount || 0,
          salary: 0,
          past: {
            total:
              (pastReimbursement[0]?.totalAmount || 0) +
              (pastOfficeExpense[0]?.totalAmount || 0),
            reimbursement: pastReimbursement[0]?.totalAmount || 0,
            officeExpense: pastOfficeExpense[0]?.totalAmount || 0,
            salary: 0,
          },
        },
        "Expense fetched successfully",
      ),
    );
  } catch (error) {
    next(error);
  }
};
