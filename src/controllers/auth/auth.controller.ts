import bcrypt from "bcrypt";
import crypto from "crypto";
import { Request, Response, NextFunction } from "express";

import {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
} from "../../shared/utils/jwt.js";

import { ApiResponse } from "../../shared/response/api-response.js";
import {
  UserModel,
  UserSessionModel,
} from "../../infrastructure/database/models/index.js";
import { status, userStatus } from "../../types/types.js";
import { sendMail } from "../../shared/services/mail.service.js";

export const login = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { email, password } = req.body;

    const user = await UserModel.findOne({
      email,
      status: "ACTIVE" as userStatus,
    })
      .select("+password")
      .populate("companyId", "companyLogo");

    if (!user) {
      return res.status(400).json(ApiResponse.error("Invalid credentials"));
    }

    if (user.password) {
      const isValid = await bcrypt.compare(password, user.password);
      if (!isValid) {
        return res.status(400).json(ApiResponse.error("Invalid credentials"));
      }
    }

    const accessToken = generateAccessToken({
      userId: user._id.toString(),
      companyId: user.companyId._id.toString(),
      role: user.role,
    });

    const refreshToken = generateRefreshToken({
      userId: user._id.toString(),
    });

    await UserSessionModel.create({
      userId: user._id,
      refreshToken,
      ipAddress: req.ip || "",
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    });

    user.lastLoginAt = new Date();

    await user.save();

    return res.status(200).json(
      ApiResponse.success(
        {
          user: {
            _id: user._id,
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email,
            role: user.role,
            profileImage: user.profileImage,
            company: user.companyId,
          },
          accessToken,
          refreshToken,
        },
        "Login successful",
      ),
    );
  } catch (error) {
    next(error);
  }
};

export const refreshToken = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res
        .status(400)
        .json(ApiResponse.error("Refresh token is required"));
    }

    const payload = verifyRefreshToken(refreshToken);

    const session = await UserSessionModel.findOne({
      refreshToken,
    });

    if (!session) {
      return res.status(401).json(ApiResponse.error("Session expired"));
    }

    const user = await UserModel.findById(payload.userId);

    if (!user) {
      return res.status(404).json(ApiResponse.error("User not found"));
    }

    const newAccessToken = generateAccessToken({
      userId: user._id.toString(),
      companyId: user.companyId.toString(),
      role: user.role,
    });

    const newRefreshToken = generateRefreshToken({
      userId: user._id.toString(),
    });

    session.refreshToken = newRefreshToken;

    session.expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    await session.save();

    return res.status(200).json(
      ApiResponse.success(
        {
          accessToken: newAccessToken,
          refreshToken: newRefreshToken,
        },
        "Token refreshed successfully",
      ),
    );
  } catch (error) {
    next(error);
  }
};

export const logout = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res
        .status(400)
        .json(ApiResponse.error("Refresh token is required"));
    }

    await UserSessionModel.deleteOne({
      refreshToken,
    });

    return res.status(200).json(ApiResponse.success(null, "Logout successful"));
  } catch (error) {
    next(error);
  }
};

export const forgotPassword = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { email } = req.body;

    const user = await UserModel.findOne({
      email,
    }).select("+resetPasswordToken +resetPasswordExpires");

    if (!user) {
      return res
        .status(200)
        .json(
          ApiResponse.success(
            null,
            "If the account exists, a reset email has been sent.",
          ),
        );
    }

    const token = crypto.randomBytes(32).toString("hex");

    user.resetPasswordToken = token;

    user.resetPasswordExpires = new Date(Date.now() + 15 * 60 * 1000);

    await user.save();

    const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${token}`;

    await sendMail({
      to: user.email,
      subject: "Reset Password",
      html: `
                <p>Click the link below to reset your password:</p>
                <a href="${resetUrl}">
                    Reset Password
                </a>
                <p>Valid for 15 minutes.</p>
            `,
    });

    return res
      .status(200)
      .json(ApiResponse.success(null, "Reset password email sent"));
  } catch (error) {
    next(error);
  }
};

export const resetPassword = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { token, password } = req.body;

    const user = await UserModel.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: {
        $gt: new Date(),
      },
    }).select("+resetPasswordToken +resetPasswordExpires +password");

    if (!user) {
      return res
        .status(400)
        .json(ApiResponse.error("Invalid or expired token"));
    }

    user.password = await bcrypt.hash(password, 10);

    user.resetPasswordToken = null;

    user.resetPasswordExpires = null;

    await user.save();

    await UserSessionModel.deleteMany({
      userId: user._id,
    });

    return res
      .status(200)
      .json(ApiResponse.success(null, "Password reset successfully"));
  } catch (error) {
    next(error);
  }
};
