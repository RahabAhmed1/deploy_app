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

export function computeNextInvoiceNumber(current: string) {
  const s = String(current || '').trim();
  if (!s) return '2024-00001';
  const m = s.match(/^(.*?)(\d+)$/);
  if (!m) return s;
  const base = m[1] || '';
  const numStr = m[2] || '';
  const next = Math.max(0, Number(numStr) || 0) + 1;
  const padded = String(next).padStart(numStr.length, '0');
  return `${base}${padded}`;
}

export function buildInvoiceNo(opts: { invoicePrefix?: string; nextInvoiceNumber?: string }) {
  const prefix = String(opts.invoicePrefix || 'INV-');
  const series = String(opts.nextInvoiceNumber || '2024-00001').trim();
  if (!series) return prefix + '2024-00001';
  if (series.startsWith(prefix)) return series;
  return `${prefix}${series}`;
}

export async function ensureAppConfig() {
  const existing = await AppConfigModel.findOne();
  if (existing) return existing;
  return AppConfigModel.create({});
}
