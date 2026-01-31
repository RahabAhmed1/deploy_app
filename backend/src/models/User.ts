import mongoose, { Schema, InferSchemaType } from 'mongoose';

const UserSchema = new Schema(
  {
    username: { type: String, required: true, unique: true, trim: true },
    email: { type: String, unique: true, sparse: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ['admin', 'staff', 'supplier', 'rider', 'customer'], default: 'staff' },
    isActive: { type: Boolean, default: true },
    staffCode: { type: String, unique: true, sparse: true, index: true },
    permissions: { type: [String], default: [] },
    supplierId: { type: Schema.Types.ObjectId, required: false },
    supplierName: { type: String, required: false },
    fullName: { type: String, required: false },
    phone: { type: String, required: false },
    address: { type: String, required: false },
    vehicleNo: { type: String, required: false },
    avatarUrl: { type: String, required: false },
  },
  { timestamps: true }
);

export type UserDoc = InferSchemaType<typeof UserSchema> & { _id: string };

export const UserModel = mongoose.models.User || mongoose.model('User', UserSchema);
