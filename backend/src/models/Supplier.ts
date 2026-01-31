import mongoose, { Schema, InferSchemaType } from 'mongoose';

const SupplierSchema = new Schema(
  {
    name: { type: String, required: true },
    supplierNo: { type: String, unique: true, index: true, sparse: true },
    contactPerson: { type: String },
    phone: { type: String },
    email: { type: String },
    address: { type: String },
    city: { type: String },
    state: { type: String },
    gstNo: { type: String },
    drugLicenseNo: { type: String },
    status: { type: String, enum: ['active', 'inactive', 'blocked'], default: 'active' },
    paymentTermsDays: { type: Number, default: 30 },
  },
  { timestamps: true }
);

export type SupplierDoc = InferSchemaType<typeof SupplierSchema> & { _id: string };

export const SupplierModel = mongoose.models.Supplier || mongoose.model('Supplier', SupplierSchema);
