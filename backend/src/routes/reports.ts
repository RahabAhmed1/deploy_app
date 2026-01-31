import { Router, type Request, type Response } from 'express';
import mongoose from 'mongoose';
import { OrderModel } from '../models/Order';
import { ProductModel } from '../models/Product';
import { PaymentModel } from '../models/Payment';
import { CustomerModel } from '../models/Customer';
import { PurchaseModel } from '../models/Purchase';
import { SupplierPaymentModel } from '../models/SupplierPayment';
import { SupplierModel } from '../models/Supplier';
import PDFDocument from 'pdfkit';

const router = Router();

function csvCell(v: any) {
  const s = v === null || v === undefined ? '' : String(v);
  const escaped = s.replace(/"/g, '""');
  return `"${escaped}"`;
}

function fmtDate(d: any) {
  try {
    if (!d) return '';
    const dd = d instanceof Date ? d : new Date(d);
    if (Number.isNaN(dd.getTime())) return '';
    return dd.toISOString().slice(0, 10);
  } catch {
    return '';
  }
}

function safeFileBase(s: string) {
  return String(s || '')
    .trim()
    .replace(/[^a-z0-9_-]+/gi, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 64);
}

function sendLedgerPdf(
  res: Response,
  opts: {
    filename: string;
    title: string;
    rows: Array<{ date: string; kind: string; ref: string; debit: number; credit: number; balance: number }>;
  }
) {
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${opts.filename}"`);

  const doc = new PDFDocument({ size: 'A4', margin: 36, bufferPages: true });
  doc.pipe(res);

  const BRAND = {
    green: '#0E9F6E',
    text: '#0F172A',
    muted: '#64748B',
    border: '#E6EEF5',
    soft: '#F7FAFC',
    white: '#FFFFFF',
  };

  const startX = doc.page.margins.left;
  const tableW = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const colW = [78, 60, tableW - (78 + 60 + 66 + 66 + 70), 66, 66, 70];
  const rowH = 18;

  let pageNo = 1;
  let rowIdx = 0;

  const drawHeader = () => {
    const barH = 44;
    const top = doc.page.margins.top;
    doc.save();
    doc.rect(0, 0, doc.page.width, top + barH).fill(BRAND.white);
    doc.rect(0, 0, doc.page.width, top + barH).strokeColor(BRAND.border).lineWidth(1).stroke();
    doc.rect(0, 0, doc.page.width, top + barH).fillOpacity(1);
    doc.rect(0, 0, doc.page.width, top + barH).fill(BRAND.white);
    doc.rect(0, 0, doc.page.width, 6).fill(BRAND.green);
    doc.restore();

    doc.font('Helvetica-Bold').fontSize(16).fillColor(BRAND.text).text('PharmaFlow', startX, top + 12, { continued: true });
    doc.font('Helvetica').fontSize(10).fillColor(BRAND.muted).text(' Ledger Report');
    doc.font('Helvetica-Bold').fontSize(12).fillColor(BRAND.text).text(opts.title, startX, top + 30, { width: tableW });
    const gen = new Date().toLocaleString('en-US');
    doc.font('Helvetica').fontSize(9).fillColor(BRAND.muted).text(`Generated: ${gen}`, startX, top + 30, { width: tableW, align: 'right' });

    doc.y = top + barH + 18;
  };

  const drawTableHeader = () => {
    const y = doc.y;
    doc.save();
    doc.rect(startX, y - 4, tableW, rowH).fill(BRAND.soft);
    doc.restore();
    doc.font('Helvetica-Bold').fontSize(10).fillColor(BRAND.text);
    let x = startX;
    const heads = ['Date', 'Type', 'Ref', 'Debit', 'Credit', 'Balance'];
    for (let i = 0; i < heads.length; i++) {
      const align = i >= 3 ? 'right' : 'left';
      doc.text(heads[i], x, y, { width: colW[i], align, lineBreak: false });
      x += colW[i];
    }
    doc.moveTo(startX, y + rowH - 2).lineTo(startX + tableW, y + rowH - 2).strokeColor(BRAND.border).lineWidth(1).stroke();
    doc.y = y + rowH;
  };

  const ensureSpace = (needed: number) => {
    const bottom = doc.page.height - doc.page.margins.bottom;
    if (doc.y + needed <= bottom) return;
    doc.addPage();
    pageNo += 1;
    drawHeader();
    drawTableHeader();
  };

  const drawRow = (r: { date: string; kind: string; ref: string; debit: number; credit: number; balance: number }) => {
    ensureSpace(rowH + 2);
    const y = doc.y;
    if (rowIdx % 2 === 0) {
      doc.save();
      doc.rect(startX, y - 2, tableW, rowH).fill('#FFFFFF');
      doc.restore();
    } else {
      doc.save();
      doc.rect(startX, y - 2, tableW, rowH).fill(BRAND.soft);
      doc.restore();
    }

    doc.font('Helvetica').fontSize(10).fillColor(BRAND.text);
    let x = startX;
    const cells = [
      String(r.date || ''),
      String(r.kind || ''),
      String(r.ref || ''),
      Number(r.debit || 0).toFixed(2),
      Number(r.credit || 0).toFixed(2),
      Number(r.balance || 0).toFixed(2),
    ];
    for (let i = 0; i < cells.length; i++) {
      const align = i >= 3 ? 'right' : 'left';
      doc.text(cells[i], x, y, { width: colW[i], align, lineBreak: false, ellipsis: true });
      x += colW[i];
    }
    doc.y = y + rowH;
    rowIdx += 1;
  };

  drawHeader();
  drawTableHeader();

  let totalDebit = 0;
  let totalCredit = 0;
  let closing = 0;

  for (const r of opts.rows) {
    totalDebit += Number((r as any).debit || 0);
    totalCredit += Number((r as any).credit || 0);
    closing = Number((r as any).balance || 0);
    drawRow(r);
  }

  ensureSpace(70);
  doc.moveDown(0.6);
  doc.moveTo(startX, doc.y).lineTo(startX + tableW, doc.y).strokeColor(BRAND.border).lineWidth(1).stroke();
  doc.moveDown(0.6);

  const summaryW = 260;
  const sx = startX + tableW - summaryW;
  const line = (label: string, value: string, bold: boolean) => {
    doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(10).fillColor(BRAND.text).text(label, sx, doc.y, { width: summaryW * 0.55, lineBreak: false });
    doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(10).fillColor(BRAND.text).text(value, sx + summaryW * 0.55, doc.y, { width: summaryW * 0.45, align: 'right' });
    doc.moveDown(0.4);
  };

  line('Total Debit', totalDebit.toFixed(2), false);
  line('Total Credit', totalCredit.toFixed(2), false);
  line('Closing Balance', closing.toFixed(2), true);

  const range = doc.bufferedPageRange();
  for (let i = 0; i < range.count; i++) {
    doc.switchToPage(i);
    const footerY = doc.page.height - doc.page.margins.bottom + 12;
    doc.font('Helvetica').fontSize(9).fillColor(BRAND.muted).text(`Page ${i + 1} of ${range.count}`, startX, footerY, { width: tableW, align: 'right' });
  }

  doc.end();
}

// GET /api/reports/sales-series - monthly sales for last 6 months
router.get('/sales-series', async (_req: Request, res: Response) => {
  try {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth() - 5, 1);
    const pipeline = [
      { $match: { orderDate: { $gte: start } } },
      { $group: {
        _id: { y: { $year: '$orderDate' }, m: { $month: '$orderDate' } },
        sales: { $sum: { $ifNull: [ '$netAmount', 0 ] } },
      } },
    ];
    const agg = await (OrderModel as any).aggregate(pipeline as any);
    // Build last 6 months labels
    const months: { key: string; label: string }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2, '0')}`;
      const label = d.toLocaleString('en-US', { month: 'short' });
      months.push({ key, label });
    }
    const series = months.map(({ key, label }) => {
      const [y, m] = key.split('-').map(Number);
      const found = agg.find((a: any) => a._id.y === y && a._id.m === m);
      return { month: label, sales: found ? found.sales : 0 };
    });
    res.json({ ok: true, salesData: series });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err?.message || 'Failed to compute sales series' });
  }
});

// GET /api/reports/category-share - product category percentage share (by count)
router.get('/category-share', async (_req: Request, res: Response) => {
  try {
    const agg = await ProductModel.aggregate([
      { $group: { _id: { $ifNull: ['$category', 'Others'] }, count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);
    const total = agg.reduce((s, a) => s + a.count, 0) || 1;
    const data = agg.map(a => ({ name: a._id, value: Math.round((a.count / total) * 100) }));
    res.json({ ok: true, categoryData: data });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err?.message || 'Failed to compute category share' });
  }
});

// GET /api/reports/revenue-by-customer-type
router.get('/revenue-by-customer-type', async (_req: Request, res: Response) => {
  try {
    const agg = await OrderModel.aggregate([
      { $group: { _id: { $ifNull: ['$customerType', 'Unknown'] }, revenue: { $sum: { $ifNull: [ '$netAmount', 0 ] } } } },
      { $sort: { revenue: -1 } },
    ]);
    const total = agg.reduce((s, a) => s + a.revenue, 0) || 1;
    const data = agg.map(a => ({ type: a._id, revenue: a.revenue, percentage: Math.round((a.revenue / total) * 100) }));
    res.json({ ok: true, revenueByCustomerType: data });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err?.message || 'Failed to compute revenue by customer type' });
  }
});

router.get('/product-sales-history', async (req: Request, res: Response) => {
  try {
    const productId = String(req.query.productId || '').trim();
    if (!productId) return res.status(400).json({ ok: false, error: 'productId is required' });

    let oid: mongoose.Types.ObjectId;
    try {
      oid = new mongoose.Types.ObjectId(productId);
    } catch {
      return res.status(400).json({ ok: false, error: 'Invalid productId' });
    }

    const limit = Math.min(500, Math.max(1, Number(req.query.limit || 200)));
    const agg = await OrderModel.aggregate([
      { $match: { 'items.productId': oid } },
      { $unwind: '$items' },
      { $match: { 'items.productId': oid } },
      {
        $project: {
          _id: 1,
          orderNo: 1,
          orderDate: 1,
          customerId: 1,
          customerName: 1,
          salesmanCode: 1,
          salesmanName: 1,
          quantity: '$items.quantity',
          unitPrice: '$items.unitPrice',
          discount: '$items.discount',
          tax: '$items.tax',
          total: '$items.total',
          batchNo: '$items.batchNo',
        },
      },
      { $sort: { orderDate: -1 } },
      { $limit: limit },
    ] as any);

    const rows = (agg || []).map((r: any) => ({
      orderId: String(r._id),
      orderNo: r.orderNo || '',
      orderDate: r.orderDate ? new Date(r.orderDate).toISOString().slice(0, 10) : '',
      customerId: r.customerId ? String(r.customerId) : '',
      customerName: r.customerName || '',
      salesmanCode: r.salesmanCode || '',
      salesmanName: r.salesmanName || '',
      batchNo: r.batchNo || '',
      quantity: typeof r.quantity === 'number' ? r.quantity : 0,
      unitPrice: typeof r.unitPrice === 'number' ? r.unitPrice : 0,
      discount: typeof r.discount === 'number' ? r.discount : 0,
      tax: typeof r.tax === 'number' ? r.tax : 0,
      total: typeof r.total === 'number' ? r.total : 0,
    }));

    res.json({ ok: true, rows });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err?.message || 'Failed to fetch product sales history' });
  }
});

// GET /api/reports/customer-ledger.csv?customerId=...
router.get('/customer-ledger.csv', async (req: Request, res: Response) => {
  try {
    const customerId = String(req.query.customerId || '').trim();
    if (!customerId) return res.status(400).json({ ok: false, error: 'customerId is required' });

    const customer = await CustomerModel.findById(customerId).lean();
    if (!customer) return res.status(404).json({ ok: false, error: 'Customer not found' });

    const orders = await OrderModel.find({ customerId: customerId, docType: { $ne: 'estimate' } })
      .sort({ orderDate: 1, createdAt: 1 })
      .lean();
    const payments = await PaymentModel.find({ customerId: customerId })
      .sort({ date: 1, createdAt: 1 })
      .lean();

    const rows: Array<{ date: string; kind: 'SALE' | 'PAYMENT'; ref: string; debit: number; credit: number }> = [];
    for (const o of orders as any[]) {
      rows.push({
        date: fmtDate((o as any).orderDate),
        kind: 'SALE',
        ref: (o as any).orderNo ? String((o as any).orderNo) : String((o as any)._id),
        debit: Number((o as any).netAmount || 0),
        credit: 0,
      });
    }
    for (const p of payments as any[]) {
      const refParts = [String((p as any).method || '').toUpperCase()].filter(Boolean);
      if ((p as any).reference) refParts.push(String((p as any).reference));
      rows.push({
        date: fmtDate((p as any).date),
        kind: 'PAYMENT',
        ref: refParts.join(' '),
        debit: 0,
        credit: Number((p as any).amount || 0),
      });
    }

    rows.sort((a, b) => {
      const d = String(a.date || '').localeCompare(String(b.date || ''));
      if (d !== 0) return d;
      if (a.kind !== b.kind) return a.kind === 'SALE' ? -1 : 1;
      return String(a.ref || '').localeCompare(String(b.ref || ''));
    });

    let balance = 0;
    const lines: string[] = [];
    lines.push(['Date', 'Type', 'Ref', 'Debit', 'Credit', 'Balance'].map(csvCell).join(','));
    for (const r of rows) {
      balance = balance + Number(r.debit || 0) - Number(r.credit || 0);
      lines.push(
        [
          r.date,
          r.kind,
          r.ref,
          r.debit ? r.debit.toFixed(2) : '0.00',
          r.credit ? r.credit.toFixed(2) : '0.00',
          balance.toFixed(2),
        ]
          .map(csvCell)
          .join(',')
      );
    }

    const fname = `customer-ledger-${String((customer as any).name || 'customer').replace(/[^a-z0-9_-]+/gi, '_')}.csv`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${fname}"`);
    return res.send(lines.join('\n'));
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err?.message || 'Failed to generate customer ledger' });
  }
});

