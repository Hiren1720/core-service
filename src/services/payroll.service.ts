import mongoose, { Types } from "mongoose";
import {
  AttendancePayrollResult,
  EarningDeduction,
} from "../types/payroll.types";
import {
  attendanceType,
  defaultDeductionType,
  expenseStatus,
  payslipValueType,
} from "../types/types";
import {
  AttendanceModel,
  DeductionModel,
  PayrollModel,
  ReimbursementModel,
  UserModel,
  UserPayslipModel,
  UserPolicyModel,
} from "../infrastructure/database/models";
import { getDaysInCurrentMonth } from "../shared/helpers/dateHelper";

export const generateEmployeePayroll = async (
  userId: string,
  payrollMonth: number,
  payrollYear: number,
) => {
  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    // ---------------------------------------------
    // 1. Payroll period
    // ---------------------------------------------

    const { periodStart, periodEnd } = getPayrollPeriod(
      payrollMonth,
      payrollYear,
    );

    // ---------------------------------------------
    // 2. Employee
    // ---------------------------------------------

    const employee: any = await UserModel.findById(userId)
      .select("companyId")
      .populate("shiftId", "minutes")
      .lean();

    if (!employee) {
      throw new Error("Employee not found");
    }

    // ---------------------------------------------
    // 3. Salary
    // ---------------------------------------------

    const payslip: any = await UserPayslipModel.findOne({ userId })
      .populate("payslipId")
      .sort({ createdAt: -1 });
    if (!payslip) {
      throw new Error("Payslip not found");
    }
    // ---------------------------------------------
    // 4. Policy
    // ---------------------------------------------

    const policy: any = await UserPolicyModel.findOne({ userId }).populate(
      "policyId",
    );
    if (!policy?.policyId) {
      throw new Error("Employee policy not found");
    }

    const deduction: any = await DeductionModel.findOne({
      companyId: employee.companyId,
    }).lean();
    if (!deduction) {
      throw new Error("Deduction  not found");
    }
    // ---------------------------------------------
    // 5. Attendance
    // ---------------------------------------------
    const attendance = await getMonthlyAttendance(
      userId,
      periodStart,
      periodEnd,
    );

    // ---------------------------------------------
    // 7. Reimbursements
    // ---------------------------------------------

    const reimbursements = await getApprovedReimbursements(
      userId,
      periodStart,
      periodEnd,
    );

    // ---------------------------------------------
    // 8. Attendance payroll calculation
    // ---------------------------------------------

    const attendanceResult = calculateAttendancePayroll({
      attendance,
      policy: policy.policyId,
    });

    // ---------------------------------------------
    // 10. Reimbursements
    // ---------------------------------------------

    const reimbursementResult = calculateReimbursements(reimbursements);

    // ---------------------------------------------
    // 11. Earnings
    // ---------------------------------------------
    const attendancePayment = buildPaymentEarnings({
      salary: payslip.salary,
      shiftMinutes: employee?.shiftId?.minutes || 0,
      attendanceResult,
      policy: policy?.policyId,
    });

    // ---------------------------------------------
    // 12. Deductions
    // ---------------------------------------------
    const deductions = buildPayrollDeductions({
      payslip: payslip,
      taxDeduction: deduction,
    });

    // ---------------------------------------------
    // 9. Salary breakdown
    // ---------------------------------------------
    const salaryBreakdown = calculateSalaryBreakdown(
      attendancePayment.salaryBasedOnAttendance,
      payslip?.payslipId?.details as PayslipDetail[],
      deductions,
    );

    // ---------------------------------------------
    // 13. Final totals
    // ---------------------------------------------

    const attendanceSalaryAmount = attendancePayment.salaryBasedOnAttendance;
    const deductionsAmount = deductions.reduce(
      (total, deduction) => total + (deduction.amount || 0),
      0,
    );
    const reimbursementsAmount = reimbursementResult.totalAmount;
    const totals = {
      salaryAmount: payslip.salary,
      attendanceSalaryAmount,
      deductionsAmount,
      reimbursementsAmount,
      netPayAmount:
        attendanceSalaryAmount + reimbursementsAmount - deductionsAmount,
    };

    // ---------------------------------------------
    // 14. Save payroll snapshot
    // ---------------------------------------------

    const payroll = await PayrollModel.create(
      [
        {
          companyId: employee.companyId,
          userId,

          payrollMonth,
          payrollYear,

          periodStart,
          periodEnd,

          attendance: attendanceResult.summary,
          salaryBreakdown,
          salarySnapshot: [
            ...attendancePayment.earnings,
            ...attendancePayment.deductions,
          ],
          reimbursements: reimbursementResult.details,

          totals,
          status: "PROCESSED",
          generatedAt: new Date(),
        },
      ],
      {
        session,
      },
    );

    await session.commitTransaction();

    return payroll[0];
  } catch (error) {
    await session.abortTransaction();

    console.error("Error while generating employee payroll", error);

    throw error;
  } finally {
    await session.endSession();
  }
};

