import { useEffect, useMemo, useState } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { getPurchases, createPurchase, updatePurchase, postPurchase, deletePurchase, getSuppliers, getProducts, createSupplierPayment, getCompanyInfo } from "@/lib/api";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Plus, Search, AlertTriangle, CheckCircle2, PackageSearch, Truck, Eye, Trash2, Banknote, Download, Pencil } from "lucide-react";

 type PurchaseSummary = {
  id: string;
  purchaseNo: string;
  date: string;
  supplierName: string;
  supplierId?: string;
  referenceNo: string;
  itemsCount: number;
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  netAmount: number;
  paid?: number;
  balance?: number;
  status: "hold" | "posted";
  items?: Array<{ productId?: string; productName: string; batchNo: string; quantity: number; unitPrice: number; discount: number; tax: number; lineTotal: number }>;
};

 type ProductLite = {
  id: string;
  name: string;
  batchNo: string;
  purchasePrice: number;
};

const Purchases = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [purchases, setPurchases] = useState<PurchaseSummary[]>([]);
  const [viewOpen, setViewOpen] = useState(false);
  const [viewPurchase, setViewPurchase] = useState<PurchaseSummary | null>(null);
  const [payOpen, setPayOpen] = useState(false);
  const [payPurchase, setPayPurchase] = useState<PurchaseSummary | null>(null);
  const [paySaving, setPaySaving] = useState(false);
  const [payForm, setPayForm] = useState({ date: new Date().toISOString().split("T")[0], amount: "", method: "bank", reference: "" });
  const [products, setProducts] = useState<ProductLite[]>([]);
  const [suppliers, setSuppliers] = useState<Array<{ id: string; name: string }>>([]);
  const [company, setCompany] = useState<any>(null);

  const [form, setForm] = useState({
    supplierName: "",
    supplierId: "",
    referenceNo: "",
    date: new Date().toISOString().split("T")[0],
    notes: "",
    items: [] as Array<{ productId: string; productName: string; batchNo: string; quantity: string; unitPrice: string; discount: string; tax: string }>,
    payAmount: "",
    payMethod: "bank",
    payReference: "",
  });

  const totals = useMemo(() => {
    const lines = form.items.map((it) => {
      const qty = Number(it.quantity) || 0;
      const price = Number(it.unitPrice) || 0;
      const disc = Number(it.discount) || 0;
      const tax = Number(it.tax) || 0;
      const base = qty * price;
      const afterDisc = base * (1 - disc / 100);
      const lineTotal = afterDisc * (1 + tax / 100);
      return { base, disc: base * (disc / 100), tax: afterDisc * (tax / 100), lineTotal };
    });
    const subtotal = lines.reduce((s, x) => s + x.base, 0);
    const discountTotal = lines.reduce((s, x) => s + x.disc, 0);
    const taxTotal = lines.reduce((s, x) => s + x.tax, 0);
    const net = lines.reduce((s, x) => s + x.lineTotal, 0);
    return { subtotal, discountTotal, taxTotal, net };
  }, [form.items]);

  const loadSuppliers = async () => {
    try {
      const res = await getSuppliers();
      const list = ((res?.suppliers ?? res) || []).map((s: any) => ({ id: String(s.id), name: s.name || "" }));
      setSuppliers(list);
    } catch (e) {
      console.error(e);
      toast.error("Failed to load suppliers");
    }
  };

  const openPayDialog = (p: PurchaseSummary) => {
    if (p.status === 'hold') {
      toast.error('Cannot record payment for a purchase on hold. Post it first.');
      return;
    }
    setPayPurchase(p);
    const remaining = Math.max(0, Number(p.netAmount || 0) - Number(p.paid || 0));
    setPayForm({ date: new Date().toISOString().split("T")[0], amount: String(remaining || 0), method: "bank", reference: "" });
    setPayOpen(true);
  };

  const openEditPurchase = (p: PurchaseSummary) => {
    if (p.status !== 'hold') {
      toast.error('Only held purchases can be edited');
      return;
    }
    setEditingId(p.id);
    setForm({
      supplierName: p.supplierName || "",
      supplierId: p.supplierId || "",
      referenceNo: p.referenceNo || "",
      date: p.date || new Date().toISOString().split("T")[0],
      notes: "",
      items: (p.items || []).map((it: any) => ({
        productId: String(it.productId || ""),
        productName: it.productName || "",
        batchNo: it.batchNo || "",
        quantity: String(it.quantity || 0),
        unitPrice: String(it.unitPrice || 0),
        discount: String(it.discount || 0),
        tax: String(it.tax || 0),
      })),
      payAmount: "",
      payMethod: "bank",
      payReference: "",
    });
    setDialogOpen(true);
  };

  const resetDialog = () => {
    setDialogOpen(false);
    setEditingId(null);
    setForm({ supplierName: "", supplierId: "", referenceNo: "", date: new Date().toISOString().split("T")[0], notes: "", items: [], payAmount: "", payMethod: "bank", payReference: "" });
  };

  const submitSupplierPayment = async () => {
    if (!payPurchase) return;
    const supplierId = payPurchase.supplierId || (suppliers.find((s) => s.name === payPurchase.supplierName)?.id || "");
    if (!supplierId) { toast.error("Supplier not found for this purchase"); return; }
    const amt = Number(payForm.amount) || 0;
    const remaining = Math.max(0, Number(payPurchase.netAmount || 0) - Number(payPurchase.paid || 0));
    if (amt <= 0) { toast.error("Enter a valid amount"); return; }
    if (amt > remaining + 1e-6) { toast.error(`Amount exceeds remaining (Rs ${remaining.toLocaleString()})`); return; }
    setPaySaving(true);
    try {
      await createSupplierPayment({
        date: payForm.date,
        supplierId,
        purchaseId: payPurchase.id,
        amount: amt,
        method: payForm.method,
        reference: payForm.reference,
      });
      toast.success("Payment recorded");
      setPayOpen(false);
      setPayPurchase(null);
      await loadPurchases();
    } catch (e: any) {
      toast.error(typeof e?.message === 'string' ? e.message : 'Failed to record payment');
    } finally {
      setPaySaving(false);
    }
  };

  const loadProducts = async () => {
    try {
      const res = await getProducts();
      const data: ProductLite[] = ((res?.products ?? res) || []).map((p: any) => ({
        id: String(p.id),
        name: p.name || "",
        batchNo: p.batchNo || "",
        purchasePrice: typeof p.purchasePrice === "number" ? p.purchasePrice : Number(p.purchasePrice || 0),
      }));
      setProducts(data);
    } catch (e) {
      console.error(e);
      toast.error("Failed to load products");
    }
  };

  const loadPurchases = async () => {
    try {
      const res = await getPurchases();
      const data: PurchaseSummary[] = ((res?.purchases ?? res) || []).map((p: any) => ({
        id: String(p.id ?? p._id ?? ""),
        purchaseNo: p.purchaseNo || "",
        date: p.date || (p.createdAt ? String(p.createdAt).slice(0, 10) : ""),
        supplierName: p.supplierName || "",
        supplierId: p.supplierId || "",
        referenceNo: p.referenceNo || "",
        itemsCount: Number(p.itemsCount ?? (Array.isArray(p.items) ? p.items.length : 0)),
        items: Array.isArray(p.items)
          ? p.items.map((it: any) => ({
              productId: String(it.productId || it._id || ""),
              productName: it.productName || "",
              batchNo: it.batchNo || "",
              quantity: Number(it.quantity || 0),
              unitPrice: Number(it.unitPrice || 0),
              discount: Number(it.discount || 0),
              tax: Number(it.tax || 0),
              lineTotal: Number(it.lineTotal || 0),
            }))
          : [],
        subtotal: Number(p.subtotal || 0),
        discountTotal: Number(p.discountTotal || 0),
        taxTotal: Number(p.taxTotal || 0),
        netAmount: Number(p.netAmount || 0),
        paid: Number(p.paid || 0),
        balance: Number(p.balance || Math.max(0, Number(p.netAmount || 0) - Number(p.paid || 0))),
        status: (p.status || "posted") as any,
      }));
      setPurchases(data);
    } catch (e) {
      console.error(e);
      toast.error("Failed to load purchases from server");
    }
  };

  useEffect(() => {
    loadSuppliers();
    loadProducts();
    loadPurchases();
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const res = await getCompanyInfo();
        setCompany(res?.company || null);
      } catch {
        // ignore
      }
    })();
  }, []);

  const buildPurchaseHtml = (p: PurchaseSummary) => {
    const headerName = (company?.companyName || "PharmaFlow Pro");
    const addressLine = [company?.address, company?.city, company?.state, company?.pinCode].filter(Boolean).join(", ");
    const idLine = [company?.gstNo ? `GST: ${company.gstNo}` : "", company?.drugLicenseNo ? `DL: ${company.drugLicenseNo}` : "", company?.fssaiLicense ? `FSSAI: ${company.fssaiLicense}` : ""].filter(Boolean).join(" | ");
    const contactLine = [company?.phone ? `Ph: ${company.phone}` : "", company?.email || ""].filter(Boolean).join(" • ");
    const itemsRows = (p.items || [])
      .map(
        (it) => `
        <tr>
          <td class="right">${Number(it.quantity || 0)}</td>
          <td>${it.productName || ''}</td>
          <td class="center">${it.batchNo || '-'}</td>
          <td class="right">${Number(it.tax || 0).toFixed(0)}%</td>
          <td class="right">${Number(it.unitPrice || 0).toFixed(2)}</td>
          <td class="right">${Number(it.discount || 0).toFixed(0)}%</td>
          <td class="right">${Number(it.lineTotal || 0).toFixed(2)}</td>
        </tr>
      `
      )
      .join("");
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>${p.purchaseNo}</title>
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
              <div class="meta"><strong>Supplier:</strong> ${p.supplierName}</div>
              ${p.referenceNo ? `<div class="muted">Ref: ${p.referenceNo}</div>` : ''}
            </div>
          </div>
          <div class="invoice-meta">
            <div class="meta" style="font-size:16px; font-weight:700;">PURCHASE</div>
            <div class="meta">Purchase No: <strong>${p.purchaseNo}</strong></div>
            <div class="meta">Date: ${p.date}</div>
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
                <th class="right" style="width:10%">Line Total</th>
              </tr>
            </thead>
            <tbody>
              ${itemsRows || ''}
            </tbody>
          </table>
        </div>

        <div class="section totals">
          <div class="row"><span>Sub Total</span><span>Rs ${Number(p.subtotal || 0).toFixed(2)}</span></div>
          <div class="row"><span>Discount</span><span>- Rs ${Number(p.discountTotal || 0).toFixed(2)}</span></div>
          <div class="row"><span>Tax</span><span>Rs ${Number(p.taxTotal || 0).toFixed(2)}</span></div>
          <div class="row"><span>Paid</span><span>Rs ${Number(p.paid || 0).toFixed(2)}</span></div>
          <div class="row grand"><span>Net Amount</span><span>Rs ${Number(p.netAmount || 0).toFixed(2)}</span></div>
          <div class="row"><span>Balance</span><span><strong>Rs ${Number(p.balance || Math.max(0, (p.netAmount || 0) - (p.paid || 0))).toFixed(2)}</strong></span></div>
        </div>

        <div class="footer">Generated by PharmaFlow Pro</div>
      </div>
    </body></html>`;
    return html;
  };

  const handlePrintPurchase = (p: PurchaseSummary) => {
    const html = buildPurchaseHtml(p);
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.open();
    w.document.write(html);
    w.document.close();
  };

  const addItemRow = () => {
    setForm((s) => ({
      ...s,
      items: s.items.concat({ productId: "", productName: "", batchNo: "", quantity: "", unitPrice: "", discount: "0", tax: "0" }),
    }));
  };

  const removeItemRow = (idx: number) => {
    setForm((s) => ({ ...s, items: s.items.filter((_, i) => i !== idx) }));
  };

  const handleSubmit = async (opts?: { status?: 'hold' | 'posted' }) => {
    if (saving) return;
    if (!form.supplierName && !form.supplierId) {
      toast.error("Supplier is required");
      return;
    }
    if (form.items.length === 0) {
      toast.error("Add at least one item");
      return;
    }

    const status = opts?.status || (editingId ? 'hold' : 'posted');

    setSaving(true);
    try {
      const items = form.items.map((it) => ({
        productId: it.productId,
        quantity: Number(it.quantity) || 0,
        unitPrice: Number(it.unitPrice) || 0,
        discount: Number(it.discount) || 0,
        tax: Number(it.tax) || 0,
        batchNo: it.batchNo,
      }));
      const payload = {
        supplierName: form.supplierName,
        supplierId: form.supplierId,
        referenceNo: form.referenceNo,
        date: form.date,
        notes: form.notes,
        items,
        status,
      };
      let purchaseId = "";
      if (editingId) {
        const updated = await updatePurchase(editingId, payload);
        purchaseId = String(updated?.purchase?.id || updated?.purchase?._id || editingId);
        toast.success("Purchase updated (hold)");
      } else {
        const created = await createPurchase(payload);
        purchaseId = String(created?.purchase?.id || created?.purchase?._id || "");
        if (status === 'hold') {
          toast.success('Purchase saved on hold');
        } else {
          const paidAmt = Number(form.payAmount) || 0;
          if (paidAmt > 0 && form.supplierId) {
            try {
              await createSupplierPayment({
                date: form.date,
                supplierId: form.supplierId,
                purchaseId,
                amount: paidAmt,
                method: form.payMethod,
                reference: form.payReference,
              });
            } catch (e: any) {
              toast.error(e?.message || "Failed to record initial payment");
            }
          }
          toast.success("Purchase saved and stock updated");
        }
      }

      resetDialog();
      await loadPurchases();
    } catch (err: any) {
      console.error(err);
      toast.error(typeof err?.message === "string" ? err.message : "Failed to save purchase");
    } finally {
      setSaving(false);
    }
  };

  const onPostPurchase = async (p: PurchaseSummary) => {
    try {
      await postPurchase(p.id);
      toast.success('Purchase posted and stock updated');
      await loadPurchases();
    } catch (e: any) {
      toast.error(typeof e?.message === 'string' ? e.message : 'Failed to post purchase');
    }
  };

  const onDeletePurchase = async (p: PurchaseSummary) => {
    try {
      await deletePurchase(p.id);
      toast.success('Deleted');
      await loadPurchases();
    } catch (e: any) {
      toast.error(typeof e?.message === 'string' ? e.message : 'Failed to delete');
    }
  };

  const totalSpend = purchases.reduce((s, p) => s + Number(p.netAmount || 0), 0);
  const remainingPay = purchases
    .filter((p) => p.status !== 'hold')
    .reduce((s, p) => s + Math.max(0, Number(p.netAmount || 0) - Number(p.paid || 0)), 0);

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Purchases</h1>
            <p className="text-muted-foreground">Record supplier purchases and update inventory</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-[#10b981] hover:bg-[#059669] text-white" onClick={() => setDialogOpen(true)}>
                <Plus className="mr-2 h-4 w-4" /> New Purchase
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[1000px] h-[90vh] p-0 flex flex-col">
              <DialogHeader className="p-6 pb-2">
                <DialogTitle>{editingId ? 'Edit Purchase (Hold)' : 'Create Purchase'}</DialogTitle>
                <DialogDescription>Enter details to {editingId ? 'update' : 'post'} a purchase and add stock.</DialogDescription>
              </DialogHeader>
              <ScrollArea className="flex-1 px-6 pb-6">
                <div className="space-y-8 py-4">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="space-y-2">
                      <Label className="text-xs">Supplier</Label>
                      <Select
                        value={form.supplierId}
                        onValueChange={(v) => {
                          const sel = suppliers.find((s) => s.id === v);
                          setForm((s) => ({ ...s, supplierId: v, supplierName: sel?.name || s.supplierName }));
                        }}
                      >
                        <SelectTrigger className="bg-card h-9 text-xs">
                          <SelectValue placeholder="Select supplier (or type below)" />
                        </SelectTrigger>
                        <SelectContent>
                          {suppliers.map((s) => (
                            <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Input placeholder="Or type supplier name" className="bg-background border-none h-9 text-xs" value={form.supplierName} onChange={(e) => setForm((s) => ({ ...s, supplierName: e.target.value, supplierId: s.supplierId }))} />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">Reference No.</Label>
                      <Input placeholder="PO/Ref" className="bg-background border-none h-9 text-xs" value={form.referenceNo} onChange={(e) => setForm((s) => ({ ...s, referenceNo: e.target.value }))} />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">Date</Label>
                      <Input type="date" className="bg-background border-none h-9 text-xs" value={form.date} onChange={(e) => setForm((s) => ({ ...s, date: e.target.value }))} />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">Notes</Label>
                      <Input placeholder="Optional" className="bg-background border-none h-9 text-xs" value={form.notes} onChange={(e) => setForm((s) => ({ ...s, notes: e.target.value }))} />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="space-y-2">
                      <Label className="text-xs">Initial Payment</Label>
                      <Input type="number" placeholder="0" className="bg-background border-none h-9 text-xs" value={form.payAmount} onChange={(e) => setForm((s) => ({ ...s, payAmount: e.target.value }))} />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">Payment Method</Label>
                      <Select value={form.payMethod} onValueChange={(v) => setForm((s) => ({ ...s, payMethod: v }))}>
                        <SelectTrigger className="bg-card border-none h-9 text-xs">
                          <SelectValue placeholder="Select method" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="bank">Bank</SelectItem>
                          <SelectItem value="cash">Cash</SelectItem>
                          <SelectItem value="cheque">Cheque</SelectItem>
                          <SelectItem value="upi">UPI</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label className="text-xs">Payment Reference</Label>
                      <Input placeholder="TXN/CHQ/REF" className="bg-background border-none h-9 text-xs" value={form.payReference} onChange={(e) => setForm((s) => ({ ...s, payReference: e.target.value }))} />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="space-y-2">
                      <Label className="text-xs">To Pay</Label>
                      <Input readOnly className="bg-background border-none h-9 text-xs" value={`Rs ${Math.max(0, (totals.net || 0) - (Number(form.payAmount) || 0)).toLocaleString()}`} />
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between border-b pb-2">
                      <div className="flex items-center gap-2 text-[#10b981] font-semibold">
                        <PackageSearch className="h-4 w-4" />
                        <span className="text-sm">Add Items</span>
                      </div>
                      <Button size="sm" variant="outline" onClick={addItemRow}>Add Item</Button>
                    </div>
                    <div className="rounded-lg border bg-muted/20 overflow-hidden">
                      <Table>
                        <TableHeader className="bg-muted/20">
                          <TableRow className="h-10 text-[10px] font-bold uppercase">
                            <TableHead className="w-[28%]">Product</TableHead>
                            <TableHead>Batch</TableHead>
                            <TableHead className="text-center">Qty</TableHead>
                            <TableHead className="text-right">Unit Price</TableHead>
                            <TableHead className="text-right">Discount %</TableHead>
                            <TableHead className="text-right">Tax %</TableHead>
                            <TableHead className="text-right pr-4">Amount</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {form.items.length === 0 && (
                            <TableRow>
                              <TableCell colSpan={8} className="text-center text-xs text-muted-foreground">Click Add Item to add products to purchase.</TableCell>
                            </TableRow>
                          )}
                          {form.items.map((line, idx) => {
                            const qty = Number(line.quantity) || 0;
                            const price = Number(line.unitPrice) || 0;
                            const disc = Number(line.discount) || 0;
                            const tax = Number(line.tax) || 0;
                            const base = qty * price;
                            const afterDisc = base * (1 - disc / 100);
                            const amt = afterDisc * (1 + tax / 100);
                            return (
                              <TableRow key={idx} className="h-12">
                                <TableCell className="text-xs">
                                  <Select
                                    value={line.productId}
                                    onValueChange={(v) => {
                                      const p = products.find((x) => x.id === v);
                                      setForm((s) => ({
                                        ...s,
                                        items: s.items.map((it, i) => i === idx ? {
                                          ...it,
                                          productId: v,
                                          productName: p?.name || "",
                                          batchNo: p?.batchNo || "",
                                          unitPrice: String(p?.purchasePrice || 0),
                                        } : it)
                                      }));
                                    }}
                                  >
                                    <SelectTrigger className="bg-card h-9 text-xs">
                                      <SelectValue placeholder="Select product" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {products.map((p) => (
                                        <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </TableCell>
                                <TableCell className="text-xs">
                                  <Input
                                    placeholder="Batch No"
                                    value={line.batchNo}
                                    onChange={(e) => {
                                      const v = e.target.value;
                                      setForm((s) => ({ ...s, items: s.items.map((it, i) => i === idx ? { ...it, batchNo: v } : it) }));
                                    }}
                                    className="h-7 w-32 text-xs uppercase font-mono tracking-tighter"
                                  />
                                </TableCell>
                                <TableCell className="text-center">
                                  <Input type="number" min={0} value={line.quantity}
                                    onChange={(e) => {
                                      const v = e.target.value;
                                      setForm((s) => ({ ...s, items: s.items.map((it, i) => i === idx ? { ...it, quantity: v } : it) }));
                                    }} className="h-7 w-16 text-center mx-auto text-xs" />
                                </TableCell>
                                <TableCell className="text-right">
                                  <Input type="number" min={0} value={line.unitPrice}
                                    onChange={(e) => {
                                      const v = e.target.value;
                                      setForm((s) => ({ ...s, items: s.items.map((it, i) => i === idx ? { ...it, unitPrice: v } : it) }));
                                    }} className="h-7 w-24 text-right mx-auto text-xs" />
                                </TableCell>
                                <TableCell className="text-right">
                                  <Input type="number" min={0} value={line.discount}
                                    onChange={(e) => {
                                      const v = e.target.value;
                                      setForm((s) => ({ ...s, items: s.items.map((it, i) => i === idx ? { ...it, discount: v } : it) }));
                                    }} className="h-7 w-20 text-right mx-auto text-xs" />
                                </TableCell>
                                <TableCell className="text-right">
                                  <Input type="number" min={0} value={line.tax}
                                    onChange={(e) => {
                                      const v = e.target.value;
                                      setForm((s) => ({ ...s, items: s.items.map((it, i) => i === idx ? { ...it, tax: v } : it) }));
                                    }} className="h-7 w-20 text-right mx-auto text-xs" />
                                </TableCell>
                                <TableCell className="text-right text-xs font-bold pr-4">Rs {amt.toLocaleString()}</TableCell>
                                <TableCell className="text-right">
                                  <Button variant="ghost" size="icon" onClick={() => removeItemRow(idx)}>
                                    <Trash2 className="h-4 w-4 text-destructive" />
                                  </Button>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="space-y-1">
                      <Label className="text-xs">Subtotal</Label>
                      <Input readOnly value={`Rs ${totals.subtotal.toLocaleString()}`} className="bg-background border-none h-11 text-xs" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Discount Total</Label>
                      <Input readOnly value={`Rs ${totals.discountTotal.toLocaleString()}`} className="bg-background border-none h-11 text-xs" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Tax Total</Label>
                      <Input readOnly value={`Rs ${totals.taxTotal.toLocaleString()}`} className="bg-background border-none h-11 text-xs" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Net Amount</Label>
                      <Input readOnly value={`Rs ${totals.net.toLocaleString()}`} className="bg-background border-none h-11 text-lg font-bold text-[#10b981]" />
                    </div>
                  </div>
                </div>
              </ScrollArea>
              <div className="p-6 pt-2 border-t flex justify-end gap-3 bg-card rounded-b-lg">
                <Button variant="outline" className="text-xs h-9 px-6" onClick={resetDialog}>Cancel</Button>
                {!editingId && (
                  <Button variant="outline" className="text-xs h-9 px-6" onClick={() => handleSubmit({ status: 'hold' })} disabled={saving}>{saving ? "Saving..." : "Save as Hold"}</Button>
                )}
                <Button className="bg-[#10b981] hover:bg-[#059669] text-white text-xs h-9 px-6" onClick={() => handleSubmit({ status: editingId ? 'hold' : 'posted' })} disabled={saving}>{saving ? "Saving..." : (editingId ? "Save" : "Save Purchase" )}</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Total Purchases</p>
                <p className="text-2xl font-bold">{purchases.length}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Total Spend</p>
                <p className="text-2xl font-bold">Rs {totalSpend.toLocaleString()}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Remaining Pay</p>
                <p className="text-2xl font-bold">Rs {remainingPay.toLocaleString()}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle>Purchases ({purchases.length})</CardTitle>
              <div className="relative w-full sm:max-w-[420px]">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search purchases, supplier, reference..."
                  className="pl-10"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Purchase # & Date</TableHead>
                    <TableHead>Supplier & Reference</TableHead>
                    <TableHead className="text-right">Items & Net</TableHead>
                    <TableHead className="text-right">Paid & Balance</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {purchases
                    .filter((p) => {
                      const q = searchTerm.toLowerCase();
                      return p.purchaseNo.toLowerCase().includes(q) || p.supplierName.toLowerCase().includes(q) || p.referenceNo.toLowerCase().includes(q);
                    })
                    .map((p) => (
                      <TableRow key={p.id}>
                        <TableCell>
                          <div className="space-y-1">
                            <p className="font-medium text-foreground text-primary uppercase">{p.purchaseNo}</p>
                            <div className="text-[10px] text-muted-foreground">{p.date}</div>
                            {p.status === 'hold' && (
                              <Badge variant="outline" className="w-fit bg-muted text-muted-foreground border-muted/20">hold</Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <p className="font-medium text-foreground">{p.supplierName}</p>
                            <p className="text-[10px] text-muted-foreground uppercase">{p.referenceNo}</p>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="space-y-0.5">
                            <p className="text-sm font-bold">Rs {p.netAmount.toLocaleString()}</p>
                            <p className="text-[10px] text-muted-foreground uppercase">{p.itemsCount} Items</p>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="space-y-0.5">
                            <p className="text-[12px]">Paid: <span className="font-semibold">Rs {Number(p.paid || 0).toLocaleString()}</span></p>
                            <p className="text-[12px]">Balance: <span className="font-semibold">Rs {Number(p.balance || Math.max(0, (p.netAmount || 0) - (p.paid || 0))).toLocaleString()}</span></p>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button variant="ghost" size="icon" onClick={() => { setViewPurchase(p); setViewOpen(true); }} title="View details">
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => handlePrintPurchase(p)} title="Print / PDF">
                              <Download className="h-4 w-4 text-foreground" />
                            </Button>
                            {p.status === 'hold' ? (
                              <>
                                <Button variant="ghost" size="icon" onClick={() => openEditPurchase(p)} title="Edit hold">
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="icon" onClick={() => onPostPurchase(p)} title="Post / Finalize">
                                  <Truck className="h-4 w-4 text-chart-3" />
                                </Button>
                                <Button variant="ghost" size="icon" onClick={() => onDeletePurchase(p)} title="Delete hold">
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              </>
                            ) : (
                              <Button variant="ghost" size="icon" onClick={() => openPayDialog(p)} title="Record payment">
                                <Banknote className="h-4 w-4 text-primary" />
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

        <Dialog open={payOpen} onOpenChange={setPayOpen}>
          <DialogContent className="sm:max-w-[480px]">
            <DialogHeader>
              <DialogTitle>Record Supplier Payment</DialogTitle>
              <DialogDescription>Apply a payment to this purchase.</DialogDescription>
            </DialogHeader>
            {payPurchase && (
              <div className="grid gap-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Date</Label>
                    <Input type="date" value={payForm.date} onChange={(e) => setPayForm((s) => ({ ...s, date: e.target.value }))} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Method</Label>
                    <Select value={payForm.method} onValueChange={(v) => setPayForm((s) => ({ ...s, method: v }))}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select method" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="bank">Bank</SelectItem>
                        <SelectItem value="cash">Cash</SelectItem>
                        <SelectItem value="cheque">Cheque</SelectItem>
                        <SelectItem value="upi">UPI</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground">Net</p>
                    <p className="font-semibold">Rs {Number(payPurchase.netAmount || 0).toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Paid</p>
                    <p className="font-semibold text-chart-4">Rs {Number(payPurchase.paid || 0).toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Remaining</p>
                    <p className="font-bold text-primary">Rs {Math.max(0, Number(payPurchase.netAmount || 0) - Number(payPurchase.paid || 0)).toLocaleString()}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Amount</Label>
                    <Input
                      type="number"
                      value={payForm.amount}
                      onChange={(e) => {
                        const v = e.target.value;
                        const num = Number(v);
                        const remaining = Math.max(0, Number(payPurchase.netAmount || 0) - Number(payPurchase.paid || 0));
                        if (!Number.isNaN(num) && num > remaining) {
                          setPayForm((s) => ({ ...s, amount: String(remaining.toFixed(2)) }));
                        } else {
                          setPayForm((s) => ({ ...s, amount: v }));
                        }
                      }}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Reference</Label>
                    <Input placeholder="TXN/CHQ/REF" value={payForm.reference} onChange={(e) => setPayForm((s) => ({ ...s, reference: e.target.value }))} />
                  </div>
                </div>
              </div>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setPayOpen(false)}>Cancel</Button>
              <Button onClick={submitSupplierPayment} disabled={paySaving || !payPurchase || !(Number(payForm.amount) > 0)}>
                {paySaving ? 'Saving...' : 'Save Payment'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={viewOpen} onOpenChange={setViewOpen}>
          <DialogContent className="sm:max-w-[900px]">
            <DialogHeader>
              <DialogTitle>Purchase Details</DialogTitle>
              <DialogDescription>Summary of the selected purchase.</DialogDescription>
            </DialogHeader>
            {viewPurchase && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs">Purchase #</Label>
                    <p className="text-sm font-medium">{viewPurchase.purchaseNo}</p>
                  </div>
                  <div>
                    <Label className="text-xs">Date</Label>
                    <p className="text-sm">{viewPurchase.date}</p>
                  </div>
                  <div>
                    <Label className="text-xs">Supplier</Label>
                    <p className="text-sm">{viewPurchase.supplierName}</p>
                  </div>
                  <div>
                    <Label className="text-xs">Reference</Label>
                    <p className="text-sm uppercase">{viewPurchase.referenceNo}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs">Items</Label>
                    <p className="text-sm">{viewPurchase.itemsCount}</p>
                  </div>
                  <div>
                    <Label className="text-xs">Subtotal</Label>
                    <p className="text-sm">Rs {Number(viewPurchase.subtotal || 0).toLocaleString()}</p>
                  </div>
                  <div>
                    <Label className="text-xs">Discount Total</Label>
                    <p className="text-sm">Rs {Number(viewPurchase.discountTotal || 0).toLocaleString()}</p>
                  </div>
                  <div>
                    <Label className="text-xs">Tax Total</Label>
                    <p className="text-sm">Rs {Number(viewPurchase.taxTotal || 0).toLocaleString()}</p>
                  </div>
                  <div>
                    <Label className="text-xs">Net Amount</Label>
                    <p className="text-sm font-semibold">Rs {Number(viewPurchase.netAmount || 0).toLocaleString()}</p>
                  </div>
                  <div>
                    <Label className="text-xs">Paid</Label>
                    <p className="text-sm">Rs {Number(viewPurchase.paid || 0).toLocaleString()}</p>
                  </div>
                  <div>
                    <Label className="text-xs">Balance</Label>
                    <p className="text-sm">Rs {Number(viewPurchase.balance || Math.max(0, (viewPurchase.netAmount || 0) - (viewPurchase.paid || 0))).toLocaleString()}</p>
                  </div>
                </div>
                <div className="border rounded-md overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Product</TableHead>
                        <TableHead>Batch</TableHead>
                        <TableHead className="text-center">Qty</TableHead>
                        <TableHead className="text-right">Rate</TableHead>
                        <TableHead className="text-right">Disc %</TableHead>
                        <TableHead className="text-right">Tax %</TableHead>
                        <TableHead className="text-right">Line Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {Array.isArray(viewPurchase.items) && viewPurchase.items.length > 0 ? (
                        viewPurchase.items.map((it, i) => (
                          <TableRow key={i}>
                            <TableCell className="text-xs">{it.productName}</TableCell>
                            <TableCell className="text-xs uppercase">{it.batchNo || '-'}</TableCell>
                            <TableCell className="text-center text-xs">{Number(it.quantity || 0)}</TableCell>
                            <TableCell className="text-right text-xs">Rs {Number(it.unitPrice || 0).toFixed(2)}</TableCell>
                            <TableCell className="text-right text-xs">{Number(it.discount || 0)}%</TableCell>
                            <TableCell className="text-right text-xs">{Number(it.tax || 0)}%</TableCell>
                            <TableCell className="text-right text-xs font-medium">Rs {Number(it.lineTotal || 0).toFixed(2)}</TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center text-xs text-muted-foreground">No items</TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
};

export default Purchases;
