import { NextFunction, Request, Response } from "express";
import {
  PayrollModel,
  UserModel,
  UserPayslipModel,
} from "../../infrastructure/database/models";
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
    const csvPassword = req.query.csvPassword
      ? String(req.query.csvPassword)
      : undefined;

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
                $subtract: [
                  "$totals.attendanceSalaryAmount",
                  "$totals.deductionsAmount",
                ],
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
              $sum: "$totals.reimbursementsAmount",
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
        earnings: payroll.totals.attendanceSalaryAmount,
        deductions: payroll.totals.deductionsAmount,
        reimbursement: payroll.totals.reimbursementsAmount,
        netPay: payroll.total.netPayAmount,
      }));

      return downloadCsv(res, data, "payroll", csvPassword);
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

export const getEmployeeWiseYearlyPayrolls = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { userId, year } = req.query!;
    if (!userId || !year) {
      return res.status(404).json("UserId is Required");
    }

    const user = await UserModel.findById(userId)
      .lean()
      .populate("branchId", "name")
      .populate("shiftId", "name startTime endTime")
      .populate("departmentId", "name")
      .populate("designationId", "name")
      .select("role profileImage firstName lastName");

    if (!user) {
      return res.status(404).json("User Not found");
    }

    const requestedYear = Number(year);
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth() + 1;

    const payslip: any = await UserPayslipModel.findOne({
      userId: userId.toString(),

      $or: [
        {
          effectiveFromYear: {
            $lt: requestedYear,
          },
        },
        {
          effectiveFromYear: requestedYear,
          effectiveFromMonth: {
            $lte: requestedYear === currentYear ? currentMonth : 12,
          },
        },
      ],
    })
      .sort({
        effectiveFromYear: -1,
        effectiveFromMonth: -1,
      })
      .select("salary");
    
    const payrolls = await PayrollModel.find({
      payrollYear: requestedYear,
    }).lean();

    return res.status(200).json(
      ApiResponse.success({
        branches: [user.branchId],
        shifts: [user.shiftId],
        departments: [user?.departmentId],
        user,
        curruntSalary: payslip?.salary || 0,
        payrolls,
      }),
    );
  } catch (error) {
    next(error);
  }
};
