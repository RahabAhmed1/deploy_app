import { Router, type Request, type Response } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { DeliveryModel } from '../models/Delivery';
import { OrderModel } from '../models/Order';
import { UserModel } from '../models/User';
import { createNotification } from '../notify';
import { PaymentModel } from '../models/Payment';
import { CustomerModel } from '../models/Customer';
import { SupplierPaymentModel } from '../models/SupplierPayment';
import { SupplierModel } from '../models/Supplier';
import { PurchaseModel } from '../models/Purchase';

const router = Router();

function toIsoDate(value: any) {
  try {
    if (!value) return '';
    const d = value instanceof Date ? value : new Date(value);
    return !Number.isNaN(d.getTime()) ? d.toISOString() : '';
  } catch {
    return '';
  }
}

function normalizePoint(p: any) {
  if (!p) return null;
  const lat = Number(p.lat);
  const lng = Number(p.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return {
    lat,
    lng,
    at: toIsoDate(p.at),
  };
}

function getAuthUser(req: Request): { userId: string; username: string; role: string; supplierId?: string } | null {
  try {
    const auth = String(req.headers.authorization || '');
    const token = auth.toLowerCase().startsWith('bearer ') ? auth.slice(7).trim() : '';
    if (!token) return null;
    const secret = process.env.JWT_SECRET || 'dev_secret';
    const decoded: any = jwt.verify(token, secret);
    return {
      userId: decoded?.sub ? String(decoded.sub) : '',
      username: decoded?.username ? String(decoded.username) : '',
      role: decoded?.role ? String(decoded.role) : '',
      supplierId: decoded?.supplierId ? String(decoded.supplierId) : '',
    };
  } catch {
    return null;
  }
}

function normalize(doc: any, opts: { includeHistory?: boolean } = {}) {
  if (!doc) return null;
  const history = Array.isArray(doc.locationHistory) ? doc.locationHistory : [];
  return {
    id: String(doc._id),
    type: String(doc.type || ''),
    status: String(doc.status || 'created'),

    supplierId: doc.supplierId ? String(doc.supplierId) : '',
    supplierName: doc.supplierName || '',

    customerId: doc.customerId ? String(doc.customerId) : '',
    customerName: doc.customerName || '',
    customerAddress: doc.customerAddress || '',

    destinationAddress: doc.destinationAddress || '',
    destinationLat: typeof doc.destinationLat === 'number' ? doc.destinationLat : null,
    destinationLng: typeof doc.destinationLng === 'number' ? doc.destinationLng : null,

    relatedOrderId: doc.relatedOrderId ? String(doc.relatedOrderId) : '',
    relatedPurchaseId: doc.relatedPurchaseId ? String(doc.relatedPurchaseId) : '',
    relatedStockRequestId: doc.relatedStockRequestId ? String(doc.relatedStockRequestId) : '',

    items: Array.isArray(doc.items) ? doc.items : [],

    assignedToUserId: doc.assignedToUserId ? String(doc.assignedToUserId) : '',
    assignedToUsername: doc.assignedToUsername || '',
    assignedToFullName: doc.assignedToFullName || '',
    assignedToPhone: doc.assignedToPhone || '',

    assignedAt: toIsoDate(doc.assignedAt),

    createdByUserId: doc.createdByUserId || '',
    createdByUsername: doc.createdByUsername || '',

    note: doc.note || '',

    lastLocation: normalizePoint(doc.lastLocation),
    locationHistoryCount: history.length,
    ...(opts.includeHistory
      ? {
          locationHistory: history
            .slice(-200)
            .map(normalizePoint)
            .filter(Boolean),
        }
      : {}),

    pickedUpAt: doc.pickedUpAt ? new Date(doc.pickedUpAt).toISOString() : '',
    pickedUpEtaMinutes: typeof doc.pickedUpEtaMinutes === 'number' ? doc.pickedUpEtaMinutes : null,
    pickedUpDistanceKm: typeof doc.pickedUpDistanceKm === 'number' ? doc.pickedUpDistanceKm : null,

    reachedAt: doc.reachedAt ? new Date(doc.reachedAt).toISOString() : '',
    deliveredAt: doc.deliveredAt ? new Date(doc.deliveredAt).toISOString() : '',

    proofs: Array.isArray(doc.proofs) ? doc.proofs : [],

    cashCollected: Number(doc.cashCollected || 0),

    createdAt: toIsoDate(doc.createdAt),
    updatedAt: toIsoDate(doc.updatedAt),
  };
}

router.get('/', async (req: Request, res: Response) => {
  try {
    const me = getAuthUser(req);
    if (!me) return res.status(401).json({ ok: false, error: 'Unauthorized' });

    const { type, status, assignedToUserId, supplierId, customerId, relatedStockRequestId } = req.query as any;
    const filter: any = {};
    if (type) filter.type = String(type);
    if (status) filter.status = String(status);
    if (assignedToUserId) filter.assignedToUserId = String(assignedToUserId);
    if (supplierId) filter.supplierId = String(supplierId);
    if (customerId) filter.customerId = String(customerId);
    if (relatedStockRequestId) filter.relatedStockRequestId = String(relatedStockRequestId);

    if (me.role === 'supplier') {
      if (!me.supplierId) return res.status(403).json({ ok: false, error: 'Forbidden' });
      filter.supplierId = me.supplierId;
    } else if (me.role === 'rider') {
      filter.assignedToUserId = me.userId;
    } else if (me.role !== 'admin' && me.role !== 'staff') {
      return res.status(403).json({ ok: false, error: 'Forbidden' });
    }

    const docs = await DeliveryModel.find(filter).sort({ createdAt: -1 }).lean();
    res.json({ ok: true, deliveries: docs.map((doc) => normalize(doc)) });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err?.message || 'Failed to fetch deliveries' });
  }
});

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const me = getAuthUser(req);
    if (!me) return res.status(401).json({ ok: false, error: 'Unauthorized' });

    const doc: any = await DeliveryModel.findById(String(req.params.id)).lean();
    if (!doc) return res.status(404).json({ ok: false, error: 'Delivery not found' });

    if (me.role === 'supplier') {
      if (!me.supplierId) return res.status(403).json({ ok: false, error: 'Forbidden' });
      if (String(doc.supplierId || '') !== String(me.supplierId)) return res.status(403).json({ ok: false, error: 'Forbidden' });
    } else if (me.role === 'rider') {
      if (String(doc.assignedToUserId || '') !== String(me.userId)) return res.status(403).json({ ok: false, error: 'Forbidden' });
    } else if (me.role !== 'admin' && me.role !== 'staff') {
      return res.status(403).json({ ok: false, error: 'Forbidden' });
    }

    return res.json({ ok: true, delivery: normalize(doc, { includeHistory: true }) });
  } catch (err: any) {
    res.status(400).json({ ok: false, error: err?.message || 'Failed to fetch delivery' });
  }
});