export const getPayrollPeriod = (month: number, year: number) => {
  const periodStart = new Date(year, month - 1, 1);
  const periodEnd = new Date(year, month, 0);

  periodStart.setHours(0, 0, 0, 0);
  periodEnd.setHours(23, 59, 59, 999);

  return {
    periodStart,
    periodEnd,
  };
};

interface PayslipDetail {
  _id?: Types.ObjectId;
  name: string;
  value: number | null;
  valueType: "PERCENTAGE" | "FIXED";
}

export const calculateSalaryBreakdown = (
  salary: number,
  details: PayslipDetail[],
  deductions: EarningDeduction[],
): EarningDeduction[] => {
  let totalDefinedAmount = 0;

  const components: EarningDeduction[] = [];

  for (const detail of details) {
    if (detail.value === null || detail.value === undefined) {
      continue;
    }

    const amount =
      detail.valueType === "PERCENTAGE"
        ? (salary * detail.value) / 100
        : detail.value;

    totalDefinedAmount += amount;

    components.push({
      name: detail.name,
      type: detail.name,
      isDeduction: false,
      amount,
      calculation:
        detail.valueType === "PERCENTAGE"
          ? detail.value.toString() + "%"
          : detail.value.toString(),
      source: "PAYSLIP",
      metadata: {
        sourceId: detail._id,
      },
    });
  }

  if (totalDefinedAmount > salary) {
    throw new Error("Payslip components cannot exceed total salary");
  }

  const remainingAmount = salary - totalDefinedAmount;

  if (remainingAmount > 0) {
    components.push({
      name: "Other",
      type: "OTHER",
      isDeduction: false,
      amount: remainingAmount,
      calculation: "salary - payslip component",
      source: "PAYSLIP",
    });
  }

  if (deductions.length) {
    components.push(...deductions);
  }

  return components;
};

