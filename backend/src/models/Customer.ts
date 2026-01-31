import mongoose, { Schema, InferSchemaType } from 'mongoose';

const CustomerSchema = new Schema(
  {
    name: { type: String, required: true },
    customerNo: { type: String, unique: true, index: true, sparse: true },
    type: { type: String, enum: ['credit', 'walk_in', 'distributor', 'wholesaler', 'retailer', 'hospital'], required: true },
    contactPerson: { type: String },
    phone: { type: String },
    email: { type: String },
    address: { type: String },
    city: { type: String },
    state: { type: String },
    creditLimit: { type: Number, default: 0 },
    outstandingBalance: { type: Number, default: 0 },
    gstNo: { type: String },
    drugLicenseNo: { type: String },
    status: { type: String, enum: ['active', 'inactive', 'blocked'], default: 'active' },
  },
  { timestamps: true }
);

export type CustomerDoc = InferSchemaType<typeof CustomerSchema> & { _id: string };

export const CustomerModel = mongoose.models.Customer || mongoose.model('Customer', CustomerSchema);
