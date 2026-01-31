import mongoose, { Schema, InferSchemaType } from 'mongoose';

const ExpenseSchema = new Schema(
  {
    date: { type: Date, required: true },
    category: { type: String, required: true },
    description: { type: String },
    amount: { type: Number, required: true },
    method: { type: String, enum: ['cash', 'bank', 'cheque', 'upi', 'other'], default: 'cash' },
    reference: { type: String },
    status: { type: String, enum: ['posted', 'void'], default: 'posted' },
  },
  { timestamps: true }
);

export type ExpenseDoc = InferSchemaType<typeof ExpenseSchema> & { _id: string };

export const ExpenseModel = mongoose.models.Expense || mongoose.model('Expense', ExpenseSchema);
