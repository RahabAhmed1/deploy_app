import mongoose, { Schema, InferSchemaType } from 'mongoose';

const ProductSchema = new Schema(
  {
    name: { type: String, required: true },
    genericName: { type: String },
    manufacturer: { type: String },
    category: { type: String },
    batchNo: { type: String },
    expiryDate: { type: Date },
    manufacturingDate: { type: Date },
    mrp: { type: Number },
    purchasePrice: { type: Number },
    stockQuantity: { type: Number },
    minStockLevel: { type: Number },
    unit: { type: String },
    gstRate: { type: Number },
  },
  { timestamps: true }
);

export type ProductDoc = InferSchemaType<typeof ProductSchema> & { _id: string };

export const ProductModel = mongoose.models.Product || mongoose.model('Product', ProductSchema);
