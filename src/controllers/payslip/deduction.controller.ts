import { NextFunction, Request, Response } from "express";
import { ApiResponse } from "../../shared/response/api-response";
import { DeductionModel } from "../../infrastructure/database/models";

export const createDeduction = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { details, incomeDetails } = req.body;

    const deduction = await DeductionModel.create({
      companyId: req.user!.companyId,
      incomeDetails,
      details,
    });

    return res
      .status(201)
      .json(ApiResponse.success(deduction, "Deduction created successfully"));
  } catch (error) {
    next(error);
  }
};


export const getDeduction = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const deduction = await DeductionModel.findOne({
      companyId: req.user!.companyId,
    });

    if (!deduction) {
      return res.status(404).json(ApiResponse.error("Deduction not found"));
    }

    return res
      .status(200)
      .json(ApiResponse.success(deduction, "Deduction fetched successfully"));
  } catch (error) {
    next(error);
  }
};


export const updateDeduction = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const deduction = await DeductionModel.findOne({
      companyId: req.user!.companyId,
    });

    if (!deduction) {
      return res.status(404).json(ApiResponse.error("Deduction not found"));
    }

    const { details, incomeDetails } = req.body;

    if (incomeDetails !== undefined) deduction.incomeDetails = incomeDetails;

    if (details !== undefined) deduction.details = details;

    await deduction.save();

    return res
      .status(200)
      .json(ApiResponse.success(null, "Deduction updated successfully"));
  } catch (error) {
    next(error);
  }
};