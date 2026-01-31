"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.InvoiceModel = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const InvoiceItemSchema = new mongoose_1.Schema({
    productId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Product', required: true },
    productName: { type: String },
    batchNo: { type: String },
    quantity: { type: Number, required: true },
    unitPrice: { type: Number, required: true },
    discount: { type: Number, default: 0 },
    tax: { type: Number, default: 0 },
    total: { type: Number, required: true },
}, { _id: false });
const InvoiceSchema = new mongoose_1.Schema({
    invoiceNo: { type: String, required: true, unique: true },
    orderId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Order', required: true },
    orderNo: { type: String },
    customerId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Customer', required: true },
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
}, { timestamps: true });
exports.InvoiceModel = mongoose_1.default.models.Invoice || mongoose_1.default.model('Invoice', InvoiceSchema);
