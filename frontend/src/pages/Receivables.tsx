import { useEffect, useMemo, useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { getCustomers, getOrders, getPayments, getReturns } from "@/lib/api";
import { formatCurrency } from "@/lib/currency";

 type Customer = { id: string; name: string; type?: string };

const Receivables = () => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [orders, setOrders] = useState<Array<any>>([]);
  const [payments, setPayments] = useState<Array<any>>([]);
  const [returns, setReturns] = useState<Array<any>>([]);

  const [filterCustomer, setFilterCustomer] = useState<string>("all");
  const [from, setFrom] = useState<string>("");
  const [to, setTo] = useState<string>("");

  useEffect(() => {
    (async () => {
      try {
        const [cRes, oRes, pRes, rRes] = await Promise.all([
          getCustomers(),
          getOrders(),
          getPayments(),
          getReturns(),
        ]);
        setCustomers(((cRes as any)?.customers || []).map((c: any) => ({ id: String(c.id), name: c.name || "", type: c.type })));
        setOrders((oRes?.orders || []) as Array<any>);
        setPayments((pRes?.payments || []) as Array<any>);
        setReturns(((rRes as any)?.returns ?? rRes ?? []) as Array<any>);
      } catch (e) {}
    })();
  }, []);

  const parsedFrom = from ? new Date(from) : undefined;
  const parsedTo = to ? new Date(to + "T23:59:59.999Z") : undefined;
  const within = (dateStr: string) => {
    if (!dateStr) return false;
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return false;
    if (parsedFrom && d < parsedFrom) return false;
    if (parsedTo && d > parsedTo) return false;
    return true;
  };

  const perCustomer = useMemo(() => {
    const map = new Map<string, { id: string; name: string; total: number; paid: number; returns: number; outstanding: number; invoices: Array<{ id: string; orderNo: string; date: string; amount: number; paid: number; balance: number }> }>();
    const custById = new Map(customers.map(c => [c.id, c] as const));
    // group orders
    for (const o of orders) {
      if (!o.customerId) continue;
      if (parsedFrom || parsedTo) { if (!within(o.orderDate)) continue; }
      const id = String(o.customerId);
      const name = custById.get(id)?.name || o.customerName || id;
      const entry = map.get(id) || { id, name, total: 0, paid: 0, returns: 0, outstanding: 0, invoices: [] };
      entry.total += Number(o.netAmount || 0);
      entry.invoices.push({ id: String(o.id), orderNo: o.orderNo, date: o.orderDate, amount: Number(o.netAmount || 0), paid: 0, balance: 0 });
      map.set(id, entry);
    }
    // apply payments
    for (const p of payments) {
      const id = String(p.customerId || "");
      if (!id) continue;
      if (parsedFrom || parsedTo) { if (!within(p.date)) continue; }
      const entry = map.get(id);
      if (!entry) continue;
      entry.paid += Number(p.amount || 0);
      const inv = entry.invoices.find(i => i.id === String(p.orderId));
      if (inv) inv.paid += Number(p.amount || 0);
    }
    // apply customer returns (credit notes)
    for (const r of returns) {
      if ((r.status || '').toLowerCase() !== 'verified') continue;
      const id = String(r.customerId || r.customer?.id || "");
      if (!id) continue;
      if (parsedFrom || parsedTo) { if (!within(r.date)) continue; }
      const entry = map.get(id);
      if (!entry) continue;
      const credit = Number(r.value || 0);
      entry.returns += credit;
      // try apply to invoice by number if present
      const inv = entry.invoices.find(i => i.orderNo === r.invoiceNo);
      if (inv) inv.paid += credit; // treat as settlement against invoice
    }
    // compute balances
    for (const entry of map.values()) {
      for (const inv of entry.invoices) {
        inv.balance = Math.max(0, (inv.amount) - inv.paid);
      }
      entry.outstanding = Math.max(0, (entry.total) - entry.paid - entry.returns);
      // keep only invoices that still have balance for detailed list
      entry.invoices = entry.invoices.filter(i => i.balance > 1e-6);
    }
    // filter customer if needed
    const arr = Array.from(map.values()).filter(e => filterCustomer === 'all' ? true : e.id === filterCustomer);
    // sort by outstanding desc
    arr.sort((a, b) => b.outstanding - a.outstanding);
    return arr;
  }, [customers, orders, payments, returns, filterCustomer, from, to]);

  const totalOutstanding = perCustomer.reduce((s, c) => s + c.outstanding, 0);

  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Accounts Receivable</h1>
          <p className="text-muted-foreground">Outstanding invoices and receivable balances per customer</p>
        </div>

        <Card>
          <CardContent className="p-4 grid gap-3 md:grid-cols-4 items-end">
            <div className="md:col-span-2">
              <p className="text-xs mb-1">Customer</p>
              <Select value={filterCustomer} onValueChange={setFilterCustomer}>
                <SelectTrigger className="h-9"><SelectValue placeholder="All customers" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All customers</SelectItem>
                  {customers.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <p className="text-xs mb-1">From</p>
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-9" />
            </div>
            <div>
              <p className="text-xs mb-1">To</p>
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-9" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div>
              <p className="text-2xl font-bold text-primary">{formatCurrency(totalOutstanding)}</p>
              <p className="text-sm text-muted-foreground">Total Receivables</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Customers with Outstanding</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Paid + Returns</TableHead>
                  <TableHead className="text-right">Outstanding</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {perCustomer.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell className="text-right">{formatCurrency(c.total)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(c.paid + c.returns)}</TableCell>
                    <TableCell className="text-right font-bold text-primary">{formatCurrency(c.outstanding)}</TableCell>
                  </TableRow>
                ))}
                {perCustomer.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-sm text-muted-foreground">No outstanding receivables</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Open Invoices (by selected customer/date)</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Order No</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="text-right">Paid</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {perCustomer.flatMap((c) => c.invoices.map((i) => (
                  <TableRow key={`${c.id}-${i.id}`}>
                    <TableCell>{i.date}</TableCell>
                    <TableCell className="font-mono text-sm">{i.orderNo}</TableCell>
                    <TableCell className="text-right">{formatCurrency(i.amount)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(i.paid)}</TableCell>
                    <TableCell className="text-right font-semibold text-primary">{formatCurrency(i.balance)}</TableCell>
                  </TableRow>
                )))}
                {perCustomer.flatMap((c) => c.invoices).length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-sm text-muted-foreground">No open invoices</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
};

export default Receivables;
