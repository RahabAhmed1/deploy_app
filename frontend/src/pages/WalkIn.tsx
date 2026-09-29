import { useEffect, useMemo, useRef, useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getOrders, createOrder, updateOrderStatus, getCustomers, createCustomer, getProducts, getProductBatches, createInvoice, getInvoices, createPayment, getCompanyInfo } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { formatCurrency } from "@/lib/currency";
import { toast } from "sonner";
import { Printer } from "lucide-react";

type Product = { id: string; name: string; barcode?: string; batchNo: string; purchasePrice: number; stockQuantity: number; unitsPerPack?: number };
type Order = {
  id: string;
  orderNo: string;
  customerId: string;
  customerName: string;
  orderDate: string;
  totalAmount: number;
  taxAmount: number;
  netAmount: number;
  items: Array<{ productId: string; productName: string; batchNo: string; quantity: number; unitPrice: number; discount: number; tax: number; total: number }>;
 };
 
 const WalkIn = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [walkInCustomerId, setWalkInCustomerId] = useState<string>("");
  const [walkInCustomerNo, setWalkInCustomerNo] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [company, setCompany] = useState<any>(null);
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [buyer, setBuyer] = useState({ name: "", phone: "" });
  const [form, setForm] = useState({
    items: [] as Array<{ productId: string; batchId?: string; batchNo?: string; quantity: string; unitPrice: string; discount: string; tax: string }>,
    newItem: { productId: "", batchId: "", quantity: "", unitPrice: "", discount: "0", tax: "0", saleUnit: "unit", unitsPerPack: "" },
  });
  const [scanCode, setScanCode] = useState("");
  const [productBatches, setProductBatches] = useState<Array<{ id: string; batchNo: string; purchasePrice: number; stockQuantity: number; expiryDate?: string }>>([]);
  // Refs for keyboard navigation and Enter-to-add
  const customerInputRef = useRef<HTMLInputElement | null>(null);
  const dateInputRef = useRef<HTMLInputElement | null>(null);
  const buyerNameRef = useRef<HTMLInputElement | null>(null);
  const buyerPhoneRef = useRef<HTMLInputElement | null>(null);
  const scanInputRef = useRef<HTMLInputElement | null>(null);
  const productSelectRef = useRef<HTMLButtonElement | null>(null);
  const batchSelectRef = useRef<HTMLButtonElement | null>(null);
  const unitSelectRef = useRef<HTMLButtonElement | null>(null);
  const quantityInputRef = useRef<HTMLInputElement | null>(null);
  const discountInputRef = useRef<HTMLInputElement | null>(null);
  const taxInputRef = useRef<HTMLInputElement | null>(null);
  const unitsPerPackInputRef = useRef<HTMLInputElement | null>(null);
  const bulkDiscountRef = useRef<HTMLInputElement | null>(null);
  const bulkTaxRef = useRef<HTMLInputElement | null>(null);
  const [bulkDiscount, setBulkDiscount] = useState("");
  const [bulkTax, setBulkTax] = useState("");

  const totals = useMemo(() => {
    const acc = { subtotal: 0, tax: 0, total: 0 };
    for (const it of form.items) {
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
  }, [form.items]);

  const buildThermalReceiptHtml = (order: Order, phone?: string) => {
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
        <div class="center small">Cash Sale Receipt</div>
        <div class="center small">${order.orderNo}</div>
        <div class="hr"></div>
        <div class="small">Customer: ${order.customerName || 'Walk-in'}</div>
        ${phone ? `<div class="small">Phone: ${phone}</div>` : ''}
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

  const printOrder = (order: Order, phone?: string) => {
    const html = buildThermalReceiptHtml(order, phone);
    try {
      const pf = (window as any).pharmaflow;
      if (pf?.printHtml) {
        const deviceName = localStorage.getItem('pharmaflowPrinter') || undefined;
        pf.printHtml(html, { silent: true, deviceName }).catch(() => {
          const w = window.open("", "_blank", "width=480,height=640");
          if (!w) { toast.error("Popup blocked. Allow popups to print"); return; }
          w.document.open();
          w.document.write(html);
          w.document.close();
        });
        return;
      }
    } catch {}
    const w = window.open("", "_blank", "width=480,height=640");
    if (!w) { toast.error("Popup blocked. Allow popups to print"); return; }
    w.document.open();
    w.document.write(html);
    w.document.close();
  };

  const load = async () => {
    const [pRes, cRes] = await Promise.all([getProducts(), getCustomers()]);
    setProducts((pRes?.products || []).map((p: any) => ({ id: String(p.id), name: p.name, barcode: p.barcode || '', batchNo: p.batchNo, purchasePrice: Number(p.purchasePrice || 0), stockQuantity: Number(p.stockQuantity || 0), unitsPerPack: Number((p.unitsPerPack ?? p.unitsPerStrip ?? 0)) || 0 })));
    const existing = (cRes?.customers || []).find((c: any) => String(c.name).toLowerCase() === "walk-in");
    if (existing) {
      setWalkInCustomerId(String(existing.id));
      setWalkInCustomerNo(String(existing.customerNo || ""));
    } else {
      const created = await createCustomer({ name: "Walk-in", type: "retailer", status: "active" });
      const newId = String(created?.customer?.id || created?.customer?._id || created?.id || created?._id);
      const newNo = String(created?.customer?.customerNo || created?.customerNo || "");
      setWalkInCustomerId(newId);
      setWalkInCustomerNo(newNo);
    }
  };

  useEffect(() => { load(); }, []);
  useEffect(() => {
    if (!walkInCustomerId) return;
    (async () => {
      try {
        const cRes = await getCustomers();
        const found = (cRes?.customers || []).find((c: any) => String(c.id) === String(walkInCustomerId));
        if (found) setWalkInCustomerNo(String(found.customerNo || ""));
      } catch {}
    })();
  }, [walkInCustomerId]);
  useEffect(() => {
    setTimeout(() => {
      scanInputRef.current?.focus();
    }, 0);
  }, []);
  useEffect(() => {
    (async () => {
      try { const res = await getCompanyInfo(); setCompany(res?.company || null); } catch {}
    })();
  }, []);

  // Auto-apply bulk discount/tax to all existing items whenever these values change
  useEffect(() => {
    setForm((s) => ({
      ...s,
      items: s.items.map((it) => ({
        ...it,
        discount: bulkDiscount !== "" ? bulkDiscount : "0",
        tax: bulkTax !== "" ? bulkTax : "0",
      })),
    }));
  }, [bulkDiscount, bulkTax]);

  const addItem = () => {
    const ni = form.newItem as any;
    const prod = products.find(p => p.id === ni.productId);
    const selBatch = productBatches.find(b => b.id === ni.batchId);
    const qtyInput = Number(ni.quantity) || 0;
    const defaultUP = Math.max(1, Number(prod?.unitsPerPack || 0) || 1);
    const up = Math.max(1, Number(ni.unitsPerPack || defaultUP) || 1);
    const baseQty = (ni.saleUnit === 'pack') ? (qtyInput * up) : qtyInput;
    if (!ni.productId || baseQty <= 0) return;
    if (!ni.batchId) { toast.error("Please select a batch"); return; }
    const existingQty = form.items.filter(i => i.productId === ni.productId && i.batchId === ni.batchId).reduce((s, i) => s + (Number(i.quantity) || 0), 0);
    const requested = baseQty + existingQty;
    const available = selBatch ? Number(selBatch.stockQuantity || 0) : (prod ? Number(prod.stockQuantity || 0) : 0);
    if (requested > available) {
      toast.error(`Insufficient stock for ${prod?.name || 'item'}. Available: ${available}, requested: ${requested}`);
      return;
    }
    setForm((s) => ({
      ...s,
      items: [...s.items, { productId: ni.productId, batchId: ni.batchId, batchNo: selBatch?.batchNo, quantity: String(baseQty), unitPrice: ni.unitPrice || String((selBatch?.purchasePrice ?? products.find(p => p.id === ni.productId)?.purchasePrice ?? 0)), discount: ni.discount || "0", tax: ni.tax || "0" }],
      newItem: { productId: "", batchId: "", quantity: "", unitPrice: "", discount: "0", tax: "0", saleUnit: "unit", unitsPerPack: "" },
    }));
    setTimeout(() => {
      scanInputRef.current?.focus();
    }, 0);
  };

  // Add item quickly by scanning a barcode. Chooses earliest-expiry batch with stock; increments quantity if already present.
  const addScannedProduct = async (code: string) => {
    const trimmed = (code || '').trim();
    if (!trimmed) return;
    const prod = products.find(p => (p.barcode || '') === trimmed);
    if (!prod) { toast.error('No product found for scanned barcode'); setScanCode(''); return; }
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
      const existingIndex = form.items.findIndex((it) => it.productId === prod.id && it.batchId === chosen.id);
      if (existingIndex >= 0) {
        const currentQty = Number(form.items[existingIndex].quantity) || 0;
        const newQty = currentQty + 1;
        if (newQty > Number(chosen.stockQuantity || 0)) { toast.error('Insufficient stock for scanned item'); setScanCode(''); return; }
        setForm((s) => ({ ...s, items: s.items.map((it, idx) => idx === existingIndex ? { ...it, quantity: String(newQty) } : it) }));
      } else {
        if (Number(chosen.stockQuantity || 0) <= 0) { toast.error('Batch out of stock'); setScanCode(''); return; }
        setForm((s) => ({ ...s, items: [...s.items, { productId: prod.id, batchId: chosen.id, batchNo: chosen.batchNo, quantity: '1', unitPrice: String(chosen.purchasePrice || prod.purchasePrice || 0), discount: '0', tax: '0' }] }));
      }
    } catch {}
    finally {
      setScanCode('');
      setTimeout(() => {
        scanInputRef.current?.focus();
      }, 0);
    }
  };

  const handleSale = async () => {
    if (saving) return;
    if (!walkInCustomerId || form.items.length === 0) {
      toast.error("Add items to complete sale");
      return;
    }
    const requestedByProduct = new Map<string, number>();
    for (const it of form.items) {
      const qty = Number(it.quantity) || 0;
      if (qty <= 0) {
        toast.error("Quantity must be greater than 0");
        return;
      }
      requestedByProduct.set(it.productId, (requestedByProduct.get(it.productId) || 0) + qty);
    }
    for (const [pid, qty] of requestedByProduct) {
      const p = products.find(pp => pp.id === pid);
      const available = Number(p?.stockQuantity || 0);
      if (qty > available) {
        toast.error(`Insufficient stock for ${p?.name || 'product'}. Available: ${available}, requested: ${qty}`);
        return;
      }
    }
    setSaving(true);
    try {
      const payload = {
        customerId: walkInCustomerId,
        customerName: buyer.name?.trim() ? buyer.name.trim() : "Walk-in",
        orderDate: date,
        salesmanId: getCurrentUser()?.id || undefined,
        salesmanName: getCurrentUser()?.username || undefined,
        salesmanCode: getCurrentUser()?.staffCode || undefined,
        items: form.items.map(it => ({
          productId: it.productId,
          batchId: it.batchId,
          quantity: Number(it.quantity) || 0,
          unitPrice: Number(it.unitPrice) || 0,
          discount: Number(it.discount) || 0,
          tax: Number(it.tax) || 0,
        })),
      };
      const created = await createOrder(payload);
      const createdId = String(created?.order?.id || created?.order?._id || "");
      const createdNo = String(created?.order?.orderNo || "");
      const oRes = await getOrders();
      const list = (oRes?.orders || []) as Order[];
      const order = list.find(o => (createdId && o.id === createdId) || (!!createdNo && o.orderNo === createdNo));
      if (!order) throw new Error("Order not found after creation");
      await updateOrderStatus(order.id, "approved");
      // Auto-generate invoice for walk-in sale upon approval
      try {
        const iRes = await getInvoices();
        const exists = (iRes?.invoices || []).some((inv: any) => String(inv.orderId) === order.id);
        if (!exists) {
          await createInvoice({
            orderId: order.id,
            invoiceDate: date,
            paymentTermsDays: 0,
            billingAddress: "",
            shippingAddress: "",
            notes: "Auto-generated for walk-in sale",
          });
        }
      } catch (e: any) {
        console.error(e);
      }
      await createPayment({
        date,
        customerId: walkInCustomerId,
        customerName: buyer.name?.trim() ? buyer.name.trim() : "Walk-in",
        orderId: order.id,
        amount: Number(order.netAmount || 0),
        method: "cash",
        reference: buyer.phone?.trim() || "",
        status: "completed",
      });
      printOrder(order, buyer.phone?.trim() || undefined);
      setForm({ items: [], newItem: { productId: "", batchId: "", quantity: "", unitPrice: "", discount: "0", tax: "0", saleUnit: "unit", unitsPerPack: "" } });
      setBuyer({ name: "", phone: "" });
      setTimeout(() => {
        scanInputRef.current?.focus();
      }, 0);
      toast.success("Cash sale recorded");
    } catch (e: any) {
      toast.error(e?.message || "Failed to complete sale");
    } finally {
      setSaving(false);
    }
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold text-foreground">Walk-in Sale</h1>
          <p className="text-muted-foreground">Cash sales for walk-in customers. Stock is decremented and ledger updated automatically.</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Sale Details</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label>Customer</Label>
                <Input
                  value={walkInCustomerId ? `Walk-in${(walkInCustomerNo || walkInCustomerId) ? ` (ID: ${walkInCustomerNo || walkInCustomerId})` : ""}` : "Creating..."}
                  readOnly
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      dateInputRef.current?.focus();
                    }
                  }}
                  ref={customerInputRef}
                />
              </div>
              <div className="space-y-2">
                <Label>Date</Label>
                <Input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      buyerNameRef.current?.focus();
                    }
                  }}
                  ref={dateInputRef}
                />
              </div>
              <div className="space-y-2">
                <Label>Name</Label>
                <Input placeholder="Customer name" value={buyer.name}
                  onChange={(e) => setBuyer((s) => ({ ...s, name: e.target.value }))}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      buyerPhoneRef.current?.focus();
                    }
                  }}
                  ref={buyerNameRef}
                />
              </div>
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input type="tel" placeholder="03XXXXXXXXX" value={buyer.phone}
                  onChange={(e) => setBuyer((s) => ({ ...s, phone: e.target.value }))}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      scanInputRef.current?.focus();
                    }
                  }}
                  ref={buyerPhoneRef}
                />
              </div>
            </div>
            <div className="border border-border rounded-lg p-4 mt-4">
              <h4 className="font-medium mb-4">Items</h4>
              <div className="space-y-4">
                <div className="grid grid-cols-7 gap-4 items-end">
                  <div className="col-span-2 space-y-2">
                    <Label>Scan Barcode</Label>
                    <Input placeholder="Focus here and scan..." value={scanCode}
                      onChange={(e) => setScanCode(e.target.value)}
                      onKeyDown={async (e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          await addScannedProduct(scanCode);
                        }
                      }}
                      ref={scanInputRef}
                      autoFocus
                    />
                  </div>
                </div>
                <div className="grid grid-cols-9 gap-4 items-end">
                  <div className="col-span-2 space-y-2">
                    <Label>Product</Label>
                    <Select value={form.newItem.productId} onValueChange={async (v) => {
                      setForm((s) => ({
                        ...s,
                        newItem: {
                          ...s.newItem,
                          productId: v,
                          batchId: "",
                          unitPrice: String(products.find(p => p.id === v)?.purchasePrice || 0),
                          unitsPerPack: String(products.find(p => p.id === v)?.unitsPerPack || ""),
                        },
                      }));
                      try {
                        const res = await getProductBatches({ productId: v });
                        const list = (res?.batches || []).map((b: any) => ({ id: String(b.id || b._id || ""), batchNo: b.batchNo, purchasePrice: typeof b.purchasePrice === 'number' ? b.purchasePrice : Number(b.purchasePrice || 0), stockQuantity: typeof b.stockQuantity === 'number' ? b.stockQuantity : Number(b.stockQuantity || 0), expiryDate: b.expiryDate as string | undefined, }));
                        setProductBatches(list);
                        setTimeout(() => { batchSelectRef.current?.focus(); }, 0);
                      } catch {}
                    }}>
                      <SelectTrigger ref={productSelectRef}>
                        <SelectValue placeholder="Select product" />
                      </SelectTrigger>
                      <SelectContent>
                        {products.map((p) => (
                          <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Batch</Label>
                    <Select
                      value={form.newItem.batchId}
                      disabled={!form.newItem.productId}
                      onValueChange={(v) => {
                        setForm((s) => ({
                          ...s,
                          newItem: {
                            ...s.newItem,
                            batchId: v,
                            unitPrice: s.newItem.unitPrice || String((productBatches.find(b => b.id === v)?.purchasePrice) || 0)
                          }
                        }));
                        requestAnimationFrame(() => {
                          setTimeout(() => {
                            unitSelectRef.current?.focus();
                          }, 30);
                        });
                      }}
                    >
                      <SelectTrigger ref={batchSelectRef}>
                        <SelectValue placeholder="Select batch" />
                      </SelectTrigger>
                      <SelectContent>
                        {productBatches.map((b) => (
                          <SelectItem key={b.id} value={b.id}>{b.batchNo} (Stock: {b.stockQuantity}{b.expiryDate ? ` • Exp: ${b.expiryDate}` : ""})</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Unit</Label>
                    <Select value={(form.newItem as any).saleUnit || 'unit'} onValueChange={(v) => {
                      setForm((s) => {
                        const prod = products.find(p => p.id === s.newItem.productId);
                        const defUP = String(prod?.unitsPerPack || s.newItem.unitsPerPack || "");
                        const next = { ...s, newItem: { ...s.newItem, saleUnit: v, unitsPerPack: v === 'pack' ? (defUP || "1") : s.newItem.unitsPerPack } } as any;
                        return next;
                      });
                      setTimeout(() => { if (v === 'pack') { unitsPerPackInputRef.current?.focus(); } else { quantityInputRef.current?.focus(); } }, 0);
                    }}>
                      <SelectTrigger ref={unitSelectRef}>
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
                      value={(form.newItem as any).unitsPerPack || ''}
                      disabled={((form.newItem as any).saleUnit || 'unit') !== 'pack'}
                      onChange={(e) => setForm((s) => ({ ...s, newItem: { ...s.newItem, unitsPerPack: e.target.value } }))}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); quantityInputRef.current?.focus(); } }}
                      ref={unitsPerPackInputRef}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Quantity</Label>
                    <Input type="number" placeholder="0" value={form.newItem.quantity}
                      min={1}
                      max={(form.newItem.batchId ? (productBatches.find(b => b.id === form.newItem.batchId)?.stockQuantity ?? undefined) : (products.find(p => p.id === form.newItem.productId)?.stockQuantity ?? undefined))}
                      onChange={(e) => setForm((s) => ({ ...s, newItem: { ...s.newItem, quantity: e.target.value } }))}
                      onKeyDown={(e) => {
                        if (e.key === 'ArrowDown' && form.items.length > 0) { e.preventDefault(); bulkDiscountRef.current?.focus(); return; }
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          const ni: any = form.newItem;
                          if (!ni.productId) { productSelectRef.current?.focus(); return; }
                          if (!ni.batchId) { batchSelectRef.current?.focus(); return; }
                          discountInputRef.current?.focus();
                        }
                      }}
                      ref={quantityInputRef}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Discount %</Label>
                    <Input type="number" placeholder="0" value={form.newItem.discount}
                      onChange={(e) => setForm((s) => ({ ...s, newItem: { ...s.newItem, discount: e.target.value } }))}
                      onKeyDown={(e) => {
                        if (e.key === 'ArrowDown') { e.preventDefault(); bulkDiscountRef.current?.focus(); return; }
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          const ni: any = form.newItem;
                          if (!ni.productId) { productSelectRef.current?.focus(); return; }
                          if (!ni.batchId) { batchSelectRef.current?.focus(); return; }
                          taxInputRef.current?.focus();
                        }
                      }}
                      ref={discountInputRef}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Tax %</Label>
                    <Input type="number" placeholder="0" value={form.newItem.tax}
                      onChange={(e) => setForm((s) => ({ ...s, newItem: { ...s.newItem, tax: e.target.value } }))}
                      onKeyDown={(e) => {
                        if (e.key === 'ArrowDown') { e.preventDefault(); bulkTaxRef.current?.focus(); return; }
                        if (e.key === 'Enter') { e.preventDefault(); const ni: any = form.newItem; if (!ni.productId) { productSelectRef.current?.focus(); return; } if (!ni.batchId) { batchSelectRef.current?.focus(); return; } addItem(); }
                      }}
                      ref={taxInputRef}
                    />
                  </div>
                  <Button variant="outline" onClick={addItem}>Add</Button>
                </div>
                {form.items.length > 0 && (
                  <div className="space-y-2">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Product</TableHead>
                          <TableHead>Batch</TableHead>
                          <TableHead className="text-right">Qty</TableHead>
                          <TableHead className="text-right">Price</TableHead>
                          <TableHead className="text-right">Disc %</TableHead>
                          <TableHead className="text-right">Tax %</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {form.items.map((it, idx) => {
                          const prod = products.find(p => p.id === it.productId);
                          return (
                            <TableRow key={idx}>
                              <TableCell>{prod?.name}</TableCell>
                              <TableCell>{it.batchNo || '-'}</TableCell>
                              <TableCell className="text-right">{it.quantity}</TableCell>
                              <TableCell className="text-right">{formatCurrency(Number(it.unitPrice || 0))}</TableCell>
                              <TableCell className="text-right">{it.discount || 0}</TableCell>
                              <TableCell className="text-right">{it.tax || 0}</TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
                {form.items.length > 0 && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 items-end mt-2">
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
                            handleSale();
                          }
                        }}
                        ref={bulkTaxRef}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4 pt-4 border-t border-border mt-4">
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
            <div className="flex justify-end gap-2 mt-4">
              <Button onClick={handleSale} disabled={saving || !walkInCustomerId || form.items.length === 0}>
                <Printer className="mr-2 h-4 w-4" /> Complete Sale (Cash)
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
};

export default WalkIn;