router.post('/', async (req: Request, res: Response) => {
  try {
    const body = req.body || {};
    const type = String(body.type || '').trim();
    if (type !== 'supplier_to_admin' && type !== 'admin_to_customer') {
      return res.status(400).json({ ok: false, error: 'type must be supplier_to_admin or admin_to_customer' });
    }

    const itemsIn = Array.isArray(body.items) ? body.items : [];
    const items = itemsIn
      .map((it: any) => ({
        productId: it.productId ? String(it.productId) : undefined,
        productName: it.productName ? String(it.productName) : undefined,
        quantity: Number(it.quantity || 0),
        unit: it.unit ? String(it.unit) : undefined,
      }))
      .filter((it: any) => it.quantity && it.quantity > 0);

    const authUser = getAuthUser(req);
    if (!authUser) return res.status(401).json({ ok: false, error: 'Unauthorized' });
    if (authUser.role !== 'admin' && authUser.role !== 'staff' && authUser.role !== 'supplier') {
      return res.status(403).json({ ok: false, error: 'Forbidden' });
    }

    if (authUser.role === 'supplier') {
      if (type !== 'supplier_to_admin') return res.status(403).json({ ok: false, error: 'Supplier can only create supplier_to_admin deliveries' });
    }

    const doc = await DeliveryModel.create({
      type,
      status: 'created',
      supplierId: body.supplierId ? String(body.supplierId) : undefined,
      supplierName: body.supplierName ? String(body.supplierName) : undefined,
      customerId: body.customerId ? String(body.customerId) : undefined,
      customerName: body.customerName ? String(body.customerName) : undefined,
      customerAddress: body.customerAddress ? String(body.customerAddress) : undefined,
      destinationAddress: body.destinationAddress ? String(body.destinationAddress) : undefined,
      destinationLat: Number.isFinite(Number(body.destinationLat)) ? Number(body.destinationLat) : undefined,
      destinationLng: Number.isFinite(Number(body.destinationLng)) ? Number(body.destinationLng) : undefined,
      relatedOrderId: body.relatedOrderId ? String(body.relatedOrderId) : undefined,
      relatedPurchaseId: body.relatedPurchaseId ? String(body.relatedPurchaseId) : undefined,
      relatedStockRequestId: body.relatedStockRequestId ? String(body.relatedStockRequestId) : undefined,
      items,
      note: body.note ? String(body.note) : undefined,
      createdByUserId: authUser?.userId || (body.createdByUserId ? String(body.createdByUserId) : undefined),
      createdByUsername: authUser?.username || (body.createdByUsername ? String(body.createdByUsername) : undefined),
    });

    return res.status(201).json({ ok: true, delivery: normalize(doc) });
  } catch (err: any) {
    res.status(400).json({ ok: false, error: err?.message || 'Failed to create delivery' });
  }
});

