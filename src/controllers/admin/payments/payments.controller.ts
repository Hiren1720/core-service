import { NextFunction, Request, Response } from "express";
import { ApiResponse } from "../../../shared/response/api-response";
import { InvoiceModel } from "../../../infrastructure/database/models";

export const invoicePayments = async (
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

    if (statusFilter && !["PENDING", "PAID"].includes(statusFilter)) {
      return res.status(400).json(ApiResponse.error("Invalid payment status"));
    }

    const skip = (page - 1) * limit;

    /*
     * -------------------------------------------------------
     * Base filter
     * -------------------------------------------------------
     */
    const matchFilter: any = {
      billingYear: year,
      billingMonth: month,
    };

    /*
     * -------------------------------------------------------
     * Build aggregation
     * -------------------------------------------------------
     *
     * paidAmount is calculated from payments[]
     *
     * totalAmount = ₹10,000
     * payments    = ₹3,000 + ₹2,000
     *
     * paidAmount    = ₹5,000
     * pendingAmount = ₹5,000
     *
     * Therefore invoice is PENDING.
     */

    const pipeline: any[] = [
      {
        $match: matchFilter,
      },

      {
        $addFields: {
          paidAmount: {
            $sum: {
              $ifNull: ["$payments.amount", []],
            },
          },
        },
      },

      {
        $addFields: {
          calculatedPaymentStatus: {
            $cond: [
              {
                $gte: ["$paidAmount", "$totalAmount"],
              },
              "PAID",
              "PENDING",
            ],
          },

          pendingAmount: {
            $max: [
              {
                $subtract: ["$totalAmount", "$paidAmount"],
              },
              0,
            ],
          },
        },
      },
    ];

    /*
     * -------------------------------------------------------
     * Payment status filter
     * -------------------------------------------------------
     */
    if (statusFilter) {
      pipeline.push({
        $match: {
          calculatedPaymentStatus: statusFilter,
        },
      });
    }

    /*
     * -------------------------------------------------------
     * Get total + stats + paginated list
     * -------------------------------------------------------
     */

    pipeline.push({
      $facet: {
        list: [
          {
            $sort: {
              createdAt: -1,
            },
          },

          {
            $skip: skip,
          },

          {
            $limit: limit,
          },

          {
            $project: {
              invoiceNumber: 1,
              status: 1,
              totalAmount: 1,
              payments: 1,

              paidAmount: 1,
              pendingAmount: 1,
              calculatedPaymentStatus: 1,

              companyId: 1,
            },
          },
        ],

        total: [
          {
            $count: "count",
          },
        ],

        stats: [
          {
            $group: {
              _id: null,

              totalAmount: {
                $sum: "$totalAmount",
              },

              paidAmount: {
                $sum: "$paidAmount",
              },

              pendingAmount: {
                $sum: "$pendingAmount",
              },
            },
          },

          {
            $project: {
              _id: 0,
              totalAmount: 1,
              paidAmount: 1,
              pendingAmount: 1,
            },
          },
        ],
      },
    });

    const [result] = await InvoiceModel.aggregate(pipeline);

    const list = result?.list || [];

    const total = result?.total?.[0]?.count || 0;

    const stats = result?.stats?.[0] || {
      totalAmount: 0,
      paidAmount: 0,
      pendingAmount: 0,
    };

    /*
     * -------------------------------------------------------
     * Populate company manually
     * -------------------------------------------------------
     *
     * aggregate() does not support Mongoose populate().
     */

    const populatedList = await InvoiceModel.populate(list, {
      path: "companyId",
      select: "companyName companyAddress companyLogo companyRepresentative",
      populate: {
        path: "companyRepresentative",
        select: "firstName lastName profileImage",
      },
    });

    return res.status(200).json(
      ApiResponse.success(
        {
          list: populatedList,
          total,
          stats,
        },
        "Invoice fetched",
      ),
    );
  } catch (error) {
    next(error);
  }
};
