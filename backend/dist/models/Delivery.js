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
exports.DeliveryModel = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const LocationSchema = new mongoose_1.Schema({
    lat: { type: Number, required: true },
    lng: { type: Number, required: true },
    at: { type: Date, required: true },
}, { _id: false });
const ProofSchema = new mongoose_1.Schema({
    kind: { type: String, enum: ['pickup', 'delivered'], required: true },
    url: { type: String, required: true },
    uploadedAt: { type: Date, required: true },
}, { _id: false });
const DeliveryItemSchema = new mongoose_1.Schema({
    productId: { type: mongoose_1.Schema.Types.ObjectId, required: false },
    productName: { type: String, required: false },
    quantity: { type: Number, required: true },
    unit: { type: String, required: false },
}, { _id: false });
const DeliverySchema = new mongoose_1.Schema({
    type: { type: String, enum: ['supplier_to_admin', 'admin_to_customer'], required: true },
    status: {
        type: String,
        enum: ['created', 'assigned', 'picked_up', 'in_transit', 'reached', 'delivered', 'cancelled'],
        default: 'created',
    },
    supplierId: { type: mongoose_1.Schema.Types.ObjectId, required: false },
    supplierName: { type: String, required: false },
    customerId: { type: mongoose_1.Schema.Types.ObjectId, required: false },
    customerName: { type: String, required: false },
    customerAddress: { type: String, required: false },
    destinationAddress: { type: String, required: false },
    destinationLat: { type: Number, required: false },
    destinationLng: { type: Number, required: false },
    relatedOrderId: { type: mongoose_1.Schema.Types.ObjectId, required: false },
    relatedPurchaseId: { type: mongoose_1.Schema.Types.ObjectId, required: false },
    relatedStockRequestId: { type: mongoose_1.Schema.Types.ObjectId, required: false },
    items: { type: [DeliveryItemSchema], default: [] },
    assignedToUserId: { type: mongoose_1.Schema.Types.ObjectId, required: false },
    assignedToUsername: { type: String, required: false },
    assignedToFullName: { type: String, required: false },
    assignedToPhone: { type: String, required: false },
    assignedAt: { type: Date, required: false },
    createdByUserId: { type: String, required: false },
    createdByUsername: { type: String, required: false },
    note: { type: String, required: false },
    lastLocation: { type: LocationSchema, required: false },
    locationHistory: { type: [LocationSchema], default: [] },
    pickedUpAt: { type: Date, required: false },
    pickedUpEtaMinutes: { type: Number, required: false },
    pickedUpDistanceKm: { type: Number, required: false },
    reachedAt: { type: Date, required: false },
    deliveredAt: { type: Date, required: false },
    proofs: { type: [ProofSchema], default: [] },
    cashCollected: { type: Number, default: 0 },
}, { timestamps: true });
exports.DeliveryModel = mongoose_1.default.models.Delivery || mongoose_1.default.model('Delivery', DeliverySchema);
