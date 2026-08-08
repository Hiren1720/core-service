export const normalizeDate = (date: Date | string): Date => {
  if (typeof date === "string") {
    // YYYY-MM-DD
    const match = date.match(/^(\d{4})-(\d{2})-(\d{2})$/);

    if (match) {
      const [, year, month, day] = match;

      return new Date(
        Number(year),
        Number(month) - 1,
        Number(day),
        0,
        0,
        0,
        0,
      );
    }
  }

  const normalized = new Date(date);

  normalized.setHours(0, 0, 0, 0);

  return normalized;
};