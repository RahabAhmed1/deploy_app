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
exports.AppConfigModel = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const AppConfigSchema = new mongoose_1.Schema({
    // Billing
    invoicePrefix: { type: String, default: 'INV-' },
    nextInvoiceNumber: { type: String, default: '2024-00001' },
    defaultTaxRate: { type: Number, default: 12 },
    paymentTermsDays: { type: Number, default: 30 },
    autoGenerateInvoice: { type: Boolean, default: true },
    // Alerts
    lowStockAlertEnabled: { type: Boolean, default: true },
    expiryAlertEnabled: { type: Boolean, default: true },
    expiryAlertDays: { type: Number, default: 90 },
    paymentRemindersEnabled: { type: Boolean, default: true },
    orderStatusEmailEnabled: { type: Boolean, default: true },
    creditLimitAlertEnabled: { type: Boolean, default: true },
}, { timestamps: true });
exports.AppConfigModel = mongoose_1.default.models.AppConfig || mongoose_1.default.model('AppConfig', AppConfigSchema);
