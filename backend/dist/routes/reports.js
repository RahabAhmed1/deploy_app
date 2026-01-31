"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const mongoose_1 = __importDefault(require("mongoose"));
const Order_1 = require("../models/Order");
const Product_1 = require("../models/Product");
const router = (0, express_1.Router)();
// GET /api/reports/sales-series - monthly sales for last 6 months
router.get('/sales-series', async (_req, res) => {
    try {
        const now = new Date();
        const start = new Date(now.getFullYear(), now.getMonth() - 5, 1);
        const pipeline = [
            { $match: { orderDate: { $gte: start } } },
            { $group: {
                    _id: { y: { $year: '$orderDate' }, m: { $month: '$orderDate' } },
                    sales: { $sum: { $ifNull: ['$netAmount', 0] } },
                } },
        ];
        const agg = await Order_1.OrderModel.aggregate(pipeline);
        // Build last 6 months labels
        const months = [];
        for (let i = 5; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            const label = d.toLocaleString('en-US', { month: 'short' });
            months.push({ key, label });
        }
        const series = months.map(({ key, label }) => {
            const [y, m] = key.split('-').map(Number);
            const found = agg.find((a) => a._id.y === y && a._id.m === m);
            return { month: label, sales: found ? found.sales : 0 };
        });
        res.json({ ok: true, salesData: series });
    }
    catch (err) {
        res.status(500).json({ ok: false, error: err?.message || 'Failed to compute sales series' });
    }
});
// GET /api/reports/category-share - product category percentage share (by count)
router.get('/category-share', async (_req, res) => {
    try {
        const agg = await Product_1.ProductModel.aggregate([
            { $group: { _id: { $ifNull: ['$category', 'Others'] }, count: { $sum: 1 } } },
            { $sort: { count: -1 } },
        ]);
        const total = agg.reduce((s, a) => s + a.count, 0) || 1;
        const data = agg.map(a => ({ name: a._id, value: Math.round((a.count / total) * 100) }));
        res.json({ ok: true, categoryData: data });
    }
    catch (err) {
        res.status(500).json({ ok: false, error: err?.message || 'Failed to compute category share' });
    }
});
// GET /api/reports/revenue-by-customer-type
router.get('/revenue-by-customer-type', async (_req, res) => {
    try {
        const agg = await Order_1.OrderModel.aggregate([
            { $group: { _id: { $ifNull: ['$customerType', 'Unknown'] }, revenue: { $sum: { $ifNull: ['$netAmount', 0] } } } },
            { $sort: { revenue: -1 } },
        ]);
        const total = agg.reduce((s, a) => s + a.revenue, 0) || 1;
        const data = agg.map(a => ({ type: a._id, revenue: a.revenue, percentage: Math.round((a.revenue / total) * 100) }));
        res.json({ ok: true, revenueByCustomerType: data });
    }
    catch (err) {
        res.status(500).json({ ok: false, error: err?.message || 'Failed to compute revenue by customer type' });
    }
});
router.get('/product-sales-history', async (req, res) => {
    try {
        const productId = String(req.query.productId || '').trim();
        if (!productId)
            return res.status(400).json({ ok: false, error: 'productId is required' });
        let oid;
        try {
            oid = new mongoose_1.default.Types.ObjectId(productId);
        }
        catch {
            return res.status(400).json({ ok: false, error: 'Invalid productId' });
        }
        const limit = Math.min(500, Math.max(1, Number(req.query.limit || 200)));
        const agg = await Order_1.OrderModel.aggregate([
            { $match: { 'items.productId': oid } },
            { $unwind: '$items' },
            { $match: { 'items.productId': oid } },
            {
                $project: {
                    _id: 1,
                    orderNo: 1,
                    orderDate: 1,
                    customerId: 1,
                    customerName: 1,
                    salesmanCode: 1,
                    salesmanName: 1,
                    quantity: '$items.quantity',
                    unitPrice: '$items.unitPrice',
                    discount: '$items.discount',
                    tax: '$items.tax',
                    total: '$items.total',
                    batchNo: '$items.batchNo',
                },
            },
            { $sort: { orderDate: -1 } },
            { $limit: limit },
        ]);
        const rows = (agg || []).map((r) => ({
            orderId: String(r._id),
            orderNo: r.orderNo || '',
            orderDate: r.orderDate ? new Date(r.orderDate).toISOString().slice(0, 10) : '',
            customerId: r.customerId ? String(r.customerId) : '',
            customerName: r.customerName || '',
            salesmanCode: r.salesmanCode || '',
            salesmanName: r.salesmanName || '',
            batchNo: r.batchNo || '',
            quantity: typeof r.quantity === 'number' ? r.quantity : 0,
            unitPrice: typeof r.unitPrice === 'number' ? r.unitPrice : 0,
            discount: typeof r.discount === 'number' ? r.discount : 0,
            tax: typeof r.tax === 'number' ? r.tax : 0,
            total: typeof r.total === 'number' ? r.total : 0,
        }));
        res.json({ ok: true, rows });
    }
    catch (err) {
        res.status(500).json({ ok: false, error: err?.message || 'Failed to fetch product sales history' });
    }
});
exports.default = router;
