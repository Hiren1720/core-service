import { Request, Response, NextFunction } from "express";
import {
  UserDetailModel,
  UserModel,
} from "../../infrastructure/database/models";
import { ApiResponse } from "../../shared/response/api-response";
import { saveFile } from "../../shared/services/file.service";
import { status } from "../../types/types";

export const editUserDetail = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { userId } = req.params;

    let user = await UserModel.findById(userId);

    if (!user) {
      return res.status(404).json(ApiResponse.error("User not found"));
    }

    const {
      firstName,
      lastName,
      email,
      phone,
      gender,
      role,

      dob,
      address,
      permanentAddress,
      alternatePhone,
      bloodGroup,
      isMarried,
      isPhysicallyDisabled,

      fatherName,
      fatherOccupation,
      fatherPhone,

      motherName,
      motherOccupation,
      motherPhone,

      accountNo,
      ifscCode,
    } = req.body;

    // ===============================
    // Basic User Details
    // ===============================
    if (firstName !== undefined) {
      user.firstName = firstName.trim();
    }

    if (lastName !== undefined) {
      user.lastName = lastName.trim();
    }

    if (email !== undefined) {
      const existingUser = await UserModel.findOne({
        email: email.toLowerCase(),
        _id: { $ne: userId },
      });

      if (existingUser) {
        return res.status(400).json(ApiResponse.error("Email already exists"));
      }

      user.email = email.toLowerCase().trim();
    }

    if (phone !== undefined) {
      user.phone = phone;
    }

    if (gender !== undefined) {
      user.gender = gender;
    }

    if (role !== user.role) {
      user.role = role;
    }

    // ===============================
    // Additional Profile Details
    // ===============================

    if (dob !== undefined) user.dob = dob;
    if (address !== undefined) user.address = address;
    if (permanentAddress !== undefined)
      user.permanentAddress = permanentAddress;
    if (alternatePhone !== undefined) user.alternatePhone = alternatePhone;
    if (bloodGroup !== undefined) user.bloodGroup = bloodGroup;
    if (isMarried !== undefined) user.isMarried = isMarried === "true";
    if (isPhysicallyDisabled !== undefined)
      user.isPhysicallyDisabled = isPhysicallyDisabled === "true";

    const files = req.files as Record<string, Express.Multer.File[]>;

    if (files?.profileImage?.[0]) {
      user.profileImage = saveFile({
        file: files.profileImage[0],
        folder: "users",
        entityId: user._id.toString(),
        fileName: "profile",
      });
    }

    await user.save();

    let detail = await UserDetailModel.findOne({
      userId,
    });

    if (!detail) {
      detail = new UserDetailModel({
        userId,
      });
    }

    detail.parents = {
      fatherName: fatherName ?? detail.parents?.fatherName,
      fatherOccupation: fatherOccupation ?? detail.parents?.fatherOccupation,
      fatherPhone: fatherPhone ?? detail.parents?.fatherPhone,

      motherName: motherName ?? detail.parents?.motherName,
      motherOccupation: motherOccupation ?? detail.parents?.motherOccupation,
      motherPhone: motherPhone ?? detail.parents?.motherPhone,
    };

    detail.bank = {
      accountNo: accountNo ?? detail.bank?.accountNo,
      ifscCode: ifscCode ?? detail.bank?.ifscCode,
    };

    await detail.save();

    return res
      .status(200)
      .json(ApiResponse.success(null, "User detail saved successfully"));
  } catch (error) {
    next(error);
  }
};

export const getEmployeeList = async (
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

    const filter: any = {
      companyId: req.user!.companyId,
      role: { $ne: "OWNER" },
    };

    if (search) {
      filter.firstName = {
        $regex: search,
        $options: "i",
      };
    }

    if (status) {
      filter.status = status;
    }

    const [employee, total] = await Promise.all([
      UserModel.find(filter)
        .select("firstName lastName role profileImage status")
        .populate("branchId", "name")
        .populate("shiftId", "name startTime endTime")
        .populate("designationId", "name")
        .populate("departmentId", "name")
        .sort({
          createdAt: -1,
        })
        .skip(skip)
        .limit(limit)
        .lean(),

      UserModel.countDocuments(filter),
    ]);

    return res.status(200).json(
      ApiResponse.success(
        {
          employee,
          total,
        },
        "Employee fetched successfully",
      ),
    );
  } catch (error) {
    next(error);
  }
};

export const getEmployeeCount = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const filter: any = {
      companyId: req.user!.companyId,
    };

    const [active, inactive, deleted] = await Promise.all([
      UserModel.countDocuments({ ...filter, status: "ACTIVE" as status }),
      UserModel.countDocuments({ ...filter, status: "INACTIVE" as status }),
      UserModel.countDocuments({ ...filter, status: "DELETED" as status }),
    ]);

    return res.status(200).json(
      ApiResponse.success(
        {
          total: active + inactive + deleted,
          active,
          inactive,
          deleted,
        },
        "Employee counts fetched successfully",
      ),
    );
  } catch (error) {
    next(error);
  }
};
