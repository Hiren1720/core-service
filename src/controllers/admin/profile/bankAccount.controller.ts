import { Request, Response, NextFunction } from "express";

import { BankAccountModel } from "../../../infrastructure/database/models";
import { ApiResponse } from "../../../shared/response/api-response.js";
import { status } from "../../../types/types";

export const createBankAccount = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const {
            bankAccountNo,
            ifscCode,
            accountHolderName,
            accountType,
        } = req.body;

        const bankAccount = await BankAccountModel.findOne({ accountNo: bankAccountNo });
        if (bankAccount) {
            return res.status(400).json(
                ApiResponse.error(
                    "Bank account with this account number already exists"
                )
            );
        }

        const newBankAccount = new BankAccountModel({
            accountNo: bankAccountNo,
            ifscCode,
            accountHolderName,
            accountType,
        });

        await newBankAccount.save();

        return res.status(200).json(
            ApiResponse.success(
                newBankAccount,
                "Bank account created successfully"
            )
        );
    } catch (error) {
        next(error);
    }
};


export const getBankAccounts = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const match: Record<string, any> = {};

        if (req.query.status) {
            match["status"] = req.query.status as status;
        };

        const bankAccounts = await BankAccountModel.find(match);

        return res.status(200).json(
            ApiResponse.success(
                bankAccounts,
                "Bank accounts retrieved successfully"
            )
        );
    } catch (error) {
        next(error);
    }
}

export const updateBankAccountStatus = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const bankAccountId = req.params.id;
        const { status } = req.body;

        const bankAccount = await BankAccountModel.findById(bankAccountId);

        if (!bankAccount) {
            return res.status(404).json(
                ApiResponse.error(
                    "Bank account not found"
                )
            );
        }

        bankAccount.status = status;

        await bankAccount.save();

        return res.status(200).json(
            ApiResponse.success(
                bankAccount,
                "Bank account status updated successfully"
            )
        );

    } catch (error) {
        next(error);
    }
}