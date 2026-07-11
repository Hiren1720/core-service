import { ClientSession } from "mongoose";
import { UserHistoryModel } from "../../infrastructure/database/models";

export const addUserHistory = async (
  data: {
    userId: string;
    field: string;
    fieldValue: any;
    remarks: string;
    assignedBy: string;
  },
  session?: ClientSession,
) => {
  try {
    const { userId, field, fieldValue, remarks, assignedBy } = data;
    
    await UserHistoryModel.create(
      [
        {
          userId,
          field,
          fieldValue,
          remarks,
          assignedBy,
        },
      ],
      { session },
    );
  } catch (error) {
    console.error("Error while creating history:", error);
    throw error;
  }
};
