import { Router, type Request, type Response } from 'express';
import { InvoiceModel } from '../models/Invoice';
import { OrderModel } from '../models/Order';
import { PaymentModel } from '../models/Payment';

const router = Router();

function genInvoiceNo() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const rand = Math.floor(Math.random() * 900 + 100);
  return `INV-${y}${m}${day}-${rand}`;
}

// List invoices with payment-derived status
router.get('/', async (_req: Request, res: Response) => {
  try {
    const invDocs = await InvoiceModel.find().sort({ createdAt: -1 }).lean();
    const orderIds = invDocs.map((d: any) => d.orderId);

    // Sum payments per order
    const paymentsAgg = await PaymentModel.aggregate([
      { $match: { orderId: { $in: orderIds } } },
      { $group: { _id: '$orderId', paid: { $sum: '$amount' } } },
    ] as any);
    const paidMap = new Map<string, number>();
    for (const p of paymentsAgg) paidMap.set(String(p._id), typeof p.paid === 'number' ? p.paid : 0);

    const today = new Date();
    const invoices = invDocs.map((d: any) => {
      const paid = paidMap.get(String(d.orderId)) || 0;
      const outstanding = Math.max(0, Number(d.netAmount || 0) - Number(paid));
      const due = d.dueDate ? new Date(d.dueDate) : undefined;
      let status: 'paid' | 'partial' | 'unpaid' | 'overdue' = 'unpaid';
      if (outstanding <= 0) status = 'paid';
      else if (paid > 0) status = 'partial';
      else status = 'unpaid';
      if (status !== 'paid' && due && due < new Date(today.toDateString())) status = 'overdue';

      return {
        id: String(d._id),
        orderId: d.orderId ? String(d.orderId) : '',
        invoiceNo: d.invoiceNo,
        date: d.invoiceDate ? new Date(d.invoiceDate).toISOString().slice(0, 10) : '',
        customer: d.customerName || '',
        customerType: d.customerType || '',
        orderNo: d.orderNo || '',
        amount: typeof d.totalAmount === 'number' ? d.totalAmount : 0,
        tax: typeof d.taxAmount === 'number' ? d.taxAmount : 0,
        discount: typeof d.discountAmount === 'number' ? d.discountAmount : 0,
        total: typeof d.netAmount === 'number' ? d.netAmount : 0,
        dueDate: d.dueDate ? new Date(d.dueDate).toISOString().slice(0, 10) : '',
        status,
      };
    });

    res.json({ ok: true, invoices });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err?.message || 'Failed to fetch invoices' });
  }
});

// Create invoice from an existing order
router.post('/', async (req: Request, res: Response) => {
  try {
    const body = req.body || {};
    const orderId = body.orderId;
    if (!orderId) return res.status(400).json({ ok: false, error: 'orderId is required' });

    // Ensure order exists
    const order = await OrderModel.findById(orderId).lean();
    if (!order) return res.status(404).json({ ok: false, error: 'Order not found' });

    // Prevent duplicate invoice for the same order
    const existing = await InvoiceModel.findOne({ orderId });
    if (existing) return res.status(400).json({ ok: false, error: 'Invoice already exists for this order' });

    const invoiceDate = body.invoiceDate ? new Date(body.invoiceDate) : new Date();
    const terms = body.paymentTermsDays !== undefined ? Number(body.paymentTermsDays) : 30;
    const dueDate = body.dueDate ? new Date(body.dueDate) : new Date(invoiceDate.getTime() + terms * 24 * 60 * 60 * 1000);

    const doc = await InvoiceModel.create({
      invoiceNo: body.invoiceNo || genInvoiceNo(),
      orderId: orderId,
      orderNo: (order as any).orderNo,
      customerId: (order as any).customerId,
      customerName: (order as any).customerName,
      customerType: (order as any).customerType,
      invoiceDate,
      dueDate,
      totalAmount: (order as any).totalAmount || 0,
      discountAmount: (order as any).discountAmount || 0,
      taxAmount: (order as any).taxAmount || 0,
      netAmount: (order as any).netAmount || 0,
      items: (order as any).items || [],
      billingAddress: body.billingAddress,
      shippingAddress: body.shippingAddress,
      paymentTermsDays: terms,
      notes: body.notes,
    });

    res.status(201).json({ ok: true, invoice: doc });
  } catch (err: any) {
    res.status(400).json({ ok: false, error: err?.message || 'Failed to create invoice' });
  }
});

