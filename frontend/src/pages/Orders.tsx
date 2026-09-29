import { useEffect, useMemo, useRef, useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { DateField } from "@/components/ui/date-field";
import { getOrders, createOrder, updateOrderStatus, updateOrder, deleteOrder, convertOrderEstimateToSale, getCustomers, getProducts, getCompanyInfo, getProductBatches, getInvoices } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { formatCurrency } from "@/lib/currency";
import { Plus, Search, Filter, Download, Eye, CheckCircle, Truck, X, Printer, Trash2, ShoppingCart, Pencil, FileText } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { toast } from "sonner";
import { openInvoicePdfPreview } from "@/lib/invoicePdf";

const statusStyles = {
  hold: "bg-muted text-muted-foreground border-muted/20",
  pending: "bg-chart-4/10 text-chart-4 border-chart-4/20",
  approved: "bg-chart-1/10 text-chart-1 border-chart-1/20",
  dispatched: "bg-chart-3/10 text-chart-3 border-chart-3/20",
  delivered: "bg-primary/10 text-primary border-primary/20",
  cancelled: "bg-destructive/10 text-destructive border-destructive/20",
};

const paymentStyles = {
  unpaid: "bg-destructive/10 text-destructive border-destructive/20",
  partial: "bg-chart-4/10 text-chart-4 border-chart-4/20",
  paid: "bg-primary/10 text-primary border-primary/20",
};

type Order = {
  id: string;
  orderNo: string;
  customerId: string;
  customerName: string;
  customerType: string;
  docType?: "sale" | "estimate";
  deferredPosting?: boolean;
  accountsPosted?: boolean;
  salesmanCode?: string;
  salesmanName?: string;
  orderDate: string;
  deliveryDate: string | null;
  totalAmount: number;
  discountAmount: number;
  taxAmount: number;
  netAmount: number;
  status: "hold" | "pending" | "approved" | "dispatched" | "delivered" | "cancelled";
  paymentStatus: "unpaid" | "partial" | "paid";
  items: Array<{ productId: string; productName: string; batchId?: string; batchNo: string; quantity: number; unitPrice: number; discount: number; tax: number; total: number; }>;
};

type Customer = { id: string; customerNo?: string; name: string; type: string; contactPerson?: string; phone?: string; email?: string; address?: string; city?: string; state?: string; gstNo?: string; drugLicenseNo?: string };
type Product = { id: string; name: string; barcode?: string; batchNo: string; purchasePrice: number; stockQuantity: number; unitsPerPack?: number };

const Orders = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [paymentFilter, setPaymentFilter] = useState("all");
  const [salesmanFilter, setSalesmanFilter] = useState("all");
  const [orders, setOrders] = useState<Order[]>([]);
  const [company, setCompany] = useState<any>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingDocType, setEditingDocType] = useState<'sale' | 'estimate'>('sale');
  const [orderForm, setOrderForm] = useState({
    customerId: "",
    orderDate: new Date().toISOString().split('T')[0],
    items: [] as Array<{ productId: string; batchId?: string; quantity: string; unitPrice: string; discount: string; tax: string }>,
    newItem: { productId: "", batchId: "", quantity: "", unitPrice: "", discount: "", tax: "", saleUnit: "unit", unitsPerPack: "" },
  });
  const [productPickerOpen, setProductPickerOpen] = useState(false);
  const [bulkDiscount, setBulkDiscount] = useState("");
  const [bulkTax, setBulkTax] = useState("");
  const [customerPickerOpen, setCustomerPickerOpen] = useState(false);
  const [customerQuery, setCustomerQuery] = useState("");
  const [productQuery, setProductQuery] = useState("");
  const [batchPickerOpen, setBatchPickerOpen] = useState(false);
  const [batchQuery, setBatchQuery] = useState("");
  const [productBatches, setProductBatches] = useState<Array<{ id: string; batchNo: string; purchasePrice: number; stockQuantity: number; expiryDate?: string }>>([]);
  const [scanCode, setScanCode] = useState("");
  // Refs for keyboard navigation
  const productInputRef = useRef<HTMLInputElement | null>(null);
  const batchInputRef = useRef<HTMLInputElement | null>(null);
  const unitsPerPackInputRef = useRef<HTMLInputElement | null>(null);
  const quantityInputRef = useRef<HTMLInputElement | null>(null);
  const discountInputRef = useRef<HTMLInputElement | null>(null);
  const bulkDiscountRef = useRef<HTMLInputElement | null>(null);
  const bulkTaxRef = useRef<HTMLInputElement | null>(null);

  const [viewOpen, setViewOpen] = useState(false);
  const [viewOrder, setViewOrder] = useState<Order | null>(null);

  const totals = useMemo(() => {
    const acc = { subtotal: 0, tax: 0, total: 0 };
    for (const it of orderForm.items) {
      const qty = Number(it.quantity) || 0;
      const price = Number(it.unitPrice) || 0;
      const disc = Number(it.discount) || 0;
      const tx = Number(it.tax) || 0;
      const lineBase = qty * price;
      const lineDiscount = lineBase * (disc / 100);
      const baseAfterDiscount = lineBase - lineDiscount;
      const lineTax = baseAfterDiscount * (tx / 100);
      acc.subtotal += lineBase;
      acc.tax += lineTax;
      acc.total += baseAfterDiscount + lineTax;
    }
    return acc;
  }, [orderForm.items]);

  const loadData = async () => {
    const [oRes, cRes, pRes] = await Promise.all([getOrders(), getCustomers(), getProducts()]);
    setOrders((oRes?.orders || []) as Order[]);
    setCustomers((cRes?.customers || []).map((c: any) => ({
      id: String(c.id),
      customerNo: c.customerNo,
      name: c.name,
      type: c.type,
      contactPerson: c.contactPerson,
      phone: c.phone,
      email: c.email,
      address: c.address,
      city: c.city,
      state: c.state,
      gstNo: c.gstNo,
      drugLicenseNo: c.drugLicenseNo,
    })));
    setProducts((pRes?.products || []).map((p: any) => ({ id: String(p.id), name: p.name, barcode: p.barcode || '', batchNo: p.batchNo, purchasePrice: typeof p.purchasePrice === 'number' ? p.purchasePrice : Number(p.purchasePrice || 0), stockQuantity: typeof p.stockQuantity === 'number' ? p.stockQuantity : Number(p.stockQuantity || 0), unitsPerPack: Number((p.unitsPerPack ?? p.unitsPerStrip ?? 0)) || 0 })));
  };

  useEffect(() => { loadData(); }, []);
  useEffect(() => {
    (async () => {
      try { const res = await getCompanyInfo(); setCompany(res?.company || null); } catch {}
    })();
  }, []);

  // Load batches whenever a product is selected for the new line
  useEffect(() => {
    const pid = orderForm.newItem.productId;
    if (!pid) { setProductBatches([]); return; }
    (async () => {
      try {
        const res = await getProductBatches({ productId: pid });
        const list = (res?.batches || []).map((b: any) => ({
          id: String(b.id || b._id || ""),
          batchNo: b.batchNo,
          purchasePrice: typeof b.purchasePrice === 'number' ? b.purchasePrice : Number(b.purchasePrice || 0),
          stockQuantity: typeof b.stockQuantity === 'number' ? b.stockQuantity : Number(b.stockQuantity || 0),
          expiryDate: b.expiryDate,
        }));
        setProductBatches(list);
      } catch {}
    })();
  }, [orderForm.newItem.productId]);

  const addItem = () => {
    const ni = orderForm.newItem as any;
    const prod = products.find(p => p.id === ni.productId);
    const qtyInput = Number(ni.quantity) || 0;
    const defaultUP = Math.max(1, Number(prod?.unitsPerPack || 0) || 1);
    const up = Math.max(1, Number(ni.unitsPerPack || defaultUP) || 1);
    const baseQty = (ni.saleUnit === 'pack') ? (qtyInput * up) : qtyInput;
    if (!ni.productId || baseQty <= 0) return;
    if (!ni.batchId) { toast.error("Please select a batch"); return; }
    const existingQty = orderForm.items.filter(i => i.productId === ni.productId && i.batchId === ni.batchId).reduce((s, i) => s + (Number(i.quantity) || 0), 0);
    const selBatch = productBatches.find(b => b.id === ni.batchId);
    const available = selBatch ? Number(selBatch.stockQuantity || 0) : (prod ? Number(prod.stockQuantity || 0) : 0);
    const requested = baseQty + existingQty;
    if (requested > available) {
      toast.error(`Insufficient stock for ${prod?.name || 'product'}. Available: ${available}, requested: ${requested}`);
      return;
    }
    const defPrice = String((products.find(p => p.id === ni.productId) as any)?.mrp || products.find(p => p.id === ni.productId)?.purchasePrice || 0);
    const disc = ni.discount !== "" ? ni.discount : (bulkDiscount !== "" ? bulkDiscount : "0");
    const tx = ni.tax !== "" ? ni.tax : (bulkTax !== "" ? bulkTax : "0");
    setOrderForm((s) => ({
      ...s,
      items: [...s.items, { productId: ni.productId, batchId: ni.batchId || undefined, quantity: String(baseQty), unitPrice: ni.unitPrice || defPrice, discount: disc, tax: tx }],
      newItem: { productId: "", batchId: "", quantity: "", unitPrice: "", discount: "", tax: "", saleUnit: "unit", unitsPerPack: "" },
    }));
  };

  // Quickly add item by scanning a barcode. Chooses earliest-expiry batch with stock; increments quantity if already present.
  const addScannedProduct = async (code: string) => {
    const trimmed = (code || '').trim();
    if (!trimmed) return;
    const prod = products.find((p) => (p.barcode || '') === trimmed);
    if (!prod) { toast.error('Product not found for scanned barcode'); setScanCode(''); return; }
    try {
      const res = await getProductBatches({ productId: prod.id });
      const list = (res?.batches || []).map((b: any) => ({
        id: String(b.id || b._id || ''),
        batchNo: b.batchNo,
        purchasePrice: typeof b.purchasePrice === 'number' ? b.purchasePrice : Number(b.purchasePrice || 0),
        stockQuantity: typeof b.stockQuantity === 'number' ? b.stockQuantity : Number(b.stockQuantity || 0),
        expiryDate: b.expiryDate as string | undefined,
      }));
      if (!list.length) { toast.error('No batches available for this product'); setScanCode(''); return; }
      const available = list.filter((b) => Number(b.stockQuantity || 0) > 0);
      const arr = (available.length ? available : list).slice().sort((a, b) => (a.expiryDate || '9999-12-31').localeCompare(b.expiryDate || '9999-12-31'));
      const chosen = arr[0];
      const existingIndex = orderForm.items.findIndex((it) => it.productId === prod.id && it.batchId === chosen.id);
      if (existingIndex >= 0) {
        const currentQty = Number(orderForm.items[existingIndex].quantity) || 0;
        const newQty = currentQty + 1;
        if (newQty > Number(chosen.stockQuantity || 0)) { toast.error('Insufficient stock for scanned item'); setScanCode(''); return; }
        setOrderForm((s) => ({
          ...s,
          items: s.items.map((it, idx) => idx === existingIndex ? { ...it, quantity: String(newQty) } : it)
        }));
      } else {
        if (Number(chosen.stockQuantity || 0) <= 0) { toast.error('Batch out of stock'); setScanCode(''); return; }
        const defDisc = orderForm.newItem.discount !== '' ? orderForm.newItem.discount : (bulkDiscount !== '' ? bulkDiscount : '0');
        const defTax = orderForm.newItem.tax !== '' ? orderForm.newItem.tax : (bulkTax !== '' ? bulkTax : '0');
        setOrderForm((s) => ({
          ...s,
          items: [...s.items, { productId: prod.id, batchId: chosen.id, quantity: '1', unitPrice: String((prod as any).mrp || chosen.purchasePrice || prod.purchasePrice || 0), discount: defDisc, tax: defTax }],
        }));
      }
    } catch {
      toast.error('Failed to fetch batches for scanned product');
    } finally {
      setScanCode('');
    }
  };

  // Auto-apply bulk discount and tax to all existing items whenever these values change
  useEffect(() => {
    setOrderForm((s) => ({
      ...s,
      items: s.items.map((it) => ({
        ...it,
        discount: bulkDiscount !== "" ? bulkDiscount : "0",
        tax: bulkTax !== "" ? bulkTax : "0",
      })),
    }));
  }, [bulkDiscount, bulkTax]);

  const openEdit = (o: Order) => {
    setEditingId(o.id);
    setEditingDocType((o.docType || 'sale') as any);
    setOrderForm({
      customerId: o.customerId,
      orderDate: o.orderDate || new Date().toISOString().split('T')[0],
      items: (o.items || []).map((it: any) => ({
        productId: String(it.productId || ''),
        batchId: it.batchId ? String(it.batchId) : (it.batchNo ? '' : ''),
        quantity: String(it.quantity || 0),
        unitPrice: String(it.unitPrice || 0),
        discount: String(it.discount || 0),
        tax: String(it.tax || 0),
      })),
      newItem: { productId: "", batchId: "", quantity: "", unitPrice: "", discount: "", tax: "", saleUnit: "unit", unitsPerPack: "" },
    });
    setDialogOpen(true);
  };

  const resetDialog = () => {
    setDialogOpen(false);
    setEditingId(null);
    setEditingDocType('sale');
    setOrderForm({ customerId: "", orderDate: new Date().toISOString().split('T')[0], items: [], newItem: { productId: "", batchId: "", quantity: "", unitPrice: "", discount: "", tax: "", saleUnit: "unit", unitsPerPack: "" } });
  };

  const handleSubmitOrder = async (opts?: { status?: 'hold' | 'pending'; docType?: 'sale' | 'estimate' }) => {
    if (saving) return;
    if (!orderForm.customerId || orderForm.items.length === 0) return;

    const nextDocType = (opts?.docType || editingDocType || 'sale') as 'sale' | 'estimate';
    const nextStatus = (opts?.status || (editingId ? 'hold' : 'pending')) as 'hold' | 'pending';
    const isDeferred = nextStatus === 'hold' || nextDocType === 'estimate';

    const requestedByProduct = new Map<string, number>();
    for (const it of orderForm.items) {
      const qty = Number(it.quantity) || 0;
      if (qty <= 0) {
        toast.error("Quantity must be greater than 0");
        return;
      }
      requestedByProduct.set(it.productId, (requestedByProduct.get(it.productId) || 0) + qty);
    }
    if (!isDeferred && nextDocType === 'sale') {
      for (const [pid, qty] of requestedByProduct) {
        const p = products.find(pp => pp.id === pid);
        const available = Number(p?.stockQuantity || 0);
        if (qty > available) {
          toast.error(`Insufficient stock for ${p?.name || 'product'}. Available: ${available}, requested: ${qty}`);
          return;
        }
      }
    }
    setSaving(true);
    try {
      const payload = {
        customerId: orderForm.customerId,
        orderDate: orderForm.orderDate,
        status: nextStatus,
        docType: nextDocType,
        salesmanId: getCurrentUser()?.id || undefined,
        salesmanName: getCurrentUser()?.username || undefined,
        salesmanCode: getCurrentUser()?.staffCode || undefined,
        items: orderForm.items.map(it => ({
          productId: it.productId,
          batchId: it.batchId,
          quantity: Number(it.quantity) || 0,
          unitPrice: Number(it.unitPrice) || 0,
          discount: Number(it.discount) || 0,
          tax: Number(it.tax) || 0,
        })),
      };
      if (editingId) {
        await updateOrder(editingId, payload);
        toast.success("Order updated");
      } else {
        const created = await createOrder(payload);
        if (nextStatus === 'hold' || nextDocType === 'estimate') {
          toast.success(nextDocType === 'estimate' ? 'Estimate saved on hold' : 'Order saved on hold');
        } else {
          toast.success('Order created');
          try {
            const createdId = String(created?.order?.id || created?.order?._id || "");
            const createdNo = String(created?.order?.orderNo || "");
            const oRes = await getOrders();
            const list = (oRes?.orders || []) as Order[];
            const found = list.find(o => (createdId && o.id === createdId) || (!!createdNo && o.orderNo === createdNo));
            if (found) {
              try {
                if (typeof window !== 'undefined' && (window as any).pharmaflow) {
                  printThermal(found);
                } else {
                  printOrder(found);
                }
              } catch {
                printOrder(found);
              }
            }
          } catch {}
        }
      }
      resetDialog();
      await loadData();
    } catch (e: any) {
      const msg = e?.message || 'Failed to create order';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const onChangeStatus = async (id: string, status: Order["status"]) => {
    try {
      await updateOrderStatus(id, status);
      await loadData();
    } catch (e: any) {
      const msg = e?.message || 'Failed to update status';
      toast.error(msg);
    }
  };

  const onDeleteOrder = async (id: string) => {
    try {
      await deleteOrder(id);
      toast.success('Deleted');
      await loadData();
    } catch (e: any) {
      toast.error(typeof e?.message === 'string' ? e.message : 'Failed to delete');
    }
  };

  const onConvertEstimate = async (id: string) => {
    try {
      await convertOrderEstimateToSale(id);
      toast.success('Converted to sale (on hold)');
      await loadData();
    } catch (e: any) {
      toast.error(typeof e?.message === 'string' ? e.message : 'Failed to convert');
    }
  };

  const openView = (o: Order) => {
    setViewOrder(o);
    setViewOpen(true);
  };

  const buildA4InvoiceHtml = (order: Order) => {
    const headerName = (company?.companyName || "PharmaFlow Pro");
    const addressLine = [company?.address, company?.city, company?.state, company?.pinCode].filter(Boolean).join(", ");
    const idLine = [company?.gstNo ? `GST: ${company.gstNo}` : "", company?.drugLicenseNo ? `DL: ${company.drugLicenseNo}` : "", company?.fssaiLicense ? `FSSAI: ${company.fssaiLicense}` : ""].filter(Boolean).join(" | ");
    const contactLine = [company?.phone ? `Ph: ${company.phone}` : "", company?.email || ""].filter(Boolean).join(" • ");
    const itemsRows = order.items
      .map(
        (it) => `
          <tr>
            <td class="right">${it.quantity}</td>
            <td>${it.productName || ''}</td>
            <td class="center">${it.batchNo || '-'}</td>
            <td class="right">${Number(it.tax || 0).toFixed(0)}%</td>
            <td class="right">${Number(it.unitPrice || 0).toFixed(2)}</td>
            <td class="right">${Number(it.discount || 0).toFixed(0)}%</td>
            <td class="right">${Number(it.total || 0).toFixed(2)}</td>
          </tr>
        `
      )
      .join("");
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>${order.orderNo}</title>
      <link rel="preconnect" href="https://fonts.googleapis.com">
      <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
      <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap" rel="stylesheet">
      <style>
      @page { size: A4; margin: 12mm; }
      * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      body { margin: 0; font-family: 'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Helvetica Neue', Arial, 'Noto Sans', sans-serif; color: #0f172a; }
      .container { width: 100%; }
      .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 1px solid #cbd5e1; padding-bottom: 8px; margin-bottom: 12px; }
      .company { max-width: 65%; }
      .title { font-size: 22px; font-weight: 700; letter-spacing: 0.3px; }
      .muted { color: #475569; font-size: 12px; }
      .invoice-meta { text-align: right; }
      .meta { font-size: 12px; margin: 2px 0; }
      .section { margin-top: 12px; }
      table { width: 100%; border-collapse: collapse; }
      thead th { font-size: 12px; background: #f8fafc; color: #0f172a; }
      th, td { padding: 8px; border: 1px solid #e2e8f0; vertical-align: top; font-size: 12px; }
      .right { text-align: right; }
      .center { text-align: center; }
      .totals { width: 45%; margin-left: auto; }
      .totals td { border: none; }
      .totals .row { display: flex; justify-content: space-between; font-size: 14px; margin: 4px 0; }
      .totals .grand { font-weight: 800; font-size: 16px; border-top: 2px solid #0f172a; padding-top: 8px; margin-top: 6px; }
      .footer { margin-top: 24px; text-align: center; font-size: 12px; color: #64748b; }
      .badge { display: inline-block; padding: 2px 8px; border-radius: 9999px; border: 1px solid #e2e8f0; font-size: 11px; color: #0f172a; }
      </style>
    </head>
    <body onload="window.print(); setTimeout(()=>window.close(), 300);">
      <div class="container">
        <div class="header">
          <div class="company">
            <div class="title">${headerName}</div>
            ${addressLine ? `<div class="muted">${addressLine}</div>` : ''}
            ${idLine ? `<div class="muted">${idLine}</div>` : ''}
            ${contactLine ? `<div class="muted">${contactLine}</div>` : ''}
            <div style="margin-top:8px">
              <div class="meta"><strong>Customer:</strong> ${order.customerName}</div>
              ${order.customerType ? `<div class="muted">Type: ${order.customerType}</div>` : ''}
            </div>
          </div>
          <div class="invoice-meta">
            <div class="meta" style="font-size:16px; font-weight:700;">INVOICE</div>
            <div class="meta">Order No: <strong>${order.orderNo}</strong></div>
            <div class="meta">Date: ${order.orderDate}</div>
          </div>
        </div>

        <div class="section">
          <table>
            <thead>
              <tr>
                <th class="right" style="width:6%">Qty</th>
                <th style="width:46%">Product Name</th>
                <th class="center" style="width:12%">Batch No</th>
                <th class="right" style="width:8%">Tax %</th>
                <th class="right" style="width:10%">Rate</th>
                <th class="right" style="width:8%">Disc %</th>
                <th class="right" style="width:10%">Net Amount</th>
              </tr>
            </thead>
            <tbody>
              ${itemsRows}
            </tbody>
          </table>
        </div>

        <div class="section totals">
          <div class="row"><span>Sub Total</span><span>Rs ${Number(order.totalAmount || 0).toFixed(2)}</span></div>
          <div class="row"><span>Tax</span><span>Rs ${Number(order.taxAmount || 0).toFixed(2)}</span></div>
          <div class="row grand"><span>Grand Total</span><span>Rs ${Number(order.netAmount || 0).toFixed(2)}</span></div>
        </div>

        <div class="footer">Thank you for your business</div>
      </div>
    </body></html>`;
    return html;
  };

  const buildThermalReceiptHtml = (order: Order) => {
    const headerName = (company?.companyName || "PharmaFlow Pro");
    const addressLine = [company?.address, company?.city, company?.state, company?.pinCode].filter(Boolean).join(", ");
    const idLine = [company?.gstNo ? `GST: ${company.gstNo}` : "", company?.drugLicenseNo ? `DL: ${company.drugLicenseNo}` : "", company?.fssaiLicense ? `FSSAI: ${company.fssaiLicense}` : ""].filter(Boolean).join(" | ");
    const contactLine = [company?.phone ? `Ph: ${company.phone}` : "", company?.email || ""].filter(Boolean).join(" • ");
    const itemsRows = order.items
      .map(
        (it) => `
        <div class="row small">
          <span>${it.productName}</span>
          <span class="mono">${it.quantity} x ${Number(it.unitPrice || 0).toFixed(2)}</span>
          <span class="mono">${Number(it.total || 0).toFixed(2)}</span>
        </div>
      `
      )
      .join("");
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>${order.orderNo}</title>
      <link rel="preconnect" href="https://fonts.googleapis.com">
      <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
      <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap" rel="stylesheet">
      <style>
      @page { size: 80mm auto; margin: 2mm; }
      * { font-family: 'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Helvetica Neue', Arial, 'Noto Sans', sans-serif; }
      body { width: 80mm; margin: 0; }
      .receipt { padding: 4px; font-size: 12px; color: #000; }
      .center { text-align: center; }
      .row { display: flex; justify-content: space-between; gap: 6px; }
      .hr { border-top: 1px dashed #000; margin: 6px 0; }
      .small { font-size: 11px; }
      .bold { font-weight: 700; }
      .mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace; }
      </style>
    </head>
    <body onload="window.print(); setTimeout(()=>window.close(), 300);">
      <div class="receipt">
        <div class="center bold">${headerName}</div>
        ${addressLine ? `<div class="center small">${addressLine}</div>` : ''}
        ${idLine ? `<div class="center small">${idLine}</div>` : ''}
        ${contactLine ? `<div class="center small">${contactLine}</div>` : ''}
        <div class="center small">Order Receipt</div>
        <div class="center small">${order.orderNo}</div>
        <div class="hr"></div>
        <div class="small">Customer: ${order.customerName}</div>
        <div class="small">Date: ${order.orderDate}</div>
        <div class="hr"></div>
        <div class="row bold"><span>Item</span><span class="mono">Qty x Price</span><span class="mono">Total</span></div>
        ${itemsRows}
        <div class="hr"></div>
        <div class="row"><span>Subtotal</span><span class="mono">Rs ${Number(order.totalAmount || 0).toFixed(2)}</span></div>
        <div class="row"><span>Tax</span><span class="mono">Rs ${Number(order.taxAmount || 0).toFixed(2)}</span></div>
        <div class="row bold"><span>Grand Total</span><span class="mono">Rs ${Number(order.netAmount || 0).toFixed(2)}</span></div>
        <div class="hr"></div>
        <div class="center small">Thank you</div>
      </div>
    </body></html>`;
    return html;
  };

  const printOrder = async (order: Order) => {
    try {
      const invRes = await getInvoices();
      const inv = (invRes?.invoices || []).find((x: any) => String(x.orderId) === String(order.id));
      if (!inv) {
        toast.error('Invoice not found for this order');
        return;
      }
      openInvoicePdfPreview(inv, order, company, customers);
    } catch (e: any) {
      toast.error(typeof e?.message === 'string' ? e.message : 'Failed to print invoice');
    }
  };

  const printThermal = (order: Order) => {
    const html = buildThermalReceiptHtml(order);
    try {
      const pf = (window as any).pharmaflow;
      if (pf?.printHtml) {
        let deviceName = localStorage.getItem('pharmaflowPrinter') || undefined;
        const doPrint = (name?: string) => {
          pf.printHtml(html, { silent: true, deviceName: name }).catch(() => {
            const w = window.open("", "_blank", "width=480,height=640");
            if (!w) { toast.error("Popup blocked. Allow popups to print"); return; }
            w.document.open();
            w.document.write(html);
            w.document.close();
          });
        };
        if (!deviceName && pf.getPrinters) {
          pf.getPrinters().then((list: any[]) => {
            const names = (list || []).map((p: any) => p?.name).filter(Boolean);
            const guess = names.find((n: string) => /pos|thermal|80|58/i.test(n)) || names[0];
            if (guess) { localStorage.setItem('pharmaflowPrinter', guess); doPrint(guess); }
            else { doPrint(undefined); }
          }).catch(() => doPrint(undefined));
        } else {
          doPrint(deviceName);
        }
        return;
      }
    } catch {}
    const w = window.open("", "_blank", "width=480,height=640");
    if (!w) { toast.error("Popup blocked. Allow popups to print"); return; }
    w.document.open();
    w.document.write(html);
    w.document.close();
  };

  const filteredOrders = orders.filter((order) => {
    const matchesSearch =
      order.orderNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.customerName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus =
      statusFilter === "all" || order.status === statusFilter;
    const matchesPayment =
      paymentFilter === "all" ||
      (paymentFilter === "unpaid"
        ? order.paymentStatus !== "paid"
        : order.paymentStatus === paymentFilter);
    const matchesSalesman = salesmanFilter === 'all' || String(order.salesmanCode || '') === salesmanFilter;
    return matchesSearch && matchesStatus && matchesPayment && matchesSalesman;
  });

  const exportOrdersCsv = () => {
    const headers = [
      'Order No',
      'Order Date',
      'Delivery Date',
      'Customer',
      'Customer Type',
      'Salesman',
      'Salesman Code',
      'Doc Type',
      'Status',
      'Payment',
      'Subtotal',
      'Discount',
      'Tax',
      'Net Amount',
    ];

    const rows = filteredOrders.map((o) => [
      o.orderNo,
      o.orderDate || '',
      o.deliveryDate || '',
      o.customerName || '',
      o.customerType || '',
      o.salesmanName || '',
      o.salesmanCode || '',
      String(o.docType || 'sale'),
      o.status,
      o.paymentStatus,
      String(o.totalAmount ?? ''),
      String(o.discountAmount ?? ''),
      String(o.taxAmount ?? ''),
      String(o.netAmount ?? ''),
    ]);

    const csv = [headers, ...rows]
      .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `orders_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Orders</h1>
            <p className="text-muted-foreground">
              Manage orders, approvals, and deliveries
            </p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => setDialogOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                New Order
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-none w-screen h-screen p-0 sm:rounded-none left-0 top-0 translate-x-0 translate-y-0">
              <div className="flex h-full w-full flex-col relative min-h-0">
                <div className="relative overflow-hidden border-b border-border bg-gradient-to-r from-primary/10 via-primary/5 to-transparent shrink-0">
                  <div className="px-6 py-4 flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/15">
                      <ShoppingCart className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <h2 className="text-xl font-semibold">Create New Order</h2>
                      <p className="text-sm text-muted-foreground">Create a new order for a customer</p>
                    </div>
                  </div>
                  <div className="pointer-events-none absolute -top-10 -right-10 h-40 w-40 rounded-full bg-primary/10 blur-2xl" />
                </div>
                <div className="grid gap-6 py-6 px-6 overflow-y-auto flex-1 min-h-0">
                <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Customer</Label>
                    <Popover open={customerPickerOpen} onOpenChange={setCustomerPickerOpen}>
                      <PopoverTrigger asChild>
                        <Input
                          placeholder="Type to search customer..."
                          value={(customerQuery !== "" ? customerQuery : (orderForm.customerId ? (customers.find(c => c.id === orderForm.customerId)?.name || "") : ""))}
                          onChange={(e) => {
                            const v = e.target.value;
                            setCustomerQuery(v);
                            setCustomerPickerOpen(true);
                            setOrderForm((s) => (s.customerId ? { ...s, customerId: "" } : s));
                          }}
                          onFocus={() => setCustomerPickerOpen(true)}
                        />
                      </PopoverTrigger>
                      <PopoverContent className="p-0 w-72">
                        <Command>
                          <CommandInput placeholder="Search customer..." value={customerQuery} onValueChange={setCustomerQuery} />
                          <CommandEmpty>No customer found.</CommandEmpty>
                          <CommandList>
                            <CommandGroup>
                              {customers.map((c) => (
                                <CommandItem key={c.id} value={c.name}
                                  onSelect={() => {
                                    setOrderForm((s) => ({ ...s, customerId: c.id }));
                                    setCustomerPickerOpen(false);
                                    setCustomerQuery("");
                                  }}
                                >
                                  {c.name}
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                    {orderForm.customerId && (
                      <p className="text-xs text-muted-foreground">
                        Type: {customers.find(c => c.id === orderForm.customerId)?.type || "-"}
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label>Order Date</Label>
                    <DateField
                      value={orderForm.orderDate}
                      onChange={(v) => setOrderForm((s) => ({ ...s, orderDate: v }))}
                    />
                  </div>
                  </div>
                </div>
                <div className="border border-border rounded-lg p-4 bg-card shadow-sm">
                  <h4 className="font-medium mb-4">Order Items</h4>
                  <div className="space-y-4">
                    <div className="grid grid-cols-6 gap-4 items-end">
                      <div className="col-span-2 space-y-2">
                        <Label>Scan Barcode</Label>
                        <Input placeholder="Focus here and scan..." value={scanCode}
                          onChange={(e) => setScanCode(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addScannedProduct(scanCode); } }} />
                      </div>
                    </div>
                    <div className="grid grid-cols-8 gap-4 items-end">
                      <div className="col-span-2 space-y-2">
                        <Label>Product</Label>
                        <Popover open={productPickerOpen} onOpenChange={setProductPickerOpen}>
                          <PopoverTrigger asChild>
                            <Input
                              placeholder="Type to search product..."
                              value={(productQuery !== "" ? productQuery : (orderForm.newItem.productId ? (products.find(p => p.id === orderForm.newItem.productId)?.name || "") : ""))}
                              onChange={(e) => {
                                const v = e.target.value;
                                setProductQuery(v);
                                setProductPickerOpen(true);
                                setOrderForm((s) => ({ ...s, newItem: { ...s.newItem, productId: "" } }));
                              }}
                              onFocus={() => setProductPickerOpen(true)}
                              ref={productInputRef}
                              onKeyDown={(e) => {
                                if (e.key === 'ArrowDown' && orderForm.items.length > 0) {
                                  e.preventDefault();
                                  bulkDiscountRef.current?.focus();
                                }
                              }}
                            />
                          </PopoverTrigger>
                          <PopoverContent className="p-0 w-80">
                            <Command>
                              <CommandInput placeholder="Search product..." value={productQuery} onValueChange={setProductQuery} />
                              <CommandEmpty>No product found.</CommandEmpty>
                              <CommandList>
                                <CommandGroup>
                                  {products.map((p) => (
                                    <CommandItem key={p.id} value={p.name}
                                      onSelect={() => {
                                        setOrderForm((s) => ({ ...s, newItem: { ...s.newItem, productId: p.id, unitPrice: String((p as any).mrp || p.purchasePrice || 0), unitsPerPack: String(p.unitsPerPack || "") } }));
                                        setProductPickerOpen(false);
                                        setProductQuery("");
                                        setOrderForm((s) => ({ ...s, newItem: { ...s.newItem, batchId: "" } }));
                                        setTimeout(() => { setBatchPickerOpen(true); batchInputRef.current?.focus(); }, 0);
                                      }}
                                    >
                                      <div className="flex w-full items-center justify-between gap-2">
                                        <span>{p.name}</span>
                                        <span className="text-xs text-muted-foreground">Stock: {typeof p.stockQuantity === 'number' ? p.stockQuantity : Number(p.stockQuantity || 0)}</span>
                                      </div>
                                    </CommandItem>
                                  ))}
                                </CommandGroup>
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </Popover>
                      </div>
                      <div className="space-y-2">
                        <Label>Batch</Label>
                        <Popover open={batchPickerOpen} onOpenChange={setBatchPickerOpen}>
                          <PopoverTrigger asChild>
                            <Input
                              placeholder="Type to search batch..."
                              disabled={!orderForm.newItem.productId}
                              value={(batchQuery !== "" ? batchQuery : (orderForm.newItem.batchId ? (productBatches.find(b => b.id === orderForm.newItem.batchId)?.batchNo || "") : ""))}
                              onChange={(e) => {
                                const v = e.target.value;
                                setBatchQuery(v);
                                setBatchPickerOpen(true);
                                setOrderForm((s) => ({ ...s, newItem: { ...s.newItem, batchId: "" } }));
                              }}
                              onFocus={() => setBatchPickerOpen(true)}
                              ref={batchInputRef}
                            />
                          </PopoverTrigger>
                          <PopoverContent className="p-0 w-72">
                            <Command>
                              <CommandInput placeholder="Search batch..." value={batchQuery} onValueChange={setBatchQuery} />
                              <CommandEmpty>No batch found.</CommandEmpty>
                              <CommandList>
                                <CommandGroup>
                                  {productBatches.map((b) => (
                                    <CommandItem key={b.id} value={b.batchNo}
                                      onSelect={() => {
                                        setOrderForm((s) => ({ ...s, newItem: { ...s.newItem, batchId: b.id, unitPrice: s.newItem.unitPrice || String(b.purchasePrice || 0) } }));
                                        setBatchPickerOpen(false);
                                        setBatchQuery("");
                                        setTimeout(() => { quantityInputRef.current?.focus(); }, 0);
                                      }}
                                    >
                                      <div className="flex w-full items-center justify-between gap-2">
                                        <span className="uppercase font-mono tracking-tight">{b.batchNo}</span>
                                        <span className="text-xs text-muted-foreground">Stock: {b.stockQuantity}{b.expiryDate ? ` • Exp: ${b.expiryDate}` : ''}</span>
                                      </div>
                                    </CommandItem>
                                  ))}
                                </CommandGroup>
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </Popover>
                      </div>
                      <div className="space-y-2">
                        <Label>Unit</Label>
                        <Select value={(orderForm.newItem as any).saleUnit || 'unit'} onValueChange={(v) => {
                          setOrderForm((s) => {
                            const prod = products.find(p => p.id === s.newItem.productId);
                            const defUP = String(prod?.unitsPerPack || s.newItem.unitsPerPack || "");
                            const next = { ...s, newItem: { ...s.newItem, saleUnit: v, unitsPerPack: v === 'pack' ? (defUP || "1") : s.newItem.unitsPerPack } } as any;
                            return next;
                          });
                          setTimeout(() => { if (v === 'pack') { unitsPerPackInputRef.current?.focus(); } else { quantityInputRef.current?.focus(); } }, 0);
                        }}>
                          <SelectTrigger>
                            <SelectValue placeholder="Unit" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="unit">Loose</SelectItem>
                            <SelectItem value="pack">Pack</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Units/Pack</Label>
                        <Input type="number" placeholder="e.g. 10" min={1}
                          value={(orderForm.newItem as any).unitsPerPack || ''}
                          disabled={((orderForm.newItem as any).saleUnit || 'unit') !== 'pack'}
                          onChange={(e) => setOrderForm((s) => ({ ...s, newItem: { ...s.newItem, unitsPerPack: e.target.value } }))}
                          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); quantityInputRef.current?.focus(); } }}
                          ref={unitsPerPackInputRef}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Quantity</Label>
                        <Input type="number" placeholder="0" value={orderForm.newItem.quantity}
                          min={1}
                          max={(orderForm.newItem.batchId ? (productBatches.find(b => b.id === orderForm.newItem.batchId)?.stockQuantity ?? undefined) : undefined)
                          || (products.find(p => p.id === orderForm.newItem.productId)?.stockQuantity ?? undefined)}
                          onChange={(e) => setOrderForm((s) => ({ ...s, newItem: { ...s.newItem, quantity: e.target.value } }))}
                          onKeyDown={(e) => {
                            if (e.key === 'ArrowDown' && orderForm.items.length > 0) { e.preventDefault(); bulkDiscountRef.current?.focus(); return; }
                            if (e.key === 'Enter') { e.preventDefault(); const ni: any = orderForm.newItem; if (!ni.productId) { productInputRef.current?.focus(); return; } if (!ni.batchId) { setBatchPickerOpen(true); batchInputRef.current?.focus(); return; } addItem(); }
                          }}
                          ref={quantityInputRef}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Disc %</Label>
                        <Input type="number" placeholder="0" value={orderForm.newItem.discount}
                          onChange={(e) => setOrderForm((s) => ({ ...s, newItem: { ...s.newItem, discount: e.target.value } }))}
                          onKeyDown={(e) => {
                            if (e.key === 'ArrowDown') { e.preventDefault(); bulkDiscountRef.current?.focus(); return; }
                            if (e.key === 'Enter') { e.preventDefault(); const ni: any = orderForm.newItem; if (!ni.productId) { productInputRef.current?.focus(); return; } if (!ni.batchId) { setBatchPickerOpen(true); batchInputRef.current?.focus(); return; } addItem(); setTimeout(() => { productInputRef.current?.focus(); }, 0); }
                          }}
                          ref={discountInputRef}
                        />
                      </div>
                      <Button onClick={addItem} className="h-10">
                        <Plus className="mr-2 h-4 w-4" /> Add Item
                      </Button>
                    </div>
                    {orderForm.items.length === 0 && (
                      <div className="rounded-md border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                        Select a product and quantity, then click "Add Item" to build the order.
                      </div>
                    )}
                    {orderForm.items.length > 0 && (
                      <div className="space-y-3">
                        {orderForm.items.map((it, idx) => {
                          const prod = products.find(p => p.id === it.productId);
                          const maxQty = prod?.stockQuantity ?? undefined;
                          return (
                            <div key={idx} className="grid grid-cols-7 gap-3 items-end">
                              <div className="col-span-2 text-sm flex items-center justify-between gap-2">
                                <span>{prod?.name}</span>
                                <span className="text-xs text-muted-foreground">Stock: {typeof prod?.stockQuantity === 'number' ? prod?.stockQuantity : Number(prod?.stockQuantity || 0)}</span>
                              </div>
                              <div>
                                <Label className="text-xs">Qty</Label>
                                <Input
                                  type="number"
                                  min={1}
                                  max={maxQty}
                                  value={it.quantity}
                                  onChange={(e) =>
                                    setOrderForm((s) => ({
                                      ...s,
                                      items: s.items.map((x, i) => (i === idx ? { ...x, quantity: e.target.value } : x)),
                                    }))
                                  }
                                />
                              </div>
                              <div>
                                <Label className="text-xs">Price</Label>
                                <Input
                                  type="number"
                                  step="0.01"
                                  value={it.unitPrice}
                                  onChange={(e) =>
                                    setOrderForm((s) => ({
                                      ...s,
                                      items: s.items.map((x, i) => (i === idx ? { ...x, unitPrice: e.target.value } : x)),
                                    }))
                                  }
                                />
                              </div>
                              <div>
                                <Label className="text-xs">Disc %</Label>
                                <Input
                                  type="number"
                                  value={it.discount}
                                  onChange={(e) =>
                                    setOrderForm((s) => ({
                                      ...s,
                                      items: s.items.map((x, i) => (i === idx ? { ...x, discount: e.target.value } : x)),
                                    }))
                                  }
                                />
                              </div>
                              <div>
                                <Label className="text-xs">Tax %</Label>
                                <Input
                                  type="number"
                                  value={it.tax}
                                  onChange={(e) =>
                                    setOrderForm((s) => ({
                                      ...s,
                                      items: s.items.map((x, i) => (i === idx ? { ...x, tax: e.target.value } : x)),
                                    }))
                                  }
                                />
                              </div>
                              <div className="flex items-end justify-between gap-2">
                                <div className="text-right">
                                  <p className="text-xs text-muted-foreground">Line</p>
                                  <p className="font-medium">
                                    {formatCurrency(((Number(it.quantity) || 0) * (Number(it.unitPrice) || 0) * (1 - (Number(it.discount) || 0) / 100)) * (1 + (Number(it.tax) || 0) / 100))}
                                  </p>
                                </div>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() =>
                                    setOrderForm((s) => ({
                                      ...s,
                                      items: s.items.filter((_, i) => i !== idx),
                                    }))
                                  }
                                  aria-label="Remove item"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          );
                        })}
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 items-end">
                          <div className="space-y-2">
                            <Label>All items Discount %</Label>
                            <Input
                              type="number"
                              placeholder="0"
                              value={bulkDiscount}
                              onChange={(e) => setBulkDiscount(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'ArrowDown' || e.key === 'Enter') {
                                  e.preventDefault();
                                  bulkTaxRef.current?.focus();
                                }
                                if (e.key === 'ArrowUp') {
                                  e.preventDefault();
                                  discountInputRef.current?.focus();
                                }
                              }}
                              ref={bulkDiscountRef}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>All items Tax %</Label>
                            <Input
                              type="number"
                              placeholder="0"
                              value={bulkTax}
                              onChange={(e) => setBulkTax(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'ArrowUp') {
                                  e.preventDefault();
                                  bulkDiscountRef.current?.focus();
                                } else if (e.key === 'Enter') {
                                  e.preventDefault();
                                  handleSubmitOrder();
                                }
                              }}
                              ref={bulkTaxRef}
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4 rounded-lg border border-border bg-card p-4 shadow-sm">
                  <div>
                    <p className="text-sm text-muted-foreground">Subtotal</p>
                    <p className="text-lg font-semibold">{formatCurrency(totals.subtotal)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Tax</p>
                    <p className="text-lg font-semibold">{formatCurrency(totals.tax)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Total</p>
                    <p className="text-lg font-bold text-primary">{formatCurrency(totals.total)}</p>
                  </div>
                </div>
                </div>
                <div className="w-full border-t border-border bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-6 py-3 flex items-center justify-between shrink-0">
                  <div className="hidden sm:flex items-center gap-6">
                    <div>
                      <p className="text-xs text-muted-foreground">Subtotal</p>
                      <p className="font-medium">{formatCurrency(totals.subtotal)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Tax</p>
                      <p className="font-medium">{formatCurrency(totals.tax)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Total</p>
                      <p className="text-base font-semibold text-primary">{formatCurrency(totals.total)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" onClick={resetDialog}>Cancel</Button>
                    <Button variant="outline" onClick={() => handleSubmitOrder({ status: 'hold', docType: 'sale' })} disabled={saving}>{saving ? "Saving..." : "Save as Hold"}</Button>
                    <Button variant="outline" onClick={() => handleSubmitOrder({ status: 'hold', docType: 'estimate' })} disabled={saving}>{saving ? "Saving..." : "Save as Estimate"}</Button>
                    <Button onClick={() => handleSubmitOrder({ status: 'pending', docType: 'sale' })} disabled={saving}>{saving ? "Saving..." : (editingId ? "Save" : "Create Order")}</Button>
                  </div>
                </div>
              </div>
            </DialogContent>
          </Dialog>
          
          <Dialog open={viewOpen} onOpenChange={setViewOpen}>
            <DialogContent className="sm:max-w-[700px]">
              <DialogHeader>
                <DialogTitle>Order Details</DialogTitle>
                <DialogDescription>View order information</DialogDescription>
              </DialogHeader>
              {viewOrder && (
                <div className="grid gap-4 py-2 max-h-[70vh] overflow-y-auto">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-muted-foreground">Order No.</p>
                      <p className="font-medium">{viewOrder.orderNo}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Order Date</p>
                      <p className="font-medium">{viewOrder.orderDate}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-muted-foreground">Customer</p>
                      <p className="font-medium">{viewOrder.customerName}</p>
                      <p className="text-xs text-muted-foreground capitalize">{viewOrder.customerType}</p>
                    </div>
                    <div className="flex items-start gap-3">
                      <div>
                        <p className="text-xs text-muted-foreground">Status</p>
                        <Badge variant="outline" className={statusStyles[viewOrder.status]}>{viewOrder.status}</Badge>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Payment</p>
                        <Badge variant="outline" className={paymentStyles[viewOrder.paymentStatus]}>{viewOrder.paymentStatus}</Badge>
                      </div>
                    </div>
                  </div>

                  <div className="border border-border rounded-lg">
                    <div className="p-3 border-b border-border font-medium">Items</div>
                    <div className="p-3 overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Product</TableHead>
                            <TableHead>Batch</TableHead>
                            <TableHead className="text-right">Qty</TableHead>
                            <TableHead className="text-right">Price</TableHead>
                            <TableHead className="text-right">Disc %</TableHead>
                            <TableHead className="text-right">Tax %</TableHead>
                            <TableHead className="text-right">Line Total</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {viewOrder.items.map((it, i) => (
                            <TableRow key={i}>
                              <TableCell>{it.productName}</TableCell>
                              <TableCell>{it.batchNo}</TableCell>
                              <TableCell className="text-right">{it.quantity}</TableCell>
                              <TableCell className="text-right">{formatCurrency(it.unitPrice)}</TableCell>
                              <TableCell className="text-right">{it.discount}</TableCell>
                              <TableCell className="text-right">{it.tax}</TableCell>
                              <TableCell className="text-right">{formatCurrency(it.total)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <p className="text-xs text-muted-foreground">Subtotal</p>
                      <p className="text-lg font-semibold">{formatCurrency(viewOrder.totalAmount)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Tax</p>
                      <p className="text-lg font-semibold">{formatCurrency(viewOrder.taxAmount)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Net Amount</p>
                      <p className="text-lg font-bold text-primary">{formatCurrency(viewOrder.netAmount)}</p>
                    </div>
                  </div>
                </div>
              )}
              <div className="flex justify-end gap-2">
                <Button onClick={() => viewOrder && printOrder(viewOrder)}>
                  <Printer className="mr-2 h-4 w-4" /> Print A4
                </Button>
                <Button variant="secondary" onClick={() => viewOrder && printThermal(viewOrder)}>
                  <Printer className="mr-2 h-4 w-4" /> Thermal 80mm
                </Button>
                <Button variant="outline" onClick={() => setViewOpen(false)}>Close</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search orders, customers..."
                  className="pl-10"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <div className="flex gap-2">
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[140px]">
                    <Filter className="mr-2 h-4 w-4" />
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="hold">Hold</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="approved">Approved</SelectItem>
                    <SelectItem value="dispatched">Dispatched</SelectItem>
                    <SelectItem value="delivered">Delivered</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={paymentFilter} onValueChange={setPaymentFilter}>
                  <SelectTrigger className="w-[130px]">
                    <SelectValue placeholder="Payment" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Payments</SelectItem>
                    <SelectItem value="unpaid">Unpaid</SelectItem>
                    <SelectItem value="partial">Partial</SelectItem>
                    <SelectItem value="paid">Paid</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={salesmanFilter} onValueChange={setSalesmanFilter}>
                  <SelectTrigger className="w-[170px]">
                    <SelectValue placeholder="Salesman" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Salesmen</SelectItem>
                    {Array.from(new Map(orders.map(o => [String(o.salesmanCode || ''), String(o.salesmanCode || '')] as const)).values())
                      .filter((c) => c && c !== 'undefined')
                      .map((code) => (
                        <SelectItem key={code} value={code}>{code}</SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                <Button variant="outline" size="icon" onClick={exportOrdersCsv}>
                  <Download className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Orders Table */}
        <Card>
          <CardHeader>
            <CardTitle>Order History ({filteredOrders.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Order No.</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Salesman</TableHead>
                    <TableHead>Order Date</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Payment</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredOrders.map((order) => (
                    <TableRow key={order.id}>
                      <TableCell className="font-medium">{order.orderNo}</TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium text-foreground">{order.customerName}</p>
                          <p className="text-xs text-muted-foreground capitalize">{order.customerType}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{order.salesmanName || '-'}</p>
                          <p className="text-xs text-muted-foreground">{order.salesmanCode || '-'}</p>
                        </div>
                      </TableCell>
                      <TableCell>{order.orderDate}</TableCell>
                      <TableCell className="text-right">
                        <div>
                          <p className="font-semibold">{formatCurrency(order.netAmount)}</p>
                          <p className="text-xs text-muted-foreground">
                            Tax: {formatCurrency(order.taxAmount)}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={statusStyles[order.status]}>
                          {order.status}
                        </Badge>
                        {String(order.docType || 'sale') === 'estimate' && (
                          <Badge variant="outline" className="ml-2 bg-muted text-muted-foreground border-muted/20">
                            estimate
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={paymentStyles[order.paymentStatus]}>
                          {order.paymentStatus}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" title="View Details" onClick={() => openView(order)}>
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" title="Print A4" onClick={() => printOrder(order)}>
                            <Printer className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" title="Thermal 80mm" onClick={() => printThermal(order)}>
                            <Printer className="h-4 w-4" />
                          </Button>
                          {(order.status === 'hold' || String(order.docType || 'sale') === 'estimate') && (
                            <Button variant="ghost" size="icon" title="Edit" onClick={() => openEdit(order)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                          )}
                          {String(order.docType || 'sale') === 'estimate' && (
                            <Button variant="ghost" size="icon" title="Convert to Sale" onClick={() => onConvertEstimate(order.id)}>
                              <FileText className="h-4 w-4" />
                            </Button>
                          )}
                          {(order.status === 'hold' || String(order.docType || 'sale') === 'estimate') && (
                            <Button variant="ghost" size="icon" title="Delete" onClick={() => onDeleteOrder(order.id)}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          )}
                          {order.status === "pending" && (
                            <>
                              <Button variant="ghost" size="icon" title="Approve" onClick={() => onChangeStatus(order.id, "approved")}>
                                <CheckCircle className="h-4 w-4 text-primary" />
                              </Button>
                              <Button variant="ghost" size="icon" title="Cancel" onClick={() => onChangeStatus(order.id, "cancelled")}>
                                <X className="h-4 w-4 text-destructive" />
                              </Button>
                            </>
                          )}
                          {order.status === "hold" && String(order.docType || 'sale') === 'sale' && (
                            <Button variant="ghost" size="icon" title="Finalize (Approve)" onClick={() => onChangeStatus(order.id, "approved")}>
                              <CheckCircle className="h-4 w-4 text-primary" />
                            </Button>
                          )}
                          {order.status === "approved" && (
                            <Button variant="ghost" size="icon" title="Dispatch" onClick={() => onChangeStatus(order.id, "dispatched")}>
                              <Truck className="h-4 w-4 text-chart-3" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
};

export default Orders;