// GET /api/reports/customer-ledger.pdf?customerId=...
router.get('/customer-ledger.pdf', async (req: Request, res: Response) => {
  try {
    const customerId = String(req.query.customerId || '').trim();
    if (!customerId) return res.status(400).json({ ok: false, error: 'customerId is required' });

    const customer = await CustomerModel.findById(customerId).lean();
    if (!customer) return res.status(404).json({ ok: false, error: 'Customer not found' });

    const orders = await OrderModel.find({ customerId: customerId, docType: { $ne: 'estimate' } })
      .sort({ orderDate: 1, createdAt: 1 })
      .lean();
    const payments = await PaymentModel.find({ customerId: customerId })
      .sort({ date: 1, createdAt: 1 })
      .lean();

    const entries: Array<{ date: string; kind: string; ref: string; debit: number; credit: number }> = [];
    for (const o of orders as any[]) {
      entries.push({
        date: fmtDate((o as any).orderDate),
        kind: 'SALE',
        ref: (o as any).orderNo ? String((o as any).orderNo) : String((o as any)._id),
        debit: Number((o as any).netAmount || 0),
        credit: 0,
      });
    }
    for (const p of payments as any[]) {
      const refParts = [String((p as any).method || '').toUpperCase()].filter(Boolean);
      if ((p as any).reference) refParts.push(String((p as any).reference));
      entries.push({
        date: fmtDate((p as any).date),
        kind: 'PAYMENT',
        ref: refParts.join(' '),
        debit: 0,
        credit: Number((p as any).amount || 0),
      });
    }

    entries.sort((a, b) => {
      const d = String(a.date || '').localeCompare(String(b.date || ''));
      if (d !== 0) return d;
      if (a.kind !== b.kind) return a.kind === 'SALE' ? -1 : 1;
      return String(a.ref || '').localeCompare(String(b.ref || ''));
    });

    let balance = 0;
    const pdfRows = entries.map((e) => {
      balance = balance + Number(e.debit || 0) - Number(e.credit || 0);
      return { ...e, balance };
    });

    const customerName = String((customer as any).name || 'Customer');
    const fname = `customer-ledger-${safeFileBase(customerName) || 'customer'}.pdf`;
    return sendLedgerPdf(res, {
      filename: fname,
      title: `Customer Ledger - ${customerName}`,
      rows: pdfRows,
    });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err?.message || 'Failed to generate customer ledger PDF' });
  }
});