export default router;
// Fetch a single invoice by invoice number with items included
router.get('/by-number/:invoiceNo', async (req: Request, res: Response) => {
  try {
    const { invoiceNo } = req.params;
    const inv: any = await InvoiceModel.findOne({ invoiceNo }).lean();
    if (!inv) return res.status(404).json({ ok: false, error: 'Invoice not found' });

    const invoice = {
      id: String(inv._id),
      invoiceNo: inv.invoiceNo,
      orderId: inv.orderId ? String(inv.orderId) : '',
      orderNo: inv.orderNo || '',
      customerId: inv.customerId ? String(inv.customerId) : '',
      customerName: inv.customerName || '',
      customerType: inv.customerType || '',
      invoiceDate: inv.invoiceDate ? new Date(inv.invoiceDate).toISOString().slice(0, 10) : '',
      dueDate: inv.dueDate ? new Date(inv.dueDate).toISOString().slice(0, 10) : '',
      totalAmount: typeof inv.totalAmount === 'number' ? inv.totalAmount : 0,
      discountAmount: typeof inv.discountAmount === 'number' ? inv.discountAmount : 0,
      taxAmount: typeof inv.taxAmount === 'number' ? inv.taxAmount : 0,
      netAmount: typeof inv.netAmount === 'number' ? inv.netAmount : 0,
      items: (inv.items || []).map((it: any) => ({
        productId: String(it.productId || ''),
        productName: it.productName || '',
        batchNo: it.batchNo || '',
        quantity: Number(it.quantity) || 0,
        unitPrice: Number(it.unitPrice) || 0,
        discount: Number(it.discount) || 0,
        tax: Number(it.tax) || 0,
        total: Number(it.total) || 0,
      })),
    };

    res.json({ ok: true, invoice });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err?.message || 'Failed to fetch invoice' });
  }
});

// Fetch a single invoice by order id
router.get('/by-order/:orderId', async (req: Request, res: Response) => {
  try {
    const { orderId } = req.params;
    const inv: any = await InvoiceModel.findOne({ orderId: String(orderId) }).lean();
    if (!inv) return res.status(404).json({ ok: false, error: 'Invoice not found' });

    const invoice = {
      id: String(inv._id),
      invoiceNo: inv.invoiceNo,
      orderId: inv.orderId ? String(inv.orderId) : '',
      orderNo: inv.orderNo || '',
      customerId: inv.customerId ? String(inv.customerId) : '',
      customerName: inv.customerName || '',
      customerType: inv.customerType || '',
      invoiceDate: inv.invoiceDate ? new Date(inv.invoiceDate).toISOString().slice(0, 10) : '',
      dueDate: inv.dueDate ? new Date(inv.dueDate).toISOString().slice(0, 10) : '',
      totalAmount: typeof inv.totalAmount === 'number' ? inv.totalAmount : 0,
      discountAmount: typeof inv.discountAmount === 'number' ? inv.discountAmount : 0,
      taxAmount: typeof inv.taxAmount === 'number' ? inv.taxAmount : 0,
      netAmount: typeof inv.netAmount === 'number' ? inv.netAmount : 0,
      items: (inv.items || []).map((it: any) => ({
        productId: String(it.productId || ''),
        productName: it.productName || '',
        batchNo: it.batchNo || '',
        quantity: Number(it.quantity) || 0,
        unitPrice: Number(it.unitPrice) || 0,
        discount: Number(it.discount) || 0,
        tax: Number(it.tax) || 0,
        total: Number(it.total) || 0,
      })),
    };

    res.json({ ok: true, invoice });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err?.message || 'Failed to fetch invoice' });
  }
});

