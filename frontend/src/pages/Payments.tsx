import { useEffect, useMemo, useState } from "react";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { getPayments, createPayment, getOrders, getCustomers } from "@/lib/api";
import { formatCurrency } from "@/lib/currency";
import { Plus, Download, CreditCard, Banknote, Smartphone, FileText } from "lucide-react";
import { toast } from "sonner";

const methodIcons = {
  cash: Banknote,
  bank: CreditCard,
  cheque: FileText,
  upi: Smartphone,
};

const statusStyles = {
  completed: "bg-primary/10 text-primary border-primary/20",
  pending: "bg-chart-4/10 text-chart-4 border-chart-4/20",
  failed: "bg-destructive/10 text-destructive border-destructive/20",
};

type Payment = {
  id: string;
  date: string;
  customerId: string;
  customerName: string;
  orderId: string;
  amount: number;
  method: "cash" | "bank" | "cheque" | "upi";
  reference: string;
  status: "completed" | "pending" | "failed";
};

type Order = { id: string; orderNo: string; netAmount: number; customerId: string };
type Customer = { id: string; name: string };

const Payments = () => {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    date: new Date().toISOString().split('T')[0],
    customerId: "",
    orderId: "",
    amount: "",
    method: "bank" as Payment["method"],
    reference: "",
    status: "completed" as Payment["status"],
  });

  const load = async () => {
    const [pRes, oRes, cRes] = await Promise.all([getPayments(), getOrders(), getCustomers()]);
    setPayments((pRes?.payments || []) as Payment[]);
    setOrders((oRes?.orders || []).map((o: any) => ({ id: String(o.id), orderNo: o.orderNo, netAmount: o.netAmount || 0, customerId: String(o.customerId || "") })));
    setCustomers((cRes?.customers || []).map((c: any) => ({ id: String(c.id), name: c.name })));
  };

  useEffect(() => { load(); }, []);

  const selectedOrder = useMemo(() => orders.find((o) => o.id === form.orderId) || null, [orders, form.orderId]);
  const paidForSelectedOrder = useMemo(() => payments.filter((p) => p.orderId === form.orderId).reduce((sum, p) => sum + (Number(p.amount) || 0), 0), [payments, form.orderId]);
  const remainingForSelectedOrder = Math.max(0, (selectedOrder?.netAmount || 0) - paidForSelectedOrder);
  const selectedCustomer = useMemo(() => {
    const cid = form.customerId || selectedOrder?.customerId || "";
    return customers.find((c) => c.id === cid) || null;
  }, [customers, form.customerId, selectedOrder?.customerId]);

  const totalReceived = payments.filter((p) => p.status === "completed").reduce((sum, p) => sum + p.amount, 0);
  const totalPending = payments.filter((p) => p.status === "pending").reduce((sum, p) => sum + p.amount, 0);
  const outstandingReceivables = Math.max(
    0,
    orders.reduce((s, o) => s + (Number(o.netAmount) || 0), 0) -
      payments.filter((p) => p.status === "completed").reduce((s, p) => s + (Number(p.amount) || 0), 0)
  );

  const onSelectCustomer = (cid: string) => {
    setForm((s) => ({ ...s, customerId: cid, orderId: "" }));
  };

  const onSelectOrder = (oid: string) => {
    const o = orders.find((oo) => oo.id === oid);
    const paid = payments.filter((p) => p.orderId === oid).reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
    const remaining = Math.max(0, (o?.netAmount || 0) - paid);
    setForm((s) => ({
      ...s,
      orderId: oid,
      customerId: o?.customerId || s.customerId,
      amount: remaining > 0 ? String(Math.round(remaining)) : "0",
    }));
  };

  const onSave = async () => {
    if (saving) return;
    if (!form.orderId) {
      toast.error("Please select an order");
      return;
    }
    const cid = form.customerId || selectedOrder?.customerId;
    if (!cid) {
      toast.error("Please select a customer");
      return;
    }
    if (!Number(form.amount)) {
      toast.error("Please enter a valid amount");
      return;
    }
    const maxPayable = remainingForSelectedOrder;
    if (Number(form.amount) > maxPayable + 1e-6) {
      toast.error(`Amount exceeds remaining (${formatCurrency(maxPayable)})`);
      return;
    }
    setSaving(true);
    try {
      await createPayment({
        date: form.date,
        customerId: cid,
        orderId: form.orderId,
        amount: Number(form.amount),
        method: form.method,
        reference: form.reference,
        status: form.status,
      });
      setDialogOpen(false);
      setForm({ date: new Date().toISOString().split('T')[0], customerId: "", orderId: "", amount: "", method: "bank", reference: "", status: "completed" });
      await load();
    } finally {
      setSaving(false);
    }
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Payments</h1>
            <p className="text-muted-foreground">
              Track customer payments and outstanding balances
            </p>
          </div>
          <div className="flex gap-2">
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={() => setDialogOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Record Payment
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[600px]">
                <DialogHeader>
                  <DialogTitle>Record Payment</DialogTitle>
                  <DialogDescription>Add a payment against an order.</DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-2">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <p className="text-sm font-medium">Date</p>
                      <Input type="date" value={form.date} onChange={(e) => setForm((s) => ({ ...s, date: e.target.value }))} />
                    </div>
                    <div className="space-y-2">
                      <p className="text-sm font-medium">Method</p>
                      <Select value={form.method} onValueChange={(v) => setForm((s) => ({ ...s, method: v as Payment["method"] }))}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select method" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="bank">Bank</SelectItem>
                          <SelectItem value="cash">Cash</SelectItem>
                          <SelectItem value="cheque">Cheque</SelectItem>
                          <SelectItem value="upi">UPI</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <p className="text-sm font-medium">Customer</p>
                      {form.orderId && selectedCustomer ? (
                        <Input value={selectedCustomer.name} readOnly />
                      ) : (
                        <Select value={form.customerId} onValueChange={onSelectCustomer}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select customer" />
                          </SelectTrigger>
                          <SelectContent>
                            {customers.map((c) => (
                              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                    <div className="space-y-2">
                      <p className="text-sm font-medium">Order</p>
                      <Select value={form.orderId} onValueChange={onSelectOrder}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select order" />
                        </SelectTrigger>
                        <SelectContent>
                          {orders.filter(o => !form.customerId || o.customerId === form.customerId).map((o) => (
                            <SelectItem key={o.id} value={o.id}>{o.orderNo}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  {form.orderId && selectedOrder && (
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <p className="text-xs text-muted-foreground">Order Total</p>
                        <p className="font-semibold">{formatCurrency(selectedOrder.netAmount)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Paid</p>
                        <p className="font-semibold text-chart-4">{formatCurrency(paidForSelectedOrder)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Remaining</p>
                        <p className="font-bold text-primary">{formatCurrency(remainingForSelectedOrder)}</p>
                      </div>
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <p className="text-sm font-medium">Amount</p>
                      <Input
                        type="number"
                        placeholder={form.orderId ? `Remaining: ${formatCurrency(remainingForSelectedOrder)}` : "0"}
                        value={form.amount}
                        min={0}
                        step="0.01"
                        onChange={(e) => {
                          const v = e.target.value;
                          setForm((s) => ({ ...s, amount: v }));
                        }}
                      />
                    </div>
                    <div className="space-y-2">
                      <p className="text-sm font-medium">Reference</p>
                      <Input placeholder="TXN/CHQ/REF" value={form.reference}
                        onChange={(e) => setForm((s) => ({ ...s, reference: e.target.value }))} />
                    </div>
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                  <Button onClick={onSave} disabled={saving || !form.orderId || !(form.customerId || selectedOrder?.customerId) || !Number(form.amount) || Number(form.amount) > remainingForSelectedOrder + 1e-6}>
                    {saving ? "Saving..." : "Save Payment"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
            <Button variant="outline">
              <Download className="mr-2 h-4 w-4" />
              Export
            </Button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <CreditCard className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{formatCurrency(totalReceived)}</p>
                  <p className="text-sm text-muted-foreground">Total Received</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-chart-4/10">
                  <CreditCard className="h-5 w-5 text-chart-4" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{formatCurrency(totalPending)}</p>
                  <p className="text-sm text-muted-foreground">Pending Clearance</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-destructive/10">
                  <CreditCard className="h-5 w-5 text-destructive" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{formatCurrency(outstandingReceivables)}</p>
                  <p className="text-sm text-muted-foreground">Outstanding Receivables</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Payments Table */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Payments</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Order</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.map((payment) => {
                  const Icon = methodIcons[payment.method];
                  return (
                    <TableRow key={payment.id}>
                      <TableCell>{payment.date}</TableCell>
                      <TableCell className="font-medium">{payment.customerName}</TableCell>
                      <TableCell className="font-mono text-sm">{payment.orderId}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Icon className="h-4 w-4 text-muted-foreground" />
                          <span className="capitalize">{payment.method}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-semibold">{formatCurrency(payment.amount)}</TableCell>
                      <TableCell className="font-mono text-sm text-muted-foreground">
                        {payment.reference}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={statusStyles[payment.status]}>
                          {payment.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
};

export default Payments;
