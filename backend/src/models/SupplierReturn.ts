import mongoose, { Schema, InferSchemaType } from 'mongoose';

const SupplierReturnItemSchema = new Schema(
  {
    productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    productName: { type: String },
    batchNo: { type: String },
    unitPrice: { type: Number, default: 0 },
    returnQty: { type: Number, required: true },
    lineTotal: { type: Number, default: 0 },
  },
  { _id: false }
);

const SupplierReturnSchema = new Schema(
  {
    returnCode: { type: String, unique: true },
    supplier: { type: String, required: true },
    supplierId: { type: Schema.Types.ObjectId, ref: 'Supplier' },
    referenceNo: { type: String },
    reason: { type: String },
    itemsCount: { type: Number, default: 0 },
    value: { type: Number, default: 0 },
    items: { type: [SupplierReturnItemSchema], default: [] },
    date: { type: Date, required: true },
    notes: { type: String },
    status: { type: String, enum: ['pending', 'verified', 'rejected'], default: 'pending' },
  },
  { timestamps: true }
);

export type SupplierReturnItemDoc = InferSchemaType<typeof SupplierReturnItemSchema>;
export type SupplierReturnDoc = InferSchemaType<typeof SupplierReturnSchema> & { _id: string };

export const SupplierReturnModel =
  mongoose.models.SupplierReturn || mongoose.model('SupplierReturn', SupplierReturnSchema);
