import mongoose, { Schema, InferSchemaType } from 'mongoose';

const SupplierPaymentSchema = new Schema(
  {
    date: { type: Date, required: true },
    supplierId: { type: Schema.Types.ObjectId, ref: 'Supplier', required: true },
    supplierName: { type: String, required: true },
    purchaseId: { type: Schema.Types.ObjectId, ref: 'Purchase' },
    amount: { type: Number, required: true },
    method: { type: String, enum: ['cash', 'upi', 'bank', 'cheque', 'other'], default: 'cash' },
    reference: { type: String },
    status: { type: String, enum: ['completed', 'void'], default: 'completed' },
  },
  { timestamps: true }
);

export type SupplierPaymentDoc = InferSchemaType<typeof SupplierPaymentSchema> & { _id: string };

export const SupplierPaymentModel = mongoose.models.SupplierPayment || mongoose.model('SupplierPayment', SupplierPaymentSchema);
