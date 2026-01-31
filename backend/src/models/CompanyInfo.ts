import mongoose, { Schema, InferSchemaType } from 'mongoose';

const CompanyInfoSchema = new Schema(
  {
    companyName: { type: String, default: '' },
    gstNo: { type: String, default: '' },
    drugLicenseNo: { type: String, default: '' },
    fssaiLicense: { type: String, default: '' },
    address: { type: String, default: '' },
    city: { type: String, default: '' },
    state: { type: String, default: '' },
    pinCode: { type: String, default: '' },
    phone: { type: String, default: '' },
    email: { type: String, default: '' },
  },
  { timestamps: true }
);

export type CompanyInfoDoc = InferSchemaType<typeof CompanyInfoSchema> & { _id: string };

export const CompanyInfoModel = mongoose.models.CompanyInfo || mongoose.model('CompanyInfo', CompanyInfoSchema);
