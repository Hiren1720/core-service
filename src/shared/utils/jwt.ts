import jwt from "jsonwebtoken";
import { env } from "../../config/env.js";

interface AccessTokenPayload {
    userId: string;
    companyId: string;
    role: string;
}

interface RefreshTokenPayload {
    userId: string;
}

export const generateAccessToken = (
    payload: AccessTokenPayload
) => {
    return jwt.sign(
        payload,
        env.JWT_ACCESS_SECRET,
        {
            expiresIn: "30d",
        }
    );
};

export const generateRefreshToken = (
    payload: RefreshTokenPayload
) => {
    return jwt.sign(
        payload,
        env.JWT_REFRESH_SECRET,
        {
            expiresIn: "30d",
        }
    );
};

export const verifyAccessToken = (
    token: string
) => {
    return jwt.verify(
        token,
        env.JWT_ACCESS_SECRET!,
    ) as AccessTokenPayload;
};

export const verifyRefreshToken = (
    token: string
) => {
    return jwt.verify(
        token,
        env.JWT_REFRESH_SECRET!,
    ) as RefreshTokenPayload;
};