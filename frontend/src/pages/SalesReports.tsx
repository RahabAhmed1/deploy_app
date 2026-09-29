import { useEffect, useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
import { getSalesSeries, getRevenueByCustomerType, getCategoryShare, getOrders, getCustomers, getProducts } from "@/lib/api";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { Download, TrendingUp, IndianRupee, ShoppingCart, Users } from "lucide-react";
import { formatCurrency } from "@/lib/currency";

const COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
];

type SeriesPoint = { month: string; sales: number };
type RevByType = { type: string; revenue: number; percentage: number };
type CategoryShare = { name: string; value: number };
type Order = { id: string; orderNo: string; customerName?: string; orderDate?: string; salesmanCode?: string; salesmanName?: string; netAmount: number; items: Array<{ productId: string; productName: string; total?: number; quantity: number; unitPrice: number; discount: number; tax: number; }> };
type Product = { id: string; name: string; category?: string };

const SalesReports = () => {
  const [series, setSeries] = useState<SeriesPoint[]>([]);
  const [revByType, setRevByType] = useState<RevByType[]>([]);
  const [catShare, setCatShare] = useState<CategoryShare[]>([]);
  const [granularity, setGranularity] = useState<'daily' | 'monthly'>('monthly');
  const [range, setRange] = useState<'7days' | '30days' | '6months' | '1year'>('6months');
  const [salesmanFilter, setSalesmanFilter] = useState('all');
  const [orders, setOrders] = useState<Order[]>([]);
  const [customers, setCustomers] = useState<Array<{ id: string; name: string }>>([]);
  const [products, setProducts] = useState<Product[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const [sRes, rRes, cRes, oRes, cuRes, pRes] = await Promise.all([
          getSalesSeries(),
          getRevenueByCustomerType(),
          getCategoryShare(),
          getOrders(),
          getCustomers(),
          getProducts(),
        ]);
        setSeries(sRes?.salesData || []);
        setRevByType(rRes?.revenueByCustomerType || []);
        setCatShare(cRes?.categoryData || []);
        setOrders((oRes?.orders || []) as Order[]);
        setCustomers((cuRes?.customers || []).map((c: any) => ({ id: String(c.id), name: c.name })));
        setProducts((pRes?.products || []).map((p: any) => ({ id: String(p.id), name: p.name, category: p.category })));
      } catch (e) {
        console.error(e);
      }
    })();
  }, []);

  // Date filtering helpers
  const dateFrom = (() => {
    const today = new Date();
    if (range === '7days') return new Date(today.getTime() - 6 * 24 * 60 * 60 * 1000);
    if (range === '30days') return new Date(today.getTime() - 29 * 24 * 60 * 60 * 1000);
    if (range === '6months') return new Date(today.getFullYear(), today.getMonth() - 5, 1);
    if (range === '1year') return new Date(today.getFullYear() - 1, today.getMonth(), 1);
    return undefined;
  })();

  const filteredOrders = orders.filter((o) => {
    if (!o.orderDate) return true;
    if (!dateFrom) return true;
    if (new Date(o.orderDate) < dateFrom) return false;
    if (salesmanFilter !== 'all' && String((o as any).salesmanCode || '') !== salesmanFilter) return false;
    return true;
  });

  const computedSeries = (() => {
    const map = new Map<string, number>();
    for (const o of filteredOrders) {
      const d = o.orderDate ? new Date(o.orderDate) : undefined;
      if (!d) continue;
      let key: string;
      if (granularity === 'daily') {
        key = d.toISOString().slice(0, 10);
      } else {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        key = `${y}-${m}`;
      }
      map.set(key, (map.get(key) || 0) + Number((o as any).netAmount || 0));
    }
    const arr = Array.from(map.entries()).sort((a,b) => a[0].localeCompare(b[0])).map(([k, v]) => ({ month: k, sales: v }));
    return arr;
  })();

  const chartData = computedSeries.length ? computedSeries : series;

  const totalRevenue = chartData.reduce((s, pt) => s + (pt.sales || 0), 0);
  const totalOrders = filteredOrders.length;
  const avgOrderValue = totalOrders ? totalRevenue / totalOrders : 0;
  const activeCustomers = customers.length;

  const topProductsMap = new Map<string, { productId: string; name: string; category?: string; units: number; revenue: number }>();
  for (const o of filteredOrders) {
    for (const it of o.items || []) {
      const key = String(it.productId);
      const p = products.find(pr => pr.id === key);
      const entry = topProductsMap.get(key) || { productId: key, name: it.productName || p?.name || key, category: p?.category, units: 0, revenue: 0 };
      entry.units += Number(it.quantity || 0);
      const total = typeof it.total === 'number' ? it.total : (Number(it.quantity||0) * Number(it.unitPrice||0) * (1 - Number(it.discount||0)/100) * (1 + Number(it.tax||0)/100));
      entry.revenue += total;
      topProductsMap.set(key, entry);
    }
  }
  const topProducts = Array.from(topProductsMap.values()).sort((a,b) => b.revenue - a.revenue).slice(0,4);
  const productStats = Array.from(topProductsMap.values()).sort((a,b) => b.revenue - a.revenue);

  const exportSalesDetails = () => {
    try {
      const headers = [
        "Date",
        "Order No",
        "Salesman",
        "Salesman Code",
        "Customer",
        "Product",
        "Quantity",
        "Unit Price",
        "Discount %",
        "Tax %",
        "Line Total",
      ];
      const rows: string[][] = [];
      for (const o of filteredOrders) {
        const date = (o as any).orderDate || "";
        const sName = String((o as any).salesmanName || "");
        const sCode = String((o as any).salesmanCode || "");
        const customer = (o as any).customerName || "";
        for (const it of o.items || []) {
          const total = typeof it.total === 'number' ? it.total : (Number(it.quantity||0) * Number(it.unitPrice||0) * (1 - Number(it.discount||0)/100) * (1 + Number(it.tax||0)/100));
          rows.push([
            date,
            o.orderNo,
            sName,
            sCode,
            customer,
            it.productName,
            String(it.quantity),
            String(it.unitPrice),
            String(it.discount),
            String(it.tax),
            String(total),
          ]);
        }
      }
      const csv = [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `sales_details_${new Date().toISOString().slice(0,10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      // silent
    }
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Sales Reports</h1>
            <p className="text-muted-foreground">
              Analyze sales performance and trends
            </p>
          </div>
          <div className="flex gap-2">
            <Select value={granularity} onValueChange={(v: any) => setGranularity(v)}>
              <SelectTrigger className="w-[140px]"><SelectValue placeholder="Granularity" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">Daily</SelectItem>
                <SelectItem value="monthly">Monthly</SelectItem>
              </SelectContent>
            </Select>
            <Select value={range} onValueChange={(v: any) => setRange(v)}>
              <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="7days">Last 7 Days</SelectItem>
                <SelectItem value="30days">Last 30 Days</SelectItem>
                <SelectItem value="6months">Last 6 Months</SelectItem>
                <SelectItem value="1year">Last Year</SelectItem>
              </SelectContent>
            </Select>
            <Select value={salesmanFilter} onValueChange={setSalesmanFilter}>
              <SelectTrigger className="w-[170px]"><SelectValue placeholder="Salesman" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Salesmen</SelectItem>
                {Array.from(new Map(orders.map(o => [String((o as any).salesmanCode || ''), String((o as any).salesmanCode || '')] as const)).values())
                  .filter((c) => c && c !== 'undefined')
                  .map((code) => (
                    <SelectItem key={code} value={code}>{code}</SelectItem>
                  ))}
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={exportSalesDetails}>
              <Download className="mr-2 h-4 w-4" />
              Export
            </Button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <IndianRupee className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{formatCurrency(totalRevenue)}</p>
                  <p className="text-sm text-muted-foreground">Total Revenue</p>
                  <p className="text-xs text-primary">Trend</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-chart-1/10">
                  <ShoppingCart className="h-5 w-5 text-chart-1" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{totalOrders}</p>
                  <p className="text-sm text-muted-foreground">Total Orders</p>
                  <p className="text-xs text-primary">&nbsp;</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-chart-3/10">
                  <TrendingUp className="h-5 w-5 text-chart-3" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{formatCurrency(avgOrderValue)}</p>
                  <p className="text-sm text-muted-foreground">Avg. Order Value</p>
                  <p className="text-xs text-primary">&nbsp;</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-chart-4/10">
                  <Users className="h-5 w-5 text-chart-4" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{activeCustomers}</p>
                  <p className="text-sm text-muted-foreground">Active Customers</p>
                  <p className="text-xs text-primary">&nbsp;</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Charts Row */}
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Monthly Sales Trend</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <XAxis
                      dataKey="month"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                      tickFormatter={(value) => formatCurrency(Number(value))}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                      }}
                      formatter={(value: number) => [
                        formatCurrency(Number(value)),
                        "Sales",
                      ]}
                    />
                    <Bar dataKey="sales" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Revenue by Customer Type</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={revByType}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={2}
                      dataKey="revenue"
                      nameKey="type"
                    >
                      {revByType.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                      }}
                      formatter={(value: number) => [formatCurrency(Number(value)), "Revenue"]}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-4">
                {revByType.map((item, index) => (
                  <div key={item.type} className="flex items-center gap-2">
                    <div
                      className="h-3 w-3 rounded-full"
                      style={{ backgroundColor: COLORS[index] }}
                    />
                    <div>
                      <p className="text-sm font-medium">{item.type}</p>
                      <p className="text-xs text-muted-foreground">{item.percentage}%</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Top Products Table */}
        <Card>
          <CardHeader>
            <CardTitle>Top Selling Products</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Rank</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-right">Units Sold</TableHead>
                  <TableHead className="text-right">Revenue</TableHead>
                  <TableHead>Trend</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {topProducts.map((p, idx) => (
                  <TableRow key={p.productId}>
                    <TableCell>
                      <Badge variant="outline" className={idx === 0 ? "bg-primary/10 text-primary" : idx === 1 ? "bg-chart-1/10 text-chart-1" : idx === 2 ? "bg-chart-3/10 text-chart-3" : "bg-chart-4/10 text-chart-4"}>{idx + 1}</Badge>
                    </TableCell>
                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell>{p.category || "-"}</TableCell>
                    <TableCell className="text-right">{p.units.toLocaleString()}</TableCell>
                    <TableCell className="text-right">{formatCurrency(p.revenue)}</TableCell>
                    <TableCell>
                      <span className="text-primary">—</span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Product-wise Sales (Full) */}
        <Card>
          <CardHeader>
            <CardTitle>Product-wise Sales ({productStats.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto max-h-[380px] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead className="text-right">Units</TableHead>
                    <TableHead className="text-right">Revenue</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {productStats.map((p) => (
                    <TableRow key={p.productId}>
                      <TableCell className="font-medium">{p.name}</TableCell>
                      <TableCell>{p.category || '-'}</TableCell>
                      <TableCell className="text-right">{p.units.toLocaleString()}</TableCell>
                      <TableCell className="text-right">{formatCurrency(p.revenue)}</TableCell>
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

export default SalesReports;
