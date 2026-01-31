"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const Product_1 = require("../models/Product");
const Supplier_1 = require("../models/Supplier");
const ProductBatch_1 = require("../models/ProductBatch");
const router = (0, express_1.Router)();
async function generateUniqueProductId() {
    for (let i = 0; i < 5; i++) {
        const d = new Date();
        const yyyymmdd = d.toISOString().slice(0, 10).replace(/-/g, '');
        const rand = Math.random().toString(36).toUpperCase().slice(2, 6);
        const id = `PRD-${yyyymmdd}-${rand}`;
        const exists = await Product_1.ProductModel.exists({ productId: id });
        if (!exists)
            return id;
    }
    return `PRD-${Date.now()}`;
}
// Create a new product
router.post('/', async (req, res) => {
    try {
        const body = req.body || {};
        if (body.stockQuantity !== undefined && Number(body.stockQuantity) < 0) {
            return res.status(400).json({ ok: false, error: 'stockQuantity cannot be negative' });
        }
        if (body.minStockLevel !== undefined && Number(body.minStockLevel) < 0) {
            return res.status(400).json({ ok: false, error: 'minStockLevel cannot be negative' });
        }
        // Resolve supplier name if supplierId is provided
        let supplierId = undefined;
        let supplierName = undefined;
        if (body.supplierId) {
            const supp = await Supplier_1.SupplierModel.findById(String(body.supplierId)).lean();
            if (!supp)
                return res.status(400).json({ ok: false, error: 'Invalid supplierId' });
            supplierId = String(supp._id);
            supplierName = supp.name;
        }
        else if (body.supplierName) {
            supplierName = String(body.supplierName);
        }
        const doc = await Product_1.ProductModel.create({
            productId: body.productId ? String(body.productId) : await generateUniqueProductId(),
            barcode: body.barcode ? String(body.barcode) : undefined,
            name: body.name,
            genericName: body.genericName,
            manufacturer: body.manufacturer,
            supplierId: supplierId,
            supplierName: supplierName,
            category: body.category,
            unitsPerPack: body.unitsPerPack !== undefined && body.unitsPerPack !== '' ? Number(body.unitsPerPack) : undefined,
            unitsPerStrip: body.unitsPerStrip !== undefined && body.unitsPerStrip !== '' ? Number(body.unitsPerStrip) : undefined,
            stripPrice: body.stripPrice !== undefined && body.stripPrice !== '' ? Number(body.stripPrice) : undefined,
            batchNo: body.batchNo,
            manufacturingDate: body.manufacturingDate ? new Date(body.manufacturingDate) : undefined,
            expiryDate: body.expiryDate ? new Date(body.expiryDate) : undefined,
            mrp: body.mrp ? Number(body.mrp) : undefined,
            packMrp: body.packMrp !== undefined && body.packMrp !== '' ? Number(body.packMrp) : undefined,
            purchasePrice: body.purchasePrice ? Number(body.purchasePrice) : undefined,
            stockQuantity: body.stockQuantity !== undefined && body.stockQuantity !== '' ? Number(body.stockQuantity) : undefined,
            minStockLevel: body.minStockLevel !== undefined && body.minStockLevel !== '' ? Number(body.minStockLevel) : undefined,
            unit: body.unit,
            gstRate: body.gstRate ? Number(body.gstRate) : undefined,
        });
        // Ensure a corresponding ProductBatch exists for initial product batch/stock
        try {
            if (doc && doc.batchNo) {
                const existing = await ProductBatch_1.ProductBatchModel.findOne({ productId: doc._id, batchNo: String(doc.batchNo) });
                if (existing) {
                    if (doc.manufacturingDate)
                        existing.manufacturingDate = doc.manufacturingDate;
                    if (doc.expiryDate)
                        existing.expiryDate = doc.expiryDate;
                    if (typeof doc.purchasePrice === 'number')
                        existing.purchasePrice = Number(doc.purchasePrice);
                    if (typeof doc.stockQuantity === 'number')
                        existing.stockQuantity = Number(doc.stockQuantity);
                    await existing.save();
                }
                else {
                    await ProductBatch_1.ProductBatchModel.create({
                        productId: doc._id,
                        batchNo: String(doc.batchNo),
                        manufacturingDate: doc.manufacturingDate ? new Date(doc.manufacturingDate) : undefined,
                        expiryDate: doc.expiryDate ? new Date(doc.expiryDate) : undefined,
                        purchasePrice: typeof doc.purchasePrice === 'number' ? Number(doc.purchasePrice) : undefined,
                        stockQuantity: typeof doc.stockQuantity === 'number' ? Number(doc.stockQuantity) : 0,
                    });
                }
            }
        }
        catch { }
        res.status(201).json({ ok: true, product: doc });
    }
    catch (err) {
        res.status(400).json({ ok: false, error: err?.message || 'Failed to create product' });
    }
});
// List products
router.get('/', async (_req, res) => {
    try {
        const docs = await Product_1.ProductModel.find().sort({ createdAt: -1 }).lean();
        const products = docs.map((d) => {
            const expiry = d.expiryDate ? new Date(d.expiryDate) : undefined;
            const mfg = d.manufacturingDate ? new Date(d.manufacturingDate) : undefined;
            const yyyyMmDd = (dt) => (dt ? dt.toISOString().slice(0, 10) : '');
            return {
                id: String(d._id),
                productId: d.productId || '',
                barcode: d.barcode || '',
                name: d.name || '',
                genericName: d.genericName || '',
                manufacturer: d.manufacturer || '',
                supplierId: d.supplierId ? String(d.supplierId) : '',
                supplierName: d.supplierName || '',
                category: d.category || '',
                unitsPerPack: typeof d.unitsPerPack === 'number' ? d.unitsPerPack : 0,
                unitsPerStrip: typeof d.unitsPerStrip === 'number' ? d.unitsPerStrip : 0,
                stripPrice: typeof d.stripPrice === 'number' ? d.stripPrice : 0,
                batchNo: d.batchNo || '',
                expiryDate: yyyyMmDd(expiry),
                manufacturingDate: yyyyMmDd(mfg),
                mrp: typeof d.mrp === 'number' ? d.mrp : 0,
                packMrp: typeof d.packMrp === 'number' ? d.packMrp : 0,
                purchasePrice: typeof d.purchasePrice === 'number' ? d.purchasePrice : 0,
                stockQuantity: typeof d.stockQuantity === 'number' ? d.stockQuantity : 0,
                minStockLevel: typeof d.minStockLevel === 'number' ? d.minStockLevel : 0,
                unit: d.unit || '',
                gstRate: typeof d.gstRate === 'number' ? d.gstRate : 0,
            };
        });
        res.json({ ok: true, products });
    }
    catch (err) {
        res.status(500).json({ ok: false, error: err?.message || 'Failed to fetch products' });
    }
});
// Update a product
router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const body = req.body || {};
        if (body.stockQuantity !== undefined && body.stockQuantity !== '' && Number(body.stockQuantity) < 0) {
            return res.status(400).json({ ok: false, error: 'stockQuantity cannot be negative' });
        }
        if (body.minStockLevel !== undefined && body.minStockLevel !== '' && Number(body.minStockLevel) < 0) {
            return res.status(400).json({ ok: false, error: 'minStockLevel cannot be negative' });
        }
        // Resolve supplier if provided
        let supplierId = undefined;
        let supplierName = undefined;
        if (body.supplierId) {
            const supp = await Supplier_1.SupplierModel.findById(String(body.supplierId)).lean();
            if (!supp)
                return res.status(400).json({ ok: false, error: 'Invalid supplierId' });
            supplierId = String(supp._id);
            supplierName = supp.name;
        }
        else if (body.supplierName !== undefined) {
            supplierName = body.supplierName ? String(body.supplierName) : undefined;
        }
        const update = {
            name: body.name,
            genericName: body.genericName,
            manufacturer: body.manufacturer,
            category: body.category,
            batchNo: body.batchNo,
            unit: body.unit,
        };
        if (body.barcode !== undefined)
            update.barcode = body.barcode ? String(body.barcode) : undefined;
        if (supplierId !== undefined)
            update.supplierId = supplierId;
        if (supplierName !== undefined)
            update.supplierName = supplierName;
        if (body.manufacturingDate !== undefined)
            update.manufacturingDate = body.manufacturingDate ? new Date(body.manufacturingDate) : undefined;
        if (body.expiryDate !== undefined)
            update.expiryDate = body.expiryDate ? new Date(body.expiryDate) : undefined;
        if (body.mrp !== undefined)
            update.mrp = body.mrp !== '' ? Number(body.mrp) : undefined;
        if (body.packMrp !== undefined)
            update.packMrp = body.packMrp !== '' ? Number(body.packMrp) : undefined;
        if (body.purchasePrice !== undefined)
            update.purchasePrice = body.purchasePrice !== '' ? Number(body.purchasePrice) : undefined;
        if (body.stockQuantity !== undefined)
            update.stockQuantity = body.stockQuantity !== '' ? Number(body.stockQuantity) : undefined;
        if (body.minStockLevel !== undefined)
            update.minStockLevel = body.minStockLevel !== '' ? Number(body.minStockLevel) : undefined;
        if (body.gstRate !== undefined)
            update.gstRate = body.gstRate !== '' ? Number(body.gstRate) : undefined;
        if (body.unitsPerPack !== undefined)
            update.unitsPerPack = body.unitsPerPack !== '' ? Number(body.unitsPerPack) : undefined;
        if (body.unitsPerStrip !== undefined)
            update.unitsPerStrip = body.unitsPerStrip !== '' ? Number(body.unitsPerStrip) : undefined;
        if (body.stripPrice !== undefined)
            update.stripPrice = body.stripPrice !== '' ? Number(body.stripPrice) : undefined;
        const doc = await Product_1.ProductModel.findByIdAndUpdate(id, update, { new: true });
        if (!doc)
            return res.status(404).json({ ok: false, error: 'Product not found' });
        // Keep a batch record in sync with product's batch/stock for compatibility
        try {
            if (doc.batchNo) {
                const existing = await ProductBatch_1.ProductBatchModel.findOne({ productId: doc._id, batchNo: String(doc.batchNo) });
                if (existing) {
                    if (doc.manufacturingDate !== undefined)
                        existing.manufacturingDate = doc.manufacturingDate ? new Date(doc.manufacturingDate) : undefined;
                    if (doc.expiryDate !== undefined)
                        existing.expiryDate = doc.expiryDate ? new Date(doc.expiryDate) : undefined;
                    if (doc.purchasePrice !== undefined)
                        existing.purchasePrice = doc.purchasePrice !== '' ? Number(doc.purchasePrice) : undefined;
                    if (doc.stockQuantity !== undefined)
                        existing.stockQuantity = doc.stockQuantity !== '' ? Number(doc.stockQuantity) : existing.stockQuantity;
                    await existing.save();
                }
                else {
                    await ProductBatch_1.ProductBatchModel.create({
                        productId: doc._id,
                        batchNo: String(doc.batchNo),
                        manufacturingDate: doc.manufacturingDate ? new Date(doc.manufacturingDate) : undefined,
                        expiryDate: doc.expiryDate ? new Date(doc.expiryDate) : undefined,
                        purchasePrice: doc.purchasePrice !== undefined && doc.purchasePrice !== '' ? Number(doc.purchasePrice) : undefined,
                        stockQuantity: doc.stockQuantity !== undefined && doc.stockQuantity !== '' ? Number(doc.stockQuantity) : 0,
                    });
                }
            }
        }
        catch { }
        res.json({ ok: true, product: doc });
    }
    catch (err) {
        res.status(400).json({ ok: false, error: err?.message || 'Failed to update product' });
    }
});
// Delete a product
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const result = await Product_1.ProductModel.findByIdAndDelete(id);
        if (!result)
            return res.status(404).json({ ok: false, error: 'Product not found' });
        res.json({ ok: true });
    }
    catch (err) {
        res.status(400).json({ ok: false, error: err?.message || 'Failed to delete product' });
    }
});
exports.default = router;
