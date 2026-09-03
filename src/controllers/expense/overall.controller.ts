import { NextFunction, Request, Response } from "express";
import mongoose from "mongoose";
import {
  OfficeExpenseModel,
  PayrollModel,
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
    const { role } = req.user!;

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
      companyId
    };

    const curruntPayrollFilter: any = {
      companyId
    };

    const pastPayrollFilter: any = {
      companyId
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

      curruntPayrollFilter.payrollMonth = Number(startDate.split("-")[1]);
      curruntPayrollFilter.payrollYear = Number(startDate.split("-")[0]);
      pastPayrollFilter.payrollMonth = Number(endDate.split("-")[1]);
      pastPayrollFilter.payrollYear = Number(endDate.split("-")[0]);
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
      curruntPayrollFilter.payrollMonth = Number(month);
      curruntPayrollFilter.payrollYear = Number(year);
      pastPayrollFilter.payrollMonth = Number(previousMonth);
      pastPayrollFilter.payrollYear = Number(previousYear);
    }

    const [
      reimbursement,
      officeExpense,
      salary,
      pastReimbursement,
      pastOfficeExpense,
      pastSalary,
    ] = await Promise.all([
      ReimbursementModel.aggregate([
        { $match: { ...currentFilter, status: "APPROVED" as expenseStatus } },
        { $group: { _id: null, totalAmount: { $sum: "$amount" } } },
      ]),
      OfficeExpenseModel.aggregate([
        { $match: { ...currentFilter, status: "APPROVED" as expenseStatus } },
        { $group: { _id: null, totalAmount: { $sum: "$amount" } } },
      ]),
      PayrollModel.aggregate([
        { $match: { ...curruntPayrollFilter } },
        {
          $group: {
            _id: null,
            totalAmount: {
              $sum: {
                $subtract: [
                  "$totals.attendanceSalaryAmount",
                  "$totals.deductionsAmount",
                ],
              },
            },
          },
        },
      ]),
      ReimbursementModel.aggregate([
        { $match: { ...pastFilter, status: "APPROVED" as expenseStatus } },
        { $group: { _id: null, totalAmount: { $sum: "$amount" } } },
      ]),
      OfficeExpenseModel.aggregate([
        { $match: { ...pastFilter, status: "APPROVED" as expenseStatus } },
        { $group: { _id: null, totalAmount: { $sum: "$amount" } } },
      ]),
      PayrollModel.aggregate([
        { $match: { ...pastPayrollFilter } },
        {
          $group: {
            _id: null,
            totalAmount: {
              $sum: {
                $subtract: [
                  "$totals.attendanceSalaryAmount",
                  "$totals.deductionsAmount",
                ],
              },
            },
          },
        },
      ]),
    ]);

    return res.status(200).json(
      ApiResponse.success(
        {
          total:
            (reimbursement[0]?.totalAmount || 0) +
            (officeExpense[0]?.totalAmount || 0) +
            (salary[0]?.totalAmount || 0),
          reimbursement: reimbursement[0]?.totalAmount || 0,
          officeExpense: officeExpense[0]?.totalAmount || 0,
          salary: salary[0]?.totalAmount || 0,
          past: {
            total:
              (pastReimbursement[0]?.totalAmount || 0) +
              (pastOfficeExpense[0]?.totalAmount || 0) +
              (pastSalary[0]?.totalAmount || 0),
            reimbursement: pastReimbursement[0]?.totalAmount || 0,
            officeExpense: pastOfficeExpense[0]?.totalAmount || 0,
            salary: pastSalary[0]?.totalAmount || 0,
          },
        },
        "Expense fetched successfully",
      ),
    );
  } catch (error) {
    next(error);
  }
};