import {
    NextFunction,
    Request,
    Response,
} from "express";

export const authorize =
    (...roles: string[]) =>
    (
        req: Request,
        res: Response,
        next: NextFunction
    ) => {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                message:
                    "Authentication required",
            });
        }

        if (
            !roles.includes(
                req.user.role
            )
        ) {
            return res.status(403).json({
                success: false,
                message: "Forbidden",
            });
        }

        next();
    };