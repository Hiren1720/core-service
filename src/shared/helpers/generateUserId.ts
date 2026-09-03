import { ClientSession } from "mongoose";
import {
  CompanyModel,
  UserCounterModel,
} from "../../infrastructure/database/models";

export const generateUserUniqueUserId = async (
  companyId: string,
  session: ClientSession,
) => {
  const company = await CompanyModel.findById(companyId)
    .session(session)
    .lean();

  if (!company) {
    throw new Error("Company not found");
  }

  const companyName = company.companyName?.trim() || "IEKA";

  const prefix =
    companyName
      .replace(/[^a-zA-Z]/g, "")
      .substring(0, 2)
      .toUpperCase() || "IE";

  const counter = await UserCounterModel.findOneAndUpdate(
    { _id: "USER" },
    {
      $inc: {
        sequence: 1,
      },
    },
    {
      new: true,
      upsert: true,
      session,
    },
  );

  if (!counter) {
    throw new Error("Failed to generate user ID");
  }

  return `${prefix}${counter.sequence.toString().padStart(6, "0")}`;
};
