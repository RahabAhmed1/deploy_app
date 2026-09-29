import { useEffect, useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
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
import { getProducts, getPurchases, createStockMovement, updateProduct } from "@/lib/api";
import { formatCurrency } from "@/lib/currency";
import { toast } from "sonner";
import { Search, Filter, Download, AlertTriangle, Package, Warehouse } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";


type Product = {
  id: string;
  name: string;
  genericName?: string;
  barcode?: string;
  manufacturer: string;
  category: string;
  batchNo: string;
  expiryDate: string;
  manufacturingDate: string;
  mrp: number;
  purchasePrice: number;
  stockQuantity: number;
  minStockLevel: number;
  unit: string;
  gstRate: number;
  createdAt?: string;
  updatedAt?: string;
};

const Inventory = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [expiryFilter, setExpiryFilter] = useState("all");
  const [products, setProducts] = useState<Product[]>([]);
  const [writeOffOpen, setWriteOffOpen] = useState(false);
  const [writeOffProduct, setWriteOffProduct] = useState<Product | null>(null);
  const [writeOffForm, setWriteOffForm] = useState({ qty: "", date: new Date().toISOString().slice(0,10), note: "" });

  const loadProducts = async () => {
    try {
      const res = await getProducts();
      const data: Product[] = (res?.products || []).map((p: any) => ({
        id: String(p.id),
        name: p.name || "",
        genericName: p.genericName || "",
        barcode: p.barcode || "",
        manufacturer: p.manufacturer || "",
        category: p.category || "",
        batchNo: p.batchNo || "",
        expiryDate: p.expiryDate || "",
        manufacturingDate: p.manufacturingDate || "",
        mrp: typeof p.mrp === "number" ? p.mrp : Number(p.mrp || 0),
        purchasePrice: typeof p.purchasePrice === "number" ? p.purchasePrice : Number(p.purchasePrice || 0),
        stockQuantity: typeof p.stockQuantity === "number" ? p.stockQuantity : Number(p.stockQuantity || 0),
        minStockLevel: typeof p.minStockLevel === "number" ? p.minStockLevel : Number(p.minStockLevel || 0),
        unit: p.unit || "",
        gstRate: typeof p.gstRate === "number" ? p.gstRate : Number(p.gstRate || 0),
        createdAt: p.createdAt || p.created_at || "",
        updatedAt: p.updatedAt || p.updated_at || "",
      }));
      setProducts(data);
    } catch (e) {
      console.error(e);
      toast.error("Failed to load products");
    }
  };

  useEffect(() => {
    loadProducts();
  }, []);

  const filteredProducts = products.filter((product) => {
    const term = searchTerm.toLowerCase();
    const matchesSearch =
      product.name.toLowerCase().includes(term) ||
      product.batchNo.toLowerCase().includes(term);
    const matchesCategory = categoryFilter === "all" || product.category === categoryFilter;
    const matchesExpiry = (function(){
      if (expiryFilter === "all") return true;
      const exp = product.expiryDate ? Date.parse(product.expiryDate) : NaN;
      const now = Date.now();
      if (expiryFilter === "expired") return Number.isFinite(exp) && exp < now;
      const days = Number(expiryFilter);
      if (!Number.isFinite(exp) || !Number.isFinite(days)) return true;
      return exp >= now && (exp - now) <= days * 24 * 60 * 60 * 1000;
    })();
    return matchesSearch && matchesCategory && matchesExpiry;
  });

  const categories = [
    ...new Set(
      products
        .map((p) => (typeof p.category === "string" ? p.category.trim() : ""))
        .filter((c) => c)
    ),
  ];

  const totalStockValue = products.reduce(
    (sum, p) => sum + (Number(p.stockQuantity || 0) * Number(p.purchasePrice || 0)),
    0
  );
  const lowStockCount = products.filter((p) => Number(p.stockQuantity || 0) <= Number(p.minStockLevel || 0)).length;


  const exportStockReport = async () => {
    try {
      const purRes = await getPurchases().catch(() => null);
      const purchases = (purRes?.purchases || []) as Array<any>;

      const allowedIds = new Set(filteredProducts.map((p) => String(p.id)));

      const headers = [
        "Product",
        "Generic Name",
        "Barcode",
        "Manufacturer",
        "Category",
        "Batch No",
        "Unit",
        "Mfg Date",
        "Expiry",
        "Product Added Date",
        "Purchase No",
        "Purchase Date",
        "Supplier",
        "Reference No",
        "Purchase Status",
        "Purchase Item Batch",
        "Quantity",
        "Unit Price",
        "Discount %",
        "Tax %",
        "Line Total",
        "TOTAL Purchased Qty",
        "TOTAL Purchased Amount",
        "Current Stock Qty",
        "Min Stock",
        "Purchase Price",
        "MRP",
        "GST %",
        "Stock Value",
      ];

      const rows: string[][] = [];

      for (const p of filteredProducts) {
        const pid = String(p.id);
        if (!pid || !allowedIds.has(pid)) continue;

        const createdTs = p.createdAt ? Date.parse(p.createdAt) : NaN;
        const addedDate = Number.isFinite(createdTs) ? new Date(createdTs).toISOString().slice(0, 10) : String(p.createdAt || "");

        const stockValue = Number(p.stockQuantity || 0) * Number(p.purchasePrice || 0);

        const lines: Array<{ ts: number; purchase: any; item: any }> = [];
        for (const pur of purchases) {
          const items = Array.isArray(pur?.items) ? pur.items : [];
          for (const it of items) {
            const itPid = String(it?.productId || "");
            if (!itPid || itPid !== pid) continue;
            const dateRaw = pur?.date || pur?.createdAt || pur?.created_at || "";
            const ts = dateRaw ? Date.parse(dateRaw) : NaN;
            lines.push({ ts: Number.isFinite(ts) ? ts : 0, purchase: pur, item: it });
          }
        }

        lines.sort((a, b) => b.ts - a.ts);

        let totalQty = 0;
        let totalAmt = 0;

        for (const l of lines) {
          const qty = Number(l.item?.quantity || 0);
          const unitPrice = Number(l.item?.unitPrice || 0);
          const discount = Number(l.item?.discount || 0);
          const tax = Number(l.item?.tax || 0);
          const lineTotal = Number(l.item?.lineTotal || 0);
          totalQty += qty;
          totalAmt += lineTotal;

          const pur = l.purchase || {};
          const purNo = String(pur.purchaseNo || "");
          const purDateRaw = pur.date || pur.createdAt || pur.created_at || "";
          const purTs = purDateRaw ? Date.parse(purDateRaw) : NaN;
          const purDate = Number.isFinite(purTs) ? new Date(purTs).toISOString().slice(0, 10) : String(purDateRaw || "");

          rows.push([
            p.name,
            p.genericName || "",
            p.barcode || "",
            p.manufacturer,
            p.category,
            p.batchNo,
            p.unit,
            p.manufacturingDate,
            p.expiryDate,
            addedDate,
            purNo,
            purDate,
            String(pur.supplierName || ""),
            String(pur.referenceNo || ""),
            String(pur.status || ""),
            String(l.item?.batchNo || ""),
            String(qty),
            String(unitPrice),
            String(discount),
            String(tax),
            String(lineTotal),
            "",
            "",
            String(p.stockQuantity),
            String(p.minStockLevel),
            String(p.purchasePrice),
            String(p.mrp),
            String(p.gstRate),
            String(stockValue),
          ]);
        }

        rows.push([
          p.name,
          p.genericName || "",
          p.barcode || "",
          p.manufacturer,
          p.category,
          p.batchNo,
          p.unit,
          p.manufacturingDate,
          p.expiryDate,
          addedDate,
          "TOTAL",
          "",
          "",
          "",
          "",
          "",
          "",
          "",
          "",
          "",
          "",
          String(totalQty),
          String(totalAmt),
          String(p.stockQuantity),
          String(p.minStockLevel),
          String(p.purchasePrice),
          String(p.mrp),
          String(p.gstRate),
          String(stockValue),
        ]);
      }

      const csv = [headers, ...rows]
        .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))
        .join("\n");
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `inventory_stock_detailed_${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      return;
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || "Failed to export report");
    }
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Inventory</h1>
            <p className="text-muted-foreground">Track stock levels</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={exportStockReport}>
              <Download className="mr-2 h-4 w-4" />
              Export Report
            </Button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <Package className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{products.length}</p>
                  <p className="text-sm text-muted-foreground">Total Products</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-chart-1/10">
                  <Warehouse className="h-5 w-5 text-chart-1" />
                </div>
                <div>
                  <p className="text-2xl font-bold">
                    {formatCurrency(totalStockValue)}
                  </p>
                  <p className="text-sm text-muted-foreground">Stock Value</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-destructive/10">
                  <AlertTriangle className="h-5 w-5 text-destructive" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{lowStockCount}</p>
                  <p className="text-sm text-muted-foreground">Low Stock Items</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-chart-4/10">
                  <Package className="h-5 w-5 text-chart-4" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{categories.length}</p>
                  <p className="text-sm text-muted-foreground">Categories</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
            {/* Filters */}
            <Card>
              <CardContent className="p-4">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder="Search products, batch numbers..."
                      className="pl-10"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </div>
                  <div className="flex gap-2">
                    <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                      <SelectTrigger className="w-[150px]">
                        <Filter className="mr-2 h-4 w-4" />
                        <SelectValue placeholder="Category" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Categories</SelectItem>
                        {categories.map((cat) => (
                          <SelectItem key={cat} value={cat}>
                            {cat}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select value={expiryFilter} onValueChange={setExpiryFilter}>
                      <SelectTrigger className="w-[170px]">
                        <SelectValue placeholder="Expiry Range" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Any Expiry</SelectItem>
                        <SelectItem value="expired">Expired</SelectItem>
                        <SelectItem value="30">Next 30 Days</SelectItem>
                        <SelectItem value="60">Next 60 Days</SelectItem>
                        <SelectItem value="90">Next 90 Days</SelectItem>
                        <SelectItem value="180">Next 180 Days</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Stock Table */}
            <Card>
              <CardHeader>
                <CardTitle>Current Stock Levels</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Product</TableHead>
                        <TableHead>Batch No.</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead className="text-right">Stock Qty</TableHead>
                        <TableHead>Stock Level</TableHead>
                        <TableHead className="text-right">Value</TableHead>
                        <TableHead>Expiry</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredProducts.map((product) => {
                        const stockPercentage = Math.min(
                          (product.stockQuantity / (product.minStockLevel * 2)) * 100,
                          100
                        );
                        const isLowStock = product.stockQuantity <= product.minStockLevel;
                        const isExpired = product.expiryDate ? Date.parse(product.expiryDate) < Date.now() : false;
                        return (
                          <TableRow key={product.id}>
                            <TableCell>
                              <div>
                                <p className="font-medium text-foreground">{product.name}</p>
                                <p className="text-xs text-muted-foreground">{product.manufacturer}</p>
                              </div>
                            </TableCell>
                            <TableCell className="font-mono text-sm">{product.batchNo}</TableCell>
                            <TableCell>{product.category}</TableCell>
                            <TableCell className="text-right">
                              <span className={isLowStock ? "text-destructive font-semibold" : ""}>
                                {product.stockQuantity}
                              </span>
                              <span className="text-muted-foreground"> {product.unit}</span>
                            </TableCell>
                            <TableCell>
                              <div className="w-32 space-y-1">
                                <Progress
                                  value={stockPercentage}
                                  className={`h-2 ${isLowStock ? "[&>div]:bg-destructive" : ""}`}
                                />
                                <p className="text-xs text-muted-foreground">
                                  Min: {product.minStockLevel}
                                </p>
                              </div>
                            </TableCell>
                            <TableCell className="text-right">
                              Rs {(product.stockQuantity * product.purchasePrice).toLocaleString()}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center justify-between gap-2">
                                <span>{product.expiryDate}</span>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => { setWriteOffProduct(product); setWriteOffForm({ qty: "", date: new Date().toISOString().slice(0,10), note: "" }); setWriteOffOpen(true); }}
                                  disabled={!product.expiryDate || Number(product.stockQuantity || 0) <= 0}
                                >
                                  Write-off
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
            <Dialog open={writeOffOpen} onOpenChange={setWriteOffOpen}>
              <DialogContent className="sm:max-w-[420px]">
                <DialogHeader>
                  <DialogTitle>Expiry Write-off</DialogTitle>
                  <DialogDescription>Reduce stock for expired/near-expiry items and log an adjustment.</DialogDescription>
                </DialogHeader>
                {writeOffProduct && (
                  <div className="grid gap-3">
                    <div>
                      <p className="text-xs text-muted-foreground">Product</p>
                      <p className="font-medium">{writeOffProduct.name} — {writeOffProduct.batchNo}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <p className="text-xs text-muted-foreground">Date</p>
                        <Input type="date" value={writeOffForm.date} onChange={(e) => setWriteOffForm((s) => ({ ...s, date: e.target.value }))} />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Qty to write-off</p>
                        <Input type="number" value={writeOffForm.qty} onChange={(e) => setWriteOffForm((s) => ({ ...s, qty: e.target.value }))} />
                      </div>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Note</p>
                      <Input placeholder="Optional" value={writeOffForm.note} onChange={(e) => setWriteOffForm((s) => ({ ...s, note: e.target.value }))} />
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" onClick={() => setWriteOffOpen(false)}>Cancel</Button>
                      <Button onClick={async () => {
                        const qty = Number(writeOffForm.qty);
                        if (!writeOffProduct || !qty || qty <= 0) { toast.error("Enter a valid quantity"); return; }
                        if (qty > Number(writeOffProduct.stockQuantity || 0)) { toast.error("Quantity exceeds stock"); return; }
                        try {
                          await createStockMovement({
                            date: writeOffForm.date,
                            productId: writeOffProduct.id,
                            quantity: -qty,
                            type: 'expiry_writeoff',
                            reference: writeOffProduct.batchNo,
                            note: writeOffForm.note,
                          } as any);
                        } catch (e) { console.error(e); }
                        try {
                          const newQty = Math.max(0, Number(writeOffProduct.stockQuantity || 0) - qty);
                          await updateProduct(writeOffProduct.id, { stockQuantity: newQty });
                        } catch (e) { console.error(e); }
                        setWriteOffOpen(false);
                        await loadProducts();
                      }}>Save</Button>
                    </div>
                  </div>
                )}
              </DialogContent>
            </Dialog>
        </div>
      </div>
    </MainLayout>
  );
};

export default Inventory;
