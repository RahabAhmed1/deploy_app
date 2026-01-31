import { Router, type Request, type Response } from 'express';
import { PurchaseModel } from '../models/Purchase';
import { SupplierModel } from '../models/Supplier';
import { ProductModel } from '../models/Product';
import { StockMovementModel } from '../models/StockMovement';
import { SupplierPaymentModel } from '../models/SupplierPayment';
import { ProductBatchModel } from '../models/ProductBatch';
import { createNotification } from '../notify';

const router = Router();

function genPurchaseNo() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const rand = Math.floor(Math.random() * 900 + 100);
  return `PUR-${y}${m}${day}-${rand}`;
}

async function postPurchaseToStock(purchase: any) {
  const items = Array.isArray(purchase.items) ? purchase.items : [];

  // Create 'in' stock movements and increment product/batch stock
  for (const it of items) {
    await StockMovementModel.create({
      date: new Date(),
      productId: it.productId,
      productName: it.productName,
      batchNo: it.batchNo,
      type: 'in',
      quantity: Number(it.quantity) || 0,
      reference: purchase.purchaseNo,
      remarks: `Purchase ${purchase.purchaseNo}`,
    });

    const p = await ProductModel.findById(it.productId);
    if (p) {
      p.stockQuantity = Math.max(0, Number(p.stockQuantity || 0) + Number(it.quantity || 0));
      if (typeof it.unitPrice === 'number' && it.unitPrice > 0) {
        p.purchasePrice = Number(it.unitPrice);
      }
      if (it.expiryDate) {
        const dt = new Date(it.expiryDate);
        if (!Number.isNaN(dt.getTime())) {
          p.expiryDate = dt as any;
        }
      }
      await p.save();
    }

    // Update or create batch stock
    if (it.batchNo && String(it.batchNo).trim() !== '') {
      const existing = await ProductBatchModel.findOne({ productId: it.productId, batchNo: String(it.batchNo).trim() });
      if (existing) {
        existing.stockQuantity = Math.max(0, Number(existing.stockQuantity || 0) + Number(it.quantity || 0));
        if (typeof it.unitPrice === 'number' && it.unitPrice > 0) existing.purchasePrice = Number(it.unitPrice);
        if (it.expiryDate) {
          const dt = new Date(it.expiryDate);
          if (!Number.isNaN(dt.getTime())) existing.expiryDate = dt as any;
        }
        await existing.save();
      } else {
        await ProductBatchModel.create({
          productId: it.productId,
          batchNo: String(it.batchNo).trim(),
          expiryDate: it.expiryDate ? new Date(it.expiryDate) : undefined,
          purchasePrice: typeof it.unitPrice === 'number' ? it.unitPrice : undefined,
          stockQuantity: Number(it.quantity) || 0,
        });
      }
    }
  }
}

// List purchases
router.get('/', async (req: Request, res: Response) => {
  try {
    const { supplierId, supplierName } = req.query as { supplierId?: string; supplierName?: string };
    const filter: any = {};
    if (supplierId) filter.supplierId = supplierId;
    else if (supplierName) filter.supplierName = supplierName;
    const docs = await PurchaseModel.find(filter).sort({ createdAt: -1 }).lean();
    const ids = docs.map((d: any) => d._id);
    const payments = await SupplierPaymentModel.aggregate([
      { $match: { purchaseId: { $in: ids } } },
      { $group: { _id: '$purchaseId', paid: { $sum: '$amount' } } },
    ]);
    const paidMap = new Map<string, number>();
    for (const p of payments) paidMap.set(String(p._id), Number(p.paid || 0));
    const purchases = docs.map((d: any) => ({
      id: String(d._id),
      purchaseNo: d.purchaseNo,
      date: d.date ? new Date(d.date).toISOString().slice(0, 10) : '',
      supplierName: d.supplierName || '',
      supplierId: d.supplierId ? String(d.supplierId) : '',
      referenceNo: d.referenceNo || '',
      itemsCount: Array.isArray(d.items) ? d.items.length : 0,
      items: Array.isArray(d.items)
        ? d.items.map((it: any) => ({
            productId: String(it.productId || it._id || ''),
            productName: it.productName || '',
            batchNo: it.batchNo || '',
            quantity: Number(it.quantity || 0),
            unitPrice: Number(it.unitPrice || 0),
            discount: Number(it.discount || 0),
            tax: Number(it.tax || 0),
            lineTotal: Number(it.lineTotal || 0),
          }))
        : [],
      subtotal: Number(d.subtotal || 0),
      discountTotal: Number(d.discountTotal || 0),
      taxTotal: Number(d.taxTotal || 0),
      netAmount: Number(d.netAmount || 0),
      paid: paidMap.get(String(d._id)) || 0,
      balance: Math.max(0, Number(d.netAmount || 0) - (paidMap.get(String(d._id)) || 0)),
      status: d.status || 'posted',
    }));
    res.json({ ok: true, purchases });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err?.message || 'Failed to fetch purchases' });
  }
});

