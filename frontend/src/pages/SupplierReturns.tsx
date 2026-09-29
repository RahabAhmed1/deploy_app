import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatsCard } from "@/components/dashboard/StatsCard";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
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
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useEffect, useMemo, useState } from "react";
import { getSupplierReturns, createSupplierReturn, updateSupplierReturnStatus, getProducts, getSuppliers } from "@/lib/api";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Plus, Search, CheckCircle2, AlertTriangle, PackageSearch, Undo2, Truck, Trash2 } from "lucide-react";

 type SupplierReturnSummary = {
  id: string;
  date: string;
  supplier: string;
  supplierId?: string;
  referenceNo: string;
  reason: string;
  itemsCount: number;
  value: number;
  status: "pending" | "verified" | "rejected";
};

 type ProductLite = {
  id: string;
  name: string;
  batchNo: string;
  purchasePrice: number;
};

const SupplierReturns = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [returns, setReturns] = useState<SupplierReturnSummary[]>([]);
  const [viewOpen, setViewOpen] = useState(false);
  const [viewReturn, setViewReturn] = useState<SupplierReturnSummary | null>(null);
  const [products, setProducts] = useState<ProductLite[]>([]);
  const [suppliers, setSuppliers] = useState<Array<{ id: string; name: string }>>([]);

  const [form, setForm] = useState({
    supplier: "",
    supplierId: "",
    referenceNo: "",
    reason: "",
    date: new Date().toISOString().split("T")[0],
    notes: "",
    items: [] as Array<{ productId: string; productName: string; batchNo: string; unitPrice: number; returnQty: string }>,
  });

  const totalItems = useMemo(
    () => form.items.reduce((s, it) => s + (Number(it.returnQty) || 0), 0),
    [form.items]
  );
  const totalValue = useMemo(() => {
    return form.items.reduce((s, it) => s + (Number(it.returnQty) || 0) * (Number(it.unitPrice) || 0), 0);
  }, [form.items]);

  const loadReturns = async () => {
    try {
      const res = await getSupplierReturns();
      const data: SupplierReturnSummary[] = ((res?.returns ?? res) || []).map((r: any) => ({
        id: String(r.id ?? r._id ?? r.code ?? ""),
        date: r.date || (r.createdAt ? String(r.createdAt).slice(0, 10) : ""),
        supplier: r.supplier ?? "",
        referenceNo: r.referenceNo ?? "",
        reason: r.reason ?? "",
        itemsCount: Number(r.itemsCount ?? (Array.isArray(r.items) ? r.items.length : 0)),
        value: typeof r.value === "number" ? r.value : Number(r.value ?? r.amount ?? 0),
        status: (r.status ?? "pending").toLowerCase(),
      }));
      setReturns(data);
    } catch (e) {
      console.error(e);
      toast.error("Failed to load supplier returns from server");
    }
  };

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

  useEffect(() => {
    loadReturns();
    loadProducts();
    loadSuppliers();
  }, []);

  const addItemRow = () => {
    setForm((s) => ({
      ...s,
      items: s.items.concat({ productId: "", productName: "", batchNo: "", unitPrice: 0, returnQty: "" }),
    }));
  };
  const removeItemRow = (idx: number) => {
    setForm((s) => ({ ...s, items: s.items.filter((_, i) => i !== idx) }));
  };

  const handleSubmit = async () => {
    if (saving) return;
    if (!form.supplier && !form.supplierId) {
      toast.error("Supplier is required");
      return;
    }
    const items = form.items
      .map((it) => ({ productId: it.productId, returnQty: Number(it.returnQty) || 0 }))
      .filter((it) => it.productId && it.returnQty > 0);
    if (items.length === 0) {
      toast.error("Enter return quantity for at least one item");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        supplier: form.supplier,
        supplierId: form.supplierId || undefined,
        referenceNo: form.referenceNo,
        reason: form.reason,
        date: form.date,
        notes: form.notes,
        items,
      };
      await createSupplierReturn(payload);
      toast.success("Supplier return submitted");
      setDialogOpen(false);
      setForm({ supplier: "", supplierId: "", referenceNo: "", reason: "", date: new Date().toISOString().split("T")[0], notes: "", items: [] });
      await loadReturns();
    } catch (err: any) {
      console.error(err);
      const msg = typeof err?.message === "string" ? err.message : "Failed to submit supplier return";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const statusStyles: Record<string, string> = {
    pending: "bg-amber-100 text-amber-700 border-amber-200",
    verified: "bg-blue-100 text-blue-700 border-blue-200",
    rejected: "bg-red-100 text-red-700 border-red-200",
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Supplier Returns</h1>
            <p className="text-muted-foreground">Return goods to suppliers and track stock-out adjustments</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-[#10b981] hover:bg-[#059669] text-white" onClick={() => setDialogOpen(true)}>
                <Plus className="mr-2 h-4 w-4" /> New Supplier Return
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[900px] h-[90vh] p-0 flex flex-col">
              <DialogHeader className="p-6 pb-2">
                <DialogTitle>Initiate Supplier Return</DialogTitle>
                <DialogDescription>Record items to send back to the supplier.</DialogDescription>
              </DialogHeader>
              <ScrollArea className="flex-1 px-6 pb-6">
                <div className="space-y-8 py-4">
                  {/* Meta */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label className="text-xs">Supplier</Label>
                      <Select
                        value={form.supplierId}
                        onValueChange={(v) => {
                          const sel = suppliers.find((s) => s.id === v);
                          setForm((s) => ({ ...s, supplierId: v, supplier: sel?.name || s.supplier }));
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
                      <Input placeholder="Or type supplier name" className="bg-background border-none h-9 text-xs" value={form.supplier} onChange={(e) => setForm((s) => ({ ...s, supplier: e.target.value, supplierId: s.supplierId }))} />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">Reference No.</Label>
                      <Input placeholder="PO/Ref" className="bg-background border-none h-9 text-xs" value={form.referenceNo} onChange={(e) => setForm((s) => ({ ...s, referenceNo: e.target.value }))} />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">Date</Label>
                      <Input type="date" className="bg-background border-none h-9 text-xs" value={form.date} onChange={(e) => setForm((s) => ({ ...s, date: e.target.value }))} />
                    </div>
                  </div>

                  {/* Items */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between border-b pb-2">
                      <div className="flex items-center gap-2 text-[#10b981] font-semibold">
                        <PackageSearch className="h-4 w-4" />
                        <span className="text-sm">Select Items to Return</span>
                      </div>
                      <Button size="sm" variant="outline" onClick={addItemRow}>Add Item</Button>
                    </div>
                    <div className="rounded-lg border bg-muted/20 overflow-hidden">
                      <Table>
                        <TableHeader className="bg-muted/20">
                          <TableRow className="h-10 text-[10px] font-bold uppercase">
                            <TableHead className="w-[35%]">Product</TableHead>
                            <TableHead>Batch</TableHead>
                            <TableHead className="text-right">Unit Price</TableHead>
                            <TableHead className="text-center">Qty</TableHead>
                            <TableHead className="text-right pr-4">Amount</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {form.items.length === 0 && (
                            <TableRow>
                              <TableCell colSpan={6} className="text-center text-xs text-muted-foreground">Click Add Item to add products for return.</TableCell>
                            </TableRow>
                          )}
                          {form.items.map((line, idx) => {
                            const amt = (Number(line.returnQty) || 0) * (Number(line.unitPrice) || 0);
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
                                          unitPrice: Number(p?.purchasePrice || 0),
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
                                <TableCell className="text-xs uppercase font-mono tracking-tighter">{line.batchNo}</TableCell>
                                <TableCell className="text-right text-xs">Rs {Number(line.unitPrice || 0).toLocaleString()}</TableCell>
                                <TableCell className="text-center">
                                  <Input type="number" min={0} value={line.returnQty}
                                    onChange={(e) => {
                                      const v = e.target.value;
                                      setForm((s) => ({ ...s, items: s.items.map((it, i) => i === idx ? { ...it, returnQty: v } : it) }));
                                    }} className="h-7 w-16 text-center mx-auto text-xs" />
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

                  {/* Footer summary */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label className="text-xs">Total Items</Label>
                      <Input readOnly value={String(totalItems)} className="bg-background border-none h-11 text-xs" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">Expected Credit</Label>
                      <Input readOnly value={`Rs ${Number(totalValue || 0).toLocaleString()}`} className="bg-background border-none h-11 text-lg font-bold text-[#10b981]" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">Notes</Label>
                      <Textarea placeholder="Additional notes..." className="bg-background border-none resize-none h-11 text-xs" value={form.notes} onChange={(e) => setForm((s) => ({ ...s, notes: e.target.value }))} />
                    </div>
                  </div>
                </div>
              </ScrollArea>
              <div className="p-6 pt-2 border-t flex justify-end gap-3 bg-card rounded-b-lg">
                <Button variant="outline" className="text-xs h-9 px-6" onClick={() => setDialogOpen(false)}>Cancel</Button>
                <Button className="bg-[#10b981] hover:bg-[#059669] text-white text-xs h-9 px-6 font-semibold" disabled={saving} onClick={handleSubmit}>
                  {saving ? "Submitting..." : "Submit Supplier Return"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatsCard title="Total Supplier Returns" value={`${returns.length}`} subtitle="Processed" icon={Truck} variant="primary" />
          <StatsCard title="Pending" value={`${returns.filter(r => r.status === 'pending').length}`} subtitle="Awaiting verification" icon={AlertTriangle} variant="warning" />
          <StatsCard title="Verified" value={`${returns.filter(r => r.status === 'verified').length}`} subtitle="Stock adjusted" icon={CheckCircle2} />
          <StatsCard title="Rejected" value={`${returns.filter(r => r.status === 'rejected').length}`} subtitle="Not accepted" icon={AlertTriangle} variant="danger" />
        </div>

        {/* Returns Table */}
        <Card>
          <CardHeader>
            <CardTitle>Supplier Return Requests</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Return ID & Date</TableHead>
                    <TableHead>Supplier & Reference</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead className="text-right">Items & Value</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {returns
                    .filter((r) => {
                      const q = searchTerm.toLowerCase();
                      return r.supplier.toLowerCase().includes(q) || r.id.toLowerCase().includes(q) || r.referenceNo.toLowerCase().includes(q);
                    })
                    .map((ret) => (
                      <TableRow key={ret.id}>
                        <TableCell>
                          <div className="space-y-1">
                            <p className="font-medium text-foreground text-primary uppercase">{ret.id}</p>
                            <div className="text-[10px] text-muted-foreground">{ret.date}</div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <p className="font-medium text-foreground">{ret.supplier}</p>
                            <p className="text-[10px] text-muted-foreground uppercase">{ret.referenceNo}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="text-xs text-muted-foreground">{ret.reason}</span>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="space-y-0.5">
                            <p className="text-sm font-bold">Rs {ret.value.toLocaleString()}</p>
                            <p className="text-[10px] text-muted-foreground uppercase">{ret.itemsCount} Items</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge className={cn("px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider", statusStyles[ret.status])}>
                            {ret.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button variant="ghost" size="icon" onClick={() => { setViewReturn(ret); setViewOpen(true); }}>
                              <Search className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={async () => {
                              try {
                                await updateSupplierReturnStatus(ret.id, 'verified');
                                toast.success('Marked verified');
                                await loadReturns();
                              } catch (err) {
                                console.error(err);
                                toast.error('Failed to update status');
                              }
                            }}>
                              <CheckCircle2 className="h-4 w-4 text-primary" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <Dialog open={viewOpen} onOpenChange={setViewOpen}>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle>Supplier Return Details</DialogTitle>
              <DialogDescription>View supplier return information</DialogDescription>
            </DialogHeader>
            {viewReturn && (
              <div className="grid gap-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Return ID</p>
                    <p className="font-medium">{viewReturn.id}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Date</p>
                    <p className="font-medium">{viewReturn.date}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Supplier</p>
                    <p className="font-medium">{viewReturn.supplier}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Reference</p>
                    <p className="font-medium">{viewReturn.referenceNo}</p>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Items</p>
                    <p className="font-medium">{viewReturn.itemsCount}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Value</p>
                    <p className="font-semibold">Rs {viewReturn.value.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Status</p>
                    <Badge variant="outline" className="capitalize">{viewReturn.status}</Badge>
                  </div>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Reason</p>
                  <p className="font-medium">{viewReturn.reason}</p>
                </div>
              </div>
            )}
            <div className="flex justify-end">
              <Button variant="outline" onClick={() => setViewOpen(false)}>Close</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
};

export default SupplierReturns;
