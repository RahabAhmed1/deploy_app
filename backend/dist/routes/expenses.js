"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const Expense_1 = require("../models/Expense");
const router = (0, express_1.Router)();
// List expenses with optional date range
router.get('/', async (req, res) => {
    try {
        const { from, to } = req.query;
        const filter = {};
        if (from || to) {
            filter.date = {};
            if (from)
                filter.date.$gte = new Date(from);
            if (to) {
                const d = new Date(to);
                d.setHours(23, 59, 59, 999);
                filter.date.$lte = d;
            }
        }
        const docs = await Expense_1.ExpenseModel.find(filter).sort({ date: -1, createdAt: -1 }).lean();
        const expenses = docs.map((d) => ({
            id: String(d._id),
            date: d.date ? new Date(d.date).toISOString().slice(0, 10) : '',
            category: d.category || '',
            description: d.description || '',
            amount: typeof d.amount === 'number' ? d.amount : 0,
            method: d.method || 'cash',
            reference: d.reference || '',
            status: d.status || 'posted',
        }));
        res.json({ ok: true, expenses });
    }
    catch (err) {
        res.status(500).json({ ok: false, error: err?.message || 'Failed to fetch expenses' });
    }
});
// Create expense
router.post('/', async (req, res) => {
    try {
        const body = req.body || {};
        if (!body.category)
            return res.status(400).json({ ok: false, error: 'category is required' });
        if (!body.amount)
            return res.status(400).json({ ok: false, error: 'amount is required' });
        const doc = await Expense_1.ExpenseModel.create({
            date: body.date ? new Date(body.date) : new Date(),
            category: body.category,
            description: body.description,
            amount: Number(body.amount),
            method: body.method || 'cash',
            reference: body.reference,
            status: body.status || 'posted',
        });
        res.status(201).json({ ok: true, expense: doc });
    }
    catch (err) {
        res.status(400).json({ ok: false, error: err?.message || 'Failed to create expense' });
    }
});
// Delete expense
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await Expense_1.ExpenseModel.findByIdAndDelete(id);
        res.json({ ok: true });
    }
    catch (err) {
        res.status(400).json({ ok: false, error: err?.message || 'Failed to delete expense' });
    }
});
exports.default = router;
