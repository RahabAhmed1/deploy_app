import { Router, type Request, type Response } from 'express';
import { SupplierPaymentModel } from '../models/SupplierPayment';
import { SupplierModel } from '../models/Supplier';
import { PurchaseModel } from '../models/Purchase';
import { SupplierReturnModel } from '../models/SupplierReturn';

const router = Router();

// List supplier payments, optionally filter by supplierId or purchaseId
router.get('/', async (req: Request, res: Response) => {
  try {
    const { supplierId, purchaseId } = req.query as { supplierId?: string; purchaseId?: string };
    const filter: any = {};
    if (supplierId) filter.supplierId = supplierId;
    if (purchaseId) filter.purchaseId = purchaseId;
    const docs = await SupplierPaymentModel.find(filter).sort({ date: -1, createdAt: -1 }).lean();
    const payments = docs.map((d: any) => ({
      id: String(d._id),
      date: d.date ? new Date(d.date).toISOString().slice(0, 10) : '',
      supplierId: d.supplierId ? String(d.supplierId) : '',
      supplierName: d.supplierName || '',
      purchaseId: d.purchaseId ? String(d.purchaseId) : '',
      amount: Number(d.amount || 0),
      method: d.method || 'cash',
      reference: d.reference || '',
      status: d.status || 'completed',
    }));
    res.json({ ok: true, payments });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err?.message || 'Failed to fetch supplier payments' });
  }
});

// Create supplier payment (can be against a specific purchase or a general payment)
router.post('/', async (req: Request, res: Response) => {
  try {
    const body = req.body || {};
    const { supplierId, purchaseId, amount, method } = body as { supplierId?: string; purchaseId?: string; amount?: number | string; method?: string };
    if (!supplierId || amount === undefined || !method) {
      return res.status(400).json({ ok: false, error: 'supplierId, amount and method are required' });
    }

    const supplier = await SupplierModel.findById(String(supplierId));
    if (!supplier) return res.status(404).json({ ok: false, error: 'Supplier not found' });

    const amtNum = Number(amount);
    if (amtNum <= 0) return res.status(400).json({ ok: false, error: 'Amount must be greater than zero' });

    // If paying against a specific purchase, validate against that purchase's remaining
    if (purchaseId) {
      const purchase = await PurchaseModel.findById(String(purchaseId));
      if (!purchase) return res.status(404).json({ ok: false, error: 'Purchase not found' });
      if (String((purchase as any).status || 'posted') !== 'posted') {
        return res.status(400).json({ ok: false, error: 'Cannot record payment for a purchase that is on hold' });
      }

      const paidAgg = await SupplierPaymentModel.aggregate([
        { $match: { purchaseId: purchase._id } },
        { $group: { _id: '$purchaseId', paid: { $sum: '$amount' } } },
      ]);
      const paidSoFar = Number(paidAgg?.[0]?.paid || 0);
      const remaining = Math.max(0, Number(purchase.netAmount || 0) - paidSoFar);
      if (amtNum > remaining) {
        return res.status(400).json({ ok: false, error: `Amount exceeds remaining balance. Remaining: ${remaining}` });
      }

      const payDoc = await SupplierPaymentModel.create({
        date: body.date ? new Date(body.date) : new Date(),
        supplierId: supplier._id,
        supplierName: supplier.name,
        purchaseId: purchase._id,
        amount: amtNum,
        method,
        reference: body.reference,
        status: body.status || 'completed',
      });

      return res.status(201).json({ ok: true, payment: payDoc });
    }

    // General supplier payment: validate against supplier-level remaining
    // Sum all purchases for supplier (prefer supplierId, fallback to supplierName if needed)
    const byIdAgg = await PurchaseModel.aggregate([
      { $match: { supplierId: supplier._id } },
      { $group: { _id: null, total: { $sum: '$netAmount' } } },
    ]);
    let totalPurchases = Number(byIdAgg?.[0]?.total || 0);
    if (totalPurchases === 0) {
      const byNameAgg = await PurchaseModel.aggregate([
        { $match: { supplierName: supplier.name } },
        { $group: { _id: null, total: { $sum: '$netAmount' } } },
      ]);
      totalPurchases = Number(byNameAgg?.[0]?.total || 0);
    }

    // Subtract verified supplier returns (credits) so you can't overpay after returns
    const retByIdAgg = await SupplierReturnModel.aggregate([
      { $match: { supplierId: supplier._id, status: 'verified' } },
      { $group: { _id: null, total: { $sum: '$value' } } },
    ]);
    let totalReturns = Number(retByIdAgg?.[0]?.total || 0);
    if (totalReturns === 0) {
      const retByNameAgg = await SupplierReturnModel.aggregate([
        { $match: { supplier: supplier.name, status: 'verified' } },
        { $group: { _id: null, total: { $sum: '$value' } } },
      ]);
      totalReturns = Number(retByNameAgg?.[0]?.total || 0);
    }
    const netPurchases = Math.max(0, totalPurchases - totalReturns);

    const paidSupplierAgg = await SupplierPaymentModel.aggregate([
      { $match: { supplierId: supplier._id } },
      { $group: { _id: '$supplierId', paid: { $sum: '$amount' } } },
    ]);
    const paidSupplier = Number(paidSupplierAgg?.[0]?.paid || 0);
    const remainingSupplier = Math.max(0, netPurchases - paidSupplier);
    if (amtNum > remainingSupplier) {
      return res.status(400).json({ ok: false, error: `Amount exceeds supplier remaining balance. Remaining: ${remainingSupplier}` });
    }

    const payDoc = await SupplierPaymentModel.create({
      date: body.date ? new Date(body.date) : new Date(),
      supplierId: supplier._id,
      supplierName: supplier.name,
      amount: amtNum,
      method,
      reference: body.reference,
      status: body.status || 'completed',
    });
    return res.status(201).json({ ok: true, payment: payDoc });
  } catch (err: any) {
    res.status(400).json({ ok: false, error: err?.message || 'Failed to create supplier payment' });
  }
});

export default router;
