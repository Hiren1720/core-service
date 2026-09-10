import { Request, Response, NextFunction } from "express";

import {
  BankAccountModel,
  CompanyModel,
} from "../../../infrastructure/database/models";
import { ApiResponse } from "../../../shared/response/api-response.js";
import { status } from "../../../types/types";

export const createBankAccount = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { bankAccountNo, ifscCode, accountHolderName, accountType } =
      req.body;

    const bankAccount = await BankAccountModel.findOne({
      accountNo: bankAccountNo,
    });
    if (bankAccount) {
      return res
        .status(400)
        .json(
          ApiResponse.error(
            "Bank account with this account number already exists",
          ),
        );
    }

    const newBankAccount = new BankAccountModel({
      accountNo: bankAccountNo,
      ifscCode,
      accountHolderName,
      accountType,
    });

    await newBankAccount.save();

    return res
      .status(200)
      .json(
        ApiResponse.success(
          newBankAccount,
          "Bank account created successfully",
        ),
      );
  } catch (error) {
    next(error);
  }
};

export const getBankAccounts = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const match: Record<string, any> = {};

    if (req.query.status) {
      match["status"] = req.query.status as status;
    }

    const bankAccounts = await BankAccountModel.find(match);

    return res
      .status(200)
      .json(
        ApiResponse.success(
          bankAccounts,
          "Bank accounts retrieved successfully",
        ),
      );
  } catch (error) {
    next(error);
  }
};

export const updateBankAccount = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const bankAccountId = req.params.id;
    const { bankAccountNo, ifscCode, accountHolderName, accountType, status } =
      req.body;

    const bankAccount = await BankAccountModel.findById(bankAccountId);

    if (!bankAccount) {
      return res.status(404).json(ApiResponse.error("Bank account not found"));
    }

    if (status === "DELETED" || status === "INACTIVE") {
      const assigned = await CompanyModel.find({
        assignedBankAccount: bankAccount._id,
      }).lean();
      if (assigned) {
        return res
          .status(404)
          .json(ApiResponse.error("Account assigned to companies"));
      }
      if (status === "DELETED") {
        await BankAccountModel.findByIdAndDelete(bankAccount._id);
        return res
          .status(200)
          .json(ApiResponse.success(null, "Account Deleted successfully"));
      }
    }

    if (
      bankAccountNo !== undefined &&
      bankAccountNo !== bankAccount.accountNo
    ) {
      const existingBankAccount = await BankAccountModel.findOne({
        accountNo: bankAccountNo,
        _id: { $ne: bankAccountId },
      });

      if (existingBankAccount) {
        return res
          .status(400)
          .json(
            ApiResponse.error(
              "Bank account with this account number already exists",
            ),
          );
      }
    }

    if (bankAccountNo !== undefined) bankAccount.accountNo = bankAccountNo;
    if (ifscCode !== undefined) bankAccount.ifscCode = ifscCode;
    if (accountHolderName !== undefined)
      bankAccount.accountHolderName = accountHolderName;
    if (accountType !== undefined) bankAccount.accountType = accountType;
    if (status !== undefined) bankAccount.status = status;

    await bankAccount.save();

    return res
      .status(200)
      .json(
        ApiResponse.success(
          bankAccount,
          "Bank account details updated successfully",
        ),
      );
  } catch (error) {
    next(error);
  }
};
