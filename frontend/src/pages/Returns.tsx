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
import { DateField } from "@/components/ui/date-field";
import {
    Plus,
    Search,
    AlertTriangle,
    CheckCircle2,
    Clock,
    ArrowLeftRight,
    SearchCode,
    Filter,
    Calendar,
    User,
    ClipboardList,
    ShieldAlert,
    PackageSearch,
    Undo2,
    Truck
} from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { getReturns, createReturn, updateReturnStatus, getInvoiceByNumber, getUsers } from "@/lib/api";
import { toast } from "sonner";

type ReturnSummary = {
    id: string;
    date: string;
    customer: string;
    invoiceNo: string;
    reason: string;
    itemsCount: number;
    value: number;
    status: "pending" | "verified" | "refunded" | "rejected";
    condition: string;
    assigned?: string;
};

const Returns = () => {
    const [searchTerm, setSearchTerm] = useState("");
    const [dialogOpen, setDialogOpen] = useState(false);
    const [saving, setSaving] = useState(false);
    const [returnList, setReturnList] = useState<ReturnSummary[]>([]);
    const [viewOpen, setViewOpen] = useState(false);
    const [viewReturn, setViewReturn] = useState<ReturnSummary | null>(null);
    const [invoice, setInvoice] = useState<any | null>(null);
    const [returnLines, setReturnLines] = useState<Array<{ productId: string; productName: string; batchNo: string; originalQty: number; unitPrice: number; discount: number; tax: number; returnQty: string }>>([]);
    const [staff, setStaff] = useState<Array<{ id: string; username: string }>>([]);

    const [form, setForm] = useState({
        invoiceNo: "",
        customer: "",
        reason: "",
        condition: "",
        itemsCount: "",
        value: "",
        date: new Date().toISOString().split("T")[0],
        notes: "",
        pickupWindow: "",
        assigned: "",
    });

    const itemsCount = returnLines.reduce((s, l) => s + (Number(l.returnQty) || 0), 0);
    const totalValue = returnLines.reduce((s, l) => {
        const rq = Number(l.returnQty) || 0;
        const base = rq * (Number(l.unitPrice) || 0);
        const afterDisc = base * (1 - (Number(l.discount) || 0) / 100);
        const withTax = afterDisc * (1 + (Number(l.tax) || 0) / 100);
        return s + withTax;
    }, 0);

    const handleSearchInvoice = async () => {
        if (!form.invoiceNo) {
            toast.error("Enter an Invoice No.");
            return;
        }
        try {
            const res = await getInvoiceByNumber(form.invoiceNo);
            const inv = res?.invoice || res;
            if (!inv) throw new Error("Invoice not found");
            setInvoice(inv);
            setForm(s => ({ ...s, customer: inv.customerName || s.customer }));
            setReturnLines((inv.items || []).map((it: any) => ({
                productId: String(it.productId || ""),
                productName: it.productName || "",
                batchNo: it.batchNo || "",
                originalQty: Number(it.quantity) || 0,
                unitPrice: Number(it.unitPrice) || 0,
                discount: Number(it.discount) || 0,
                tax: Number(it.tax) || 0,
                returnQty: "",
            })));
        } catch (e: any) {
            const msg = e?.message || 'Failed to fetch invoice';
            toast.error(msg);
            setInvoice(null);
            setReturnLines([]);
        }
    };

    const loadReturns = async () => {
        try {
            const res = await getReturns();
            const data: ReturnSummary[] = ((res?.returns ?? res) || []).map((r: any) => ({
                id: String(r.id ?? r.returnId ?? r.code ?? ""),
                date: r.date || (r.createdAt ? String(r.createdAt).slice(0,10) : ""),
                customer: r.customerName ?? r.customer ?? "",
                invoiceNo: r.invoiceNo ?? r.invoice ?? "",
                reason: r.reason ?? "",
                itemsCount: Number(r.itemsCount ?? (Array.isArray(r.items) ? r.items.length : 0)),
                value: typeof r.value === "number" ? r.value : Number(r.value ?? r.amount ?? 0),
                status: (r.status ?? "pending").toLowerCase(),
                condition: r.condition ?? "",
                assigned: r.assigned ?? "",
            }));
            setReturnList(data);
        } catch (e) {
            console.error(e);
            toast.error("Failed to load returns from server");
        }
    };

    useEffect(() => { loadReturns(); }, []);
    useEffect(() => {
        (async () => {
            try {
                const res = await getUsers();
                const list = ((res?.users ?? res) || []).map((u: any) => ({ id: String(u.id), username: u.username || "" }));
                setStaff(list);
            } catch (e) {
                // ignore silently
            }
        })();
    }, []);

    const statusStyles: Record<string, string> = {
        pending: "bg-amber-100 text-amber-700 border-amber-200",
        verified: "bg-blue-100 text-blue-700 border-blue-200",
        refunded: "bg-[#10b981]/10 text-[#10b981] border-[#10b981]/20",
        rejected: "bg-red-100 text-red-700 border-red-200"
    };

    return (
        <MainLayout>
            <div className="space-y-6">
                {/* Header */}
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <h1 className="text-3xl font-bold text-foreground">Customer Returns</h1>
                        <p className="text-muted-foreground">
                            Process product returns, manage replacements, and issue credit notes
                        </p>
                    </div>
                    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                        <DialogTrigger asChild>
                            <Button className="bg-[#10b981] hover:bg-[#059669] text-white" onClick={() => setDialogOpen(true)}>
                                <Plus className="mr-2 h-4 w-4" /> New Customer Return
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-[850px] h-[90vh] p-0 flex flex-col">
                            <DialogHeader className="p-6 pb-2">
                                <DialogTitle>Initiate Customer Return</DialogTitle>
                                <DialogDescription>Register a new return request for a customer invoice.</DialogDescription>
                            </DialogHeader>
                            <ScrollArea className="flex-1 px-6 pb-6">
                                <div className="space-y-8 py-4">
                                    {/* Section 1: Source Selection */}
                                    <div className="space-y-4">
                                        <div className="flex items-center gap-2 text-[#10b981] font-semibold border-b pb-2">
                                            <SearchCode className="h-4 w-4" />
                                            <span className="text-sm">Source Reference</span>
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <Label className="text-xs">Original Invoice No.</Label>
                                                <div className="flex gap-2">
                                                    <Input placeholder="Search INV-XXX" className="bg-neutral-50 border-none h-9 text-xs flex-1" value={form.invoiceNo} onChange={(e) => setForm(s => ({ ...s, invoiceNo: e.target.value }))} />
                                                    <Button variant="outline" size="sm" className="h-9" onClick={handleSearchInvoice}>Search</Button>
                                                </div>
                                            </div>
                                            <div className="space-y-2">
                                                <Label className="text-xs">Customer Name</Label>
                                                <Input placeholder="Search for customer" className="bg-neutral-50 border-none h-9 text-xs" value={form.customer} onChange={(e) => setForm(s => ({ ...s, customer: e.target.value }))} />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Section 2: Product & Batch Selection */}
                                    <div className="space-y-4">
                                        <div className="flex items-center justify-between border-b pb-2">
                                            <div className="flex items-center gap-2 text-[#10b981] font-semibold">
                                                <PackageSearch className="h-4 w-4" />
                                                <span className="text-sm">Select Items to Return</span>
                                            </div>
                                        </div>
                                        <div className="rounded-lg border bg-neutral-50/30 overflow-hidden">
                                            <Table>
                                                <TableHeader className="bg-neutral-50">
                                                    <TableRow className="h-10 text-[10px] font-bold uppercase">
                                                        <TableHead className="w-[40%]">Product Details</TableHead>
                                                        <TableHead>Batch No.</TableHead>
                                                        <TableHead className="text-center">Orig. Qty</TableHead>
                                                        <TableHead className="text-center">Ret. Qty</TableHead>
                                                        <TableHead className="text-right pr-4">Amount</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {returnLines.length === 0 && (
                                                        <TableRow>
                                                            <TableCell colSpan={5} className="text-center text-xs text-muted-foreground">Enter an invoice number and click Search to load items.</TableCell>
                                                        </TableRow>
                                                    )}
                                                    {returnLines.map((line, idx) => {
                                                        const rqNum = Number(line.returnQty) || 0;
                                                        const base = rqNum * (Number(line.unitPrice) || 0);
                                                        const afterDisc = base * (1 - (Number(line.discount) || 0) / 100);
                                                        const withTax = afterDisc * (1 + (Number(line.tax) || 0) / 100);
                                                        return (
                                                            <TableRow key={idx} className="h-12">
                                                                <TableCell className="text-xs font-medium">{line.productName}</TableCell>
                                                                <TableCell className="text-xs uppercase font-mono tracking-tighter">{line.batchNo}</TableCell>
                                                                <TableCell className="text-xs text-center">{line.originalQty}</TableCell>
                                                                <TableCell className="text-center">
                                                                    <Input type="number" min={0} max={line.originalQty}
                                                                        value={line.returnQty}
                                                                        onChange={(e) => {
                                                                            const v = e.target.value;
                                                                            setReturnLines(ls => ls.map((l, i) => i === idx ? { ...l, returnQty: v } : l));
                                                                        }}
                                                                        className="h-7 w-16 text-center mx-auto text-xs" />
                                                                </TableCell>
                                                                <TableCell className="text-right text-xs font-bold pr-4">Rs {withTax.toLocaleString()}</TableCell>
                                                            </TableRow>
                                                        );
                                                    })}
                                                </TableBody>
                                            </Table>
                                        </div>
                                    </div>

                                    {/* Section 3: Reason & Condition */}
                                    <div className="space-y-4">
                                        <div className="flex items-center gap-2 text-[#10b981] font-semibold border-b pb-2">
                                            <ShieldAlert className="h-4 w-4" />
                                            <span className="text-sm">Reason & Condition Analysis</span>
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <Label className="text-xs">Primary Reason for Return</Label>
                                                <Select value={form.reason} onValueChange={(v) => setForm(s => ({ ...s, reason: v }))}>
                                                    <SelectTrigger className="bg-neutral-50 border-none h-9 text-xs">
                                                        <SelectValue placeholder="Choose reason" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="expiry">Expiry within 6 months</SelectItem>
                                                        <SelectItem value="damaged">Damaged in Transit</SelectItem>
                                                        <SelectItem value="wrong">Wrong Product Dispatched</SelectItem>
                                                        <SelectItem value="recall">Mandatory Recall</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div className="space-y-2">
                                                <Label className="text-xs">Physical Condition</Label>
                                                <Select value={form.condition} onValueChange={(v) => setForm(s => ({ ...s, condition: v }))}>
                                                    <SelectTrigger className="bg-neutral-50 border-none h-9 text-xs">
                                                        <SelectValue placeholder="Condition type" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="seal">Sea Intact / Unopened</SelectItem>
                                                        <SelectItem value="loose">Loose / Partial Packing</SelectItem>
                                                        <SelectItem value="leak">Leaking / Breakage</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div className="space-y-2 col-span-1 md:col-span-2">
                                                <Label className="text-xs">Issue Description / QC Notes</Label>
                                                <Textarea placeholder="Describe the reason for return in detail..." className="bg-neutral-50 border-none resize-none h-20 text-xs" value={form.notes} onChange={(e) => setForm(s => ({ ...s, notes: e.target.value }))} />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Section 4: Resolution & Logistics */}
                                    <div className="space-y-4">
                                        <div className="flex items-center gap-2 text-[#10b981] font-semibold border-b pb-2">
                                            <Undo2 className="h-4 w-4" />
                                            <span className="text-sm">Resolution & Pickup Logistics</span>
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <Label className="text-xs">Resolution Type</Label>
                                                <div className="flex gap-4 pt-1">
                                                    <div className="flex items-center space-x-2">
                                                        <input type="radio" name="res" id="cn" className="accent-[#10b981]" />
                                                        <Label htmlFor="cn" className="text-xs font-medium cursor-pointer">Credit Note</Label>
                                                    </div>
                                                    <div className="flex items-center space-x-2">
                                                        <input type="radio" name="res" id="rep" className="accent-[#10b981]" />
                                                        <Label htmlFor="rep" className="text-xs font-medium cursor-pointer">Replacement</Label>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="space-y-2">
                                                <Label className="text-xs">Pickup Required?</Label>
                                                <div className="flex gap-4 pt-1">
                                                    <div className="flex items-center space-x-2">
                                                        <input type="radio" name="pick" id="py" className="accent-[#10b981]" />
                                                        <Label htmlFor="py" className="text-xs font-medium cursor-pointer">Yes</Label>
                                                    </div>
                                                    <div className="flex items-center space-x-2">
                                                        <input type="radio" name="pick" id="pn" className="accent-[#10b981]" />
                                                        <Label htmlFor="pn" className="text-xs font-medium cursor-pointer">No (Customer Sent)</Label>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                            <div className="space-y-2">
                                                <Label className="text-xs">Expected Value</Label>
                                                <Input readOnly value={`Rs ${Number(totalValue || 0).toLocaleString()}`} placeholder="Rs 0.00" className="bg-neutral-50 border-none h-11 text-lg font-bold text-[#10b981]" />
                                            </div>
                                            <div className="space-y-2">
                                                <Label className="text-xs">Pickup Window</Label>
                                                <DateField
                                                    value={form.pickupWindow}
                                                    onChange={(v) => setForm(s => ({ ...s, pickupWindow: v }))}
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <Label className="text-xs">Assigned Executive</Label>
                                                <Select value={form.assigned} onValueChange={(v) => setForm(s => ({ ...s, assigned: v }))}>
                                                    <SelectTrigger className="bg-neutral-50 border-none h-11 text-xs">
                                                        <SelectValue placeholder="Select staff" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {staff.length === 0 ? (
                                                            <SelectItem value="" disabled>No staff found</SelectItem>
                                                        ) : (
                                                            staff.map((u) => (
                                                                <SelectItem key={u.id} value={u.username}>{u.username}</SelectItem>
                                                            ))
                                                        )}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </ScrollArea>
                            <div className="p-6 pt-2 border-t flex justify-end gap-3 bg-white rounded-b-lg">
                                <Button variant="outline" className="text-xs h-9 px-6" onClick={() => setDialogOpen(false)}>Cancel</Button>
                                <Button className="bg-[#10b981] hover:bg-[#059669] text-white text-xs h-9 px-6 font-semibold" disabled={saving} onClick={async () => {
                                    if (saving) return;
                                    if (!form.invoiceNo || !form.reason) {
                                        toast.error("Please fill required fields: Invoice No. and Reason");
                                        return;
                                    }
                                    const items = returnLines
                                        .map(l => ({ productId: l.productId, returnQty: Number(l.returnQty) || 0 }))
                                        .filter(it => it.returnQty > 0);
                                    if (items.length === 0) {
                                        toast.error("Enter return quantity for at least one item");
                                        return;
                                    }
                                    setSaving(true);
                                    try {
                                        const payload = {
                                            invoiceNo: form.invoiceNo,
                                            customer: form.customer || invoice?.customerName || "",
                                            reason: form.reason,
                                            condition: form.condition,
                                            items,
                                            date: form.date,
                                            notes: form.notes,
                                            pickupWindow: form.pickupWindow,
                                            assigned: form.assigned,
                                        };
                                        await createReturn(payload);
                                        toast.success("Return request submitted");
                                        setDialogOpen(false);
                                        setForm({ invoiceNo: "", customer: "", reason: "", condition: "", itemsCount: "", value: "", date: new Date().toISOString().split("T")[0], notes: "", pickupWindow: "", assigned: "" });
                                        setInvoice(null);
                                        setReturnLines([]);
                                        await loadReturns();
                                    } catch (err: any) {
                                        console.error(err);
                                        const msg = typeof err?.message === 'string' ? err.message : 'Failed to submit return request';
                                        toast.error(msg);
                                    } finally { setSaving(false); }
                                }}>{saving ? "Submitting..." : "Submit Customer Return"}</Button>
                            </div>
                        </DialogContent>
                    </Dialog>
                </div>

                <Dialog open={viewOpen} onOpenChange={setViewOpen}>
                    <DialogContent className="sm:max-w-[700px]">
                        <DialogHeader>
                            <DialogTitle>Return Details</DialogTitle>
                            <DialogDescription>View return request information</DialogDescription>
                        </DialogHeader>
                        {viewReturn && (
                            <div className="grid gap-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <p className="text-xs text-muted-foreground">Return ID</p>
                                        <p className="font-medium">{viewReturn.id}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-muted-foreground">Date</p>
                                        <p className="font-medium">{viewReturn.date}</p>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <p className="text-xs text-muted-foreground">Customer</p>
                                        <p className="font-medium">{viewReturn.customer}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-muted-foreground">Invoice No.</p>
                                        <p className="font-medium">{viewReturn.invoiceNo}</p>
                                    </div>
                                </div>
                                <div className="grid grid-cols-3 gap-4">
                                    <div>
                                        <p className="text-xs text-muted-foreground">Items</p>
                                        <p className="font-medium">{viewReturn.itemsCount}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-muted-foreground">Value</p>
                                        <p className="font-semibold">Rs {viewReturn.value.toLocaleString()}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-muted-foreground">Status</p>
                                        <Badge variant="outline" className="capitalize">{viewReturn.status}</Badge>
                                    </div>
                                </div>
                                <div>
                                    <p className="text-xs text-muted-foreground">Reason</p>
                                    <p className="font-medium">{viewReturn.reason}</p>
                                </div>
                                <div>
                                    <p className="text-xs text-muted-foreground">Condition</p>
                                    <p className="font-medium">{viewReturn.condition}</p>
                                </div>
                            </div>
                        )}
                        <div className="flex justify-end">
                            <Button variant="outline" onClick={() => setViewOpen(false)}>Close</Button>
                        </div>
                    </DialogContent>
                </Dialog>

                {/* Stats Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <StatsCard
                        title="Total Returns"
                        value={`${returnList.length}`}
                        subtitle="2.4% Return Rate"
                        icon={Undo2}
                        variant="primary"
                    />
                    <StatsCard
                        title="Pending QC"
                        value={`${returnList.filter(r => r.status === 'pending').length}`}
                        subtitle="8 Critical verified"
                        icon={ShieldAlert}
                        variant="warning"
                    />
                    <StatsCard
                        title="Verified/Approved"
                        value={`${returnList.filter(r => r.status === 'verified').length}`}
                        subtitle="Credit Notes Pending"
                        icon={CheckCircle2}
                    />
                    <StatsCard
                        title="Rejected"
                        value={`${returnList.filter(r => r.status === 'rejected').length}`}
                        subtitle="Policy mismatch"
                        icon={AlertTriangle}
                        variant="danger"
                    />
                </div>

                {/* Return Table */}
                <Card>
                    <CardHeader>
                        <CardTitle>Customer Return Requests</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Return ID & Date</TableHead>
                                        <TableHead>Customer & Reference</TableHead>
                                        <TableHead>Reason Category</TableHead>
                                        <TableHead className="text-right">Items & Value</TableHead>
                                        <TableHead className="text-center">Condition</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead className="text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {returnList
                                        .filter((r) => {
                                            const q = searchTerm.toLowerCase();
                                            return r.customer.toLowerCase().includes(q) || r.id.toLowerCase().includes(q) || r.invoiceNo.toLowerCase().includes(q);
                                        })
                                        .map((ret) => (
                                        <TableRow key={ret.id}>
                                            <TableCell>
                                                <div className="space-y-1">
                                                    <p className="font-medium text-foreground text-primary uppercase">{ret.id}</p>
                                                    <div className="text-[10px] text-muted-foreground flex items-center gap-1 uppercase">
                                                        <Calendar className="h-3 w-3" /> {ret.date}
                                                    </div>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="space-y-1">
                                                    <p className="font-medium text-foreground">{ret.customer}</p>
                                                    <p className="text-[10px] text-muted-foreground uppercase">{ret.invoiceNo}</p>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-2">
                                                    <AlertTriangle className="h-3 w-3 text-amber-500" />
                                                    <span className="text-xs text-muted-foreground">{ret.reason}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <div className="space-y-0.5">
                                                    <p className="text-sm font-bold">Rs {ret.value.toLocaleString()}</p>
                                                    <p className="text-[10px] text-muted-foreground uppercase">{ret.itemsCount} Items</p>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-center">
                                                <Badge variant="outline" className="text-[10px] h-4 py-0 font-medium">
                                                    {ret.condition}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>
                                                <Badge className={cn("px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider", statusStyles[ret.status])}>
                                                    {ret.status}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex justify-end gap-2">
                                                    <Button variant="ghost" size="icon" onClick={() => { setViewReturn(ret); setViewOpen(true); }}>
                                                        <Search className="h-4 w-4" />
                                                    </Button>
                                                    <Button variant="ghost" size="icon" onClick={async () => {
                                                        try {
                                                            await updateReturnStatus(ret.id, 'verified');
                                                            toast.success('Marked verified');
                                                            await loadReturns();
                                                        } catch (err) {
                                                            console.error(err);
                                                            toast.error('Failed to update status');
                                                        }
                                                    }}>
                                                        <CheckCircle2 className="h-4 w-4 text-primary" />
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

export default Returns;

interface SeparatorProps {
    className?: string;
}

const Separator = ({ className }: SeparatorProps) => (
    <div className={cn("h-[1px] w-full bg-border", className)} />
);
