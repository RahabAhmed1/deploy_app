import { useEffect, useMemo, useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { getCustomers, getSuppliers, getOrders, getPayments, getPurchases, getSupplierPayments, getReturns, getSupplierReturns } from "@/lib/api";
import { formatCurrency } from "@/lib/currency";

 type Entry = {
  date: string;
  type: "Invoice" | "Payment" | "Return";
  reference: string;
  debit: number;
  credit: number;
};

const PartyLedger = () => {
  const [partyType, setPartyType] = useState<"customer" | "supplier">("customer");
  const [customers, setCustomers] = useState<Array<{ id: string; name: string }>>([]);
  const [suppliers, setSuppliers] = useState<Array<{ id: string; name: string }>>([]);
  const [partyId, setPartyId] = useState<string>("");
  const [from, setFrom] = useState<string>(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0,10));
  const [to, setTo] = useState<string>(new Date().toISOString().slice(0,10));

  // source data
  const [orders, setOrders] = useState<Array<any>>([]);
  const [payments, setPayments] = useState<Array<any>>([]);
  const [purchases, setPurchases] = useState<Array<any>>([]);
  const [supplierPays, setSupplierPays] = useState<Array<any>>([]);
  const [custReturns, setCustReturns] = useState<Array<any>>([]);
  const [suppReturns, setSuppReturns] = useState<Array<any>>([]);

  useEffect(() => {
    (async () => {
      try {
        const [cRes, sRes] = await Promise.all([getCustomers(), getSuppliers()]);
        setCustomers(((cRes as any)?.customers || []).map((c: any) => ({ id: String(c.id), name: c.name || "" })));
        setSuppliers(((sRes as any)?.suppliers || sRes || []).map((s: any) => ({ id: String(s.id), name: s.name || "" })));
      } catch {}
      try {
        const [oRes, pRes, puRes, spRes, rRes, srRes] = await Promise.all([
          getOrders(),
          getPayments(),
          getPurchases(),
          getSupplierPayments(),
          getReturns(),
          getSupplierReturns(),
        ]);
        setOrders((oRes?.orders || []) as Array<any>);
        setPayments((pRes?.payments || []) as Array<any>);
        setPurchases(((puRes?.purchases ?? puRes) || []) as Array<any>);
        setSupplierPays(((spRes?.payments ?? spRes) || []) as Array<any>);
        setCustReturns(((rRes as any)?.returns ?? rRes ?? []) as Array<any>);
        setSuppReturns(((srRes as any)?.returns ?? srRes ?? []) as Array<any>);
      } catch {}
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

  const beforeFrom = (dateStr: string) => {
    if (!dateStr) return false;
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return false;
    if (!parsedFrom) return false;
    return d < parsedFrom;
  };

  const partyEntries = useMemo(() => {
    if (!partyId) return { opening: 0, entries: [] as Entry[], closing: 0 };
    if (partyType === "customer") {
      const inv = orders
        .filter((o) => String(o.customerId || "") === partyId)
        .map((o) => ({ date: o.orderDate, type: "Invoice" as const, reference: o.orderNo, debit: Number(o.netAmount || 0), credit: 0 }));
      const pays = payments
        .filter((p) => String(p.customerId || "") === partyId)
        .map((p) => ({ date: p.date, type: "Payment" as const, reference: p.reference || p.id, debit: 0, credit: Number(p.amount || 0) }));
      const rets = custReturns
        .filter((r) => (r.status || '').toLowerCase() === 'verified')
        .filter((r) => String(r.customerId || r.customer?.id || "") === partyId)
        .map((r) => ({ date: r.date, type: "Return" as const, reference: r.referenceNo || r.id || r.returnCode, debit: 0, credit: Number(r.value || 0) }));
      const all = [...inv, ...pays, ...rets];
      const opening = all.filter((e) => beforeFrom(e.date)).reduce((s, e) => s + e.debit - e.credit, 0);
      const current = all.filter((e) => within(e.date));
      current.sort((a, b) => a.date.localeCompare(b.date));
      const closing = opening + current.reduce((s, e) => s + e.debit - e.credit, 0);
      return { opening, entries: current, closing };
    } else {
      const inv = purchases
        .filter((pr) => String(pr.supplierId || "") === partyId)
        .map((pr) => ({ date: pr.date, type: "Invoice" as const, reference: pr.purchaseNo, debit: Number(pr.netAmount || 0), credit: 0 }));
      const pays = supplierPays
        .filter((sp) => String(sp.supplierId || "") === partyId)
        .map((sp) => ({ date: sp.date, type: "Payment" as const, reference: sp.reference || sp.id, debit: 0, credit: Number(sp.amount || 0) }));
      const rets = suppReturns
        .filter((r) => (r.status || '').toLowerCase() === 'verified')
        .filter((r) => String(r.supplierId || r.supplier?.id || "") === partyId)
        .map((r) => ({ date: r.date, type: "Return" as const, reference: r.referenceNo || r.id || r.returnCode, debit: 0, credit: Number(r.value || 0) }));
      const all = [...inv, ...pays, ...rets];
      const opening = all.filter((e) => beforeFrom(e.date)).reduce((s, e) => s + e.debit - e.credit, 0);
      const current = all.filter((e) => within(e.date));
      current.sort((a, b) => a.date.localeCompare(b.date));
      const closing = opening + current.reduce((s, e) => s + e.debit - e.credit, 0);
      return { opening, entries: current, closing };
    }
  }, [partyType, partyId, from, to, orders, payments, purchases, supplierPays, custReturns, suppReturns]);

  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Party Ledger</h1>
          <p className="text-muted-foreground">Date-wise bills, payments and returns with opening and closing balances</p>
        </div>

        <Card>
          <CardContent className="p-4 grid gap-3 md:grid-cols-5 items-end">
            <div>
              <p className="text-xs mb-1">Party Type</p>
              <Select value={partyType} onValueChange={(v: any) => { setPartyType(v); setPartyId(""); }}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="customer">Customer</SelectItem>
                  <SelectItem value="supplier">Supplier</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-2">
              <p className="text-xs mb-1">{partyType === 'customer' ? 'Customer' : 'Supplier'}</p>
              <Select value={partyId} onValueChange={(v) => setPartyId(v)}>
                <SelectTrigger className="h-9"><SelectValue placeholder={`Select ${partyType}`} /></SelectTrigger>
                <SelectContent>
                  {(partyType === 'customer' ? customers : suppliers).map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
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

        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardContent className="p-4">
              <div>
                <p className="text-2xl font-bold">{formatCurrency(partyEntries.opening)}</p>
                <p className="text-sm text-muted-foreground">Opening Balance</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div>
                <p className="text-2xl font-bold">{formatCurrency(partyEntries.entries.reduce((s, e) => s + e.debit, 0))}</p>
                <p className="text-sm text-muted-foreground">Debits (Invoices)</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div>
                <p className="text-2xl font-bold">{formatCurrency(partyEntries.entries.reduce((s, e) => s + e.credit, 0))}</p>
                <p className="text-sm text-muted-foreground">Credits (Payments/Returns)</p>
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
                  <TableHead className="text-right">Debit</TableHead>
                  <TableHead className="text-right">Credit</TableHead>
                  <TableHead className="text-right">Running Balance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {partyEntries.entries.map((e, idx) => {
                  const running = partyEntries.opening + partyEntries.entries.slice(0, idx + 1).reduce((s, x) => s + x.debit - x.credit, 0);
                  return (
                    <TableRow key={`${e.type}-${e.reference}-${idx}`}>
                      <TableCell>{e.date}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={e.type === 'Invoice' ? 'border-primary/30 text-primary' : 'border-green-500/30 text-green-600'}>
                          {e.type}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-sm">{e.reference}</TableCell>
                      <TableCell className="text-right">{e.debit ? formatCurrency(e.debit) : '-'}</TableCell>
                      <TableCell className="text-right">{e.credit ? formatCurrency(e.credit) : '-'}</TableCell>
                      <TableCell className="text-right font-medium">{formatCurrency(running)}</TableCell>
                    </TableRow>
                  );
                })}
                <TableRow>
                  <TableCell colSpan={5} className="text-right font-semibold">Closing Balance</TableCell>
                  <TableCell className="text-right font-bold">{formatCurrency(partyEntries.closing)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
};

export default PartyLedger;
