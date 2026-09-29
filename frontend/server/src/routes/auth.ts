import { Router, type Request, type Response } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { UserModel } from '../models/User.js';

const router = Router();

router.post('/login', async (req: Request, res: Response) => {
  try {
    const { identifier, password } = req.body || {};
    if (!identifier || !password) {
      return res.status(400).json({ ok: false, error: 'Missing credentials' });
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
      { sub: String(user._id), role: user.role, username: user.username },
      secret,
      { expiresIn: '7d' }
    );

    return res.json({
      ok: true,
      token,
      user: { id: String(user._id), username: user.username, role: user.role },
    });
  } catch (err: any) {
    return res.status(500).json({ ok: false, error: err?.message || 'Login failed' });
  }
});

export default router;
