import { Router, type Request, type Response } from 'express';
import { SupplierModel } from '../models/Supplier';

const router = Router();

async function generateUniqueSupplierNo(): Promise<string> {
  for (let i = 0; i < 5; i++) {
    const d = new Date();
    const yyyymmdd = d.toISOString().slice(0, 10).replace(/-/g, '');
    const rand = Math.random().toString(36).toUpperCase().slice(2, 6);
    const id = `SUP-${yyyymmdd}-${rand}`;
    const exists = await SupplierModel.exists({ supplierNo: id });
    if (!exists) return id;
  }
  return `SUP-${Date.now()}`;
}

// Create supplier
router.post('/', async (req: Request, res: Response) => {
  try {
    const body = req.body || {};
    const doc = await SupplierModel.create({
      supplierNo: body.supplierNo ? String(body.supplierNo) : await generateUniqueSupplierNo(),
      name: body.name,
      contactPerson: body.contactPerson,
      phone: body.phone,
      email: body.email,
      address: body.address,
      city: body.city,
      state: body.state,
      gstNo: body.gstNo,
      drugLicenseNo: body.drugLicenseNo,
      status: body.status || 'active',
      paymentTermsDays: body.paymentTermsDays !== undefined ? Number(body.paymentTermsDays) : 30,
    });
    res.status(201).json({ ok: true, supplier: doc });
  } catch (err: any) {
    res.status(400).json({ ok: false, error: err?.message || 'Failed to create supplier' });
  }
});

// List suppliers
router.get('/', async (_req: Request, res: Response) => {
  try {
    const docs: any[] = await SupplierModel.find().sort({ createdAt: -1 });
    for (const d of docs) {
      if (!d.supplierNo) {
        d.supplierNo = await generateUniqueSupplierNo();
        try {
          await d.save();
        } catch {}
      }
    }
    const suppliers = docs.map((d: any) => ({
      id: String(d._id),
      supplierNo: d.supplierNo || '',
      name: d.name || '',
      contactPerson: d.contactPerson || '',
      phone: d.phone || '',
      email: d.email || '',
      address: d.address || '',
      city: d.city || '',
      state: d.state || '',
      gstNo: d.gstNo || '',
      drugLicenseNo: d.drugLicenseNo || '',
      status: d.status || 'active',
      paymentTermsDays: typeof d.paymentTermsDays === 'number' ? d.paymentTermsDays : 30,
    }));
    res.json({ ok: true, suppliers });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err?.message || 'Failed to fetch suppliers' });
  }
});

// Update supplier
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const body = req.body || {};
    const { supplierNo: _supplierNo, ...rest } = body;
    const update: any = { ...rest };
    if (body.paymentTermsDays !== undefined) update.paymentTermsDays = Number(body.paymentTermsDays) || 0;
    const doc = await SupplierModel.findByIdAndUpdate(id, update, { new: true });
    if (!doc) return res.status(404).json({ ok: false, error: 'Supplier not found' });
    res.json({ ok: true, supplier: doc });
  } catch (err: any) {
    res.status(400).json({ ok: false, error: err?.message || 'Failed to update supplier' });
  }
});

// Delete supplier
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await SupplierModel.findByIdAndDelete(id);
    if (!result) return res.status(404).json({ ok: false, error: 'Supplier not found' });
    res.json({ ok: true });
  } catch (err: any) {
    res.status(400).json({ ok: false, error: err?.message || 'Failed to delete supplier' });
  }
});

export default router;
