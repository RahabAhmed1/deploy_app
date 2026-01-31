import { Router, type Request, type Response } from 'express';
import { CompanyInfoModel } from '../models/CompanyInfo';
import { AppConfigModel } from '../models/AppConfig';

const router = Router();

function normalize(doc: any) {
  if (!doc) return null;
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

router.get('/company', async (_req: Request, res: Response) => {
  try {
    const doc = await CompanyInfoModel.findOne().lean();
    res.json({ ok: true, company: normalize(doc) });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err?.message || 'Failed to fetch company info' });
  }
});

router.put('/company', async (req: Request, res: Response) => {
  try {
    const body = req.body || {};
    const update: any = {
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
    const existing = await CompanyInfoModel.findOne();
    let saved;
    if (existing) {
      existing.set(update);
      saved = await existing.save();
    } else {
      saved = await CompanyInfoModel.create(update);
    }
    res.json({ ok: true, company: normalize(saved) });
  } catch (err: any) {
    res.status(400).json({ ok: false, error: err?.message || 'Failed to save company info' });
  }
});

export default router;

// App configuration
function normalizeConfig(doc: any) {
  if (!doc) return null;
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
    const doc = await AppConfigModel.findOne().lean();
    res.json({ ok: true, config: normalizeConfig(doc) });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err?.message || 'Failed to fetch settings' });
  }
});

router.put('/config', async (req, res) => {
  try {
    const body = req.body || {};
    const update: any = {
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
    const existing = await AppConfigModel.findOne();
    let saved;
    if (existing) {
      existing.set(update);
      saved = await existing.save();
    } else {
      saved = await AppConfigModel.create(update);
    }
    res.json({ ok: true, config: normalizeConfig(saved) });
  } catch (err: any) {
    res.status(400).json({ ok: false, error: err?.message || 'Failed to save settings' });
  }
});
