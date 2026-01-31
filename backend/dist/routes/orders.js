"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const Order_1 = require("../models/Order");
const Invoice_1 = require("../models/Invoice");
const AppConfig_1 = require("../models/AppConfig");
const Customer_1 = require("../models/Customer");
const Payment_1 = require("../models/Payment");
const Product_1 = require("../models/Product");
const ProductBatch_1 = require("../models/ProductBatch");
const StockMovement_1 = require("../models/StockMovement");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const User_1 = require("../models/User");
const router = (0, express_1.Router)();
async function resolveSalesman(req, body) {
    try {
        const auth = String(req.headers.authorization || '');
        const token = auth.toLowerCase().startsWith('bearer ') ? auth.slice(7).trim() : '';
        if (token) {
            const secret = process.env.JWT_SECRET || 'dev_secret';
            const decoded = jsonwebtoken_1.default.verify(token, secret);
            const userId = decoded?.sub ? String(decoded.sub) : '';
            if (userId && userId !== 'offline-admin') {
                const u = await User_1.UserModel.findById(userId).lean();
                if (u) {
                    return {
                        salesmanId: String(u._id),
                        salesmanName: String(u.username || ''),
                        salesmanCode: String(u.staffCode || ''),
                    };
                }
            }
            const uname = String(decoded?.username || '');
            if (uname) {
                return { salesmanId: userId || '', salesmanName: uname, salesmanCode: userId === 'offline-admin' ? 'ADMIN' : '' };
            }
        }
    }
    catch {
    }
    return {
        salesmanId: body.salesmanId ? String(body.salesmanId) : undefined,
        salesmanName: body.salesmanName ? String(body.salesmanName) : undefined,
        salesmanCode: body.salesmanCode ? String(body.salesmanCode) : undefined,
    };
}
function genOrderNo() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const rand = Math.floor(Math.random() * 900 + 100);
    return `ORD-${y}${m}${day}-${rand}`;
}
function genInvoiceNo(prefix = 'INV-') {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const rand = Math.floor(Math.random() * 900 + 100);
    return `${prefix}${y}${m}${day}-${rand}`;
}
// List orders
router.get('/', async (_req, res) => {
    try {
        const docs = await Order_1.OrderModel.find().sort({ createdAt: -1 }).lean();
        const orders = docs.map((d) => ({
            id: String(d._id),
            orderNo: d.orderNo,
            customerId: d.customerId ? String(d.customerId) : '',
            customerName: d.customerName || '',
            customerType: d.customerType || '',
            docType: d.docType || 'sale',
            deferredPosting: !!d.deferredPosting,
            accountsPosted: !!d.accountsPosted,
            salesmanId: d.salesmanId || '',
            salesmanCode: d.salesmanCode || '',
            salesmanName: d.salesmanName || '',
            orderDate: d.orderDate ? new Date(d.orderDate).toISOString().slice(0, 10) : '',
            deliveryDate: d.deliveryDate ? new Date(d.deliveryDate).toISOString().slice(0, 10) : null,
            totalAmount: d.totalAmount || 0,
            discountAmount: d.discountAmount || 0,
            taxAmount: d.taxAmount || 0,
            netAmount: d.netAmount || 0,
            status: d.status,
            paymentStatus: d.paymentStatus,
            items: (d.items || []).map((it) => ({
                productId: String(it.productId || ''),
                productName: it.productName || '',
                batchId: it.batchId ? String(it.batchId) : '',
                batchNo: it.batchNo || '',
                quantity: it.quantity || 0,
                unitPrice: it.unitPrice || 0,
                discount: it.discount || 0,
                tax: it.tax || 0,
                total: it.total || 0,
            })),
        }));
        res.json({ ok: true, orders });
    }
    catch (err) {
        res.status(500).json({ ok: false, error: err?.message || 'Failed to fetch orders' });
    }
});
// Get order by id
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const d = await Order_1.OrderModel.findById(String(id)).lean();
        if (!d)
            return res.status(404).json({ ok: false, error: 'Order not found' });
        const order = {
            id: String(d._id),
            orderNo: d.orderNo,
            customerId: d.customerId ? String(d.customerId) : '',
            customerName: d.customerName || '',
            customerType: d.customerType || '',
            docType: d.docType || 'sale',
            deferredPosting: !!d.deferredPosting,
            accountsPosted: !!d.accountsPosted,
            salesmanId: d.salesmanId || '',
            salesmanCode: d.salesmanCode || '',
            salesmanName: d.salesmanName || '',
            orderDate: d.orderDate ? new Date(d.orderDate).toISOString().slice(0, 10) : '',
            deliveryDate: d.deliveryDate ? new Date(d.deliveryDate).toISOString().slice(0, 10) : null,
            totalAmount: d.totalAmount || 0,
            discountAmount: d.discountAmount || 0,
            taxAmount: d.taxAmount || 0,
            netAmount: d.netAmount || 0,
            status: d.status,
            paymentStatus: d.paymentStatus,
            items: (d.items || []).map((it) => ({
                productId: String(it.productId || ''),
                productName: it.productName || '',
                batchId: it.batchId ? String(it.batchId) : '',
                batchNo: it.batchNo || '',
                quantity: it.quantity || 0,
                unitPrice: it.unitPrice || 0,
                discount: it.discount || 0,
                tax: it.tax || 0,
                total: it.total || 0,
            })),
        };
        res.json({ ok: true, order });
    }
    catch (err) {
        res.status(400).json({ ok: false, error: err?.message || 'Failed to fetch order' });
    }
});
// Create order
router.post('/', async (req, res) => {
    try {
        const body = req.body || {};
        const customer = await Customer_1.CustomerModel.findById(body.customerId);
        if (!customer)
            return res.status(404).json({ ok: false, error: 'Customer not found' });
        const docType = body.docType === 'estimate' ? 'estimate' : 'sale';
        const requestedStatus = String(body.status || 'pending');
        const customerType = String(body.customerType || customer.type || '');
        const isWalkIn = customerType.toLowerCase() === 'walk_in';
        const status = isWalkIn ? 'completed' : requestedStatus === 'hold' ? 'hold' : (requestedStatus || 'pending');
        const deferredPosting = isWalkIn ? false : Boolean(body.deferredPosting) || status === 'hold' || docType === 'estimate';
        const items = Array.isArray(body.items) ? body.items : [];
        // Optionally enrich items with productName/batch
        const enrichedItems = await Promise.all(items.map(async (it) => {
            const p = await Product_1.ProductModel.findById(it.productId).lean();
            let batchNo = String(it.batchNo || '').trim();
            let batchId = it.batchId ? String(it.batchId) : undefined;
            if (batchId) {
                const b = await ProductBatch_1.ProductBatchModel.findById(batchId).lean();
                if (b && String(b.productId) === String(it.productId)) {
                    batchNo = b.batchNo || batchNo || (p?.batchNo || '');
                    batchId = String(b._id);
                }
                else {
                    // invalid batchId-product relation; ignore batchId
                    batchId = undefined;
                }
            }
            else {
                batchNo = batchNo || (p?.batchNo || '');
            }
            return {
                productId: it.productId,
                productName: it.productName || p?.name || '',
                batchId,
                batchNo,
                quantity: Number(it.quantity) || 0,
                unitPrice: Number(it.unitPrice) || 0,
                discount: Number(it.discount) || 0,
                tax: Number(it.tax) || 0,
                total: Number(it.total) || (Number(it.quantity || 0) * Number(it.unitPrice || 0) * (1 - Number(it.discount || 0) / 100) * (1 + Number(it.tax || 0) / 100)),
            };
        }));
        // Validate stock per product (sum duplicates) and positive quantities
        const requestedByProduct = new Map();
        const requestedByBatch = new Map();
        for (const it of enrichedItems) {
            const qty = Number(it.quantity) || 0;
            if (qty <= 0)
                return res.status(400).json({ ok: false, error: 'Quantity must be greater than 0' });
            requestedByProduct.set(it.productId, (requestedByProduct.get(it.productId) || 0) + qty);
            if (it.batchId)
                requestedByBatch.set(String(it.batchId), (requestedByBatch.get(String(it.batchId)) || 0) + qty);
        }
        if (!deferredPosting) {
            const ids = Array.from(requestedByProduct.keys());
            if (ids.length > 0) {
                const dbProducts = await Product_1.ProductModel.find({ _id: { $in: ids } }).lean();
                for (const p of dbProducts) {
                    const required = requestedByProduct.get(String(p._id)) || 0;
                    const available = Number(p.stockQuantity || 0);
                    if (required > available) {
                        return res.status(400).json({ ok: false, error: `Insufficient stock for ${p.name}. Available: ${available}, requested: ${required}` });
                    }
                }
            }
            // Validate per-batch where applicable
            const batchIds = Array.from(requestedByBatch.keys());
            if (batchIds.length > 0) {
                const dbBatches = await ProductBatch_1.ProductBatchModel.find({ _id: { $in: batchIds } }).lean();
                const byId = new Map();
                for (const b of dbBatches)
                    byId.set(String(b._id), b);
                for (const [bid, qty] of requestedByBatch) {
                    const b = byId.get(String(bid));
                    const available = Number(b?.stockQuantity || 0);
                    if (qty > available) {
                        return res.status(400).json({ ok: false, error: `Insufficient stock for batch ${b?.batchNo || bid}. Available: ${available}, requested: ${qty}` });
                    }
                }
            }
        }
        const totals = enrichedItems.reduce((acc, it) => {
            const lineBase = it.quantity * it.unitPrice;
            const lineDiscount = lineBase * (it.discount / 100);
            const baseAfterDiscount = lineBase - lineDiscount;
            const lineTax = baseAfterDiscount * (it.tax / 100);
            acc.total += lineBase;
            acc.discount += lineDiscount;
            acc.tax += lineTax;
            acc.net += baseAfterDiscount + lineTax;
            return acc;
        }, { total: 0, discount: 0, tax: 0, net: 0 });
        const salesman = await resolveSalesman(req, body);
        const doc = await Order_1.OrderModel.create({
            orderNo: body.orderNo || genOrderNo(),
            customerId: body.customerId,
            customerName: body.customerName || customer.name,
            customerType: customerType || customer.type,
            docType,
            salesmanId: salesman.salesmanId || undefined,
            salesmanCode: salesman.salesmanCode || undefined,
            salesmanName: salesman.salesmanName || undefined,
            orderDate: body.orderDate ? new Date(body.orderDate) : new Date(),
            deliveryDate: body.deliveryDate ? new Date(body.deliveryDate) : undefined,
            totalAmount: totals.total,
            discountAmount: totals.discount,
            taxAmount: totals.tax,
            netAmount: totals.net,
            status,
            paymentStatus: isWalkIn ? 'paid' : (body.paymentStatus || 'unpaid'),
            items: enrichedItems,
            deferredPosting,
            accountsPosted: false,
        });
        // Increase customer outstanding by net amount only for non-deferred sales
        if (!deferredPosting && docType === 'sale' && !isWalkIn) {
            customer.outstandingBalance = Number(customer.outstandingBalance || 0) + totals.net;
            await customer.save();
            await Order_1.OrderModel.updateOne({ _id: doc._id }, { $set: { accountsPosted: true } });
        }
        else if (!deferredPosting && docType === 'sale' && isWalkIn) {
            await Order_1.OrderModel.updateOne({ _id: doc._id }, { $set: { accountsPosted: true } });
        }
        if (!deferredPosting && docType === 'sale' && (status === 'approved' || status === 'dispatched' || status === 'delivered' || status === 'completed')) {
            for (const it of enrichedItems) {
                await StockMovement_1.StockMovementModel.create({
                    date: new Date(),
                    productId: it.productId,
                    productName: it.productName,
                    batchNo: it.batchNo,
                    type: 'out',
                    quantity: Number(it.quantity) || 0,
                    reference: doc.orderNo,
                    remarks: `Order ${doc.orderNo} ${status}`,
                });
                const p = await Product_1.ProductModel.findById(it.productId);
                if (p) {
                    p.stockQuantity = Math.max(0, Number(p.stockQuantity || 0) - Number(it.quantity || 0));
                    await p.save();
                }
                if (it.batchId) {
                    const b = await ProductBatch_1.ProductBatchModel.findById(String(it.batchId));
                    if (b) {
                        b.stockQuantity = Math.max(0, Number(b.stockQuantity || 0) - Number(it.quantity || 0));
                        await b.save();
                    }
                }
            }
        }
        // Auto-create invoice when enabled (only for non-deferred sales)
        try {
            const cfg = await AppConfig_1.AppConfigModel.findOne().lean();
            const auto = cfg?.autoGenerateInvoice !== false; // default true
            if (auto && !deferredPosting && docType === 'sale') {
                const prefix = cfg?.invoicePrefix || 'INV-';
                const terms = typeof cfg?.paymentTermsDays === 'number' ? cfg.paymentTermsDays : 30;
                const invoiceDate = body.orderDate ? new Date(body.orderDate) : new Date();
                const dueDate = new Date(invoiceDate.getTime() + terms * 24 * 60 * 60 * 1000);
                await Invoice_1.InvoiceModel.create({
                    invoiceNo: genInvoiceNo(prefix),
                    orderId: doc._id,
                    orderNo: doc.orderNo,
                    customerId: doc.customerId,
                    customerName: doc.customerName,
                    customerType: doc.customerType,
                    invoiceDate,
                    dueDate,
                    totalAmount: doc.totalAmount || 0,
                    discountAmount: doc.discountAmount || 0,
                    taxAmount: doc.taxAmount || 0,
                    netAmount: doc.netAmount || 0,
                    items: doc.items || [],
                    paymentTermsDays: terms,
                });
            }
        }
        catch (e) {
            // Do not fail the order creation if invoice creation fails
        }
        res.status(201).json({ ok: true, order: doc });
    }
    catch (err) {
        res.status(400).json({ ok: false, error: err?.message || 'Failed to create order' });
    }
});
// Update a held/estimate order (resume/edit)
router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const body = req.body || {};
        const order = await Order_1.OrderModel.findById(String(id));
        if (!order)
            return res.status(404).json({ ok: false, error: 'Order not found' });
        const isEstimate = String(order.docType || 'sale') === 'estimate';
        const isHold = String(order.status || '') === 'hold';
        if (!isEstimate && !isHold) {
            return res.status(400).json({ ok: false, error: 'Only held/estimate orders can be edited' });
        }
        const customerId = body.customerId ? String(body.customerId) : String(order.customerId || '');
        const customer = await Customer_1.CustomerModel.findById(customerId);
        if (!customer)
            return res.status(404).json({ ok: false, error: 'Customer not found' });
        const nextDocType = body.docType === 'estimate' ? 'estimate' : (body.docType === 'sale' ? 'sale' : (String(order.docType || 'sale') === 'estimate' ? 'estimate' : 'sale'));
        const nextStatus = String(body.status || order.status || 'pending') === 'hold' ? 'hold' : (body.status || order.status || 'pending');
        const nextDeferred = Boolean(body.deferredPosting) || nextStatus === 'hold' || nextDocType === 'estimate';
        const items = Array.isArray(body.items) ? body.items : [];
        if (!items.length)
            return res.status(400).json({ ok: false, error: 'At least one item is required' });
        const enrichedItems = await Promise.all(items.map(async (it) => {
            const p = await Product_1.ProductModel.findById(it.productId).lean();
            let batchNo = String(it.batchNo || '').trim();
            let batchId = it.batchId ? String(it.batchId) : undefined;
            if (batchId) {
                const b = await ProductBatch_1.ProductBatchModel.findById(batchId).lean();
                if (b && String(b.productId) === String(it.productId)) {
                    batchNo = b.batchNo || batchNo || (p?.batchNo || '');
                    batchId = String(b._id);
                }
                else {
                    batchId = undefined;
                }
            }
            else {
                batchNo = batchNo || (p?.batchNo || '');
            }
            return {
                productId: it.productId,
                productName: it.productName || p?.name || '',
                batchId,
                batchNo,
                quantity: Number(it.quantity) || 0,
                unitPrice: Number(it.unitPrice) || 0,
                discount: Number(it.discount) || 0,
                tax: Number(it.tax) || 0,
                total: Number(it.total) || (Number(it.quantity || 0) * Number(it.unitPrice || 0) * (1 - Number(it.discount || 0) / 100) * (1 + Number(it.tax || 0) / 100)),
            };
        }));
        const totals = enrichedItems.reduce((acc, it) => {
            const lineBase = it.quantity * it.unitPrice;
            const lineDiscount = lineBase * (it.discount / 100);
            const baseAfterDiscount = lineBase - lineDiscount;
            const lineTax = baseAfterDiscount * (it.tax / 100);
            acc.total += lineBase;
            acc.discount += lineDiscount;
            acc.tax += lineTax;
            acc.net += baseAfterDiscount + lineTax;
            return acc;
        }, { total: 0, discount: 0, tax: 0, net: 0 });
        order.customerId = customerId;
        order.customerName = body.customerName || customer.name;
        order.customerType = body.customerType || customer.type;
        order.docType = nextDocType;
        order.status = nextStatus;
        order.deferredPosting = nextDeferred;
        order.orderDate = body.orderDate ? new Date(body.orderDate) : order.orderDate;
        order.deliveryDate = body.deliveryDate ? new Date(body.deliveryDate) : order.deliveryDate;
        order.totalAmount = totals.total;
        order.discountAmount = totals.discount;
        order.taxAmount = totals.tax;
        order.netAmount = totals.net;
        order.items = enrichedItems;
        await order.save();
        res.json({ ok: true, order });
    }
    catch (err) {
        res.status(400).json({ ok: false, error: err?.message || 'Failed to update order' });
    }
});
// Convert an estimate to a sale (still deferred until finalized)
router.post('/:id/convert-to-sale', async (req, res) => {
    try {
        const { id } = req.params;
        const order = await Order_1.OrderModel.findById(String(id));
        if (!order)
            return res.status(404).json({ ok: false, error: 'Order not found' });
        if (String(order.docType || 'sale') !== 'estimate') {
            return res.status(400).json({ ok: false, error: 'Order is not an estimate' });
        }
        order.docType = 'sale';
        order.deferredPosting = true;
        order.status = 'hold';
        await order.save();
        res.json({ ok: true, order });
    }
    catch (err) {
        res.status(400).json({ ok: false, error: err?.message || 'Failed to convert estimate' });
    }
});
// Delete a held/estimate order (no posting should have happened)
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const order = await Order_1.OrderModel.findById(String(id));
        if (!order)
            return res.status(404).json({ ok: false, error: 'Order not found' });
        const isEstimate = String(order.docType || 'sale') === 'estimate';
        const isHold = String(order.status || '') === 'hold';
        if (!isEstimate && !isHold) {
            return res.status(400).json({ ok: false, error: 'Only held/estimate orders can be deleted' });
        }
        const inv = await Invoice_1.InvoiceModel.findOne({ orderId: order._id }).lean();
        if (inv)
            return res.status(400).json({ ok: false, error: 'Cannot delete: invoice already exists for this order' });
        const payCount = await Payment_1.PaymentModel.countDocuments({ orderId: order._id });
        if (payCount > 0)
            return res.status(400).json({ ok: false, error: 'Cannot delete: payments exist for this order' });
        const moveCount = await StockMovement_1.StockMovementModel.countDocuments({ reference: order.orderNo, type: 'out' });
        if (moveCount > 0)
            return res.status(400).json({ ok: false, error: 'Cannot delete: stock has already been posted' });
        await Order_1.OrderModel.deleteOne({ _id: order._id });
        res.json({ ok: true });
    }
    catch (err) {
        res.status(400).json({ ok: false, error: err?.message || 'Failed to delete order' });
    }
});
// Update order status
router.patch('/:id/status', async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body || {};
        const order = await Order_1.OrderModel.findById(id);
        if (!order)
            return res.status(404).json({ ok: false, error: 'Order not found' });
        if (String(order.docType || 'sale') === 'estimate' && (status === 'approved' || status === 'dispatched' || status === 'delivered' || status === 'completed')) {
            return res.status(400).json({ ok: false, error: 'Cannot approve an estimate. Convert it to a sale first.' });
        }
        if (status === 'completed') {
            const ct = String(order.customerType || '').toLowerCase();
            if (ct !== 'walk_in') {
                return res.status(400).json({ ok: false, error: 'Only walk-in orders can be marked as completed' });
            }
        }
        const prevStatus = order.status;
        order.status = status || order.status;
        if ((status === 'approved' || status === 'dispatched' || status === 'delivered' || status === 'completed') && String(order.docType || 'sale') === 'sale') {
            order.deferredPosting = false;
        }
        // Post to customer outstanding once when order is finalized (sale only)
        if (!order.accountsPosted &&
            !order.deferredPosting &&
            String(order.docType || 'sale') === 'sale' &&
            (status === 'approved' || status === 'dispatched' || status === 'delivered' || status === 'completed')) {
            const ct = String(order.customerType || '').toLowerCase();
            if (ct !== 'walk_in') {
                const customer = await Customer_1.CustomerModel.findById(String(order.customerId));
                if (customer) {
                    customer.outstandingBalance = Number(customer.outstandingBalance || 0) + Number(order.netAmount || 0);
                    await customer.save();
                }
            }
            order.accountsPosted = true;
        }
        // Create stock movement when entering a committed state the first time (approved/dispatched/delivered)
        if ((status === 'approved' || status === 'dispatched' || status === 'delivered' || status === 'completed') &&
            (prevStatus !== 'approved' && prevStatus !== 'dispatched' && prevStatus !== 'delivered' && prevStatus !== 'completed')) {
            // Validate available stock for all items before committing
            const requestedByProduct = new Map();
            for (const it of order.items) {
                requestedByProduct.set(it.productId, (requestedByProduct.get(it.productId) || 0) + Number(it.quantity || 0));
            }
            const ids = Array.from(requestedByProduct.keys());
            if (ids.length > 0) {
                const dbProducts = await Product_1.ProductModel.find({ _id: { $in: ids } }).lean();
                for (const p of dbProducts) {
                    const required = requestedByProduct.get(String(p._id)) || 0;
                    const available = Number(p.stockQuantity || 0);
                    if (required > available) {
                        return res.status(400).json({ ok: false, error: `Insufficient stock for ${p.name}. Available: ${available}, required: ${required}` });
                    }
                }
            }
            // For each item, create an 'out' movement and decrement product/batch stock
            for (const it of order.items) {
                await StockMovement_1.StockMovementModel.create({
                    date: new Date(),
                    productId: it.productId,
                    productName: it.productName,
                    batchNo: it.batchNo,
                    type: 'out',
                    quantity: Number(it.quantity) || 0,
                    reference: order.orderNo,
                    remarks: `Order ${order.orderNo} ${status}`,
                });
                const p = await Product_1.ProductModel.findById(it.productId);
                if (p) {
                    p.stockQuantity = Math.max(0, Number(p.stockQuantity || 0) - Number(it.quantity || 0));
                    await p.save();
                }
                if (it.batchId) {
                    const b = await ProductBatch_1.ProductBatchModel.findById(String(it.batchId));
                    if (b) {
                        b.stockQuantity = Math.max(0, Number(b.stockQuantity || 0) - Number(it.quantity || 0));
                        await b.save();
                    }
                }
            }
        }
        else if ((status === 'dispatched' || status === 'delivered' || status === 'completed') && prevStatus === 'approved') {
            // Compatibility: if some previously approved orders did not trigger stock-out yet,
            // ensure we create missing movements on dispatch without double-counting
            for (const it of order.items) {
                const existing = await StockMovement_1.StockMovementModel.findOne({
                    productId: it.productId,
                    type: 'out',
                    reference: order.orderNo,
                });
                if (!existing) {
                    // Validate available stock for this item before creating the missing movement
                    const pCheck = await Product_1.ProductModel.findById(it.productId).lean();
                    const available = Number(pCheck?.stockQuantity || 0);
                    const required = Number(it.quantity || 0);
                    if (required > available) {
                        return res.status(400).json({ ok: false, error: `Insufficient stock for ${pCheck?.name || 'product'}. Available: ${available}, required: ${required}` });
                    }
                    await StockMovement_1.StockMovementModel.create({
                        date: new Date(),
                        productId: it.productId,
                        productName: it.productName,
                        batchNo: it.batchNo,
                        type: 'out',
                        quantity: Number(it.quantity) || 0,
                        reference: order.orderNo,
                        remarks: `Order ${order.orderNo} ${status}`,
                    });
                    const p = await Product_1.ProductModel.findById(it.productId);
                    if (p) {
                        p.stockQuantity = Math.max(0, Number(p.stockQuantity || 0) - Number(it.quantity || 0));
                        await p.save();
                    }
                    if (it.batchId) {
                        const b = await ProductBatch_1.ProductBatchModel.findById(String(it.batchId));
                        if (b) {
                            b.stockQuantity = Math.max(0, Number(b.stockQuantity || 0) - Number(it.quantity || 0));
                            await b.save();
                        }
                    }
                }
            }
        }
        else if (status === 'cancelled' && (prevStatus === 'approved' || prevStatus === 'dispatched' || prevStatus === 'delivered' || prevStatus === 'completed')) {
            // Roll back stock if a previously committed order is cancelled
            for (const it of order.items) {
                await StockMovement_1.StockMovementModel.create({
                    date: new Date(),
                    productId: it.productId,
                    productName: it.productName,
                    batchNo: it.batchNo,
                    type: 'return',
                    quantity: Number(it.quantity) || 0,
                    reference: order.orderNo,
                    remarks: `Order ${order.orderNo} cancelled - stock returned`,
                });
                const p = await Product_1.ProductModel.findById(it.productId);
                if (p) {
                    p.stockQuantity = Math.max(0, Number(p.stockQuantity || 0) + Number(it.quantity || 0));
                    await p.save();
                }
                if (it.batchId) {
                    const b = await ProductBatch_1.ProductBatchModel.findById(String(it.batchId));
                    if (b) {
                        b.stockQuantity = Math.max(0, Number(b.stockQuantity || 0) + Number(it.quantity || 0));
                        await b.save();
                    }
                }
            }
        }
        // Auto-create invoice when order becomes committed (only for sales)
        if ((status === 'approved' || status === 'dispatched' || status === 'delivered' || status === 'completed') &&
            String(order.docType || 'sale') === 'sale') {
            try {
                const exists = await Invoice_1.InvoiceModel.findOne({ orderId: order._id }).lean();
                if (!exists) {
                    const cfg = await AppConfig_1.AppConfigModel.findOne().lean();
                    const auto = cfg?.autoGenerateInvoice !== false; // default true
                    if (auto) {
                        const prefix = cfg?.invoicePrefix || 'INV-';
                        const terms = typeof cfg?.paymentTermsDays === 'number' ? cfg.paymentTermsDays : 30;
                        const invoiceDate = new Date();
                        const dueDate = new Date(invoiceDate.getTime() + terms * 24 * 60 * 60 * 1000);
                        await Invoice_1.InvoiceModel.create({
                            invoiceNo: genInvoiceNo(prefix),
                            orderId: order._id,
                            orderNo: order.orderNo,
                            customerId: order.customerId,
                            customerName: order.customerName,
                            customerType: order.customerType,
                            invoiceDate,
                            dueDate,
                            totalAmount: order.totalAmount || 0,
                            discountAmount: order.discountAmount || 0,
                            taxAmount: order.taxAmount || 0,
                            netAmount: order.netAmount || 0,
                            items: order.items || [],
                            paymentTermsDays: terms,
                        });
                    }
                }
            }
            catch {
            }
        }
        await order.save();
        res.json({ ok: true, order });
    }
    catch (err) {
        res.status(400).json({ ok: false, error: err?.message || 'Failed to update order status' });
    }
});
exports.default = router;
