import { Router, type Request, type Response } from 'express';
import { ProductModel } from '../models/Product';
import { SupplierModel } from '../models/Supplier';
import { ProductBatchModel } from '../models/ProductBatch';

const router = Router();

async function generateUniqueProductId(): Promise<string> {
  for (let i = 0; i < 5; i++) {
    const d = new Date();
    const yyyymmdd = d.toISOString().slice(0, 10).replace(/-/g, '');
    const rand = Math.random().toString(36).toUpperCase().slice(2, 6);
    const id = `PRD-${yyyymmdd}-${rand}`;
    const exists = await ProductModel.exists({ productId: id });
    if (!exists) return id;
  }
  return `PRD-${Date.now()}`;
}

// Create a new product
router.post('/', async (req: Request, res: Response) => {
  try {
    const body = req.body || {};
    if (body.stockQuantity !== undefined && Number(body.stockQuantity) < 0) {
      return res.status(400).json({ ok: false, error: 'stockQuantity cannot be negative' });
    }
    if (body.minStockLevel !== undefined && Number(body.minStockLevel) < 0) {
      return res.status(400).json({ ok: false, error: 'minStockLevel cannot be negative' });
    }
    // Resolve supplier name if supplierId is provided
    let supplierId: string | undefined = undefined;
    let supplierName: string | undefined = undefined;
    if (body.supplierId) {
      const supp: any = await SupplierModel.findById(String(body.supplierId)).lean();
      if (!supp) return res.status(400).json({ ok: false, error: 'Invalid supplierId' });
      supplierId = String(supp._id);
      supplierName = supp.name;
    } else if (body.supplierName) {
      supplierName = String(body.supplierName);
    }

    const doc = await ProductModel.create({
      productId: body.productId ? String(body.productId) : await generateUniqueProductId(),
      barcode: body.barcode ? String(body.barcode) : undefined,
      name: body.name,
      genericName: body.genericName,
      manufacturer: body.manufacturer,
      supplierId: supplierId,
      supplierName: supplierName,
      category: body.category,
      unitsPerPack: body.unitsPerPack !== undefined && body.unitsPerPack !== '' ? Number(body.unitsPerPack) : undefined,
      unitsPerStrip: body.unitsPerStrip !== undefined && body.unitsPerStrip !== '' ? Number(body.unitsPerStrip) : undefined,
      stripPrice: body.stripPrice !== undefined && body.stripPrice !== '' ? Number(body.stripPrice) : undefined,
      batchNo: body.batchNo,
      manufacturingDate: body.manufacturingDate ? new Date(body.manufacturingDate) : undefined,
      expiryDate: body.expiryDate ? new Date(body.expiryDate) : undefined,
      mrp: body.mrp ? Number(body.mrp) : undefined,
      packMrp: body.packMrp !== undefined && body.packMrp !== '' ? Number(body.packMrp) : undefined,
      purchasePrice: body.purchasePrice ? Number(body.purchasePrice) : undefined,
      stockQuantity: body.stockQuantity !== undefined && body.stockQuantity !== '' ? Number(body.stockQuantity) : undefined,
      minStockLevel: body.minStockLevel !== undefined && body.minStockLevel !== '' ? Number(body.minStockLevel) : undefined,
      unit: body.unit,
      gstRate: body.gstRate ? Number(body.gstRate) : undefined,
    });
    // Ensure a corresponding ProductBatch exists for initial product batch/stock
    try {
      if (doc && doc.batchNo) {
        const existing = await ProductBatchModel.findOne({ productId: (doc as any)._id, batchNo: String((doc as any).batchNo) });
        if (existing) {
          if ((doc as any).manufacturingDate) existing.manufacturingDate = (doc as any).manufacturingDate as any;
          if ((doc as any).expiryDate) existing.expiryDate = (doc as any).expiryDate as any;
          if (typeof (doc as any).purchasePrice === 'number') existing.purchasePrice = Number((doc as any).purchasePrice);
          if (typeof (doc as any).stockQuantity === 'number') existing.stockQuantity = Number((doc as any).stockQuantity);
          await existing.save();
        } else {
          await ProductBatchModel.create({
            productId: (doc as any)._id,
            batchNo: String((doc as any).batchNo),
            manufacturingDate: (doc as any).manufacturingDate ? new Date((doc as any).manufacturingDate) : undefined,
            expiryDate: (doc as any).expiryDate ? new Date((doc as any).expiryDate) : undefined,
            purchasePrice: typeof (doc as any).purchasePrice === 'number' ? Number((doc as any).purchasePrice) : undefined,
            stockQuantity: typeof (doc as any).stockQuantity === 'number' ? Number((doc as any).stockQuantity) : 0,
          });
        }
      }
    } catch {}
    res.status(201).json({ ok: true, product: doc });
  } catch (err: any) {
    res.status(400).json({ ok: false, error: err?.message || 'Failed to create product' });
  }
});

