import { Schema, model } from "mongoose";

const UserDetailSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    parents: {
      fatherName: {
        type: String,
        trim: true,
        default: "",
      },
      fatherOccupation: {
        type: String,
        trim: true,
        default: "",
      },
      fatherPhone: {
        type: Number,
        default: null,
      },
      motherName: {
        type: String,
        trim: true,
        default: "",
      },
      motherOccupation: {
        type: String,
        trim: true,
        default: "",
      },
      motherPhone: {
        type: Number,
        default: null,
      },
    },

    bank: {
      bankName: {
        type: String,
        trim: true,
        default: "",
      },
      accountNo: {
        type: Number,
        default: null,
      },
      ifscCode: {
        type: String,
        trim: true,
        default: "",
      },
      uanNo: {
        type: String,
        trim: true,
        default: "",
      },
      esicNo: {
        type: String,
        trim: true,
        default: "",
      },
      pfJoiningDate: {
        type: Date,
        default: null,
      },
      esicJoiningDate: {
        type: Date,
        default: null,
      },
    },

    educations: [
      {
        organization: {
          type: String,
          trim: true,
          default: "",
        },
        passingYear: {
          type: Number,
          trim: true,
          default: null,
        },
        marks: {
          type: Number,
          trim: true,
          default: null,
        },
        document: {
          type: String,
          default: "",
        },
      },
    ],

    experiences: [
      {
        organization: {
          type: String,
          trim: true,
          default: "",
        },
        designation: {
          type: String,
          trim: true,
          default: "",
        },
        startDate: {
          type: Date,
          default: null,
        },
        endDate: {
          type: Date,
          default: null,
        },
        document: {
          type: String,
          default: "",
        },
      },
    ],

    documents: [
      {
        card: {
          type: String,
          enum: ["adhar", "pan", "voterId", "passport", "drivingId"],
          default: "",
        },
        cardNumber: {
          type: String,
          default: null,
        },
        front: { type: String, default: "" },
        back: { type: String, default: "" },
      },
    ],
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

export const UserDetailModel = model("UserDetail", UserDetailSchema);
