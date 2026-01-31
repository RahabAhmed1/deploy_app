import mongoose, { Schema, InferSchemaType } from 'mongoose';

const ProductSchema = new Schema(
  {
    name: { type: String, required: true },
    productId: { type: String, unique: true, index: true, sparse: true },
    barcode: { type: String, unique: true, index: true, sparse: true },
    genericName: { type: String },
    manufacturer: { type: String },
    supplierId: { type: Schema.Types.ObjectId, ref: 'Supplier' },
    supplierName: { type: String },
    category: { type: String },
    unitsPerPack: { type: Number },
    unitsPerStrip: { type: Number },
    stripPrice: { type: Number },
    batchNo: { type: String },
    expiryDate: { type: Date },
    manufacturingDate: { type: Date },
    mrp: { type: Number },
    packMrp: { type: Number },
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