// List products
router.get('/', async (_req: Request, res: Response) => {
  try {
    const docs = await ProductModel.find().sort({ createdAt: -1 }).lean();
    const ids = docs.map((d: any) => d._id);
    const latestBatches = await ProductBatchModel.aggregate([
      { $match: { productId: { $in: ids } } },
      { $sort: { createdAt: -1 } },
      {
        $group: {
          _id: '$productId',
          batchNo: { $first: '$batchNo' },
          expiryDate: { $first: '$expiryDate' },
        },
      },
    ]);
    const batchByProduct = new Map<string, { batchNo: string; expiryDate?: string }>();
    for (const b of latestBatches) {
      batchByProduct.set(String(b._id), {
        batchNo: b?.batchNo ? String(b.batchNo) : '',
        expiryDate: b?.expiryDate ? new Date(b.expiryDate).toISOString().slice(0, 10) : '',
      });
    }
    const products = docs.map((d: any) => {
      const expiry = d.expiryDate ? new Date(d.expiryDate) : undefined;
      const mfg = d.manufacturingDate ? new Date(d.manufacturingDate) : undefined;
      const yyyyMmDd = (dt?: Date) => (dt ? dt.toISOString().slice(0, 10) : '');
      const lb = batchByProduct.get(String(d._id));
      return {
        id: String(d._id),
        productId: d.productId || '',
        barcode: d.barcode || '',
        name: d.name || '',
        genericName: d.genericName || '',
        manufacturer: d.manufacturer || '',
        supplierId: d.supplierId ? String(d.supplierId) : '',
        supplierName: d.supplierName || '',
        category: d.category || '',
        unitsPerPack: typeof (d as any).unitsPerPack === 'number' ? (d as any).unitsPerPack : 0,
        unitsPerStrip: typeof (d as any).unitsPerStrip === 'number' ? (d as any).unitsPerStrip : 0,
        stripPrice: typeof (d as any).stripPrice === 'number' ? (d as any).stripPrice : 0,
        batchNo: d.batchNo || '',
        latestBatchNo: lb?.batchNo || '',
        latestBatchExpiry: lb?.expiryDate || '',
        expiryDate: yyyyMmDd(expiry),
        manufacturingDate: yyyyMmDd(mfg),
        mrp: typeof d.mrp === 'number' ? d.mrp : 0,
        packMrp: typeof (d as any).packMrp === 'number' ? (d as any).packMrp : 0,
        purchasePrice: typeof d.purchasePrice === 'number' ? d.purchasePrice : 0,
        stockQuantity: typeof d.stockQuantity === 'number' ? d.stockQuantity : 0,
        minStockLevel: typeof d.minStockLevel === 'number' ? d.minStockLevel : 0,
        unit: d.unit || '',
        gstRate: typeof d.gstRate === 'number' ? d.gstRate : 0,
      };
    });
    res.json({ ok: true, products });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err?.message || 'Failed to fetch products' });
  }
});

