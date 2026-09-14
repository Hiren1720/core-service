import { Request, Response, NextFunction } from "express";
import {
  CompanyModel,
  UserAssignmentModel,
  UserDetailModel,
  UserModel,
  UserPayslipModel,
  UserPolicyModel,
  UserSessionModel,
} from "../../infrastructure/database/models";
import { ApiResponse } from "../../shared/response/api-response";
import { saveFile } from "../../shared/services/file.service";
import { status, userStatus } from "../../types/types";
import { getMyManagedUserIdList } from "../../shared/services/users.service";
import { addUserHistory } from "../../shared/services/userHistory.service";

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

      bankName,
      accountNo,
      ifscCode,
      uanNo,
      esicNo,
      pfJoiningDate,
      esicJoiningDate,
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

    if (role && role !== user.role) {
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
      bankName: bankName ?? detail.bank?.bankName,
      uanNo: uanNo ?? detail.bank?.uanNo,
      esicNo: esicNo ?? detail.bank?.esicNo,
      pfJoiningDate: pfJoiningDate ?? detail.bank?.pfJoiningDate,
      esicJoiningDate: esicJoiningDate ?? detail.bank?.esicJoiningDate,
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
    const { id, role } = req.user!;
    // role, branch, shift, department filetr
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 10;
    const branchId = req.query.branchId?.toString();
    const shiftId = req.query.shiftId?.toString();
    const departmentId = req.query.departmentId?.toString();
    const roleFilter = req.query.role?.toString();

    const skip = (page - 1) * limit;

    const search = req.query.search?.toString() || "";
    const status = req.query.status?.toString();

    const filter: any = {
      companyId: req.user!.companyId,
      role: { $ne: "OWNER" },
      status: {
        $in: [userStatus.ACTIVE, userStatus.INACTIVE],
      },
    };

    if (search) {
      filter.firstName = {
        $regex: search,
        $options: "i",
      };
    }

    if (branchId) filter.branchId = branchId;
    if (shiftId) filter.shiftId = shiftId;
    if (departmentId) filter.departmentId = departmentId;
    if (roleFilter) filter.role = roleFilter;

    if (role === "EMPLOYEE") {
      filter._id = id;
    } else if (role === "MANAGER") {
      const userIds = await getMyManagedUserIdList(id);
      filter._id = { $in: [...userIds, id] };
    }

    if (status) {
      filter.status = status;
    }

    const [employee, total] = await Promise.all([
      UserModel.find(filter)
        .select("firstName lastName role profileImage status userId")
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
    const branchId = req.query.branchId?.toString();
    const shiftId = req.query.shiftId?.toString();
    const departmentId = req.query.departmentId?.toString();
    const roleFilter = req.query.role?.toString();

    const filter: any = {
      companyId: req.user!.companyId,
    };

    if (branchId) filter.branchId = branchId;
    if (shiftId) filter.shiftId = shiftId;
    if (departmentId) filter.departmentId = departmentId;
    if (roleFilter) filter.role = roleFilter;

    const [active, inactive] = await Promise.all([
      UserModel.countDocuments({
        ...filter,
        status: "ACTIVE" as status,
        role: { $ne: "OWNER" },
      }),
      UserModel.countDocuments({ ...filter, status: "INACTIVE" as status }),
      // UserModel.countDocuments({ ...filter, status: "DELETED" as status }),
    ]);

    return res.status(200).json(
      ApiResponse.success(
        {
          total: active + inactive,
          active,
          inactive,
          // deleted,
        },
        "Employee counts fetched successfully",
      ),
    );
  } catch (error) {
    next(error);
  }
};

export const getEmployeeById = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { companyId } = req.user!;
    const { userId } = req.params;

    const [company, user, assignments, policy, payslip] = await Promise.all([
      CompanyModel.findById(companyId)
        .select("-employeePrice -productionPrice -assignedBankAccount")
        .lean(),

      UserModel.findById(userId).populate("designationId", "name _id").lean(),

      UserAssignmentModel.findOne({ userId })
        .sort({ createdAt: -1 })
        .populate("assignments.branchId", "name")
        .populate(
          "assignments.shiftId",
          "name startTime endTime breakStartTime breakEndTime",
        )
        .populate("assignments.departmentId", "name"),

      UserPolicyModel.findOne({
        userId,
        $or: [
          // Previous years
          {
            effectiveFromYear: { $lt: new Date().getFullYear() },
          },
          // Same year, requested month or earlier
          {
            effectiveFromYear: new Date().getFullYear(), // currunt year
            effectiveFromMonth: { $lte: new Date().getMonth() + 1 }, // currunt month
          },
        ],
      })
        .sort({
          effectiveFromYear: -1,
          effectiveFromMonth: -1,
        })
        .populate("policyId", "name"),

      UserPayslipModel.findOne({
        userId,
        $or: [
          // Previous years
          {
            effectiveFromYear: { $lt: new Date().getFullYear() },
          },
          // Same year, requested month or earlier
          {
            effectiveFromYear: new Date().getFullYear(), // currunt year
            effectiveFromMonth: { $lte: new Date().getMonth() + 1 }, // currunt month
          },
        ],
      }).sort({
        effectiveFromYear: -1,
        effectiveFromMonth: -1,
      }),
    ]);

    return res.status(200).json(
      ApiResponse.success(
        {
          company,
          user,
          assignments,
          policy,
          payslip,
        },
        "Employee fetched successfully",
      ),
    );
  } catch (error) {
    next(error);
  }
};

