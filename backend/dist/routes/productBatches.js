"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const ProductBatch_1 = require("../models/ProductBatch");
const Product_1 = require("../models/Product");
const router = (0, express_1.Router)();
// List batches, optionally filter by productId
router.get('/', async (req, res) => {
    try {
        const { productId } = req.query;
        const filter = {};
        if (productId)
            filter.productId = productId;
        const docs = await ProductBatch_1.ProductBatchModel.find(filter).sort({ createdAt: -1 }).lean();
        const batches = docs.map((d) => ({
            id: String(d._id),
            productId: String(d.productId),
            batchNo: d.batchNo || '',
            manufacturingDate: d.manufacturingDate ? new Date(d.manufacturingDate).toISOString().slice(0, 10) : '',
            expiryDate: d.expiryDate ? new Date(d.expiryDate).toISOString().slice(0, 10) : '',
            purchasePrice: typeof d.purchasePrice === 'number' ? d.purchasePrice : 0,
            stockQuantity: typeof d.stockQuantity === 'number' ? d.stockQuantity : 0,
        }));
        res.json({ ok: true, batches });
    }
    catch (err) {
        res.status(500).json({ ok: false, error: err?.message || 'Failed to fetch batches' });
    }
});
// Create a batch (or return existing if duplicate)
router.post('/', async (req, res) => {
    try {
        const body = req.body || {};
        const { productId, batchNo } = body;
        if (!productId || !batchNo)
            return res.status(400).json({ ok: false, error: 'productId and batchNo are required' });
        const product = await Product_1.ProductModel.findById(String(productId));
        if (!product)
            return res.status(404).json({ ok: false, error: 'Product not found' });
        const existing = await ProductBatch_1.ProductBatchModel.findOne({ productId: product._id, batchNo: String(batchNo) }).lean();
        if (existing)
            return res.status(200).json({ ok: true, batch: existing });
        const doc = await ProductBatch_1.ProductBatchModel.create({
            productId: product._id,
            batchNo: String(batchNo),
            manufacturingDate: body.manufacturingDate ? new Date(body.manufacturingDate) : undefined,
            expiryDate: body.expiryDate ? new Date(body.expiryDate) : undefined,
            purchasePrice: typeof body.purchasePrice === 'number' ? body.purchasePrice : (body.purchasePrice ? Number(body.purchasePrice) : undefined),
            stockQuantity: typeof body.stockQuantity === 'number' ? body.stockQuantity : (body.stockQuantity ? Number(body.stockQuantity) : 0),
        });
        res.status(201).json({ ok: true, batch: doc });
    }
    catch (err) {
        res.status(400).json({ ok: false, error: err?.message || 'Failed to create batch' });
    }
});
// Update a batch
router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const body = req.body || {};
        const update = {};
        if (body.batchNo !== undefined)
            update.batchNo = String(body.batchNo);
        if (body.manufacturingDate !== undefined)
            update.manufacturingDate = body.manufacturingDate ? new Date(body.manufacturingDate) : undefined;
        if (body.expiryDate !== undefined)
            update.expiryDate = body.expiryDate ? new Date(body.expiryDate) : undefined;
        if (body.purchasePrice !== undefined)
            update.purchasePrice = body.purchasePrice !== '' ? Number(body.purchasePrice) : undefined;
        if (body.stockQuantity !== undefined)
            update.stockQuantity = body.stockQuantity !== '' ? Number(body.stockQuantity) : undefined;
        const doc = await ProductBatch_1.ProductBatchModel.findByIdAndUpdate(id, update, { new: true });
        if (!doc)
            return res.status(404).json({ ok: false, error: 'Batch not found' });
        res.json({ ok: true, batch: doc });
    }
    catch (err) {
        res.status(400).json({ ok: false, error: err?.message || 'Failed to update batch' });
    }
});
exports.default = router;
