import { Router, type Request, type Response } from 'express';
import { ReturnModel } from '../models/Return';
import { InvoiceModel } from '../models/Invoice';
import { ProductModel } from '../models/Product';
import { StockMovementModel } from '../models/StockMovement';
import { OrderModel } from '../models/Order';
import { CustomerModel } from '../models/Customer';
import { PaymentModel } from '../models/Payment';

const router = Router();

function genReturnCode() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const rand = Math.floor(Math.random() * 900 + 100);
  return `RET-${y}${m}${day}-${rand}`;
}

// List returns
router.get('/', async (_req: Request, res: Response) => {
  try {
    const docs = await ReturnModel.find().sort({ createdAt: -1 }).lean();

    const missingInvoiceNos = docs
      .filter((d: any) => !d.customerId && d.invoiceNo)
      .map((d: any) => String(d.invoiceNo));

    const invByNo = new Map<string, any>();
    if (missingInvoiceNos.length > 0) {
      const invs: any[] = await InvoiceModel.find({ invoiceNo: { $in: missingInvoiceNos } })
        .select({ invoiceNo: 1, customerId: 1 })
        .lean();
      for (const inv of invs) invByNo.set(String(inv.invoiceNo), inv);
    }

    const returns = docs.map((d: any) => ({
      id: String(d._id),
      returnCode: d.returnCode || '',
      date: d.date ? new Date(d.date).toISOString().slice(0, 10) : (d.createdAt ? new Date(d.createdAt).toISOString().slice(0,10) : ''),
      customerId: d.customerId ? String(d.customerId) : (invByNo.get(String(d.invoiceNo || ''))?.customerId ? String(invByNo.get(String(d.invoiceNo || ''))?.customerId) : ''),
      customer: d.customer || '',
      invoiceNo: d.invoiceNo || '',
      reason: d.reason || '',
      itemsCount: Number(d.itemsCount || 0),
      value: Number(d.value || 0),
      status: d.status || 'pending',
      condition: d.condition || '',
      assigned: d.assigned || '',
    }));
    res.json({ ok: true, returns });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err?.message || 'Failed to fetch returns' });
  }
});

// Create return
router.post('/', async (req: Request, res: Response) => {
  try {
    const body = req.body || {};
    if (!body.invoiceNo) {
      return res.status(400).json({ ok: false, error: 'invoiceNo is required' });
    }
    // Load invoice to validate items and enrich names/prices
    const inv: any = await InvoiceModel.findOne({ invoiceNo: String(body.invoiceNo) }).lean();
    if (!inv) return res.status(404).json({ ok: false, error: 'Invoice not found' });

    const items = Array.isArray(body.items) ? body.items : [];
    if (items.length === 0) return res.status(400).json({ ok: false, error: 'At least one return item is required' });

    const invMap = new Map<string, any>();
    for (const it of inv.items || []) invMap.set(String(it.productId), it);

    const normalizedItems = items.map((it: any) => {
      const ref = invMap.get(String(it.productId));
      if (!ref) throw new Error('Returned product is not part of the invoice');
      const originalQty = Number(ref.quantity) || 0;
      const rq = Number(it.returnQty) || 0;
      if (rq <= 0) throw new Error('returnQty must be greater than 0');
      if (rq > originalQty) throw new Error('returnQty cannot exceed original invoiced quantity');
      const unitPrice = Number(ref.unitPrice) || 0;
      const discount = Number(ref.discount) || 0;
      const tax = Number(ref.tax) || 0;
      const base = rq * unitPrice;
      const afterDisc = base * (1 - discount / 100);
      const lineTotal = afterDisc * (1 + tax / 100);
      return {
        productId: ref.productId,
        productName: ref.productName || '',
        batchNo: ref.batchNo || '',
        originalQty,
        unitPrice,
        discount,
        tax,
        returnQty: rq,
        lineTotal,
      };
    });

    const itemsCount = normalizedItems.reduce((s: number, it: any) => s + Number(it.returnQty || 0), 0);
    const value = normalizedItems.reduce((s: number, it: any) => s + Number(it.lineTotal || 0), 0);

    const doc = await ReturnModel.create({
      returnCode: body.returnCode || genReturnCode(),
      invoiceNo: String(body.invoiceNo),
      customerId: inv.customerId || undefined,
      customer: String(body.customer || inv.customerName || ''),
      reason: body.reason || '',
      condition: body.condition || '',
      itemsCount,
      value,
      items: normalizedItems,
      date: body.date ? new Date(body.date) : new Date(),
      notes: body.notes || '',
      pickupWindow: body.pickupWindow ? new Date(body.pickupWindow) : undefined,
      assigned: body.assigned || '',
      status: body.status || 'pending',
    });

    res.status(201).json({ ok: true, return: doc });
  } catch (err: any) {
    res.status(400).json({ ok: false, error: err?.message || 'Failed to create return' });
  }
});

