import { Request, Response, NextFunction } from "express";

import { AdminModel } from "../../../infrastructure/database/models";
import { ApiResponse } from "../../../shared/response/api-response.js";
import { NotFoundError } from "../../../shared/errors/not-found.error.js";
import { saveFile } from "../../../shared/services/file.service";

export const updateProfile = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const {
            firstName,
            lastName,
            phone,
            companyName,
            companyEmail,
            gstin,
        } = req.body;
        const adminId = req.user?.id;

        const admin = await AdminModel.findById(adminId);

        if (!admin) {
            throw new NotFoundError("Admin not found");
        }

        admin.firstName = firstName ?? admin.firstName;
        admin.lastName = lastName ?? admin.lastName;
        admin.phone = phone ?? admin.phone;

        admin.company.companyName =
            companyName ?? admin.company.companyName;

        admin.company.gstin =
            gstin ?? admin.company.gstin;

        admin.company.companyEmail =
            companyEmail ?? admin.company.companyEmail;


        const files = req.files as {
            profileImage?: Express.Multer.File[];
            companyLogo?: Express.Multer.File[];
        };

        if (files?.profileImage?.[0]) {
            admin.profileImage = saveFile({
                file: files.profileImage[0],
                folder: "admins",
                entityId: admin._id.toString(),
                fileName: "profile",
            });
        }

        if (files?.companyLogo?.[0]) {
            admin.company.companyLogo = saveFile({
                file: files.companyLogo[0],
                folder: "admins",
                entityId: admin._id.toString(),
                fileName: "company-logo",
            });
        }

        await admin.save();

        return res.status(200).json(
            ApiResponse.success(
                admin,
                "Profile updated successfully"
            )
        );
    } catch (error) {
        next(error);
    }
};


export const getProfile = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const admin = await AdminModel.findById(req.user?.id)
            .select("-password");

        if (!admin) {
            throw new NotFoundError("Admin not found");
        }

        return res.status(200).json(
            ApiResponse.success(admin)
        );
    } catch (error) {
        next(error);
    }
};