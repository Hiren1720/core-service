import {
  CompanyModel,
  UserModel,
  UserHistoryModel,
  MonthlyEmployeeSnapshotModel,
  InvoiceModel,
} from "../infrastructure/database/models";

import { status, userStatus } from "../types/types";

export const generatePreviousMonthInvoice = async ({
  year,
  month,
}: {
  year: number;
  month: number;
}) => {
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0, 23, 59, 59, 999);

  // Number of days in billing month
  const totalMonthDays = new Date(year, month, 0).getDate();

  const companies = await CompanyModel.find({
    status: status.ACTIVE,
  })
    .select("_id")
    .lean();

  console.log(
    `Processing invoice for ${year}-${month} for ${companies.length} companies`,
  );

  for (const company of companies) {
    /*
     * Generate/update employee monthly snapshot.
     *
     * Your existing function handles UserHistory
     * and creates MonthlyEmployeeSnapshot records.
     */
    await processCompanyMonthlySnapshot({
      companyId: company._id,
      year,
      month,
      startDate,
      endDate,
    });

    /*
     * Get monthly employee snapshots.
     */
    const employeeSnapshots = await MonthlyEmployeeSnapshotModel.find({
      companyId: company._id,
      year,
      month,
    }).lean();

    /*
     * ------------------------------------------------------
     * Create billing periods
     *
     * Employees with the same:
     *
     *   start date
     *   end date
     *   monthly rate
     *
     * are grouped into one invoice line.
     * ------------------------------------------------------
     */

    const periodMap = new Map<
      string,
      {
        fromDate: Date;
        toDate: Date;
        days: number;
        employeeCount: number;
        employeeRate: number;
        totalAmount: number;
      }
    >();

    for (const employee of employeeSnapshots) {
      /*
       * We currently use ACTIVE periods for billing.
       *
       * If your billing should also include inactive
       * employees, we can add that separately.
       */
      for (const period of employee.activePeriods || []) {
        console.log("period", period);
        if (!period.from || !period.to) {
          continue;
        }

        const fromDate = new Date(period.from);
        const toDate = new Date(period.to);

        const days = period?.days || 0;

        /*
         * TODO:
         *
         * Get the employee's configured monthly rate.
         *
         * For now this assumes the rate comes from
         * employee.monthlyRate.
         */
        const employeeRate = Number(200);

        if (!employeeRate || days <= 0) {
          continue;
        }

        /*
         * Prorated amount.
         *
         * Example:
         *
         * Monthly rate = ₹300
         * Month = 30 days
         * Active = 20 days
         *
         * 300 / 30 * 20
         * = ₹200
         */
        const totalAmount = Number(
          ((employeeRate / totalMonthDays) * days).toFixed(2),
        );

        const key = [
          fromDate.toISOString(),
          toDate.toISOString(),
          employeeRate,
        ].join("_");

        const existing = periodMap.get(key);

        if (existing) {
          existing.employeeCount += 1;
          existing.totalAmount = Number(
            (
              existing.employeeCount *
              (employeeRate / totalMonthDays) *
              days
            ).toFixed(2),
          );
        } else {
          periodMap.set(key, {
            fromDate,
            toDate,
            days,
            employeeCount: 1,
            employeeRate,
            totalAmount,
          });
        }
      }
    }

    const lineItems = Array.from(periodMap.values());

    /*
     * Calculate invoice subtotal.
     */
    const subtotal = Number(
      lineItems.reduce((sum, item) => sum + item.totalAmount, 0).toFixed(2),
    );

    const taxAmount = 0;
    const discountAmount = 0;

    const totalAmount = Number(
      (subtotal + taxAmount - discountAmount).toFixed(2),
    );

    /*
     * Generate deterministic invoice number.
     *
     * You can replace this later with your own
     * invoice-number generator.
     */
    const invoiceNumber = `INV-${year}-${String(month).padStart(
      2,
      "0",
    )}-${company._id.toString().slice(-6)}`;

    /*
     * Upsert makes the monthly job idempotent.
     *
     * Running the worker again for the same month
     * will update the existing invoice instead of
     * creating another invoice.
     */
    await InvoiceModel.findOneAndUpdate(
      {
        companyId: company._id,
        billingYear: year,
        billingMonth: month,
      },
      {
        $set: {
          invoiceNumber,
          invoiceDate: new Date(),
          lineItems,

          subtotal,
          taxAmount,
          discountAmount,
          totalAmount,

          currency: "INR",
          status: "GENERATED",

          /*
           * Do not overwrite payment information if
           * an invoice already exists and somebody has
           * already paid/processed it.
           */
        },

        $setOnInsert: {
          paymentStatus: "PENDING",
          paidAmount: 0,
          paidAt: null,
          paymentGateway: null,
          paymentOrderId: null,
          paymentTransactionId: null,
          paymentReference: null,
        },
      },
      {
        upsert: true,
        new: true,
      },
    );

    console.log(
      `Invoice generated for company ${company._id}: ₹${totalAmount}`,
    );
  }

  console.log(`Monthly invoice generation completed for ${year}-${month}`);
};

