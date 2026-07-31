import { HolidayModel } from "../infrastructure/database/models";

interface Props {
  companyId: string;
  startDate: Date;
  endDate: Date;
  duration: "FULL_DAY" | "FIRST_HALF" | "SECOND_HALF";
  weeklyOffs: string[];
}

const weekDays = [
  "SUNDAY",
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
];

const getSaturdayRule = (date: Date) => {
  if (date.getDay() !== 6) return null;

  return `${Math.ceil(date.getDate() / 7)}SATURDAY`;
};

export const calculateLeaveDays = async ({
  companyId,
  startDate,
  endDate,
  duration,
  weeklyOffs,
}: Props) => {
  const holidays = await HolidayModel.find({
    companyId,
    startDate: {
      $lte: endDate,
    },
    endDate: {
      $gte: startDate,
    },
  }).select("startDate endDate");

  const holidaySet = new Set<string>();

  for (const holiday of holidays) {
    const current = new Date(holiday.startDate);

    while (current <= holiday.endDate) {
      holidaySet.add(current.toISOString().slice(0, 10));
      current.setDate(current.getDate() + 1);
    }
  }

  let totalDays = 0;

  const current = new Date(startDate);

  while (current <= endDate) {
    const weekday = weekDays[current.getDay()];
    const saturdayRule = getSaturdayRule(current);
    const dateKey = current.toISOString().slice(0, 10);

    const isWeeklyOff =
      weeklyOffs.includes(weekday) ||
      (saturdayRule && weeklyOffs.includes(saturdayRule));

    if (!isWeeklyOff && !holidaySet.has(dateKey)) {
      totalDays++;
    }

    current.setDate(current.getDate() + 1);
  }

  if (duration !== "FULL_DAY") {
    totalDays = 0.5;
  }

  return totalDays;
};
