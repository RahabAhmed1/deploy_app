import mongoose, { Schema, InferSchemaType } from 'mongoose';

const InvoiceItemSchema = new Schema(
  {
    productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    productName: { type: String },
    batchNo: { type: String },
    quantity: { type: Number, required: true },
    unitPrice: { type: Number, required: true },
    discount: { type: Number, default: 0 },
    tax: { type: Number, default: 0 },
    total: { type: Number, required: true },
  },
  { _id: false }
);

const InvoiceSchema = new Schema(
  {
    invoiceNo: { type: String, required: true, unique: true },
    orderId: { type: Schema.Types.ObjectId, ref: 'Order', required: true },
    orderNo: { type: String },
    customerId: { type: Schema.Types.ObjectId, ref: 'Customer', required: true },
    customerName: { type: String },
    customerType: { type: String },
    invoiceDate: { type: Date, required: true },
    dueDate: { type: Date },
    totalAmount: { type: Number, default: 0 },
    discountAmount: { type: Number, default: 0 },
    taxAmount: { type: Number, default: 0 },
    netAmount: { type: Number, default: 0 },
    items: { type: [InvoiceItemSchema], default: [] },
    billingAddress: { type: String },
    shippingAddress: { type: String },
    paymentTermsDays: { type: Number },
    notes: { type: String },
  },
  { timestamps: true }
);

export type InvoiceItemDoc = InferSchemaType<typeof InvoiceItemSchema>;
export type InvoiceDoc = InferSchemaType<typeof InvoiceSchema> & { _id: string };

export const InvoiceModel = mongoose.models.Invoice || mongoose.model('Invoice', InvoiceSchema);
