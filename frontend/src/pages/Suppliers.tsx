import { useEffect, useMemo, useState, Fragment } from "react";
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
import { getSuppliers, createSupplier, updateSupplier, deleteSupplier, getPurchases, createSupplierPayment, getSupplierPayments, getCompanyInfo } from "@/lib/api";
import { Plus, Search, Filter, Download, Edit, Trash2, Building2, Phone, Mail, ReceiptText } from "lucide-react";
import { toast } from "sonner";
 
import { formatCurrency } from "@/lib/currency";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

 type Supplier = {
  id: string;
  supplierNo?: string;
  name: string;
  contactPerson: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  state: string;
  gstNo: string;
  drugLicenseNo: string;
  status: "active" | "inactive" | "blocked";
  paymentTermsDays: number;
};

const statusStyles: Record<string, string> = {
  active: "bg-primary/10 text-primary border-primary/20",
  inactive: "bg-muted text-muted-foreground border-muted/20",
  blocked: "bg-destructive/10 text-destructive border-destructive/20",
};

const Suppliers = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    contactPerson: "",
    phone: "",
    email: "",
    address: "",
    city: "",
    state: "",
    gstNo: "",
    drugLicenseNo: "",
    status: "active",
    paymentTermsDays: "30",
  });

  // Purchases & payments state
  const [viewPurchasesOpen, setViewPurchasesOpen] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [supplierPurchases, setSupplierPurchases] = useState<Array<{ id: string; purchaseNo: string; date: string; referenceNo: string; netAmount: number; paid: number; balance: number }>>([]);
  const [payDialogOpen, setPayDialogOpen] = useState(false);
  const [selectedPurchaseId, setSelectedPurchaseId] = useState<string | null>(null);
  const [paymentForm, setPaymentForm] = useState({ amount: "", method: "cash", reference: "", date: new Date().toISOString().slice(0,10) });

  // Inline Record Payment section state
  const [expandedSupplierId, setExpandedSupplierId] = useState<string | null>(null);
  const [inlinePurchases, setInlinePurchases] = useState<Array<{ id: string; purchaseNo: string; date: string; referenceNo: string; netAmount: number; paid: number; balance: number }>>([]);
  const [inlineTotals, setInlineTotals] = useState<{ total: number; paid: number; remaining: number }>({ total: 0, paid: 0, remaining: 0 });
  const [inlineSaving, setInlineSaving] = useState(false);
  const [inlineForm, setInlineForm] = useState({ target: "general" as string, amount: "", method: "cash", reference: "", date: new Date().toISOString().slice(0,10) });
  const [company, setCompany] = useState<any>(null);
  const [supplierPayments, setSupplierPayments] = useState<Array<{ id?: string; date: string; amount: number; method?: string; reference?: string; purchaseId?: string }>>([]);

  const loadSuppliers = async () => {
    try {
      const res = await getSuppliers();
      const data: Supplier[] = (res?.suppliers || []).map((s: any) => ({
        id: String(s.id),
        supplierNo: s.supplierNo || "",
        name: s.name || "",
        contactPerson: s.contactPerson || "",
        phone: s.phone || "",
        email: s.email || "",
        address: s.address || "",
        city: s.city || "",
        state: s.state || "",
        gstNo: s.gstNo || "",
        drugLicenseNo: s.drugLicenseNo || "",
        status: s.status || "active",
        paymentTermsDays: typeof s.paymentTermsDays === "number" ? s.paymentTermsDays : Number(s.paymentTermsDays || 30),
      }));
      setSuppliers(data);
    } catch (e) {
      console.error(e);
      toast.error("Failed to load suppliers");
    }
  };

  const handleDownloadSuppliersListPdf = async () => {
    try {
      const doc = new jsPDF({ orientation: "p", unit: "pt", format: "a4" });
      const now = new Date();

      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const marginX = 40;

      const companyName = String(company?.companyName || "PharmaFlow Pro");
      const title = "Supplier Balance List";
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

      const purchasesRes = await getPurchases();
      const purchasesAll = ((purchasesRes as any)?.purchases ?? purchasesRes ?? []) as any[];
      const paymentsRes = await getSupplierPayments();
      const paymentsAll = ((paymentsRes as any)?.payments ?? paymentsRes ?? []) as any[];

      const totalBySupplierId: Record<string, number> = {};
      const totalBySupplierName: Record<string, number> = {};
      const paidBySupplierId: Record<string, number> = {};

      for (const p of purchasesAll) {
        const sid = p?.supplierId ? String(p.supplierId) : "";
        const sname = String(p?.supplierName || "");
        const amt = Number(p?.netAmount || 0);
        if (sid) totalBySupplierId[sid] = (totalBySupplierId[sid] || 0) + amt;
        else if (sname) totalBySupplierName[sname] = (totalBySupplierName[sname] || 0) + amt;
      }

      for (const p of paymentsAll) {
        const sid = p?.supplierId ? String(p.supplierId) : "";
        const amt = Number(p?.amount || 0);
        if (!sid) continue;
        paidBySupplierId[sid] = (paidBySupplierId[sid] || 0) + amt;
      }

      let grandTotal = 0;
      let grandPaid = 0;
      let grandRemaining = 0;

      const rows = filtered.map((s) => {
        const total = Number(totalBySupplierId[String(s.id)] || 0) + Number(totalBySupplierName[String(s.name)] || 0);
        const paid = Number(paidBySupplierId[String(s.id)] || 0);
        const net = total - paid;
        const type = net > 0 ? "Payable" : net < 0 ? "Receivable" : "Settled";
        const remaining = Math.abs(net);
        grandTotal += total;
        grandPaid += paid;
        grandRemaining += remaining;
        return [
          `${s.name || ""}${s.supplierNo ? ` (${s.supplierNo})` : ""}`,
          formatCurrency(total),
          formatCurrency(paid),
          formatCurrency(remaining),
          type,
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
        head: [["Supplier", "Total", "Paid", "Remaining", "Type"]],
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
          4: { cellWidth: 70 },
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

      doc.save(`suppliers_${now.toISOString().slice(0, 10)}.pdf`);
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || "Failed to generate PDF");
    }
  };

  const handleDownloadSupplierPdf = async () => {
    if (!selectedSupplier) return;
    try {
      let pays = supplierPayments;
      if (!pays || pays.length === 0) {
        try {
          const payRes = await getSupplierPayments({ supplierId: selectedSupplier.id });
          pays = ((payRes?.payments ?? payRes) || []).map((p: any) => ({
            id: String(p.id || p._id || ""),
            date: p.date || "",
            amount: Number(p.amount || 0),
            method: p.method || "",
            reference: p.reference || "",
            purchaseId: p.purchaseId ? String(p.purchaseId) : "",
          }));
          setSupplierPayments(pays);
        } catch {}
      }

      const s = selectedSupplier;
      const headerName = (company?.companyName || "PharmaFlow Pro");
      const addressLine = [company?.address, company?.city, company?.state, company?.pinCode].filter(Boolean).join(", ");
      const idLine = [company?.gstNo ? `GST: ${company.gstNo}` : "", company?.drugLicenseNo ? `DL: ${company.drugLicenseNo}` : "", company?.fssaiLicense ? `FSSAI: ${company.fssaiLicense}` : ""].filter(Boolean).join(" | ");
      const contactLine = [company?.phone ? `Ph: ${company.phone}` : "", company?.email || ""].filter(Boolean).join(" • ");

      const totalPurchases = supplierPurchases.reduce((sum, p) => sum + Number(p.netAmount || 0), 0);
      const totalPaid = (pays || []).reduce((sum, p) => sum + Number(p.amount || 0), 0);
      const totalRemaining = Math.max(0, totalPurchases - totalPaid);

      const ordersRows = supplierPurchases.map((p) => `
        <tr>
          <td>${p.date || ""}</td>
          <td class="mono uppercase">${p.purchaseNo || ""}</td>
          <td class="right">${formatCurrency(Number(p.netAmount || 0))}</td>
          <td class="right">${formatCurrency(Number(p.paid || 0))}</td>
          <td class="right">${formatCurrency(Number(p.balance || Math.max(0, Number(p.netAmount || 0) - Number(p.paid || 0))))}</td>
        </tr>
      `).join("");

      const paysRows = (pays || []).map((p: any) => `
        <tr>
          <td>${p.date || ""}</td>
          <td class="mono uppercase">${p.purchaseId || "General"}</td>
          <td class="right">${formatCurrency(Number(p.amount || 0))}</td>
          <td>${p.method || ""}</td>
          <td class="mono">${p.reference || ""}</td>
        </tr>
      `).join("");

      const infoHtml = `
        <div class="info">
          <div class="meta-row">
            <span><strong>Name:</strong> ${s.name} (${s.status})</span>
            <span><strong>Contact:</strong> ${(s.contactPerson || '-')}${(s.contactPerson && s.phone) ? ' | ' : ''}${(s.phone || '')}</span>
            <span><strong>Email:</strong> ${s.email || '-'}</span>
          </div>
          <div><strong>Address:</strong> ${s.address}, ${s.city}, ${s.state}</div>
          <div><strong>GST:</strong> ${s.gstNo || '-'} &nbsp; | &nbsp; <strong>DL:</strong> ${s.drugLicenseNo || '-'}</div>
          <div><strong>Payment Terms:</strong> ${s.paymentTermsDays} days</div>
          <div><strong>Total Purchases:</strong> ${formatCurrency(totalPurchases)} &nbsp; | &nbsp; <strong>Paid:</strong> ${formatCurrency(totalPaid)} &nbsp; | &nbsp; <strong>Remaining:</strong> ${formatCurrency(totalRemaining)}</div>
        </div>`;

      const html = `<!doctype html><html><head><meta charset="utf-8"><title>${s.name}_report</title>
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
            <div style="font-weight:600">Supplier Report</div>
            ${infoHtml}
          </div>
          <div class="section">
            <table>
              <thead>
                <tr>
                  <th>Invoice Date</th>
                  <th>Invoice #</th>
                  <th class="right">Total</th>
                  <th class="right">Paid</th>
                  <th class="right">Remaining</th>
                </tr>
              </thead>
              <tbody>
                ${ordersRows || `<tr><td colspan="5" style="text-align:center;color:#64748b;">No invoices</td></tr>`}
              </tbody>
            </table>
            <div class="summary">Invoices Summary: Total ${formatCurrency(totalPurchases)} | Paid ${formatCurrency(totalPaid)} | Remaining ${formatCurrency(totalRemaining)}</div>
          </div>
          <div class="section">
            <table>
              <thead>
                <tr>
                  <th>Payment Date</th>
                  <th>Invoice</th>
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

  const openInlinePayment = async (s: Supplier) => {
    try {
      setSelectedSupplier(s);
      setExpandedSupplierId(s.id);
      // Load purchases (with fallback) for options and totals
      let res = await getPurchases({ supplierId: s.id });
      let purchases = ((res?.purchases ?? res) || []).map((p: any) => ({
        id: String(p.id), purchaseNo: p.purchaseNo || "", date: p.date || "", referenceNo: p.referenceNo || "",
        netAmount: Number(p.netAmount || 0), paid: Number(p.paid || 0), balance: Number(p.balance || Math.max(0, Number(p.netAmount || 0) - Number(p.paid || 0)))
      }));
      if (purchases.length === 0) {
        res = await getPurchases({ supplierName: s.name });
        purchases = ((res?.purchases ?? res) || []).map((p: any) => ({
          id: String(p.id), purchaseNo: p.purchaseNo || "", date: p.date || "", referenceNo: p.referenceNo || "",
          netAmount: Number(p.netAmount || 0), paid: Number(p.paid || 0), balance: Number(p.balance || Math.max(0, Number(p.netAmount || 0) - Number(p.paid || 0)))
        }));
      }
      setInlinePurchases(purchases);

      // Load supplier payments to compute totals
      const payRes = await getSupplierPayments({ supplierId: s.id });
      const payments = ((payRes?.payments ?? payRes) || []).map((p: any) => ({ amount: Number(p.amount || 0) }));
      const total = purchases.reduce((sum, p) => sum + p.netAmount, 0);
      const paidViaPurchases = purchases.reduce((sum, p) => sum + p.paid, 0);
      const paidAll = payments.reduce((sum, p) => sum + p.amount, 0);
      // Prefer accurate paid from payments collection (includes general payments)
      const totals = { total, paid: paidAll || paidViaPurchases, remaining: Math.max(0, total - (paidAll || paidViaPurchases)) };
      setInlineTotals(totals);

      setInlineForm({ target: "general", amount: String(totals.remaining || 0), method: "cash", reference: "", date: new Date().toISOString().slice(0,10) });
    } catch (e) {
      console.error(e);
      toast.error("Failed to load supplier balances");
    }
  };

  const cancelInlinePayment = () => {
    setExpandedSupplierId(null);
    setInlinePurchases([]);
  };

  const saveInlinePayment = async () => {
    if (!selectedSupplier) return;
    const amt = Number(inlineForm.amount);
    if (!amt || amt <= 0) { toast.error("Enter a valid amount"); return; }
    setInlineSaving(true);
    try {
      const payload: any = {
        date: inlineForm.date,
        supplierId: selectedSupplier.id,
        amount: amt,
        method: inlineForm.method,
        reference: inlineForm.reference,
      };
      if (inlineForm.target !== "general") payload.purchaseId = inlineForm.target;
      await createSupplierPayment(payload);
      toast.success("Payment recorded");
      // reload inline data and totals
      await openInlinePayment(selectedSupplier);
    } catch (e: any) {
      console.error(e);
      toast.error(typeof e?.message === 'string' ? e.message : 'Failed to record payment');
    } finally {
      setInlineSaving(false);
    }
  };

  useEffect(() => { loadSuppliers(); }, []);
  useEffect(() => {
    (async () => {
      try { const res = await getCompanyInfo(); setCompany(res?.company || null); } catch {}
    })();
  }, []);

  const openPurchases = async (s: Supplier) => {
    try {
      setSelectedSupplier(s);
      // First try by supplierId
      let res = await getPurchases({ supplierId: s.id });
      let list = ((res?.purchases ?? res) || []).map((p: any) => ({
        id: String(p.id),
        purchaseNo: p.purchaseNo || "",
        date: p.date || "",
        referenceNo: p.referenceNo || "",
        netAmount: Number(p.netAmount || 0),
        paid: Number(p.paid || 0),
        balance: Number(p.balance || Math.max(0, Number(p.netAmount || 0) - Number(p.paid || 0))),
      }));
      // If older records lack supplierId, fallback to supplierName
      if (list.length === 0) {
        res = await getPurchases({ supplierName: s.name });
        list = ((res?.purchases ?? res) || []).map((p: any) => ({
          id: String(p.id),
          purchaseNo: p.purchaseNo || "",
          date: p.date || "",
          referenceNo: p.referenceNo || "",
          netAmount: Number(p.netAmount || 0),
          paid: Number(p.paid || 0),
          balance: Number(p.balance || Math.max(0, Number(p.netAmount || 0) - Number(p.paid || 0))),
        }));
      }
      setSupplierPurchases(list);
      try {
        const payRes = await getSupplierPayments({ supplierId: s.id });
        const pays = ((payRes?.payments ?? payRes) || []).map((p: any) => ({
          id: String(p.id || p._id || ""),
          date: p.date || "",
          amount: Number(p.amount || 0),
          method: p.method || "",
          reference: p.reference || "",
          purchaseId: p.purchaseId ? String(p.purchaseId) : "",
        }));
        setSupplierPayments(pays);
      } catch {}
      setViewPurchasesOpen(true);
    } catch (e) {
      console.error(e);
      toast.error("Failed to load supplier invoices");
    }
  };

  const openPay = (purchaseId: string, remaining: number) => {
    setSelectedPurchaseId(purchaseId);
    setPaymentForm({ amount: String(remaining || 0), method: "cash", reference: "", date: new Date().toISOString().slice(0,10) });
    setPayDialogOpen(true);
  };

  const submitPayment = async () => {
    if (!selectedSupplier || !selectedPurchaseId) return;
    const amt = Number(paymentForm.amount);
    if (!amt || amt <= 0) { toast.error("Enter a valid amount"); return; }
    try {
      await createSupplierPayment({
        date: paymentForm.date,
        supplierId: selectedSupplier.id,
        purchaseId: selectedPurchaseId,
        amount: amt,
        method: paymentForm.method,
        reference: paymentForm.reference,
      });
      toast.success("Payment recorded");
      // refresh purchases list
      let res = await getPurchases({ supplierId: selectedSupplier.id });
      let list = ((res?.purchases ?? res) || []).map((p: any) => ({
        id: String(p.id), purchaseNo: p.purchaseNo || "", date: p.date || "", referenceNo: p.referenceNo || "",
        netAmount: Number(p.netAmount || 0), paid: Number(p.paid || 0), balance: Number(p.balance || Math.max(0, Number(p.netAmount || 0) - Number(p.paid || 0)))
      }));
      if (list.length === 0) {
        res = await getPurchases({ supplierName: selectedSupplier.name });
        list = ((res?.purchases ?? res) || []).map((p: any) => ({
          id: String(p.id), purchaseNo: p.purchaseNo || "", date: p.date || "", referenceNo: p.referenceNo || "",
          netAmount: Number(p.netAmount || 0), paid: Number(p.paid || 0), balance: Number(p.balance || Math.max(0, Number(p.netAmount || 0) - Number(p.paid || 0)))
        }));
      }
      setSupplierPurchases(list);
      setPayDialogOpen(false);
    } catch (e) {
      console.error(e);
      toast.error("Failed to record payment");
    }
  };

  const openAdd = () => {
    setEditingId(null);
    setForm({
      name: "",
      contactPerson: "",
      phone: "",
      email: "",
      address: "",
      city: "",
      state: "",
      gstNo: "",
      drugLicenseNo: "",
      status: "active",
      paymentTermsDays: "30",
    });
    setDialogOpen(true);
  };

  const openEdit = (s: Supplier) => {
    setEditingId(s.id);
    setForm({
      name: s.name || "",
      contactPerson: s.contactPerson || "",
      phone: s.phone || "",
      email: s.email || "",
      address: s.address || "",
      city: s.city || "",
      state: s.state || "",
      gstNo: s.gstNo || "",
      drugLicenseNo: s.drugLicenseNo || "",
      status: s.status as any,
      paymentTermsDays: String(s.paymentTermsDays ?? "30"),
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (saving) return;
    setSaving(true);
    const payload = {
      ...form,
      paymentTermsDays: Number(form.paymentTermsDays) || 0,
    };
    try {
      if (editingId) {
        await updateSupplier(editingId, payload);
        toast.success("Supplier updated");
      } else {
        await createSupplier(payload);
        toast.success("Supplier added");
      }
      await loadSuppliers();
      setDialogOpen(false);
      setEditingId(null);
    } catch (e) {
      console.error(e);
      toast.error("Failed to save supplier");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteSupplier(id);
      toast.success("Supplier deleted");
      await loadSuppliers();
    } catch (e) {
      console.error(e);
      toast.error("Failed to delete supplier");
    }
  };

  const filtered = useMemo(() => suppliers.filter((s) => {
    const q = searchTerm.toLowerCase();
    const matches = s.name.toLowerCase().includes(q) || s.contactPerson.toLowerCase().includes(q) || s.city.toLowerCase().includes(q) || (s.supplierNo || "").toLowerCase().includes(q);
    const matchesStatus = statusFilter === "all" || s.status === statusFilter;
    return matches && matchesStatus;
  }), [suppliers, searchTerm, statusFilter]);

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Suppliers</h1>
            <p className="text-muted-foreground">Manage supplier directory and payment terms</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={openAdd}><Plus className="mr-2 h-4 w-4" /> Add Supplier</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[700px]">
              <DialogHeader>
                <DialogTitle>{editingId ? "Edit Supplier" : "Add New Supplier"}</DialogTitle>
                <DialogDescription>Enter supplier details to create a new vendor</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4 max-h-[60vh] overflow-y-auto">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Business Name</Label>
                    <Input value={form.name} onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))} placeholder="e.g., ABC Pharma" />
                  </div>
                  <div className="space-y-2">
                    <Label>Contact Person</Label>
                    <Input value={form.contactPerson} onChange={(e) => setForm((s) => ({ ...s, contactPerson: e.target.value }))} placeholder="Full name" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Phone</Label>
                    <Input value={form.phone} onChange={(e) => setForm((s) => ({ ...s, phone: e.target.value }))} placeholder="+91 9876543210" />
                  </div>
                  <div className="space-y-2">
                    <Label>Email</Label>
                    <Input type="email" value={form.email} onChange={(e) => setForm((s) => ({ ...s, email: e.target.value }))} placeholder="email@supplier.com" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Address</Label>
                  <Textarea value={form.address} onChange={(e) => setForm((s) => ({ ...s, address: e.target.value }))} placeholder="Street address" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>City</Label>
                    <Input value={form.city} onChange={(e) => setForm((s) => ({ ...s, city: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>State</Label>
                    <Input value={form.state} onChange={(e) => setForm((s) => ({ ...s, state: e.target.value }))} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>GST No.</Label>
                    <Input value={form.gstNo} onChange={(e) => setForm((s) => ({ ...s, gstNo: e.target.value }))} placeholder="27AABCU9603R1ZM" />
                  </div>
                  <div className="space-y-2">
                    <Label>Drug License No.</Label>
                    <Input value={form.drugLicenseNo} onChange={(e) => setForm((s) => ({ ...s, drugLicenseNo: e.target.value }))} placeholder="DL-MH-2024-XXX" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Status</Label>
                    <Select value={form.status} onValueChange={(v) => setForm((s) => ({ ...s, status: v }))}>
                      <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="inactive">Inactive</SelectItem>
                        <SelectItem value="blocked">Blocked</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Payment Terms (days)</Label>
                    <Input type="number" value={form.paymentTermsDays} onChange={(e) => setForm((s) => ({ ...s, paymentTermsDays: e.target.value }))} />
                  </div>
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                <Button onClick={handleSave} disabled={saving}>{saving ? (editingId ? "Updating..." : "Saving...") : (editingId ? "Update" : "Add Supplier")}</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input placeholder="Search suppliers, codes, contacts, cities..." className="pl-10" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
              </div>
              <div className="flex gap-2">
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[150px]"><SelectValue placeholder="Status" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                    <SelectItem value="blocked">Blocked</SelectItem>
                  </SelectContent>
                </Select>
                <Button variant="outline" size="icon" onClick={handleDownloadSuppliersListPdf}><Download className="h-4 w-4" /></Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Supplier Directory ({filtered.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Supplier</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>GST / DL</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Terms</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((s) => (
                    <Fragment key={s.id}>
                    <TableRow>
                      <TableCell>
                        <div>
                          <p className="font-medium text-foreground">{s.name}</p>
                          <p className="text-xs text-muted-foreground">{(s.supplierNo ? `ID: ${s.supplierNo}` : "") + (s.email ? (s.supplierNo ? " • " : "") + s.email : "")}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="text-sm flex items-center gap-1"><Building2 className="h-3 w-3" /> {s.contactPerson || "-"}</p>
                          <p className="text-xs text-muted-foreground flex items-center gap-1"><Phone className="h-3 w-3" /> {s.phone || "-"}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="text-xs">{s.gstNo || "-"}</p>
                          <p className="text-[10px] text-muted-foreground">{s.drugLicenseNo || "-"}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="text-sm">{s.city}</p>
                          <p className="text-xs text-muted-foreground">{s.state}</p>
                        </div>
                      </TableCell>
                      <TableCell>{s.paymentTermsDays} days</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={statusStyles[s.status]}>{s.status}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button variant="secondary" size="sm" onClick={() => openInlinePayment(s)}>Record Payment</Button>
                          <Button variant="outline" size="sm" onClick={() => openPurchases(s)} title="View invoices and record payments">
                            <ReceiptText className="h-4 w-4 mr-1" /> Invoices
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => openEdit(s)}><Edit className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="icon" onClick={() => handleDelete(s.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                    {expandedSupplierId === s.id && (
                      <TableRow>
                        <TableCell colSpan={7}>
                          <div className="rounded-md border p-3 bg-neutral-50">
                            <div className="flex flex-wrap items-center gap-2 mb-3">
                              <Badge className="bg-neutral-200 text-foreground" variant="outline">Total Purchases: Rs {inlineTotals.total.toLocaleString()}</Badge>
                              <Badge className="bg-emerald-100 text-emerald-700" variant="outline">Paid: Rs {inlineTotals.paid.toLocaleString()}</Badge>
                              <Badge className="bg-rose-100 text-rose-700" variant="outline">Remaining: Rs {inlineTotals.remaining.toLocaleString()}</Badge>
                              <Badge variant="outline" className={statusStyles[s.status]}>{s.status}</Badge>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-6 gap-2 items-end">
                              <div className="md:col-span-2">
                                <Label className="text-xs">Apply To</Label>
                                <Select value={inlineForm.target} onValueChange={(v) => setInlineForm((f) => ({ ...f, target: v }))}>
                                  <SelectTrigger className="h-9 text-xs">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="general">General payment (no specific invoice)</SelectItem>
                                    {inlinePurchases.map((p) => (
                                      <SelectItem key={p.id} value={p.id}>{p.purchaseNo} - Total Rs {p.netAmount.toLocaleString()} - Remaining Rs {p.balance.toLocaleString()}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                              <div>
                                <Label className="text-xs">Amount</Label>
                                <Input className="h-9 text-xs" type="number" value={inlineForm.amount} onChange={(e) => setInlineForm((f) => ({ ...f, amount: e.target.value }))} />
                              </div>
                              <div>
                                <Label className="text-xs">Method</Label>
                                <Select value={inlineForm.method} onValueChange={(v) => setInlineForm((f) => ({ ...f, method: v }))}>
                                  <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="cash">Cash</SelectItem>
                                    <SelectItem value="upi">UPI</SelectItem>
                                    <SelectItem value="bank">Bank</SelectItem>
                                    <SelectItem value="cheque">Cheque</SelectItem>
                                    <SelectItem value="other">Other</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              <div>
                                <Label className="text-xs">Note</Label>
                                <Input className="h-9 text-xs" placeholder="Optional" value={inlineForm.reference} onChange={(e) => setInlineForm((f) => ({ ...f, reference: e.target.value }))} />
                              </div>
                              <div>
                                <Label className="text-xs">Date</Label>
                                <Input className="h-9 text-xs" type="date" value={inlineForm.date} onChange={(e) => setInlineForm((f) => ({ ...f, date: e.target.value }))} />
                              </div>
                              <div className="flex gap-2 justify-end md:col-span-6">
                                <Button variant="outline" onClick={cancelInlinePayment}>Cancel</Button>
                                <Button onClick={saveInlinePayment} disabled={inlineSaving}>{inlineSaving ? 'Saving...' : 'Save'}</Button>
                                <Button variant="secondary" onClick={() => openPurchases(s)}>View Details</Button>
                              </div>
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                    </Fragment>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Purchases & Payments Dialog */}
        <Dialog open={viewPurchasesOpen} onOpenChange={setViewPurchasesOpen}>
          <DialogContent className="sm:max-w-[900px]">
            <DialogHeader>
              <DialogTitle>Invoices for {selectedSupplier?.name}</DialogTitle>
              <DialogDescription>View each invoice with total, paid, and remaining. Record payments as needed.</DialogDescription>
            </DialogHeader>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Invoice No.</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Reference</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">Paid</TableHead>
                    <TableHead className="text-right">Remaining</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {supplierPurchases.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-mono text-xs uppercase">{p.purchaseNo}</TableCell>
                      <TableCell>{p.date}</TableCell>
                      <TableCell className="uppercase text-xs">{p.referenceNo}</TableCell>
                      <TableCell className="text-right">Rs {p.netAmount.toLocaleString()}</TableCell>
                      <TableCell className="text-right">Rs {p.paid.toLocaleString()}</TableCell>
                      <TableCell className="text-right font-semibold">Rs {p.balance.toLocaleString()}</TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="outline" disabled={p.balance <= 0} onClick={() => openPay(p.id, p.balance)}>Pay</Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <div className="flex justify-end gap-2 mt-3">
              <Button onClick={handleDownloadSupplierPdf}><Download className="mr-2 h-4 w-4" /> Download PDF</Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Record Payment Dialog */}
        <Dialog open={payDialogOpen} onOpenChange={setPayDialogOpen}>
          <DialogContent className="sm:max-w-[420px]">
            <DialogHeader>
              <DialogTitle>Record Payment</DialogTitle>
            </DialogHeader>
            <div className="grid gap-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Date</Label>
                  <Input type="date" value={paymentForm.date} onChange={(e) => setPaymentForm((s) => ({ ...s, date: e.target.value }))} />
                </div>
                <div className="space-y-1">
                  <Label>Amount</Label>
                  <Input type="number" value={paymentForm.amount} onChange={(e) => setPaymentForm((s) => ({ ...s, amount: e.target.value }))} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Method</Label>
                  <Select value={paymentForm.method} onValueChange={(v) => setPaymentForm((s) => ({ ...s, method: v }))}>
                    <SelectTrigger><SelectValue placeholder="Select method" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">Cash</SelectItem>
                      <SelectItem value="upi">UPI</SelectItem>
                      <SelectItem value="bank">Bank</SelectItem>
                      <SelectItem value="cheque">Cheque</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Reference</Label>
                  <Input placeholder="Txn ref (optional)" value={paymentForm.reference} onChange={(e) => setPaymentForm((s) => ({ ...s, reference: e.target.value }))} />
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setPayDialogOpen(false)}>Cancel</Button>
              <Button onClick={submitPayment}>Save Payment</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
};

export default Suppliers;
