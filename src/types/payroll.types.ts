import { Types } from "mongoose";

export interface AttendancePayrollResult {
  summary: {
    totalWorkingDays: number;
    presentDays: number;
    absentDays: number;
    halfDays: number;
    weeklyOffDays: number;
    holidays: number;
    paidLeaveDays: number;
    lateMinutes: number;
    earlyExitMinutes: number;
    overtimeMinutes: number;
    lateCount: number;
    overtimeAmount: number;
    lateSalaryCutDays: number;
  };
}

export interface PayrollEarning {
  type: string;
  name: string;
  amount: number;
  calculation?: string;
  source: string;
  sourceId?: Types.ObjectId;
  metadata?: any;
}

export interface PayrollDeduction {
  type:
    | "ABSENT"
    | "HALF_DAY"
    | "LATE"
    | "EARLY_EXIT"
    | "TAX"
    | "PF"
    | "ESI"
    | "LOP"
    | "OTHER";

  name: string;
  amount: number;
  calculation?: string;
  source: "POLICY" | "ATTENDANCE" | "LEAVE" | "TAX" | "OTHER";
  sourceId?: Types.ObjectId;
  metadata?: any;
}

export interface PayrollTotals {
  totalEarnings: number;
  totalReimbursements: number;
  totalDeductions: number;
  netPay: number;
}
