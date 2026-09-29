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
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { getCustomers, createCustomer, updateCustomer, deleteCustomer, getOrders, getPayments, getCompanyInfo } from "@/lib/api";
import { formatCurrency } from "@/lib/currency";
import { Plus, Search, Filter, Download, Edit, Eye, Trash2, CreditCard, Building2 } from "lucide-react";
import { toast } from "sonner";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
 

const typeStyles = {
  distributor: "bg-primary/10 text-primary border-primary/20",
  wholesaler: "bg-chart-1/10 text-chart-1 border-chart-1/20",
  retailer: "bg-chart-3/10 text-chart-3 border-chart-3/20",
  hospital: "bg-chart-4/10 text-chart-4 border-chart-4/20",
};

const statusStyles = {
  active: "bg-primary/10 text-primary border-primary/20",
  inactive: "bg-muted text-muted-foreground border-muted/20",
  blocked: "bg-destructive/10 text-destructive border-destructive/20",
};

type Customer = {
  id: string;
  customerNo?: string;
  name: string;
  type: "distributor" | "wholesaler" | "retailer" | "hospital";
  contactPerson: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  state: string;
  creditLimit: number;
  outstandingBalance: number;
  gstNo: string;
  drugLicenseNo: string;
  status: "active" | "inactive" | "blocked";
};