const processCompanyMonthlySnapshot = async ({
  companyId,
  year,
  month,
  startDate,
  endDate,
}: {
  companyId: any;
  year: number;
  month: number;
  startDate: Date;
  endDate: Date;
}) => {
  const users = await UserModel.find({
    companyId,
    status: {
      $in: [userStatus.ACTIVE, userStatus.INACTIVE, userStatus.DELETED],
    },
  })
    .select("_id companyId")
    .lean();

  if (!users.length) {
    return;
  }

  const userIds = users.map((user) => user._id);

  const histories = await UserHistoryModel.find({
    userId: {
      $in: userIds,
    },
    field: "userStatus",
    createdAt: {
      $lte: endDate,
    },
  })
    .sort({
      userId: 1,
      createdAt: 1,
    })
    .lean();

  const historyMap = new Map<string, any[]>();

  for (const history of histories) {
    const key = history.userId.toString();

    if (!historyMap.has(key)) {
      historyMap.set(key, []);
    }

    historyMap.get(key)!.push(history);
  }

  const operations = [];

  for (const user of users) {
    const userHistory = historyMap.get(user._id.toString()) || [];

    const snapshot = calculateEmployeeStatusSnapshot({
      userHistory,
      startDate,
      endDate,
    });

    operations.push({
      updateOne: {
        filter: {
          companyId,
          userId: user._id,
          year,
          month,
        },

        update: {
          $set: {
            companyId,
            userId: user._id,
            year,
            month,

            activeDays: snapshot.activeDays,
            inactiveDays: snapshot.inactiveDays,
            deletedDays: snapshot.deletedDays,

            activeDates: snapshot.activeDates,
            inactiveDates: snapshot.inactiveDates,
            deletedDates: snapshot.deletedDates,

            activePeriods: snapshot.activePeriods,
            inactivePeriods: snapshot.inactivePeriods,
            deletedPeriods: snapshot.deletedPeriods,
          },
        },

        upsert: true,
      },
    });
  }

  if (operations.length) {
    await MonthlyEmployeeSnapshotModel.bulkWrite(operations as any, {
      ordered: false,
    });
  }

  console.log(`Monthly snapshot completed for company ${companyId}`);
};

const calculateEmployeeStatusSnapshot = ({
  userHistory,
  startDate,
  endDate,
}: {
  userHistory: any[];
  startDate: Date;
  endDate: Date;
}) => {
  const result = {
    activeDays: 0,
    inactiveDays: 0,
    deletedDays: 0,

    activeDates: [] as string[],
    inactiveDates: [] as string[],
    deletedDates: [] as string[],

    activePeriods: [] as { from: Date; to: Date; days: number }[],
    inactivePeriods: [] as { from: Date; to: Date; days: number }[],
    deletedPeriods: [] as { from: Date; to: Date; days: number }[],
  };

  let currentStatus: string | null = null;

  // Find status at beginning of month
  for (const history of userHistory) {
    const historyDate = new Date(history.createdAt);

    if (historyDate < startDate) {
      currentStatus = history.fieldValue;
    } else {
      break;
    }
  }

  let periodStart = new Date(startDate);

  for (const history of userHistory) {
    const changeDate = new Date(history.createdAt);

    if (changeDate < startDate) {
      continue;
    }

    if (changeDate > endDate) {
      break;
    }

    if (currentStatus && changeDate > periodStart) {
      const periodEnd = new Date(changeDate);
      periodEnd.setDate(periodEnd.getDate() - 1);
      addStatusPeriod(result, currentStatus, periodStart, periodEnd);
    }

    currentStatus = history.fieldValue;

    periodStart = new Date(changeDate);
    periodStart.setHours(0, 0, 0, 0);
  }

  // Final status until month end
  if (currentStatus && periodStart <= endDate) {
    addStatusPeriod(result, currentStatus, periodStart, endDate);
  }

  return result;
};

const addStatusPeriod = (
  result: any,
  currentStatus: string,
  from: Date,
  to: Date,
) => {
  if (to < from) {
    return;
  }

  const dates: string[] = [];

  const currentDate = new Date(from);
  currentDate.setHours(0, 0, 0, 0);

  const endDate = new Date(to);
  endDate.setHours(0, 0, 0, 0);

  while (currentDate <= endDate) {
    dates.push(currentDate.toISOString().split("T")[0]);

    currentDate.setDate(currentDate.getDate() + 1);
  }

  const days = dates.length;

  switch (currentStatus) {
    case userStatus.ACTIVE:
      result.activeDays += days;
      result.activeDates.push(...dates);
      result.activePeriods.push({
        from,
        to,
        days,
      });
      break;

    case userStatus.INACTIVE:
      result.inactiveDays += days;
      result.inactiveDates.push(...dates);
      result.inactivePeriods.push({
        from,
        to,
        days,
      });
      break;

    case userStatus.DELETED:
      result.deletedDays += days;
      result.deletedDates.push(...dates);
      result.deletedPeriods.push({
        from,
        to,
        days,
      });
      break;
  }
};
