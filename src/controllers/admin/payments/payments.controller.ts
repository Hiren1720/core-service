import { NextFunction, Request, Response } from "express";
import { ApiResponse } from "../../../shared/response/api-response";
import { InvoiceModel } from "../../../infrastructure/database/models";
import { Types } from "mongoose";

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
      status: "SENDED"
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
          paymentStatus: statusFilter,
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
              paymentStatus: 1,
              paidAmount: 1,
              pendingAmount: 1,

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

    const [populatedList, pending, paid] = await Promise.all([
      InvoiceModel.populate(list, {
        path: "companyId",
        select: "companyName companyAddress companyLogo companyRepresentative",
        populate: {
          path: "companyRepresentative",
          select: "firstName lastName profileImage userId",
        },
      }),
      InvoiceModel.countDocuments({ paymentStatus: "PENDING" }),
      InvoiceModel.countDocuments({ paymentStatus: "PAID" }),
    ]);

    const counts = {
      pending,
      paid,
      total: pending + paid,
    };

    return res.status(200).json(
      ApiResponse.success(
        {
          list: populatedList,
          total,
          stats,
          counts,
        },
        "Invoice fetched",
      ),
    );
  } catch (error) {
    next(error);
  }
};

export const addInvoicePayment = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { invoiceId } = req.params;

    const { paymentMode, amount, transactionId, remarks, date } = req.body;

    /*
     * -------------------------------------------------------
     * Validate invoice ID
     * -------------------------------------------------------
     */

    if (!Types.ObjectId.isValid(invoiceId as string)) {
      return res.status(400).json(ApiResponse.error("Invalid invoice ID"));
    }

    /*
     * -------------------------------------------------------
     * Validate amount
     * -------------------------------------------------------
     */

    const paymentAmount = Number(amount);

    if (!paymentAmount || paymentAmount <= 0) {
      return res
        .status(400)
        .json(ApiResponse.error("Valid payment amount is required"));
    }

    /*
     * -------------------------------------------------------
     * Find invoice
     * -------------------------------------------------------
     */

    const invoice = await InvoiceModel.findById(invoiceId);

    if (!invoice) {
      return res.status(404).json(ApiResponse.error("Invoice not found"));
    }

    /*
     * -------------------------------------------------------
     * Calculate already received amount
     * -------------------------------------------------------
     */

    const receivedAmount = (invoice.payments || []).reduce(
      (total, payment) => total + Number(payment.amount || 0),
      0,
    );

    /*
     * -------------------------------------------------------
     * Check if invoice is already fully paid
     * -------------------------------------------------------
     */

    if (receivedAmount >= invoice.totalAmount) {
      return res
        .status(400)
        .json(ApiResponse.error("Invoice is already fully paid"));
    }

    /*
     * -------------------------------------------------------
     * Remaining amount
     * -------------------------------------------------------
     */

    const pendingAmount = invoice.totalAmount - receivedAmount;

    /*
     * Don't allow payment greater than pending amount.
     *
     * Example:
     *
     * Invoice = ₹10,000
     * Received = ₹7,000
     * Pending = ₹3,000
     *
     * Admin cannot add ₹4,000.
     */

    if (paymentAmount > pendingAmount) {
      return res
        .status(400)
        .json(
          ApiResponse.error(
            `Payment amount cannot exceed pending amount of ${pendingAmount}`,
          ),
        );
    }

    /*
     * -------------------------------------------------------
     * Add payment
     * -------------------------------------------------------
     */

    invoice.payments.push({
      paymentMode,
      amount: paymentAmount,
      transactionId: transactionId || null,
      remarks: remarks || null,
      date: date ? new Date(date) : new Date(),
    });

    /*
     * -------------------------------------------------------
     * Calculate new received amount
     * -------------------------------------------------------
     */

    const newReceivedAmount = receivedAmount + paymentAmount;

    /*
     * -------------------------------------------------------
     * Update payment status
     * -------------------------------------------------------
     */

    invoice.paymentStatus =
      newReceivedAmount >= invoice.totalAmount ? "PAID" : "PENDING";

    await invoice.save();

    /*
     * -------------------------------------------------------
     * Response
     * -------------------------------------------------------
     */

    return res.status(200).json(
      ApiResponse.success(
        {
          invoiceId: invoice._id,
          invoiceNumber: invoice.invoiceNumber,
          totalAmount: invoice.totalAmount,
          paidAmount: newReceivedAmount,
          pendingAmount: Math.max(invoice.totalAmount - newReceivedAmount, 0),
          paymentStatus: invoice.paymentStatus,
          payments: invoice.payments,
        },
        "Payment added successfully",
      ),
    );
  } catch (error) {
    next(error);
  }
};
