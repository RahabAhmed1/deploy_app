"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const User_1 = require("../models/User");
const mongoose_1 = __importDefault(require("mongoose"));
const router = (0, express_1.Router)();
router.post('/login', async (req, res) => {
    try {
        const { identifier, password } = req.body || {};
        if (!identifier || !password) {
            return res.status(400).json({ ok: false, error: 'Missing credentials' });
        }
        const allowStatic = process.env.ALLOW_STATIC_ADMIN === '1';
        if (allowStatic) {
            const idLower = typeof identifier === 'string' ? identifier.toLowerCase() : identifier;
            if ((identifier === 'admin' || idLower === 'admin@pharmaflow.pro') && password === '123') {
                const secret = process.env.JWT_SECRET || 'dev_secret';
                const token = jsonwebtoken_1.default.sign({ sub: 'offline-admin', role: 'admin', username: 'admin' }, secret, { expiresIn: '7d' });
                return res.json({ ok: true, token, user: { id: 'offline-admin', username: 'admin', role: 'admin', staffCode: 'ADMIN', permissions: [] } });
            }
            if (mongoose_1.default.connection.readyState !== 1) {
                return res.status(401).json({ ok: false, error: 'Invalid credentials' });
            }
        }
        const user = await User_1.UserModel.findOne({
            $or: [
                { username: identifier },
                { email: typeof identifier === 'string' ? identifier.toLowerCase() : identifier },
            ],
        });
        if (!user || !user.isActive) {
            return res.status(401).json({ ok: false, error: 'Invalid credentials' });
        }
        const match = await bcryptjs_1.default.compare(password, user.passwordHash);
        if (!match) {
            return res.status(401).json({ ok: false, error: 'Invalid credentials' });
        }
        const secret = process.env.JWT_SECRET || 'dev_secret';
        const token = jsonwebtoken_1.default.sign({
            sub: String(user._id),
            role: user.role,
            username: user.username,
            supplierId: user.supplierId ? String(user.supplierId) : '',
        }, secret, { expiresIn: '7d' });
        return res.json({
            ok: true,
            token,
            user: {
                id: String(user._id),
                username: user.username,
                role: user.role,
                staffCode: user.staffCode || '',
                permissions: Array.isArray(user.permissions) ? user.permissions : [],
                supplierId: user.supplierId ? String(user.supplierId) : '',
                supplierName: user.supplierName || '',
                fullName: user.fullName || '',
                phone: user.phone || '',
                address: user.address || '',
                avatarUrl: user.avatarUrl || '',
            },
        });
    }
    catch (err) {
        return res.status(500).json({ ok: false, error: err?.message || 'Login failed' });
    }
});
exports.default = router;
