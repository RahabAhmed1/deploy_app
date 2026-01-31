import mongoose, { Schema, InferSchemaType } from 'mongoose';

const PurchaseItemSchema = new Schema(
  {
    productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    productName: { type: String },
    batchNo: { type: String },
    expiryDate: { type: Date },
    quantity: { type: Number, required: true },
    unitPrice: { type: Number, required: true },
    discount: { type: Number, default: 0 },
    tax: { type: Number, default: 0 },
    lineTotal: { type: Number, default: 0 },
  },
  { _id: false }
);

const PurchaseSchema = new Schema(
  {
    purchaseNo: { type: String, unique: true },
    date: { type: Date, required: true },
    supplierName: { type: String, required: true },
    supplierId: { type: Schema.Types.ObjectId, ref: 'Supplier' },
    stockRequestId: { type: Schema.Types.ObjectId, ref: 'StockRequest', index: true, unique: true, sparse: true },
    referenceNo: { type: String },
    subtotal: { type: Number, default: 0 },
    discountTotal: { type: Number, default: 0 },
    taxTotal: { type: Number, default: 0 },
    netAmount: { type: Number, default: 0 },
    notes: { type: String },
    items: { type: [PurchaseItemSchema], default: [] },
    status: { type: String, enum: ['hold', 'posted'], default: 'posted' },
  },
  { timestamps: true }
);

export type PurchaseItemDoc = InferSchemaType<typeof PurchaseItemSchema>;
export type PurchaseDoc = InferSchemaType<typeof PurchaseSchema> & { _id: string };

export const PurchaseModel = mongoose.models.Purchase || mongoose.model('Purchase', PurchaseSchema);
