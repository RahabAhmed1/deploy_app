import { useEffect, useMemo, useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getOrders, getPayments, getPurchases, getSupplierPayments, getCustomers, getExpenses, getReturns, getSupplierReturns } from "@/lib/api";
import { formatCurrency } from "@/lib/currency";

interface LedgerEntry {
  date: string;
  type: "Invoice" | "Payment" | "Return";
  reference: string;
  party: string;
  debit: number; // money out (invoice raised)
  credit: number; // money in OR credit notes (payments/returns)
  partyKind?: "customer" | "supplier";
  partyId?: string;
}

const Ledger = () => {
  const [withBalance, setWithBalance] = useState<Array<LedgerEntry & { balance: number }>>([]);
  const [totals, setTotals] = useState({ debit: 0, credit: 0 });
  const [openingBalance, setOpeningBalance] = useState(0);
  const [closingBalance, setClosingBalance] = useState(0);

  // Raw data for filters and P&L
  const [orders, setOrders] = useState<Array<any>>([]);
  const [payments, setPayments] = useState<Array<any>>([]);
  const [purchases, setPurchases] = useState<Array<any>>([]);
  const [supplierPays, setSupplierPays] = useState<Array<any>>([]);
  const [expenses, setExpenses] = useState<Array<any>>([]);
  const [custReturns, setCustReturns] = useState<Array<any>>([]);
  const [suppReturns, setSuppReturns] = useState<Array<any>>([]);

  // Filters
  const [preset, setPreset] = useState<"today" | "week" | "month" | "all" | "custom">("today");
  const [from, setFrom] = useState<string>(new Date().toISOString().slice(0,10));
  const [to, setTo] = useState<string>(new Date().toISOString().slice(0,10));
  const [scope, setScope] = useState<"all" | "customers" | "suppliers">("all");
  const [customers, setCustomers] = useState<Array<{ id: string; name: string }>>([]);
  const [customerId, setCustomerId] = useState<string>("all");

  useEffect(() => {
    (async () => {
      try {
        const [oRes, pRes, puRes, spRes, eRes, rRes, srRes] = await Promise.all([
          getOrders(),
          getPayments(),
          getPurchases(),
          getSupplierPayments(),
          getExpenses(),
          getReturns(),
          getSupplierReturns(),
        ]);
        setOrders((oRes?.orders || []) as Array<any>);
        setPayments((pRes?.payments || []) as Array<any>);
        setPurchases(((puRes?.purchases ?? puRes) || []) as Array<any>);
        setSupplierPays(((spRes?.payments ?? spRes) || []) as Array<any>);
        setExpenses(((eRes?.expenses ?? eRes) || []) as Array<any>);
        setCustReturns(((rRes as any)?.returns ?? rRes ?? []) as Array<any>);
        setSuppReturns(((srRes as any)?.returns ?? srRes ?? []) as Array<any>);
        try {
          const cRes = await getCustomers();
          const cs = ((cRes as any)?.customers || []).map((c: any) => ({ id: String(c.id), name: c.name || "" }));
          setCustomers(cs);
        } catch {
          setCustomers([]);
        }
      } catch (e) {
        console.error(e);
      }
    })();
  }, []);

  // Compute effective date range from preset
  const effectiveRange = useMemo(() => {
    const today = new Date();
    const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const endOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
    if (preset === "all") return { from: undefined as Date | undefined, to: undefined as Date | undefined };
    if (preset === "custom") return { from: from ? new Date(from) : undefined, to: to ? endOfDay(new Date(to)) : undefined };
    if (preset === "today") {
      return { from: startOfDay(today), to: endOfDay(today) };
    }
    if (preset === "week") {
      const d = new Date();
      const start = new Date(d.getTime() - 6 * 24 * 60 * 60 * 1000);
      return { from: startOfDay(start), to: endOfDay(d) };
    }
    if (preset === "month") {
      const start = new Date(today.getFullYear(), today.getMonth(), 1);
      return { from: startOfDay(start), to: endOfDay(today) };
    }
    return { from: undefined, to: undefined };
  }, [preset, from, to]);

  // Recompute ledger when data or filters change
  useEffect(() => {
    const within = (dateStr: string) => {
      if (!dateStr) return false;
      const d = new Date(dateStr);
      if (Number.isNaN(d.getTime())) return false;
      if (effectiveRange.from && d < effectiveRange.from) return false;
      if (effectiveRange.to && d > effectiveRange.to) return false;
      return true;
    };
    const before = (dateStr: string) => {
      if (!dateStr) return false;
      const d = new Date(dateStr);
      if (Number.isNaN(d.getTime())) return false;
      if (!effectiveRange.from) return false;
      return d < effectiveRange.from;
    };

    const invoiceEntries: LedgerEntry[] = orders
      .filter((o) => !effectiveRange.from && !effectiveRange.to ? true : within(o.orderDate))
      .map((o) => ({
        date: o.orderDate,
        type: "Invoice",
        reference: o.orderNo,
        party: o.customerName,
        debit: Number(o.netAmount || 0),
        credit: 0,
        partyKind: "customer",
        partyId: o.customerId ? String(o.customerId) : undefined,
      }));
    const paymentEntries: LedgerEntry[] = payments
      .filter((p) => !effectiveRange.from && !effectiveRange.to ? true : within(p.date))
      .map((p) => ({
        date: p.date,
        type: "Payment",
        reference: p.reference || p.id,
        party: p.customerName,
        debit: 0,
        credit: Number(p.amount || 0),
        partyKind: "customer",
        partyId: p.customerId ? String(p.customerId) : undefined,
      }));
    const purchaseEntries: LedgerEntry[] = purchases
      .filter((pr) => !effectiveRange.from && !effectiveRange.to ? true : within(pr.date))
      .map((pr) => ({
        date: pr.date,
        type: "Invoice",
        reference: pr.purchaseNo,
        party: pr.supplierName,
        debit: Number(pr.netAmount || 0),
        credit: 0,
        partyKind: "supplier",
        partyId: pr.supplierId ? String(pr.supplierId) : undefined,
      }));
    const supplierPaymentEntries: LedgerEntry[] = supplierPays
      .filter((sp) => !effectiveRange.from && !effectiveRange.to ? true : within(sp.date))
      .map((sp) => ({
        date: sp.date,
        type: "Payment",
        reference: sp.reference || sp.id,
        party: sp.supplierName,
        debit: Number(sp.amount || 0),
        credit: 0,
        partyKind: "supplier",
        partyId: sp.supplierId ? String(sp.supplierId) : undefined,
      }));

    const expenseEntries: LedgerEntry[] = expenses
      .filter((ex) => !effectiveRange.from && !effectiveRange.to ? true : within(ex.date))
      .map((ex) => ({
        date: ex.date,
        type: "Payment",
        reference: ex.reference || ex.id,
        party: ex.category || "Expense",
        debit: Number(ex.amount || 0),
        credit: 0,
      } as LedgerEntry));

    const customerReturnEntries: LedgerEntry[] = custReturns
      .filter((r) => (r.status || '').toLowerCase() === 'verified')
      .filter((r) => !effectiveRange.from && !effectiveRange.to ? true : within(r.date))
      .map((r) => ({
        date: r.date,
        type: "Return",
        reference: r.referenceNo || r.id || r.returnCode || r.invoiceNo,
        party: r.customer || "Customer",
        debit: 0,
        credit: Number(r.value || 0),
        partyKind: "customer",
      }));

    const supplierReturnEntries: LedgerEntry[] = suppReturns
      .filter((r) => (r.status || '').toLowerCase() === 'verified')
      .filter((r) => !effectiveRange.from && !effectiveRange.to ? true : within(r.date))
      .map((r) => ({
        date: r.date,
        type: "Return",
        reference: r.referenceNo || r.id || r.returnCode,
        party: r.supplier || "Supplier",
        debit: 0,
        credit: Number(r.value || 0),
        partyKind: "supplier",
      }));

    let entries = [
      ...invoiceEntries,
      ...paymentEntries,
      ...purchaseEntries,
      ...supplierPaymentEntries,
      ...expenseEntries,
      ...customerReturnEntries,
      ...supplierReturnEntries,
    ];

    if (scope === "customers") entries = entries.filter((e) => e.partyKind === "customer");
    if (scope === "suppliers") entries = entries.filter((e) => e.partyKind === "supplier");
    if (customerId && customerId !== "all") entries = entries.filter((e) => e.partyKind === "customer" && e.partyId === customerId);

    entries.sort((a, b) => a.date.localeCompare(b.date));
    let running = 0;
    const wb = entries.map((e) => {
      running = running + e.debit - e.credit;
      return { ...e, balance: running } as LedgerEntry & { balance: number };
    });
    setWithBalance(wb);
    setTotals({ debit: wb.reduce((s, e) => s + e.debit, 0), credit: wb.reduce((s, e) => s + e.credit, 0) });

    // Opening balance: net of all entries strictly before the selected range start
    const invOpen: LedgerEntry[] = orders
      .filter((o) => before(o.orderDate))
      .map((o) => ({ date: o.orderDate, type: "Invoice", reference: o.orderNo, party: o.customerName, debit: Number(o.netAmount || 0), credit: 0 }));
    const payOpen: LedgerEntry[] = payments
      .filter((p) => before(p.date))
      .map((p) => ({ date: p.date, type: "Payment", reference: p.reference || p.id, party: p.customerName, debit: 0, credit: Number(p.amount || 0) }));
    const purOpen: LedgerEntry[] = purchases
      .filter((pr) => before(pr.date))
      .map((pr) => ({ date: pr.date, type: "Invoice", reference: pr.purchaseNo, party: pr.supplierName, debit: Number(pr.netAmount || 0), credit: 0 }));
    const suppPayOpen: LedgerEntry[] = supplierPays
      .filter((sp) => before(sp.date))
      .map((sp) => ({ date: sp.date, type: "Payment", reference: sp.reference || sp.id, party: sp.supplierName, debit: Number(sp.amount || 0), credit: 0 }));
    const expOpen: LedgerEntry[] = expenses
      .filter((ex) => before(ex.date))
      .map((ex) => ({ date: ex.date, type: "Payment", reference: ex.reference || ex.id, party: ex.category || "Expense", debit: Number(ex.amount || 0), credit: 0 } as LedgerEntry));
    const custRetOpen: LedgerEntry[] = custReturns
      .filter((r) => (r.status || '').toLowerCase() === 'verified')
      .filter((r) => before(r.date))
      .map((r) => ({ date: r.date, type: "Return", reference: r.referenceNo || r.id || r.returnCode || r.invoiceNo, party: r.customer || "Customer", debit: 0, credit: Number(r.value || 0) }));
    const suppRetOpen: LedgerEntry[] = suppReturns
      .filter((r) => (r.status || '').toLowerCase() === 'verified')
      .filter((r) => before(r.date))
      .map((r) => ({ date: r.date, type: "Return", reference: r.referenceNo || r.id || r.returnCode, party: r.supplier || "Supplier", debit: 0, credit: Number(r.value || 0) }));
    const opening = [...invOpen, ...payOpen, ...purOpen, ...suppPayOpen, ...expOpen, ...custRetOpen, ...suppRetOpen]
      .reduce((s, e) => s + e.debit - e.credit, 0);
    setOpeningBalance(opening);
    setClosingBalance(opening + wb.reduce((s, e) => s + e.debit - e.credit, 0));
  }, [orders, payments, purchases, supplierPays, custReturns, suppReturns, effectiveRange, scope, customerId]);

  // P&L summary from filtered date range
  const pnl = useMemo(() => {
    const within = (dateStr: string) => {
      if (!dateStr) return false;
      const d = new Date(dateStr);
      if (Number.isNaN(d.getTime())) return false;
      if (effectiveRange.from && d < effectiveRange.from) return false;
      if (effectiveRange.to && d > effectiveRange.to) return false;
      return true;
    };
    const sales = orders.filter((o) => !effectiveRange.from && !effectiveRange.to ? true : within(o.orderDate))
      .reduce((s, o) => s + Number(o.netAmount || 0), 0);
    const purchasesTotal = purchases.filter((pr) => !effectiveRange.from && !effectiveRange.to ? true : within(pr.date))
      .reduce((s, pr) => s + Number(pr.netAmount || 0), 0);
    const expensesTotal = expenses.filter((ex) => !effectiveRange.from && !effectiveRange.to ? true : within(ex.date))
      .reduce((s, ex) => s + Number(ex.amount || 0), 0);
    const profit = sales - purchasesTotal - expensesTotal;
    return { sales, purchases: purchasesTotal, expenses: expensesTotal, profit };
  }, [orders, purchases, expenses, effectiveRange]);

  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Ledger</h1>
          <p className="text-muted-foreground">Consolidated ledger of invoices (debits) and payments (credits) with date and customer filters</p>
        </div>

        <Card>
          <CardContent className="p-4 grid gap-3 md:grid-cols-5 items-end">
            <div>
              <p className="text-xs mb-1">Date Preset</p>
              <Select value={preset} onValueChange={(v: any) => setPreset(v)}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="week">This Week</SelectItem>
                  <SelectItem value="month">This Month</SelectItem>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="custom">Custom</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <p className="text-xs mb-1">From</p>
              <Input disabled={preset !== 'custom'} type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-9" />
            </div>
            <div>
              <p className="text-xs mb-1">To</p>
              <Input disabled={preset !== 'custom'} type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-9" />
            </div>
            <div>
              <p className="text-xs mb-1">Scope</p>
              <Select value={scope} onValueChange={(v: any) => setScope(v)}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="customers">Customers</SelectItem>
                  <SelectItem value="suppliers">Suppliers</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <p className="text-xs mb-1">Customer</p>
              <Select value={customerId} onValueChange={(v: any) => setCustomerId(v)}>
                <SelectTrigger className="h-9"><SelectValue placeholder="All customers" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All customers</SelectItem>
                  {customers.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardContent className="p-4">
              <div>
                <p className="text-2xl font-bold">{formatCurrency(totals.debit)}</p>
                <p className="text-sm text-muted-foreground">Total Debits (Invoices)</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div>
                <p className="text-2xl font-bold">{formatCurrency(totals.credit)}</p>
                <p className="text-sm text-muted-foreground">Total Credits (Payments)</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div>
                <p className="text-2xl font-bold">{formatCurrency(totals.debit - totals.credit)}</p>
                <p className="text-sm text-muted-foreground">Net Balance</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardContent className="p-4">
              <div>
                <p className="text-2xl font-bold">{formatCurrency(openingBalance)}</p>
                <p className="text-sm text-muted-foreground">Opening Balance</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div>
                <p className="text-2xl font-bold">{formatCurrency(closingBalance)}</p>
                <p className="text-sm text-muted-foreground">Closing Balance</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardContent className="p-4">
              <div>
                <p className="text-2xl font-bold">{formatCurrency(pnl.sales)}</p>
                <p className="text-sm text-muted-foreground">Sales ({preset === 'today' ? 'Today' : preset === 'week' ? 'This Week' : preset === 'month' ? 'This Month' : preset === 'custom' ? `${from} to ${to}` : 'All'})</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div>
                <p className="text-2xl font-bold">{formatCurrency(pnl.purchases)}</p>
                <p className="text-sm text-muted-foreground">Purchases ({preset === 'today' ? 'Today' : preset === 'week' ? 'This Week' : preset === 'month' ? 'This Month' : preset === 'custom' ? `${from} to ${to}` : 'All'})</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div>
                <p className="text-2xl font-bold">{formatCurrency((pnl as any).expenses || 0)}</p>
                <p className="text-sm text-muted-foreground">Expenses ({preset === 'today' ? 'Today' : preset === 'week' ? 'This Week' : preset === 'month' ? 'This Month' : preset === 'custom' ? `${from} to ${to}` : 'All'})</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div>
                <p className="text-2xl font-bold">{formatCurrency(pnl.profit)}</p>
                <p className="text-sm text-muted-foreground">Net P&L (Sales - Purchases - Expenses)</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Ledger Entries</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead>Party</TableHead>
                  <TableHead className="text-right">Debit</TableHead>
                  <TableHead className="text-right">Credit</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {withBalance.map((e, idx) => (
                  <TableRow key={`${e.type}-${e.reference}-${idx}`}>
                    <TableCell>{e.date}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={e.type === "Invoice" ? "border-primary/30 text-primary" : "border-green-500/30 text-green-600"}>
                        {e.type}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-sm">{e.reference}</TableCell>
                    <TableCell>{e.party}</TableCell>
                    <TableCell className="text-right">{e.debit ? formatCurrency(e.debit) : "-"}</TableCell>
                    <TableCell className="text-right">{e.credit ? formatCurrency(e.credit) : "-"}</TableCell>
                    <TableCell className="text-right font-medium">{formatCurrency((e as any).balance)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
};

export default Ledger;
