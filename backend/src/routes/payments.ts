import { Router, type Request, type Response } from 'express';
import { PaymentModel } from '../models/Payment';
import { CustomerModel } from '../models/Customer';
import { OrderModel } from '../models/Order';

const router = Router();

// List payments
router.get('/', async (_req: Request, res: Response) => {
  try {
    const docs = await PaymentModel.find().sort({ date: -1, createdAt: -1 }).lean();
    const payments = docs.map((d: any) => ({
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
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err?.message || 'Failed to fetch payments' });
  }
});

// Create payment and update outstanding + order status
router.post('/', async (req: Request, res: Response) => {
  try {
    const body = req.body || {};
    const { customerId, orderId, amount, method } = body;
    if (!customerId || !orderId || !amount || !method) {
      return res.status(400).json({ ok: false, error: 'customerId, orderId, amount, and method are required' });
    }

    const customer = await CustomerModel.findById(customerId);
    if (!customer) return res.status(404).json({ ok: false, error: 'Customer not found' });

    const order = await OrderModel.findById(orderId);
    if (!order) return res.status(404).json({ ok: false, error: 'Order not found' });

    if (String((order as any).status || '') === 'hold' || String((order as any).docType || 'sale') === 'estimate' || Boolean((order as any).deferredPosting)) {
      return res.status(400).json({ ok: false, error: 'Cannot record payment for a held/estimate order. Finalize the order first.' });
    }

    const payDoc = await PaymentModel.create({
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
    const agg = await PaymentModel.aggregate([
      { $match: { orderId: order._id } },
      { $group: { _id: '$orderId', paid: { $sum: '$amount' } } },
    ]);
    const paid = agg[0]?.paid || 0;
    if (paid >= Number(order.netAmount || 0)) order.paymentStatus = 'paid';
    else if (paid > 0) order.paymentStatus = 'partial';
    else order.paymentStatus = 'unpaid';
    await order.save();

    res.status(201).json({ ok: true, payment: payDoc });
  } catch (err: any) {
    res.status(400).json({ ok: false, error: err?.message || 'Failed to create payment' });
  }
});

export default router;