const calculateAttendancePayroll = ({
  attendance,
  policy,
}: {
  attendance: any[];
  policy: any;
}): AttendancePayrollResult => {
  let totalWorkingDays = 0;

  let presentDays = 0;
  let absentDays = 0;
  let halfDays = 0;

  let weeklyOffDays = 0;
  let holidays = 0;
  let paidLeaveDays = 0;

  let lateMinutes = 0;
  let earlyExitMinutes = 0;
  let overtimeMinutes = 0;

  let lateCount = 0;

  // --------------------------------------------------
  // Attendance calculation
  // --------------------------------------------------

  for (const record of attendance) {
    const status = record.attendanceStatus;

    // -----------------------------------------------
    // Weekly off / holiday
    // -----------------------------------------------

    if (status === attendanceType.WEEK_OFF) {
      weeklyOffDays += 1;
      continue;
    }
    if (status === attendanceType.HOLIDAY) {
      holidays += 1;
      continue;
    }

    totalWorkingDays += 1;

    // -----------------------------------------------
    // Half day
    // -----------------------------------------------

    if (record.isHalfDay) {
      halfDays += 1;

      // ---------------------------------------------
      // Half day WITHOUT leave
      //
      // Employee worked only half day.
      //
      // PRESENT -> 0.5 present + 0.5 absent
      // ABSENT  -> 1 absent
      // ---------------------------------------------

      if (!record.leaveRequestId) {
        if (status === attendanceType.PRESENT) {
          presentDays += 0.5;
          absentDays += 0.5;
        } else if (status === attendanceType.ABSENT) {
          absentDays += 1;
        }
      }

      // ---------------------------------------------
      // Half day WITH leave
      //
      // PRESENT -> 0.5 leave + 0.5 present
      // ABSENT  -> 0.5 leave + 0.5 absent
      // ---------------------------------------------
      else {
        paidLeaveDays += 0.5;

        if (status === attendanceType.PRESENT) {
          presentDays += 0.5;
        } else if (status === attendanceType.ABSENT) {
          absentDays += 0.5;
        }
      }

      // ---------------------------------------------
      // Attendance metrics
      // ---------------------------------------------

      lateMinutes += record.lateMinutes || 0;
      earlyExitMinutes += record.earlyExitMinutes || 0;
      overtimeMinutes += record.overtimeMinutes || 0;

      if (record.isLate) {
        lateCount += 1;
      }

      continue;
    }

    // -----------------------------------------------
    // Full day leave
    // -----------------------------------------------

    if (status === attendanceType.LEAVE) {
      if (record.leaveRequestId) {
        paidLeaveDays += 1;
      } else {
        absentDays += 1;
      }

      continue;
    }

    // -----------------------------------------------
    // Normal full-day attendance
    // -----------------------------------------------

    switch (status) {
      case attendanceType.PRESENT:
        presentDays += 1;
        break;

      case attendanceType.ABSENT:
        absentDays += 1;
        break;
    }

    // -----------------------------------------------
    // Late / early / overtime
    // -----------------------------------------------

    lateMinutes += record.lateMinutes || 0;
    earlyExitMinutes += record.earlyExitMinutes || 0;
    overtimeMinutes += record.overtimeMinutes || 0;

    if (record.isLate) {
      lateCount += 1;
    }
  }

  // --------------------------------------------------
  // Late salary deduction
  // --------------------------------------------------

  let lateSalaryCutDays = 0;

  const lateRule = policy?.lateRule;

  if (lateRule) {
    const allowedLateCount = lateRule.allowedLateCount || 0;
    const salaryCutDays = lateRule.onAbsentSlarayDaysCut || 0;

    if (allowedLateCount > 0 && lateCount > allowedLateCount) {
      lateSalaryCutDays =
        Math.floor((lateCount - 1) / allowedLateCount) * salaryCutDays;
    }
  }

  // check sandwich rule
  let sandwichDays = 0;
  if (policy?.sandwichRule?.enabled) {
    const sortedAttendance = [...attendance].sort(
      (a, b) =>
        new Date(a.attendanceDate).getTime() -
        new Date(b.attendanceDate).getTime(),
    );

    let index = 0;

    while (index < sortedAttendance.length) {
      const current = sortedAttendance[index];

      // Start with LEAVE / ABSENT
      if (!isLeaveLikeDay(current)) {
        index++;
        continue;
      }

      let nextIndex = index + 1;

      // Find consecutive WEEK_OFF / HOLIDAY
      while (
        nextIndex < sortedAttendance.length &&
        isSandwichEligibleDay(sortedAttendance[nextIndex], policy)
      ) {
        nextIndex++;
      }

      // Right side must be LEAVE / ABSENT
      if (
        nextIndex < sortedAttendance.length &&
        isLeaveLikeDay(sortedAttendance[nextIndex])
      ) {
        const middleDays = nextIndex - index - 1;

        // Must have at least one WEEK_OFF / HOLIDAY
        if (middleDays > 0) {
          // Include:
          // left leave + middle off/holiday + right leave
          sandwichDays += middleDays + 2;

          // console.log("SANDWICH FOUND:", {
          //   start: current.attendanceDate,
          //   end: sortedAttendance[nextIndex].attendanceDate,
          //   middleDays,
          //   totalDays: middleDays + 2,
          // });

          // Skip the complete sequence
          index = nextIndex + 1;
          continue;
        }
      }

      index++;
    }
  }

  return {
    summary: {
      totalWorkingDays,
      presentDays,
      absentDays,
      halfDays,
      weeklyOffDays,
      holidays,
      paidLeaveDays,
      lateMinutes,
      earlyExitMinutes,
      overtimeMinutes,
      overtimeRate: policy.overtime.overtimeRate || 1,
      lateCount,
      lateSalaryCutDays,
      sandwichDays,
    },
  };
};

