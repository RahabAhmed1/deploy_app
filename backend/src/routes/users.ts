import { Router, type Request, type Response } from 'express';
import bcrypt from 'bcryptjs';
import { UserModel } from '../models/User';
import jwt from 'jsonwebtoken';
import path from 'node:path';
import fs from 'node:fs';

const router = Router();

function getAuth(req: Request): { userId: string; role: string } | null {
  try {
    const auth = String(req.headers.authorization || '');
    const token = auth.toLowerCase().startsWith('bearer ') ? auth.slice(7).trim() : '';
    if (!token) return null;
    const secret = process.env.JWT_SECRET || 'dev_secret';
    const decoded: any = jwt.verify(token, secret);
    return {
      userId: decoded?.sub ? String(decoded.sub) : '',
      role: decoded?.role ? String(decoded.role) : '',
    };
  } catch {
    return null;
  }
}

async function requireUser(req: Request): Promise<{ role: string; userId: string; supplierId: string; supplierName: string } | null> {
  const auth = getAuth(req);
  if (!auth) return null;
  const role = auth.role;
  const userId = auth.userId;
  if (role === 'admin' && userId === 'offline-admin') {
    return { role, userId, supplierId: '', supplierName: '' };
  }
  if (!userId) return null;
  try {
    const u: any = await UserModel.findById(userId).lean();
    if (!u) return null;
    return {
      role: String(u.role || role || ''),
      userId: String(u._id),
      supplierId: u.supplierId ? String(u.supplierId) : '',
      supplierName: u.supplierName ? String(u.supplierName) : '',
    };
  } catch {
    return null;
  }
}

async function genStaffCode() {
  for (let i = 0; i < 20; i++) {
    const code = `STF-${String(Math.floor(Math.random() * 1_000_000)).padStart(6, '0')}`;
    const exists = await UserModel.findOne({ staffCode: code }).lean();
    if (!exists) return code;
  }
  return `STF-${Date.now()}`;
}

async function genCode(prefix: string) {
  for (let i = 0; i < 20; i++) {
    const code = `${prefix}-${String(Math.floor(Math.random() * 1_000_000)).padStart(6, '0')}`;
    const exists = await UserModel.findOne({ staffCode: code }).lean();
    if (!exists) return code;
  }
  return `${prefix}-${Date.now()}`;
}

function normalize(u: any) {
  return {
    id: String(u._id),
    username: u.username,
    email: u.email || '',
    role: u.role || 'staff',
    isActive: !!u.isActive,
    staffCode: u.staffCode || '',
    permissions: Array.isArray(u.permissions) ? u.permissions : [],
    supplierId: u.supplierId ? String(u.supplierId) : '',
    supplierName: u.supplierName || '',
    fullName: u.fullName || '',
    phone: u.phone || '',
    address: u.address || '',
    vehicleNo: u.vehicleNo || '',
    avatarUrl: u.avatarUrl || '',
  };
}

function safeExt(raw: string) {
  const s = String(raw || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  if (s === 'jpeg') return 'jpg';
  if (s === 'jpg' || s === 'png' || s === 'webp') return s;
  return 'jpg';
}

router.get('/', async (_req: Request, res: Response) => {
  try {
    const me = await requireUser(_req);
    if (!me) return res.status(401).json({ ok: false, error: 'Unauthorized' });

    if (me.role === 'admin') {
      const users = await UserModel.find({ $nor: [{ role: 'rider', supplierId: { $exists: true, $ne: null } }] }).sort({ createdAt: -1 }).lean();
      return res.json({ ok: true, users: users.map(normalize) });
    }

    if (me.role === 'staff') {
      const users = await UserModel.find({ role: 'staff' }).sort({ createdAt: -1 }).lean();
      return res.json({ ok: true, users: users.map(normalize) });
    }

    if (me.role === 'supplier') {
      const q: any = { $or: [{ _id: me.userId }, { role: 'rider', supplierId: me.supplierId }] };
      const users = await UserModel.find(q).sort({ createdAt: -1 }).lean();
      return res.json({ ok: true, users: users.map(normalize) });
    }

    if (me.role === 'rider' || me.role === 'customer') {
      const u: any = await UserModel.findById(me.userId).lean();
      if (!u) return res.status(404).json({ ok: false, error: 'User not found' });
      return res.json({ ok: true, users: [normalize(u)] });
    }

    return res.status(403).json({ ok: false, error: 'Forbidden' });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err?.message || 'Failed to fetch users' });
  }
});

