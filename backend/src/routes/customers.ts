import { Router, type Request, type Response } from 'express';
import { CustomerModel } from '../models/Customer';

const router = Router();

async function generateUniqueCustomerNo(): Promise<string> {
  for (let i = 0; i < 5; i++) {
    const d = new Date();
    const yyyymmdd = d.toISOString().slice(0, 10).replace(/-/g, '');
    const rand = Math.random().toString(36).toUpperCase().slice(2, 6);
    const id = `CUS-${yyyymmdd}-${rand}`;
    const exists = await CustomerModel.exists({ customerNo: id });
    if (!exists) return id;
  }
  return `CUS-${Date.now()}`;
}

// Create
router.post('/', async (req: Request, res: Response) => {
  try {
    const body = req.body || {};
    const type = body.type ? String(body.type) : 'credit';
    const doc = await CustomerModel.create({
      customerNo: body.customerNo ? String(body.customerNo) : await generateUniqueCustomerNo(),
      name: body.name,
      type,
      contactPerson: body.contactPerson,
      phone: body.phone,
      email: body.email,
      address: body.address,
      city: body.city,
      state: body.state,
      creditLimit: body.creditLimit ? Number(body.creditLimit) : 0,
      outstandingBalance: 0,
      gstNo: body.gstNo,
      drugLicenseNo: body.drugLicenseNo,
      status: body.status || 'active',
    });
    res.status(201).json({ ok: true, customer: doc });
  } catch (err: any) {
    res.status(400).json({ ok: false, error: err?.message || 'Failed to create customer' });
  }
});

// List
router.get('/', async (_req: Request, res: Response) => {
  try {
    const docs: any[] = await CustomerModel.find().sort({ createdAt: -1 });
    for (const d of docs) {
      if (!d.customerNo) {
        d.customerNo = await generateUniqueCustomerNo();
        try {
          await d.save();
        } catch {}
      }
    }
    const customers = docs.map((d: any) => ({
      id: String(d._id),
      customerNo: d.customerNo || '',
      name: d.name || '',
      type: d.type || 'retailer',
      contactPerson: d.contactPerson || '',
      phone: d.phone || '',
      email: d.email || '',
      address: d.address || '',
      city: d.city || '',
      state: d.state || '',
      creditLimit: typeof d.creditLimit === 'number' ? d.creditLimit : 0,
      outstandingBalance: typeof d.outstandingBalance === 'number' ? d.outstandingBalance : 0,
      gstNo: d.gstNo || '',
      drugLicenseNo: d.drugLicenseNo || '',
      status: d.status || 'active',
    }));
    res.json({ ok: true, customers });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err?.message || 'Failed to fetch customers' });
  }
});

// Update
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const body = req.body || {};
    const { customerNo: _customerNo, outstandingBalance: _outstandingBalance, ...rest } = body;
    const update: any = { ...rest };
    if (body.creditLimit !== undefined) update.creditLimit = Number(body.creditLimit) || 0;
    const doc = await CustomerModel.findByIdAndUpdate(id, update, { new: true });
    if (!doc) return res.status(404).json({ ok: false, error: 'Customer not found' });
    res.json({ ok: true, customer: doc });
  } catch (err: any) {
    res.status(400).json({ ok: false, error: err?.message || 'Failed to update customer' });
  }
});

// Delete
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await CustomerModel.findByIdAndDelete(id);
    if (!result) return res.status(404).json({ ok: false, error: 'Customer not found' });
    res.json({ ok: true });
  } catch (err: any) {
    res.status(400).json({ ok: false, error: err?.message || 'Failed to delete customer' });
  }
});

export default router;