// GET /api/reports/supplier-ledger.csv?supplierId=...
router.get('/supplier-ledger.csv', async (req: Request, res: Response) => {
  try {
    const supplierId = String(req.query.supplierId || '').trim();
    if (!supplierId) return res.status(400).json({ ok: false, error: 'supplierId is required' });

    const supplier = await SupplierModel.findById(supplierId).lean();
    if (!supplier) return res.status(404).json({ ok: false, error: 'Supplier not found' });

    const purchases = await PurchaseModel.find({ supplierId: supplierId })
      .sort({ date: 1, createdAt: 1 })
      .lean();
    const payments = await SupplierPaymentModel.find({ supplierId: supplierId })
      .sort({ date: 1, createdAt: 1 })
      .lean();

    const rows: Array<{ date: string; kind: 'PURCHASE' | 'PAYMENT'; ref: string; debit: number; credit: number }> = [];
    for (const p of purchases as any[]) {
      rows.push({
        date: fmtDate((p as any).date),
        kind: 'PURCHASE',
        ref: (p as any).purchaseNo ? String((p as any).purchaseNo) : String((p as any)._id),
        debit: Number((p as any).netAmount || 0),
        credit: 0,
      });
    }
    for (const sp of payments as any[]) {
      const refParts = [String((sp as any).method || '').toUpperCase()].filter(Boolean);
      if ((sp as any).reference) refParts.push(String((sp as any).reference));
      rows.push({
        date: fmtDate((sp as any).date),
        kind: 'PAYMENT',
        ref: refParts.join(' '),
        debit: 0,
        credit: Number((sp as any).amount || 0),
      });
    }

    rows.sort((a, b) => {
      const d = String(a.date || '').localeCompare(String(b.date || ''));
      if (d !== 0) return d;
      if (a.kind !== b.kind) return a.kind === 'PURCHASE' ? -1 : 1;
      return String(a.ref || '').localeCompare(String(b.ref || ''));
    });

    let balance = 0;
    const lines: string[] = [];
    lines.push(['Date', 'Type', 'Ref', 'Debit', 'Credit', 'Balance'].map(csvCell).join(','));
    for (const r of rows) {
      balance = balance + Number(r.debit || 0) - Number(r.credit || 0);
      lines.push(
        [
          r.date,
          r.kind,
          r.ref,
          r.debit ? r.debit.toFixed(2) : '0.00',
          r.credit ? r.credit.toFixed(2) : '0.00',
          balance.toFixed(2),
        ]
          .map(csvCell)
          .join(',')
      );
    }

    const fname = `supplier-ledger-${String((supplier as any).name || 'supplier').replace(/[^a-z0-9_-]+/gi, '_')}.csv`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${fname}"`);
    return res.send(lines.join('\n'));
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err?.message || 'Failed to generate supplier ledger' });
  }
});

