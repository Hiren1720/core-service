import {
    NextFunction,
    Request,
    Response,
} from "express";

import {
    verifyAccessToken,
} from "../shared/utils/jwt.js";
import { UserModel } from "../infrastructure/database/models/index.js";
import { userStatus } from "../types/types.js";

export const authenticateUser = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const authHeader =
            req.headers.authorization;

        if (
            !authHeader ||
            !authHeader.startsWith(
                "Bearer "
            )
        ) {
            return res.status(401).json({
                success: false,
                message:
                    "Authentication required",
            });
        }

        const token =
            authHeader.split(" ")[1];

        const decoded =
            verifyAccessToken(token);

        const user = await UserModel.findOne({
            _id: decoded.userId,
            status: userStatus.ACTIVE,
        }).lean();

        if (!user) {
            res.status(401).json({
                success: false,
                message: "User account is not active",
            });
            return;
        }

        req.user = {
            id: decoded.userId,
            companyId:
                decoded.companyId,
            role: decoded.role,
        };

        next();
    } catch {
        return res.status(401).json({
            success: false,
            message:
                "Invalid or expired token",
        });
    }
};