export const myManagedEmployeeList = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const userId = req.user!.id;
    const role = req.user!.role;
    const branchId = req.query.branchId?.toString();

    const filter: any = {
      companyId: req.user!.companyId,
      status: "ACTIVE" as userStatus,
      role: { $ne: "OWNER" },
    };
    if (branchId) {
      filter["branchId"] = branchId;
    }

    if (role === "OWNER") {
      const users = await UserModel.find(filter)
        .select("firstName lastName role profileImage userId")
        .lean();

      return res
        .status(200)
        .json(ApiResponse.success(users, "Employees fetched successfully"));
    }

    const assignment = await UserAssignmentModel.findOne({
      userId,
    })
      .sort({ createdAt: -1 })
      .select("assignments")
      .lean();

    if (!assignment) {
      return res.status(404).json(ApiResponse.error("No Employees found"));
    }

    const managesAssignments = assignment.assignments.filter(
      (el) => !el.isReporting,
    );

    const managerFilter: any = {
      branchId: { $in: managesAssignments.map((el) => el.branchId.toString()) },
      shiftId: { $in: managesAssignments.map((el) => el.shiftId.toString()) },
      departmentId: {
        $in: managesAssignments.map((el) => el.departmentId.toString()),
      },
      _id: { $ne: userId },
      ...filter,
    };

    const users = await UserModel.find(managerFilter)
      .select("firstName lastName role profileImage userId")
      .lean();
    return res
      .status(200)
      .json(ApiResponse.success(users, "Employees fetched successfully"));
  } catch (error) {
    next(error);
  }
};

export const updateEmployeeSalary = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { id } = req.user!;

    const {
      userId,
      salary,
      effectiveFromMonth,
      effectiveFromYear,
      remarks,
      allowPFDeduction,
      allowESICDeduction,
      payslipId,
    } = req.body;

    if (!userId || !salary || !effectiveFromMonth || !effectiveFromYear) {
      throw new Error(
        "userId, salary, effectiveFromMonth and effectiveFromYear are required",
      );
    }

    // 1. Check if salary already exists for exact effective month/year
    const existingPayslip = await UserPayslipModel.findOne({
      userId,
      effectiveFromMonth,
      effectiveFromYear,
    });

    if (existingPayslip) {
      // 2. Update existing record
      existingPayslip.salary = salary;
      if (remarks) existingPayslip.remarks = remarks;
      if (allowPFDeduction !== undefined)
        existingPayslip.allowPFDeduction = allowPFDeduction;
      if (allowESICDeduction !== undefined)
        existingPayslip.allowESICDeduction = allowESICDeduction;
      if (payslipId) existingPayslip.payslipId = payslipId;

      existingPayslip.assignedBy = id as any;

      await existingPayslip.save();

      return res.status(200).json({
        success: true,
        message: "Employee salary updated successfully",
        data: existingPayslip,
      });
    }

    // 3. Delete all future salary records from currnut month
    await UserPayslipModel.deleteMany({
      userId,
      $or: [
        {
          effectiveFromYear: {
            $gt: new Date().getFullYear(),
          },
        },
        {
          effectiveFromYear: new Date().getFullYear(),
          effectiveFromMonth: {
            $gt: new Date().getMonth() + 1,
          },
        },
      ],
    });

    // 4. Create new salary record
    const newPayslip = await UserPayslipModel.create({
      salary,
      effectiveFromMonth,
      effectiveFromYear,
      assignedBy: id,
      payslipId: payslipId,
      allowESICDeduction: allowESICDeduction,
      allowPFDeduction: allowPFDeduction,
    });

    return res.status(201).json({
      success: true,
      message: "Employee salary updated successfully",
      data: newPayslip,
    });
  } catch (error) {
    next(error);
  }
};

export const getEmployeeSalaryDetails = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const userId = req.query.userId as string;

    const [current, upcoming, history] = await Promise.all([
      UserPayslipModel.findOne({
        userId,
        $or: [
          // Previous years
          {
            effectiveFromYear: { $lt: new Date().getFullYear() },
          },
          // Same year, requested month or earlier
          {
            effectiveFromYear: new Date().getFullYear(), // currunt year
            effectiveFromMonth: { $lte: new Date().getMonth() + 1 }, // currunt month
          },
        ],
      })
        .sort({
          effectiveFromYear: -1,
          effectiveFromMonth: -1,
        })
        .populate("payslipId"),
      UserPayslipModel.findOne({
        userId,
        $or: [
          {
            effectiveFromYear: {
              $gt: new Date().getFullYear(),
            },
          },
          {
            effectiveFromYear: new Date().getFullYear(),
            effectiveFromMonth: {
              $gt: new Date().getMonth() + 1,
            },
          },
        ],
      }),
      UserPayslipModel.find({
        userId,
      })
        .populate("assignedBy", "firstName lastName profileImage")
        .lean(),
    ]);

    return res.status(201).json({
      success: true,
      message: "Employee salary fetched successfully",
      data: { current, upcoming, history },
    });
  } catch (error) {
    next(error);
  }
};

export const employeeStatusChange = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { status, remarks } = req.body;
    const assignedBy = req.user!.id;

    const user = await UserModel.findOne({
      _id: req.params.userId,
      companyId: req.user!.companyId,
    });

    if (!user) {
      return res.status(404).json(ApiResponse.error("User not found"));
    }

    await UserModel.findByIdAndUpdate(user._id, { status: status });

    if (status === userStatus.INACTIVE || status === userStatus.DELETED) {
      await UserSessionModel.deleteMany({ userId: user._id });
    }

    await addUserHistory({
      userId: user._id.toString(),
      field: "userStatus",
      fieldId: user._id.toString(),
      fieldValue: status,
      remarks,
      assignedBy,
    });

    return res
      .status(200)
      .json(ApiResponse.success(null, "Status updated successfully"));
  } catch (error) {
    next(error);
  }
};