router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const body = req.body || {};

    const me = getAuthUser(req);
    if (!me) return res.status(401).json({ ok: false, error: 'Unauthorized' });

    const delivery: any = await DeliveryModel.findById(String(id));
    if (!delivery) return res.status(404).json({ ok: false, error: 'Delivery not found' });

    const prevAssignedToUserId = delivery.assignedToUserId ? String(delivery.assignedToUserId) : '';
    const prevStatus = String(delivery.status || 'created');

    const locked = String(delivery.status || '') === 'delivered' || String(delivery.status || '') === 'cancelled';
    if (locked && (body.assignedToUserId !== undefined || body.assignedToUsername !== undefined)) {
      return res.status(400).json({ ok: false, error: 'Cannot change rider assignment after delivery is completed' });
    }

    if (me.role === 'supplier') {
      if (!me.supplierId) return res.status(403).json({ ok: false, error: 'Forbidden' });
      if (String(delivery.supplierId || '') !== String(me.supplierId)) return res.status(403).json({ ok: false, error: 'Forbidden' });
    } else if (me.role === 'rider') {
      if (String(delivery.assignedToUserId || '') !== String(me.userId)) return res.status(403).json({ ok: false, error: 'Forbidden' });
    } else if (me.role !== 'admin' && me.role !== 'staff') {
      return res.status(403).json({ ok: false, error: 'Forbidden' });
    }

    if (body.status !== undefined) {
      const st = String(body.status);
      const allowed = ['created', 'assigned', 'picked_up', 'in_transit', 'reached', 'delivered', 'cancelled'];
      if (!allowed.includes(st)) return res.status(400).json({ ok: false, error: 'Invalid status' });
      delivery.status = st;

      if (st === 'assigned' && !delivery.assignedAt) {
        delivery.assignedAt = new Date();
      }

      if (st === 'picked_up' && !delivery.pickedUpAt) {
        delivery.pickedUpAt = new Date();
      }
      if (st === 'reached' && !delivery.reachedAt) {
        delivery.reachedAt = new Date();
      }
      if (st === 'delivered' && !delivery.deliveredAt) {
        delivery.deliveredAt = new Date();
      }
    }

    if (body.assignedToUserId !== undefined) {
      const nextId = body.assignedToUserId ? String(body.assignedToUserId) : '';
      if (!nextId) {
        delivery.assignedToUserId = undefined;
        delivery.assignedToUsername = undefined;
        delivery.assignedToFullName = undefined;
        delivery.assignedToPhone = undefined;
      } else {
        delivery.assignedToUserId = nextId;

        const rider: any = await UserModel.findById(nextId).lean();
        const fullName = rider?.fullName ? String(rider.fullName) : '';
        const phone = rider?.phone ? String(rider.phone) : '';
        const username = rider?.username ? String(rider.username) : '';
        const fallbackName = body.assignedToUsername ? String(body.assignedToUsername) : '';

        delivery.assignedToFullName = fullName || undefined;
        delivery.assignedToPhone = phone || undefined;
        delivery.assignedToUsername = (fullName || username || fallbackName) ? String(fullName || username || fallbackName) : undefined;
      }
    } else if (body.assignedToUsername !== undefined) {
      delivery.assignedToUsername = body.assignedToUsername ? String(body.assignedToUsername) : undefined;
    }

    if (body.note !== undefined) delivery.note = body.note ? String(body.note) : '';

    if (body.destinationAddress !== undefined) {
      delivery.destinationAddress = body.destinationAddress ? String(body.destinationAddress) : '';
    }
    if (body.destinationLat !== undefined) {
      const v = Number(body.destinationLat);
      delivery.destinationLat = Number.isFinite(v) ? v : undefined;
    }
    if (body.destinationLng !== undefined) {
      const v = Number(body.destinationLng);
      delivery.destinationLng = Number.isFinite(v) ? v : undefined;
    }

    if (body.pickedUpAt !== undefined) {
      const d = body.pickedUpAt ? new Date(String(body.pickedUpAt)) : null;
      delivery.pickedUpAt = d && !Number.isNaN(d.getTime()) ? d : undefined;
    }
    if (body.pickedUpEtaMinutes !== undefined) {
      const v = Number(body.pickedUpEtaMinutes);
      delivery.pickedUpEtaMinutes = Number.isFinite(v) ? v : undefined;
    }
    if (body.pickedUpDistanceKm !== undefined) {
      const v = Number(body.pickedUpDistanceKm);
      delivery.pickedUpDistanceKm = Number.isFinite(v) ? v : undefined;
    }

    if (body.reachedAt !== undefined) {
      const d = body.reachedAt ? new Date(String(body.reachedAt)) : null;
      delivery.reachedAt = d && !Number.isNaN(d.getTime()) ? d : undefined;
    }
    if (body.deliveredAt !== undefined) {
      const d = body.deliveredAt ? new Date(String(body.deliveredAt)) : null;
      delivery.deliveredAt = d && !Number.isNaN(d.getTime()) ? d : undefined;
    }

    // If assigning a rider, default status to assigned
    if ((body.assignedToUserId || body.assignedToUsername) && String(delivery.status || 'created') === 'created') {
      delivery.status = 'assigned';

      if (!delivery.assignedAt) {
        delivery.assignedAt = new Date();
      }
    }

    // Sync related order status for admin_to_customer deliveries
    try {
      const relatedOrderId = delivery.relatedOrderId ? String(delivery.relatedOrderId) : '';
      const dtype = String(delivery.type || '');
      const dst = String(delivery.status || 'created');
      if (relatedOrderId && dtype === 'admin_to_customer') {
        if (dst === 'delivered') {
          await OrderModel.updateOne({ _id: relatedOrderId }, { $set: { status: 'delivered' } });
        } else if (dst === 'picked_up' || dst === 'in_transit' || dst === 'reached') {
          await OrderModel.updateOne(
            { _id: relatedOrderId, status: { $nin: ['delivered', 'cancelled'] } },
            { $set: { status: 'dispatched' } }
          );
        }
      }
    } catch {
    }

    await delivery.save();

    try {
      const nextAssignedToUserId = delivery.assignedToUserId ? String(delivery.assignedToUserId) : '';
      const nextStatus = String(delivery.status || 'created');
      const supplierId = delivery.supplierId ? String(delivery.supplierId) : '';

      if (nextAssignedToUserId && nextAssignedToUserId !== prevAssignedToUserId) {
        await createNotification(
          { toUserId: nextAssignedToUserId },
          {
            type: 'delivery_assigned',
            title: 'New delivery assigned',
            message: 'A delivery has been assigned to you.',
            entityType: 'delivery',
            entityId: String(delivery._id),
            dedupeKey: `delivery_assigned_${String(delivery._id)}_${nextAssignedToUserId}`,
          }
        );

        await createNotification(
          { toRole: 'admin' },
          {
            type: 'delivery_assigned',
            title: 'Rider assigned',
            message: `Rider assigned for delivery #${String(delivery._id).slice(-6)}.`,
            entityType: 'delivery',
            entityId: String(delivery._id),
            dedupeKey: `delivery_assigned_admin_${String(delivery._id)}_${nextAssignedToUserId}`,
          }
        );

        await createNotification(
          { toRole: 'staff' },
          {
            type: 'delivery_assigned',
            title: 'Rider assigned',
            message: `Rider assigned for delivery #${String(delivery._id).slice(-6)}.`,
            entityType: 'delivery',
            entityId: String(delivery._id),
            dedupeKey: `delivery_assigned_staff_${String(delivery._id)}_${nextAssignedToUserId}`,
          }
        );

        if (supplierId) {
          await createNotification(
            { toSupplierId: supplierId },
            {
              type: 'delivery_assigned',
              title: 'Rider assigned',
              message: 'A rider has been assigned for your delivery.',
              entityType: 'delivery',
              entityId: String(delivery._id),
              dedupeKey: `delivery_assigned_supplier_${String(delivery._id)}_${nextAssignedToUserId}`,
            }
          );
        }
      }

      if (nextStatus === 'delivered' && prevStatus !== 'delivered') {
        await createNotification(
          { toRole: 'admin' },
          {
            type: 'delivery_delivered',
            title: 'Delivery delivered',
            message: `Delivery #${String(delivery._id).slice(-6)} has been delivered.`,
            entityType: 'delivery',
            entityId: String(delivery._id),
            dedupeKey: `delivery_delivered_admin_${String(delivery._id)}`,
          }
        );

        await createNotification(
          { toRole: 'staff' },
          {
            type: 'delivery_delivered',
            title: 'Delivery delivered',
            message: `Delivery #${String(delivery._id).slice(-6)} has been delivered.`,
            entityType: 'delivery',
            entityId: String(delivery._id),
            dedupeKey: `delivery_delivered_staff_${String(delivery._id)}`,
          }
        );

        if (supplierId) {
          await createNotification(
            { toSupplierId: supplierId },
            {
              type: 'delivery_delivered',
              title: 'Stock delivered',
              message: 'Your delivery has been delivered.',
              entityType: 'delivery',
              entityId: String(delivery._id),
              dedupeKey: `delivery_delivered_supplier_${String(delivery._id)}`,
            }
          );
        }

        if (nextAssignedToUserId) {
          await createNotification(
            { toUserId: nextAssignedToUserId },
            {
              type: 'delivery_delivered',
              title: 'Delivery completed',
              message: 'Delivery marked as delivered.',
              entityType: 'delivery',
              entityId: String(delivery._id),
              dedupeKey: `delivery_delivered_rider_${String(delivery._id)}_${nextAssignedToUserId}`,
            }
          );
        }
      }
    } catch {
    }

    const lean: any = await DeliveryModel.findById(String(id)).lean();
    return res.json({ ok: true, delivery: normalize(lean) });
  } catch (err: any) {
    res.status(400).json({ ok: false, error: err?.message || 'Failed to update delivery' });
  }
});

