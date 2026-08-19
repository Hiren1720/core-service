export const normalizeDate = (date: Date | string): Date => {
  if (typeof date === "string") {
    // YYYY-MM-DD
    const match = date.match(/^(\d{4})-(\d{2})-(\d{2})$/);

    if (match) {
      const [, year, month, day] = match;

      return new Date(Number(year), Number(month) - 1, Number(day), 0, 0, 0, 0);
    }
  }

  const normalized = new Date(date);

  normalized.setHours(0, 0, 0, 0);

  return normalized;
};

export const getTimeDifferenceInMinutes = (
  startTime: string,
  endTime: string,
): number => {
  const [startHour, startMinute] = startTime.split(":").map(Number);

  const [endHour, endMinute] = endTime.split(":").map(Number);

  let startTotalMinutes = startHour * 60 + startMinute;

  let endTotalMinutes = endHour * 60 + endMinute;

  // Overnight shift
  if (endTotalMinutes <= startTotalMinutes) {
    endTotalMinutes += 24 * 60;
  }

  return endTotalMinutes - startTotalMinutes;
};

export const getDaysInCurrentMonth = (): number => {
  const date = new Date();
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
};
