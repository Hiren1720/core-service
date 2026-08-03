import { NextFunction, Request, Response } from "express";
import { CompanyModel } from "../../infrastructure/database/models";

//api for different latters to be sent to employee
export const getCompanyDetailsforLetters = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const companyId = req.user!.companyId;

    const company = await CompanyModel.findById(companyId)
      .select("-__v -createdAt -updatedAt -employeeStats")
      .lean();

    if (!company) {
      return res.status(404).json({
        success: false,
        message: "Company not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: company,
    });
  } catch (error) {
    next(error);
  }
};
