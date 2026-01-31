import mongoose, { Schema, InferSchemaType } from 'mongoose';

const ReturnItemSchema = new Schema(
  {
    productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    productName: { type: String },
    batchNo: { type: String },
    originalQty: { type: Number, default: 0 },
    unitPrice: { type: Number, default: 0 },
    discount: { type: Number, default: 0 },
    tax: { type: Number, default: 0 },
    returnQty: { type: Number, required: true },
    lineTotal: { type: Number, default: 0 },
  },
  { _id: false }
);

const ReturnSchema = new Schema(
  {
    returnCode: { type: String, unique: true },
    invoiceNo: { type: String, required: true },
    customerId: { type: Schema.Types.ObjectId, ref: 'Customer' },
    customer: { type: String, required: true },
    reason: { type: String },
    condition: { type: String },
    itemsCount: { type: Number, default: 0 },
    value: { type: Number, default: 0 },
    items: { type: [ReturnItemSchema], default: [] },
    date: { type: Date, required: true },
    notes: { type: String },
    pickupWindow: { type: Date },
    assigned: { type: String },
    status: { type: String, enum: ['pending', 'verified', 'refunded', 'rejected'], default: 'pending' },
  },
  { timestamps: true }
);

export type ReturnItemDoc = InferSchemaType<typeof ReturnItemSchema>;
export type ReturnDoc = InferSchemaType<typeof ReturnSchema> & { _id: string };

export const ReturnModel = mongoose.models.Return || mongoose.model('Return', ReturnSchema);
