import { Request, Response, NextFunction } from "express";
import {
  UserPayslipModel,
  UserAssignmentModel,
  UserDetailModel,
  UserModel,
  UserPolicyModel,
  CompanyModel,
} from "../../infrastructure/database/models";
import { ApiResponse } from "../../shared/response/api-response";
import { saveFile } from "../../shared/services/file.service";
import mongoose from "mongoose";
import bcrypt from "bcrypt";
import { userStatus } from "../../types/types";

export const createEmployee = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    const {
      companyId,
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

      educations,
      experiences,
      documents,
    } = req.body;

    const existingUser = await UserModel.findOne({ email }).session(session);

    if (existingUser) {
      await session.abortTransaction();
      return res.status(400).json(ApiResponse.error("Email already exists"));
    }

    const password =
      firstName.trim().toLowerCase() + "@" + new Date().getFullYear(); // Default password (should be changed by user)
    const hashedPassword = await bcrypt.hash(password, 10);

    const [user] = await UserModel.create(
      [
        {
          companyId,
          firstName,
          lastName,
          email: email.toLowerCase(),
          phone,
          status: "PENDING" as userStatus,
          gender,
          role,
          password: hashedPassword,
          dob,
          address,
          permanentAddress,
          alternatePhone,
          bloodGroup,
          isMarried,
          isPhysicallyDisabled,
        },
      ],
      { session },
    );

    const files = req.files as Record<string, Express.Multer.File[]>;

    if (files?.profileImage?.[0]) {
      user.profileImage = saveFile({
        file: files.profileImage[0],
        folder: "users",
        entityId: user._id.toString(),
        fileName: "profile",
      });

      await user.save({ session });
    }

    const parsedEducations =
      typeof educations === "string"
        ? JSON.parse(educations)
        : educations || [];

    const parsedExperiences =
      typeof experiences === "string"
        ? JSON.parse(experiences)
        : experiences || [];

    const parsedDocuments =
      typeof documents === "string" ? JSON.parse(documents) : documents || [];

    await UserDetailModel.create(
      [
        {
          userId: user._id,

          parents: {
            fatherName,
            fatherOccupation,
            fatherPhone,

            motherName,
            motherOccupation,
            motherPhone,
          },

          bank: {
            accountNo,
            ifscCode,
          },

          educations: parsedEducations.map((item: any, index: number) => ({
            organization: item.organization,
            passingYear: item.passingYear,
            marks: item.marks,

            document: files?.[`educations[${index}][document]`]?.[0]
              ? saveFile({
                  file: files[`educations[${index}][document]`][0],
                  folder: "users",
                  entityId: user._id.toString(),
                  fileName: `education-${index}`,
                })
              : item.document || "",
          })),

          experiences: parsedExperiences.map((item: any, index: number) => ({
            organization: item.organization,
            designation: item.designation,
            startDate: item.startDate,
            endDate: item.endDate,

            document: files?.[`experiences[${index}][document]`]?.[0]
              ? saveFile({
                  file: files[`experiences[${index}][document]`][0],
                  folder: "users",
                  entityId: user._id.toString(),
                  fileName: `experience-${index}`,
                })
              : item.document || "",
          })),
          documents: parsedDocuments.map((item: any, index: number) => ({
            card: item.card,
            cardNumber: item.cardNumber,
            
            front: files?.[`documents[${index}][front]`]?.[0]
              ? saveFile({
                  file: files[`documents[${index}][front]`][0],
                  folder: "users",
                  entityId: user._id.toString(),
                  fileName: `${item.card}-front`,
                })
              : "",

            back: files?.[`documents[${index}][back]`]?.[0]
              ? saveFile({
                  file: files[`documents[${index}][back]`][0],
                  folder: "users",
                  entityId: user._id.toString(),
                  fileName: `${item.card}-back`,
                })
              : "",
          })),
        },
      ],
      { session },
    );

    await session.commitTransaction();

    return res
      .status(201)
      .json(
        ApiResponse.success(
          { userId: user._id },
          "Employee created successfully",
        ),
      );
  } catch (error) {
    await session.abortTransaction();
    next(error);
  } finally {
    await session.endSession();
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
      status: {
        $in: [userStatus.PENDING, userStatus.ACCEPTED, userStatus.REJECTED],
      },
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

    const [employees, total] = await Promise.all([
      UserModel.find(filter)
        .select("firstName lastName email phone status createdAt role")
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
          employees,
          total,
        },
        "Employees fetched successfully",
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

    const [pending, accepted, rejected] = await Promise.all([
      UserModel.countDocuments({ ...filter, status: "PENDING" as userStatus }),
      UserModel.countDocuments({ ...filter, status: "ACCEPTED" as userStatus }),
      UserModel.countDocuments({ ...filter, status: "REJECTED" as userStatus }),
    ]);

    return res.status(200).json(
      ApiResponse.success(
        {
          total: pending + accepted + rejected,
          pending,
          accepted,
          rejected,
        },
        "Employee counts fetched successfully",
      ),
    );
  } catch (error) {
    next(error);
  }
};

