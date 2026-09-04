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
  OtpModel,
  UserModel,
  UserSessionModel,
} from "../../infrastructure/database/models/index.js";
import { userStatus } from "../../types/types.js";
import { sendMail } from "../../shared/services/mail.service.js";
import { generateOtp } from "../../shared/utils/otpGenerate.js";

export const login = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { loginId, password, platform } = req.body;

    if (!loginId || !password) {
      return res
        .status(400)
        .json(ApiResponse.error("User ID/email and password are required"));
    }

    const user = await UserModel.findOne({
      $or: [{ userId: loginId }, { email: loginId.toLowerCase() }],
      status: "ACTIVE" as userStatus,
    })
      .select("+password")
      .populate("companyId", "companyLogo");

    if (!user) {
      return res.status(400).json(ApiResponse.error("Invalid credentials"));
    }

    // if (user.role === "EMPLOYEE" && platform === "WEB") {
    //   return res.status(403).json(ApiResponse.error("Forbidden"));
    // }

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
      platform,
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
    });

    if (!user) {
      return res
        .status(200)
        .json(
          ApiResponse.success(
            null,
            "If the account exists, an OTP has been sent.",
          ),
        );
    }

    // Remove previous OTPs
    await OtpModel.deleteMany({
      userId: user._id,
      type: "forgotPassword",
    });

    const otp = generateOtp();

    await OtpModel.create({
      userId: user._id,
      otp,
      type: "forgotPassword",
    });

    await sendMail({
      to: user.email,
      subject: "Password Reset OTP",
      html: `
        <div>
          <h2>Password Reset</h2>
          <p>
            Use the following OTP to reset your password:
          </p>
          <h1 style="letter-spacing: 8px;">
            ${otp}
          </h1>
          <p>
            This OTP is valid for 5 minutes.
          </p>
          <p>
            If you did not request a password reset,
            please ignore this email.
          </p>
        </div>
      `,
    });

    return res
      .status(200)
      .json(
        ApiResponse.success(
          null,
          "If the account exists, an OTP has been sent.",
        ),
      );
  } catch (error) {
    next(error);
  }
};

export const verifyForgotPasswordOtp = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res
        .status(400)
        .json(ApiResponse.error("Email and OTP are required"));
    }

    const normalizedEmail = email.trim().toLowerCase();

    const user = await UserModel.findOne({
      email: normalizedEmail,
    });

    if (!user) {
      return res
        .status(400)
        .json(ApiResponse.success(null, "Given user not found!"));
    }

    const otpRecord = await OtpModel.findOne({
      userId: user._id,
      type: "forgotPassword",
    });

    if (!otpRecord) {
      return res.status(400).json(ApiResponse.error("OTP has been expired"));
    }

    if (otp !== otpRecord.otp) {
      return res.status(400).json(ApiResponse.error("OTP is invalid"));
    }

    // Temporary password-reset token
    const resetToken = crypto.randomBytes(32).toString("hex");

    otpRecord.token = resetToken;

    await otpRecord.save();

    return res.status(200).json(
      ApiResponse.success(
        {
          resetToken,
        },
        "OTP verified successfully",
      ),
    );
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

    if (!token || !password) {
      return res
        .status(400)
        .json(ApiResponse.error("Reset token and password are required"));
    }

    const otpRecord = await OtpModel.findOne({
      token: token,
      type: "forgotPassword",
    });

    if (!otpRecord) {
      return res
        .status(400)
        .json(
          ApiResponse.error("Verification failed, please verify otp again"),
        );
    }

    const user = await UserModel.findById(otpRecord.userId).select("+password");

    if (!user) {
      return res
        .status(400)
        .json(ApiResponse.error("Invalid or expired token"));
    }

    user.password = await bcrypt.hash(password, 10);

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
