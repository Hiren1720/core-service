import { Response } from "express";
import { Parser } from "json2csv";

const archiver = require("archiver");
const zipEncrypted = require("archiver-zip-encrypted");

let zipRegistered = false;

const registerEncryptedZip = () => {
  if (!zipRegistered) {
    archiver.registerFormat("zip-encrypted", zipEncrypted);

    zipRegistered = true;
  }
};

export const downloadCsv = <T extends Record<string, any>>(
  res: Response,
  data: T[],
  fileName: string,
  password?: string,
) => {
  try {
    const parser = new Parser();

    const csv = parser.parse(data);

    // -----------------------------------------
    // NORMAL CSV
    // -----------------------------------------

    if (!password) {
      res.setHeader("Content-Type", "text/csv; charset=utf-8");

      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${fileName}.csv"`,
      );

      return res.status(200).send(csv);
    }

    // -----------------------------------------
    // PASSWORD PROTECTED ZIP
    // -----------------------------------------

    registerEncryptedZip();

    const archive = archiver.create("zip-encrypted", {
      zlib: {
        level: 9,
      },
      encryptionMethod: "aes256",
      password,
    });

    archive.on("error", (error: Error) => {
      console.error("Archive error:", error);

      if (!res.headersSent) {
        res.status(500).end();
      } else {
        res.end();
      }
    });

    res.setHeader("Content-Type", "application/zip");

    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${fileName}.zip"`,
    );

    archive.pipe(res);

    archive.append(Buffer.from(csv, "utf8"), {
      name: `${fileName}.csv`,
    });

    return archive.finalize();
  } catch (error) {
    throw error;
  }
};
