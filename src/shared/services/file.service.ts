import fs from "fs";
import path from "path";

interface SaveFileOptions {
  file: Express.Multer.File;
  folder: string;
  entityId: string;
  fileName: string;
}

export const saveFile = ({
  file,
  folder,
  entityId,
  fileName,
}: SaveFileOptions) => {
  const ext = path.extname(
    file.originalname
  );

  const uploadDir = path.join(
    process.cwd(),
    "public",
    "uploads",
    folder,
    entityId
  );

  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, {
      recursive: true,
    });
  }

  const finalFileName =
    `${fileName}${ext}`;

  const finalPath = path.join(
    uploadDir,
    finalFileName
  );

  fs.renameSync(
    file.path,
    finalPath
  );

  return `/uploads/${folder}/${entityId}/${finalFileName}`;
};  