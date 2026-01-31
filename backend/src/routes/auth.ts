import { Router, type Request, type Response } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { UserModel } from '../models/User';
import mongoose from 'mongoose';

const router = Router();

router.post('/login', async (req: Request, res: Response) => {
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
        const token = jwt.sign(
          { sub: 'offline-admin', role: 'admin', username: 'admin' },
          secret,
          { expiresIn: '7d' }
        );
        return res.json({ ok: true, token, user: { id: 'offline-admin', username: 'admin', role: 'admin', staffCode: 'ADMIN', permissions: [] } });
      }
      if (mongoose.connection.readyState !== 1) {
        return res.status(401).json({ ok: false, error: 'Invalid credentials' });
      }
    }

    const user = await UserModel.findOne({
      $or: [
        { username: identifier },
        { email: typeof identifier === 'string' ? identifier.toLowerCase() : identifier },
      ],
    });

    if (!user || !user.isActive) {
      return res.status(401).json({ ok: false, error: 'Invalid credentials' });
    }

    const match = await bcrypt.compare(password, user.passwordHash);
    if (!match) {
      return res.status(401).json({ ok: false, error: 'Invalid credentials' });
    }

    const secret = process.env.JWT_SECRET || 'dev_secret';
    const token = jwt.sign(
      {
        sub: String(user._id),
        role: user.role,
        username: user.username,
        supplierId: (user as any).supplierId ? String((user as any).supplierId) : '',
      },
      secret,
      { expiresIn: '7d' }
    );

    return res.json({
      ok: true,
      token,
      user: {
        id: String(user._id),
        username: user.username,
        role: user.role,
        staffCode: (user as any).staffCode || '',
        permissions: Array.isArray((user as any).permissions) ? (user as any).permissions : [],
        supplierId: (user as any).supplierId ? String((user as any).supplierId) : '',
        supplierName: (user as any).supplierName || '',
        fullName: (user as any).fullName || '',
        phone: (user as any).phone || '',
        address: (user as any).address || '',
        avatarUrl: (user as any).avatarUrl || '',
      },
    });
  } catch (err: any) {
    return res.status(500).json({ ok: false, error: err?.message || 'Login failed' });
  }
});

export default router;
