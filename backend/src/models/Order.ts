import mongoose, { Schema, InferSchemaType } from 'mongoose';

const OrderItemSchema = new Schema(
  {
    productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    batchId: { type: Schema.Types.ObjectId, ref: 'ProductBatch' },
    productName: { type: String },
    batchNo: { type: String },
    quantity: { type: Number, required: true },
    unitPrice: { type: Number, required: true },
    discount: { type: Number, default: 0 }, // percent
    tax: { type: Number, default: 0 }, // percent
    total: { type: Number, required: true },
  },
  { _id: false }
);

const OrderSchema = new Schema(
  {
    orderNo: { type: String, required: true, unique: true },
    customerId: { type: Schema.Types.ObjectId, ref: 'Customer', required: true },
    customerName: { type: String },
    customerType: { type: String },
    docType: { type: String, enum: ['sale', 'estimate'], default: 'sale' },
    salesmanId: { type: String },
    salesmanCode: { type: String },
    salesmanName: { type: String },
    orderDate: { type: Date, required: true },
    deliveryDate: { type: Date },
    totalAmount: { type: Number, default: 0 },
    discountAmount: { type: Number, default: 0 },
    taxAmount: { type: Number, default: 0 },
    netAmount: { type: Number, default: 0 },
    status: { type: String, enum: ['hold', 'pending', 'approved', 'dispatched', 'delivered', 'completed', 'cancelled'], default: 'pending' },
    paymentStatus: { type: String, enum: ['unpaid', 'partial', 'paid'], default: 'unpaid' },
    items: { type: [OrderItemSchema], default: [] },
    movementIds: { type: [Schema.Types.ObjectId], default: [] },
    deferredPosting: { type: Boolean, default: false },
    accountsPosted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export type OrderItemDoc = InferSchemaType<typeof OrderItemSchema>;
export type OrderDoc = InferSchemaType<typeof OrderSchema> & { _id: string };

export const OrderModel = mongoose.models.Order || mongoose.model('Order', OrderSchema);
