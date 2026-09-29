import { useEffect, useMemo, useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { getExpenses, createExpense, deleteExpense } from "@/lib/api";
import { formatCurrency } from "@/lib/currency";
import { Plus, Trash2, Download, Calendar, Banknote, CreditCard, Smartphone, FileText } from "lucide-react";
import { toast } from "sonner";
import { DateField } from "@/components/ui/date-field";

const methodOptions = [
  { value: "cash", label: "Cash", icon: Banknote },
  { value: "bank", label: "Bank", icon: CreditCard },
  { value: "cheque", label: "Cheque", icon: FileText },
  { value: "upi", label: "UPI", icon: Smartphone },
  { value: "other", label: "Other", icon: FileText },
] as const;

const presetRanges = [
  { key: "today", label: "Today" },
  { key: "week", label: "This Week" },
  { key: "month", label: "This Month" },
  { key: "all", label: "All" },
] as const;

const defaultCategories = [
  "Utilities",
  "Rent",
  "Salaries",
  "Logistics",
  "Maintenance",
  "Miscellaneous",
];

export default function Expenses() {
  const [expenses, setExpenses] = useState<Array<{ id: string; date: string; category: string; description: string; amount: number; method: string; reference: string }>>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [preset, setPreset] = useState<(typeof presetRanges)[number]["key"]>("today");
  const [from, setFrom] = useState<string>(new Date().toISOString().slice(0,10));
  const [to, setTo] = useState<string>(new Date().toISOString().slice(0,10));
  const [form, setForm] = useState({ date: new Date().toISOString().slice(0,10), category: "", amount: "", method: "cash", reference: "", description: "" });

  const effectiveRange = useMemo(() => {
    const today = new Date();
    const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const endOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
    if (preset === "all") return { from: undefined as Date | undefined, to: undefined as Date | undefined };
    if (preset === "today") return { from: startOfDay(today), to: endOfDay(today) };
    if (preset === "week") {
      const start = new Date(today.getTime() - 6 * 24 * 60 * 60 * 1000);
      return { from: startOfDay(start), to: endOfDay(today) };
    }
    if (preset === "month") {
      const start = new Date(today.getFullYear(), today.getMonth(), 1);
      return { from: startOfDay(start), to: endOfDay(today) };
    }
    // custom via inputs
    return { from: from ? new Date(from) : undefined, to: to ? endOfDay(new Date(to)) : undefined };
  }, [preset, from, to]);

  const load = async () => {
    try {
      const params: any = {};
      if (effectiveRange.from) params.from = effectiveRange.from.toISOString().slice(0,10);
      if (effectiveRange.to) params.to = effectiveRange.to.toISOString().slice(0,10);
      const res = await getExpenses(params);
      setExpenses((res?.expenses || []) as any[]);
    } catch (e) {
      console.error(e);
      toast.error("Failed to load expenses");
    }
  };

  useEffect(() => { load(); }, [preset, from, to]);

  const totals = useMemo(() => {
    const total = expenses.reduce((s, e) => s + (Number(e.amount) || 0), 0);
    const today = new Date().toISOString().slice(0,10);
    const todayTotal = expenses.filter(e => e.date === today).reduce((s, e) => s + (Number(e.amount) || 0), 0);
    return { total, todayTotal };
  }, [expenses]);

  const onSave = async () => {
    if (saving) return;
    if (!form.category) { toast.error("Select a category"); return; }
    if (!Number(form.amount)) { toast.error("Enter valid amount"); return; }
    setSaving(true);
    try {
      await createExpense({
        date: form.date,
        category: form.category,
        amount: Number(form.amount),
        method: form.method,
        reference: form.reference,
        description: form.description,
      });
      setDialogOpen(false);
      setForm({ date: new Date().toISOString().slice(0,10), category: "", amount: "", method: "cash", reference: "", description: "" });
      await load();
      toast.success("Expense recorded");
    } catch (e: any) {
      toast.error(e?.message || "Failed to save expense");
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async (id: string) => {
    try {
      await deleteExpense(id);
      await load();
    } catch (e) {
      toast.error("Failed to delete expense");
    }
  };

  const exportCsv = () => {
    const headers = ["Date", "Category", "Description", "Amount", "Method", "Reference"];
    const rows = expenses.map(e => [e.date, e.category, e.description || "", String(e.amount), e.method, e.reference || ""]);
    const csv = [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `expenses_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Expenses</h1>
            <p className="text-muted-foreground">Record operational expenses and cash outflows</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={exportCsv}><Download className="mr-2 h-4 w-4" />Export</Button>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={() => setDialogOpen(true)}><Plus className="mr-2 h-4 w-4" />Add Expense</Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[600px]">
                <DialogHeader>
                  <DialogTitle>New Expense</DialogTitle>
                  <DialogDescription>Add a new expense entry</DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <p className="text-xs">Date</p>
                      <DateField value={form.date} onChange={(v) => setForm(s => ({ ...s, date: v }))} />
                    </div>
                    <div className="space-y-2">
                      <p className="text-xs">Category</p>
                      <Select value={form.category} onValueChange={(v) => setForm(s => ({ ...s, category: v }))}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select category" />
                        </SelectTrigger>
                        <SelectContent>
                          {defaultCategories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-4 items-end">
                    <div className="space-y-2 col-span-1">
                      <p className="text-xs">Amount</p>
                      <Input type="number" placeholder="0" value={form.amount} onChange={(e) => setForm(s => ({ ...s, amount: e.target.value }))} />
                    </div>
                    <div className="space-y-2 col-span-1">
                      <p className="text-xs">Method</p>
                      <Select value={form.method} onValueChange={(v) => setForm(s => ({ ...s, method: v }))}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select method" />
                        </SelectTrigger>
                        <SelectContent>
                          {methodOptions.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2 col-span-1">
                      <p className="text-xs">Reference</p>
                      <Input placeholder="Optional" value={form.reference} onChange={(e) => setForm(s => ({ ...s, reference: e.target.value }))} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <p className="text-xs">Description</p>
                    <Textarea rows={3} placeholder="Optional" value={form.description} onChange={(e) => setForm(s => ({ ...s, description: e.target.value }))} />
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                  <Button onClick={onSave} disabled={saving}>{saving ? "Saving..." : "Save"}</Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <Card>
          <CardContent className="p-4 grid gap-3 md:grid-cols-5 items-end">
            <div>
              <p className="text-xs mb-1">Preset</p>
              <Select value={preset} onValueChange={(v: any) => setPreset(v)}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {presetRanges.map(p => <SelectItem key={p.key} value={p.key}>{p.label}</SelectItem>)}
                  <SelectItem value="custom">Custom</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <p className="text-xs mb-1">From</p>
              <DateField disabled={String(preset) !== 'custom'} value={from} onChange={(v) => setFrom(v)} className="h-9" />
            </div>
            <div>
              <p className="text-xs mb-1">To</p>
              <DateField disabled={String(preset) !== 'custom'} value={to} onChange={(v) => setTo(v)} className="h-9" />
            </div>
            <div className="col-span-2 grid grid-cols-2 gap-3">
              <Card className="bg-red-50 border-red-100">
                <CardContent className="p-3">
                  <div>
                    <p className="text-xs text-red-600">Total</p>
                    <p className="text-xl font-semibold text-red-700">{formatCurrency(totals.total)}</p>
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-amber-50 border-amber-100">
                <CardContent className="p-3">
                  <div>
                    <p className="text-xs text-amber-600">Today</p>
                    <p className="text-xl font-semibold text-amber-700">{formatCurrency(totals.todayTotal)}</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Expense Entries ({expenses.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead>Reference</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {expenses.map((e) => (
                    <TableRow key={e.id}>
                      <TableCell>{e.date}</TableCell>
                      <TableCell>{e.category}</TableCell>
                      <TableCell className="max-w-[360px] truncate" title={e.description}>{e.description}</TableCell>
                      <TableCell className="text-right">{formatCurrency(e.amount)}</TableCell>
                      <TableCell className="capitalize">{e.method}</TableCell>
                      <TableCell>{e.reference}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" onClick={() => onDelete(e.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
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
}
