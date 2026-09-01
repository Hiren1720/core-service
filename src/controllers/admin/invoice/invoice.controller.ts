import { NextFunction, Request, Response } from "express";
import { ApiResponse } from "../../../shared/response/api-response";
import {
  CompanyModel,
  InvoiceModel,
  UserHistoryModel,
  UserModel,
} from "../../../infrastructure/database/models";
import { status, userStatus } from "../../../types/types";

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

    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59, 999);

    // Company
    const company = await CompanyModel.findById(companyId)
      .select("_id companyName companyLogo")
      .lean();

    if (!company) {
      return res.status(404).json(ApiResponse.error("Company not found"));
    }

    // Employees
    const [users, total] = await Promise.all([
      UserModel.find({
        companyId: company._id,
        status: {
          $in: [userStatus.ACTIVE, userStatus.INACTIVE, userStatus.DELETED],
        },
      })
        .select("_id firstName lastName profileImage role status")
        // .sort({ firstName: 1, lastName: 1 })
        .skip(skip)
        .limit(limit)
        .lean(),

      UserModel.countDocuments({
        companyId: company._id,
        status: {
          $in: [userStatus.ACTIVE, userStatus.INACTIVE, userStatus.DELETED],
        },
      }),
    ]);

    const userIds = users.map((user) => user._id);

    // Get status history
    const histories = await UserHistoryModel.find({
      userId: { $in: userIds },
      field: "userStatus",
      createdAt: { $lte: endDate },
    })
      .sort({
        userId: 1,
        createdAt: 1,
      })
      .lean();

    // Group history by user
    const historyMap = new Map<string, any[]>();

    for (const history of histories) {
      const userId = history.userId.toString();

      if (!historyMap.has(userId)) {
        historyMap.set(userId, []);
      }

      historyMap.get(userId)!.push(history);
    }

    const employees = [];

    for (const user of users) {
      const userHistory = historyMap.get(user._id.toString()) || [];

      const statuses: Record<string, any[]> = {
        ACTIVE: [],
        INACTIVE: [],
        DELETED: [],
      };

      // Status at the beginning of requested month
      let currentStatus: string | null = null;

      for (const history of userHistory) {
        const historyDate = new Date(history.createdAt);

        if (historyDate < startDate) {
          currentStatus = history.fieldValue;
        } else {
          break;
        }
      }

      /*
       * If there is no previous history,
       * use the first status inside the month.
       */
      if (!currentStatus) {
        const firstHistory = userHistory.find(
          (history) => new Date(history.createdAt) >= startDate,
        );

        if (firstHistory) {
          currentStatus = firstHistory.fieldValue;
        }
      }

      let periodStart = new Date(startDate);

      for (const history of userHistory) {
        const changeDate = new Date(history.createdAt);

        if (changeDate < startDate) {
          continue;
        }

        if (changeDate > endDate) {
          break;
        }

        if (currentStatus && changeDate > periodStart) {
          const periodEnd = new Date(changeDate);
          periodEnd.setDate(periodEnd.getDate() - 1);

          if (periodEnd >= periodStart) {
            const days =
              Math.floor(
                (periodEnd.getTime() - periodStart.getTime()) /
                  (1000 * 60 * 60 * 24),
              ) + 1;

            if (statuses[currentStatus]) {
              statuses[currentStatus].push({
                from: periodStart.toISOString().split("T")[0],
                to: periodEnd.toISOString().split("T")[0],
                days,
              });
            }
          }
        }

        currentStatus = history.fieldValue;

        periodStart = new Date(changeDate);
        periodStart.setHours(0, 0, 0, 0);
      }

      // Close final period
      if (currentStatus && periodStart <= endDate) {
        const days =
          Math.floor(
            (endDate.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24),
          ) + 1;

        if (statuses[currentStatus]) {
          statuses[currentStatus].push({
            from: periodStart.toISOString().split("T")[0],
            to: endDate.toISOString().split("T")[0],
            days,
          });
        }
      }

      employees.push({
        userId: user._id,
        name: `${user.firstName || ""} ${user.lastName || ""}`.trim(),
        statuses,
      });
    }

    return res.status(200).json(
      ApiResponse.success(
        {
          company: {
            companyId: company._id,
            companyName: company.companyName,
          },
          employees,
          pagination: {
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
          },
        },
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
      .json(
        ApiResponse.success({ list, total, stats }, "Invoice fetched"),
      );
  } catch (error) {
    next(error);
  }
};
