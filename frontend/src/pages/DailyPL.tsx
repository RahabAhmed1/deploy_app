import { useEffect, useMemo, useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { getProducts, getOrders } from "@/lib/api";
import { formatCurrency } from "@/lib/currency";
import { TrendingUp, TrendingDown, Activity, Printer } from "lucide-react";
 

const DailyPL = () => {
  const [graded, setGraded] = useState<Array<{ date: string; revenue: number; cost: number; profit: number; loss: number; cumulative: number }>>([]);
  const [aggregation, setAggregation] = useState<"daily" | "weekly" | "monthly" | "yearly">("daily");
  const [from, setFrom] = useState<string>("");
  const [to, setTo] = useState<string>("");

  const dailyBase = useMemo(() => {
    const arr = graded.map(r => ({ date: r.date, revenue: r.revenue, cost: r.cost, profit: r.profit, loss: r.loss }));
    return arr.filter(r => (!from || r.date >= from) && (!to || r.date <= to));
  }, [graded, from, to]);

  const pad2 = (n: number) => String(n).padStart(2, "0");
  const parseYmd = (s: string) => {
    const [y, m, d] = s.split("-").map(Number);
    return new Date(y, (m || 1) - 1, d || 1);
  };
  const ymd = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  const startOfWeek = (d: Date) => {
    const day = d.getDay();
    const diff = (day + 6) % 7;
    const dt = new Date(d);
    dt.setDate(d.getDate() - diff);
    return new Date(dt.getFullYear(), dt.getMonth(), dt.getDate());
  };

  const aggregated = useMemo(() => {
    if (aggregation === "daily") {
      const rows = dailyBase
        .map(r => ({ key: r.date, label: r.date, revenue: r.revenue, cost: r.cost, profit: r.profit, loss: r.loss }))
        .sort((a, b) => a.key.localeCompare(b.key));
      let cumulative = 0;
      return rows.map(r => {
        cumulative += r.profit - r.loss;
        return { ...r, cumulative };
      });
    }
    const map = new Map<string, { key: string; label: string; revenue: number; cost: number; profit: number; loss: number }>();
    for (const r of dailyBase) {
      const d = parseYmd(r.date);
      let key = r.date;
      let label = r.date;
      if (aggregation === "weekly") {
        const wk = startOfWeek(d);
        key = ymd(wk);
        label = `Week of ${key}`;
      } else if (aggregation === "monthly") {
        key = `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
        label = key;
      } else if (aggregation === "yearly") {
        key = String(d.getFullYear());
        label = key;
      }
      const cur = map.get(key) || { key, label, revenue: 0, cost: 0, profit: 0, loss: 0 };
      cur.revenue += r.revenue;
      cur.cost += r.cost;
      cur.profit += r.profit;
      cur.loss += r.loss;
      map.set(key, cur);
    }
    const rows = Array.from(map.values()).sort((a, b) => a.key.localeCompare(b.key));
    let cumulative = 0;
    return rows.map(r => {
      cumulative += r.profit - r.loss;
      return { ...r, cumulative };
    });
  }, [dailyBase, aggregation]);

  const latest = aggregated[aggregated.length - 1];
  const prev = aggregated.length > 1 ? aggregated[aggregated.length - 2] : undefined;
  const delta = latest && prev ? (latest.profit - prev.profit) : 0;

  useEffect(() => {
    (async () => {
      try {
        const [pRes, oRes] = await Promise.all([getProducts(), getOrders()]);
        const products = (pRes?.products || []) as Array<any>;
        const orders = (oRes?.orders || []) as Array<any>;
        // Interpret: MRP = purchase cost; purchasePrice = sell rate
        const productMrp = new Map(products.map((p) => [String(p.id), (typeof p.mrp === 'number' ? p.mrp : Number(p.mrp || 0))] as const));
        const productSell = new Map(products.map((p) => [String(p.id), (typeof p.purchasePrice === 'number' ? p.purchasePrice : Number(p.purchasePrice || 0))] as const));

        const byDate = new Map<string, { revenue: number; cost: number; profit: number; loss: number }>();

        for (const o of orders) {
          const d = o.orderDate;
          const entry = byDate.get(d) || { revenue: 0, cost: 0, profit: 0, loss: 0 };
          for (const item of (o.items || [])) {
            const qty = Number(item.quantity || 0);
            const sell = (Number(item.unitPrice) || productSell.get(String(item.productId)) || 0) * qty;
            const cost = (productMrp.get(String(item.productId)) || 0) * qty;
            entry.revenue += sell;
            entry.cost += cost;
            const margin = sell - cost;
            if (margin >= 0) entry.profit += margin; else entry.loss += -margin;
          }
          byDate.set(d, entry);
        }
        const dates = Array.from(byDate.keys()).sort();
        const rows = dates.map((d) => {
          const { revenue, cost, profit, loss } = byDate.get(d)!;
          return { date: d, revenue, cost, profit, loss };
        });

        let cumulative = 0;
        const gradedRows = rows.map((r) => {
          cumulative += r.profit - r.loss;
          return { ...r, cumulative };
        });
        setGraded(gradedRows);
      } catch (e) {
        console.error(e);
      }
    })();
  }, []);

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Profit & Loss</h1>
            <p className="text-muted-foreground">Analyze {aggregation} profit, loss, and cumulative performance</p>
          </div>

        
          <div className="flex gap-2">
            <Input type="date" className="w-[150px]" value={from} onChange={(e) => setFrom(e.target.value)} />
            <Input type="date" className="w-[150px]" value={to} onChange={(e) => setTo(e.target.value)} />
            <Select value={aggregation} onValueChange={(v: any) => setAggregation(v)}>
              <SelectTrigger className="w-[160px]"><SelectValue placeholder="Aggregation" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">Daily</SelectItem>
                <SelectItem value="weekly">Weekly</SelectItem>
                <SelectItem value="monthly">Monthly</SelectItem>
                <SelectItem value="yearly">Yearly</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              onClick={() => {
                try {
                  const headers = ["Period", "Revenue", "Cost", "Profit", "Loss", "Cumulative"];
                  const rows = aggregated.map(r => [r.label, String(r.revenue), String(r.cost), String(r.profit), String(r.loss), String(r.cumulative)]);
                  const totals = aggregated.reduce((acc, r) => ({
                    revenue: acc.revenue + r.revenue,
                    cost: acc.cost + r.cost,
                    profit: acc.profit + r.profit,
                    loss: acc.loss + r.loss,
                  }), { revenue: 0, cost: 0, profit: 0, loss: 0 });
                  const lastCum = aggregated.length ? aggregated[aggregated.length - 1].cumulative : 0;
                  rows.push(["Totals", String(totals.revenue), String(totals.cost), String(totals.profit), String(totals.loss), String(lastCum)]);
                  const csv = [headers, ...rows].map(r => r.map(f => `"${String(f).replace(/"/g, '""')}"`).join(",")).join("\n");
                  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = `pl-${aggregation}.csv`;
                  a.click();
                  URL.revokeObjectURL(url);
                } catch (e) {
                  console.error(e);
                }
              }}
            >
              Export
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                try { window.print(); } catch (e) { console.error(e); }
              }}
            >
              <Printer className="mr-2 h-4 w-4" /> Print / PDF
            </Button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card className="bg-emerald-50 border-emerald-100">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100">
                <TrendingUp className="h-5 w-5 text-emerald-700" />
              </div>
              <div>
                <p className="text-2xl font-bold text-emerald-800">{formatCurrency(latest ? latest.profit : 0)}</p>
                <p className="text-sm text-emerald-700/80">{aggregation.charAt(0).toUpperCase() + aggregation.slice(1)} Profit (latest)</p>
                <p className={"text-xs font-medium " + (delta >= 0 ? "text-emerald-700" : "text-red-600")}>
                  {delta >= 0 ? "+" : ""}{formatCurrency(delta)} vs prev
                </p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-red-50 border-red-100">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-100">
                <TrendingDown className="h-5 w-5 text-red-700" />
              </div>
              <div>
                <p className="text-2xl font-bold text-red-800">{formatCurrency(latest ? latest.loss : 0)}</p>
                <p className="text-sm text-red-700/80">{aggregation.charAt(0).toUpperCase() + aggregation.slice(1)} Loss (latest)</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-blue-50 border-blue-100">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100">
                <Activity className="h-5 w-5 text-blue-700" />
              </div>
              <div>
                <p className="text-2xl font-bold text-blue-800">{formatCurrency(latest ? latest.cumulative : 0)}</p>
                <p className="text-sm text-blue-700/80">Overall Graded Profit</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>P&L Detail</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Period</TableHead>
                  <TableHead className="text-right">Revenue</TableHead>
                  <TableHead className="text-right">Cost</TableHead>
                  <TableHead className="text-right">Profit</TableHead>
                  <TableHead className="text-right">Loss</TableHead>
                  <TableHead className="text-right">Cumulative</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {aggregated.map((r) => (
                  <TableRow key={r.label} className={r.profit - r.loss < 0 ? "bg-red-50/40" : ""}>
                    <TableCell>{r.label}</TableCell>
                    <TableCell className="text-right">{formatCurrency(r.revenue)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(r.cost)}</TableCell>
                    <TableCell className={"text-right font-medium " + (r.profit >= 0 ? "text-emerald-700" : "text-red-600")}>{formatCurrency(r.profit)}</TableCell>
                    <TableCell className="text-right text-red-700">{formatCurrency(r.loss)}</TableCell>
                    <TableCell className="text-right font-semibold">{formatCurrency(r.cumulative)}</TableCell>
                  </TableRow>
                ))}
                {(function(){
                  const totals = aggregated.reduce((acc, r) => ({
                    revenue: acc.revenue + r.revenue,
                    cost: acc.cost + r.cost,
                    profit: acc.profit + r.profit,
                    loss: acc.loss + r.loss,
                  }), { revenue: 0, cost: 0, profit: 0, loss: 0 });
                  const lastCum = aggregated.length ? aggregated[aggregated.length - 1].cumulative : 0;
                  return (
                    <TableRow>
                      <TableCell className="font-semibold">Totals</TableCell>
                      <TableCell className="text-right font-semibold">{formatCurrency(totals.revenue)}</TableCell>
                      <TableCell className="text-right font-semibold">{formatCurrency(totals.cost)}</TableCell>
                      <TableCell className="text-right font-semibold">{formatCurrency(totals.profit)}</TableCell>
                      <TableCell className="text-right font-semibold">{formatCurrency(totals.loss)}</TableCell>
                      <TableCell className="text-right font-semibold">{formatCurrency(lastCum)}</TableCell>
                    </TableRow>
                  );
                })()}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
};

export default DailyPL;
