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
exports.SupplierReturnModel = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const SupplierReturnItemSchema = new mongoose_1.Schema({
    productId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Product', required: true },
    productName: { type: String },
    batchNo: { type: String },
    unitPrice: { type: Number, default: 0 },
    returnQty: { type: Number, required: true },
    lineTotal: { type: Number, default: 0 },
}, { _id: false });
const SupplierReturnSchema = new mongoose_1.Schema({
    returnCode: { type: String, unique: true },
    supplier: { type: String, required: true },
    supplierId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Supplier' },
    referenceNo: { type: String },
    reason: { type: String },
    itemsCount: { type: Number, default: 0 },
    value: { type: Number, default: 0 },
    items: { type: [SupplierReturnItemSchema], default: [] },
    date: { type: Date, required: true },
    notes: { type: String },
    status: { type: String, enum: ['pending', 'verified', 'rejected'], default: 'pending' },
}, { timestamps: true });
exports.SupplierReturnModel = mongoose_1.default.models.SupplierReturn || mongoose_1.default.model('SupplierReturn', SupplierReturnSchema);