export const buildPaymentEarnings = ({
  salary,
  shiftMinutes,
  attendanceResult,
  policy,
}: {
  salary: number;
  shiftMinutes: number;
  attendanceResult: AttendancePayrollResult;
  policy: any;
}): {
  earnings: EarningDeduction[];
  deductions: EarningDeduction[];
  salaryBasedOnAttendance: number;
} => {
  const earnings: EarningDeduction[] = [];
  const deductions: EarningDeduction[] = [];
  const { overtimeMinutes, absentDays, lateSalaryCutDays, sandwichDays } =
    attendanceResult.summary;

  const {
    overtime: { overtimeRate },
  } = policy;

  const daysInMonth = getDaysInCurrentMonth();

  const dailySalary = salary / daysInMonth;

  const minuteSalary = dailySalary / shiftMinutes;

  const overtimeAmount = overtimeMinutes * minuteSalary * overtimeRate;

  const absentDaysSalary = dailySalary * absentDays;

  const lateMarkDaySalary = dailySalary * lateSalaryCutDays;

  const sandwichDaysSalary = dailySalary * sandwichDays;

  const calculatedSalary =
    salary +
    overtimeAmount -
    absentDaysSalary -
    lateMarkDaySalary -
    sandwichDaysSalary;

  const finalSalary = Math.max(0, calculatedSalary);

  // ---------------------------------------------
  // Salary components
  // ---------------------------------------------
  earnings.push({
    type: "SALARY",
    name: "Salary",
    isDeduction: false,
    amount: salary,
    calculation: `Gross salary`,
    source: "SALARY",
    metadata: {},
  });

  // ---------------------------------------------
  // Overtime
  // ---------------------------------------------
  if (overtimeAmount > 0) {
    earnings.push({
      type: "OVERTIME",
      name: "Overtime",
      isDeduction: false,
      amount: overtimeAmount,
      calculation: `${overtimeMinutes} minutes`,
      source: "ATTENDANCE",
      metadata: {
        overtimeMinutes: overtimeMinutes,
      },
    });
  }

  // absent days
  if (absentDaysSalary > 0) {
    deductions.push({
      type: "ABSENT",
      name: "Absent",
      isDeduction: true,
      amount: absentDaysSalary,
      calculation: `${absentDays} days absent`,
      source: "ATTENDANCE",
      metadata: {
        absentDays: absentDays,
      },
    });
  }

  // Late mark days
  if (lateMarkDaySalary > 0) {
    deductions.push({
      type: "LATE",
      name: "late",
      isDeduction: true,
      amount: lateMarkDaySalary,
      calculation: `${lateSalaryCutDays} days late`,
      source: "ATTENDANCE",
      metadata: {
        lateSalaryCutDays: lateSalaryCutDays,
      },
    });
  }

  // Sandwich leaves
  if (sandwichDaysSalary > 0) {
    deductions.push({
      type: "SANDWICH",
      name: "Sandwich",
      isDeduction: true,

      amount: sandwichDaysSalary,
      calculation: `${sandwichDays} days late`,
      source: "ATTENDANCE",
      metadata: {
        sandwichDays: sandwichDays,
      },
    });
  }

  return { earnings, deductions, salaryBasedOnAttendance: finalSalary };
};

export const buildPayrollDeductions = ({
  payslip,
  taxDeduction,
}: {
  payslip: any;
  taxDeduction: any;
}): EarningDeduction[] => {
  const deductions: EarningDeduction[] = [];
  const { salary, allowPFDeduction, allowESICDeduction } = payslip;

  // Tax deductions
  if (taxDeduction?.details?.length > 0) {
    for (const detail of taxDeduction?.details) {
      if (detail.name === defaultDeductionType.PF && !allowPFDeduction)
        continue;
      if (detail.name === defaultDeductionType.ESIC && !allowESICDeduction)
        continue;

      deductions.push({
        type: "TAX",
        name: detail.name,
        isDeduction: true,
        amount:
          detail.valueType === payslipValueType.PERCENTAGE
            ? (salary * detail.value) / 100
            : Number(detail.value.toFixed(2)),
        calculation:
          detail.valueType === "PERCENTAGE"
            ? detail.value.toString() + "%"
            : detail.value.toString(),
        source: "TAX",
        metadata: {
          name: detail.name,
          value: detail.value,
          valueType: detail.valueType,
        },
      });
    }
  }

  return deductions;
};

const getApprovedReimbursements = async (
  userId: string,
  periodStart: Date,
  periodEnd: Date,
) => {
  return ReimbursementModel.find({
    userId,
    status: expenseStatus.APPROVED,
    date: {
      $gte: periodStart,
      $lte: periodEnd,
    },
  })
    .select("_id name date description amount status")
    .lean();
};

const getMonthlyAttendance = async (
  userId: string,
  periodStart: Date,
  periodEnd: Date,
) => {
  return AttendanceModel.find({
    userId,
    attendanceDate: {
      $gte: periodStart,
      $lte: periodEnd,
    },
  }).lean();
};

export const calculateReimbursements = (
  reimbursements: any[],
): { totalAmount: number; details: string[] } => {
  let totalAmount = 0;

  const details = [];

  for (const reimbursement of reimbursements) {
    // Only approved reimbursements should enter payroll.
    if (reimbursement.status !== expenseStatus.APPROVED) {
      continue;
    }

    const amount = reimbursement.amount || 0;

    if (amount <= 0) {
      continue;
    }

    totalAmount += amount;

    details.push(reimbursement._id);
  }

  return {
    totalAmount: Number(totalAmount.toFixed(2)),
    details,
  };
};

const isLeaveLikeDay = (record: any): boolean => {
  return (
    record.attendanceStatus === attendanceType.LEAVE ||
    record.attendanceStatus === attendanceType.ABSENT
  );
};

const isSandwichEligibleDay = (record: any, policy: any): boolean => {
  if (
    record.attendanceStatus === attendanceType.WEEK_OFF &&
    policy?.sandwichRule?.beforeAfterWeekOff
  ) {
    return true;
  }

  if (
    record.attendanceStatus === attendanceType.HOLIDAY &&
    policy?.sandwichRule?.beforeAfterHoliday
  ) {
    return true;
  }

  return false;
};
