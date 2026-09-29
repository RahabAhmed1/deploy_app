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
import { Separator } from "@/components/ui/separator";
import {
    Plus,
    Search,
    FileText,
    CheckCircle2,
    Clock,
    AlertTriangle,
    IndianRupee,
    Download,
    Printer,
    Filter,
    Calendar,
    User,
    ClipboardList,
    CreditCard,
    Building
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/currency";
import { getInvoices, createInvoice, getOrders, getCustomers, getPayments, getCompanyInfo } from "@/lib/api";
import { toast } from "sonner";
import { openInvoicePdfPreview, downloadInvoicePdf } from "@/lib/invoicePdf";

type Invoice = {
  id: string;
  orderId: string;
  invoiceNo: string;
  date: string;
  customer: string;
  customerType: string;
  orderNo: string;
  amount: number;
  tax: number;
  discount: number;
  total: number;
  dueDate: string;
  status: "paid" | "unpaid" | "partial" | "overdue";
};

type OrderItem = { productName: string; batchNo: string; quantity: number; unitPrice: number; discount: number; tax: number; total: number };
type Order = { id: string; orderNo: string; customerId: string; customerName: string; customerType?: string; salesmanCode?: string; salesmanName?: string; orderDate?: string; status: string; paymentStatus?: string; totalAmount: number; discountAmount: number; taxAmount: number; netAmount: number; items: OrderItem[] };
type Customer = { id: string; customerNo?: string; name: string; type?: string; contactPerson?: string; phone?: string; email?: string; address?: string; city?: string; state?: string; gstNo?: string; drugLicenseNo?: string };

const Invoices = () => {
    const [searchTerm, setSearchTerm] = useState("");
    const [statusFilter, setStatusFilter] = useState("all");
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [orders, setOrders] = useState<Order[]>([]);
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [paymentsTotal, setPaymentsTotal] = useState(0);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [saving, setSaving] = useState(false);
    const [form, setForm] = useState({ orderId: "", invoiceDate: new Date().toISOString().slice(0,10), paymentTermsDays: "30", billingAddress: "", shippingAddress: "", notes: "" });
    const [company, setCompany] = useState<any>(null);

    const loadData = async () => {
      try {
        const [invRes, ordRes, cusRes, payRes] = await Promise.all([
          getInvoices(),
          getOrders(),
          getCustomers(),
          getPayments(),
        ]);
        setInvoices(invRes?.invoices || []);
        setOrders((ordRes?.orders || []).map((o: any) => ({
          id: String(o.id),
          orderNo: o.orderNo,
          customerId: o.customerId,
          customerName: o.customerName,
          customerType: o.customerType || "",
          salesmanCode: o.salesmanCode || "",
          salesmanName: o.salesmanName || "",
          orderDate: o.orderDate || "",
          status: o.status,
          paymentStatus: o.paymentStatus || "",
          totalAmount: Number(o.totalAmount || 0),
          discountAmount: Number(o.discountAmount || 0),
          taxAmount: Number(o.taxAmount || 0),
          netAmount: Number(o.netAmount || 0),
          items: (o.items || []).map((it: any) => ({
            productName: it.productName || '',
            batchNo: it.batchNo || '',
            quantity: Number(it.quantity || 0),
            unitPrice: Number(it.unitPrice || 0),
            discount: Number(it.discount || 0),
            tax: Number(it.tax || 0),
            total: Number(it.total || 0),
          })),
        })));
        setCustomers((cusRes?.customers || []).map((c: any) => ({
          id: String(c.id),
          customerNo: c.customerNo || "",
          name: c.name || "",
          type: c.type || "",
          contactPerson: c.contactPerson || "",
          phone: c.phone || "",
          email: c.email || "",
          address: c.address || "",
          city: c.city || "",
          state: c.state || "",
          gstNo: c.gstNo || "",
          drugLicenseNo: c.drugLicenseNo || "",
        })));
        const paymentsSum = (payRes?.payments || []).reduce((s: number, p: any) => s + (Number(p.amount) || 0), 0);
        setPaymentsTotal(paymentsSum);
      } catch (e) {
        console.error(e);
        toast.error("Failed to load invoices");
      }
    };

    useEffect(() => { loadData(); }, []);
    useEffect(() => { (async () => { try { const res = await getCompanyInfo(); setCompany(res?.company || null); } catch {} })(); }, []);

    const statusStyles: Record<string, string> = {
        paid: "bg-[#10b981]/10 text-[#10b981] border-[#10b981]/20",
        unpaid: "bg-amber-100 text-amber-700 border-amber-200",
        partial: "bg-blue-100 text-blue-700 border-blue-200",
        overdue: "bg-red-100 text-red-700 border-red-200"
    };

    const stats = useMemo(() => {
      const totalInvoiced = invoices.reduce((s, x) => s + (Number(x.total) || 0), 0);
      const pending = Math.max(0, totalInvoiced - paymentsTotal);
      const overdue = invoices.filter(i => i.status === 'overdue').reduce((s, x) => s + (Number(x.total) || 0), 0);
      return { totalInvoiced, paymentsReceived: paymentsTotal, pendingDues: pending, overdue };
    }, [invoices, paymentsTotal]);

    const invoiceOrderIds = new Set(invoices.map(i => i.orderId));
    const selectableOrders = orders.filter(o => (o.status === 'approved' || o.status === 'dispatched' || o.status === 'delivered') && !invoiceOrderIds.has(o.id));

    const filtered = invoices.filter((inv) => {
      const term = searchTerm.toLowerCase();
      const matches = (
        (inv.invoiceNo || '').toLowerCase().includes(term) ||
        (inv.customer || '').toLowerCase().includes(term) ||
        (inv.orderNo || '').toLowerCase().includes(term)
      );
      const st = statusFilter === 'all' ||
        (statusFilter === 'unpaid' ? inv.status !== 'paid' : inv.status === statusFilter);
      return matches && st;
    });

    const selectedOrder = useMemo(() => orders.find(o => o.id === form.orderId), [orders, form.orderId]);

    const selectedCustomer = useMemo(() => {
      if (!selectedOrder?.customerId) return undefined;
      return customers.find(c => String(c.id) === String(selectedOrder.customerId));
    }, [customers, selectedOrder?.customerId]);

    const customerHistory = useMemo(() => {
      if (!selectedOrder?.customerId) return [] as Order[];
      return [...orders]
        .filter(o => String(o.customerId) === String(selectedOrder.customerId) && String(o.id) !== String(selectedOrder.id))
        .sort((a, b) => String(b.orderDate || '').localeCompare(String(a.orderDate || '')))
        .slice(0, 10);
    }, [orders, selectedOrder?.customerId, selectedOrder?.id]);

    const exportInvoicesCsv = () => {
      const headers = [
        'Invoice No', 'Date', 'Customer', 'Order No', 'Base Amount', 'Tax', 'Discount', 'Total', 'Due Date', 'Status'
      ];
      const rows = filtered.map(inv => [
        inv.invoiceNo,
        inv.date,
        inv.customer,
        inv.orderNo,
        String(inv.amount),
        String(inv.tax),
        String(inv.discount),
        String(inv.total),
        inv.dueDate,
        inv.status,
      ]);
      const csv = [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `invoices_${new Date().toISOString().slice(0,10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    };

    const numberToWordsIndian = (num: number) => {
      const a = [
        '', 'ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'SEVEN', 'EIGHT', 'NINE', 'TEN',
        'ELEVEN', 'TWELVE', 'THIRTEEN', 'FOURTEEN', 'FIFTEEN', 'SIXTEEN', 'SEVENTEEN', 'EIGHTEEN', 'NINETEEN'
      ];
      const b = ['', '', 'TWENTY', 'THIRTY', 'FORTY', 'FIFTY', 'SIXTY', 'SEVENTY', 'EIGHTY', 'NINETY'];

      const inWords2 = (n: number) => {
        if (n < 20) return a[n];
        const tens = Math.floor(n / 10);
        const ones = n % 10;
        return `${b[tens]}${ones ? ` ${a[ones]}` : ''}`.trim();
      };

      const inWords3 = (n: number) => {
        const h = Math.floor(n / 100);
        const r = n % 100;
        const head = h ? `${a[h]} HUNDRED` : '';
        const rest = r ? `${head ? ' ' : ''}${inWords2(r)}` : head;
        return rest.trim();
      };

      const n = Math.floor(Number(num) || 0);
      if (n === 0) return 'ZERO';
      const crore = Math.floor(n / 10000000);
      const lakh = Math.floor((n % 10000000) / 100000);
      const thousand = Math.floor((n % 100000) / 1000);
      const hundred = n % 1000;

      const parts: string[] = [];
      if (crore) parts.push(`${inWords3(crore)} CRORE`);
      if (lakh) parts.push(`${inWords3(lakh)} LAKH`);
      if (thousand) parts.push(`${inWords3(thousand)} THOUSAND`);
      if (hundred) parts.push(`${inWords3(hundred)}`);
      return parts.join(' ').replace(/\s+/g, ' ').trim();
    };

    const amountInWords = (amount: number) => {
      const v = Number(amount || 0);
      const rupees = Math.floor(v);
      const paise = Math.round((v - rupees) * 100);
      const rupeeWords = `${numberToWordsIndian(rupees)} RUPEES`;
      const paiseWords = paise ? ` AND ${numberToWordsIndian(paise)} PAISE` : '';
      return `${rupeeWords}${paiseWords} ONLY`;
    };

    const handleDownloadPDF = (inv: Invoice) => {
      const ord = orders.find(o => o.id === inv.orderId);
      if (!ord) { toast.error('Order not found for invoice'); return; }
      openInvoicePdfPreview(inv, ord, company, customers);
    };

    const handleDownloadInvoicePdfFile = (inv: Invoice) => {
      const ord = orders.find(o => o.id === inv.orderId);
      if (!ord) { toast.error('Order not found for invoice'); return; }
      downloadInvoicePdf(inv, ord, company, customers);
    };


    const handleCreateInvoice = async () => {
      if (saving) return;
      if (!form.orderId) { toast.error("Select an order"); return; }
      setSaving(true);
      try {
        const payload = {
          orderId: form.orderId,
          invoiceDate: form.invoiceDate,
          paymentTermsDays: Number(form.paymentTermsDays) || 30,
          billingAddress: form.billingAddress,
          shippingAddress: form.shippingAddress,
          notes: form.notes,
        };
        await createInvoice(payload);
        setDialogOpen(false);
        setForm({ orderId: "", invoiceDate: new Date().toISOString().slice(0,10), paymentTermsDays: "30", billingAddress: "", shippingAddress: "", notes: "" });
        await loadData();
        toast.success("Invoice generated");
      } catch (e) {
        console.error(e);
        toast.error("Failed to create invoice");
      } finally {
        setSaving(false);
      }
    };

    return (
        <MainLayout>
            <div className="space-y-6">
                {/* Header */}
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <h1 className="text-3xl font-bold text-foreground">Invoices</h1>
                        <p className="text-muted-foreground">
                            Manage billing, track payments, and generate financial reports
                        </p>
                    </div>
                    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                        <DialogTrigger asChild>
                            <Button className="bg-[#10b981] hover:bg-[#059669] text-white" onClick={() => setDialogOpen(true)}>
                                <Plus className="mr-2 h-4 w-4" /> New Invoice
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-[850px] h-[90vh] p-0 flex flex-col">
                            <DialogHeader className="p-6 pb-2">
                                <DialogTitle>Generate New Invoice</DialogTitle>
                                <DialogDescription>Create a GST-compliant invoice for a customer order.</DialogDescription>
                            </DialogHeader>
                            <ScrollArea className="flex-1 px-6 pb-6">
                                <div className="space-y-8 py-4">
                                    {/* Section 1: Customer & Order */}
                                    <div className="space-y-4">
                                        <div className="flex items-center gap-2 text-[#10b981] font-semibold border-b pb-2">
                                            <ClipboardList className="h-4 w-4" />
                                            <span className="text-sm">Customer & Order Reference</span>
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <Label className="text-xs">Select Customer</Label>
                                                <Select value={selectableOrders.find(o => o.id === form.orderId)?.customerId || ""} disabled>
                                                    <SelectTrigger className="bg-card border-none h-9 text-xs">
                                                        <SelectValue placeholder="Search customer" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {customers.map(c => (
                                                          <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div className="space-y-2">
                                                <Label className="text-xs">Linked Order ID</Label>
                                                <Select value={form.orderId} onValueChange={(v) => setForm(s => ({ ...s, orderId: v }))}>
                                                    <SelectTrigger className="bg-card border-none h-9 text-xs">
                                                        <SelectValue placeholder="Select approved order" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {selectableOrders.map(o => (
                                                          <SelectItem key={o.id} value={o.id}>{o.orderNo} — {o.customerName}</SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-4">
                                        <div className="flex items-center gap-2 text-[#10b981] font-semibold border-b pb-2">
                                            <User className="h-4 w-4" />
                                            <span className="text-sm">Customer Summary</span>
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                            <Card className="bg-muted/20">
                                                <CardContent className="p-4">
                                                    <div className="text-xs text-muted-foreground">Customer</div>
                                                    <div className="font-semibold text-sm">{selectedOrder?.customerName || '-'}</div>
                                                    <div className="text-[11px] text-muted-foreground">{selectedCustomer?.customerNo ? `ID: ${selectedCustomer.customerNo}` : ''}</div>
                                                </CardContent>
                                            </Card>
                                            <Card className="bg-muted/20">
                                                <CardContent className="p-4">
                                                    <div className="text-xs text-muted-foreground">Salesman</div>
                                                    <div className="font-semibold text-sm">{selectedOrder?.salesmanName || '-'}</div>
                                                    <div className="text-[11px] text-muted-foreground">{selectedOrder?.salesmanCode ? `Code: ${selectedOrder.salesmanCode}` : ''}</div>
                                                </CardContent>
                                            </Card>
                                            <Card className="bg-muted/20">
                                                <CardContent className="p-4">
                                                    <div className="text-xs text-muted-foreground">Contact</div>
                                                    <div className="font-semibold text-sm">{selectedCustomer?.phone || '-'}</div>
                                                    <div className="text-[11px] text-muted-foreground">{selectedCustomer?.city ? `${selectedCustomer.city}${selectedCustomer.state ? `, ${selectedCustomer.state}` : ''}` : ''}</div>
                                                </CardContent>
                                            </Card>
                                        </div>
                                    </div>

                                    <div className="space-y-4">
                                        <div className="flex items-center gap-2 text-[#10b981] font-semibold border-b pb-2">
                                            <ClipboardList className="h-4 w-4" />
                                            <span className="text-sm">Previous Purchase History</span>
                                        </div>
                                        <div className="rounded-lg border bg-muted/20 overflow-hidden">
                                            <Table>
                                                <TableHeader className="bg-muted/20">
                                                    <TableRow className="h-10">
                                                        <TableHead className="text-[10px] font-bold uppercase">Date</TableHead>
                                                        <TableHead className="text-[10px] font-bold uppercase">Order #</TableHead>
                                                        <TableHead className="text-[10px] font-bold uppercase">Salesman</TableHead>
                                                        <TableHead className="text-[10px] font-bold uppercase text-right">Total</TableHead>
                                                        <TableHead className="text-[10px] font-bold uppercase">Status</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {selectedOrder?.customerId ? (customerHistory.length > 0 ? (
                                                        customerHistory.map((o) => (
                                                            <TableRow key={o.id} className="h-11">
                                                                <TableCell className="text-xs">{o.orderDate || ""}</TableCell>
                                                                <TableCell className="text-xs font-mono">{o.orderNo}</TableCell>
                                                                <TableCell className="text-xs">{o.salesmanName || ""}{o.salesmanCode ? ` (${o.salesmanCode})` : ""}</TableCell>
                                                                <TableCell className="text-xs text-right font-semibold">{formatCurrency(o.netAmount || 0)}</TableCell>
                                                                <TableCell className="text-xs">{o.paymentStatus || o.status}</TableCell>
                                                            </TableRow>
                                                        ))
                                                    ) : (
                                                        <TableRow className="h-11"><TableCell colSpan={5} className="text-xs text-muted-foreground">No previous purchases found.</TableCell></TableRow>
                                                    )) : (
                                                        <TableRow className="h-11"><TableCell colSpan={5} className="text-xs text-muted-foreground">Select an order to view history.</TableCell></TableRow>
                                                    )}
                                                </TableBody>
                                            </Table>
                                        </div>
                                    </div>

                                    {/* Section 2: Billing & Shipping */}
                                    <div className="space-y-4">
                                        <div className="flex items-center gap-2 text-[#10b981] font-semibold border-b pb-2">
                                            <Building className="h-4 w-4" />
                                            <span className="text-sm">Billing Details</span>
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <Label className="text-xs">Billing Address</Label>
                                                <Textarea placeholder="Billing address" className="bg-background border-none resize-none h-20 text-xs" value={form.billingAddress} onChange={(e) => setForm(s => ({ ...s, billingAddress: e.target.value }))} />
                                            </div>
                                            <div className="space-y-2">
                                                <Label className="text-xs">Shipping Address (if different)</Label>
                                                <Textarea placeholder="Enter shipping address" className="bg-background border-none resize-none h-20 text-xs" value={form.shippingAddress} onChange={(e) => setForm(s => ({ ...s, shippingAddress: e.target.value }))} />
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                            <div className="space-y-2">
                                                <Label className="text-xs">Customer GSTIN</Label>
                                                <Input readOnly placeholder="-" className="bg-background border-none h-9 text-xs" value={selectedCustomer?.gstNo || ""} />
                                            </div>
                                            <div className="space-y-2">
                                                <Label className="text-xs">Place of Supply</Label>
                                                <Input placeholder="e.g., Maharashtra (27)" className="bg-background border-none h-9 text-xs" value={selectedCustomer?.state || ""} readOnly={Boolean(selectedCustomer?.state)} />
                                            </div>
                                            <div className="space-y-2">
                                                <Label className="text-xs">Payment Terms</Label>
                                                <Select value={form.paymentTermsDays} onValueChange={(v) => setForm(s => ({ ...s, paymentTermsDays: v }))}>
                                                    <SelectTrigger className="bg-card border-none h-9 text-xs">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="0">Immediate</SelectItem>
                                                        <SelectItem value="15">Net 15</SelectItem>
                                                        <SelectItem value="30">Net 30</SelectItem>
                                                        <SelectItem value="45">Net 45</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Section 3: Itemized List */}
                                    <div className="space-y-4">
                                        <div className="flex items-center justify-between border-b pb-2">
                                            <div className="flex items-center gap-2 text-[#10b981] font-semibold">
                                                <FileText className="h-4 w-4" />
                                                <span className="text-sm">Invoice Items</span>
                                            </div>
                                            <div className="text-xs text-muted-foreground">Items are copied from the selected order</div>
                                        </div>
                                        <div className="rounded-lg border bg-muted/20 overflow-hidden">
                                            <Table>
                                                <TableHeader className="bg-muted/20">
                                                    <TableRow className="h-10">
                                                        <TableHead className="text-[10px] w-[40%] font-bold uppercase">Product / Description</TableHead>
                                                        <TableHead className="text-[10px] font-bold uppercase text-center">Qty</TableHead>
                                                        <TableHead className="text-[10px] font-bold uppercase text-right">Rate</TableHead>
                                                        <TableHead className="text-[10px] font-bold uppercase text-right">Tax (%)</TableHead>
                                                        <TableHead className="text-[10px] font-bold uppercase text-right">Total</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {selectedOrder && selectedOrder.items && selectedOrder.items.length > 0 ? (
                                                      selectedOrder.items.map((it, idx) => (
                                                        <TableRow key={idx} className="h-12">
                                                          <TableCell className="text-xs font-medium">{it.productName}</TableCell>
                                                          <TableCell className="text-xs text-center">{it.quantity}</TableCell>
                                                          <TableCell className="text-xs text-right">{formatCurrency(it.unitPrice)}</TableCell>
                                                          <TableCell className="text-xs text-right">{it.tax}%</TableCell>
                                                          <TableCell className="text-xs font-bold text-right">{formatCurrency(it.total)}</TableCell>
                                                        </TableRow>
                                                      ))
                                                    ) : (
                                                      <TableRow className="h-12">
                                                        <TableCell className="text-xs font-medium">Items will be populated from the order at generation</TableCell>
                                                        <TableCell className="text-xs text-center">-</TableCell>
                                                        <TableCell className="text-xs text-right">-</TableCell>
                                                        <TableCell className="text-xs text-right">-</TableCell>
                                                        <TableCell className="text-xs font-bold text-right">-</TableCell>
                                                      </TableRow>
                                                    )}
                                                </TableBody>
                                            </Table>
                                        </div>
                                    </div>

                                    {/* Section 4: Totals & Bank Details */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                        <div className="space-y-4">
                                            <div className="flex items-center gap-2 text-[#10b981] font-semibold border-b pb-2">
                                                <CreditCard className="h-4 w-4" />
                                                <span className="text-sm">Bank & Payment Instructions</span>
                                            </div>
                                            <div className="space-y-2">
                                                <Label className="text-xs">Payment Account</Label>
                                                <Select defaultValue="bank1">
                                                    <SelectTrigger className="bg-card border-none h-9 text-xs">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="bank1">HDFC Bank - 50100xxx... (Primary)</SelectItem>
                                                        <SelectItem value="bank2">ICICI Bank - 00210xxx...</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div className="space-y-2">
                                                <Label className="text-xs">Notes for Customer</Label>
                                                <Textarea placeholder="Add a message or payment instructions..." className="bg-background border-none resize-none h-20 text-xs" value={form.notes} onChange={(e) => setForm(s => ({ ...s, notes: e.target.value }))} />
                                            </div>
                                        </div>
                                        <div className="bg-muted/20 p-4 rounded-xl space-y-3">
                                            <div className="flex justify-between text-xs text-muted-foreground">
                                                <span>Subtotal</span>
                                                <span className="font-medium">{formatCurrency(selectedOrder?.totalAmount || 0)}</span>
                                            </div>
                                            <div className="flex justify-between text-xs text-muted-foreground">
                                                <span>Total GST</span>
                                                <span className="font-medium">{formatCurrency(selectedOrder?.taxAmount || 0)}</span>
                                            </div>
                                            <div className="flex justify-between text-xs text-muted-foreground">
                                                <span>Discount</span>
                                                <span className="font-medium text-red-500">{formatCurrency(selectedOrder?.discountAmount || 0)}</span>
                                            </div>
                                            <Separator className="bg-border/50" />
                                            <div className="flex justify-between text-lg font-bold text-[#10b981]">
                                                <span>Total Amount</span>
                                                <span>{formatCurrency(selectedOrder?.netAmount || 0)}</span>
                                            </div>
                                            <div className="pt-2">
                                                <div className="text-[10px] text-muted-foreground italic uppercase flex items-center gap-1">
                                                    <CheckCircle2 className="h-3 w-3 text-[#10b981]" />
                                                    Digitally signed for PharmaFlow Pro
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </ScrollArea>
                            <div className="p-6 pt-2 border-t flex justify-end gap-3 bg-card rounded-b-lg">
                                <Button variant="outline" className="text-xs h-9 px-6" onClick={() => setDialogOpen(false)}>Cancel</Button>
                                <Button className="bg-[#10b981] hover:bg-[#059669] text-white text-xs h-9 px-6 font-semibold" onClick={handleCreateInvoice} disabled={saving}>{saving ? "Generating..." : "Generate Invoice"}</Button>
                            </div>
                        </DialogContent>
                    </Dialog>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <StatsCard
                        title="Total Invoiced"
                        value={formatCurrency(stats.totalInvoiced)}
                        trend={{ value: 12, isPositive: true }}
                        icon={IndianRupee}
                        variant="primary"
                    />
                    <StatsCard
                        title="Payments Received"
                        value={formatCurrency(stats.paymentsReceived)}
                        subtitle={stats.totalInvoiced > 0 ? `${Math.round((stats.paymentsReceived/stats.totalInvoiced)*100)}% Recovery Rate` : undefined}
                        icon={CheckCircle2}
                    />
                    <StatsCard
                        title="Pending Dues"
                        value={formatCurrency(stats.pendingDues)}
                        subtitle={`${invoices.filter(i => i.status !== 'paid').length} Invoices pending`}
                        icon={Clock}
                        variant="warning"
                    />
                    <StatsCard
                        title="Overdue"
                        value={formatCurrency(stats.overdue)}
                        subtitle={`${invoices.filter(i => i.status === 'overdue').length} Critical accounts`}
                        icon={AlertTriangle}
                        variant="danger"
                    />
                </div>

                {/* Filter Bar */}
                <Card>
                    <CardContent className="p-4 flex flex-col md:flex-row gap-4">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                            <Input
                                placeholder="Search by Invoice ID, Customer, or Order No..."
                                className="pl-10"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                        <div className="flex gap-2">
                            <Select value={statusFilter} onValueChange={setStatusFilter}>
                                <SelectTrigger className="w-[150px]">
                                    <Filter className="mr-2 h-4 w-4" />
                                    <SelectValue placeholder="Status" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Status</SelectItem>
                                    <SelectItem value="paid">Paid</SelectItem>
                                    <SelectItem value="unpaid">Unpaid</SelectItem>
                                    <SelectItem value="partial">Partial</SelectItem>
                                    <SelectItem value="overdue">Overdue</SelectItem>
                                </SelectContent>
                            </Select>
                            <Button variant="outline" size="icon" onClick={exportInvoicesCsv}>
                                <Download className="h-4 w-4" />
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                {/* Invoice Table */}
                <Card>
                    <CardHeader>
                        <CardTitle>Recent Invoices ({filtered.length})</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Invoice & Date</TableHead>
                                        <TableHead>Customer & Order</TableHead>
                                        <TableHead className="text-right">Base Amount</TableHead>
                                        <TableHead className="text-right">Tax & Disc.</TableHead>
                                        <TableHead className="text-right">Total</TableHead>
                                        <TableHead>Due Date</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead className="text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filtered.map((inv) => (
                                        <TableRow key={inv.id}>
                                            <TableCell>
                                                <div className="space-y-1">
                                                    <p className="font-medium text-foreground text-primary">{inv.invoiceNo}</p>
                                                    <div className="text-[10px] text-muted-foreground flex items-center gap-1 uppercase">
                                                        <Calendar className="h-3 w-3" /> {inv.date}
                                                    </div>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="space-y-1">
                                                    <p className="font-medium text-foreground">{inv.customer}</p>
                                                    <div className="flex items-center gap-2">
                                                        <Badge variant="outline" className="text-[10px] h-4 py-0 font-medium">
                                                            {inv.customerType}
                                                        </Badge>
                                                        <span className="text-[10px] text-muted-foreground uppercase">{inv.orderNo}</span>
                                                    </div>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-right font-medium text-sm">{formatCurrency(inv.amount)}</TableCell>
                                            <TableCell className="text-right">
                                                <div className="space-y-0.5">
                                                    <p className="text-[11px] text-green-600 font-medium">+{formatCurrency(inv.tax)}</p>
                                                    <p className="text-[11px] text-red-500 font-medium">-{formatCurrency(inv.discount)}</p>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-right font-bold text-sm">{formatCurrency(inv.total)}</TableCell>
                                            <TableCell>
                                                <span className={cn(
                                                    "text-xs font-medium uppercase",
                                                    inv.status === "overdue" ? "text-red-600" : "text-muted-foreground"
                                                )}>
                                                    {inv.dueDate}
                                                </span>
                                            </TableCell>
                                            <TableCell>
                                                <Badge className={cn("px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider", statusStyles[inv.status])}>
                                                    {inv.status}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex justify-end gap-2">
                                                    <Button variant="ghost" size="icon" onClick={() => handleDownloadPDF(inv)}>
                                                        <Printer className="h-4 w-4" />
                                                    </Button>
                                                    <Button variant="ghost" size="icon" onClick={() => handleDownloadInvoicePdfFile(inv)}>
                                                        <Download className="h-4 w-4" />
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
            </div>
        </MainLayout>
    );
};

export default Invoices;
 
