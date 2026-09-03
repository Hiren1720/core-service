import fs from "fs";
import path from "path";
import Handlebars from "handlebars";

export const renderEmailTemplate = (
  templateName: string,
  data: Record<string, any>,
) => {
  const templatePath = path.join(__dirname, "templates", `${templateName}.hbs`);

  const template = fs.readFileSync(templatePath, "utf-8");

  return Handlebars.compile(template)(data);
};
