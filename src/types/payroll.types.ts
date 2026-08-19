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
    lateCount: number;
    overtimeMinutes: number;
    overtimeRate: number;
    lateSalaryCutDays: number;
    sandwichDays: number;
  };
}

export interface EarningDeduction {
  type: string;
  name: string;
  amount: number;
  isDeduction: boolean;
  calculation?: string;
  source: string;
  sourceId?: Types.ObjectId;
  metadata?: any;
}


export interface PayrollTotals {
  totalEarnings: number;
  totalReimbursements: number;
  totalDeductions: number;
  netPay: number;
}
