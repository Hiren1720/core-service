import { NextFunction, Request, Response } from "express";
import { PayrollModel } from "../../infrastructure/database/models";
import { downloadCsv } from "../../shared/utils/csvDownload";
import { ApiResponse } from "../../shared/response/api-response";
import mongoose from "mongoose";

export const getPayrolls = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 10;

    const skip = (page - 1) * limit;

    const search = req.query.search?.toString() || "";
    const isDownload = req.query.isDownload === "true";

    const month = req.query.month ? Number(req.query.month) : undefined;
    const year = req.query.year ? Number(req.query.year) : undefined;

    const filter: any = {
      companyId: req.user!.companyId,
    };

    const stateFilter: any = {
      companyId: new mongoose.Types.ObjectId(req.user!.companyId),
    };

    if (search) {
      //   filter.name = {
      //     $regex: search,
      //     $options: "i",
      //   };
    }

    if (year && month) {
      filter.payrollMonth = month;
      filter.payrollYear = year;
      stateFilter.payrollMonth = month;
      stateFilter.payrollYear = year;
    }

    const payrollQ = PayrollModel.find(filter)
      .populate("userId", "firstName lastName profileImage role")
      .populate("reimbursements", "name date amount")
      .sort({
        createdAt: -1,
      })
      .lean();

    if (!isDownload) {
      payrollQ.skip(skip).limit(limit);
    }

    const [payrolls, total, salary, reimbursement] = await Promise.all([
      payrollQ,
      PayrollModel.countDocuments(filter),
      PayrollModel.aggregate([
        { $match: { ...stateFilter } },
        {
          $group: {
            _id: null,
            totalAmount: {
              $sum: {
                $subtract: ["$totals.totalEarnings", "$totals.totalDeductions"],
              },
            },
          },
        },
      ]),
      PayrollModel.aggregate([
        { $match: { ...stateFilter } },
        {
          $group: {
            _id: null,
            totalAmount: {
              $sum: "$totals.totalReimbursements",
            },
          },
        },
      ]),
    ]);

    if (isDownload) {
      const data = payrolls.map((payroll: any) => ({
        Name: payroll.userId.firstName + payroll.userId.lastName,
        payrollMonth: payroll.payrollMonth,
        payrollYear: payroll.payrollYear,
        presentDays: payroll.presentDays,
        absentDays: payroll.absentDays,
        leaveDays: payroll.paidLeaveDays,
        earnings: payroll.totals.totalEarnings,
        deductions: payroll.totals.totalDeductions,
        reimbursement: payroll.totals.totalReimbursements,
        netPay: payroll.total.netPay,
      }));

      return downloadCsv(res, data, "payroll");
    }

    return res.status(200).json(
      ApiResponse.success(
        {
          payrollMonth: month,
          payrollYear: year,
          salary: salary[0]?.totalAmount || 0,
          reimbursement: reimbursement[0]?.totalAmount || 0,
          payrolls,
          total,
        },
        "payroll fetched successfully",
      ),
    );
  } catch (error) {
    next(error);
  }
};
