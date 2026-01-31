import { Router, type Request, type Response } from 'express';
import { ProductModel } from '../models/Product';
import { OrderModel } from '../models/Order';
import { CustomerModel } from '../models/Customer';

const router = Router();

router.get('/', async (_req: Request, res: Response) => {
  try {
    const now = new Date();
    const in90 = new Date(now);
    in90.setDate(in90.getDate() + 90);

    const [
      totalProducts,
      lowStockItems,
      expiringItems,
      totalOrders,
      pendingOrders,
      totalCustomers,
      outstandingAgg,
      totalRevenueAgg,
      thisMonthAgg,
      lastMonthAgg,
      todayAgg,
    ] = await Promise.all([
      ProductModel.countDocuments({}),
      ProductModel.countDocuments({ $expr: { $lte: [ '$stockQuantity', '$minStockLevel' ] } }),
      ProductModel.countDocuments({ expiryDate: { $lte: in90 } }),
      OrderModel.countDocuments({}),
      OrderModel.countDocuments({ status: 'pending' }),
      CustomerModel.countDocuments({}),
      CustomerModel.aggregate([{ $group: { _id: null, total: { $sum: { $ifNull: [ '$outstandingBalance', 0 ] } } } }]),
      OrderModel.aggregate([{ $group: { _id: null, total: { $sum: { $ifNull: [ '$netAmount', 0 ] } } } }]),
      // This month sales
      (() => {
        const d = new Date();
        const start = new Date(d.getFullYear(), d.getMonth(), 1);
        const end = new Date(d.getFullYear(), d.getMonth() + 1, 1);
        return OrderModel.aggregate([
          { $match: { orderDate: { $gte: start, $lt: end } } },
          { $group: { _id: null, total: { $sum: { $ifNull: [ '$netAmount', 0 ] } } } },
        ]);
      })(),
      // Last month sales
      (() => {
        const d = new Date();
        const start = new Date(d.getFullYear(), d.getMonth() - 1, 1);
        const end = new Date(d.getFullYear(), d.getMonth(), 1);
        return OrderModel.aggregate([
          { $match: { orderDate: { $gte: start, $lt: end } } },
          { $group: { _id: null, total: { $sum: { $ifNull: [ '$netAmount', 0 ] } } } },
        ]);
      })(),
      // Today sales
      (() => {
        const d = new Date();
        const start = new Date(d.getFullYear(), d.getMonth(), d.getDate());
        const end = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
        return OrderModel.aggregate([
          { $match: { orderDate: { $gte: start, $lt: end } } },
          { $group: { _id: null, total: { $sum: { $ifNull: [ '$netAmount', 0 ] } } } },
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
    }});
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err?.message || 'Failed to compute dashboard stats' });
  }
});

export default router;