// Get purchase by stock request id (used to prevent duplicates)
router.get('/by-stock-request/:stockRequestId', async (req: Request, res: Response) => {
  try {
    const { stockRequestId } = req.params;
    if (!stockRequestId) return res.status(400).json({ ok: false, error: 'stockRequestId is required' });
    const doc: any = await PurchaseModel.findOne({ stockRequestId }).lean();
    if (!doc) return res.status(404).json({ ok: false, error: 'Purchase not found' });
    res.json({ ok: true, purchase: doc });
  } catch (err: any) {
    res.status(400).json({ ok: false, error: err?.message || 'Failed to fetch purchase' });
  }
});

// Create a purchase and update stock
router.post('/', async (req: Request, res: Response) => {
  try {
    const body = req.body || {};
    const items = Array.isArray(body.items) ? body.items : [];
    if (!items.length) return res.status(400).json({ ok: false, error: 'At least one item is required' });

    const stockRequestId = body.stockRequestId ? String(body.stockRequestId).trim() : '';
    if (stockRequestId) {
      const existing: any = await PurchaseModel.findOne({ stockRequestId });
      if (existing) {
        return res.status(200).json({ ok: true, purchase: existing, duplicate: true });
      }
    }

    const status = String(body.status || 'posted') === 'hold' ? 'hold' : 'posted';

    let supplierName = String(body.supplierName || '').trim();
    let supplierId = body.supplierId ? String(body.supplierId) : '';
    if (supplierId) {
      const supp: any = await SupplierModel.findById(supplierId).lean();
      if (!supp) return res.status(400).json({ ok: false, error: 'Invalid supplierId' });
      supplierName = supp.name || supplierName;
    }
    if (!supplierName) return res.status(400).json({ ok: false, error: 'supplierName is required' });

    const productIds = items.map((it: any) => String(it.productId));
    const dbProducts: any[] = await ProductModel.find({ _id: { $in: productIds } }).lean();
    const byId = new Map<string, any>();
    for (const p of dbProducts) byId.set(String(p._id), p);

    const normalizedItems = items.map((it: any) => {
      const pid = String(it.productId);
      const qty = Number(it.quantity) || 0;
      const unitPrice = Number(it.unitPrice) || 0;
      const discount = Number(it.discount) || 0;
      const tax = Number(it.tax) || 0;
      if (!pid) throw new Error('productId is required');
      if (qty <= 0) throw new Error('quantity must be greater than 0');
      const p = byId.get(pid);
      if (!p) throw new Error('Product not found');
      const batchNo = (it.batchNo || p.batchNo || '').trim();
      const expiryDate = it.expiryDate ? new Date(it.expiryDate) : undefined;
      const base = qty * unitPrice;
      const afterDisc = base * (1 - discount / 100);
      const lineTotal = afterDisc * (1 + tax / 100);
      return {
        productId: p._id,
        productName: p.name || '',
        batchNo,
        expiryDate: expiryDate && !Number.isNaN(expiryDate.getTime()) ? expiryDate : undefined,
        quantity: qty,
        unitPrice,
        discount,
        tax,
        lineTotal,
      };
    });

    const subtotal = normalizedItems.reduce((s: number, it: any) => s + Number(it.quantity) * Number(it.unitPrice), 0);
    const discountTotal = normalizedItems.reduce((s: number, it: any) => s + (Number(it.quantity) * Number(it.unitPrice)) * (Number(it.discount) / 100), 0);
    const taxTotal = normalizedItems.reduce((s: number, it: any) => s + ((Number(it.quantity) * Number(it.unitPrice)) * (1 - Number(it.discount) / 100)) * (Number(it.tax) / 100), 0);
    const netAmount = normalizedItems.reduce((s: number, it: any) => s + Number(it.lineTotal || 0), 0);

    const doc = await PurchaseModel.create({
      purchaseNo: body.purchaseNo || genPurchaseNo(),
      date: body.date ? new Date(body.date) : new Date(),
      supplierName,
      supplierId: supplierId || undefined,
      stockRequestId: stockRequestId || undefined,
      referenceNo: body.referenceNo || '',
      subtotal,
      discountTotal,
      taxTotal,
      netAmount,
      notes: body.notes || '',
      items: normalizedItems,
      status,
    });

    if (status === 'posted') {
      await postPurchaseToStock(doc);
    }

    try {
      const suppId = supplierId ? String(supplierId) : '';
      const pno = doc?.purchaseNo ? String(doc.purchaseNo) : 'Purchase';
      await createNotification(
        { toRole: 'admin' },
        {
          type: 'purchase_created',
          title: 'New purchase created',
          message: `${supplierName} created ${pno}.`,
          entityType: 'purchase',
          entityId: String((doc as any)._id),
          dedupeKey: `purchase_created_admin_${String((doc as any)._id)}`,
        }
      );
      await createNotification(
        { toRole: 'staff' },
        {
          type: 'purchase_created',
          title: 'New purchase created',
          message: `${supplierName} created ${pno}.`,
          entityType: 'purchase',
          entityId: String((doc as any)._id),
          dedupeKey: `purchase_created_staff_${String((doc as any)._id)}`,
        }
      );
      if (suppId) {
        await createNotification(
          { toSupplierId: suppId },
          {
            type: 'purchase_created',
            title: 'Purchase created',
            message: `Purchase ${pno} has been created.`,
            entityType: 'purchase',
            entityId: String((doc as any)._id),
            dedupeKey: `purchase_created_supplier_${String((doc as any)._id)}`,
          }
        );
      }
    } catch {
    }

    res.status(201).json({ ok: true, purchase: doc });
  } catch (err: any) {
    res.status(400).json({ ok: false, error: err?.message || 'Failed to create purchase' });
  }
});

