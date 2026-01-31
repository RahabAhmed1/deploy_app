"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const Product_1 = require("../models/Product");
const Order_1 = require("../models/Order");
const Customer_1 = require("../models/Customer");
const router = (0, express_1.Router)();
router.get('/', async (_req, res) => {
    try {
        const now = new Date();
        const in90 = new Date(now);
        in90.setDate(in90.getDate() + 90);
        const [totalProducts, lowStockItems, expiringItems, totalOrders, pendingOrders, totalCustomers, outstandingAgg, totalRevenueAgg, thisMonthAgg, lastMonthAgg, todayAgg,] = await Promise.all([
            Product_1.ProductModel.countDocuments({}),
            Product_1.ProductModel.countDocuments({ $expr: { $lte: ['$stockQuantity', '$minStockLevel'] } }),
            Product_1.ProductModel.countDocuments({ expiryDate: { $lte: in90 } }),
            Order_1.OrderModel.countDocuments({}),
            Order_1.OrderModel.countDocuments({ status: 'pending' }),
            Customer_1.CustomerModel.countDocuments({}),
            Customer_1.CustomerModel.aggregate([{ $group: { _id: null, total: { $sum: { $ifNull: ['$outstandingBalance', 0] } } } }]),
            Order_1.OrderModel.aggregate([{ $group: { _id: null, total: { $sum: { $ifNull: ['$netAmount', 0] } } } }]),
            // This month sales
            (() => {
                const d = new Date();
                const start = new Date(d.getFullYear(), d.getMonth(), 1);
                const end = new Date(d.getFullYear(), d.getMonth() + 1, 1);
                return Order_1.OrderModel.aggregate([
                    { $match: { orderDate: { $gte: start, $lt: end } } },
                    { $group: { _id: null, total: { $sum: { $ifNull: ['$netAmount', 0] } } } },
                ]);
            })(),
            // Last month sales
            (() => {
                const d = new Date();
                const start = new Date(d.getFullYear(), d.getMonth() - 1, 1);
                const end = new Date(d.getFullYear(), d.getMonth(), 1);
                return Order_1.OrderModel.aggregate([
                    { $match: { orderDate: { $gte: start, $lt: end } } },
                    { $group: { _id: null, total: { $sum: { $ifNull: ['$netAmount', 0] } } } },
                ]);
            })(),
            // Today sales
            (() => {
                const d = new Date();
                const start = new Date(d.getFullYear(), d.getMonth(), d.getDate());
                const end = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
                return Order_1.OrderModel.aggregate([
                    { $match: { orderDate: { $gte: start, $lt: end } } },
                    { $group: { _id: null, total: { $sum: { $ifNull: ['$netAmount', 0] } } } },
                ]);
            })(),
        ]);
        const outstandingReceivables = outstandingAgg[0]?.total || 0;
        const totalRevenue = totalRevenueAgg[0]?.total || 0;
        const thisMonthSales = thisMonthAgg[0]?.total || 0;
        const lastMonthSales = lastMonthAgg[0]?.total || 0;
        const todaySales = todayAgg[0]?.total || 0;
        const monthlyGrowth = lastMonthSales > 0 ? Number((((thisMonthSales - lastMonthSales) / lastMonthSales) * 100).toFixed(1)) : 0;
        res.json({ ok: true, stats: {
                totalProducts,
                lowStockItems,
                expiringItems,
                totalOrders,
                pendingOrders,
                totalCustomers,
                totalRevenue,
                thisMonthSales,
                outstandingReceivables,
                todaySales,
                monthlyGrowth,
            } });
    }
    catch (err) {
        res.status(500).json({ ok: false, error: err?.message || 'Failed to compute dashboard stats' });
    }
});
exports.default = router;
