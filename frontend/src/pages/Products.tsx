import { useEffect, useRef, useState } from "react";
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { DateField } from "@/components/ui/date-field";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { createProduct, getProducts, updateProduct, deleteProduct, getSuppliers, createPurchase, createSupplierPayment, getProductSalesHistory } from "@/lib/api";
import { toast } from "sonner";
import { Plus, Search, Filter, Download, Edit, Trash2, PackagePlus, History, Upload, ScanLine, RefreshCw } from "lucide-react";
import { formatCurrency } from "@/lib/currency";

const statusStyles = {
  active: "bg-primary/10 text-primary border-primary/20",
  "low-stock": "bg-chart-4/10 text-chart-4 border-chart-4/20",
  expired: "bg-destructive/10 text-destructive border-destructive/20",
  discontinued: "bg-muted text-muted-foreground border-muted/20",
};

const defaultCategories = ["Tablet", "Syrup", "Injection", "Ointment", "Capsule", "Drops", "Cream", "Lotion", "Other"];

type Product = {
  id: string;
  productId: string;
  barcode?: string;
  name: string;
  genericName: string;
  manufacturer: string;
  supplierId?: string;
  supplierName?: string;
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
  status: "active" | "low-stock" | "expired" | "discontinued";
};

const Products = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [productForm, setProductForm] = useState({
    productId: "",
    barcode: "",
    name: "",
    genericName: "",
    manufacturer: "",
    supplierId: "",
    supplierName: "",
    category: "",
    unitsPerStrip: "10",
    stripPrice: "",
    batchNo: "",
    manufacturingDate: "",
    expiryDate: "",
    mrp: "",
    purchasePrice: "",
    gstRate: "",
    stockQuantity: "",
    minStockLevel: "",
    unit: "",
    packMrp: "",
  });
  const [supplierPickerOpen, setSupplierPickerOpen] = useState(false);
  const [supplierQuery, setSupplierQuery] = useState("");
  const [categoryPickerOpen, setCategoryPickerOpen] = useState(false);
  const [categoryQuery, setCategoryQuery] = useState("");
  const [suppliers, setSuppliers] = useState<Array<{ id: string; name: string }>>([]);

  const [scanOpen, setScanOpen] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [scanLoading, setScanLoading] = useState(false);
  const scanVideoRef = useRef<HTMLVideoElement | null>(null);
  const scanStreamRef = useRef<MediaStream | null>(null);
  const scanRafRef = useRef<number | null>(null);

  // Update Stock dialog state
  const [stockDialogOpen, setStockDialogOpen] = useState(false);
  const [stockSaving, setStockSaving] = useState(false);
  const [stockProduct, setStockProduct] = useState<Product | null>(null);
  const [stockForm, setStockForm] = useState({
    supplierId: "",
    date: new Date().toISOString().slice(0, 10),
    referenceNo: "",
    quantity: "",
    unitPrice: "",
    discount: "0",
    tax: "0",
    batchNo: "",
    expiryDate: "",
  });

  // Bulk Update Stock dialog state
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false);
  const [bulkSaving, setBulkSaving] = useState(false);
  const [bulkSearch, setBulkSearch] = useState("");
  const [bulkSearchIndex, setBulkSearchIndex] = useState(0);
  const [salesHistoryOpen, setSalesHistoryOpen] = useState(false);
  const [salesHistoryLoading, setSalesHistoryLoading] = useState(false);
  const [salesHistoryProduct, setSalesHistoryProduct] = useState<Product | null>(null);
  const [salesHistoryRows, setSalesHistoryRows] = useState<any[]>([]);
  const [bulkForm, setBulkForm] = useState<{
    supplierId: string;
    date: string;
    purchaseNo?: string;
    referenceNo: string;
    items: Array<{ productId: string; name: string; quantity: string; unitPrice: string; discount: string; tax: string; batchNo: string; expiryDate: string }>;
    payAmount?: string;
    payMethod?: string;
    payReference?: string;
  }>({
    supplierId: "",
    date: new Date().toISOString().slice(0, 10),
    purchaseNo: "",
    referenceNo: "",
    items: [],
    payAmount: "",
    payMethod: "bank",
    payReference: "",
  });

  const bulkSupplierRef = useRef<HTMLButtonElement | null>(null);
  const bulkDateRef = useRef<HTMLButtonElement | null>(null);
  const bulkReferenceRef = useRef<HTMLInputElement | null>(null);
  const bulkPayAmountRef = useRef<HTMLInputElement | null>(null);
  const bulkPayMethodRef = useRef<HTMLButtonElement | null>(null);
  const bulkPayReferenceRef = useRef<HTMLInputElement | null>(null);
  const bulkSearchRef = useRef<HTMLInputElement | null>(null);
  const importFileRef = useRef<HTMLInputElement | null>(null);

  const normalizeHeader = (s: string) =>
    String(s || "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, " ");

  const parseCsvRows = (text: string): string[][] => {
    const rows: string[][] = [];
    let row: string[] = [];
    let field = "";
    let inQuotes = false;

    const pushField = () => {
      row.push(field);
      field = "";
    };
    const pushRow = () => {
      if (row.length === 0 && field === "") return;
      pushField();
      rows.push(row.map((v) => (typeof v === "string" ? v.trim() : String(v))));
      row = [];
    };

    const input = String(text || "");
    for (let i = 0; i < input.length; i++) {
      const ch = input[i];
      if (inQuotes) {
        if (ch === '"') {
          const next = input[i + 1];
          if (next === '"') {
            field += '"';
            i++;
          } else {
            inQuotes = false;
          }
        } else {
          field += ch;
        }
      } else {
        if (ch === '"') {
          inQuotes = true;
        } else if (ch === ",") {
          pushField();
        } else if (ch === "\n") {
          pushRow();
        } else if (ch === "\r") {
          const next = input[i + 1];
          if (next === "\n") i++;
          pushRow();
        } else {
          field += ch;
        }
      }
    }
    if (field !== "" || row.length > 0) pushRow();

    const cleaned = rows.filter((r) => r.some((c) => String(c || "").trim() !== ""));
    return cleaned;
  };

  const parseNumber = (v: any) => {
    if (v === undefined || v === null) return undefined;
    const s = String(v).trim();
    if (!s) return undefined;
    const n = Number(s);
    return Number.isFinite(n) ? n : undefined;
  };

  const parseDate = (v: any) => {
    if (v === undefined || v === null) return undefined;
    const s = String(v).trim();
    if (!s) return undefined;
    const d = new Date(s);
    if (Number.isNaN(d.getTime())) return undefined;
    return d.toISOString().slice(0, 10);
  };

  const handleImportProductsCsv = async (file: File) => {
    if (importing) return;
    setImporting(true);
    try {
      const text = await file.text();
      const rows = parseCsvRows(text);
      if (rows.length < 2) {
        toast.error("CSV file is empty");
        return;
      }

      const headerRow = rows[0];
      const headerIndex = new Map<string, number>();
      for (let i = 0; i < headerRow.length; i++) headerIndex.set(normalizeHeader(headerRow[i]), i);
      const getCol = (name: string) => {
        const idx = headerIndex.get(normalizeHeader(name));
        return idx === undefined ? -1 : idx;
      };
      const getVal = (r: string[], colName: string) => {
        const idx = getCol(colName);
        return idx >= 0 ? r[idx] : "";
      };

      const existingByProductId = new Map<string, Product>();
      const existingByBarcode = new Map<string, Product>();
      const existingByNameBatch = new Map<string, Product>();
      for (const p of products) {
        if (p.productId) existingByProductId.set(String(p.productId).trim(), p);
        if (p.barcode) existingByBarcode.set(String(p.barcode).trim(), p);
        existingByNameBatch.set(`${String(p.name || "").trim().toLowerCase()}__${String(p.batchNo || "").trim().toLowerCase()}`, p);
      }

      const supplierByName = new Map<string, string>();
      for (const s of suppliers) supplierByName.set(String(s.name || "").trim().toLowerCase(), String(s.id));

      let created = 0;
      let updated = 0;
      let failed = 0;

      for (let i = 1; i < rows.length; i++) {
        const r = rows[i];
        const name = String(getVal(r, "Product") || getVal(r, "Name") || "").trim();
        if (!name) continue;

        const productId = String(getVal(r, "Product ID") || getVal(r, "productId") || "").trim();
        const barcode = String(getVal(r, "Barcode") || "").trim();
        const batchNo = String(getVal(r, "Batch") || getVal(r, "Batch No") || "").trim();
        const supplierName = String(getVal(r, "Supplier") || "").trim();
        const supplierId = supplierName ? supplierByName.get(supplierName.toLowerCase()) : undefined;

        const payload: any = {
          name,
          genericName: String(getVal(r, "Generic") || getVal(r, "Generic Name") || "").trim() || undefined,
          category: String(getVal(r, "Category") || "").trim() || undefined,
          manufacturer: String(getVal(r, "Manufacturer") || "").trim() || undefined,
          batchNo: batchNo || undefined,
          expiryDate: parseDate(getVal(r, "Expiry")) || undefined,
          manufacturingDate: parseDate(getVal(r, "Manufacturing Date")) || undefined,
          mrp: parseNumber(getVal(r, "Retail Price")),
          purchasePrice: parseNumber(getVal(r, "Purchase Price")),
          stockQuantity: parseNumber(getVal(r, "Stock")),
          minStockLevel: parseNumber(getVal(r, "Min Stock")),
          unit: String(getVal(r, "Unit") || "").trim() || undefined,
          gstRate: parseNumber(getVal(r, "GST %")) ?? parseNumber(getVal(r, "GST")),
          barcode: barcode || undefined,
          productId: productId || undefined,
          supplierId: supplierId || undefined,
          supplierName: supplierName || undefined,
        };

        const keyNameBatch = `${name.trim().toLowerCase()}__${batchNo.trim().toLowerCase()}`;
        const existing =
          (productId ? existingByProductId.get(productId) : undefined) ||
          (barcode ? existingByBarcode.get(barcode) : undefined) ||
          existingByNameBatch.get(keyNameBatch);

        try {
          if (existing?.id) {
            await updateProduct(existing.id, payload);
            updated++;
          } else {
            await createProduct(payload);
            created++;
          }
        } catch (e) {
          console.error(e);
          failed++;
        }
      }

      await loadProducts();
      if (failed === 0) {
        toast.success(`Import complete. Created: ${created}, Updated: ${updated}`);
      } else {
        toast.error(`Import complete with errors. Created: ${created}, Updated: ${updated}, Failed: ${failed}`);
      }
    } catch (e) {
      console.error(e);
      toast.error("Failed to import CSV");
    } finally {
      setImporting(false);
      if (importFileRef.current) importFileRef.current.value = "";
    }
  };

  const genBatchNo = () => {
    const d = new Date();
    const yyyymmdd = d.toISOString().slice(0, 10).replace(/-/g, "");
    const rand = Math.random().toString(36).toUpperCase().slice(2, 6);
    return `BAT-${yyyymmdd}-${rand}`;
  };

  const genProductId = () => {
    const d = new Date();
    const yyyymmdd = d.toISOString().slice(0, 10).replace(/-/g, "");
    const rand = Math.random().toString(36).toUpperCase().slice(2, 6);
    return `PRD-${yyyymmdd}-${rand}`;
  };

  const stopScan = () => {
    if (scanRafRef.current) {
      cancelAnimationFrame(scanRafRef.current);
      scanRafRef.current = null;
    }
    if (scanStreamRef.current) {
      for (const t of scanStreamRef.current.getTracks()) t.stop();
      scanStreamRef.current = null;
    }
    if (scanVideoRef.current) {
      (scanVideoRef.current as any).srcObject = null;
    }
  };

  useEffect(() => {
    if (!scanOpen) {
      stopScan();
      return;
    }

    setScanError(null);

    const DetectorCtor = (window as any)?.BarcodeDetector;
    if (!DetectorCtor) {
      setScanError("Barcode scanning is not supported in this browser. Please type the barcode manually.");
      return;
    }

    if (!navigator?.mediaDevices?.getUserMedia) {
      setScanError("Camera access is not available. Please type the barcode manually.");
      return;
    }

    let cancelled = false;
    (async () => {
      setScanLoading(true);
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false,
        });
        if (cancelled) {
          for (const t of stream.getTracks()) t.stop();
          return;
        }

        scanStreamRef.current = stream;
        const video = scanVideoRef.current;
        if (!video) return;

        (video as any).srcObject = stream;
        await video.play();

        const detector = new DetectorCtor({
          formats: [
            "ean_13",
            "ean_8",
            "upc_a",
            "upc_e",
            "code_128",
            "code_39",
            "codabar",
            "qr_code",
            "data_matrix",
          ],
        });

        const tick = async () => {
          if (cancelled) return;
          try {
            if (video.readyState >= 2) {
              const results = await detector.detect(video);
              const raw = results?.[0]?.rawValue;
              if (raw) {
                setProductForm((s) => ({ ...s, barcode: String(raw) }));
                toast.success("Barcode scanned");
                setScanOpen(false);
                return;
              }
            }
          } catch {
          }
          scanRafRef.current = requestAnimationFrame(() => {
            void tick();
          });
        };

        scanRafRef.current = requestAnimationFrame(() => {
          void tick();
        });
      } catch (e: any) {
        setScanError(e?.message ? String(e.message) : "Failed to access camera");
      } finally {
        setScanLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      stopScan();
    };
  }, [scanOpen]);

  const loadProducts = async () => {
    try {
      const res = await getProducts();
      const now = new Date();
      const data: Product[] = (res?.products || []).map((p: any) => {
        const expired = p?.expiryDate ? new Date(p.expiryDate) < now : false;
        const lowStock = Number(p?.stockQuantity || 0) <= Number(p?.minStockLevel || 0);
        const status: Product["status"] = expired ? "expired" : lowStock ? "low-stock" : "active";
        return {
          id: String(p.id),
          productId: p.productId || "",
          barcode: p.barcode || "",
          name: p.name || "",
          genericName: p.genericName || "",
          manufacturer: p.manufacturer || "",
          supplierId: p.supplierId || "",
          supplierName: p.supplierName || "",
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
          status,
        }

      });
      setProducts(data);
    } catch (e) {
      console.error(e);
      toast.error("Failed to load products from database");
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

  const openSalesHistory = async (p: Product) => {
    setSalesHistoryProduct(p);
    setSalesHistoryRows([]);
    setSalesHistoryOpen(true);
    setSalesHistoryLoading(true);
    try {
      const res = await getProductSalesHistory({ productId: p.id, limit: 200 });
      setSalesHistoryRows((res as any)?.rows || []);
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || "Failed to load sales history");
    } finally {
      setSalesHistoryLoading(false);
    }
  };

  const openUpdateStock = (p: Product) => {
    setStockProduct(p);
    setStockForm({
      supplierId: p.supplierId || "",
      date: new Date().toISOString().slice(0, 10),
      referenceNo: "",
      quantity: "",
      unitPrice: String(p.purchasePrice || 0),
      discount: "0",
      tax: "0",
      batchNo: genBatchNo(),
      expiryDate: p.expiryDate || "",
    });
    setStockDialogOpen(true);
  };

  const submitUpdateStock = async () => {
    if (!stockProduct) return;
    const qty = Number(stockForm.quantity) || 0;
    const price = Number(stockForm.unitPrice) || 0;
    const disc = Number(stockForm.discount) || 0;
    const tax = Number(stockForm.tax) || 0;
    if (!stockForm.supplierId) { toast.error("Select supplier"); return; }
    if (qty <= 0) { toast.error("Quantity must be greater than 0"); return; }
    setStockSaving(true);
    try {
      const payload: any = {
        supplierId: stockForm.supplierId,
        date: stockForm.date,
        referenceNo: stockForm.referenceNo,
        items: [
          {
            productId: stockProduct.id,
            quantity: qty,
            unitPrice: price,
            discount: disc,
            tax: tax,
            batchNo: stockForm.batchNo || stockProduct.batchNo || genBatchNo(),
            expiryDate: (stockForm.expiryDate || stockProduct.expiryDate || '').trim() || undefined,
          },
        ],
        notes: `Stock update for ${stockProduct.name}`,
      };
      const res = await createPurchase(payload);
      const inv = res?.purchase?.purchaseNo || res?.purchaseNo || "invoice";
      toast.success(`Stock updated via ${inv}`);
      setStockDialogOpen(false);
      setStockProduct(null);
      await loadProducts();
    } catch (e: any) {
      console.error(e);
      toast.error(typeof e?.message === 'string' ? e.message : 'Failed to update stock');
    } finally {
      setStockSaving(false);
    }
  };

  // Add current single-product line into bulk draft and continue
  function saveCurrentToDraftAndContinue() {
    if (!stockProduct) return;
    const qty = Number(stockForm.quantity) || 0;
    const price = Number(stockForm.unitPrice) || 0;
    const disc = Number(stockForm.discount) || 0;
    const tax = Number(stockForm.tax) || 0;
    if (!stockForm.supplierId) { toast.error("Select supplier"); return; }
    if (qty <= 0) { toast.error("Quantity must be greater than 0"); return; }
    // Ensure supplier consistency in draft
    setBulkForm((s) => {
      if (s.supplierId && s.supplierId !== stockForm.supplierId) {
        toast.error("Supplier mismatch with current draft purchase");
        return s;
      }
      const next = {
        ...s,
        supplierId: s.supplierId || stockForm.supplierId,
        date: s.date || stockForm.date,
        referenceNo: s.referenceNo || stockForm.referenceNo,
        items: s.items.concat({
          productId: stockProduct.id,
          name: stockProduct.name,
          quantity: String(qty),
          unitPrice: String(price),
          discount: String(disc),
          tax: String(tax),
          batchNo: stockForm.batchNo || genBatchNo(),
          expiryDate: stockForm.expiryDate || stockProduct.expiryDate || "",
        }),
      };
      return next;
    });
    setStockDialogOpen(false);
    setBulkDialogOpen(true);
    toast.success("Added to draft. You can add more and save the purchase.");
  };

  // Bulk update helpers
  const openBulkUpdateStock = () => {
    setBulkForm({ supplierId: "", date: new Date().toISOString().slice(0, 10), purchaseNo: "", referenceNo: "", items: [], payAmount: "", payMethod: "bank", payReference: "" });
    setBulkSearch("");
    setBulkDialogOpen(true);
  };

  useEffect(() => {
    if (!bulkDialogOpen) return;
    const t = setTimeout(() => {
      bulkSearchRef.current?.focus();
    }, 0);
    return () => clearTimeout(t);
  }, [bulkDialogOpen]);

  useEffect(() => {
    if (!bulkDialogOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        submitBulkUpdateStock();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [bulkDialogOpen]);

  const addBulkItem = (p: Product) => {
    setBulkForm((s) => {
      if (s.items.some((i) => i.productId === p.id)) return s;
      return {
        ...s,
        items: [
          ...s.items,
          { productId: p.id, name: p.name, quantity: "", unitPrice: String(p.purchasePrice || 0), discount: "0", tax: "0", batchNo: genBatchNo(), expiryDate: p.expiryDate || "" },
        ],
      };
    });
  };

  const removeBulkItem = (productId: string) => {
    setBulkForm((s) => ({ ...s, items: s.items.filter((i) => i.productId !== productId) }));
  };

  const updateBulkItemField = (productId: string, field: 'quantity' | 'unitPrice' | 'discount' | 'tax' | 'expiryDate', value: string) => {
    setBulkForm((s) => ({
      ...s,
      items: s.items.map((i) => (i.productId === productId ? { ...i, [field]: value } : i)),
    }));
  };

  const submitBulkUpdateStock = async () => {
    if (!bulkForm.supplierId) { toast.error('Select supplier'); return; }
    if (bulkForm.items.length === 0) { toast.error('Add at least one item'); return; }
    const items = bulkForm.items
      .map((i) => ({
        productId: i.productId,
        quantity: Number(i.quantity) || 0,
        unitPrice: Number(i.unitPrice) || 0,
        discount: Number(i.discount) || 0,
        tax: Number(i.tax) || 0,
        batchNo: i.batchNo || genBatchNo(),
        expiryDate: (i.expiryDate || '').trim() || undefined,
      }))
      .filter((i) => i.quantity > 0);
    if (items.length === 0) { toast.error('Enter quantity for selected items'); return; }
    setBulkSaving(true);
    try {
      const payload: any = {
        purchaseNo: (bulkForm.purchaseNo || '').trim() || undefined,
        supplierId: bulkForm.supplierId,
        date: bulkForm.date,
        referenceNo: bulkForm.referenceNo,
        items,
        notes: 'Bulk stock update',
      };
      const res = await createPurchase(payload);
      const inv = res?.purchase?.purchaseNo || res?.purchaseNo || 'invoice';
      const purchaseId = String(res?.purchase?.id || res?.purchase?._id || "");
      const payAmt = Number(bulkForm.payAmount) || 0;
      if (payAmt > 0 && bulkForm.supplierId) {
        try {
          await createSupplierPayment({
            date: bulkForm.date,
            supplierId: bulkForm.supplierId,
            purchaseId,
            amount: payAmt,
            method: bulkForm.payMethod || 'bank',
            reference: bulkForm.payReference || '',
          });
        } catch (e: any) {
          toast.error(e?.message || 'Failed to record payment');
        }
      }
      toast.success(`Bulk stock updated via ${inv}`);
      setBulkDialogOpen(false);
      await loadProducts();
    } catch (e: any) {
      console.error(e);
      toast.error(typeof e?.message === 'string' ? e.message : 'Failed to update stock');
    } finally {
      setBulkSaving(false);
    }
  };

  useEffect(() => {
    loadProducts();
    loadSuppliers();
  }, []);

  // Auto-calculate per-tablet purchase price from strip price when category is Tablet
  useEffect(() => {
    const isTablet = (productForm.category || "").toLowerCase() === "tablet";
    if (!isTablet) return;
    const units = Number(productForm.unitsPerStrip);
    const strip = Number(productForm.stripPrice);
    if (units > 0 && strip > 0) {
      const per = strip / units;
      const perStr = per.toFixed(2);
      setProductForm((s) => (s.purchasePrice === perStr ? s : { ...s, purchasePrice: perStr }));
    }
  }, [productForm.category, productForm.unitsPerStrip, productForm.stripPrice]);

  useEffect(() => {
    const isTablet = (productForm.category || "").toLowerCase() === "tablet";
    const units = Number(productForm.unitsPerStrip);
    const unitMrp = Number(productForm.mrp);
    if (isTablet && units > 0 && unitMrp > 0) {
      const total = (units * unitMrp).toFixed(2);
      setProductForm((s) => (s.packMrp ? s : { ...s, packMrp: total }));
    } else if (!isTablet && productForm.packMrp) {
      setProductForm((s) => ({ ...s, packMrp: "" }));
    }
  }, [productForm.category, productForm.unitsPerStrip, productForm.mrp]);

  useEffect(() => {
    const isTablet = (productForm.category || "").toLowerCase() === "tablet";
    if (!isTablet) return;
    const units = Number(productForm.unitsPerStrip);
    const pack = Number(productForm.packMrp);
    if (units > 0 && pack > 0) {
      const per = (pack / units).toFixed(2);
      setProductForm((s) => (s.mrp === per ? s : { ...s, mrp: per }));
    }
  }, [productForm.category, productForm.unitsPerStrip, productForm.packMrp]);


  const openAdd = () => {
    setEditingId(null);
    setProductForm({
      productId: genProductId(),
      barcode: "",
      name: "",
      genericName: "",
      manufacturer: "",
      supplierId: "",
      supplierName: "",
      category: "",
      unitsPerStrip: "10",
      stripPrice: "",
      batchNo: genBatchNo(),
      manufacturingDate: "",
      expiryDate: "",
      mrp: "",
      purchasePrice: "",
      gstRate: "",
      stockQuantity: "",
      minStockLevel: "",
      unit: "",
      packMrp: "",
    });
    setDialogOpen(true);
  };

  const openEdit = (p: Product) => {
    setEditingId(p.id);
    setProductForm({
      productId: p.productId || "",
      barcode: p.barcode || "",
      name: p.name || "",
      genericName: p.genericName || "",
      manufacturer: p.manufacturer || "",
      supplierId: p.supplierId || "",
      supplierName: p.supplierName || "",
      category: p.category || "",
      unitsPerStrip: "10",
      stripPrice: "",
      batchNo: p.batchNo || "",
      manufacturingDate: p.manufacturingDate || "",
      expiryDate: p.expiryDate || "",
      mrp: String(p.mrp ?? ""),
      purchasePrice: String(p.purchasePrice ?? ""),
      gstRate: String(p.gstRate ?? ""),
      stockQuantity: String(p.stockQuantity ?? ""),
      minStockLevel: String(p.minStockLevel ?? ""),
      unit: p.unit || "",
      packMrp: "",
    });
    setDialogOpen(true);
  };

  const handleSaveProduct = async () => {
    if (saving) return;
    setSaving(true);
    const payload = {
      ...productForm,
      barcode: productForm.barcode || undefined,
      // align manufacturer to supplierName for backward compatibility
      manufacturer: productForm.supplierName || productForm.manufacturer,
      productId: productForm.productId || undefined,
      supplierId: productForm.supplierId || undefined,
      supplierName: productForm.supplierName || undefined,
      mrp: Number(productForm.mrp) || 0,
      purchasePrice: Number(productForm.purchasePrice) || 0,
      gstRate: Number(productForm.gstRate) || 0,
      stockQuantity: Number(productForm.stockQuantity) || 0,
      minStockLevel: Number(productForm.minStockLevel) || 0,
    };
    try {
      if (editingId) {
        await updateProduct(editingId, payload);
        toast.success("Product updated");
      } else {
        await createProduct(payload);
        toast.success("Product saved to database");
      }
      await loadProducts();
      // reset and close
      setProductForm({
        productId: "",
        barcode: "",
        name: "",
        genericName: "",
        manufacturer: "",
        supplierId: "",
        supplierName: "",
        category: "",
        unitsPerStrip: "10",
        stripPrice: "",
        batchNo: "",
        manufacturingDate: "",
        expiryDate: "",
        mrp: "",
        purchasePrice: "",
        gstRate: "",
        stockQuantity: "",
        minStockLevel: "",
        unit: "",
        packMrp: "",
      });
      setEditingId(null);
      setDialogOpen(false);
    } catch (e) {
      console.error(e);
      toast.error("Failed to save product. Check backend is running and try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteProduct(deleteId);
      toast.success("Product deleted");
      await loadProducts();
    } catch (e) {
      console.error(e);
      toast.error("Failed to delete product");
    } finally {
      setDeleteOpen(false);
      setDeleteId(null);
    }
  };
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const filteredProducts = products.filter((product) => {
    const matchesSearch =
      product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.genericName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.batchNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (product.barcode || "").toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory =
      categoryFilter === "all" || product.category === categoryFilter;
    const matchesStatus =
      statusFilter === "all" || product.status === statusFilter;
    return matchesSearch && matchesCategory && matchesStatus;
  });

  const exportProductsCsv = () => {
    const headers = [
      "Product",
      "Generic",
      "Batch",
      "Supplier",
      "Expiry",
      "Retail Price",
      "Purchase Price",
      "Stock",
      "Min Stock",
      "Unit",
      "GST %",
      "Status",
      "Barcode",
      "Product ID",
    ];
    const rows = filteredProducts.map((p) => [
      p.name,
      p.genericName || "",
      p.batchNo || "",
      p.supplierName || "",
      p.expiryDate || "",
      String(p.mrp ?? ""),
      String(p.purchasePrice ?? ""),
      String(p.stockQuantity ?? ""),
      String(p.minStockLevel ?? ""),
      p.unit || "",
      String(p.gstRate ?? ""),
      p.status,
      p.barcode || "",
      p.productId || "",
    ]);

    const csv = [headers, ...rows]
      .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `products_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const categories = [
    ...new Set([
      ...defaultCategories,
      ...products
        .map((p) => (typeof p.category === "string" ? p.category.trim() : ""))
        .filter((c) => c),
    ]),
  ];
  const productToDelete = products.find((p) => p.id === deleteId);

  const bulkSearchResults = products
    .filter((p) => {
      const term = bulkSearch.trim().toLowerCase();
      if (!term) return false;
      if (bulkForm.items.some((i) => i.productId === p.id)) return false;
      return (
        p.name.toLowerCase().includes(term) ||
        p.genericName.toLowerCase().includes(term) ||
        p.batchNo.toLowerCase().includes(term) ||
        (p.barcode || "").toLowerCase().includes(term)
      );
    })
    .slice(0, 50);

  // If user scans a barcode in Bulk Update search, auto-add the matching product
  useEffect(() => {
    const code = bulkSearch.trim();
    if (!code) return;
    const p = products.find((pr) => (pr.barcode || "") === code);
    if (p) {
      addBulkItem(p);
      setBulkSearch("");
      toast.success(`Added ${p.name}`);
    }
  }, [bulkSearch]);

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Products</h1>
            <p className="text-muted-foreground">
              Manage your pharmaceutical products and inventory
            </p>
          </div>
          <div className="flex gap-2">
            <Button onClick={openBulkUpdateStock}>
              <PackagePlus className="mr-2 h-4 w-4" />
              Update Stock
            </Button>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={openAdd}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Product
                </Button>
              </DialogTrigger>
              <DialogContent className="w-[95vw] sm:max-w-[600px] h-[90vh] p-0 flex flex-col">
                <DialogHeader className="p-6 pb-2">
                  <DialogTitle>{editingId ? "Edit Product" : "Add New Product"}</DialogTitle>
                  <DialogDescription>
                    Enter the product details below to add a new pharmaceutical product.
                  </DialogDescription>
                </DialogHeader>
                <ScrollArea className="flex-1 px-6 pb-6">
                <div className="grid gap-4 py-2">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">Product Name</Label>
                      <Input id="name" placeholder="e.g., Paracetamol 500mg" value={productForm.name}
                        onChange={(e) => setProductForm((s) => ({ ...s, name: e.target.value }))} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="generic">Generic Name</Label>
                      <Input id="generic" placeholder="e.g., Paracetamol" value={productForm.genericName}
                        onChange={(e) => setProductForm((s) => ({ ...s, genericName: e.target.value }))} />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="productId">Product ID</Label>
                      <div className="flex gap-2">
                        <Input id="productId" value={productForm.productId} readOnly />
                        {!editingId ? (
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            onClick={() => setProductForm((s) => ({ ...s, productId: genProductId() }))}
                            title="Regenerate Product ID"
                          >
                            <RefreshCw className="h-4 w-4" />
                          </Button>
                        ) : null}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="barcode">Barcode</Label>
                      <div className="flex gap-2">
                        <Input
                          id="barcode"
                          placeholder="Scan or enter barcode"
                          value={productForm.barcode}
                          onChange={(e) => setProductForm((s) => ({ ...s, barcode: e.target.value }))}
                          autoFocus
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          onClick={() => setScanOpen(true)}
                          title="Scan barcode"
                        >
                          <ScanLine className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="supplier">Supplier</Label>
                      <Popover open={supplierPickerOpen} onOpenChange={setSupplierPickerOpen}>
                        <PopoverTrigger asChild>
                          <Input
                            placeholder="Select or type supplier..."
                            value={supplierQuery !== "" ? supplierQuery : (productForm.supplierId ? (suppliers.find((s) => s.id === productForm.supplierId)?.name || "") : (productForm.supplierName || ""))}
                            onChange={(e) => {
                              const v = e.target.value;
                              setSupplierQuery(v);
                              setSupplierPickerOpen(true);
                              setProductForm((s) => ({ ...s, supplierId: "", supplierName: v }));
                            }}
                            onFocus={() => setSupplierPickerOpen(true)}
                          />
                        </PopoverTrigger>
                        <PopoverContent className="p-0 w-80">
                          <Command>
                            <CommandInput placeholder="Search supplier..." value={supplierQuery} onValueChange={setSupplierQuery} />
                            <CommandEmpty>No supplier found.</CommandEmpty>
                            <CommandList>
                              <CommandGroup>
                                {suppliers.map((s) => (
                                  <CommandItem key={s.id} value={s.name}
                                    onSelect={() => {
                                      setProductForm((pf) => ({ ...pf, supplierId: s.id, supplierName: s.name }));
                                      setSupplierPickerOpen(false);
                                      setSupplierQuery("");
                                    }}
                                  >
                                    {s.name}
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="category">Category</Label>
                      <Popover open={categoryPickerOpen} onOpenChange={setCategoryPickerOpen}>
                        <PopoverTrigger asChild>
                          <Input
                            placeholder="Select or type category..."
                            value={categoryQuery !== "" ? categoryQuery : (productForm.category || "")}
                            onChange={(e) => {
                              const v = e.target.value;
                              setCategoryQuery(v);
                              setCategoryPickerOpen(true);
                              setProductForm((s) => ({ ...s, category: v }));
                            }}
                            onFocus={() => setCategoryPickerOpen(true)}
                          />
                        </PopoverTrigger>
                        <PopoverContent className="p-0 w-80">
                          <Command>
                            <CommandInput placeholder="Search category..." value={categoryQuery} onValueChange={setCategoryQuery} />
                            <CommandEmpty>No category found.</CommandEmpty>
                            <CommandList>
                              <CommandGroup>
                                {categories.map((cat) => (
                                  <CommandItem key={cat} value={cat}
                                    onSelect={() => {
                                      setProductForm((pf) => ({ ...pf, category: cat }));
                                      setCategoryPickerOpen(false);
                                      setCategoryQuery("");
                                    }}
                                  >
                                    {cat}
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                    </div>
                  </div>
                  {(productForm.category || "").toLowerCase() === "tablet" && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="unitsPerStrip">Tablets per Pack</Label>
                        <Input id="unitsPerStrip" type="number" placeholder="10" value={productForm.unitsPerStrip}
                          onChange={(e) => setProductForm((s) => ({ ...s, unitsPerStrip: e.target.value }))} />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="stripPrice">Pack T.P (Trade Price) (Rs)</Label>
                        <Input id="stripPrice" type="number" placeholder="0.00" value={productForm.stripPrice}
                          onChange={(e) => setProductForm((s) => ({ ...s, stripPrice: e.target.value }))} />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="packMrp">Pack Retail Price (Rs)</Label>
                        <Input id="packMrp" type="number" placeholder="0.00" value={productForm.packMrp}
                          onChange={(e) => setProductForm((s) => ({ ...s, packMrp: e.target.value }))} />
                      </div>
                    </div>
                  )}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="mrp">Retail Price (Rs)</Label>
                      <Input id="mrp" type="number" placeholder="0.00" value={productForm.mrp}
                        onChange={(e) => setProductForm((s) => ({ ...s, mrp: e.target.value }))} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="purchase">T.P (Trade Price) (Rs)</Label>
                      <Input id="purchase" type="number" placeholder="0.00" value={productForm.purchasePrice}
                        readOnly={(productForm.category || "").toLowerCase() === "tablet"}
                        onChange={(e) => setProductForm((s) => ({ ...s, purchasePrice: e.target.value }))} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="gst">GST Rate (%)</Label>
                      <Input id="gst" type="number" placeholder="12" value={productForm.gstRate}
                        onChange={(e) => setProductForm((s) => ({ ...s, gstRate: e.target.value }))} />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="batchNo">Batch No</Label>
                      <div className="flex gap-2">
                        <Input id="batchNo" value={productForm.batchNo} readOnly />
                        {!editingId ? (
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            onClick={() => setProductForm((s) => ({ ...s, batchNo: genBatchNo() }))}
                            title="Regenerate Batch No"
                          >
                            <RefreshCw className="h-4 w-4" />
                          </Button>
                        ) : null}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Expiry Date</Label>
                      <DateField
                        value={productForm.expiryDate}
                        onChange={(v) => setProductForm((s) => ({ ...s, expiryDate: v }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Manufacturing Date</Label>
                      <DateField
                        value={productForm.manufacturingDate}
                        onChange={(v) => setProductForm((s) => ({ ...s, manufacturingDate: v }))}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="stock">Initial Stock</Label>
                      <Input id="stock" type="number" placeholder="0" value={productForm.stockQuantity}
                        onChange={(e) => setProductForm((s) => ({ ...s, stockQuantity: e.target.value }))} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="minStock">Min Stock Level</Label>
                      <Input id="minStock" type="number" placeholder="100" value={productForm.minStockLevel}
                        onChange={(e) => setProductForm((s) => ({ ...s, minStockLevel: e.target.value }))} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="unit">Unit</Label>
                      <Select value={productForm.unit} onValueChange={(v) => setProductForm((s) => ({ ...s, unit: v }))}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select unit" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Pack">Pack</SelectItem>
                          <SelectItem value="Box">Box</SelectItem>
                          <SelectItem value="Bottle">Bottle</SelectItem>
                          <SelectItem value="Vial">Vial</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
                </ScrollArea>
                <div className="p-6 pt-2 border-t flex justify-end gap-2 bg-white rounded-b-lg">
                  <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                  <Button onClick={handleSaveProduct} disabled={saving}>
                    {saving ? (editingId ? "Updating..." : "Saving...") : (editingId ? "Update Product" : "Save Product")}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>

            <Dialog open={scanOpen} onOpenChange={setScanOpen}>
              <DialogContent className="sm:max-w-[520px]">
                <DialogHeader>
                  <DialogTitle>Scan Barcode</DialogTitle>
                  <DialogDescription>
                    Point your camera at the product barcode to fill it automatically.
                  </DialogDescription>
                </DialogHeader>

                {scanError ? (
                  <div className="text-sm text-destructive">{scanError}</div>
                ) : (
                  <div className="space-y-3">
                    <div className="rounded-md border overflow-hidden bg-black">
                      <video ref={scanVideoRef} className="w-full h-[260px] object-cover" playsInline muted />
                    </div>
                    {scanLoading ? (
                      <div className="text-xs text-muted-foreground">Starting camera...</div>
                    ) : (
                      <div className="text-xs text-muted-foreground">Scanning...</div>
                    )}
                  </div>
                )}

                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setScanOpen(false)}>Close</Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

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
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[130px]">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="low-stock">Low Stock</SelectItem>
                    <SelectItem value="expired">Expired</SelectItem>
                  </SelectContent>
                </Select>
                <input
                  ref={importFileRef}
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void handleImportProductsCsv(f);
                  }}
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => importFileRef.current?.click()}
                  disabled={importing}
                  title="Import CSV"
                >
                  <Upload className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="icon" onClick={exportProductsCsv}>
                  <Download className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Products Table */}
        <Card>
          <CardHeader>
            <CardTitle>Product Inventory ({filteredProducts.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead>Batch No.</TableHead>
                    <TableHead>Supplier</TableHead>
                    <TableHead>Expiry</TableHead>
                    <TableHead className="text-right">Retail Price</TableHead>
                    <TableHead className="text-right">Stock</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredProducts.map((product) => (
                    <TableRow key={product.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium text-foreground">{product.name}</p>
                          <p className="text-xs text-muted-foreground">{product.genericName}</p>
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-sm">{product.batchNo}</TableCell>
                      <TableCell>{product.supplierName || product.manufacturer}</TableCell>
                      <TableCell>{product.expiryDate}</TableCell>
                      <TableCell className="text-right">{formatCurrency(product.mrp)}</TableCell>
                      <TableCell className="text-right">
                        <span
                          className={
                            product.stockQuantity <= product.minStockLevel
                              ? "text-destructive font-medium"
                              : ""
                          }
                        >
                          {product.stockQuantity}
                        </span>
                        <span className="text-muted-foreground"> / {product.minStockLevel}</span>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={statusStyles[product.status]}>
                          {product.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button variant="outline" size="sm" onClick={() => openUpdateStock(product)} title="Update stock by creating a supplier invoice">
                            <PackagePlus className="h-4 w-4 mr-1" /> Update Stock
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => openSalesHistory(product)} title="Sales History">
                            <History className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => openEdit(product)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => { setDeleteId(product.id); setDeleteOpen(true); }}>
                            <Trash2 className="h-4 w-4 text-destructive" />
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

        <Dialog open={salesHistoryOpen} onOpenChange={setSalesHistoryOpen}>
          <DialogContent className="sm:max-w-[900px] h-[85vh] p-0 flex flex-col">
            <DialogHeader className="p-6 pb-2">
              <DialogTitle>Sales History</DialogTitle>
              <DialogDescription>{salesHistoryProduct ? `${salesHistoryProduct.name} (${salesHistoryProduct.productId || salesHistoryProduct.id})` : ""}</DialogDescription>
            </DialogHeader>
            <ScrollArea className="flex-1 px-6 pb-6">
              <div className="rounded-lg border bg-muted/10 overflow-hidden">
                <Table>
                  <TableHeader className="bg-muted/20">
                    <TableRow className="h-10">
                      <TableHead className="text-[10px] font-bold uppercase">Date</TableHead>
                      <TableHead className="text-[10px] font-bold uppercase">Order</TableHead>
                      <TableHead className="text-[10px] font-bold uppercase">Customer</TableHead>
                      <TableHead className="text-[10px] font-bold uppercase text-right">Qty</TableHead>
                      <TableHead className="text-[10px] font-bold uppercase text-right">Rate</TableHead>
                      <TableHead className="text-[10px] font-bold uppercase text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {salesHistoryLoading ? (
                      <TableRow><TableCell colSpan={6} className="text-xs text-muted-foreground">Loading...</TableCell></TableRow>
                    ) : (salesHistoryRows && salesHistoryRows.length > 0 ? (
                      salesHistoryRows.map((r: any, idx: number) => (
                        <TableRow key={String(r.orderId || idx)} className="h-12">
                          <TableCell className="text-xs">{r.orderDate || ""}</TableCell>
                          <TableCell className="text-xs font-mono">{r.orderNo || ""}</TableCell>
                          <TableCell className="text-xs">{r.customerName || ""}</TableCell>
                          <TableCell className="text-xs text-right">{Number(r.quantity || 0)}</TableCell>
                          <TableCell className="text-xs text-right">{formatCurrency(Number(r.unitPrice || 0))}</TableCell>
                          <TableCell className="text-xs font-bold text-right">{formatCurrency(Number(r.total || 0))}</TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow><TableCell colSpan={6} className="text-xs text-muted-foreground">No sales found for this product.</TableCell></TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </ScrollArea>
            <div className="p-6 pt-2 border-t flex justify-end gap-3 bg-card rounded-b-lg">
              <Button variant="outline" className="text-xs h-9 px-6" onClick={() => setSalesHistoryOpen(false)}>Close</Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Bulk Update Stock Dialog */}
        <Dialog open={bulkDialogOpen} onOpenChange={setBulkDialogOpen}>
          <DialogContent className="sm:max-w-[900px] h-[90vh] p-0 flex flex-col">
            <DialogHeader className="p-6 pb-2">
              <DialogTitle>Update Stock (Bulk)</DialogTitle>
              <DialogDescription>Search products, add multiple items, and save to auto-generate supplier invoice.</DialogDescription>
            </DialogHeader>
            <ScrollArea className="flex-1 px-6 pb-6">
            <div className="grid gap-4 py-2">
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Supplier</Label>
                  <Select value={bulkForm.supplierId} onValueChange={(v) => setBulkForm((s) => ({ ...s, supplierId: v }))}>
                    <SelectTrigger
                      ref={bulkSupplierRef}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          bulkDateRef.current?.focus();
                        }
                      }}
                    >
                      <SelectValue placeholder="Select supplier" />
                    </SelectTrigger>
                    <SelectContent>
                      {suppliers.map((s) => (
                        <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Date</Label>
                  <DateField
                    ref={bulkDateRef}
                    value={bulkForm.date}
                    onChange={(v) => setBulkForm((s) => ({ ...s, date: v }))}
                    className="h-10"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Invoice No</Label>
                  <Input
                    placeholder="Invoice No"
                    value={bulkForm.purchaseNo || ''}
                    onChange={(e) => setBulkForm((s) => ({ ...s, purchaseNo: e.target.value }))}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        bulkReferenceRef.current?.focus();
                      }
                    }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Reference</Label>
                  <Input
                    placeholder="Optional PO/Ref"
                    value={bulkForm.referenceNo}
                    onChange={(e) => setBulkForm((s) => ({ ...s, referenceNo: e.target.value }))}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        bulkPayAmountRef.current?.focus();
                      }
                    }}
                    ref={bulkReferenceRef}
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Initial Payment</Label>
                  <Input
                    type="number"
                    placeholder="0"
                    value={bulkForm.payAmount}
                    onChange={(e) => setBulkForm((s) => ({ ...s, payAmount: e.target.value }))}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        bulkPayMethodRef.current?.focus();
                      }
                    }}
                    ref={bulkPayAmountRef}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Payment Method</Label>
                  <Select value={bulkForm.payMethod} onValueChange={(v) => setBulkForm((s) => ({ ...s, payMethod: v }))}>
                    <SelectTrigger
                      ref={bulkPayMethodRef}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          bulkPayReferenceRef.current?.focus();
                        }
                      }}
                    >
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
                <div className="space-y-2">
                  <Label>Payment Reference</Label>
                  <Input
                    placeholder="TXN/CHQ/REF"
                    value={bulkForm.payReference}
                    onChange={(e) => setBulkForm((s) => ({ ...s, payReference: e.target.value }))}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        bulkSearchRef.current?.focus();
                      }
                    }}
                    ref={bulkPayReferenceRef}
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>To Pay</Label>
                  <Input
                    readOnly
                    value={(function () {
                      const total = bulkForm.items.reduce((sum, it) => {
                        const q = Number(it.quantity) || 0;
                        const pr = Number(it.unitPrice) || 0;
                        const d = Number(it.discount) || 0;
                        const t = Number(it.tax) || 0;
                        const base = q * pr;
                        const afterDisc = base * (1 - d / 100);
                        const net = afterDisc * (1 + t / 100);
                        return sum + net;
                      }, 0);
                      const paid = Number(bulkForm.payAmount) || 0;
                      const toPay = Math.max(0, total - paid);
                      return formatCurrency(toPay);
                    })()}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Search Products</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    className="pl-10"
                    placeholder="Search name, generic, batch..."
                    value={bulkSearch}
                    onChange={(e) => {
                      setBulkSearch(e.target.value);
                      setBulkSearchIndex(0);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'ArrowDown') {
                        if (!bulkSearch) return;
                        e.preventDefault();
                        const max = Math.max(0, bulkSearchResults.length - 1);
                        setBulkSearchIndex((i) => Math.min(max, i + 1));
                        return;
                      }
                      if (e.key === 'ArrowUp') {
                        if (!bulkSearch) return;
                        e.preventDefault();
                        setBulkSearchIndex((i) => Math.max(0, i - 1));
                        return;
                      }
                      if (e.key === 'Enter' && !e.ctrlKey && !e.metaKey) {
                        if (!bulkSearch) return;
                        if (bulkSearchResults.length === 0) return;
                        e.preventDefault();
                        const idx = Math.min(Math.max(0, bulkSearchIndex), bulkSearchResults.length - 1);
                        const p = bulkSearchResults[idx];
                        if (p) {
                          addBulkItem(p);
                          setBulkSearch('');
                          setBulkSearchIndex(0);
                          setTimeout(() => bulkSearchRef.current?.focus(), 0);
                        }
                        return;
                      }
                      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                        e.preventDefault();
                        submitBulkUpdateStock();
                      }
                    }}
                    ref={bulkSearchRef}
                  />
                </div>
                {bulkSearch && (
                  <div className="max-h-40 overflow-auto rounded-md border">
                    {bulkSearchResults.length === 0 ? (
                      <div className="text-sm text-muted-foreground p-3">No results</div>
                    ) : (
                      bulkSearchResults.map((p, idx) => (
                        <div
                          key={p.id}
                          className={`flex items-center justify-between p-2 hover:bg-muted/40 ${idx === bulkSearchIndex ? 'bg-muted/60' : ''}`}
                          onMouseEnter={() => setBulkSearchIndex(idx)}
                        >
                          <div className="min-w-0">
                            <div className="font-medium truncate">{p.name}</div>
                            <div className="text-xs text-muted-foreground truncate">{p.genericName} • {p.batchNo}</div>
                          </div>
                          <Button size="sm" variant="outline" onClick={() => addBulkItem(p)}>Add</Button>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label>Selected Items</Label>
                {bulkForm.items.length === 0 ? (
                  <div className="text-sm text-muted-foreground">No items added yet</div>
                ) : (
                  <div className="space-y-2">
                    {bulkForm.items.map((it) => {
                      const q = Number(it.quantity) || 0;
                      const pr = Number(it.unitPrice) || 0;
                      const d = Number(it.discount) || 0;
                      const t = Number(it.tax) || 0;
                      const base = q * pr;
                      const afterDisc = base * (1 - d / 100);
                      const net = afterDisc * (1 + t / 100);
                      return (
                        <div key={it.productId} className="grid grid-cols-12 gap-2 items-end">
                          <div className="col-span-3">
                            <div className="text-sm font-medium truncate">{it.name}</div>
                            <div className="mt-1">
                              <Label className="text-xs">Batch No</Label>
                              <Input value={it.batchNo} onChange={(e) => setBulkForm((s) => ({ ...s, items: s.items.map((x) => x.productId === it.productId ? { ...x, batchNo: e.target.value } : x) }))} />
                            </div>
                            <div className="mt-2">
                              <Label className="text-xs">Expiry Date</Label>
                              <Input type="date" value={it.expiryDate} onChange={(e) => updateBulkItemField(it.productId, 'expiryDate', e.target.value)} />
                            </div>
                          </div>
                          <div className="col-span-2">
                            <Label className="text-xs">Quantity</Label>
                            <Input type="number" value={it.quantity} onChange={(e) => updateBulkItemField(it.productId, 'quantity', e.target.value)} />
                          </div>
                          <div className="col-span-2">
                            <Label className="text-xs">Unit Price</Label>
                            <Input type="number" value={it.unitPrice} onChange={(e) => updateBulkItemField(it.productId, 'unitPrice', e.target.value)} />
                          </div>
                          <div className="col-span-1">
                            <Label className="text-xs">Disc %</Label>
                            <Input type="number" value={it.discount} onChange={(e) => updateBulkItemField(it.productId, 'discount', e.target.value)} />
                          </div>
                          <div className="col-span-1">
                            <Label className="text-xs">Tax %</Label>
                            <Input type="number" value={it.tax} onChange={(e) => updateBulkItemField(it.productId, 'tax', e.target.value)} />
                          </div>
                          <div className="col-span-2 text-right">
                            <Label className="text-xs">Amount</Label>
                            <div className="text-sm font-medium">{formatCurrency(net)}</div>
                          </div>
                          <div className="col-span-1 flex justify-end">
                            <Button variant="ghost" size="icon" onClick={() => removeBulkItem(it.productId)}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                    <div className="text-right font-semibold text-sm">
                      Total: {formatCurrency(bulkForm.items.reduce((sum, it) => {
                        const q = Number(it.quantity) || 0;
                        const pr = Number(it.unitPrice) || 0;
                        const d = Number(it.discount) || 0;
                        const t = Number(it.tax) || 0;
                        const base = q * pr;
                        const afterDisc = base * (1 - d / 100);
                        const net = afterDisc * (1 + t / 100);
                        return sum + net;
                      }, 0))}
                      <div className="mt-1 text-muted-foreground text-xs">
                        To Pay: {formatCurrency((function () {
                          const total = bulkForm.items.reduce((sum, it) => {
                            const q = Number(it.quantity) || 0;
                            const pr = Number(it.unitPrice) || 0;
                            const d = Number(it.discount) || 0;
                            const t = Number(it.tax) || 0;
                            const base = q * pr;
                            const afterDisc = base * (1 - d / 100);
                            const net = afterDisc * (1 + t / 100);
                            return sum + net;
                          }, 0);
                          const paid = Number(bulkForm.payAmount) || 0;
                          return Math.max(0, total - paid);
                        })())}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
            </ScrollArea>
            <div className="p-6 pt-2 border-t flex justify-end gap-2 bg-white rounded-b-lg">
              <Button variant="outline" onClick={() => setBulkDialogOpen(false)}>Cancel</Button>
              <Button onClick={submitBulkUpdateStock} disabled={bulkSaving}>{bulkSaving ? 'Saving...' : 'Save'}</Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Update Stock Dialog */}
        <Dialog open={stockDialogOpen} onOpenChange={setStockDialogOpen}>
          <DialogContent className="sm:max-w-[620px]">
            <DialogHeader>
              <DialogTitle>Update Stock{stockProduct ? ` — ${stockProduct.name}` : ''}</DialogTitle>
              <DialogDescription>Creates a supplier purchase invoice and updates product stock.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-2">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Supplier</Label>
                  <Select value={stockForm.supplierId} onValueChange={(v) => setStockForm((s) => ({ ...s, supplierId: v }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select supplier" />
                    </SelectTrigger>
                    <SelectContent>
                      {suppliers.map((s) => (
                        <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Date</Label>
                  <DateField
                    value={stockForm.date}
                    onChange={(v) => setStockForm((s) => ({ ...s, date: v }))}
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Quantity</Label>
                  <Input type="number" value={stockForm.quantity} onChange={(e) => setStockForm((s) => ({ ...s, quantity: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Unit Price (Rs)</Label>
                  <Input type="number" value={stockForm.unitPrice} onChange={(e) => setStockForm((s) => ({ ...s, unitPrice: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Reference</Label>
                  <Input placeholder="Optional PO/Ref" value={stockForm.referenceNo} onChange={(e) => setStockForm((s) => ({ ...s, referenceNo: e.target.value }))} />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Batch No</Label>
                  <Input value={stockForm.batchNo} onChange={(e) => setStockForm((s) => ({ ...s, batchNo: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Expiry Date</Label>
                  <DateField
                    value={stockForm.expiryDate}
                    onChange={(v) => setStockForm((s) => ({ ...s, expiryDate: v }))}
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Discount %</Label>
                  <Input type="number" value={stockForm.discount} onChange={(e) => setStockForm((s) => ({ ...s, discount: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Tax %</Label>
                  <Input type="number" value={stockForm.tax} onChange={(e) => setStockForm((s) => ({ ...s, tax: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Amount</Label>
                  <Input
                    readOnly
                    value={(function () {
                      const q = Number(stockForm.quantity) || 0;
                      const pr = Number(stockForm.unitPrice) || 0;
                      const d = Number(stockForm.discount) || 0;
                      const t = Number(stockForm.tax) || 0;
                      const base = q * pr;
                      const afterDisc = base * (1 - d / 100);
                      const net = afterDisc * (1 + t / 100);
                      return formatCurrency(net);
                    })()}
                  />
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setStockDialogOpen(false)}>Cancel</Button>
              <Button variant="secondary" onClick={saveCurrentToDraftAndContinue} disabled={stockSaving}>Save & Add Next</Button>
              <Button onClick={submitUpdateStock} disabled={stockSaving}>{stockSaving ? 'Saving...' : 'Save'}</Button>
            </div>
          </DialogContent>
        </Dialog>

        <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete product?</AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone. This will permanently delete {productToDelete ? `"${productToDelete.name}"` : "this product"}.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleConfirmDelete}>Delete</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </MainLayout>
  );
};

export default Products;
