import { NextFunction, Response, Request } from "express";
import { CompanyModel, UserModel } from "../../infrastructure/database/models";
import { ApiResponse } from "../../shared/response/api-response";
import { saveFile } from "../../shared/services/file.service";

export const updateCompanyDetail = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { companyId } = req.user!;

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
      companyPhone,
      companyAddress,
      companyWebsite,
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

    if (companyPhone !== undefined) company.companyPhone = companyPhone;

    if (companyAddress !== undefined) company.companyAddress = companyAddress;
    if (companyWebsite !== undefined) company.companyWebsite = companyWebsite;

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
      .json(ApiResponse.success(null, "Details updated successfully"));
  } catch (error) {
    next(error);
  }
};