router.post('/:id/location', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const body = req.body || {};
    const lat = Number(body.lat);
    const lng = Number(body.lng);
    const at = body.at ? new Date(body.at) : new Date();
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return res.status(400).json({ ok: false, error: 'lat and lng are required' });
    }

    const delivery: any = await DeliveryModel.findById(String(id));
    if (!delivery) return res.status(404).json({ ok: false, error: 'Delivery not found' });

    const me = getAuthUser(req);
    if (!me) return res.status(401).json({ ok: false, error: 'Unauthorized' });
    if (me.role === 'rider') {
      if (String(delivery.assignedToUserId || '') !== String(me.userId)) {
        return res.status(403).json({ ok: false, error: 'Forbidden' });
      }
    } else if (me.role !== 'admin' && me.role !== 'staff') {
      return res.status(403).json({ ok: false, error: 'Forbidden' });
    }

    const point = { lat, lng, at: !Number.isNaN(at.getTime()) ? at : new Date() };
    delivery.lastLocation = point;
    delivery.locationHistory = Array.isArray(delivery.locationHistory) ? delivery.locationHistory.concat([point]).slice(-200) : [point];

    // If we get location updates, consider delivery started
    const curStatus = String(delivery.status || 'created');
    if (curStatus === 'assigned' || curStatus === 'created') {
      delivery.status = 'picked_up';
      if (!delivery.pickedUpAt) delivery.pickedUpAt = new Date();
    }

    try {
      const relatedOrderId = delivery.relatedOrderId ? String(delivery.relatedOrderId) : '';
      const dtype = String(delivery.type || '');
      if (relatedOrderId && dtype === 'admin_to_customer') {
        await OrderModel.updateOne(
          { _id: relatedOrderId, status: { $nin: ['delivered', 'cancelled'] } },
          { $set: { status: 'dispatched' } }
        );
      }
    } catch {
    }

    await delivery.save();
    const lean: any = await DeliveryModel.findById(String(id)).lean();
    return res.json({ ok: true, delivery: normalize(lean) });
  } catch (err: any) {
    res.status(400).json({ ok: false, error: err?.message || 'Failed to update location' });
  }
});

