import mongoose, { Schema, InferSchemaType } from 'mongoose';

const StockRequestItemSchema = new Schema(
  {
    productId: { type: Schema.Types.ObjectId, ref: 'Product' },
    productName: { type: String },
    batchNo: { type: String },
    expiryDate: { type: String },
    currentStock: { type: Number },
    minStockLevel: { type: Number },
    requestedQty: { type: Number, required: true },
    unit: { type: String },
  },
  { _id: false }
);

const StockRequestSchema = new Schema(
  {
    supplierId: { type: Schema.Types.ObjectId, ref: 'Supplier', required: true },
    supplierName: { type: String },
    requestedByUserId: { type: Schema.Types.ObjectId, ref: 'User' },
    requestedByUsername: { type: String },
    note: { type: String },
    status: { type: String, default: 'pending' },
    items: { type: [StockRequestItemSchema], default: [] },
  },
  { timestamps: true }
);

export type StockRequestDoc = InferSchemaType<typeof StockRequestSchema> & { _id: string };

export const StockRequestModel = mongoose.models.StockRequest || mongoose.model('StockRequest', StockRequestSchema);
