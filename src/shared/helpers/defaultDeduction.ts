import { DeductionModel } from "../../infrastructure/database/models";
import { defaultDeductionType, payslipValueType } from "../../types/types";

export const defaultDeduction = async (companyId: string) => {
  try {
    const incomeDetails = [
      {
        from: 0,
        to: 400000,
        taxRate: 0,
      },
      {
        from: 400001,
        to: 800000,
        taxRate: 0,
      },
      {
        from: 800001,
        to: 1200000,
        taxRate: 0,
      },
      {
        from: 1200001,
        to: 1600000,
        taxRate: 0,
      },
      {
        from: 1600001,
        to: 2000000,
        taxRate: 0,
      },
      {
        from: 2000001,
        to: 2400000,
        taxRate: 0,
      },
      {
        from: 2400001,
        to: 10000000,
        taxRate: 0,
      },
    ];

    const details = [
      {
        name: defaultDeductionType.PT,
        value: 200,
        valueType: payslipValueType.FIXED,
      },
      {
        name: defaultDeductionType.PF,
        value: 12,
        valueType: payslipValueType.PERCENTAGE,
      },
      {
        name: defaultDeductionType.ESIC,
        value: 0.75,
        valueType: payslipValueType.PERCENTAGE,
      },
    ];

    await DeductionModel.create({
      companyId: companyId,
      incomeDetails,
      details,
    });
  } catch (e) {
    throw new Error("Deduction not added");
  }
};