export const getOnboardCompanyInfo = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { companyId } = req.params;

    const company = await CompanyModel.findById(companyId).select(
      "companyName companyEmail companyLogo companyAddress",
    );

    if (!company) {
      return res.status(404).json(ApiResponse.error("Company not found"));
    }

    return res
      .status(200)
      .json(
        ApiResponse.success(company, "Employee counts fetched successfully"),
      );
  } catch (error) {
    next(error);
  }
};

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

      documents,
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

    const parsedDocuments =
      typeof documents === "string" ? JSON.parse(documents) : documents || [];

    detail.documents = parsedDocuments.map((item: any, index: number) => ({
      card: item.card,
      front: files?.[`documents[${index}][front]`]?.[0]
        ? saveFile({
            file: files[`documents[${index}][front]`][0],
            folder: "users",
            entityId: user._id.toString(),
            fileName: `${item.card}-front`,
          })
        : item.front || "",

      back: files?.[`documents[${index}][back]`]?.[0]
        ? saveFile({
            file: files[`documents[${index}][back]`][0],
            folder: "users",
            entityId: user._id.toString(),
            fileName: `${item.card}-back`,
          })
        : item.back || "",
    }));

    await detail.save();

    return res
      .status(200)
      .json(ApiResponse.success(null, "User detail saved successfully"));
  } catch (error) {
    next(error);
  }
};

export const assignRolesResponsibility = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const session = await mongoose.startSession();

  try {
    session.startTransaction();
    const assignedBy = req.user?.id;
    const {
      userId,
      policyId,
      payslipId,
      salary,
      assignments,
      remarks = "",
    } = req.body;

    const user = await UserModel.findById(userId).session(session);

    if (!user) {
      await session.abortTransaction();

      return res.status(404).json(ApiResponse.error("User not found"));
    }

    // Fetch current active records in parallel
    const [currentPolicy, currentPayslip, existingAssignment] =
      await Promise.all([
        UserPolicyModel.findOne({
          userId,
        })
          .sort({ createdAt: -1 })
          .session(session),

        UserPayslipModel.findOne({
          userId,
        })
          .sort({ createdAt: -1 })
          .session(session),

        await UserAssignmentModel.findOne({
          userId,
        })
          .sort({ createdAt: -1 })
          .session(session),
      ]);

    const operations: Promise<any>[] = [];

    // Policy
    if (
      policyId &&
      (!currentPolicy || currentPolicy.policyId.toString() !== policyId)
    ) {
      operations.push(
        UserPolicyModel.create(
          [
            {
              userId,
              policyId,
              remarks,
              assignedBy,
            },
          ],
          { session },
        ),
      );
    }

    // Payslip
    if (
      (salary || payslipId) &&
      (!currentPayslip ||
        currentPayslip.salary !== Number(salary) ||
        currentPayslip.payslipId.toString() !== payslipId)
    ) {
      operations.push(
        UserPayslipModel.create(
          [
            {
              userId,
              salary,
              payslipId,
              remarks,
              assignedBy,
            },
          ],
          { session },
        ),
      );
    }

    // Assignments
    if (!existingAssignment) {
      operations.push(
        UserAssignmentModel.create(
          [
            {
              userId,
              assignments: assignments.map((item: any) => ({
                ...item,
                assignedBy,
                joinedAt: new Date(),
              })),
            },
          ],
          { session },
        ),
      );
    } else {
      // Compare only required fields
      const isSame = existingAssignment.assignments.some((oldAssignment: any) =>
        assignments.some(
          (newAssignment: any) =>
            oldAssignment.branchId.toString() === newAssignment.branchId &&
            oldAssignment.shiftId.toString() === newAssignment.shiftId &&
            oldAssignment.departmentId.toString() ===
              newAssignment.departmentId &&
            oldAssignment.designationId.toString() ===
              newAssignment.designationId &&
            (oldAssignment.reportingManagerId?.toString() || "") ===
              (newAssignment.reportingManagerId || "") &&
            oldAssignment.isReporting === newAssignment.isReporting,
        ),
      );

      if (!isSame) {
        operations.push(
          UserAssignmentModel.create(
            [
              {
                userId,
                assignments: assignments.map((item: any) => ({
                  ...item,
                  assignedBy,
                  joinedAt: new Date(),
                })),
              },
            ],
            { session },
          ),
        );
      }
    }

    // Execute all DB operations together
    await Promise.all(operations);

    await session.commitTransaction();

    return res
      .status(200)
      .json(
        ApiResponse.success(null, "Policy and payslip assigned successfully"),
      );
  } catch (error) {
    await session.abortTransaction();
    next(error);
  } finally {
    await session.endSession();
  }
};
