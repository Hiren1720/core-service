import { model, Schema } from "mongoose";

const MonthlyEmployeeSnapshotSchema = new Schema(
  {
    companyId: {
      type: Schema.Types.ObjectId,
      ref: "Company",
      required: true,
      index: true,
    },

    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    year: {
      type: Number,
      required: true,
    },

    month: {
      type: Number,
      required: true,
    },

    activeDays: {
      type: Number,
      default: 0,
    },

    inactiveDays: {
      type: Number,
      default: 0,
    },

    deletedDays: {
      type: Number,
      default: 0,
    },

    activeDates: [{ type: String }],
    inactiveDates: [{ type: String }],
    deletedDates: [{ type: String }],

    activePeriods: [
      {
        from: Date,
        to: Date,
        days: Number,
      },
    ],
    inactivePeriods: [{ from: Date, to: Date, days: Number }],
    deletedPeriods: [{ from: Date, to: Date, days: Number }],
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

MonthlyEmployeeSnapshotSchema.index(
  {
    companyId: 1,
    userId: 1,
    year: 1,
    month: 1,
  },
  {
    unique: true,
  },
);

export const MonthlyEmployeeSnapshotModel = model(
  "MonthlyEmployeeSnapshot",
  MonthlyEmployeeSnapshotSchema,
);
