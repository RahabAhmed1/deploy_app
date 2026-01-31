"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const CompanyInfo_1 = require("../models/CompanyInfo");
const AppConfig_1 = require("../models/AppConfig");
const router = (0, express_1.Router)();
function normalize(doc) {
    if (!doc)
        return null;
    return {
        id: String(doc._id),
        companyName: doc.companyName || '',
        gstNo: doc.gstNo || '',
        drugLicenseNo: doc.drugLicenseNo || '',
        fssaiLicense: doc.fssaiLicense || '',
        address: doc.address || '',
        city: doc.city || '',
        state: doc.state || '',
        pinCode: doc.pinCode || '',
        phone: doc.phone || '',
        email: doc.email || '',
    };
}
router.get('/company', async (_req, res) => {
    try {
        const doc = await CompanyInfo_1.CompanyInfoModel.findOne().lean();
        res.json({ ok: true, company: normalize(doc) });
    }
    catch (err) {
        res.status(500).json({ ok: false, error: err?.message || 'Failed to fetch company info' });
    }
});
router.put('/company', async (req, res) => {
    try {
        const body = req.body || {};
        const update = {
            companyName: body.companyName ?? '',
            gstNo: body.gstNo ?? '',
            drugLicenseNo: body.drugLicenseNo ?? '',
            fssaiLicense: body.fssaiLicense ?? '',
            address: body.address ?? '',
            city: body.city ?? '',
            state: body.state ?? '',
            pinCode: body.pinCode ?? '',
            phone: body.phone ?? '',
            email: body.email ?? '',
        };
        const existing = await CompanyInfo_1.CompanyInfoModel.findOne();
        let saved;
        if (existing) {
            existing.set(update);
            saved = await existing.save();
        }
        else {
            saved = await CompanyInfo_1.CompanyInfoModel.create(update);
        }
        res.json({ ok: true, company: normalize(saved) });
    }
    catch (err) {
        res.status(400).json({ ok: false, error: err?.message || 'Failed to save company info' });
    }
});
exports.default = router;
// App configuration
function normalizeConfig(doc) {
    if (!doc)
        return null;
    return {
        id: String(doc._id),
        invoicePrefix: doc.invoicePrefix || 'INV-',
        nextInvoiceNumber: doc.nextInvoiceNumber || '2024-00001',
        defaultTaxRate: typeof doc.defaultTaxRate === 'number' ? doc.defaultTaxRate : 12,
        paymentTermsDays: typeof doc.paymentTermsDays === 'number' ? doc.paymentTermsDays : 30,
        autoGenerateInvoice: !!doc.autoGenerateInvoice,
        lowStockAlertEnabled: !!doc.lowStockAlertEnabled,
        expiryAlertEnabled: !!doc.expiryAlertEnabled,
        expiryAlertDays: typeof doc.expiryAlertDays === 'number' ? doc.expiryAlertDays : 90,
        paymentRemindersEnabled: !!doc.paymentRemindersEnabled,
        orderStatusEmailEnabled: !!doc.orderStatusEmailEnabled,
        creditLimitAlertEnabled: !!doc.creditLimitAlertEnabled,
    };
}
router.get('/config', async (_req, res) => {
    try {
        const doc = await AppConfig_1.AppConfigModel.findOne().lean();
        res.json({ ok: true, config: normalizeConfig(doc) });
    }
    catch (err) {
        res.status(500).json({ ok: false, error: err?.message || 'Failed to fetch settings' });
    }
});
router.put('/config', async (req, res) => {
    try {
        const body = req.body || {};
        const update = {
            invoicePrefix: body.invoicePrefix ?? 'INV-',
            nextInvoiceNumber: body.nextInvoiceNumber ?? '2024-00001',
            defaultTaxRate: Number(body.defaultTaxRate ?? 12),
            paymentTermsDays: Number(body.paymentTermsDays ?? 30),
            autoGenerateInvoice: !!body.autoGenerateInvoice,
            lowStockAlertEnabled: !!body.lowStockAlertEnabled,
            expiryAlertEnabled: !!body.expiryAlertEnabled,
            expiryAlertDays: Number(body.expiryAlertDays ?? 90),
            paymentRemindersEnabled: !!body.paymentRemindersEnabled,
            orderStatusEmailEnabled: !!body.orderStatusEmailEnabled,
            creditLimitAlertEnabled: !!body.creditLimitAlertEnabled,
        };
        const existing = await AppConfig_1.AppConfigModel.findOne();
        let saved;
        if (existing) {
            existing.set(update);
            saved = await existing.save();
        }
        else {
            saved = await AppConfig_1.AppConfigModel.create(update);
        }
        res.json({ ok: true, config: normalizeConfig(saved) });
    }
    catch (err) {
        res.status(400).json({ ok: false, error: err?.message || 'Failed to save settings' });
    }
});
