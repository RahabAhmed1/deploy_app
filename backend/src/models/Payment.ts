import mongoose, { Schema, InferSchemaType } from 'mongoose';

const PaymentSchema = new Schema(
  {
    date: { type: Date, default: Date.now },
    customerId: { type: Schema.Types.ObjectId, ref: 'Customer', required: true },
    customerName: { type: String },
    orderId: { type: Schema.Types.ObjectId, ref: 'Order', required: true },
    amount: { type: Number, required: true },
    method: { type: String, enum: ['cash', 'bank', 'cheque', 'upi'], required: true },
    reference: { type: String },
    status: { type: String, enum: ['completed', 'pending', 'failed'], default: 'completed' },
  },
  { timestamps: true }
);

export type PaymentDoc = InferSchemaType<typeof PaymentSchema> & { _id: string };

export const PaymentModel = mongoose.models.Payment || mongoose.model('Payment', PaymentSchema);
