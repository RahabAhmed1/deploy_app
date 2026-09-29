import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatsCard } from "@/components/dashboard/StatsCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
    BarChart3,
    Search,
    Download,
    Package,
    AlertTriangle,
    Clock,
    TrendingUp,
    Filter,
    Calendar,
    ArrowUpRight,
    MapPin,
    History,
    Boxes
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { getProducts, getStockMovements } from "@/lib/api";
import { toast } from "sonner";

const StockReports = () => {
    const [searchTerm, setSearchTerm] = useState("");
    const [categoryFilter, setCategoryFilter] = useState("all");
    const [expiryFilter, setExpiryFilter] = useState("all");
    const [stockLevelFilter, setStockLevelFilter] = useState("all");

    const [items, setItems] = useState<Array<{
        id: string;
        productId: string;
        name: string;
        category: string;
        batch: string;
        currentStock: number;
        unit: string;
        rate: number;
        value: number;
        expiry: string;
        location: string;
        status: "in-stock" | "low-stock" | "out-of-stock" | "near-expiry";
    }>>([]);
    const [lastMoveMap, setLastMoveMap] = useState<Map<string, number>>(new Map());

    useEffect(() => {
        const load = async () => {
            try {
                const [prodRes, moveRes] = await Promise.all([getProducts(), getStockMovements()]);
                const products = (prodRes?.products || []) as Array<any>;
                const movements = (moveRes?.movements || []) as Array<any>;

                const lastMove = new Map<string, number>();
                for (const m of movements) {
                    const pid = String(m.productId || "");
                    const ts = m.date ? Date.parse(m.date) : NaN;
                    if (!pid || !Number.isFinite(ts)) continue;
                    const prev = lastMove.get(pid) || 0;
                    if (ts > prev) lastMove.set(pid, ts);
                }

                const withinDays = (dateStr?: string, days = 90) => {
                    if (!dateStr) return false;
                    const t = Date.parse(dateStr);
                    if (!Number.isFinite(t)) return false;
                    const now = Date.now();
                    const diff = t - now;
                    return diff >= 0 && diff <= days * 24 * 60 * 60 * 1000;
                };

                const mapped = products.map((p: any) => {
                    const qty = Number(p.stockQuantity || 0);
                    const min = Number(p.minStockLevel || 0);
                    const rate = Number(p.purchasePrice || 0);
                    const expiry = p.expiryDate || "";
                    let status: "in-stock" | "low-stock" | "out-of-stock" | "near-expiry" = "in-stock";
                    if (qty === 0) status = "out-of-stock";
                    else if (withinDays(expiry, 90)) status = "near-expiry";
                    else if (qty <= min) status = "low-stock";
                    return {
                        id: String(p.id),
                        productId: String(p.id),
                        name: p.name || "",
                        category: p.category || "",
                        batch: p.batchNo || "",
                        currentStock: qty,
                        unit: p.unit || "Units",
                        rate,
                        value: Math.max(0, qty * rate),
                        expiry: expiry || "",
                        location: "-",
                        status,
                    };
                });

                setItems(mapped);
                setLastMoveMap(lastMove);
            } catch (e: any) {
                console.error(e);
                toast.error(e?.message || "Failed to load stock report");
            }
        };
        load();
    }, []);

    const getStatusStyle = (status: string) => {
        switch (status) {
            case "in-stock": return "bg-[#10b981]/10 text-[#10b981] border-[#10b981]/20";
            case "low-stock": return "bg-amber-100 text-amber-700 border-amber-200";
            case "out-of-stock": return "bg-red-100 text-red-700 border-red-200";
            case "near-expiry": return "bg-orange-100 text-orange-700 border-orange-200";
            default: return "bg-neutral-100 text-neutral-600";
        }
    };

    const filtered = useMemo(() => {
        const term = searchTerm.trim().toLowerCase();
        const expDays = expiryFilter === "all" ? 0 : Number(expiryFilter || "0");
        const now = Date.now();
        return items.filter((it) => {
            if (term) {
                const hay = `${it.name} ${it.category} ${it.batch}`.toLowerCase();
                if (!hay.includes(term)) return false;
            }
            if (categoryFilter !== "all" && it.category !== categoryFilter) return false;
            if (expDays && expDays > 0) {
                const t = it.expiry ? Date.parse(it.expiry) : NaN;
                const within = Number.isFinite(t) && t - now >= 0 && t - now <= expDays * 24 * 60 * 60 * 1000;
                if (!within) return false;
            }
            if (stockLevelFilter !== "all") {
                if (stockLevelFilter === "crit" && it.currentStock !== 0) return false;
                if (stockLevelFilter === "low" && it.status !== "low-stock") return false;
                if (stockLevelFilter === "surp" && !(it.currentStock > 0 && it.status === "in-stock")) return false;
                if (stockLevelFilter === "dead") {
                    const last = lastMoveMap.get(it.productId) || 0;
                    const cutoff = Date.now() - 180 * 24 * 60 * 60 * 1000;
                    const isDead = last === 0 || last < cutoff;
                    if (!isDead) return false;
                }
            }
            return true;
        });
    }, [items, searchTerm, categoryFilter, expiryFilter, stockLevelFilter]);

    const categories = useMemo(() => Array.from(new Set(items.map((p) => p.category).filter(Boolean))), [items]);
    const totalStockValue = useMemo(() => items.reduce((s, it) => s + (Number(it.value) || 0), 0), [items]);
    const lowStockCount = useMemo(() => items.filter((it) => it.status === "low-stock" || it.currentStock === 0).length, [items]);
    const nearExpiryCount = useMemo(() => items.filter((it) => it.status === "near-expiry").length, [items]);
    const deadInactiveValue = useMemo(() => {
        const cutoff = Date.now() - 180 * 24 * 60 * 60 * 1000;
        let sum = 0;
        for (const it of items) {
            const last = lastMoveMap.get(it.productId) || 0;
            if (last === 0 || last < cutoff) {
                sum += Number(it.value) || 0;
            }
        }
        return sum;
    }, [items, lastMoveMap]);

    const exportDetailedReport = () => {
        try {
            const headers = [
                "Product",
                "Category",
                "Batch",
                "Available Stock",
                "Unit",
                "Rate",
                "Stock Value",
                "Expiry",
                "Status",
                "Last Movement",
            ];

            const rows = filtered.map((it) => {
                const last = lastMoveMap.get(it.productId) || 0;
                const lastStr = last ? new Date(last).toISOString().slice(0, 10) : "-";
                return [
                    it.name,
                    it.category,
                    it.batch,
                    String(it.currentStock),
                    it.unit,
                    String(it.rate),
                    String(it.value),
                    it.expiry,
                    it.status,
                    lastStr,
                ];
            });

            const csv = [headers, ...rows]
                .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))
                .join("\n");
            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `stock_detailed_${new Date().toISOString().slice(0, 10)}.csv`;
            a.click();
            URL.revokeObjectURL(url);
        } catch (e: any) {
            console.error(e);
            toast.error(e?.message || "Failed to export report");
        }
    };

    return (
        <MainLayout>
            <div className="space-y-6">
                {/* Header */}
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <h1 className="text-3xl font-bold text-foreground">Stock & Inventory Report</h1>
                        <p className="text-muted-foreground">
                            Analyze inventory levels, batch status, and warehouse valuation
                        </p>
                    </div>
                    <div className="flex gap-3">
                        <Button variant="outline" className="h-10 text-xs">
                            <History className="mr-2 h-4 w-4" /> Movement Logs
                        </Button>
                        <Button className="h-10" onClick={exportDetailedReport}>
                            <Download className="mr-2 h-4 w-4" /> Export Detailed Report
                        </Button>
                    </div>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <StatsCard
                        title="Total Stock Value"
                        value={`Rs ${totalStockValue.toLocaleString()}`}
                        trend={{ value: 0, isPositive: true }}
                        icon={TrendingUp}
                        variant="primary"
                    />
                    <StatsCard
                        title="Low Stock Items"
                        value={String(lowStockCount)}
                        subtitle="Including critical zero stock"
                        icon={Boxes}
                        variant="warning"
                    />
                    <StatsCard
                        title="Near Expiry"
                        value={String(nearExpiryCount)}
                        subtitle="Expiring in 90 days"
                        icon={Clock}
                        variant="warning"
                    />
                    <StatsCard
                        title="Dead/Inactive Stock"
                        value={`Rs ${deadInactiveValue.toLocaleString()}`}
                        subtitle="No movement in 180 days"
                        icon={AlertTriangle}
                        variant="danger"
                    />
                </div>

                {/* Filter Bar */}
                <Card>
                    <CardContent className="p-4">
                        <div className="flex flex-col md:flex-row gap-4">
                            <div className="relative flex-1">
                                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                <Input
                                    placeholder="Search by Product Name, Batch, or SKU..."
                                    className="pl-10"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>
                            <div className="flex flex-wrap gap-3">
                                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                                    <SelectTrigger className="w-[160px]">
                                        <Filter className="mr-2 h-3 w-3 text-muted-foreground" />
                                        <SelectValue placeholder="Category" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All Categories</SelectItem>
                                        {categories.map((c) => (
                                            <SelectItem key={c} value={c}>{c}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>

                                <Select value={expiryFilter} onValueChange={setExpiryFilter}>
                                    <SelectTrigger className="w-[160px]">
                                        <Calendar className="mr-2 h-3 w-3 text-muted-foreground" />
                                        <SelectValue placeholder="Expiry Range" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All Expiry</SelectItem>
                                        <SelectItem value="30">Next 30 Days</SelectItem>
                                        <SelectItem value="60">Next 60 Days</SelectItem>
                                        <SelectItem value="90">Next 90 Days</SelectItem>
                                        <SelectItem value="180">Next 180 Days</SelectItem>
                                    </SelectContent>
                                </Select>

                                <Select value={stockLevelFilter} onValueChange={setStockLevelFilter}>
                                    <SelectTrigger className="w-[160px]">
                                        <Package className="mr-2 h-3 w-3 text-muted-foreground" />
                                        <SelectValue placeholder="Stock Level" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">Any Level</SelectItem>
                                        <SelectItem value="crit">Critical Only</SelectItem>
                                        <SelectItem value="low">Low Stock</SelectItem>
                                        <SelectItem value="surp">Surplus</SelectItem>
                                        <SelectItem value="dead">Dead / Inactive</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Report Table */}
                <Card>
                    <CardHeader>
                        <CardTitle>Inventory Health Report</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Product & Category</TableHead>
                                        <TableHead>Batch & SKU</TableHead>
                                        <TableHead className="text-center">Available Stock</TableHead>
                                        <TableHead className="text-right">Valuation</TableHead>
                                        <TableHead>Expiry Status</TableHead>
                                        <TableHead>Location</TableHead>
                                        <TableHead>Last Movement</TableHead>
                                        <TableHead>Status</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filtered.map((item) => (
                                        <TableRow key={item.id}>
                                            <TableCell>
                                                <div>
                                                    <p className="font-medium text-foreground">{item.name}</p>
                                                    <Badge variant="outline" className="text-[10px] h-4 py-0 font-medium">
                                                        {item.category}
                                                    </Badge>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="space-y-0.5 font-mono text-xs uppercase tracking-tighter">
                                                    {item.batch}
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-center">
                                                <div className="space-y-0.5">
                                                    <span className={cn(
                                                        "text-sm font-medium",
                                                        item.currentStock === 0 ? "text-red-600" : "text-foreground"
                                                    )}>
                                                        {item.currentStock}
                                                    </span>
                                                    <p className="text-[10px] text-muted-foreground uppercase">{item.unit}</p>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-right font-medium">
                                                Rs {Number(item.value || 0).toLocaleString()}
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex flex-col gap-1">
                                                    <span className={cn(
                                                        "text-xs font-medium",
                                                        item.status === "near-expiry" ? "text-orange-600 font-bold" : "text-muted-foreground"
                                                    )}>
                                                    {item.expiry}
                                                    </span>
                                                    <div className="h-1 w-16 bg-neutral-100 rounded-full overflow-hidden">
                                                        <div
                                                            className={cn(
                                                                "h-full rounded-full",
                                                                item.status === "near-expiry" ? "bg-orange-500 w-2/3" : "bg-[#10b981] w-full"
                                                            )}
                                                        />
                                                    </div>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                                    <MapPin className="h-3 w-3" />
                                                    {item.location}
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-xs text-muted-foreground">
                                                {(function(){
                                                    const last = lastMoveMap.get(item.productId) || 0;
                                                    return last ? new Date(last).toISOString().slice(0, 10) : "-";
                                                })()}
                                            </TableCell>
                                            <TableCell>
                                                <Badge className={cn("px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider", getStatusStyle(item.status))}>
                                                    {item.status.replace("-", " ")}
                                                </Badge>
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

export default StockReports;
