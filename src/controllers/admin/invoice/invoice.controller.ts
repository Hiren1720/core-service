import { NextFunction, Request, Response } from "express";
import { ApiResponse } from "../../../shared/response/api-response";
import {
  AdminModel,
  InvoiceModel,
  MonthlyEmployeeSnapshotModel,
} from "../../../infrastructure/database/models";
import { Types } from "mongoose";
import path from "path";
import { saveFile } from "../../../shared/services/file.service.js";
import { sendMail } from "../../../shared/services/mail.service.js";
import { renderEmailTemplate } from "../../../shared/templates/index.js";

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
          select: "firstName lastName profileImage role status userId",
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

    const [list, total, amount, generated, sended] = await Promise.all([
      InvoiceModel.find(filter)
        .select(
          "invoiceNumber status totalAmount mailSentRemarks mailSentAt generatedAt ",
        )
        .populate({
          path: "companyId",
          select: "companyName companyAddress companyLogo",
          populate: [
            {
              path: "companyRepresentative",
              select: "firstName lastName profileImage userId",
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
      InvoiceModel.countDocuments({ status: "GENERATED" }),
      InvoiceModel.countDocuments({ status: "SENDED" }),
    ]);

    const stats = {
      generated: amount.find((a) => a._id === "GENERATED")?.totalAmount || 0,
      sended: amount.find((a) => a._id === "SENDED")?.totalAmount || 0,
      total: amount.reduce((acc, a) => acc + a.totalAmount, 0),
    };

    const counts = {
      generated,
      sended,
      total: generated + sended,
    };

    return res
      .status(200)
      .json(
        ApiResponse.success({ list, total, stats, counts }, "Invoice fetched"),
      );
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
    const invoiceId = req.params.invoiceId as string;

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
            select: "firstName lastName profileImage userId",
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

export const sendInvoice = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { remarks } = req.body;
    const invoiceId = req.params.invoiceId as string;

    if (!Types.ObjectId.isValid(invoiceId)) {
      return res.status(400).json(ApiResponse.error("Invalid invoice ID"));
    }

    const invoice = await InvoiceModel.findById(invoiceId)
      .populate("companyId", "companyName invoiceEmail")
      .exec();

    if (!invoice) {
      return res.status(404).json(ApiResponse.error("Invoice not found"));
    }

    const company = invoice.companyId as unknown as {
      companyName: string;
      invoiceEmail?: string | null;
    };
    const file = req.file;

    if (!file || file.mimetype !== "application/pdf") {
      return res
        .status(400)
        .json(ApiResponse.error("A PDF invoice file is required"));
    }

    if (!company.invoiceEmail) {
      return res
        .status(400)
        .json(ApiResponse.error("Company invoice email is not configured"));
    }

    const invoicePdf = saveFile({
      file,
      folder: "invoices",
      entityId: invoice._id.toString(),
      fileName: "invoice",
    });
    const attachmentPath = path.join(process.cwd(), "public", invoicePdf);
    const html = renderEmailTemplate("invoice", {
      companyName: company.companyName,
      invoiceNumber: invoice.invoiceNumber,
      billingMonth: invoice.billingMonth,
      billingYear: invoice.billingYear,
      totalAmount: invoice.totalAmount.toFixed(2),
    });

    await sendMail({
      to: company.invoiceEmail,
      subject: `Invoice ${invoice.invoiceNumber}`,
      html,
      attachments: [
        {
          filename: `${invoice.invoiceNumber}.pdf`,
          path: attachmentPath,
        },
      ],
    });

    invoice.invoicePdf = invoicePdf;
    invoice.status = "SENDED";
    invoice.mailSentAt = new Date();
    invoice.mailSentRemarks = remarks;
    await invoice.save();

    return res
      .status(200)
      .json(
        ApiResponse.success(
          { invoiceId: invoice._id, status: invoice.status },
          "Invoice sent successfully",
        ),
      );
  } catch (error) {
    next(error);
  }
};
