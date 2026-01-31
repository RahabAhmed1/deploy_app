import express, { type Request, type Response } from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import productsRouter from './routes/products';
import expensesRouter from './routes/expenses';
import stockMovementsRouter from './routes/stockMovements';
import customersRouter from './routes/customers';
import ordersRouter from './routes/orders';
import paymentsRouter from './routes/payments';
import dashboardRouter from './routes/dashboard';
import invoicesRouter from './routes/invoices';
import supplierReturnsRouter from './routes/supplierReturns';
import returnsRouter from './routes/returns';
import suppliersRouter from './routes/suppliers';
import purchasesRouter from './routes/purchases';
import supplierPaymentsRouter from './routes/supplierPayments';
import reportsRouter from './routes/reports';
import authRouter from './routes/auth';
import settingsRouter from './routes/settings';
import usersRouter from './routes/users';
import productBatchesRouter from './routes/productBatches';
import stockRequestsRouter from './routes/stockRequests';
import deliveriesRouter from './routes/deliveries';
import notificationsRouter from './routes/notifications';
import bcrypt from 'bcryptjs';
import { UserModel } from './models/User';
import net from 'node:net';
import path from 'node:path';

dotenv.config();

let offlineMode = false;

const app = express();
app.use(cors());
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

const PORT = process.env.PORT ? Number(process.env.PORT) : 5000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/pharmaflow_pro';

async function isPortAvailable(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const tester = net
      .createServer()
      .once('error', (err: any) => {
        if (err && err.code === 'EADDRINUSE') {
          resolve(false);
        } else {
          resolve(false);
        }
      })
      .once('listening', () => {
        tester.close(() => resolve(true));
      })
      .listen(port);
  });
}

async function start() {
  try {
    try {
      await mongoose.connect(MONGODB_URI, {
        serverSelectionTimeoutMS: 5000,
        connectTimeoutMS: 5000,
      } as any);
      console.log('MongoDB connected');
    } catch (connErr: any) {
      if (process.env.ALLOW_STATIC_ADMIN === '1') {
        offlineMode = true;
        console.warn('MongoDB connection failed; continuing in OFFLINE MODE. Reason:', connErr?.message || connErr);
      } else {
        throw connErr;
      }
    }

    // Seed default admin if not exists (only when DB is connected)
    if (!offlineMode) {
      const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
      const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@pharmaflow.pro';
      const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '123';

      const existingAdmin = await UserModel.findOne({ username: ADMIN_USERNAME });
      if (!existingAdmin) {
        const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 10);
        await UserModel.create({
          username: ADMIN_USERNAME,
          email: ADMIN_EMAIL,
          passwordHash,
          role: 'admin',
          isActive: true,
        });
        console.log('Seeded default admin user');
      }
    }

    app.get('/health', (_req: Request, res: Response) => res.json({ ok: true }));
    app.use('/api/products', productsRouter);
    app.use('/api/expenses', expensesRouter);
    app.use('/api/stock-movements', stockMovementsRouter);
    app.use('/api/customers', customersRouter);
    app.use('/api/orders', ordersRouter);
    app.use('/api/payments', paymentsRouter);
    app.use('/api/invoices', invoicesRouter);
    app.use('/api/returns', returnsRouter);
    app.use('/api/supplier-returns', supplierReturnsRouter);
    app.use('/api/suppliers', suppliersRouter);
    app.use('/api/purchases', purchasesRouter);
    app.use('/api/supplier-payments', supplierPaymentsRouter);
    app.use('/api/product-batches', productBatchesRouter);
    app.use('/api/dashboard', dashboardRouter);
    app.use('/api/reports', reportsRouter);
    app.use('/api/auth', authRouter);
    app.use('/api/settings', settingsRouter);
    app.use('/api/users', usersRouter);
    app.use('/api/stock-requests', stockRequestsRouter);
    app.use('/api/deliveries', deliveriesRouter);
    app.use('/api/notifications', notificationsRouter);

    const available = await isPortAvailable(PORT);
    if (!available) {
      console.log(`Port ${PORT} is already in use. Assuming API is already running. Exiting.`);
      process.exit(0);
    }

    app.listen(PORT, () => {
      console.log(`API server listening on port ${PORT}`);
    });
  } catch (err) {
    console.error('Failed to start server', err);
    process.exit(1);
  }
}

start();
