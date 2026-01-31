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
exports.OrderModel = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const OrderItemSchema = new mongoose_1.Schema({
    productId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Product', required: true },
    batchId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'ProductBatch' },
    productName: { type: String },
    batchNo: { type: String },
    quantity: { type: Number, required: true },
    unitPrice: { type: Number, required: true },
    discount: { type: Number, default: 0 }, // percent
    tax: { type: Number, default: 0 }, // percent
    total: { type: Number, required: true },
}, { _id: false });
const OrderSchema = new mongoose_1.Schema({
    orderNo: { type: String, required: true, unique: true },
    customerId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Customer', required: true },
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
    movementIds: { type: [mongoose_1.Schema.Types.ObjectId], default: [] },
    deferredPosting: { type: Boolean, default: false },
    accountsPosted: { type: Boolean, default: false },
}, { timestamps: true });
exports.OrderModel = mongoose_1.default.models.Order || mongoose_1.default.model('Order', OrderSchema);
