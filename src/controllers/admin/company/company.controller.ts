import mongoose from "mongoose";
import { NextFunction, Request, Response } from "express";
import bcrypt from "bcrypt";

import { CompanyModel } from "../../../infrastructure/database/models/company.model.js";
import { UserModel } from "../../../infrastructure/database/models/user.model.js";

import { ApiResponse } from "../../../shared/response/api-response.js";
import { saveFile } from "../../../shared/services/file.service.js";
import { userStatus } from "../../../types/types.js";
import { defaultDeduction } from "../../../shared/helpers/defaultDeduction.js";
import { renderEmailTemplate } from "../../../shared/templates/index.js";
import { sendMail } from "../../../shared/services/mail.service.js";
import { generateUserUniqueUserId } from "../../../shared/helpers/generateUserId.js";
import { addUserHistory } from "../../../shared/services/userHistory.service.js";
import { UserSessionModel } from "../../../infrastructure/database/models/userSession.model.js";

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

      remarks,
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

    const userId = await generateUserUniqueUserId(
      company._id.toString(),
      session,
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
          address,
          userId,
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

    await addUserHistory(
      {
        userId: userDetails._id.toString(),
        field: "userStatus",
        fieldId: userDetails._id.toString(),
        fieldValue: userDetails.status,
        remarks: remarks,
        assignedBy: userDetails._id.toString(),
      },
      session,
    );

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
    const companyCounts = await CompanyModel.aggregate([
      {
        $lookup: {
          from: "users",
          localField: "companyRepresentative",
          foreignField: "_id",
          as: "companyRepresentative",
        },
      },
      {
        $unwind: "$companyRepresentative",
      },
      {
        $group: {
          _id: "$companyRepresentative.status",
          count: { $sum: 1 },
        },
      },
    ]);

    const counts = companyCounts.reduce(
      (result, item) => {
        if (item._id === userStatus.ACTIVE) result.active = item.count;
        if (item._id === userStatus.INACTIVE) result.inactive = item.count;
        if (item._id === userStatus.DELETED) result.deleted = item.count;
        return result;
      },
      { active: 0, inactive: 0, deleted: 0 },
    );

    return res.status(200).json(
      ApiResponse.success(
        {
          total: counts.active + counts.inactive + counts.deleted,
          ...counts,
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

export const companyStatusChange = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { status, remarks } = req.body;

    const owner = await UserModel.findOne({
      _id: req.params.userId,
      role: "OWNER",
    });

    if (!owner) {
      return res.status(404).json(ApiResponse.error("Owner not found"));
    }

    // Update owner status
    await UserModel.findByIdAndUpdate(owner._id, {
      status,
    });

    // Owner inactive → deactivate all active employees/managers
    if (status === userStatus.INACTIVE) {
      // Get only users whose status will actually change
      const employees = await UserModel.find({
        companyId: owner.companyId,
        _id: { $ne: owner._id },
        role: { $in: ["EMPLOYEE", "MANAGER"] },
        status: userStatus.ACTIVE,
      }).select("_id");

      if (employees.length) {
        const employeeIds = employees.map((employee) => employee._id);

        // Deactivate employees/managers
        await UserModel.updateMany(
          {
            _id: { $in: employeeIds },
          },
          {
            $set: {
              status: userStatus.INACTIVE,
            },
          },
        );

        // Logout affected users
        await UserSessionModel.deleteMany({
          userId: {
            $in: employeeIds,
          },
        });

        // Add history for every affected employee/manager
        await Promise.all(
          employees.map((employee) =>
            addUserHistory({
              userId: employee._id.toString(),
              field: "userStatus",
              fieldId: employee._id.toString(),
              fieldValue: userStatus.INACTIVE,
              remarks:
                remarks ||
                "Status changed because company owner was made inactive.",
              assignedBy: owner._id.toString(),
            }),
          ),
        );
      }

      // Owner history
      await addUserHistory({
        userId: owner._id.toString(),
        field: "userStatus",
        fieldId: owner._id.toString(),
        fieldValue: status,
        remarks,
        assignedBy: owner._id.toString(),
      });
    } else if (status === userStatus.DELETED) {
      const companyId = owner.companyId;
      const userIds = (await UserModel.distinct("_id", {
        companyId,
      })) as mongoose.Types.ObjectId[];

      const userIdStrings = userIds.map((userId) => userId.toString());

      await Promise.all(
        Object.entries(mongoose.connection.collections)
          .filter(([name]) => name !== "admins")
          .map(([, collection]) =>
            collection.deleteMany({
              $or: [
                { _id: companyId },
                { companyId },
                { userId: { $in: userIds } },
                { assignedBy: { $in: userIds } },
                { reportingManagerId: { $in: userIds } },
                { fieldId: { $in: userIdStrings } },
              ],
            }),
          ),
      );

      return res
        .status(200)
        .json(ApiResponse.success(null, "Company deleted successfully"));
    } else {
      // Owner history
      await addUserHistory({
        userId: owner._id.toString(),
        field: "userStatus",
        fieldId: owner._id.toString(),
        fieldValue: status,
        remarks,
        assignedBy: owner._id.toString(),
      });
    }

    return res
      .status(200)
      .json(ApiResponse.success(null, "Company status updated successfully"));
  } catch (error) {
    next(error);
  }
};
