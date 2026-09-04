import mongoose from "mongoose";
import { NextFunction, Request, Response } from "express";
import bcrypt from "bcrypt";

import { CompanyModel } from "../../../infrastructure/database/models/company.model.js";
import { UserModel } from "../../../infrastructure/database/models/user.model.js";

import { ApiResponse } from "../../../shared/response/api-response.js";
import { saveFile } from "../../../shared/services/file.service.js";
import { status } from "../../../types/types.js";
import { defaultDeduction } from "../../../shared/helpers/defaultDeduction.js";
import { renderEmailTemplate } from "../../../shared/templates/index.js";
import { sendMail } from "../../../shared/services/mail.service.js";
import { generateUserUniqueUserId } from "../../../shared/helpers/generateUserId.js";
import { addUserHistory } from "../../../shared/services/userHistory.service.js";

export const createCompany = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    const {
      companyName,
      gstin,
      companyEmail,
      invoiceEmail,
      companyPhone,
      companyAddress,

      firstName,
      lastName,
      email,
      phone,
      gender,
      address,
      assignedBankAccount,
      generateInvoiceWithGST,

      modules,
      employeePrice,
      productionPrice,
    } = req.body;

    const parsedModules =
      typeof modules === "string"
        ? modules.split(",").map((item: string) => item.trim())
        : modules || [];

    // const existingCompany = await CompanyModel.findOne({
    //   companyEmail,
    // }).session(session);

    // if (existingCompany) {
    //   await session.abortTransaction();
    //   return res.status(400).json(ApiResponse.error("Company already exists"));
    // }

    const existingUser = await UserModel.findOne({
      email: email,
    }).session(session);

    if (existingUser) {
      await session.abortTransaction();

      return res
        .status(400)
        .json(ApiResponse.error("Representative email already exists"));
    }

    const [company] = await CompanyModel.create(
      [
        {
          companyName,
          gstin,
          companyEmail,
          invoiceEmail,
          companyPhone,
          companyAddress,
          assignedBankAccount,
          generateInvoiceWithGST,
          modules: parsedModules,
          employeePrice,
          productionPrice,
        },
      ],
      { session },
    );

    const password =
      firstName.trim().toLowerCase() + "@" + new Date().getFullYear(); // Default password (should be changed by user)
    const hashedPassword = await bcrypt.hash(password, 10);
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
          address,
          role: "OWNER",
        },
      ],
      { session },
    );

    // Link representative user with company
    company.companyRepresentative = user._id;

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

    const userDetails = await user.save({ session });

    const companyDetails = await company.save({
      session,
    });

    userDetails.userId = await generateUserUniqueUserId(
      companyDetails._id.toString(),
      session,
    );

    await addUserHistory(
      {
        userId: userDetails._id.toString(),
        field: "userStatus",
        fieldId: userDetails._id.toString(),
        fieldValue: userDetails.status,
        remarks: "New added",
        assignedBy: "",
      },
      session,
    );
    await userDetails.save({ session });

    const html = renderEmailTemplate("onboarding", {
      companyName: "IEKA",
      userName: firstName + " " + lastName,
      userId: userDetails.userId,
      password: password,
    });

    await sendMail({
      to: user.email,
      subject: `Welcome to IEKA - Your Account Details`,
      html,
    });

    await session.commitTransaction();
    await defaultDeduction(companyDetails._id.toString()); // add default deduction company wise

    return res.status(201).json(
      ApiResponse.success(
        {
          companyId: companyDetails._id,
          representativeId: user._id,
        },
        "Company created successfully",
      ),
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
  next: NextFunction,
) => {
  try {
    const { companyId } = req.params;

    const company = await CompanyModel.findById(companyId);

    if (!company) {
      return res.status(404).json(ApiResponse.error("Company not found"));
    }

    const representative = await UserModel.findById(
      company.companyRepresentative,
    );

    if (!representative) {
      return res
        .status(404)
        .json(ApiResponse.error("Representative not found"));
    }

    const {
      companyName,
      gstin,
      companyEmail,
      invoiceEmail,
      companyPhone,
      companyAddress,
      assignedBankAccount,
      generateInvoiceWithGST,

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
    if (companyName !== undefined) company.companyName = companyName;

    if (gstin !== undefined) company.gstin = gstin;

    if (companyEmail !== undefined) company.companyEmail = companyEmail;
    if (invoiceEmail !== undefined) company.invoiceEmail = invoiceEmail;

    if (companyPhone !== undefined) company.companyPhone = companyPhone;

    if (companyAddress !== undefined) company.companyAddress = companyAddress;

    if (assignedBankAccount !== undefined)
      company.assignedBankAccount = assignedBankAccount;

    if (generateInvoiceWithGST !== undefined)
      company.generateInvoiceWithGST = generateInvoiceWithGST;

    if (employeePrice !== undefined)
      company.employeePrice = Number(employeePrice);

    if (productionPrice !== undefined)
      company.productionPrice = Number(productionPrice);

    if (status !== undefined) company.status = status;

    if (modules !== undefined) {
      company.modules =
        typeof modules === "string"
          ? modules.split(",").map((item: string) => item.trim())
          : modules;
    }

    // Representative fields
    if (firstName !== undefined) representative.firstName = firstName;

    if (lastName !== undefined) representative.lastName = lastName;

    if (phone !== undefined) representative.phone = phone;

    if (gender !== undefined) representative.gender = gender;

    // Email uniqueness check
    if (email && email !== representative.email) {
      const emailExists = await UserModel.findOne({
        email,
        _id: {
          $ne: representative._id,
        },
      });

      if (emailExists) {
        return res.status(400).json(ApiResponse.error("Email already exists"));
      }

      representative.email = email;
    }

    // Company email uniqueness check
    if (companyEmail && companyEmail !== company.companyEmail) {
      const companyExists = await CompanyModel.findOne({
        companyEmail,
        _id: {
          $ne: company._id,
        },
      });

      if (companyExists) {
        return res
          .status(400)
          .json(ApiResponse.error("Company email already exists"));
      }
    }

    const files = req.files as {
      profileImage?: Express.Multer.File[];
      companyLogo?: Express.Multer.File[];
    };

    if (files?.profileImage?.[0]) {
      representative.profileImage = saveFile({
        file: files.profileImage[0],
        folder: "users",
        entityId: representative._id.toString(),
        fileName: "profile",
      });
    }

    if (files?.companyLogo?.[0]) {
      company.companyLogo = saveFile({
        file: files.companyLogo[0],
        folder: "companies",
        entityId: company._id.toString(),
        fileName: "company-logo",
      });
    }

    await Promise.all([company.save(), representative.save()]);

    return res
      .status(200)
      .json(ApiResponse.success(null, "Company updated successfully"));
  } catch (error) {
    next(error);
  }
};

export const getCompanies = async (
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

    const match: any = {};

    if (search) {
      match.companyName = {
        $regex: search,
        $options: "i",
      };
    }

    const [companies, totalResult] = await Promise.all([
      CompanyModel.aggregate([
        // Company filter
        {
          $match: match,
        },

        // Representative
        {
          $lookup: {
            from: "users",
            localField: "companyRepresentative",
            foreignField: "_id",
            as: "companyRepresentative",
          },
        },

        {
          $unwind: {
            path: "$companyRepresentative",
            preserveNullAndEmptyArrays: true,
          },
        },
        ...(status
          ? [
              {
                $match: {
                  "companyRepresentative.status": status,
                },
              },
            ]
          : []),

        // Users belonging to company
        {
          $lookup: {
            from: "users",
            let: {
              companyId: "$_id",
            },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $eq: ["$companyId", "$$companyId"],
                  },
                },
              },
              {
                $group: {
                  _id: null,

                  active: {
                    $sum: {
                      $cond: [{ $eq: ["$status", "ACTIVE"] }, 1, 0],
                    },
                  },

                  inactive: {
                    $sum: {
                      $cond: [{ $eq: ["$status", "INACTIVE"] }, 1, 0],
                    },
                  },

                  deleted: {
                    $sum: {
                      $cond: [{ $eq: ["$status", "DELETED"] }, 1, 0],
                    },
                  },
                },
              },
            ],
            as: "userStats",
          },
        },

        // Convert status array into object
        {
          $addFields: {
            userStats: {
              $ifNull: [
                {
                  $arrayElemAt: ["$userStats", 0],
                },
                {
                  active: 0,
                  inactive: 0,
                  deleted: 0,
                },
              ],
            },
          },
        },

        // Response fields
        {
          $project: {
            companyName: 1,
            companyAddress: 1,
            companyLogo: 1,
            createdAt: 1,

            companyRepresentative: {
              _id: 1,
              firstName: 1,
              lastName: 1,
              profileImage: 1,
              status: 1,
              userId: 1,
            },

            userStats: 1,
          },
        },

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
      ]),

      CompanyModel.countDocuments(match),
    ]);

    return res.status(200).json(
      ApiResponse.success(
        {
          companies,
          total: totalResult,
        },
        "Companies fetched successfully",
      ),
    );
  } catch (error) {
    next(error);
  }
};

export const getCompaniesCount = async (
  req: Request,
  res: Response,
  next: NextFunction,
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
          deleted,
        },
        "Company counts fetched successfully",
      ),
    );
  } catch (error) {
    next(error);
  }
};

export const getCompanyById = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { companyId } = req.params;

    const company = await CompanyModel.findById(companyId)
      .populate("assignedBankAccount")
      .populate("companyRepresentative")
      .lean();

    if (!company) {
      return res.status(404).json(ApiResponse.error("Company not found"));
    }

    return res
      .status(200)
      .json(ApiResponse.success(company, "Company fetched successfully"));
  } catch (error) {
    next(error);
  }
};
