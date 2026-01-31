"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const Payment_1 = require("../models/Payment");
const Customer_1 = require("../models/Customer");
const Order_1 = require("../models/Order");
const router = (0, express_1.Router)();
// List payments
router.get('/', async (_req, res) => {
    try {
        const docs = await Payment_1.PaymentModel.find().sort({ date: -1, createdAt: -1 }).lean();
        const payments = docs.map((d) => ({
            id: String(d._id),
            date: d.date ? new Date(d.date).toISOString().slice(0, 10) : '',
            customerId: d.customerId ? String(d.customerId) : '',
            customerName: d.customerName || '',
            orderId: d.orderId ? String(d.orderId) : '',
            amount: typeof d.amount === 'number' ? d.amount : 0,
            method: d.method,
            reference: d.reference || '',
            status: d.status || 'completed',
        }));
        res.json({ ok: true, payments });
    }
    catch (err) {
        res.status(500).json({ ok: false, error: err?.message || 'Failed to fetch payments' });
    }
});
// Create payment and update outstanding + order status
router.post('/', async (req, res) => {
    try {
        const body = req.body || {};
        const { customerId, orderId, amount, method } = body;
        if (!customerId || !orderId || !amount || !method) {
            return res.status(400).json({ ok: false, error: 'customerId, orderId, amount, and method are required' });
        }
        const customer = await Customer_1.CustomerModel.findById(customerId);
        if (!customer)
            return res.status(404).json({ ok: false, error: 'Customer not found' });
        const order = await Order_1.OrderModel.findById(orderId);
        if (!order)
            return res.status(404).json({ ok: false, error: 'Order not found' });
        if (String(order.status || '') === 'hold' || String(order.docType || 'sale') === 'estimate' || Boolean(order.deferredPosting)) {
            return res.status(400).json({ ok: false, error: 'Cannot record payment for a held/estimate order. Finalize the order first.' });
        }
        const payDoc = await Payment_1.PaymentModel.create({
            date: body.date ? new Date(body.date) : new Date(),
            customerId,
            customerName: body.customerName || customer.name,
            orderId,
            amount: Number(amount),
            method,
            reference: body.reference,
            status: body.status || 'completed',
        });
        // Reduce customer's outstanding
        customer.outstandingBalance = Math.max(0, Number(customer.outstandingBalance || 0) - Number(amount));
        await customer.save();
        // Update order payment status based on total paid
        const agg = await Payment_1.PaymentModel.aggregate([
            { $match: { orderId: order._id } },
            { $group: { _id: '$orderId', paid: { $sum: '$amount' } } },
        ]);
        const paid = agg[0]?.paid || 0;
        if (paid >= Number(order.netAmount || 0))
            order.paymentStatus = 'paid';
        else if (paid > 0)
            order.paymentStatus = 'partial';
        else
            order.paymentStatus = 'unpaid';
        await order.save();
        res.status(201).json({ ok: true, payment: payDoc });
    }
    catch (err) {
        res.status(400).json({ ok: false, error: err?.message || 'Failed to create payment' });
    }
});
exports.default = router;
