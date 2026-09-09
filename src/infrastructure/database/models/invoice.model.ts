import { Schema, model } from "mongoose";

const InvoiceLineItemSchema = new Schema(
  {
    fromDate: {
      type: Date,
      required: true,
    },

    toDate: {
      type: Date,
      required: true,
    },

    days: {
      type: Number,
      required: true,
      min: 0,
    },

    employeeCount: {
      type: Number,
      required: true,
      min: 0,
    },

    employeeRate: {
      type: Number,
      required: true,
      min: 0,
    },

    totalAmount: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  {
    _id: false,
  },
);

const InvoiceSchema = new Schema(
  {
    companyId: {
      type: Schema.Types.ObjectId,
      ref: "Company",
      required: true,
      index: true,
    },

    invoiceNumber: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },

    billingMonth: {
      type: Number,
      required: true,
    },

    billingYear: {
      type: Number,
      required: true,
    },

    invoiceDate: {
      type: Date,
      required: true,
    },

    dueDate: {
      type: Date,
      default: null,
    },

    // Employee billing periods
    lineItems: {
      type: [InvoiceLineItemSchema],
      default: [],
    },

    // Billing calculation
    subtotal: {
      type: Number,
      default: 0,
    },

    cGST: {
      type: Number,
      default: 0,
    },

    sGST: {
      type: Number,
      default: 0,
    },

    totalAmount: {
      type: Number,
      default: 0,
    },

    payments: [
      {
        paymentMode: {
          type: String,
        },
        amount: {
          type: Number,
          default: 0,
        },
        transactionId: {
          type: String,
          default: null,
        },
        remarks: {
          type: String,
          default: null,
        },
        date: {
          type: Date,
          default: Date.now,
        },
      },
    ],

    notes: {
      type: String,
      default: "",
    },

    generatedAt: {
      type: Date,
      default: Date.now,
    },

    status: {
      type: String,
      enum: ["GENERATED", "SENDED"],
      default: "GENERATED",
    },

    invoicePdf: {
      type: String,
      default: null,
    },

    paymentStatus: {
      type: String,
      enum: ["PENDING", "PAID"],
      default: "PENDING",
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

InvoiceSchema.index(
  {
    companyId: 1,
    billingYear: 1,
    billingMonth: 1,
  },
  {
    unique: true,
  },
);

export const InvoiceModel = model("Invoice", InvoiceSchema);
