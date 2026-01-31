import mongoose, { Schema, InferSchemaType } from 'mongoose';

const ProductBatchSchema = new Schema(
  {
    productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true, index: true },
    batchNo: { type: String, required: true },
    manufacturingDate: { type: Date },
    expiryDate: { type: Date },
    purchasePrice: { type: Number },
    stockQuantity: { type: Number, default: 0 },
  },
  { timestamps: true }
);

ProductBatchSchema.index({ productId: 1, batchNo: 1 }, { unique: true });

export type ProductBatchDoc = InferSchemaType<typeof ProductBatchSchema> & { _id: string };

export const ProductBatchModel =
  mongoose.models.ProductBatch || mongoose.model('ProductBatch', ProductBatchSchema);
