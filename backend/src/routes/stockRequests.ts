import { Router, type Request, type Response } from 'express';
import { StockRequestModel } from '../models/StockRequest';
import { SupplierModel } from '../models/Supplier';
import { createNotification } from '../notify';

const router = Router();

router.post('/', async (req: Request, res: Response) => {
  try {
    const body = req.body || {};

    const supplierIdRaw = body.supplierId ? String(body.supplierId) : '';
    if (!supplierIdRaw) {
      return res.status(400).json({ ok: false, error: 'supplierId is required' });
    }

    const items = Array.isArray(body.items) ? body.items : [];
    if (items.length === 0) {
      return res.status(400).json({ ok: false, error: 'items are required' });
    }

    const supplier: any = await SupplierModel.findById(supplierIdRaw).lean();
    if (!supplier) {
      return res.status(400).json({ ok: false, error: 'Invalid supplierId' });
    }

    const normalizedItems = items
      .map((it: any) => ({
        productId: it.productId ? String(it.productId) : undefined,
        productName: it.productName ? String(it.productName) : undefined,
        batchNo: it.batchNo ? String(it.batchNo) : undefined,
        expiryDate: it.expiryDate ? String(it.expiryDate) : undefined,
        currentStock: it.currentStock !== undefined ? Number(it.currentStock) : undefined,
        minStockLevel: it.minStockLevel !== undefined ? Number(it.minStockLevel) : undefined,
        requestedQty: Number(it.requestedQty || 0),
        unit: it.unit ? String(it.unit) : undefined,
      }))
      .filter((it: any) => it.requestedQty && it.requestedQty > 0);

    if (normalizedItems.length === 0) {
      return res.status(400).json({ ok: false, error: 'At least one item must have requestedQty > 0' });
    }

    const doc = await StockRequestModel.create({
      supplierId: String(supplier._id),
      supplierName: String(supplier.name || ''),
      requestedByUserId: body.requestedByUserId ? String(body.requestedByUserId) : undefined,
      requestedByUsername: body.requestedByUsername ? String(body.requestedByUsername) : undefined,
      note: body.note ? String(body.note) : undefined,
      status: body.status ? String(body.status) : 'pending',
      items: normalizedItems,
    });

    try {
      const itemsCount = Array.isArray(normalizedItems) ? normalizedItems.length : 0;
      await createNotification(
        { toRole: 'admin' },
        {
          type: 'stock_request_created',
          title: 'New stock request',
          message: `${String(supplier.name || 'Supplier')} created a stock request (${itemsCount} items).`,
          entityType: 'stock_request',
          entityId: String(doc._id),
          dedupeKey: `stock_request_created_admin_${String(doc._id)}`,
        }
      );
      await createNotification(
        { toRole: 'staff' },
        {
          type: 'stock_request_created',
          title: 'New stock request',
          message: `${String(supplier.name || 'Supplier')} created a stock request (${itemsCount} items).`,
          entityType: 'stock_request',
          entityId: String(doc._id),
          dedupeKey: `stock_request_created_staff_${String(doc._id)}`,
        }
      );
      await createNotification(
        { toSupplierId: String(supplier._id) },
        {
          type: 'stock_request_created',
          title: 'Stock request submitted',
          message: 'Your stock request has been submitted.',
          entityType: 'stock_request',
          entityId: String(doc._id),
          dedupeKey: `stock_request_created_supplier_${String(doc._id)}`,
        }
      );
    } catch {
    }

    res.status(201).json({ ok: true, request: doc });
  } catch (err: any) {
    res.status(400).json({ ok: false, error: err?.message || 'Failed to create stock request' });
  }
});

