import { useEffect, useMemo, useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { StatsCard } from "@/components/dashboard/StatsCard";
import { getOrders, getPurchases, getExpenses, getPayments, getSupplierPayments, getReturns, getSupplierReturns, getInvoices } from "@/lib/api";
import { formatCurrency } from "@/lib/currency";
import { IndianRupee, CreditCard, FileText, Eye, Download, TrendingUp, TrendingDown, CalendarRange, Layers, ClipboardList } from "lucide-react";

 

const FinancialReports = () => {
  const [preset, setPreset] = useState<"today" | "week" | "month" | "all" | "custom">("month");
  const [from, setFrom] = useState<string>(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0,10));
  const [to, setTo] = useState<string>(new Date().toISOString().slice(0,10));

  const [orders, setOrders] = useState<Array<any>>([]);
  const [invoices, setInvoices] = useState<Array<any>>([]);
  const [purchases, setPurchases] = useState<Array<any>>([]);
  const [expenses, setExpenses] = useState<Array<any>>([]);
  const [payments, setPayments] = useState<Array<any>>([]);
  const [supplierPays, setSupplierPays] = useState<Array<any>>([]);
  const [custReturns, setCustReturns] = useState<Array<any>>([]);
  const [suppReturns, setSuppReturns] = useState<Array<any>>([]);

  useEffect(() => {
    (async () => {
      try {
        const [ordRes, invRes, purRes, expRes, payRes, supPayRes, retRes, supRetRes] = await Promise.all([
          getOrders(),
          getInvoices(),
          getPurchases(),
          getExpenses(),
          getPayments().catch(() => ({ payments: [] })),
          getSupplierPayments().catch(() => ({ payments: [] })),
          getReturns().catch(() => ({ returns: [] })),
          getSupplierReturns().catch(() => ({ returns: [] })),
        ]);
        setOrders(((ordRes?.orders ?? ordRes) || []) as Array<any>);
        setInvoices(((invRes?.invoices ?? invRes) || []) as Array<any>);
        setPurchases(((purRes?.purchases ?? purRes) || []) as Array<any>);
        setExpenses(((expRes?.expenses ?? expRes) || []) as Array<any>);
        setPayments(((payRes as any)?.payments ?? payRes ?? []) as Array<any>);
        setSupplierPays(((supPayRes as any)?.payments ?? supPayRes ?? []) as Array<any>);
        setCustReturns(((retRes as any)?.returns ?? retRes ?? []) as Array<any>);
        setSuppReturns(((supRetRes as any)?.returns ?? supRetRes ?? []) as Array<any>);
      } catch (e) {
        // ignore
      }
    })();
  }, []);

  const effectiveRange = useMemo(() => {
    const today = new Date();
    const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const endOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
    if (preset === "all") return { from: undefined as Date | undefined, to: undefined as Date | undefined };
    if (preset === "custom") return { from: from ? new Date(from) : undefined, to: to ? endOfDay(new Date(to)) : undefined };
    if (preset === "today") return { from: startOfDay(today), to: endOfDay(today) };
    if (preset === "week") { const d = new Date(); const start = new Date(d.getTime() - 6*24*60*60*1000); return { from: startOfDay(start), to: endOfDay(d) }; }
    if (preset === "month") { const start = new Date(today.getFullYear(), today.getMonth(), 1); return { from: startOfDay(start), to: endOfDay(today) }; }
    return { from: undefined, to: undefined };
  }, [preset, from, to]);

  const within = (iso: string) => {
    if (!iso) return false;
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return false;
    if (effectiveRange.from && d < effectiveRange.from) return false;
    if (effectiveRange.to && d > effectiveRange.to) return false;
    return true;
  };

  const KpiTile = ({
    title,
    value,
    icon: Icon,
    tone,
  }: {
    title: string;
    value: string;
    icon: any;
    tone: "emerald" | "amber" | "rose" | "slate";
  }) => {
    const toneClasses: Record<string, string> = {
      emerald: "bg-emerald-50/70 border-emerald-200/60 text-emerald-700",
      amber: "bg-amber-50/70 border-amber-200/60 text-amber-700",
      rose: "bg-rose-50/70 border-rose-200/60 text-rose-700",
      slate: "bg-slate-50/70 border-slate-200/60 text-slate-700",
    };
    return (
      <div className={`relative overflow-hidden rounded-2xl border p-4 md:p-5 ${toneClasses[tone] || toneClasses.slate}`}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-[11px] uppercase tracking-wider opacity-80">{title}</div>
            <div className="mt-1 text-2xl md:text-3xl font-bold text-foreground">{value}</div>
            <div className="mt-1 text-xs text-muted-foreground">{rangeLabel}</div>
          </div>
          <div className="rounded-2xl bg-white/70 border border-white/40 p-2.5 shadow-sm">
            <Icon className="h-5 w-5" />
          </div>
        </div>
        <div className="pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full bg-white/40 blur-2xl" />
      </div>
    );
  };

  const ActionButtons = ({ onPreview, onDownload }: { onPreview: () => void; onDownload: () => void }) => (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        size="icon"
        className="h-9 w-9 rounded-xl"
        onClick={onPreview}
        title="Preview"
      >
        <Eye className="h-4 w-4" />
      </Button>
      <Button
        size="icon"
        className="h-9 w-9 rounded-xl"
        onClick={onDownload}
        title="Download / Print"
      >
        <Download className="h-4 w-4" />
      </Button>
    </div>
  );

  // P&L
  const pnl = useMemo(() => {
    // Sales are taken from invoices' totals by invoice date
    const sales = invoices.filter((inv) => within(inv.date)).reduce((s, inv) => s + Number(inv.total || 0), 0);

    // Purchases may still be gross; subtract verified supplier returns to get net purchases
    const purchasesGross = purchases.filter((p) => within(p.date)).reduce((s, p) => s + Number(p.netAmount || 0), 0);
    const suppRetSum = suppReturns
      .filter((r) => (String(r.status || '').toLowerCase() === 'verified'))
      .filter((r) => within(r.date))
      .reduce((s, r) => s + Number(r.value || 0), 0);
    const purchaseSum = Math.max(0, purchasesGross - suppRetSum);

    const expenseSum = expenses.filter((e) => within(e.date)).reduce((s, e) => s + Number(e.amount || 0), 0);
    const profit = sales - purchaseSum - expenseSum;
    return { sales, purchases: purchaseSum, expenses: expenseSum, profit };
  }, [invoices, purchases, expenses, suppReturns, effectiveRange]);

  // Vouchers (combined list)
  const vouchers = useMemo(() => {
    type Row = { date: string; type: string; reference: string; party: string; amount: number };
    const rows: Row[] = [];
    for (const inv of invoices) {
      if (!within(inv.date)) continue;
      rows.push({ date: inv.date, type: "Sales Invoice", reference: inv.invoiceNo, party: inv.customer, amount: Number(inv.total || 0) });
    }
    for (const p of payments) {
      if (!within(p.date)) continue;
      rows.push({ date: p.date, type: "Receipt", reference: p.reference || p.id, party: p.customerName || "Customer", amount: Number(p.amount || 0) });
    }
    for (const pr of purchases) {
      if (!within(pr.date)) continue;
      rows.push({ date: pr.date, type: "Purchase Invoice", reference: pr.purchaseNo, party: pr.supplierName || "Supplier", amount: Number(pr.netAmount || 0) });
    }
    for (const sp of supplierPays) {
      if (!within(sp.date)) continue;
      rows.push({ date: sp.date, type: "Supplier Payment", reference: sp.reference || sp.id, party: sp.supplierName || "Supplier", amount: Number(sp.amount || 0) });
    }
    for (const ex of expenses) {
      if (!within(ex.date)) continue;
      rows.push({ date: ex.date, type: ex.category ? `Expense - ${ex.category}` : "Expense", reference: ex.reference || ex.id, party: ex.payee || "Expense", amount: Number(ex.amount || 0) });
    }
    for (const r of custReturns) {
      if (String(r.status || '').toLowerCase() !== 'verified') continue;
      if (!within(r.date)) continue;
      rows.push({ date: r.date, type: "Customer Return", reference: r.returnCode || r.referenceNo || r.invoiceNo || r.id, party: r.customer || 'Customer', amount: Number(r.value || 0) });
    }
    for (const r of suppReturns) {
      if (String(r.status || '').toLowerCase() !== 'verified') continue;
      if (!within(r.date)) continue;
      rows.push({ date: r.date, type: "Supplier Return", reference: r.returnCode || r.referenceNo || r.id, party: r.supplier || 'Supplier', amount: Number(r.value || 0) });
    }
    rows.sort((a, b) => a.date.localeCompare(b.date));
    return rows;
  }, [invoices, purchases, expenses, payments, supplierPays, custReturns, suppReturns, effectiveRange]);

  // Trial Balance using simple double-entry from available events
  const trial = useMemo(() => {
    const agg = new Map<string, { debit: number; credit: number }>();
    const add = (acc: string, dr: number, cr: number) => {
      const e = agg.get(acc) || { debit: 0, credit: 0 };
      e.debit += dr;
      e.credit += cr;
      agg.set(acc, e);
    };
    // Sales invoices
    for (const inv of invoices) {
      if (!within(inv.date)) continue;
      const amt = Number(inv.total || 0);
      add("Accounts Receivable", amt, 0);
      add("Sales Revenue", 0, amt);
    }
    // Customer receipts
    for (const p of payments) {
      if (!within(p.date)) continue;
      const amt = Number(p.amount || 0);
      add("Cash/Bank", amt, 0);
      add("Accounts Receivable", 0, amt);
    }
    // Purchases
    for (const pr of purchases) {
      if (!within(pr.date)) continue;
      const amt = Number(pr.netAmount || 0);
      add("Purchases", amt, 0);
      add("Accounts Payable", 0, amt);
    }
    // Supplier payments
    for (const sp of supplierPays) {
      if (!within(sp.date)) continue;
      const amt = Number(sp.amount || 0);
      add("Accounts Payable", amt, 0);
      add("Cash/Bank", 0, amt);
    }
    // Expenses
    for (const ex of expenses) {
      if (!within(ex.date)) continue;
      const amt = Number(ex.amount || 0);
      add("Expenses", amt, 0);
      add("Cash/Bank", 0, amt);
    }
    // Do not add separate Sales Returns if sales already reflect returns in order totals
    // Supplier returns (debit notes to supplier)
    for (const r of suppReturns) {
      if (String(r.status || '').toLowerCase() !== 'verified') continue;
      if (!within(r.date)) continue;
      const amt = Number(r.value || 0);
      add("Accounts Payable", amt, 0);
      add("Purchase Returns", 0, amt);
    }
    const rows = Array.from(agg.entries()).map(([account, v]) => {
      if (v.debit >= v.credit) return { account, debit: v.debit - v.credit, credit: 0 };
      return { account, debit: 0, credit: v.credit - v.debit };
    }).sort((a, b) => a.account.localeCompare(b.account));
    const totals = rows.reduce((s, r) => ({ debit: s.debit + r.debit, credit: s.credit + r.credit }), { debit: 0, credit: 0 });
    return { rows, totals, agg } as { rows: Array<{account: string; debit: number; credit: number}>; totals: {debit: number; credit: number}; agg: Map<string, {debit: number; credit: number}> };
  }, [invoices, payments, purchases, supplierPays, expenses, custReturns, suppReturns, effectiveRange]);

  // Balance Sheet derived from trial balance
  const balanceSheet = useMemo(() => {
    const drcr = (acc: string) => trial.agg.get(acc) || { debit: 0, credit: 0 };
    const netDr = (acc: string) => Math.max(0, drcr(acc).debit - drcr(acc).credit);
    const netCr = (acc: string) => Math.max(0, drcr(acc).credit - drcr(acc).debit);
    const ar = netDr("Accounts Receivable");
    const cash = netDr("Cash/Bank");
    const ap = netCr("Accounts Payable");
    const sales = netCr("Sales Revenue");
    const purchases = netDr("Purchases");
    const exp = netDr("Expenses");
    const profit = sales - purchases - exp; // positive => equity
    const assets = [
      { name: "Cash/Bank", amount: cash },
      { name: "Accounts Receivable", amount: ar },
    ];
    const liabilities = [
      { name: "Accounts Payable", amount: ap },
    ];
    const equity: Array<{ name: string; amount: number }> = [];
    if (profit >= 0) equity.push({ name: "Retained Earnings", amount: profit });
    const accumLoss = profit < 0 ? -profit : 0;
    if (accumLoss > 0) assets.push({ name: "Accumulated Loss", amount: accumLoss });
    const assetsTotal = assets.reduce((s, a) => s + a.amount, 0);
    const liabilitiesTotal = liabilities.reduce((s, a) => s + a.amount, 0);
    const equityTotal = equity.reduce((s, a) => s + a.amount, 0);
    return { assets, liabilities, equity, totals: { assets: assetsTotal, liabilities: liabilitiesTotal, equity: equityTotal } };
  }, [trial]);

  // Daily Closing summary per day
  const daily = useMemo(() => {
    const map = new Map<string, { sales: number; receipts: number; purchases: number; supPayments: number; expenses: number; custReturns: number; suppReturns: number; netCash: number; openingCash?: number; closingCash?: number }>();
    const key = (d: string) => (d ? new Date(d).toISOString().slice(0,10) : "");
    const acc = (k: string) => {
      const e = map.get(k) || { sales: 0, receipts: 0, purchases: 0, supPayments: 0, expenses: 0, custReturns: 0, suppReturns: 0, netCash: 0 };
      map.set(k, e); return e;
    };
    for (const inv of invoices) { if (!within(inv.date)) continue; const e = acc(key(inv.date)); e.sales += Number(inv.total || 0); }
    for (const p of payments) { if (!within(p.date)) continue; const e = acc(key(p.date)); e.receipts += Number(p.amount || 0); }
    for (const pr of purchases) { if (!within(pr.date)) continue; const e = acc(key(pr.date)); e.purchases += Number(pr.netAmount || 0); }
    for (const sp of supplierPays) { if (!within(sp.date)) continue; const e = acc(key(sp.date)); e.supPayments += Number(sp.amount || 0); }
    for (const ex of expenses) { if (!within(ex.date)) continue; const e = acc(key(ex.date)); e.expenses += Number(ex.amount || 0); }
    for (const r of custReturns) { if (String(r.status || '').toLowerCase() !== 'verified') continue; if (!within(r.date)) continue; const e = acc(key(r.date)); e.custReturns += Number(r.value || 0); }
    for (const r of suppReturns) { if (String(r.status || '').toLowerCase() !== 'verified') continue; if (!within(r.date)) continue; const e = acc(key(r.date)); e.suppReturns += Number(r.value || 0); }
    for (const [k, e] of map) { e.netCash = e.receipts - e.supPayments - e.expenses; map.set(k, e); }
    const rows = Array.from(map.entries()).map(([d, v]) => ({ date: d, ...v })).sort((a, b) => a.date.localeCompare(b.date));
    // Compute opening and closing cash as running total of netCash (returns do not affect cash directly here)
    let running = 0;
    for (const row of rows) {
      row.openingCash = running;
      row.closingCash = running + row.netCash;
      running = row.closingCash;
    }
    const totals = rows.reduce((s, r) => ({
      sales: s.sales + r.sales,
      receipts: s.receipts + r.receipts,
      purchases: s.purchases + r.purchases,
      supPayments: s.supPayments + r.supPayments,
      expenses: s.expenses + r.expenses,
      netCash: s.netCash + r.netCash,
      custReturns: s.custReturns + r.custReturns,
      suppReturns: s.suppReturns + r.suppReturns,
      openingCash: (s as any).openingCash ?? (rows.length > 0 ? rows[0].openingCash || 0 : 0),
      closingCash: r.closingCash, // will end as last day's closing
    } as any), { sales: 0, receipts: 0, purchases: 0, supPayments: 0, expenses: 0, netCash: 0, custReturns: 0, suppReturns: 0 } as any);
    return { rows, totals };
  }, [invoices, payments, purchases, supplierPays, expenses, custReturns, suppReturns, effectiveRange]);

  const vouchersTotal = useMemo(() => vouchers.reduce((s, r) => s + Number(r.amount || 0), 0), [vouchers]);
  const liabEquityTotal = useMemo(() => balanceSheet.totals.liabilities + balanceSheet.totals.equity, [balanceSheet]);
  const rangeLabel = useMemo(() => {
    if (preset === 'today') return 'Today';
    if (preset === 'week') return 'This Week';
    if (preset === 'month') return 'This Month';
    if (preset === 'all') return 'All Time';
    return `${from} to ${to}`;
  }, [preset, from, to]);

  const openPrint = (html: string) => {
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.open();
    w.document.write(html);
    w.document.close();
  };

  const baseHtml = (title: string, body: string, autoPrint: boolean) => `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title>
    <link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap" rel="stylesheet">
    <style>
      @page { size: A4; margin: 16mm; }
      * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      body { font-family:'Poppins', ui-sans-serif, system-ui, -apple-system; color:#0f172a; max-width:820px; margin:24px auto; }
      .title { font-weight:700; font-size:22px; margin:0; }
      .muted { color:#64748b; font-size:12px; margin-top:2px; }
      .card { border:1px solid #e2e8f0; border-radius:12px; padding:16px; margin-top:16px; }
      .row { display:flex; justify-content:space-between; align-items:center; padding:8px 0; font-size:14px; }
      .big { font-weight:700; font-size:28px; }
      .label { color:#475569; }
      table { width:100%; border-collapse:collapse; margin-top:8px; }
      th, td { border:1px solid #e2e8f0; padding:8px 10px; font-size:12px; vertical-align:top; }
      thead th { background:#f8fafc; color:#0f172a; font-weight:600; text-transform:uppercase; font-size:11px; }
    </style></head><body>
      <div>
        <h1 class="title">${title}</h1>
        <div class="muted">${rangeLabel}</div>
        <div class="card">${body}</div>
      </div>
      ${autoPrint ? '<script>window.addEventListener("load",()=>setTimeout(()=>{window.print();},250));</script>' : ''}
    </body></html>`;

  const buildVouchersSummaryHtml = (autoPrint: boolean) => {
    const body = `<div class="row"><div class="label">Total</div><div class="big">${formatCurrency(vouchersTotal)}</div></div>`;
    return baseHtml('Vouchers Summary', body, autoPrint);
  };
  const buildTrialBalanceSummaryHtml = (autoPrint: boolean) => {
    const body = `<div class="row"><div class="label">Total Debit</div><div class="big">${formatCurrency(trial.totals.debit)}</div></div>
                  <div class="row"><div class="label">Total Credit</div><div class="big">${formatCurrency(trial.totals.credit)}</div></div>`;
    return baseHtml('Trial Balance Summary', body, autoPrint);
  };
  const buildBalanceSheetSummaryHtml = (autoPrint: boolean) => {
    const body = `<div class="row"><div class="label">Total Assets</div><div class="big">${formatCurrency(balanceSheet.totals.assets)}</div></div>
                  <div class="row"><div class="label">Total Liabilities &amp; Equity</div><div class="big">${formatCurrency(liabEquityTotal)}</div></div>`;
    return baseHtml('Balance Sheet Summary', body, autoPrint);
  };
  const buildDailyClosingSummaryHtml = (autoPrint: boolean) => {
    const t = daily.totals;
    const body = `<div class="row"><div class="label">Sales</div><div class="big">${formatCurrency(t.sales)}</div></div>
                  <div class="row"><div class="label">Receipts</div><div class="big">${formatCurrency(t.receipts)}</div></div>
                  <div class="row"><div class="label">Purchases</div><div class="big">${formatCurrency(t.purchases)}</div></div>
                  <div class="row"><div class="label">Supplier Payments</div><div class="big">${formatCurrency(t.supPayments)}</div></div>
                  <div class="row"><div class="label">Expenses</div><div class="big">${formatCurrency(t.expenses)}</div></div>
                  <div class="row"><div class="label">Net Cash</div><div class="big">${formatCurrency(t.netCash)}</div></div>`;
    return baseHtml('Daily Closing Summary', body, autoPrint);
  };

  // Detailed PDF builders
  const buildVouchersDetailHtml = (autoPrint: boolean) => {
    const rows = vouchers.map(v => `
      <tr>
        <td>${v.date}</td>
        <td>${v.type}</td>
        <td>${v.reference}</td>
        <td>${v.party}</td>
        <td style="text-align:right">${formatCurrency(v.amount)}</td>
      </tr>`).join('');
    const body = `
      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Type</th>
            <th>Reference</th>
            <th>Party</th>
            <th style="text-align:right">Amount</th>
          </tr>
        </thead>
        <tbody>${rows || `<tr><td colspan="5" style="text-align:center;color:#64748b;padding:10px">No vouchers</td></tr>`}</tbody>
        <tfoot>
          <tr>
            <td colspan="4" style="text-align:right;font-weight:700">Total</td>
            <td style="text-align:right;font-weight:700">${formatCurrency(vouchersTotal)}</td>
          </tr>
        </tfoot>
      </table>`;
    return baseHtml('Vouchers', body, autoPrint);
  };

  const buildTrialBalanceDetailHtml = (autoPrint: boolean) => {
    const rows = trial.rows.map(r => `
      <tr>
        <td>${r.account}</td>
        <td style="text-align:right">${r.debit ? formatCurrency(r.debit) : '-'}</td>
        <td style="text-align:right">${r.credit ? formatCurrency(r.credit) : '-'}</td>
      </tr>`).join('');
    const body = `
      <table>
        <thead>
          <tr>
            <th>Account</th>
            <th style="text-align:right">Debit</th>
            <th style="text-align:right">Credit</th>
          </tr>
        </thead>
        <tbody>${rows || `<tr><td colspan="3" style="text-align:center;color:#64748b;padding:10px">No entries</td></tr>`}</tbody>
        <tfoot>
          <tr>
            <td style="font-weight:700">Total</td>
            <td style="text-align:right;font-weight:700">${formatCurrency(trial.totals.debit)}</td>
            <td style="text-align:right;font-weight:700">${formatCurrency(trial.totals.credit)}</td>
          </tr>
        </tfoot>
      </table>`;
    return baseHtml('Trial Balance', body, autoPrint);
  };

  const buildBalanceSheetDetailHtml = (autoPrint: boolean) => {
    const assetRows = balanceSheet.assets.map(a => `
      <tr><td>${a.name}</td><td style="text-align:right">${formatCurrency(a.amount)}</td></tr>`).join('');
    const liabRows = balanceSheet.liabilities.map(l => `
      <tr><td>${l.name}</td><td style="text-align:right">${formatCurrency(l.amount)}</td></tr>`).join('');
    const eqRows = balanceSheet.equity.map(e => `
      <tr><td>${e.name}</td><td style="text-align:right">${formatCurrency(e.amount)}</td></tr>`).join('');
    const body = `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
        <div>
          <div style="font-weight:600;margin-bottom:6px">Assets</div>
          <table>
            <thead><tr><th>Account</th><th style="text-align:right">Amount</th></tr></thead>
            <tbody>${assetRows || `<tr><td colspan=2 style='text-align:center;color:#64748b;padding:10px'>No assets</td></tr>`}</tbody>
            <tfoot><tr><td style="font-weight:700">Total Assets</td><td style="text-align:right;font-weight:700">${formatCurrency(balanceSheet.totals.assets)}</td></tr></tfoot>
          </table>
        </div>
        <div>
          <div style="font-weight:600;margin-bottom:6px">Liabilities &amp; Equity</div>
          <table>
            <thead><tr><th>Account</th><th style="text-align:right">Amount</th></tr></thead>
            <tbody>${liabRows + eqRows || `<tr><td colspan=2 style='text-align:center;color:#64748b;padding:10px'>No liabilities/equity</td></tr>`}</tbody>
            <tfoot><tr><td style="font-weight:700">Total Liabilities &amp; Equity</td><td style="text-align:right;font-weight:700">${formatCurrency(liabEquityTotal)}</td></tr></tfoot>
          </table>
        </div>
      </div>`;
    return baseHtml('Balance Sheet', body, autoPrint);
  };

  const buildDailyClosingDetailHtml = (autoPrint: boolean) => {
    const rows = daily.rows.map(r => `
      <tr>
        <td>${r.date}</td>
        <td style="text-align:right">${formatCurrency(r.sales)}</td>
        <td style="text-align:right">${formatCurrency(r.custReturns || 0)}</td>
        <td style="text-align:right">${formatCurrency(r.purchases)}</td>
        <td style="text-align:right">${formatCurrency(r.suppReturns || 0)}</td>
        <td style="text-align:right">${formatCurrency(r.receipts)}</td>
        <td style="text-align:right">${formatCurrency(r.supPayments)}</td>
        <td style="text-align:right">${formatCurrency(r.expenses)}</td>
        <td style="text-align:right">${formatCurrency(r.openingCash || 0)}</td>
        <td style="text-align:right">${formatCurrency(r.netCash)}</td>
        <td style="text-align:right">${formatCurrency(r.closingCash || 0)}</td>
      </tr>`).join('');
    const t = daily.totals as any;
    const body = `
      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th style="text-align:right">Sales</th>
            <th style="text-align:right">Cust Returns</th>
            <th style="text-align:right">Purchases</th>
            <th style="text-align:right">Supp Returns</th>
            <th style="text-align:right">Receipts</th>
            <th style="text-align:right">Supplier Payments</th>
            <th style="text-align:right">Expenses</th>
            <th style="text-align:right">Opening</th>
            <th style="text-align:right">Net Cash</th>
            <th style="text-align:right">Closing</th>
          </tr>
        </thead>
        <tbody>${rows || `<tr><td colspan="11" style="text-align:center;color:#64748b;padding:10px">No activity</td></tr>`}</tbody>
        <tfoot>
          <tr>
            <td style="font-weight:700">Total</td>
            <td style="text-align:right;font-weight:700">${formatCurrency(t.sales)}</td>
            <td style="text-align:right;font-weight:700">${formatCurrency(t.custReturns || 0)}</td>
            <td style="text-align:right;font-weight:700">${formatCurrency(t.purchases)}</td>
            <td style="text-align:right;font-weight:700">${formatCurrency(t.suppReturns || 0)}</td>
            <td style="text-align:right;font-weight:700">${formatCurrency(t.receipts)}</td>
            <td style="text-align:right;font-weight:700">${formatCurrency(t.supPayments)}</td>
            <td style="text-align:right;font-weight:700">${formatCurrency(t.expenses)}</td>
            <td style="text-align:right;font-weight:700">${formatCurrency(t.openingCash || 0)}</td>
            <td style="text-align:right;font-weight:700">${formatCurrency(t.netCash)}</td>
            <td style="text-align:right;font-weight:700">${formatCurrency(t.closingCash || 0)}</td>
          </tr>
        </tfoot>
      </table>`;
    return baseHtml('Daily Closing', body, autoPrint);
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="rounded-2xl border bg-gradient-to-br from-emerald-50 via-white to-sky-50 p-5 md:p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="space-y-1">
              <div className="inline-flex items-center gap-2 rounded-full border bg-white/70 px-3 py-1 text-xs text-muted-foreground">
                <CalendarRange className="h-4 w-4" />
                <span>{rangeLabel}</span>
              </div>
              <h1 className="text-3xl font-bold tracking-tight text-foreground">Financial Reports</h1>
              <p className="text-sm text-muted-foreground">
                Vouchers, Trial Balance, Balance Sheet, and Daily Closing
              </p>
            </div>
            <div className="hidden md:flex items-center gap-2 rounded-xl border bg-white/60 px-4 py-3">
              <Layers className="h-4 w-4 text-muted-foreground" />
              <div>
                <div className="text-xs text-muted-foreground">Data Source</div>
                <div className="text-sm font-medium">Invoices, Purchases, Payments & Returns</div>
              </div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <Card className="rounded-2xl">
          <CardContent className={`p-4 md:p-5 grid gap-4 ${preset === 'custom' ? 'md:grid-cols-5' : 'md:grid-cols-2'} items-end`}>
            <div className="space-y-2">
              <Label className="text-xs">Date Preset</Label>
              <Select value={preset} onValueChange={(v: any) => setPreset(v)}>
                <SelectTrigger className="h-10 rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="week">This Week</SelectItem>
                  <SelectItem value="month">This Month</SelectItem>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="custom">Custom</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className={preset !== 'custom' ? 'hidden' : 'space-y-2'}>
              <Label className="text-xs">From</Label>
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-10 rounded-xl" />
            </div>
            <div className={preset !== 'custom' ? 'hidden' : 'space-y-2'}>
              <Label className="text-xs">To</Label>
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-10 rounded-xl" />
            </div>
            <div className="md:col-span-2 flex items-center justify-between rounded-xl border bg-muted/30 px-4 py-3">
              <div className="flex items-center gap-2">
                <ClipboardList className="h-4 w-4 text-muted-foreground" />
                <div>
                  <div className="text-xs text-muted-foreground">Active Range</div>
                  <div className="text-sm font-medium">{rangeLabel}</div>
                </div>
              </div>
              <div className="text-xs text-muted-foreground">Auto-updates</div>
            </div>
          </CardContent>
        </Card>

        {/* P&L Summary */}
        <div className="grid gap-4 md:grid-cols-4">
          <KpiTile title="Sales" value={formatCurrency(pnl.sales)} icon={IndianRupee} tone="emerald" />
          <KpiTile title="Purchases" value={formatCurrency(pnl.purchases)} icon={FileText} tone="amber" />
          <KpiTile title="Expenses" value={formatCurrency(pnl.expenses)} icon={CreditCard} tone="rose" />
          <KpiTile
            title={pnl.profit >= 0 ? "Net Profit" : "Net Loss"}
            value={formatCurrency(Math.abs(pnl.profit))}
            icon={pnl.profit >= 0 ? TrendingUp : TrendingDown}
            tone={pnl.profit >= 0 ? "emerald" : "rose"}
          />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Card className="rounded-2xl">
            <CardHeader className="flex flex-row items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="rounded-2xl border bg-emerald-50 p-2">
                  <FileText className="h-5 w-5 text-emerald-600" />
                </div>
                <div>
                  <CardTitle className="leading-none">Vouchers</CardTitle>
                  <div className="text-xs text-muted-foreground mt-1">All voucher activity in the selected range</div>
                </div>
              </div>
              <ActionButtons
                onPreview={() => openPrint(buildVouchersDetailHtml(false))}
                onDownload={() => openPrint(buildVouchersDetailHtml(true))}
              />
            </CardHeader>
            <CardContent>
              <div className="flex items-end justify-between gap-4">
                <div>
                  <div className="text-xs text-muted-foreground">Total</div>
                  <div className="mt-1 text-3xl font-bold tracking-tight">{formatCurrency(vouchersTotal)}</div>
                </div>
                <div className="rounded-xl border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">{rangeLabel}</div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl">
            <CardHeader className="flex flex-row items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="rounded-2xl border bg-sky-50 p-2">
                  <Layers className="h-5 w-5 text-sky-600" />
                </div>
                <div>
                  <CardTitle className="leading-none">Trial Balance</CardTitle>
                  <div className="text-xs text-muted-foreground mt-1">Debits and credits summary</div>
                </div>
              </div>
              <ActionButtons
                onPreview={() => openPrint(buildTrialBalanceDetailHtml(false))}
                onDownload={() => openPrint(buildTrialBalanceDetailHtml(true))}
              />
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-xl border bg-muted/30 p-3">
                  <div className="text-xs text-muted-foreground">Total Debit</div>
                  <div className="mt-1 text-2xl font-bold">{formatCurrency(trial.totals.debit)}</div>
                </div>
                <div className="rounded-xl border bg-muted/30 p-3">
                  <div className="text-xs text-muted-foreground">Total Credit</div>
                  <div className="mt-1 text-2xl font-bold">{formatCurrency(trial.totals.credit)}</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl">
            <CardHeader className="flex flex-row items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="rounded-2xl border bg-violet-50 p-2">
                  <IndianRupee className="h-5 w-5 text-violet-600" />
                </div>
                <div>
                  <CardTitle className="leading-none">Balance Sheet</CardTitle>
                  <div className="text-xs text-muted-foreground mt-1">Assets vs liabilities and equity</div>
                </div>
              </div>
              <ActionButtons
                onPreview={() => openPrint(buildBalanceSheetDetailHtml(false))}
                onDownload={() => openPrint(buildBalanceSheetDetailHtml(true))}
              />
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-xl border bg-muted/30 p-3">
                  <div className="text-xs text-muted-foreground">Total Assets</div>
                  <div className="mt-1 text-2xl font-bold">{formatCurrency(balanceSheet.totals.assets)}</div>
                </div>
                <div className="rounded-xl border bg-muted/30 p-3">
                  <div className="text-xs text-muted-foreground">Total Liabilities &amp; Equity</div>
                  <div className="mt-1 text-2xl font-bold">{formatCurrency(liabEquityTotal)}</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl">
            <CardHeader className="flex flex-row items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="rounded-2xl border bg-amber-50 p-2">
                  <ClipboardList className="h-5 w-5 text-amber-700" />
                </div>
                <div>
                  <CardTitle className="leading-none">Daily Closing</CardTitle>
                  <div className="text-xs text-muted-foreground mt-1">Cash movement snapshot</div>
                </div>
              </div>
              <ActionButtons
                onPreview={() => openPrint(buildDailyClosingDetailHtml(false))}
                onDownload={() => openPrint(buildDailyClosingDetailHtml(true))}
              />
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <div className="rounded-xl border bg-muted/30 p-3">
                  <div className="text-xs text-muted-foreground">Sales</div>
                  <div className="mt-1 text-lg font-semibold">{formatCurrency(daily.totals.sales)}</div>
                </div>
                <div className="rounded-xl border bg-muted/30 p-3">
                  <div className="text-xs text-muted-foreground">Receipts</div>
                  <div className="mt-1 text-lg font-semibold">{formatCurrency(daily.totals.receipts)}</div>
                </div>
                <div className="rounded-xl border bg-muted/30 p-3">
                  <div className="text-xs text-muted-foreground">Purchases</div>
                  <div className="mt-1 text-lg font-semibold">{formatCurrency(daily.totals.purchases)}</div>
                </div>
                <div className="rounded-xl border bg-muted/30 p-3">
                  <div className="text-xs text-muted-foreground">Supplier Payments</div>
                  <div className="mt-1 text-lg font-semibold">{formatCurrency(daily.totals.supPayments)}</div>
                </div>
                <div className="rounded-xl border bg-muted/30 p-3">
                  <div className="text-xs text-muted-foreground">Expenses</div>
                  <div className="mt-1 text-lg font-semibold">{formatCurrency(daily.totals.expenses)}</div>
                </div>
                <div className="rounded-xl border bg-emerald-50/70 p-3">
                  <div className="text-xs text-muted-foreground">Net Cash</div>
                  <div className="mt-1 text-xl font-bold">{formatCurrency(daily.totals.netCash)}</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </MainLayout>
  );
};

export default FinancialReports;