router.post('/:id/cash', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const body = req.body || {};
    const amount = Number(body.amount);
    if (!Number.isFinite(amount) || amount < 0) {
      return res.status(400).json({ ok: false, error: 'amount must be a number >= 0' });
    }

    const delivery: any = await DeliveryModel.findById(String(id));
    if (!delivery) return res.status(404).json({ ok: false, error: 'Delivery not found' });

    const me = getAuthUser(req);
    if (!me) return res.status(401).json({ ok: false, error: 'Unauthorized' });
    if (me.role === 'rider') {
      if (String(delivery.assignedToUserId || '') !== String(me.userId)) {
        return res.status(403).json({ ok: false, error: 'Forbidden' });
      }
    } else if (me.role !== 'admin' && me.role !== 'staff') {
      return res.status(403).json({ ok: false, error: 'Forbidden' });
    }

    const dtype = String(delivery.type || '');

    // If cash is collected from customer for an order, treat it as a customer payment
    if (dtype === 'admin_to_customer') {
      const orderId = delivery.relatedOrderId ? String(delivery.relatedOrderId) : '';
      const customerId = delivery.customerId ? String(delivery.customerId) : '';
      if (orderId && customerId) {
        const order: any = await OrderModel.findById(orderId);
        const customer: any = await CustomerModel.findById(customerId);
        if (order && customer) {
          let existingPay: any = null;
          let prevAmt = 0;
          if (delivery.cashCustomerPaymentId) {
            existingPay = await PaymentModel.findById(String(delivery.cashCustomerPaymentId));
          }
          if (existingPay) {
            prevAmt = Number(existingPay.amount || 0);
            existingPay.customerId = customer._id;
            existingPay.customerName = customer.name;
            existingPay.orderId = order._id;
            existingPay.amount = amount;
            existingPay.method = 'cash';
            existingPay.status = 'completed';
            existingPay.reference = existingPay.reference || `delivery:${String(id)}`;
            await existingPay.save();
          } else if (amount > 0) {
            existingPay = await PaymentModel.create({
              date: new Date(),
              customerId: customer._id,
              customerName: customer.name,
              orderId: order._id,
              amount,
              method: 'cash',
              reference: `delivery:${String(id)}`,
              status: 'completed',
            });
            delivery.cashCustomerPaymentId = existingPay._id;
          }

          const delta = Number(amount) - Number(prevAmt);
          if (delta !== 0) {
            customer.outstandingBalance = Math.max(0, Number(customer.outstandingBalance || 0) - delta);
            await customer.save();
          }

          const agg = await PaymentModel.aggregate([
            { $match: { orderId: order._id } },
            { $group: { _id: '$orderId', paid: { $sum: '$amount' } } },
          ]);
          const paid = Number(agg?.[0]?.paid || 0);
          if (paid >= Number(order.netAmount || 0)) order.paymentStatus = 'paid';
          else if (paid > 0) order.paymentStatus = 'partial';
          else order.paymentStatus = 'unpaid';
          await order.save();
        }
      }
    }

    // If cash is collected from admin for a supplier delivery, treat it as a supplier payment
    if (dtype === 'supplier_to_admin') {
      const supplierId = delivery.supplierId ? String(delivery.supplierId) : '';
      if (supplierId) {
        const supplier: any = await SupplierModel.findById(supplierId);
        if (supplier) {
          const purchaseId = delivery.relatedPurchaseId ? String(delivery.relatedPurchaseId) : '';
          const purchaseObjId = purchaseId ? new mongoose.Types.ObjectId(purchaseId) : undefined;
          let existingPay: any = null;
          if (delivery.cashSupplierPaymentId) {
            existingPay = await SupplierPaymentModel.findById(String(delivery.cashSupplierPaymentId));
          }

          if (purchaseId) {
            const purchase: any = await PurchaseModel.findById(purchaseId);
            if (purchase) {
              const paidAgg = await SupplierPaymentModel.aggregate([
                { $match: { purchaseId: purchase._id } },
                { $group: { _id: '$purchaseId', paid: { $sum: '$amount' } } },
              ]);
              const paidSoFar = Number(paidAgg?.[0]?.paid || 0);
              const already = existingPay ? Number(existingPay.amount || 0) : 0;
              const remaining = Math.max(0, Number(purchase.netAmount || 0) - (paidSoFar - already));
              if (amount > remaining) {
                return res.status(400).json({ ok: false, error: `Amount exceeds remaining balance. Remaining: ${remaining}` });
              }
            }
          }

          if (existingPay) {
            existingPay.supplierId = supplier._id;
            existingPay.supplierName = supplier.name;
            existingPay.purchaseId = purchaseObjId;
            existingPay.amount = amount;
            existingPay.method = 'cash';
            existingPay.status = 'completed';
            existingPay.reference = existingPay.reference || `delivery:${String(id)}`;
            await existingPay.save();
          } else if (amount > 0) {
            const payDoc = await SupplierPaymentModel.create({
              date: new Date(),
              supplierId: supplier._id,
              supplierName: supplier.name,
              purchaseId: purchaseObjId,
              amount,
              method: 'cash',
              reference: `delivery:${String(id)}`,
              status: 'completed',
            });
            delivery.cashSupplierPaymentId = payDoc._id;
          }
        }
      }
    }

    delivery.cashCollected = amount;
    await delivery.save();

    const lean: any = await DeliveryModel.findById(String(id)).lean();
    return res.json({ ok: true, delivery: normalize(lean) });
  } catch (err: any) {
    res.status(400).json({ ok: false, error: err?.message || 'Failed to update cash collection' });
  }
});