// Update a held purchase (resume/edit)
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const body = req.body || {};
    const purchase: any = await PurchaseModel.findById(String(id));
    if (!purchase) return res.status(404).json({ ok: false, error: 'Purchase not found' });
    if (String(purchase.status || 'posted') !== 'hold') {
      return res.status(400).json({ ok: false, error: 'Only held purchases can be edited' });
    }

    const items = Array.isArray(body.items) ? body.items : [];
    if (!items.length) return res.status(400).json({ ok: false, error: 'At least one item is required' });

    let supplierName = String(body.supplierName || purchase.supplierName || '').trim();
    let supplierId = body.supplierId ? String(body.supplierId) : (purchase.supplierId ? String(purchase.supplierId) : '');
    if (supplierId) {
      const supp: any = await SupplierModel.findById(supplierId).lean();
      if (!supp) return res.status(400).json({ ok: false, error: 'Invalid supplierId' });
      supplierName = supp.name || supplierName;
    }
    if (!supplierName) return res.status(400).json({ ok: false, error: 'supplierName is required' });

    const productIds = items.map((it: any) => String(it.productId));
    const dbProducts: any[] = await ProductModel.find({ _id: { $in: productIds } }).lean();
    const byId = new Map<string, any>();
    for (const p of dbProducts) byId.set(String(p._id), p);

    const normalizedItems = items.map((it: any) => {
      const pid = String(it.productId);
      const qty = Number(it.quantity) || 0;
      const unitPrice = Number(it.unitPrice) || 0;
      const discount = Number(it.discount) || 0;
      const tax = Number(it.tax) || 0;
      if (!pid) throw new Error('productId is required');
      if (qty <= 0) throw new Error('quantity must be greater than 0');
      const p = byId.get(pid);
      if (!p) throw new Error('Product not found');
      const batchNo = (it.batchNo || p.batchNo || '').trim();
      const expiryDate = it.expiryDate ? new Date(it.expiryDate) : undefined;
      const base = qty * unitPrice;
      const afterDisc = base * (1 - discount / 100);
      const lineTotal = afterDisc * (1 + tax / 100);
      return {
        productId: p._id,
        productName: p.name || '',
        batchNo,
        expiryDate: expiryDate && !Number.isNaN(expiryDate.getTime()) ? expiryDate : undefined,
        quantity: qty,
        unitPrice,
        discount,
        tax,
        lineTotal,
      };
    });

    const subtotal = normalizedItems.reduce((s: number, it: any) => s + Number(it.quantity) * Number(it.unitPrice), 0);
    const discountTotal = normalizedItems.reduce((s: number, it: any) => s + (Number(it.quantity) * Number(it.unitPrice)) * (Number(it.discount) / 100), 0);
    const taxTotal = normalizedItems.reduce((s: number, it: any) => s + ((Number(it.quantity) * Number(it.unitPrice)) * (1 - Number(it.discount) / 100)) * (Number(it.tax) / 100), 0);
    const netAmount = normalizedItems.reduce((s: number, it: any) => s + Number(it.lineTotal || 0), 0);

    purchase.date = body.date ? new Date(body.date) : purchase.date;
    purchase.supplierName = supplierName;
    purchase.supplierId = supplierId || undefined;
    purchase.referenceNo = body.referenceNo || '';
    purchase.subtotal = subtotal;
    purchase.discountTotal = discountTotal;
    purchase.taxTotal = taxTotal;
    purchase.netAmount = netAmount;
    purchase.notes = body.notes || '';
    purchase.items = normalizedItems;
    await purchase.save();

    res.json({ ok: true, purchase });
  } catch (err: any) {
    res.status(400).json({ ok: false, error: err?.message || 'Failed to update purchase' });
  }
});

