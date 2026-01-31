import mongoose, { Schema, InferSchemaType } from 'mongoose';

const AppConfigSchema = new Schema(
  {
    // Billing
    invoicePrefix: { type: String, default: 'INV-' },
    nextInvoiceNumber: { type: String, default: '2024-00001' },
    defaultTaxRate: { type: Number, default: 12 },
    paymentTermsDays: { type: Number, default: 30 },
    autoGenerateInvoice: { type: Boolean, default: true },

    // Alerts
    lowStockAlertEnabled: { type: Boolean, default: true },
    expiryAlertEnabled: { type: Boolean, default: true },
    expiryAlertDays: { type: Number, default: 90 },
    paymentRemindersEnabled: { type: Boolean, default: true },
    orderStatusEmailEnabled: { type: Boolean, default: true },
    creditLimitAlertEnabled: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export type AppConfigDoc = InferSchemaType<typeof AppConfigSchema> & { _id: string };

export const AppConfigModel = mongoose.models.AppConfig || mongoose.model('AppConfig', AppConfigSchema);
