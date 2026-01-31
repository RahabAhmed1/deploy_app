"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const mongoose_1 = __importDefault(require("mongoose"));
const dotenv_1 = __importDefault(require("dotenv"));
const products_1 = __importDefault(require("./routes/products"));
const expenses_1 = __importDefault(require("./routes/expenses"));
const stockMovements_1 = __importDefault(require("./routes/stockMovements"));
const customers_1 = __importDefault(require("./routes/customers"));
const orders_1 = __importDefault(require("./routes/orders"));
const payments_1 = __importDefault(require("./routes/payments"));
const dashboard_1 = __importDefault(require("./routes/dashboard"));
const invoices_1 = __importDefault(require("./routes/invoices"));
const supplierReturns_1 = __importDefault(require("./routes/supplierReturns"));
const returns_1 = __importDefault(require("./routes/returns"));
const suppliers_1 = __importDefault(require("./routes/suppliers"));
const purchases_1 = __importDefault(require("./routes/purchases"));
const supplierPayments_1 = __importDefault(require("./routes/supplierPayments"));
const reports_1 = __importDefault(require("./routes/reports"));
const auth_1 = __importDefault(require("./routes/auth"));
const settings_1 = __importDefault(require("./routes/settings"));
const users_1 = __importDefault(require("./routes/users"));
const productBatches_1 = __importDefault(require("./routes/productBatches"));
const stockRequests_1 = __importDefault(require("./routes/stockRequests"));
const deliveries_1 = __importDefault(require("./routes/deliveries"));
const notifications_1 = __importDefault(require("./routes/notifications"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const User_1 = require("./models/User");
const node_net_1 = __importDefault(require("node:net"));
const node_path_1 = __importDefault(require("node:path"));
dotenv_1.default.config();
let offlineMode = false;
const app = (0, express_1.default)();
app.use((0, cors_1.default)());
app.use(express_1.default.json({ limit: '25mb' }));
app.use(express_1.default.urlencoded({ extended: true, limit: '25mb' }));
app.use('/uploads', express_1.default.static(node_path_1.default.join(process.cwd(), 'uploads')));
const PORT = process.env.PORT ? Number(process.env.PORT) : 5000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/pharmaflow_pro';
async function isPortAvailable(port) {
    return new Promise((resolve) => {
        const tester = node_net_1.default
            .createServer()
            .once('error', (err) => {
            if (err && err.code === 'EADDRINUSE') {
                resolve(false);
            }
            else {
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
            await mongoose_1.default.connect(MONGODB_URI, {
                serverSelectionTimeoutMS: 5000,
                connectTimeoutMS: 5000,
            });
            console.log('MongoDB connected');
        }
        catch (connErr) {
            if (process.env.ALLOW_STATIC_ADMIN === '1') {
                offlineMode = true;
                console.warn('MongoDB connection failed; continuing in OFFLINE MODE. Reason:', connErr?.message || connErr);
            }
            else {
                throw connErr;
            }
        }
        // Seed default admin if not exists (only when DB is connected)
        if (!offlineMode) {
            const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
            const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@pharmaflow.pro';
            const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '123';
            const existingAdmin = await User_1.UserModel.findOne({ username: ADMIN_USERNAME });
            if (!existingAdmin) {
                const passwordHash = await bcryptjs_1.default.hash(ADMIN_PASSWORD, 10);
                await User_1.UserModel.create({
                    username: ADMIN_USERNAME,
                    email: ADMIN_EMAIL,
                    passwordHash,
                    role: 'admin',
                    isActive: true,
                });
                console.log('Seeded default admin user');
            }
        }
        app.get('/health', (_req, res) => res.json({ ok: true }));
        app.use('/api/products', products_1.default);
        app.use('/api/expenses', expenses_1.default);
        app.use('/api/stock-movements', stockMovements_1.default);
        app.use('/api/customers', customers_1.default);
        app.use('/api/orders', orders_1.default);
        app.use('/api/payments', payments_1.default);
        app.use('/api/invoices', invoices_1.default);
        app.use('/api/returns', returns_1.default);
        app.use('/api/supplier-returns', supplierReturns_1.default);
        app.use('/api/suppliers', suppliers_1.default);
        app.use('/api/purchases', purchases_1.default);
        app.use('/api/supplier-payments', supplierPayments_1.default);
        app.use('/api/product-batches', productBatches_1.default);
        app.use('/api/dashboard', dashboard_1.default);
        app.use('/api/reports', reports_1.default);
        app.use('/api/auth', auth_1.default);
        app.use('/api/settings', settings_1.default);
        app.use('/api/users', users_1.default);
        app.use('/api/stock-requests', stockRequests_1.default);
        app.use('/api/deliveries', deliveries_1.default);
        app.use('/api/notifications', notifications_1.default);
        const available = await isPortAvailable(PORT);
        if (!available) {
            console.log(`Port ${PORT} is already in use. Assuming API is already running. Exiting.`);
            process.exit(0);
        }
        app.listen(PORT, () => {
            console.log(`API server listening on port ${PORT}`);
        });
    }
    catch (err) {
        console.error('Failed to start server', err);
        process.exit(1);
    }
}
start();
