import { Router, type Request, type Response } from 'express';
import { SupplierReturnModel } from '../models/SupplierReturn';
import { SupplierModel } from '../models/Supplier';
import { ProductModel } from '../models/Product';
import { StockMovementModel } from '../models/StockMovement';

const router = Router();

function genSupplierReturnCode() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const rand = Math.floor(Math.random() * 900 + 100);
  return `SRET-${y}${m}${day}-${rand}`;
}

// List supplier returns
router.get('/', async (_req: Request, res: Response) => {
  try {
    const docs = await SupplierReturnModel.find().sort({ createdAt: -1 }).lean();
    const returns = docs.map((d: any) => ({
      id: String(d._id),
      returnCode: d.returnCode || '',
      date: d.date ? new Date(d.date).toISOString().slice(0, 10) : (d.createdAt ? new Date(d.createdAt).toISOString().slice(0,10) : ''),
      supplier: d.supplier || '',
      supplierId: d.supplierId ? String(d.supplierId) : '',
      referenceNo: d.referenceNo || '',
      reason: d.reason || '',
      itemsCount: Number(d.itemsCount || 0),
      value: Number(d.value || 0),
      status: d.status || 'pending',
    }));
    res.json({ ok: true, returns });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err?.message || 'Failed to fetch supplier returns' });
  }
});

// Create supplier return
router.post('/', async (req: Request, res: Response) => {
  try {
    const body = req.body || {};
    let supplierName = String(body.supplier || '').trim();
    const supplierId = body.supplierId ? String(body.supplierId) : '';
    if (supplierId) {
      const supp: any = await SupplierModel.findById(supplierId).lean();
      if (!supp) return res.status(400).json({ ok: false, error: 'Invalid supplierId' });
      supplierName = supp.name || supplierName;
    }
    if (!supplierName) return res.status(400).json({ ok: false, error: 'supplier is required' });

    const items = Array.isArray(body.items) ? body.items : [];
    if (items.length === 0) return res.status(400).json({ ok: false, error: 'At least one return item is required' });

    const ids = items.map((it: any) => String(it.productId));
    const dbProducts: any[] = ids.length > 0 ? await ProductModel.find({ _id: { $in: ids } }).lean() : [];
    const byId = new Map<string, any>();
    for (const p of dbProducts) byId.set(String(p._id), p);

    const normalizedItems = items.map((it: any) => {
      const pid = String(it.productId);
      const rq = Number(it.returnQty) || 0;
      if (!pid) throw new Error('productId is required');
      if (rq <= 0) throw new Error('returnQty must be greater than 0');
      const p: any = byId.get(pid);
      if (!p) throw new Error('Product not found');
      const unitPrice = typeof p.purchasePrice === 'number' ? p.purchasePrice : 0;
      const lineTotal = unitPrice * rq;
      return {
        productId: p._id,
        productName: p.name || '',
        batchNo: p.batchNo || '',
        unitPrice,
        returnQty: rq,
        lineTotal,
      };
    });

    const itemsCount = normalizedItems.reduce((s: number, it: any) => s + Number(it.returnQty || 0), 0);
    const value = normalizedItems.reduce((s: number, it: any) => s + Number(it.lineTotal || 0), 0);

    const doc = await SupplierReturnModel.create({
      returnCode: body.returnCode || genSupplierReturnCode(),
      supplier: supplierName,
      supplierId: supplierId || undefined,
      referenceNo: body.referenceNo || '',
      reason: body.reason || '',
      itemsCount,
      value,
      items: normalizedItems,
      date: body.date ? new Date(body.date) : new Date(),
      notes: body.notes || '',
      status: body.status || 'pending',
    });

    res.status(201).json({ ok: true, return: doc });
  } catch (err: any) {
    res.status(400).json({ ok: false, error: err?.message || 'Failed to create supplier return' });
  }
});

// Update supplier return status
router.patch('/:id/status', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status } = req.body || {};
    const doc: any = await SupplierReturnModel.findById(id);
    if (!doc) return res.status(404).json({ ok: false, error: 'Supplier return not found' });
    const prev = doc.status;
    if (status) doc.status = status;

    // When moving into 'verified' the first time, create stock movements and decrement product stock
    if (status === 'verified' && prev !== 'verified') {
      // Validate sufficient stock for all items first
      const ids = (doc.items || []).map((it: any) => it.productId);
      const dbProducts: any[] = ids.length > 0 ? await ProductModel.find({ _id: { $in: ids } }).lean() : [];
      const byId = new Map<string, any>();
      for (const p of dbProducts) byId.set(String(p._id), p);

      for (const it of (doc.items || [])) {
        const p = byId.get(String(it.productId));
        const available = Number(p?.stockQuantity || 0);
        const qty = Number(it.returnQty) || 0;
        if (qty > available) {
          return res.status(400).json({ ok: false, error: `Insufficient stock for ${p?.name || 'product'}. Available: ${available}, required: ${qty}` });
        }
      }

      for (const it of (doc.items || [])) {
        await StockMovementModel.create({
          date: new Date(),
          productId: it.productId,
          productName: it.productName,
          batchNo: it.batchNo,
          type: 'out',
          quantity: Number(it.returnQty) || 0,
          reference: doc.returnCode,
          remarks: `Supplier Return ${doc.returnCode} verified`,
        });
        const p = await ProductModel.findById(it.productId);
        if (p) {
          p.stockQuantity = Math.max(0, Number(p.stockQuantity || 0) - Number(it.returnQty || 0));
          await p.save();
        }
      }
    }

    await doc.save();
    res.json({ ok: true, return: doc });
  } catch (err: any) {
    res.status(400).json({ ok: false, error: err?.message || 'Failed to update supplier return status' });
  }
});

export default router;