router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const body = req.body || {};
    const status = body.status !== undefined ? String(body.status) : '';
    const allowed = ['pending', 'confirmed', 'created', 'dispatched', 'delivered', 'cancelled'];
    if (!status || !allowed.includes(status)) {
      return res.status(400).json({ ok: false, error: 'Invalid status' });
    }

    const before: any = await StockRequestModel.findById(id).lean();
    const prevStatus = before?.status ? String(before.status) : '';

    const doc: any = await StockRequestModel.findByIdAndUpdate(id, { $set: { status } }, { new: true }).lean();
    if (!doc) return res.status(404).json({ ok: false, error: 'Stock request not found' });

    try {
      const supplierId = doc.supplierId ? String(doc.supplierId) : '';
      const supplierName = doc.supplierName ? String(doc.supplierName) : 'Supplier';
      if (status && status !== prevStatus) {
        await createNotification(
          { toSupplierId: supplierId },
          {
            type: 'stock_request_status',
            title: 'Stock request updated',
            message: `Stock request status changed to ${status}.`,
            entityType: 'stock_request',
            entityId: String(doc._id),
            dedupeKey: `stock_request_status_supplier_${String(doc._id)}_${status}`,
          }
        );

        await createNotification(
          { toRole: 'admin' },
          {
            type: 'stock_request_status',
            title: 'Stock request updated',
            message: `${supplierName} stock request is now ${status}.`,
            entityType: 'stock_request',
            entityId: String(doc._id),
            dedupeKey: `stock_request_status_admin_${String(doc._id)}_${status}`,
          }
        );

        await createNotification(
          { toRole: 'staff' },
          {
            type: 'stock_request_status',
            title: 'Stock request updated',
            message: `${supplierName} stock request is now ${status}.`,
            entityType: 'stock_request',
            entityId: String(doc._id),
            dedupeKey: `stock_request_status_staff_${String(doc._id)}_${status}`,
          }
        );
      }
    } catch {
    }

    return res.json({
      ok: true,
      request: {
        id: String(doc._id),
        supplierId: doc.supplierId ? String(doc.supplierId) : '',
        supplierName: doc.supplierName || '',
        requestedByUserId: doc.requestedByUserId ? String(doc.requestedByUserId) : '',
        requestedByUsername: doc.requestedByUsername || '',
        note: doc.note || '',
        status: doc.status || 'pending',
        items: Array.isArray(doc.items) ? doc.items : [],
        createdAt: doc.createdAt ? new Date(doc.createdAt).toISOString() : '',
        updatedAt: doc.updatedAt ? new Date(doc.updatedAt).toISOString() : '',
      },
    });
  } catch (err: any) {
    return res.status(400).json({ ok: false, error: err?.message || 'Failed to update stock request' });
  }
});

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const doc: any = await StockRequestModel.findById(id).lean();
    if (!doc) return res.status(404).json({ ok: false, error: 'Stock request not found' });
    return res.json({
      ok: true,
      request: {
        id: String(doc._id),
        supplierId: doc.supplierId ? String(doc.supplierId) : '',
        supplierName: doc.supplierName || '',
        requestedByUserId: doc.requestedByUserId ? String(doc.requestedByUserId) : '',
        requestedByUsername: doc.requestedByUsername || '',
        note: doc.note || '',
        status: doc.status || 'pending',
        items: Array.isArray(doc.items) ? doc.items : [],
        createdAt: doc.createdAt ? new Date(doc.createdAt).toISOString() : '',
        updatedAt: doc.updatedAt ? new Date(doc.updatedAt).toISOString() : '',
      },
    });
  } catch (err: any) {
    return res.status(400).json({ ok: false, error: err?.message || 'Failed to fetch stock request' });
  }
});

router.get('/', async (req: Request, res: Response) => {
  try {
    const supplierId = req.query.supplierId ? String(req.query.supplierId) : '';
    const status = req.query.status ? String(req.query.status) : '';

    const q: any = {};
    if (supplierId) q.supplierId = supplierId;
    if (status) q.status = status;

    const docs: any[] = await StockRequestModel.find(q).sort({ createdAt: -1 }).lean();
    const requests = docs.map((d: any) => ({
      id: String(d._id),
      supplierId: d.supplierId ? String(d.supplierId) : '',
      supplierName: d.supplierName || '',
      requestedByUserId: d.requestedByUserId ? String(d.requestedByUserId) : '',
      requestedByUsername: d.requestedByUsername || '',
      note: d.note || '',
      status: d.status || 'pending',
      items: Array.isArray(d.items) ? d.items : [],
      createdAt: d.createdAt ? new Date(d.createdAt).toISOString() : '',
      updatedAt: d.updatedAt ? new Date(d.updatedAt).toISOString() : '',
    }));

    res.json({ ok: true, requests });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err?.message || 'Failed to fetch stock requests' });
  }
});

export default router;
