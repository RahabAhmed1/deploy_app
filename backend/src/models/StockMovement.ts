import mongoose, { Schema, InferSchemaType } from 'mongoose';

const StockMovementSchema = new Schema(
  {
    date: { type: Date, default: Date.now },
    productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    productName: { type: String },
    batchNo: { type: String },
    type: { type: String, enum: ['in', 'out', 'return', 'damaged'], required: true },
    quantity: { type: Number, required: true },
    reference: { type: String },
    remarks: { type: String },
  },
  { timestamps: true }
);

export type StockMovementDoc = InferSchemaType<typeof StockMovementSchema> & { _id: string };

export const StockMovementModel =
  mongoose.models.StockMovement || mongoose.model('StockMovement', StockMovementSchema);
