import { NextFunction, Request, Response } from "express";
import mongoose from "mongoose";
import {
  OfficeExpenseModel,
  ReimbursementModel,
} from "../../infrastructure/database/models";
import { expenseStatus } from "../../types/types";
import { ApiResponse } from "../../shared/response/api-response";
import { getMyManagedUserIdList } from "../../shared/services/users.service";

export const getOverallExpensesCount = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { role, id } = req.user!;

    let companyId;
    if (role === "ADMIN") {
      companyId = new mongoose.Types.ObjectId(req.query.companyId as string);
    } else {
      companyId = new mongoose.Types.ObjectId(req.user!.companyId);
    }

    const currentFilter: any = {
      companyId,
    };

    const pastFilter: any = {
      companyId,
    };

    const month = req.query.month ? Number(req.query.month) : undefined;
    const year = req.query.year ? Number(req.query.year) : undefined;

    const startDate = req.query.startDate as string | undefined;
    const endDate = req.query.endDate as string | undefined;

    if (startDate && endDate) {
      const currentStart = new Date(startDate);
      const currentEnd = new Date(endDate);

      currentEnd.setHours(23, 59, 59, 999);

      currentFilter.date = {
        $gte: currentStart,
        $lte: currentEnd,
      };

      const diff = currentEnd.getTime() - currentStart.getTime();

      const pastEnd = new Date(currentStart);
      pastEnd.setDate(pastEnd.getDate() - 1);
      pastEnd.setHours(23, 59, 59, 999);

      const pastStart = new Date(pastEnd.getTime() - diff);

      pastFilter.date = {
        $gte: pastStart,
        $lte: pastEnd,
      };
    } else if (year && month) {
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

    if (role === "EMPLOYEE") {
      currentFilter.userId = new mongoose.Types.ObjectId(id);
      pastFilter.userId = new mongoose.Types.ObjectId(id);
    } else if (role === "MANAGER") {
      const userIds = await getMyManagedUserIdList(id);
      currentFilter.userId = { $in: [...userIds, new mongoose.Types.ObjectId(id)] };
      pastFilter.userId = { $in: [...userIds, new mongoose.Types.ObjectId(id)] };
    }

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
          past: {
            total:
              (pastReimbursement[0]?.totalAmount || 0) +
              (pastOfficeExpense[0]?.totalAmount || 0),
            reimbursement: pastReimbursement[0]?.totalAmount || 0,
            officeExpense: pastOfficeExpense[0]?.totalAmount || 0,
          },
        },
        "Expense fetched successfully",
      ),
    );
  } catch (error) {
    next(error);
  }
};
