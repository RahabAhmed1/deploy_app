"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const Supplier_1 = require("../models/Supplier");
const router = (0, express_1.Router)();
async function generateUniqueSupplierNo() {
    for (let i = 0; i < 5; i++) {
        const d = new Date();
        const yyyymmdd = d.toISOString().slice(0, 10).replace(/-/g, '');
        const rand = Math.random().toString(36).toUpperCase().slice(2, 6);
        const id = `SUP-${yyyymmdd}-${rand}`;
        const exists = await Supplier_1.SupplierModel.exists({ supplierNo: id });
        if (!exists)
            return id;
    }
    return `SUP-${Date.now()}`;
}
// Create supplier
router.post('/', async (req, res) => {
    try {
        const body = req.body || {};
        const doc = await Supplier_1.SupplierModel.create({
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
    }
    catch (err) {
        res.status(400).json({ ok: false, error: err?.message || 'Failed to create supplier' });
    }
});
// List suppliers
router.get('/', async (_req, res) => {
    try {
        const docs = await Supplier_1.SupplierModel.find().sort({ createdAt: -1 });
        for (const d of docs) {
            if (!d.supplierNo) {
                d.supplierNo = await generateUniqueSupplierNo();
                try {
                    await d.save();
                }
                catch { }
            }
        }
        const suppliers = docs.map((d) => ({
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
    }
    catch (err) {
        res.status(500).json({ ok: false, error: err?.message || 'Failed to fetch suppliers' });
    }
});
// Update supplier
router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const body = req.body || {};
        const { supplierNo: _supplierNo, ...rest } = body;
        const update = { ...rest };
        if (body.paymentTermsDays !== undefined)
            update.paymentTermsDays = Number(body.paymentTermsDays) || 0;
        const doc = await Supplier_1.SupplierModel.findByIdAndUpdate(id, update, { new: true });
        if (!doc)
            return res.status(404).json({ ok: false, error: 'Supplier not found' });
        res.json({ ok: true, supplier: doc });
    }
    catch (err) {
        res.status(400).json({ ok: false, error: err?.message || 'Failed to update supplier' });
    }
});
// Delete supplier
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const result = await Supplier_1.SupplierModel.findByIdAndDelete(id);
        if (!result)
            return res.status(404).json({ ok: false, error: 'Supplier not found' });
        res.json({ ok: true });
    }
    catch (err) {
        res.status(400).json({ ok: false, error: err?.message || 'Failed to delete supplier' });
    }
});
exports.default = router;
