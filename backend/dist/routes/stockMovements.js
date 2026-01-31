"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const StockMovement_1 = require("../models/StockMovement");
const Product_1 = require("../models/Product");
const router = (0, express_1.Router)();
// List stock movements
router.get('/', async (_req, res) => {
    try {
        const docs = await StockMovement_1.StockMovementModel.find().sort({ date: -1, createdAt: -1 }).lean();
        const movements = docs.map((d) => ({
            id: String(d._id),
            date: d.date ? new Date(d.date).toISOString().slice(0, 10) : '',
            productId: d.productId ? String(d.productId) : '',
            productName: d.productName || '',
            batchNo: d.batchNo || '',
            type: d.type,
            quantity: typeof d.quantity === 'number' ? d.quantity : 0,
            reference: d.reference || '',
            remarks: d.remarks || '',
        }));
        res.json({ ok: true, movements });
    }
    catch (err) {
        res.status(500).json({ ok: false, error: err?.message || 'Failed to fetch stock movements' });
    }
});
// Create a stock movement and update product stock accordingly
router.post('/', async (req, res) => {
    try {
        const body = req.body || {};
        const { productId, type, quantity } = body;
        if (!productId || !type || !quantity) {
            return res.status(400).json({ ok: false, error: 'productId, type and quantity are required' });
        }
        const product = await Product_1.ProductModel.findById(productId);
        if (!product)
            return res.status(404).json({ ok: false, error: 'Product not found' });
        let delta = 0;
        if (type === 'in' || type === 'return')
            delta = Number(quantity);
        else if (type === 'out' || type === 'damaged')
            delta = -Number(quantity);
        else
            return res.status(400).json({ ok: false, error: 'Invalid movement type' });
        const currentQty = Number(product.stockQuantity || 0);
        const newQty = currentQty + delta;
        if (newQty < 0) {
            return res.status(400).json({ ok: false, error: `Insufficient stock for ${product.name}. Available: ${currentQty}, requested: ${Number(quantity)}` });
        }
        product.stockQuantity = newQty;
        await product.save();
        const doc = await StockMovement_1.StockMovementModel.create({
            date: body.date ? new Date(body.date) : new Date(),
            productId,
            productName: body.productName || product.name,
            batchNo: body.batchNo || product.batchNo,
            type,
            quantity: Number(quantity),
            reference: body.reference,
            remarks: body.remarks,
        });
        res.status(201).json({ ok: true, movement: doc });
    }
    catch (err) {
        res.status(400).json({ ok: false, error: err?.message || 'Failed to create stock movement' });
    }
});
// Update a stock movement and reconcile product stock differences
router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const body = req.body || {};
        const existing = await StockMovement_1.StockMovementModel.findById(id);
        if (!existing)
            return res.status(404).json({ ok: false, error: 'Movement not found' });
        const oldProduct = await Product_1.ProductModel.findById(existing.productId);
        if (!oldProduct)
            return res.status(404).json({ ok: false, error: 'Old product not found' });
        // Compute old delta
        const oldDelta = existing.type === 'in' || existing.type === 'return' ? Number(existing.quantity) : -Number(existing.quantity);
        // New target fields
        const newProductId = body.productId || String(existing.productId);
        const newType = body.type || existing.type;
        const newQty = body.quantity !== undefined ? Number(body.quantity) : Number(existing.quantity);
        const newProduct = await Product_1.ProductModel.findById(newProductId);
        if (!newProduct)
            return res.status(404).json({ ok: false, error: 'Target product not found' });
        const newDelta = newType === 'in' || newType === 'return' ? newQty : -newQty;
        if (String(existing.productId) === String(newProductId)) {
            // Same product: apply difference with validation
            const diff = newDelta - oldDelta;
            const current = Number(newProduct.stockQuantity || 0);
            const next = current + diff;
            if (next < 0)
                return res.status(400).json({ ok: false, error: `Insufficient stock for ${newProduct.name}. Would become negative (${next})` });
            newProduct.stockQuantity = next;
            await newProduct.save();
        }
        else {
            // Different product: reverse from old, apply to new with validation
            const oldCurrent = Number(oldProduct.stockQuantity || 0);
            const oldNext = oldCurrent - oldDelta;
            if (oldNext < 0)
                return res.status(400).json({ ok: false, error: `Insufficient stock to reverse previous movement on ${oldProduct.name}. Available: ${oldCurrent}, required: ${oldDelta}` });
            const newCurrent = Number(newProduct.stockQuantity || 0);
            const newNext = newCurrent + newDelta;
            if (newNext < 0)
                return res.status(400).json({ ok: false, error: `Insufficient stock for ${newProduct.name}. Available: ${newCurrent}, required: ${Math.abs(newDelta)}` });
            oldProduct.stockQuantity = oldNext;
            await oldProduct.save();
            newProduct.stockQuantity = newNext;
            await newProduct.save();
        }
        existing.date = body.date ? new Date(body.date) : existing.date;
        existing.productId = newProduct._id;
        existing.productName = body.productName ?? existing.productName;
        existing.batchNo = body.batchNo ?? existing.batchNo;
        existing.type = newType;
        existing.quantity = newQty;
        existing.reference = body.reference ?? existing.reference;
        existing.remarks = body.remarks ?? existing.remarks;
        await existing.save();
        res.json({ ok: true, movement: existing });
    }
    catch (err) {
        res.status(400).json({ ok: false, error: err?.message || 'Failed to update stock movement' });
    }
});
// Delete a stock movement and roll back its effect on product stock
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const existing = await StockMovement_1.StockMovementModel.findById(id);
        if (!existing)
            return res.status(404).json({ ok: false, error: 'Movement not found' });
        const product = await Product_1.ProductModel.findById(existing.productId);
        if (!product)
            return res.status(404).json({ ok: false, error: 'Product not found' });
        const delta = existing.type === 'in' || existing.type === 'return' ? Number(existing.quantity) : -Number(existing.quantity);
        // Reverse effect with validation
        const current = Number(product.stockQuantity || 0);
        const next = current - delta;
        if (next < 0)
            return res.status(400).json({ ok: false, error: `Cannot delete movement; stock would become negative for ${product.name}. Available: ${current}, to reverse: ${delta}` });
        product.stockQuantity = next;
        await product.save();
        await existing.deleteOne();
        res.json({ ok: true });
    }
    catch (err) {
        res.status(400).json({ ok: false, error: err?.message || 'Failed to delete stock movement' });
    }
});
exports.default = router;
