import mongoose, {
    Schema,
    model,
} from "mongoose";

const UserSessionSchema =
    new Schema(
        {
            userId: {
                type: Schema.Types.ObjectId,
                ref: "User",
                required: true,
            },

            refreshToken: {
                type: String,
                required: true,
            },

            deviceInfo: {
                type: String,
                default: "",
            },

            ipAddress: {
                type: String,
                default: "",
            },

            expiresAt: {
                type: Date,
                required: true,
            },
        },
        {
            timestamps: true,
        }
    );

export const UserSessionModel =
    model(
        "UserSession",
        UserSessionSchema
    );