// Update return status
router.patch('/:id/status', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status } = req.body || {};
    const doc: any = await ReturnModel.findById(id);
    if (!doc) return res.status(404).json({ ok: false, error: 'Return not found' });
    const prev = doc.status;
    if (status) doc.status = status;

    // When moving into 'verified' the first time, create stock movements and update product stock
    if (status === 'verified' && prev !== 'verified') {
      for (const it of (doc.items || [])) {
        // Create a return movement and increment product stock
        await StockMovementModel.create({
          date: new Date(),
          productId: it.productId,
          productName: it.productName,
          batchNo: it.batchNo,
          type: 'return',
          quantity: Number(it.returnQty) || 0,
          reference: doc.returnCode || doc.invoiceNo,
          remarks: `Return ${doc.returnCode || doc.invoiceNo} verified`,
        });
        const p = await ProductModel.findById(it.productId);
        if (p) {
          p.stockQuantity = Math.max(0, Number(p.stockQuantity || 0) + Number(it.returnQty || 0));
          await p.save();
        }
      }

      // Adjust invoice totals and item quantities
      try {
        const inv: any = await InvoiceModel.findOne({ invoiceNo: String(doc.invoiceNo) });
        if (inv) {
          let retBaseSum = 0;
          let retDiscSum = 0;
          let retTaxSum = 0;
          let retNetSum = 0;

          const itemsByPid = new Map<string, any>();
          for (const it of (inv.items || [])) itemsByPid.set(String(it.productId), it);

          for (const rit of (doc.items || [])) {
            const key = String(rit.productId);
            const invIt = itemsByPid.get(key);
            const unitPrice = Number(invIt?.unitPrice ?? rit.unitPrice ?? 0);
            const discount = Number(invIt?.discount ?? rit.discount ?? 0);
            const tax = Number(invIt?.tax ?? rit.tax ?? 0);
            const rq = Number(rit.returnQty || 0);
            const base = rq * unitPrice;
            const discAmt = base * (discount / 100);
            const baseAfterDisc = base - discAmt;
            const taxAmt = baseAfterDisc * (tax / 100);
            const net = baseAfterDisc + taxAmt;
            retBaseSum += base;
            retDiscSum += discAmt;
            retTaxSum += taxAmt;
            retNetSum += net;

            if (invIt) {
              const newQty = Math.max(0, Number(invIt.quantity || 0) - rq);
              invIt.quantity = newQty;
              const itBase = newQty * unitPrice;
              const itDisc = itBase * (discount / 100);
              const itAfterDisc = itBase - itDisc;
              const itTax = itAfterDisc * (tax / 100);
              invIt.total = itAfterDisc + itTax;
            }
          }

          inv.totalAmount = Math.max(0, Number(inv.totalAmount || 0) - retBaseSum);
          inv.discountAmount = Math.max(0, Number(inv.discountAmount || 0) - retDiscSum);
          inv.taxAmount = Math.max(0, Number(inv.taxAmount || 0) - retTaxSum);
          inv.netAmount = Math.max(0, Number(inv.netAmount || 0) - retNetSum);
          await inv.save();

          // Adjust linked order totals and items
          try {
            const order: any = await OrderModel.findById(inv.orderId);
            if (order) {
              const orderItemsByPid = new Map<string, any>();
              for (const it of (order.items || [])) orderItemsByPid.set(String(it.productId), it);

              for (const rit of (doc.items || [])) {
                const oi = orderItemsByPid.get(String(rit.productId));
                const unitPrice = Number(oi?.unitPrice ?? rit.unitPrice ?? 0);
                const discount = Number(oi?.discount ?? rit.discount ?? 0);
                const tax = Number(oi?.tax ?? rit.tax ?? 0);
                const rq = Number(rit.returnQty || 0);
                if (oi) {
                  const newQty = Math.max(0, Number(oi.quantity || 0) - rq);
                  oi.quantity = newQty;
                  const itBase = newQty * unitPrice;
                  const itDisc = itBase * (discount / 100);
                  const itAfterDisc = itBase - itDisc;
                  const itTax = itAfterDisc * (tax / 100);
                  oi.total = itAfterDisc + itTax;
                }
              }

              order.totalAmount = Math.max(0, Number(order.totalAmount || 0) - retBaseSum);
              order.discountAmount = Math.max(0, Number(order.discountAmount || 0) - retDiscSum);
              order.taxAmount = Math.max(0, Number(order.taxAmount || 0) - retTaxSum);
              order.netAmount = Math.max(0, Number(order.netAmount || 0) - retNetSum);

              // Recompute payment status based on payments vs updated net
              try {
                const agg = await PaymentModel.aggregate([
                  { $match: { orderId: order._id } },
                  { $group: { _id: '$orderId', paid: { $sum: '$amount' } } },
                ] as any);
                const paid = Number(agg?.[0]?.paid || 0);
                if (paid >= Number(order.netAmount || 0)) order.paymentStatus = 'paid';
                else if (paid > 0) order.paymentStatus = 'partial';
                else order.paymentStatus = 'unpaid';
              } catch {}

              await order.save();

              // Adjust customer's outstanding balance
              try {
                const customer = await CustomerModel.findById(order.customerId);
                if (customer) {
                  const cur = Number(customer.outstandingBalance || 0);
                  customer.outstandingBalance = Math.max(0, cur - retNetSum);
                  await customer.save();
                }
              } catch {}
            }
          } catch {}
        }
      } catch {}
    }

    await doc.save();
    res.json({ ok: true, return: doc });
  } catch (err: any) {
    res.status(400).json({ ok: false, error: err?.message || 'Failed to update return status' });
  }
});

export default router;