router.post('/:id/proof', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const body = req.body || {};
    const kind = String(body.kind || 'delivered');
    if (kind !== 'pickup' && kind !== 'delivered') {
      return res.status(400).json({ ok: false, error: 'kind must be pickup or delivered' });
    }

    const dataUrl = typeof body.dataUrl === 'string' ? body.dataUrl : '';
    const base64 = typeof body.base64 === 'string' ? body.base64 : '';
    const mime = typeof body.mime === 'string' ? body.mime : '';

    let payloadBase64 = base64;
    let payloadMime = mime;
    if (!payloadBase64 && dataUrl.startsWith('data:')) {
      const m = dataUrl.match(/^data:([^;]+);base64,(.*)$/);
      if (m) {
        payloadMime = m[1];
        payloadBase64 = m[2];
      }
    }

    if (!payloadBase64) {
      return res.status(400).json({ ok: false, error: 'base64 (or dataUrl) is required' });
    }

    const ext = payloadMime.includes('png') ? 'png' : payloadMime.includes('webp') ? 'webp' : 'jpg';

    const delivery: any = await DeliveryModel.findById(String(id));
    if (!delivery) return res.status(404).json({ ok: false, error: 'Delivery not found' });

    const me = getAuthUser(req);
    if (!me) return res.status(401).json({ ok: false, error: 'Unauthorized' });
    if (me.role === 'rider') {
      if (String(delivery.assignedToUserId || '') !== String(me.userId)) {
        return res.status(403).json({ ok: false, error: 'Forbidden' });
      }
    } else if (me.role !== 'admin' && me.role !== 'staff') {
      return res.status(403).json({ ok: false, error: 'Forbidden' });
    }

    const uploadsRoot = path.join(process.cwd(), 'uploads');
    const dir = path.join(uploadsRoot, 'deliveries', String(id));
    fs.mkdirSync(dir, { recursive: true });

    const filename = `${Date.now()}-${kind}.${ext}`;
    const filePath = path.join(dir, filename);
    fs.writeFileSync(filePath, Buffer.from(payloadBase64, 'base64'));

    const url = `/uploads/deliveries/${String(id)}/${filename}`;
    const proof = { kind, url, uploadedAt: new Date() };

    delivery.proofs = Array.isArray(delivery.proofs) ? delivery.proofs.concat([proof]) : [proof];
    await delivery.save();

    const lean: any = await DeliveryModel.findById(String(id)).lean();
    return res.json({ ok: true, delivery: normalize(lean) });
  } catch (err: any) {
    res.status(400).json({ ok: false, error: err?.message || 'Failed to upload proof' });
  }
});

export default router;