// Basic HTML invoice view (open in browser and save/print as PDF)
router.get('/by-order/:orderId/html', async (req: Request, res: Response) => {
  try {
    const { orderId } = req.params;
    const inv: any = await InvoiceModel.findOne({ orderId: String(orderId) }).lean();
    if (!inv) return res.status(404).send('Invoice not found');

    const items = Array.isArray(inv.items) ? inv.items : [];
    const rowsHtml = items
      .map((it: any, idx: number) => {
        const qty = Number(it.quantity || 0);
        const unit = Number(it.unitPrice || 0);
        const total = Number(it.total || 0);
        const disc = Number(it.discount || 0);
        const tax = Number(it.tax || 0);
        return `
          <tr>
            <td style="padding:8px;border-bottom:1px solid #e5e7eb;">${idx + 1}</td>
            <td style="padding:8px;border-bottom:1px solid #e5e7eb;">${String(it.productName || '')}</td>
            <td style="padding:8px;border-bottom:1px solid #e5e7eb;">${String(it.batchNo || '')}</td>
            <td style="padding:8px;border-bottom:1px solid #e5e7eb;text-align:right;">${qty}</td>
            <td style="padding:8px;border-bottom:1px solid #e5e7eb;text-align:right;">${unit.toFixed(2)}</td>
            <td style="padding:8px;border-bottom:1px solid #e5e7eb;text-align:right;">${disc.toFixed(2)}%</td>
            <td style="padding:8px;border-bottom:1px solid #e5e7eb;text-align:right;">${tax.toFixed(2)}%</td>
            <td style="padding:8px;border-bottom:1px solid #e5e7eb;text-align:right;">${total.toFixed(2)}</td>
          </tr>`;
      })
      .join('');

    const html = `
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <title>Invoice ${String(inv.invoiceNo || '')}</title>
        </head>
        <body style="font-family: Arial, sans-serif; margin: 24px; color: #111827;">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:16px;">
            <div>
              <div style="font-size:20px;font-weight:800;">PharmaFlow Pro</div>
              <div style="margin-top:4px;color:#6b7280;">Invoice</div>
            </div>
            <div style="text-align:right;">
              <div style="font-weight:700;">Invoice No: ${String(inv.invoiceNo || '')}</div>
              <div style="margin-top:4px;">Date: ${inv.invoiceDate ? new Date(inv.invoiceDate).toISOString().slice(0, 10) : ''}</div>
              <div style="margin-top:4px;">Order No: ${String(inv.orderNo || '')}</div>
            </div>
          </div>

          <div style="margin-top:18px;padding:14px;border:1px solid #e5e7eb;border-radius:12px;background:#f9fafb;">
            <div style="font-weight:700;">Customer</div>
            <div style="margin-top:6px;">${String(inv.customerName || '')}</div>
            <div style="margin-top:6px;color:#6b7280;">Type: ${String(inv.customerType || '')}</div>
          </div>

          <table style="width:100%;border-collapse:collapse;margin-top:18px;">
            <thead>
              <tr>
                <th style="text-align:left;padding:8px;border-bottom:2px solid #111827;">#</th>
                <th style="text-align:left;padding:8px;border-bottom:2px solid #111827;">Item</th>
                <th style="text-align:left;padding:8px;border-bottom:2px solid #111827;">Batch</th>
                <th style="text-align:right;padding:8px;border-bottom:2px solid #111827;">Qty</th>
                <th style="text-align:right;padding:8px;border-bottom:2px solid #111827;">Unit</th>
                <th style="text-align:right;padding:8px;border-bottom:2px solid #111827;">Disc</th>
                <th style="text-align:right;padding:8px;border-bottom:2px solid #111827;">Tax</th>
                <th style="text-align:right;padding:8px;border-bottom:2px solid #111827;">Total</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>

          <div style="margin-top:18px;display:flex;justify-content:flex-end;">
            <div style="min-width:280px;border:1px solid #e5e7eb;border-radius:12px;padding:14px;">
              <div style="display:flex;justify-content:space-between;">
                <div style="color:#6b7280;">Subtotal</div>
                <div>${Number(inv.totalAmount || 0).toFixed(2)}</div>
              </div>
              <div style="display:flex;justify-content:space-between;margin-top:6px;">
                <div style="color:#6b7280;">Discount</div>
                <div>${Number(inv.discountAmount || 0).toFixed(2)}</div>
              </div>
              <div style="display:flex;justify-content:space-between;margin-top:6px;">
                <div style="color:#6b7280;">Tax</div>
                <div>${Number(inv.taxAmount || 0).toFixed(2)}</div>
              </div>
              <div style="display:flex;justify-content:space-between;margin-top:10px;font-weight:800;font-size:16px;">
                <div>Net Total</div>
                <div>${Number(inv.netAmount || 0).toFixed(2)}</div>
              </div>
            </div>
          </div>

          <div style="margin-top:18px;color:#6b7280;font-size:12px;">Open browser print menu to save as PDF.</div>
        </body>
      </html>
    `;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (err: any) {
    res.status(500).send(err?.message || 'Failed to generate invoice');
  }
});