router.post('/', async (req: Request, res: Response) => {
  try {
    const me = await requireUser(req);
    if (!me) return res.status(401).json({ ok: false, error: 'Unauthorized' });

    const { username, email, password, role, permissions, isActive, supplierId, supplierName, fullName, phone, address, vehicleNo, avatarUrl } = req.body || {};
    if (!username || !password) return res.status(400).json({ ok: false, error: 'username and password are required' });
    const exists = await UserModel.findOne({ username });
    if (exists) return res.status(400).json({ ok: false, error: 'Username already exists' });
    const hash = await bcrypt.hash(String(password), 10);

    if (me.role === 'supplier') {
      if (role !== 'rider') return res.status(403).json({ ok: false, error: 'Supplier can only create rider users' });
      if (!me.supplierId) return res.status(400).json({ ok: false, error: 'Supplier account missing supplierId' });
    } else if (me.role === 'staff') {
      if (role && String(role) !== 'staff') return res.status(403).json({ ok: false, error: 'Staff can only create staff users' });
    } else if (me.role !== 'admin') {
      return res.status(403).json({ ok: false, error: 'Forbidden' });
    }

    const normalizedRole = role === 'admin' || role === 'supplier' || role === 'rider' || role === 'customer' ? role : 'staff';
    const staffCode =
      normalizedRole === 'admin'
        ? undefined
        : normalizedRole === 'staff'
          ? await genStaffCode()
          : await genCode(normalizedRole === 'supplier' ? 'SUP' : normalizedRole === 'rider' ? 'RID' : 'CUS');

    const supplierIdToSet =
      normalizedRole === 'supplier'
        ? supplierId
          ? String(supplierId)
          : undefined
        : normalizedRole === 'rider'
          ? me.role === 'supplier'
            ? me.supplierId
            : undefined
          : undefined;

    const supplierNameToSet =
      normalizedRole === 'supplier'
        ? supplierName
          ? String(supplierName)
          : undefined
        : normalizedRole === 'rider'
          ? me.role === 'supplier'
            ? me.supplierName
            : undefined
          : undefined;

    if (normalizedRole === 'supplier' && !supplierIdToSet) {
      return res.status(400).json({ ok: false, error: 'supplierId is required for supplier users' });
    }

    const doc = await UserModel.create({
      username,
      email,
      passwordHash: hash,
      role: normalizedRole,
      staffCode,
      permissions: Array.isArray(permissions) ? permissions : [],
      isActive: isActive !== undefined ? !!isActive : true,
      supplierId: supplierIdToSet,
      supplierName: supplierNameToSet,
      fullName: fullName ? String(fullName) : undefined,
      phone: phone ? String(phone) : undefined,
      address: address ? String(address) : undefined,
      vehicleNo: vehicleNo ? String(vehicleNo) : undefined,
      avatarUrl: avatarUrl ? String(avatarUrl) : undefined,
    });
    res.status(201).json({ ok: true, user: normalize(doc) });
  } catch (err: any) {
    res.status(400).json({ ok: false, error: err?.message || 'Failed to create user' });
  }
});

router.put('/:id', async (req: Request, res: Response) => {
  try {
    const me = await requireUser(req);
    if (!me) return res.status(401).json({ ok: false, error: 'Unauthorized' });

    const { id } = req.params;
    const { password, role, permissions, isActive, username, email, supplierId, supplierName, fullName, phone, address, vehicleNo, avatarUrl } = req.body || {};

    const existing: any = await UserModel.findById(id).lean();
    if (!existing) return res.status(404).json({ ok: false, error: 'User not found' });

    if (me.role === 'supplier') {
      const isOwn = String(existing._id) === String(me.userId);
      const isOwnRider = existing.role === 'rider' && String(existing.supplierId || '') === String(me.supplierId || '');
      if (!isOwnRider && !isOwn) return res.status(403).json({ ok: false, error: 'Forbidden' });
      if (role !== undefined && String(role) !== String(existing.role)) return res.status(403).json({ ok: false, error: 'Cannot change role' });
      if (permissions !== undefined) return res.status(403).json({ ok: false, error: 'Cannot change permissions' });
      if (supplierId !== undefined || supplierName !== undefined) return res.status(403).json({ ok: false, error: 'Cannot change supplier linkage' });
    }

    if (me.role === 'rider') {
      const isOwn = String(existing._id) === String(me.userId);
      if (!isOwn) return res.status(403).json({ ok: false, error: 'Forbidden' });
      if (role !== undefined && String(role) !== String(existing.role)) return res.status(403).json({ ok: false, error: 'Cannot change role' });
      if (permissions !== undefined) return res.status(403).json({ ok: false, error: 'Cannot change permissions' });
      if (supplierId !== undefined || supplierName !== undefined) return res.status(403).json({ ok: false, error: 'Cannot change supplier linkage' });
      if (isActive !== undefined) return res.status(403).json({ ok: false, error: 'Cannot change active status' });
    } else if (me.role !== 'admin' && me.role !== 'staff' && me.role !== 'supplier') {
      return res.status(403).json({ ok: false, error: 'Forbidden' });
    }

    const update: any = {};
    if (username !== undefined) update.username = username;
    if (email !== undefined) update.email = email;
    if (role !== undefined) update.role = role === 'admin' || role === 'supplier' || role === 'rider' || role === 'customer' ? role : 'staff';
    if (permissions !== undefined) update.permissions = Array.isArray(permissions) ? permissions : [];
    if (isActive !== undefined) update.isActive = !!isActive;
    if (supplierId !== undefined) update.supplierId = supplierId ? String(supplierId) : undefined;
    if (supplierName !== undefined) update.supplierName = supplierName ? String(supplierName) : undefined;
    if (fullName !== undefined) update.fullName = fullName ? String(fullName) : undefined;
    if (phone !== undefined) update.phone = phone ? String(phone) : undefined;
    if (address !== undefined) update.address = address ? String(address) : undefined;
    if (vehicleNo !== undefined) update.vehicleNo = vehicleNo ? String(vehicleNo) : undefined;
    if (avatarUrl !== undefined) update.avatarUrl = avatarUrl ? String(avatarUrl) : undefined;
    if (password) update.passwordHash = await bcrypt.hash(String(password), 10);
    const doc = await UserModel.findByIdAndUpdate(id, update, { new: true });
    if (!doc) return res.status(404).json({ ok: false, error: 'User not found' });
    res.json({ ok: true, user: normalize(doc) });
  } catch (err: any) {
    res.status(400).json({ ok: false, error: err?.message || 'Failed to update user' });
  }
});