const Customers = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [viewOpen, setViewOpen] = useState(false);
  const [viewCustomer, setViewCustomer] = useState<Customer | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailOrders, setDetailOrders] = useState<any[]>([]);
  const [detailPayments, setDetailPayments] = useState<any[]>([]);
  const [customerForm, setCustomerForm] = useState({
    name: "",
    type: "retailer",
    contactPerson: "",
    phone: "",
    email: "",
    address: "",
    city: "",
    state: "",
    creditLimit: "",
    outstandingBalance: "",
    gstNo: "",
    drugLicenseNo: "",
    status: "active",
  });
  const [company, setCompany] = useState<any>(null);

  const loadCustomers = async () => {
    try {
      const res = await getCustomers();
      const data: Customer[] = (res?.customers || []).map((c: any) => ({
        id: String(c.id),
        customerNo: c.customerNo || "",
        name: c.name || "",
        type: c.type || "retailer",
        contactPerson: c.contactPerson || "",
        phone: c.phone || "",
        email: c.email || "",
        address: c.address || "",
        city: c.city || "",
        state: c.state || "",
        creditLimit: typeof c.creditLimit === "number" ? c.creditLimit : Number(c.creditLimit || 0),
        outstandingBalance: typeof c.outstandingBalance === "number" ? c.outstandingBalance : Number(c.outstandingBalance || 0),
        gstNo: c.gstNo || "",
        drugLicenseNo: c.drugLicenseNo || "",
        status: c.status || "active",
      }));
      setCustomers(data);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    loadCustomers();
  }, []);

  useEffect(() => {
    (async () => {
      try { const res = await getCompanyInfo(); setCompany(res?.company || null); } catch {}
    })();
  }, []);

  useEffect(() => {
    const fetchDetails = async () => {
      if (!viewOpen || !viewCustomer?.id) return;
      try {
        setDetailLoading(true);
        const [ordersRes, paymentsRes] = await Promise.all([getOrders(), getPayments()]);
        const orders = (ordersRes?.orders || []).filter((o: any) => String(o.customerId) === String(viewCustomer.id));
        const payments = (paymentsRes?.payments || []).filter((p: any) => String(p.customerId) === String(viewCustomer.id));
        setDetailOrders(orders);
        setDetailPayments(payments);
      } catch (e: any) {
        console.error(e);
        try { toast.error(e?.message || "Failed to load customer details"); } catch {}
      } finally {
        setDetailLoading(false);
      }
    };
    fetchDetails();
  }, [viewOpen, viewCustomer?.id]);

  const ordersTotal = detailOrders.reduce((s, o) => s + Number(o?.netAmount || 0), 0);
  const paymentsTotal = detailPayments.reduce((s, p) => s + Number(p?.amount || 0), 0);
  const payableAmount = viewCustomer ? Number(viewCustomer.outstandingBalance ?? Math.max(0, ordersTotal - paymentsTotal)) : 0;
  const visitsCount = detailOrders.length;

  const openAdd = () => {
    setEditingId(null);
    setCustomerForm({
      name: "",
      type: "retailer",
      contactPerson: "",
      phone: "",
      email: "",
      address: "",
      city: "",
      state: "",
      creditLimit: "",
      outstandingBalance: "0",
      gstNo: "",
      drugLicenseNo: "",
      status: "active",
    });
    setDialogOpen(true);
  };

  const openEdit = (c: Customer) => {
    setEditingId(c.id);
    setCustomerForm({
      name: c.name || "",
      type: c.type as any,
      contactPerson: c.contactPerson || "",
      phone: c.phone || "",
      email: c.email || "",
      address: c.address || "",
      city: c.city || "",
      state: c.state || "",
      creditLimit: String(c.creditLimit ?? ""),
      outstandingBalance: String(c.outstandingBalance ?? ""),
      gstNo: c.gstNo || "",
      drugLicenseNo: c.drugLicenseNo || "",
      status: c.status as any,
    });
    setDialogOpen(true);
  };

  const openView = (c: Customer) => {
    setViewCustomer(c);
    setViewOpen(true);
  };

  const openDelete = (id: string) => {
    setDeleteId(id);
    setDeleteOpen(true);
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteCustomer(deleteId);
      toast.success("Customer deleted");
      await loadCustomers();
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || "Failed to delete customer");
    } finally {
      setDeleteOpen(false);
      setDeleteId(null);
    }
  };

  const handleDownloadCustomersListPdf = async () => {
    try {
      const doc = new jsPDF({ orientation: "p", unit: "pt", format: "a4" });
      const now = new Date();

      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const marginX = 40;

      const companyName = String(company?.companyName || "PharmaFlow Pro");
      const title = "Customer Balance List";
      const generatedLabel = `Generated: ${now.toLocaleString()}`;

      doc.setFillColor(16, 185, 129);
      doc.rect(0, 0, pageWidth, 88, "F");

      doc.setTextColor(255, 255, 255);
      doc.setFontSize(18);
      doc.text(companyName, marginX, 34);
      doc.setFontSize(12);
      doc.text(title, marginX, 56);
      doc.setFontSize(10);
      const genW = doc.getTextWidth(generatedLabel);
      doc.text(generatedLabel, pageWidth - marginX - genW, 34);

      doc.setTextColor(15, 23, 42);

      const [ordersRes, paymentsRes] = await Promise.all([getOrders(), getPayments()]);
      const ordersAll = (ordersRes?.orders || []) as any[];
      const paymentsAll = (paymentsRes?.payments || []) as any[];
      const totalByCustomer: Record<string, number> = {};
      const paidByCustomer: Record<string, number> = {};
      for (const o of ordersAll) {
        const cid = String(o?.customerId || "");
        if (!cid) continue;
        totalByCustomer[cid] = (totalByCustomer[cid] || 0) + Number(o?.netAmount || 0);
      }
      for (const p of paymentsAll) {
        const cid = String(p?.customerId || "");
        if (!cid) continue;
        paidByCustomer[cid] = (paidByCustomer[cid] || 0) + Number(p?.amount || 0);
      }

      let grandTotal = 0;
      let grandPaid = 0;
      let grandRemaining = 0;

      const rows = filteredCustomers.map((c) => {
        const total = Number(totalByCustomer[String(c.id)] || 0);
        const paid = Number(paidByCustomer[String(c.id)] || 0);
        const net = total - paid;
        const status = net > 0 ? "Receivable" : net < 0 ? "Payable" : "Settled";
        const remaining = Math.abs(net);
        grandTotal += total;
        grandPaid += paid;
        grandRemaining += remaining;
        return [
          c.name || "",
          formatCurrency(total),
          formatCurrency(paid),
          formatCurrency(remaining),
          status,
        ];
      });

      doc.setFillColor(241, 245, 249);
      doc.roundedRect(marginX, 96, pageWidth - marginX * 2, 36, 6, 6, "F");
      doc.setTextColor(15, 23, 42);
      doc.setFontSize(10);
      doc.text(`Total: ${formatCurrency(grandTotal)}`, marginX + 12, 118);
      doc.text(`Paid: ${formatCurrency(grandPaid)}`, marginX + 190, 118);
      doc.text(`Remaining: ${formatCurrency(grandRemaining)}`, marginX + 330, 118);

      autoTable(doc, {
        startY: 148,
        head: [["Customer", "Total", "Paid", "Remaining", "Type"]],
        body: rows,
        theme: "striped",
        styles: { fontSize: 10, cellPadding: 7, textColor: [15, 23, 42], lineColor: [226, 232, 240], lineWidth: 0.5 },
        headStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontStyle: "bold" },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        columnStyles: {
          0: { cellWidth: 200 },
          1: { cellWidth: 85, halign: "right" },
          2: { cellWidth: 85, halign: "right" },
          3: { cellWidth: 85, halign: "right" },
          4: { cellWidth: 60 },
        },
        didParseCell: (data) => {
          if (data.section === "body" && data.column.index === 4) {
            const v = String(data.cell.raw || "").toLowerCase();
            if (v === "receivable") data.cell.styles.textColor = [22, 163, 74];
            if (v === "payable") data.cell.styles.textColor = [220, 38, 38];
            if (v === "settled") data.cell.styles.textColor = [100, 116, 139];
          }
          if (data.section === "body" && data.column.index === 3) {
            const typeVal = String((data.row.raw as any)?.[4] || "").toLowerCase();
            if (typeVal === "receivable") data.cell.styles.textColor = [22, 163, 74];
            if (typeVal === "payable") data.cell.styles.textColor = [220, 38, 38];
            if (typeVal === "settled") data.cell.styles.textColor = [100, 116, 139];
          }
        },
      });

      doc.setFontSize(9);
      doc.setTextColor(100, 116, 139);
      doc.text(companyName, marginX, pageHeight - 24);
      const pageLabel = "Page 1";
      const pageW = doc.getTextWidth(pageLabel);
      doc.text(pageLabel, pageWidth - marginX - pageW, pageHeight - 24);

      doc.save(`customers_${now.toISOString().slice(0, 10)}.pdf`);
    } catch (e: any) {
      try { toast.error(e?.message || "Failed to generate PDF"); } catch {}
    }
  };

  const handleDownloadCustomerPdf = async () => {
    try {
      const c = viewCustomer!;
      // Ensure details are loaded in case user clicks immediately
      let orders = detailOrders;
      let pays = detailPayments;
      if ((!orders || orders.length === 0) || (!pays || pays.length === 0)) {
        try {
          const [ordersRes, paymentsRes] = await Promise.all([getOrders(), getPayments()]);
          orders = (ordersRes?.orders || []).filter((o: any) => String(o.customerId) === String(c.id));
          pays = (paymentsRes?.payments || []).filter((p: any) => String(p.customerId) === String(c.id));
        } catch {}
      }
      const headerName = (company?.companyName || "PharmaFlow Pro");
      const addressLine = [company?.address, company?.city, company?.state, company?.pinCode].filter(Boolean).join(", ");
      const idLine = [company?.gstNo ? `GST: ${company.gstNo}` : "", company?.drugLicenseNo ? `DL: ${company.drugLicenseNo}` : "", company?.fssaiLicense ? `FSSAI: ${company.fssaiLicense}` : ""].filter(Boolean).join(" | ");
      const contactLine = [company?.phone ? `Ph: ${company.phone}` : "", company?.email || ""].filter(Boolean).join(" • ");

      const paidByOrder: Record<string, number> = {};
      (pays || []).forEach((p) => {
        const key = String(p.orderId || p.orderNo || "");
        if (!key) return;
        paidByOrder[key] = (paidByOrder[key] || 0) + Number(p.amount || 0);
      });
      let sumNet = 0, sumPaid = 0, sumRemaining = 0;
      const ordersRows = (orders || []).map((o: any) => {
        const key = String(o.id || o.orderId || o.orderNo || "");
        const net = Number(o.netAmount || 0);
        const paid = paidByOrder[key] || 0;
        const remaining = Math.max(0, net - paid);
        sumNet += net; sumPaid += paid; sumRemaining += remaining;
        return `
          <tr>
            <td>${o.orderDate || ""}</td>
            <td class="mono">${o.orderNo || ""}</td>
            <td class="right">${formatCurrency(net)}</td>
            <td class="right">${formatCurrency(paid)}</td>
            <td class="right">${formatCurrency(remaining)}</td>
            <td>${o.status || ""}</td>
            <td>${o.paymentStatus || ""}</td>
          </tr>`;
      }).join("");
      const paymentsTotalLocal = (pays || []).reduce((s, p) => s + Number(p.amount || 0), 0);
      const overallRemaining = Math.max(0, sumNet - paymentsTotalLocal);

      const infoHtml = `
        <div class="info">
          <div class="meta-row">
            <span><strong>Name:</strong> ${c.name} (${c.type}, ${c.status})</span>
            <span><strong>Contact:</strong> ${(c.contactPerson || '-')}${(c.contactPerson && c.phone) ? ' | ' : ''}${(c.phone || '')}</span>
            <span><strong>Email:</strong> ${c.email || '-'}</span>
          </div>
          <div><strong>Address:</strong> ${c.address}, ${c.city}, ${c.state}</div>
          <div><strong>Credit Limit:</strong> ${formatCurrency(c.creditLimit)} &nbsp; | &nbsp; <strong>Outstanding:</strong> ${formatCurrency(c.outstandingBalance)}</div>
          <div><strong>Total Spent:</strong> ${formatCurrency(sumNet)} &nbsp; | &nbsp; <strong>Paid:</strong> ${formatCurrency(paymentsTotalLocal)} &nbsp; | &nbsp; <strong>Remaining:</strong> ${formatCurrency(overallRemaining)}</div>
        </div>`;

      const paysRows = (pays || []).map((p: any) => `
        <tr>
          <td>${p.date || ""}</td>
          <td class="mono">${p.orderId || "-"}</td>
          <td class="right">${formatCurrency(Number(p.amount||0))}</td>
          <td>${p.method || ""}</td>
          <td class="mono">${p.reference || ""}</td>
        </tr>
      `).join("");

      const html = `<!doctype html><html><head><meta charset="utf-8"><title>${c.name}_report</title>
        <link rel="preconnect" href="https://fonts.googleapis.com">
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
        <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap" rel="stylesheet">
        <style>
          @page { size: A4; margin: 12mm; }
          * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          body { margin: 0; font-family: 'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Helvetica Neue', Arial, 'Noto Sans', sans-serif; color: #0f172a; }
          .container { width: 100%; }
          .header { display:flex; justify-content:space-between; align-items:flex-start; border-bottom:2px solid #0f172a; padding-bottom:8px; margin-bottom:12px; }
          .company { max-width: 70%; }
          .title { font-size: 22px; font-weight: 700; }
          .muted { color:#475569; font-size:12px; }
          table { width:100%; border-collapse: collapse; }
          thead th { font-size: 12px; background: #f1f5f9; color: #0f172a; }
          th, td { padding: 8px; border: 1px solid #e2e8f0; vertical-align: top; font-size: 12px; }
          .right { text-align: right; }
          .mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace; font-size: 11px; }
          .section { margin-top: 12px; }
          .footer { margin-top: 18px; text-align:center; font-size: 12px; color:#64748b; }
          .summary { margin: 8px 0; font-size: 13px; }
          .info { display:grid; grid-template-columns: 1fr; gap: 4px; font-size: 12px; margin-bottom: 8px; }
          .meta-row { display:flex; gap: 16px; align-items: baseline; flex-wrap: wrap; }
          .meta-row span { margin-right: 16px; }
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
            </div>
            <div style="text-align:right">
              <div class="muted">Generated</div>
              <div style="font-size:12px;">${new Date().toLocaleString()}</div>
            </div>
          </div>
          <div class="section">
            <div style="font-weight:600">Customer Report</div>
            ${infoHtml}
          </div>
          <div class="section">
            <table>
              <thead>
                <tr>
                  <th>Order Date</th>
                  <th>Order #</th>
                  <th class="right">Total</th>
                  <th class="right">Paid</th>
                  <th class="right">Remaining</th>
                  <th>Status</th>
                  <th>Payment</th>
                </tr>
              </thead>
              <tbody>
                ${ordersRows || `<tr><td colspan="7" style="text-align:center;color:#64748b;">No orders</td></tr>`}
              </tbody>
            </table>
            <div class="summary">Invoices Summary: Total ${formatCurrency(sumNet)} | Paid ${formatCurrency(sumPaid)} | Remaining ${formatCurrency(sumRemaining)}</div>
          </div>
          <div class="section">
            <table>
              <thead>
                <tr>
                  <th>Payment Date</th>
                  <th>Order</th>
                  <th class="right">Amount</th>
                  <th>Method</th>
                  <th>Ref</th>
                </tr>
              </thead>
              <tbody>
                ${paysRows || `<tr><td colspan="5" style="text-align:center;color:#64748b;">No payments</td></tr>`}
              </tbody>
            </table>
          </div>
          <div class="footer">Digitally generated by PharmaFlow Pro</div>
        </div>
      </body></html>`;
      const w = window.open('', '_blank');
      if (!w) return;
      w.document.write(html);
      w.document.close();
    } catch (e) {
      console.error(e);
    }
  };

  const handleSaveCustomer = async () => {
    if (saving) return;
    setSaving(true);
    const { outstandingBalance: _outstandingBalance, ...rest } = customerForm;
    const payload = {
      ...rest,
      creditLimit: Number(customerForm.creditLimit) || 0,
    };
    try {
      if (editingId) {
        await updateCustomer(editingId, payload);
      } else {
        await createCustomer(payload);
      }
      await loadCustomers();
      setEditingId(null);
      setDialogOpen(false);
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const filteredCustomers = customers.filter((customer) => {
    const matchesSearch =
      customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      customer.contactPerson.toLowerCase().includes(searchTerm.toLowerCase()) ||
      customer.city.toLowerCase().includes(searchTerm.toLowerCase()) ||
      customer.phone.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (customer.customerNo || "").toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType =
      typeFilter === "all" || customer.type === typeFilter;
    const matchesStatus =
      statusFilter === "all" || customer.status === statusFilter;
    return matchesSearch && matchesType && matchesStatus;
  });

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Customers</h1>
            <p className="text-muted-foreground">
              Manage distributors, wholesalers, retailers, and hospitals
            </p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={openAdd}>
                <Plus className="mr-2 h-4 w-4" />
                Add Customer
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[600px]">
              <DialogHeader>
                <DialogTitle>{editingId ? "Edit Customer" : "Add New Customer"}</DialogTitle>
                <DialogDescription>
                  Enter customer details to create a new account
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4 max-h-[60vh] overflow-y-auto">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Business Name</Label>
                    <Input placeholder="e.g., MedPlus Distributors" value={customerForm.name}
                      onChange={(e) => setCustomerForm((s) => ({ ...s, name: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Customer Type</Label>
                    <Select value={customerForm.type} onValueChange={(v) => setCustomerForm((s) => ({ ...s, type: v as any }))}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="distributor">Distributor</SelectItem>
                        <SelectItem value="wholesaler">Wholesaler</SelectItem>
                        <SelectItem value="retailer">Retailer</SelectItem>
                        <SelectItem value="hospital">Hospital</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Contact Person</Label>
                    <Input placeholder="Full name" value={customerForm.contactPerson}
                      onChange={(e) => setCustomerForm((s) => ({ ...s, contactPerson: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Phone Number</Label>
                    <Input placeholder="+91 9876543210" value={customerForm.phone}
                      onChange={(e) => setCustomerForm((s) => ({ ...s, phone: e.target.value }))} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Email Address</Label>
                  <Input type="email" placeholder="email@company.com" value={customerForm.email}
                    onChange={(e) => setCustomerForm((s) => ({ ...s, email: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Address</Label>
                  <Textarea placeholder="Street address" value={customerForm.address}
                    onChange={(e) => setCustomerForm((s) => ({ ...s, address: e.target.value }))} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>City</Label>
                    <Input placeholder="City" value={customerForm.city}
                      onChange={(e) => setCustomerForm((s) => ({ ...s, city: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>State</Label>
                    <Input placeholder="State" value={customerForm.state}
                      onChange={(e) => setCustomerForm((s) => ({ ...s, state: e.target.value }))} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>GST Number</Label>
                    <Input placeholder="27AABCU9603R1ZM" value={customerForm.gstNo}
                      onChange={(e) => setCustomerForm((s) => ({ ...s, gstNo: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Drug License No.</Label>
                    <Input placeholder="DL-MH-2024-XXX" value={customerForm.drugLicenseNo}
                      onChange={(e) => setCustomerForm((s) => ({ ...s, drugLicenseNo: e.target.value }))} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Credit Limit (Rs)</Label>
                  <Input type="number" placeholder="100000" value={customerForm.creditLimit}
                    onChange={(e) => setCustomerForm((s) => ({ ...s, creditLimit: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Outstanding Balance (Rs)</Label>
                  <Input type="number" placeholder="0" value={customerForm.outstandingBalance} disabled readOnly />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                <Button onClick={handleSaveCustomer} disabled={saving}>{saving ? (editingId ? "Updating..." : "Saving...") : (editingId ? "Update" : "Add Customer")}</Button>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={viewOpen} onOpenChange={setViewOpen}>
            <DialogContent className="sm:max-w-[1000px] w-[95vw]">
              <DialogHeader>
                <DialogTitle>Customer Details</DialogTitle>
                <DialogDescription>View customer information and history</DialogDescription>
              </DialogHeader>
              {viewCustomer && (
                <div className="grid gap-4 py-2 max-h-[70vh] overflow-y-auto">
                  <div>
                    <p className="text-xs text-muted-foreground">Business Name</p>
                    <p className="font-medium">{viewCustomer.name}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-muted-foreground">Type</p>
                      <Badge variant="outline" className={typeStyles[viewCustomer.type]}>{viewCustomer.type}</Badge>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Status</p>
                      <Badge variant="outline" className={statusStyles[viewCustomer.status]}>{viewCustomer.status}</Badge>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-muted-foreground">Contact Person</p>
                      <p className="font-medium">{viewCustomer.contactPerson}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Phone</p>
                      <p className="font-medium">{viewCustomer.phone}</p>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Email</p>
                    <p className="font-medium break-all">{viewCustomer.email}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Address</p>
                    <p className="font-medium">{viewCustomer.address}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-muted-foreground">City</p>
                      <p className="font-medium">{viewCustomer.city}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">State</p>
                      <p className="font-medium">{viewCustomer.state}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-muted-foreground">Credit Limit</p>
                      <p className="font-semibold">{formatCurrency(viewCustomer.creditLimit)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Outstanding Balance</p>
                      <p className="font-semibold">{formatCurrency(viewCustomer.outstandingBalance)}</p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground">Credit Usage</p>
                    <div className="space-y-1">
                      <Progress value={(viewCustomer.creditLimit > 0 ? (viewCustomer.outstandingBalance / viewCustomer.creditLimit) * 100 : 0)} className="h-2" />
                      <p className="text-xs text-muted-foreground">
                        {formatCurrency(viewCustomer.outstandingBalance)} used
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                    <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Visits</p><p className="text-xl font-bold">{visitsCount}</p></CardContent></Card>
                    <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Total Spent</p><p className="text-xl font-bold">{formatCurrency(ordersTotal)}</p></CardContent></Card>
                    <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Total Paid</p><p className="text-xl font-bold">{formatCurrency(paymentsTotal)}</p></CardContent></Card>
                    <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Payable</p><p className="text-xl font-bold">{formatCurrency(payableAmount)}</p></CardContent></Card>
                  </div>
                  <div className="grid grid-cols-1 gap-4">
                    <Card>
                      <CardHeader><CardTitle>Orders History ({detailOrders.length})</CardTitle></CardHeader>
                      <CardContent>
                        <div className="overflow-x-auto max-h-64 overflow-y-auto">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Date</TableHead>
                                <TableHead>Order #</TableHead>
                                <TableHead className="text-right">Net</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Payment</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {detailOrders.map((o) => (
                                <TableRow key={o.id || o.orderNo}>
                                  <TableCell>{o.orderDate}</TableCell>
                                  <TableCell className="font-mono text-xs">{o.orderNo}</TableCell>
                                  <TableCell className="text-right">{formatCurrency(Number(o.netAmount || 0))}</TableCell>
                                  <TableCell>{o.status}</TableCell>
                                  <TableCell>{o.paymentStatus}</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader><CardTitle>Payments ({detailPayments.length})</CardTitle></CardHeader>
                      <CardContent>
                        <div className="overflow-x-auto max-h-64 overflow-y-auto">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Date</TableHead>
                                <TableHead>Order</TableHead>
                                <TableHead className="text-right">Amount</TableHead>
                                <TableHead>Method</TableHead>
                                <TableHead>Ref</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {detailPayments.map((p) => (
                                <TableRow key={p.id}>
                                  <TableCell>{p.date}</TableCell>
                                  <TableCell className="font-mono text-xs">{p.orderId}</TableCell>
                                  <TableCell className="text-right">{formatCurrency(Number(p.amount || 0))}</TableCell>
                                  <TableCell>{p.method}</TableCell>
                                  <TableCell className="font-mono text-xs">{p.reference}</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              )}
              <div className="flex justify-end gap-2">
                <Button onClick={handleDownloadCustomerPdf}><Download className="mr-2 h-4 w-4" /> Download PDF</Button>
                <Button variant="outline" onClick={() => setViewOpen(false)}>Close</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <Building2 className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{customers.length}</p>
                  <p className="text-sm text-muted-foreground">Total Customers</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-chart-1/10">
                  <CreditCard className="h-5 w-5 text-chart-1" />
                </div>
                <div>
                  <p className="text-2xl font-bold">
                    {formatCurrency(customers.reduce((sum, c) => sum + c.creditLimit, 0))}
                  </p>
                  <p className="text-sm text-muted-foreground">Total Credit Limit</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-chart-4/10">
                  <CreditCard className="h-5 w-5 text-chart-4" />
                </div>
                <div>
                  <p className="text-2xl font-bold">
                    {formatCurrency(customers.reduce((sum, c) => sum + c.outstandingBalance, 0))}
                  </p>
                  <p className="text-sm text-muted-foreground">Outstanding Balance</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <Building2 className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{customers.filter(c => c.status === 'active').length}</p>
                  <p className="text-sm text-muted-foreground">Active Customers</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search customers, contacts, cities..."
                  className="pl-10"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <div className="flex gap-2">
                <Select value={typeFilter} onValueChange={setTypeFilter}>
                  <SelectTrigger className="w-[140px]">
                    <Filter className="mr-2 h-4 w-4" />
                    <SelectValue placeholder="Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="distributor">Distributors</SelectItem>
                    <SelectItem value="wholesaler">Wholesalers</SelectItem>
                    <SelectItem value="retailer">Retailers</SelectItem>
                    <SelectItem value="hospital">Hospitals</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[120px]">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                    <SelectItem value="blocked">Blocked</SelectItem>
                  </SelectContent>
                </Select>
                <Button variant="outline" size="icon" onClick={handleDownloadCustomersListPdf}>
                  <Download className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Customers Table */}
        <Card>
          <CardHeader>
            <CardTitle>Customer Directory ({filteredCustomers.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Customer</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead className="text-right">Credit Limit</TableHead>
                    <TableHead>Credit Usage</TableHead>
                    <TableHead>Balance</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCustomers.map((customer) => {
                    const creditUsage = (customer.outstandingBalance / customer.creditLimit) * 100;
                    return (
                      <TableRow key={customer.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium text-foreground">{customer.name}</p>
                            <p className="text-xs text-muted-foreground">{(customer.customerNo ? `ID: ${customer.customerNo}` : "") + (customer.gstNo ? (customer.customerNo ? " • " : "") + `GST: ${customer.gstNo}` : "")}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Badge
                              variant="outline"
                              className={customer.outstandingBalance > 0
                                ? "bg-primary/10 text-primary border-primary/20"
                                : (customer.outstandingBalance < 0
                                  ? "bg-destructive/10 text-destructive border-destructive/20"
                                  : "bg-muted/10 text-muted-foreground border-muted/20")}
                            >
                              {customer.outstandingBalance > 0 ? "Receivable" : (customer.outstandingBalance < 0 ? "Payable" : "Settled")}
                            </Badge>
                            <span className="text-sm font-medium">{formatCurrency(customer.outstandingBalance)}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={typeStyles[customer.type]}>
                            {customer.type}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="text-sm">{customer.contactPerson}</p>
                            <p className="text-xs text-muted-foreground">{customer.phone}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="text-sm">{customer.city}</p>
                            <p className="text-xs text-muted-foreground">{customer.state}</p>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <p className="font-semibold">{formatCurrency(customer.creditLimit)}</p>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1 w-32">
                            <Progress value={creditUsage} className="h-2" />
                            <p className="text-xs text-muted-foreground">
                              {formatCurrency(customer.outstandingBalance)} used
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={statusStyles[customer.status]}>
                            {customer.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="icon" title="View Details" onClick={() => openView(customer)}>
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" title="Edit" onClick={() => openEdit(customer)}>
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" title="Delete" onClick={() => openDelete(customer.id)}>
                              <Trash2 className="h-4 w-4" />
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

        <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Customer</AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => { setDeleteOpen(false); setDeleteId(null); }}>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={confirmDelete}>Delete</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </MainLayout>
  );
};

export default Customers;
