import mongoose from "mongoose";
import { NextFunction, Request, Response } from "express";
import bcrypt from "bcrypt";

import { CompanyModel } from "../../../infrastructure/database/models/company.model.js";
import { UserModel } from "../../../infrastructure/database/models/user.model.js";

import { ApiResponse } from "../../../shared/response/api-response.js";
import { saveFile } from "../../../shared/services/file.service.js";
import { status } from "../../../types/types.js";

export const createCompany = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    const session = await mongoose.startSession();

    try {
        session.startTransaction();

        const {
            companyName,
            gstin,
            companyEmail,
            companyPhone,
            companyAddress,

            firstName,
            lastName,
            email,
            phone,
            gender,
            assignedBankAccount,

            modules,
            employeePrice,
            productionPrice
        } = req.body;

        const parsedModules =
            typeof modules === "string"
                ? modules.split(",").map((item: string) => item.trim())
                : modules || [];

        const existingCompany = await CompanyModel.findOne({
            companyEmail,
        }).session(session);

        if (existingCompany) {
            await session.abortTransaction();

            return res.status(400).json(
                ApiResponse.error(
                    "Company already exists"
                )
            );
        }

        const existingUser = await UserModel.findOne({
            email: email,
        }).session(session);

        if (existingUser) {
            await session.abortTransaction();

            return res.status(400).json(
                ApiResponse.error(
                    "Representative email already exists"
                )
            );
        }

        const [company] = await CompanyModel.create(
            [
                {
                    companyName,
                    gstin,
                    companyEmail,
                    companyPhone,
                    companyAddress,
                    assignedBankAccount,
                    modules: parsedModules,
                    employeePrice,
                    productionPrice,
                    employeeStats: {
                        active: 1,
                        inactive: 0,
                        deleted: 0,
                    }
                },
            ],
            { session }
        );

        const password = firstName.trim().toLowerCase() + "@" + new Date().getFullYear(); // Default password (should be changed by user)
        const hashedPassword = await bcrypt.hash(
            password,
            10
        );
        const [user] = await UserModel.create(
            [
                {
                    firstName: firstName,
                    lastName: lastName,
                    email: email,
                    phone: phone,
                    gender,
                    password: hashedPassword,
                    companyId: company._id,
                },
            ],
            { session }
        );

        // Link representative user with company
        company.companyRepresentative =
            user._id;

        const files = req.files as {
            profileImage?: Express.Multer.File[];
            companyLogo?: Express.Multer.File[];
        };

        // Save representative profile image
        if (files?.profileImage?.[0]) {
            user.profileImage = saveFile({
                file: files.profileImage[0],
                folder: "users",
                entityId: user._id.toString(),
                fileName: "profile",
            });
        }

        // Save company logo
        if (files?.companyLogo?.[0]) {
            company.companyLogo = saveFile({
                file: files.companyLogo[0],
                folder: "companies",
                entityId: company._id.toString(),
                fileName: "company-logo",
            });
        }

        await user.save({ session });

        await company.save({
            session,
        });

        await session.commitTransaction();

        return res.status(201).json(
            ApiResponse.success(
                {
                    companyId: company._id,
                    representativeId:
                        user._id,
                },
                "Company created successfully"
            )
        );
    } catch (error) {
        await session.abortTransaction();
        next(error);
    } finally {
        await session.endSession();
    }
};