router.post('/:id/avatar', async (req: Request, res: Response) => {
  try {
    const me = await requireUser(req);
    if (!me) return res.status(401).json({ ok: false, error: 'Unauthorized' });
    if (me.role === 'admin' && me.userId === 'offline-admin') {
      return res.status(400).json({ ok: false, error: 'Offline mode does not support uploads' });
    }

    const { id } = req.params;
    const existing: any = await UserModel.findById(String(id));
    if (!existing) return res.status(404).json({ ok: false, error: 'User not found' });

    if (me.role === 'supplier') {
      const isOwn = String(existing._id) === String(me.userId);
      const isOwnRider = existing.role === 'rider' && String(existing.supplierId || '') === String(me.supplierId || '');
      if (!isOwn && !isOwnRider) return res.status(403).json({ ok: false, error: 'Forbidden' });
    } else if (me.role === 'rider') {
      const isOwn = String(existing._id) === String(me.userId);
      if (!isOwn) return res.status(403).json({ ok: false, error: 'Forbidden' });
    } else if (me.role !== 'admin' && me.role !== 'staff') {
      return res.status(403).json({ ok: false, error: 'Forbidden' });
    }

    const body = req.body || {};
    const raw = body.base64 || body.dataUrl || body.image || '';
    if (!raw || typeof raw !== 'string') {
      return res.status(400).json({ ok: false, error: 'base64 is required' });
    }

    let payloadBase64 = raw.trim();
    let inferredMime = '';
    const m = payloadBase64.match(/^data:([^;]+);base64,(.*)$/);
    if (m) {
      inferredMime = String(m[1] || '');
      payloadBase64 = String(m[2] || '').trim();
    }

    const extFromMime = inferredMime.includes('/') ? inferredMime.split('/').pop() : '';
    const ext = safeExt(body.ext || extFromMime || 'jpg');

    const uploadsRoot = path.join(process.cwd(), 'uploads');
    const dir = path.join(uploadsRoot, 'users', String(existing._id));
    fs.mkdirSync(dir, { recursive: true });

    const filename = `${Date.now()}.${ext}`;
    const filePath = path.join(dir, filename);
    fs.writeFileSync(filePath, Buffer.from(payloadBase64, 'base64'));

    const url = `/uploads/users/${String(existing._id)}/${filename}`;
    existing.avatarUrl = url;
    await existing.save();

    return res.json({ ok: true, user: normalize(existing) });
  } catch (err: any) {
    return res.status(400).json({ ok: false, error: err?.message || 'Failed to upload avatar' });
  }
});

router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const me = await requireUser(req);
    if (!me) return res.status(401).json({ ok: false, error: 'Unauthorized' });

    const { id } = req.params;

    const existing: any = await UserModel.findById(id).lean();
    if (!existing) return res.status(404).json({ ok: false, error: 'User not found' });

    if (me.role === 'supplier') {
      const isOwnRider = existing.role === 'rider' && String(existing.supplierId || '') === String(me.supplierId || '');
      if (!isOwnRider) return res.status(403).json({ ok: false, error: 'Forbidden' });
    } else if (me.role !== 'admin' && me.role !== 'staff') {
      return res.status(403).json({ ok: false, error: 'Forbidden' });
    }

    const r = await UserModel.findByIdAndDelete(id);
    if (!r) return res.status(404).json({ ok: false, error: 'User not found' });
    res.json({ ok: true });
  } catch (err: any) {
    res.status(400).json({ ok: false, error: err?.message || 'Failed to delete user' });
  }
});

export default router;