// GET /api/reports/supplier-ledger.pdf?supplierId=...
router.get('/supplier-ledger.pdf', async (req: Request, res: Response) => {
  try {
    const supplierId = String(req.query.supplierId || '').trim();
    if (!supplierId) return res.status(400).json({ ok: false, error: 'supplierId is required' });

    const supplier = await SupplierModel.findById(supplierId).lean();
    if (!supplier) return res.status(404).json({ ok: false, error: 'Supplier not found' });

    const purchases = await PurchaseModel.find({ supplierId: supplierId })
      .sort({ date: 1, createdAt: 1 })
      .lean();
    const payments = await SupplierPaymentModel.find({ supplierId: supplierId })
      .sort({ date: 1, createdAt: 1 })
      .lean();

    const entries: Array<{ date: string; kind: string; ref: string; debit: number; credit: number }> = [];
    for (const p of purchases as any[]) {
      entries.push({
        date: fmtDate((p as any).date),
        kind: 'PURCHASE',
        ref: (p as any).purchaseNo ? String((p as any).purchaseNo) : String((p as any)._id),
        debit: Number((p as any).netAmount || 0),
        credit: 0,
      });
    }
    for (const sp of payments as any[]) {
      const refParts = [String((sp as any).method || '').toUpperCase()].filter(Boolean);
      if ((sp as any).reference) refParts.push(String((sp as any).reference));
      entries.push({
        date: fmtDate((sp as any).date),
        kind: 'PAYMENT',
        ref: refParts.join(' '),
        debit: 0,
        credit: Number((sp as any).amount || 0),
      });
    }

    entries.sort((a, b) => {
      const d = String(a.date || '').localeCompare(String(b.date || ''));
      if (d !== 0) return d;
      if (a.kind !== b.kind) return a.kind === 'PURCHASE' ? -1 : 1;
      return String(a.ref || '').localeCompare(String(b.ref || ''));
    });

    let balance = 0;
    const pdfRows = entries.map((e) => {
      balance = balance + Number(e.debit || 0) - Number(e.credit || 0);
      return { ...e, balance };
    });

    const supplierName = String((supplier as any).name || 'Supplier');
    const fname = `supplier-ledger-${safeFileBase(supplierName) || 'supplier'}.pdf`;
    return sendLedgerPdf(res, {
      filename: fname,
      title: `Supplier Ledger - ${supplierName}`,
      rows: pdfRows,
    });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err?.message || 'Failed to generate supplier ledger PDF' });
  }
});

export default router;
