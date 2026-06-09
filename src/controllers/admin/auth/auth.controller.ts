import bcrypt from "bcrypt";
import { NextFunction, Request, Response } from "express";
import { AdminModel } from "../../../infrastructure/database/models/admin.model.js";
import { generateToken } from "../../../shared/utils/jwt";
import { ApiResponse } from "../../../shared/response/api-response.js";


export const login = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const { email, password } = req.body;

        const admin = await AdminModel.findOne({
            email,
        }).select("+password");

        if (!admin) {
            return res.status(400).json({
                success: false,
                message: "Invalid credentials",
            });
        }

        const isPasswordValid =
            await bcrypt.compare(
                password,
                admin.password
            );

        if (!isPasswordValid) {
            return res.status(400).json({
                success: false,
                message: "Invalid credentials",
            });
        }

        const token = generateToken(
            admin._id.toString()
        );

        admin.lastLoginAt = new Date();

        await admin.save();


        const adminRes = {
            _id: admin._id,
            firstName: admin.firstName,
            lastName: admin.lastName,
            email: admin.email,
            profileImage: admin.profileImage,
            company: {
                companyLogo: admin.company.companyLogo
            },
            token
        }

        return res.status(200).json(
            ApiResponse.success(
                adminRes,
                "Login successful"
            )
        );
    } catch (error) {
        next(error);
    }
};

export const createAdmin = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const {
            firstName,
            lastName,
            email,
            password
        } = req.body;

        const existingAdmin =
            await AdminModel.findOne();

        if (existingAdmin) {
            return res.status(400).json(
                ApiResponse.error(
                    "Admin already exists"
                )
            );
        }

        const hashedPassword = await bcrypt.hash(
            password,
            10
        );
        const admin =
            await AdminModel.create({
                firstName,
                lastName,
                email,
                password: hashedPassword
            });

        return res.status(201).json(
            ApiResponse.success(
                {
                    _id: admin._id
                },
                "Admin created successfully"
            )
        );
    } catch (error) {
        next(error);
    }
};


export const changePassword = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const {
            currentPassword,
            newPassword
        } = req.body;

        const admin =
            await AdminModel.findById(
                req.user?.id
            ).select("+password");

        if (!admin) {
            return res.status(404).json(
                ApiResponse.error(
                    "Admin not found"
                )
            );
        }

        const isPasswordValid =
            await bcrypt.compare(
                currentPassword,
                admin.password
            );

        if (!isPasswordValid) {
            return res.status(400).json(
                ApiResponse.error(
                    "Current password is incorrect"
                )
            );
        }

        const hashedPassword = await bcrypt.hash(
            newPassword,
            10
        );

        admin.password = hashedPassword;

        admin.passwordChangedAt =
            new Date();

        await admin.save();

        return res.status(200).json(
            ApiResponse.success(
                null,
                "Password changed successfully"
            )
        );
    } catch (error) {
        next(error);
    }
};