// utils/downloadCsv.ts

import { Response } from "express";
import { Parser } from "json2csv";

export const downloadCsv = <T extends Record<string, any>>(
  res: Response,
  data: T[],
  fileName: string,
) => {
  try {
    const parser = new Parser();
    const csv = parser.parse(data);

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${fileName}.csv"`,
    );

    return res.status(200).send(csv);
  } catch (error) {
    throw error;
  }
};