export const updateCompany = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const { companyId } = req.params;

        const company = await CompanyModel.findById(
            companyId
        );

        if (!company) {
            return res.status(404).json(
                ApiResponse.error(
                    "Company not found"
                )
            );
        }

        const representative =
            await UserModel.findById(
                company.companyRepresentative
            );

        if (!representative) {
            return res.status(404).json(
                ApiResponse.error(
                    "Representative not found"
                )
            );
        }

        const {
            companyName,
            gstin,
            companyEmail,
            companyPhone,
            companyAddress,
            assignedBankAccount,

            firstName,
            lastName,
            email,
            phone,
            gender,

            modules,
            employeePrice,
            productionPrice,
            status,
        } = req.body;

        // Company fields
        if (companyName !== undefined)
            company.companyName = companyName;

        if (gstin !== undefined)
            company.gstin = gstin;

        if (companyEmail !== undefined)
            company.companyEmail = companyEmail;

        if (companyPhone !== undefined)
            company.companyPhone = companyPhone;

        if (companyAddress !== undefined)
            company.companyAddress =
                companyAddress;

        if (assignedBankAccount !== undefined)
            company.assignedBankAccount =
                assignedBankAccount;

        if (employeePrice !== undefined)
            company.employeePrice =
                Number(employeePrice);

        if (productionPrice !== undefined)
            company.productionPrice =
                Number(productionPrice);

        if (status !== undefined)
            company.status = status;

        if (modules !== undefined) {
            company.modules =
                typeof modules === "string"
                    ? modules
                        .split(",")
                        .map((item: string) =>
                            item.trim()
                        )
                    : modules;
        }

        // Representative fields
        if (firstName !== undefined)
            representative.firstName =
                firstName;

        if (lastName !== undefined)
            representative.lastName =
                lastName;

        if (phone !== undefined)
            representative.phone = phone;

        if (gender !== undefined)
            representative.gender = gender;

        // Email uniqueness check
        if (
            email &&
            email !== representative.email
        ) {
            const emailExists =
                await UserModel.findOne({
                    email,
                    _id: {
                        $ne:
                            representative._id,
                    },
                });

            if (emailExists) {
                return res.status(400).json(
                    ApiResponse.error(
                        "Email already exists"
                    )
                );
            }

            representative.email = email;
        }

        // Company email uniqueness check
        if (
            companyEmail &&
            companyEmail !==
            company.companyEmail
        ) {
            const companyExists =
                await CompanyModel.findOne({
                    companyEmail,
                    _id: {
                        $ne: company._id,
                    },
                });

            if (companyExists) {
                return res.status(400).json(
                    ApiResponse.error(
                        "Company email already exists"
                    )
                );
            }
        }

        const files = req.files as {
            profileImage?: Express.Multer.File[];
            companyLogo?: Express.Multer.File[];
        };

        if (files?.profileImage?.[0]) {
            representative.profileImage =
                saveFile({
                    file: files.profileImage[0],
                    folder: "users",
                    entityId:
                        representative._id.toString(),
                    fileName: "profile",
                });
        }

        if (files?.companyLogo?.[0]) {
            company.companyLogo =
                saveFile({
                    file: files.companyLogo[0],
                    folder: "companies",
                    entityId:
                        company._id.toString(),
                    fileName: "company-logo",
                });
        }

        await Promise.all([
            company.save(),
            representative.save(),
        ]);

        return res.status(200).json(
            ApiResponse.success(
                null,
                "Company updated successfully"
            )
        );
    } catch (error) {
        next(error);
    }
};


export const getCompanies = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const page =
            Number(req.query.page) || 1;

        const limit =
            Number(req.query.limit) || 10;

        const skip =
            (page - 1) * limit;

        const search =
            req.query.search?.toString() || "";

        const status =
            req.query.status?.toString();

        const match: any = {};

        if (search) {
            match.companyName = {
                $regex: search,
                $options: "i",
            };
        }

        if (status) {
            match.status = status;
        }

        const [companies, totalResult] =
            await Promise.all([
                CompanyModel.find(match)
                    .populate({
                        path: "companyRepresentative",
                        select: "firstName lastName profileImage",
                    })
                    .select("companyName companyAddress companyLogo status employeeStats createdAt")
                    .sort({ createdAt: -1 })
                    .skip(skip)
                    .limit(limit)
                    .lean(),

                CompanyModel.countDocuments(
                    match
                ),
            ]);

        return res.status(200).json(
            ApiResponse.success(
                {
                    companies,
                    total: totalResult,
                },
                "Companies fetched successfully"
            )
        );
    } catch (error) {
        next(error);
    }
};

export const getCompaniesCount = async (req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const [active, inactive, deleted] = await Promise.all([
            CompanyModel.countDocuments({ status: "ACTIVE" as status }),
            CompanyModel.countDocuments({ status: "INACTIVE" as status }),
            CompanyModel.countDocuments({ status: "DELETED" as status }),
        ]);

        return res.status(200).json(
            ApiResponse.success(
                {
                    total: active + inactive + deleted,
                    active,
                    inactive,
                    deleted
                },
                "Company counts fetched successfully"
            )
        );
    } catch (error) {
        next(error);
    }
}