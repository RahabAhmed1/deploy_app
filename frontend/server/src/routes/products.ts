import { Router, type Request, type Response } from 'express';
import { ProductModel } from '../models/Product.js';

const router = Router();

router.post('/', async (req: Request, res: Response) => {
  try {
    const body = req.body || {};
    const doc = await ProductModel.create({
      name: body.name,
      genericName: body.genericName,
      manufacturer: body.manufacturer,
      category: body.category,
      batchNo: body.batchNo,
      manufacturingDate: body.manufacturingDate ? new Date(body.manufacturingDate) : undefined,
      expiryDate: body.expiryDate ? new Date(body.expiryDate) : undefined,
      mrp: body.mrp ? Number(body.mrp) : undefined,
      purchasePrice: body.purchasePrice ? Number(body.purchasePrice) : undefined,
      stockQuantity: body.stockQuantity ? Number(body.stockQuantity) : undefined,
      minStockLevel: body.minStockLevel ? Number(body.minStockLevel) : undefined,
      unit: body.unit,
      gstRate: body.gstRate ? Number(body.gstRate) : undefined,
    });
    res.status(201).json({ ok: true, product: doc });
  } catch (err: any) {
    res.status(400).json({ ok: false, error: err?.message || 'Failed to create product' });
  }
});

export default router;
