"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const Notification_1 = require("../models/Notification");
const Product_1 = require("../models/Product");
const AppConfig_1 = require("../models/AppConfig");
const notify_1 = require("../notify");
const router = (0, express_1.Router)();
function getAuth(req) {
    try {
        const auth = String(req.headers.authorization || '');
        const token = auth.toLowerCase().startsWith('bearer ') ? auth.slice(7).trim() : '';
        if (!token)
            return null;
        const secret = process.env.JWT_SECRET || 'dev_secret';
        const decoded = jsonwebtoken_1.default.verify(token, secret);
        return {
            userId: decoded?.sub ? String(decoded.sub) : '',
            role: decoded?.role ? String(decoded.role) : '',
            supplierId: decoded?.supplierId ? String(decoded.supplierId) : '',
        };
    }
    catch {
        return null;
    }
}
function normalize(doc) {
    return {
        id: String(doc._id),
        type: String(doc.type || ''),
        title: String(doc.title || ''),
        message: String(doc.message || ''),
        entityType: doc.entityType ? String(doc.entityType) : '',
        entityId: doc.entityId ? String(doc.entityId) : '',
        readAt: doc.readAt ? new Date(doc.readAt).toISOString() : '',
        createdAt: doc.createdAt ? new Date(doc.createdAt).toISOString() : '',
    };
}
async function ensureAdminAlerts(role) {
    try {
        if (role !== 'admin' && role !== 'staff')
            return;
        const cfg = await AppConfig_1.AppConfigModel.findOne({}).sort({ createdAt: -1 }).lean();
        const lowStockEnabled = cfg?.lowStockAlertEnabled !== undefined ? !!cfg.lowStockAlertEnabled : true;
        const expiryEnabled = cfg?.expiryAlertEnabled !== undefined ? !!cfg.expiryAlertEnabled : true;
        const expiryDays = Number.isFinite(Number(cfg?.expiryAlertDays)) ? Number(cfg.expiryAlertDays) : 90;
        if (lowStockEnabled) {
            const low = await Product_1.ProductModel.find({ $expr: { $and: [{ $gt: ['$minStockLevel', 0] }, { $lte: ['$stockQuantity', '$minStockLevel'] }] } })
                .sort({ stockQuantity: 1 })
                .limit(50)
                .lean();
            for (const p of low) {
                const pid = String(p._id);
                const name = String(p.name || 'Product');
                const qty = Number(p.stockQuantity || 0);
                const min = Number(p.minStockLevel || 0);
                await (0, notify_1.createNotification)({ toRole: role }, {
                    type: 'low_stock',
                    title: 'Low stock',
                    message: `${name} stock is low (${qty} / min ${min}).`,
                    entityType: 'product',
                    entityId: pid,
                    dedupeKey: `low_stock_${role}_${pid}`,
                });
            }
        }
        if (expiryEnabled) {
            const until = new Date(Date.now() + Math.max(1, expiryDays) * 24 * 60 * 60 * 1000);
            const exp = await Product_1.ProductModel.find({ expiryDate: { $exists: true, $ne: null, $lte: until } }).sort({ expiryDate: 1 }).limit(50).lean();
            for (const p of exp) {
                const pid = String(p._id);
                const name = String(p.name || 'Product');
                const dt = p.expiryDate ? new Date(p.expiryDate) : null;
                const yyyyMmDd = dt && !Number.isNaN(dt.getTime()) ? dt.toISOString().slice(0, 10) : '';
                await (0, notify_1.createNotification)({ toRole: role }, {
                    type: 'expiry',
                    title: 'Expiry alert',
                    message: `${name} expires on ${yyyyMmDd || 'soon'}.`,
                    entityType: 'product',
                    entityId: pid,
                    dedupeKey: `expiry_${role}_${pid}_${yyyyMmDd}`,
                });
            }
        }
    }
    catch {
    }
}
router.get('/', async (req, res) => {
    try {
        const me = getAuth(req);
        if (!me)
            return res.status(401).json({ ok: false, error: 'Unauthorized' });
        await ensureAdminAlerts(me.role);
        const limit = req.query.limit ? Math.min(200, Math.max(1, Number(req.query.limit))) : 50;
        const unreadOnly = String(req.query.unreadOnly || '') === '1';
        const or = [];
        if (me.userId)
            or.push({ toUserId: me.userId });
        if (me.role)
            or.push({ toRole: me.role });
        if (me.role === 'supplier' && me.supplierId)
            or.push({ toSupplierId: me.supplierId });
        const filter = { $or: or.length ? or : [{ toRole: me.role }] };
        if (unreadOnly)
            filter.readAt = { $exists: false };
        const docs = await Notification_1.NotificationModel.find(filter).sort({ createdAt: -1 }).limit(limit).lean();
        const unreadCount = await Notification_1.NotificationModel.countDocuments({ ...filter, readAt: { $exists: false } });
        return res.json({ ok: true, notifications: docs.map(normalize), unreadCount });
    }
    catch (err) {
        return res.status(500).json({ ok: false, error: err?.message || 'Failed to fetch notifications' });
    }
});
router.post('/:id/read', async (req, res) => {
    try {
        const me = getAuth(req);
        if (!me)
            return res.status(401).json({ ok: false, error: 'Unauthorized' });
        const { id } = req.params;
        const doc = await Notification_1.NotificationModel.findById(String(id));
        if (!doc)
            return res.status(404).json({ ok: false, error: 'Notification not found' });
        const allowed = (doc.toUserId && String(doc.toUserId) === String(me.userId)) ||
            (doc.toRole && String(doc.toRole) === String(me.role)) ||
            (doc.toSupplierId && String(doc.toSupplierId) === String(me.supplierId));
        if (!allowed)
            return res.status(403).json({ ok: false, error: 'Forbidden' });
        if (!doc.readAt) {
            doc.readAt = new Date();
            await doc.save();
        }
        return res.json({ ok: true, notification: normalize(doc) });
    }
    catch (err) {
        return res.status(400).json({ ok: false, error: err?.message || 'Failed to mark read' });
    }
});
router.post('/read-all', async (req, res) => {
    try {
        const me = getAuth(req);
        if (!me)
            return res.status(401).json({ ok: false, error: 'Unauthorized' });
        const or = [];
        if (me.userId)
            or.push({ toUserId: me.userId });
        if (me.role)
            or.push({ toRole: me.role });
        if (me.role === 'supplier' && me.supplierId)
            or.push({ toSupplierId: me.supplierId });
        const filter = { $or: or.length ? or : [{ toRole: me.role }], readAt: { $exists: false } };
        await Notification_1.NotificationModel.updateMany(filter, { $set: { readAt: new Date() } });
        return res.json({ ok: true });
    }
    catch (err) {
        return res.status(400).json({ ok: false, error: err?.message || 'Failed to mark all read' });
    }
});
exports.default = router;
