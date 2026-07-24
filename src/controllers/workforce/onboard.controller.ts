import { Request, Response, NextFunction } from "express";
import {
  UserPayslipModel,
  UserAssignmentModel,
  UserDetailModel,
  UserModel,
  UserPolicyModel,
  CompanyModel,
  BranchModel,
  ShiftModel,
  DepartmentModel,
} from "../../infrastructure/database/models";
import { ApiResponse } from "../../shared/response/api-response";
import { saveFile } from "../../shared/services/file.service";
import mongoose from "mongoose";
import bcrypt from "bcrypt";
import { status, userStatus } from "../../types/types";
import { addUserHistory } from "../../shared/services/userHistory.service";
import { generateUserLeaveBalance } from "../../services/leave.service";

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

      bankName,
      accountNo,
      ifscCode,
      uanNo,
      esicNo,
      pfJoiningDate,
      esicJoiningDate,

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
            bankName,
            accountNo,
            ifscCode,
            uanNo,
            esicNo,
            pfJoiningDate,
            esicJoiningDate,
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

export const getEmployDetailById = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { userId } = req.params;

    const user = await UserModel.findById(userId).lean();
    const userDetails = await UserDetailModel.findOne({ userId }).lean();

    return res
      .status(200)
      .json(
        ApiResponse.success(
          { user, userDetails },
          "Employee fetched successfully",
        ),
      );
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
      if (status === "ACCEPTED") {
        filter.status = {
          $in: [userStatus.ACTIVE, userStatus.INACTIVE, userStatus.DELETED],
        };
      } else {
        filter.status = status;
      }
    }

    const [employees, total] = await Promise.all([
      UserModel.find(filter)
        .select(
          "profileImage firstName lastName email phone status createdAt role",
        )
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
      UserModel.countDocuments({
        ...filter,
        status: {
          $in: [userStatus.ACTIVE, userStatus.INACTIVE, userStatus.DELETED],
        },
      }),
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

export const assignRolesResponsibility = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const session = await mongoose.startSession();

  try {
    session.startTransaction();
    const assignedBy = req.user?.id as string;
    const companyId = req.user?.companyId as string;
    const {
      userId,
      role,
      employmentType,
      probationPeriod,
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

      // create user leave balance
      await generateUserLeaveBalance({
        userId: user._id.toString(),
        policyId: policyId,
        session,
      });
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
              salary: salary ?? currentPayslip?.salary,
              payslipId: payslipId ?? currentPayslip?.payslipId,
              remarks,
              assignedBy,
            },
          ],
          { session },
        ),
      );
    }

    // Assignments history
    if (assignments) {
      if (!existingAssignment) {
        operations.push(
          UserAssignmentModel.create(
            [
              {
                userId,
                companyId,
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
        const isSame = existingAssignment.assignments.every(
          (oldAssignment: any) =>
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
                  companyId,
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
    }
    //other fields
    if (!user.employmentType || user.employmentType !== employmentType) {
      user.employmentType = employmentType;
      operations.push(
        addUserHistory(
          {
            userId,
            field: "employmentType",
            fieldValue: employmentType,
            remarks,
            assignedBy,
          },
          session,
        ),
      );
    }
    if (
      typeof user.probationPeriod !== "number" ||
      user.probationPeriod !== probationPeriod
    ) {
      user.probationPeriod = probationPeriod;
      operations.push(
        addUserHistory(
          {
            userId,
            field: "probationPeriod",
            fieldValue: probationPeriod,
            remarks,
            assignedBy,
          },
          session,
        ),
      );
    }
    if (user.role !== role) {
      user.role = role;
      operations.push(
        addUserHistory(
          { userId, field: "role", fieldValue: role, remarks, assignedBy },
          session,
        ),
      );
    }

    // user status
    if (user.status === "PENDING") {
      user.status = "ACTIVE" as userStatus;
    }
    //reporting assignments
    const reportingAssignment =
      role === "MANAGER"
        ? assignments.find((el: any) => el.isReporting)
        : assignments?.[0];
    if (reportingAssignment?.branchId)
      user.branchId = reportingAssignment.branchId;
    if (reportingAssignment?.shiftId)
      user.shiftId = reportingAssignment.shiftId;
    if (reportingAssignment?.designationId)
      user.designationId = reportingAssignment.designationId;
    if (reportingAssignment?.departmentId)
      user.departmentId = reportingAssignment.departmentId;

    // Execute all DB operations together
    await Promise.all(operations);
    await user.save();

    await session.commitTransaction();

    return res
      .status(200)
      .json(ApiResponse.success(null, "Data assigned successfully"));
  } catch (error) {
    await session.abortTransaction();
    next(error);
  } finally {
    await session.endSession();
  }
};

export const getBranchShiftDepartmentList = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const companyId = req.user!.companyId;

    const [branches, shifts, departments, userAssignments] = await Promise.all([
      BranchModel.find({
        companyId,
        status: status.ACTIVE,
      })
        .select("_id name address")
        .lean(),

      ShiftModel.find({
        companyId,
        status: status.ACTIVE,
      })
        .select(
          "_id name branchIds startTime endTime breakStartTime breakEndTime",
        )
        .lean(),

      DepartmentModel.find({
        companyId,
        status: status.ACTIVE,
      })
        .select("_id name assignments")
        .lean(),

      UserAssignmentModel.aggregate([
        {
          $match: {
            companyId: new mongoose.Types.ObjectId(companyId),
          },
        },
        {
          $sort: {
            createdAt: -1,
          },
        },
        {
          $group: {
            _id: "$userId",
            assignment: {
              $first: "$$ROOT",
            },
          },
        },
        {
          $replaceRoot: {
            newRoot: "$assignment",
          },
        },
        {
          $lookup: {
            from: "users", // User collection name
            localField: "userId",
            foreignField: "_id",
            as: "user",
          },
        },
        {
          $unwind: {
            path: "$user",
            preserveNullAndEmptyArrays: true,
          },
        },
        {
          $project: {
            userId: 1,
            companyId: 1,
            assignments: 1,
            createdAt: 1,

            "user._id": 1,
            "user.role": 1,
            "user.firstName": 1,
            "user.lastName": 1,
            "user.profileImage": 1,
          },
        },
      ]),
    ]);

    const branchCountMap = new Map<string, number>();
    const shiftCountMap = new Map<string, number>();
    const departmentCountMap = new Map<string, number>();
    const departmentManagerMap = new Map<string, number>();

    for (const user of userAssignments) {
      for (const assignment of user.assignments) {
        const manager = user.user.role === "MANAGER" ? user.user : undefined;

        const branchKey = assignment.branchId.toString();
        const shiftKey = `${assignment.branchId}_${assignment.shiftId}`;
        const departmentKey = `${assignment.branchId}_${assignment.shiftId}_${assignment.departmentId}`;

        branchCountMap.set(branchKey, (branchCountMap.get(branchKey) || 0) + 1);
        shiftCountMap.set(shiftKey, (shiftCountMap.get(shiftKey) || 0) + 1);
        departmentCountMap.set(
          departmentKey,
          (departmentCountMap.get(departmentKey) || 0) + 1,
        );

        //For manager exclude reporting data only manged fields
        if (!assignment.isReporting) {
          departmentManagerMap.set(departmentKey, manager);
        }
      }
    }

    const data = branches
      .map((branch: any) => {
        const branchShifts = shifts
          .filter((shift: any) =>
            shift.branchIds.some(
              (id: any) => id.toString() === branch._id.toString(),
            ),
          )
          .map((shift: any) => {
            const shiftDepartments = departments
              .filter((department: any) =>
                department.assignments.some(
                  (assignment: any) =>
                    assignment.branchId.toString() === branch._id.toString() &&
                    assignment.shiftIds.some(
                      (id: any) => id.toString() === shift._id.toString(),
                    ),
                ),
              )
              .map((department: any) => ({
                _id: department._id,
                name: department.name,
                count:
                  departmentCountMap.get(
                    `${branch._id}_${shift._id}_${department._id}`,
                  ) || 0,
                manager: departmentManagerMap.get(
                  `${branch._id}_${shift._id}_${department._id}`,
                ),
              }));

            return {
              _id: shift._id,
              name: shift.name,
              startTime: shift.startTime,
              endTime: shift.endTime,
              breakStartTime: shift.breakStartTime,
              breakEndTime: shift.breakEndTime,
              departments: shiftDepartments,
              count: shiftCountMap.get(`${branch._id}_${shift._id}`) || 0,
            };
          })
          .filter((shift: any) => shift.departments.length > 0);

        return {
          _id: branch._id,
          name: branch.name,
          shifts: branchShifts,
          address: branch.address,
          count: branchCountMap.get(branch._id.toString()) || 0,
        };
      })
      .filter((branch: any) => branch.shifts.length > 0);

    return res
      .status(200)
      .json(
        ApiResponse.success(
          data,
          "Branch shift department options fetched successfully",
        ),
      );
  } catch (error) {
    next(error);
  }
};

export const updateUserStatus = async (
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

    user.status = status;

    await addUserHistory({
      userId: req.params.userId as string,
      field: "userStatus",
      fieldValue: status,
      remarks,
      assignedBy,
    });
    await user.save();

    return res
      .status(200)
      .json(ApiResponse.success(null, "Status updated successfully"));
  } catch (error) {
    next(error);
  }
};