// Update a product
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const body = req.body || {};
    if (body.stockQuantity !== undefined && body.stockQuantity !== '' && Number(body.stockQuantity) < 0) {
      return res.status(400).json({ ok: false, error: 'stockQuantity cannot be negative' });
    }
    if (body.minStockLevel !== undefined && body.minStockLevel !== '' && Number(body.minStockLevel) < 0) {
      return res.status(400).json({ ok: false, error: 'minStockLevel cannot be negative' });
    }
    // Resolve supplier if provided
    let supplierId: string | undefined = undefined;
    let supplierName: string | undefined = undefined;
    if (body.supplierId) {
      const supp: any = await SupplierModel.findById(String(body.supplierId)).lean();
      if (!supp) return res.status(400).json({ ok: false, error: 'Invalid supplierId' });
      supplierId = String(supp._id);
      supplierName = supp.name;
    } else if (body.supplierName !== undefined) {
      supplierName = body.supplierName ? String(body.supplierName) : undefined;
    }

    const update: any = {
      name: body.name,
      genericName: body.genericName,
      manufacturer: body.manufacturer,
      category: body.category,
      batchNo: body.batchNo,
      unit: body.unit,
    };
    if (body.barcode !== undefined) update.barcode = body.barcode ? String(body.barcode) : undefined;
    if (supplierId !== undefined) update.supplierId = supplierId;
    if (supplierName !== undefined) update.supplierName = supplierName;
    if (body.manufacturingDate !== undefined) update.manufacturingDate = body.manufacturingDate ? new Date(body.manufacturingDate) : undefined;
    if (body.expiryDate !== undefined) update.expiryDate = body.expiryDate ? new Date(body.expiryDate) : undefined;
    if (body.mrp !== undefined) update.mrp = body.mrp !== '' ? Number(body.mrp) : undefined;
    if (body.packMrp !== undefined) update.packMrp = body.packMrp !== '' ? Number(body.packMrp) : undefined;
    if (body.purchasePrice !== undefined) update.purchasePrice = body.purchasePrice !== '' ? Number(body.purchasePrice) : undefined;
    if (body.stockQuantity !== undefined) update.stockQuantity = body.stockQuantity !== '' ? Number(body.stockQuantity) : undefined;
    if (body.minStockLevel !== undefined) update.minStockLevel = body.minStockLevel !== '' ? Number(body.minStockLevel) : undefined;
    if (body.gstRate !== undefined) update.gstRate = body.gstRate !== '' ? Number(body.gstRate) : undefined;
    if (body.unitsPerPack !== undefined) update.unitsPerPack = body.unitsPerPack !== '' ? Number(body.unitsPerPack) : undefined;
    if (body.unitsPerStrip !== undefined) update.unitsPerStrip = body.unitsPerStrip !== '' ? Number(body.unitsPerStrip) : undefined;
    if (body.stripPrice !== undefined) update.stripPrice = body.stripPrice !== '' ? Number(body.stripPrice) : undefined;

    const doc = await ProductModel.findByIdAndUpdate(id, update, { new: true });
    if (!doc) return res.status(404).json({ ok: false, error: 'Product not found' });
    // Keep a batch record in sync with product's batch/stock for compatibility
    try {
      if ((doc as any).batchNo) {
        const existing = await ProductBatchModel.findOne({ productId: (doc as any)._id, batchNo: String((doc as any).batchNo) });
        if (existing) {
          if ((doc as any).manufacturingDate !== undefined) existing.manufacturingDate = (doc as any).manufacturingDate ? new Date((doc as any).manufacturingDate) : undefined as any;
          if ((doc as any).expiryDate !== undefined) existing.expiryDate = (doc as any).expiryDate ? new Date((doc as any).expiryDate) : undefined as any;
          if ((doc as any).purchasePrice !== undefined) existing.purchasePrice = (doc as any).purchasePrice !== '' ? Number((doc as any).purchasePrice) : undefined;
          if ((doc as any).stockQuantity !== undefined) existing.stockQuantity = (doc as any).stockQuantity !== '' ? Number((doc as any).stockQuantity) : existing.stockQuantity;
          await existing.save();
        } else {
          await ProductBatchModel.create({
            productId: (doc as any)._id,
            batchNo: String((doc as any).batchNo),
            manufacturingDate: (doc as any).manufacturingDate ? new Date((doc as any).manufacturingDate) : undefined,
            expiryDate: (doc as any).expiryDate ? new Date((doc as any).expiryDate) : undefined,
            purchasePrice: (doc as any).purchasePrice !== undefined && (doc as any).purchasePrice !== '' ? Number((doc as any).purchasePrice) : undefined,
            stockQuantity: (doc as any).stockQuantity !== undefined && (doc as any).stockQuantity !== '' ? Number((doc as any).stockQuantity) : 0,
          });
        }
      }
    } catch {}
    res.json({ ok: true, product: doc });
  } catch (err: any) {
    res.status(400).json({ ok: false, error: err?.message || 'Failed to update product' });
  }
});

// Delete a product
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await ProductModel.findByIdAndDelete(id);
    if (!result) return res.status(404).json({ ok: false, error: 'Product not found' });
    res.json({ ok: true });
  } catch (err: any) {
    res.status(400).json({ ok: false, error: err?.message || 'Failed to delete product' });
  }
});

export default router;