// Post/finalize a held purchase (updates stock)
router.post('/:id/post', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const purchase: any = await PurchaseModel.findById(String(id));
    if (!purchase) return res.status(404).json({ ok: false, error: 'Purchase not found' });
    if (String(purchase.status || 'posted') !== 'hold') {
      return res.status(400).json({ ok: false, error: 'Purchase is not on hold' });
    }

    purchase.status = 'posted';
    await purchase.save();
    await postPurchaseToStock(purchase);
    res.json({ ok: true, purchase });
  } catch (err: any) {
    res.status(400).json({ ok: false, error: err?.message || 'Failed to post purchase' });
  }
});

// Delete a held purchase
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const purchase: any = await PurchaseModel.findById(String(id));
    if (!purchase) return res.status(404).json({ ok: false, error: 'Purchase not found' });
    if (String(purchase.status || 'posted') !== 'hold') {
      return res.status(400).json({ ok: false, error: 'Only held purchases can be deleted' });
    }
    const payCount = await SupplierPaymentModel.countDocuments({ purchaseId: purchase._id });
    if (payCount > 0) {
      return res.status(400).json({ ok: false, error: 'Cannot delete a purchase that has payments' });
    }

    await PurchaseModel.deleteOne({ _id: purchase._id });
    res.json({ ok: true });
  } catch (err: any) {
    res.status(400).json({ ok: false, error: err?.message || 'Failed to delete purchase' });
  }
});

export default router;
