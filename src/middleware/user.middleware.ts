import {
    NextFunction,
    Request,
    Response,
} from "express";

import {
    verifyAccessToken,
} from "../shared/utils/jwt.js";

export const authenticateUser = (
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