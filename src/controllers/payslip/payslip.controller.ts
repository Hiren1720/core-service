import { NextFunction, Request, Response } from "express";
import { ApiResponse } from "../../shared/response/api-response";
import { PayslipModel } from "../../infrastructure/database/models";
import { status } from "../../types/types";
import { addUserHistory } from "../../shared/services/userHistory.service";
import { downloadCsv } from "../../shared/utils/csvDownload";

export const createPayslip = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { name, details } = req.body;

    const payslip = await PayslipModel.create({
      companyId: req.user!.companyId,
      name,
      details,
    });

    return res
      .status(201)
      .json(ApiResponse.success(payslip, "Payslip created successfully"));
  } catch (error) {
    next(error);
  }
};

export const getPayslips = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 10;

    const skip = (page - 1) * limit;

    const search = req.query.search?.toString() || "";
    const status = req.query.status?.toString();
    const isDownload = req.query.isDownload === "true";
    const csvPassword = req.query.csvPassword  ? String(req.query.csvPassword) : undefined;

    const filter: any = {
      companyId: req.user!.companyId,
      status: { $ne: "DELETED" as status },
    };

    if (search) {
      filter.name = {
        $regex: search,
        $options: "i",
      };
    }

    if (status) {
      filter.status = status;
    }

    const payslipsQuery = PayslipModel.find(filter)
      .sort({
        createdAt: -1,
      })
      .lean();

    if (!isDownload) {
      payslipsQuery.skip(skip).limit(limit);
    }

    const [payslips, total] = await Promise.all([
      payslipsQuery,
      PayslipModel.countDocuments(filter),
    ]);

    if (isDownload) {
      // Get all unique component names
      const detailNames = [
        ...new Set(
          payslips.flatMap((payslip: any) =>
            payslip.details.map((detail: any) => detail.name),
          ),
        ),
      ];

      const data = payslips.map((payslip: any) => {
        const row: Record<string, any> = {
          Name: payslip.name,
          Status: payslip.status,
        };

        // Initialize every component column
        for (const detailName of detailNames) {
          row[detailName] = "";
        }

        // Fill component values
        for (const detail of payslip.details) {
          row[detail.name] =
            detail.value !== null && detail.value !== undefined
              ? `${detail.value}${detail.valueType === "PERCENTAGE" ? "%" : ""}`
              : "";
        }

        return row;
      });

      return downloadCsv(res, data, "payslips", csvPassword);
    }

    return res.status(200).json(
      ApiResponse.success(
        {
          payslips,
          total,
        },
        "Payslips fetched successfully",
      ),
    );
  } catch (error) {
    next(error);
  }
};

export const getPayslipsCount = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const filter: any = {
      companyId: req.user!.companyId,
    };

    const [active, inactive] = await Promise.all([
      PayslipModel.countDocuments({ ...filter, status: "ACTIVE" as status }),
      PayslipModel.countDocuments({ ...filter, status: "INACTIVE" as status }),
      // PayslipModel.countDocuments({ ...filter, status: "DELETED" as status }),
    ]);

    return res.status(200).json(
      ApiResponse.success(
        {
          total: active + inactive,
          active,
          inactive,
          // deleted,
        },
        "Payslip counts fetched successfully",
      ),
    );
  } catch (error) {
    next(error);
  }
};

export const getPayslipById = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const payslip = await PayslipModel.findOne({
      _id: req.params.payslipId,
      companyId: req.user!.companyId,
    });

    if (!payslip) {
      return res.status(404).json(ApiResponse.error("Payslip not found"));
    }

    return res
      .status(200)
      .json(ApiResponse.success(payslip, "Payslip fetched successfully"));
  } catch (error) {
    next(error);
  }
};

export const updatePayslip = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const payslip = await PayslipModel.findOne({
      _id: req.params.payslipId,
      companyId: req.user!.companyId,
    });

    if (!payslip) {
      return res.status(404).json(ApiResponse.error("Payslip not found"));
    }

    const { name, details } = req.body;

    if (name !== undefined) payslip.name = name;

    if (details !== undefined) payslip.details = details;

    await payslip.save();

    return res
      .status(200)
      .json(ApiResponse.success(null, "Payslip updated successfully"));
  } catch (error) {
    next(error);
  }
};

export const updatePayslipStatus = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { status, remarks } = req.body;
    const assignedBy = req.user!.id;

    const payslip = await PayslipModel.findOne({
      _id: req.params.payslipId,
      companyId: req.user!.companyId,
    });

    if (!payslip) {
      return res.status(404).json(ApiResponse.error("Payslip not found"));
    }

    payslip.status = status;

    await addUserHistory({
      userId: req.user!.id as string,
      field: "payslipStatus",
      fieldValue: status,
      fieldId: payslip._id.toString(),
      remarks,
      assignedBy,
    });
    await payslip.save();

    return res
      .status(200)
      .json(ApiResponse.success(null, "Status updated successfully"));
  } catch (error) {
    next(error);
  }
};
