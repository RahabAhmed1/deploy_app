import { useEffect, useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Building2,
  User,
  Bell,
  Shield,
  Database,
  Printer,
  Mail,
  Key,
} from "lucide-react";
import { getCompanyInfo, saveCompanyInfo, getAppConfig, saveAppConfig, getUsers, createUser, updateUser, deleteUser } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { toast } from "sonner";

const Settings = () => {
  const [company, setCompany] = useState({
    companyName: "",
    gstNo: "",
    drugLicenseNo: "",
    fssaiLicense: "",
    address: "",
    city: "",
    state: "",
    pinCode: "",
    phone: "",
    email: "",
  });
  const [users, setUsers] = useState<Array<{ id: string; username: string; email: string; role: string; isActive: boolean; staffCode?: string; permissions: string[] }>>([]);
  const [profile, setProfile] = useState({ fullName: "", phone: "", address: "" });
  const [profileSaving, setProfileSaving] = useState(false);
  const [userDialogOpen, setUserDialogOpen] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [userSaving, setUserSaving] = useState(false);
  const [userForm, setUserForm] = useState({ username: "", email: "", password: "", role: "staff", isActive: true, permissions: [] as string[] });

  const [deleteUserOpen, setDeleteUserOpen] = useState(false);
  const [deleteUserId, setDeleteUserId] = useState<string | null>(null);
  const [deleteUserName, setDeleteUserName] = useState<string>("");
  const [deleteUserSaving, setDeleteUserSaving] = useState(false);

  const PERMISSIONS: Array<{ code: string; label: string }> = [
    { code: "view_dashboard", label: "Dashboard" },
    { code: "view_products", label: "Products" },
    { code: "view_inventory", label: "Inventory" },
    { code: "view_orders", label: "Orders" },
    { code: "view_customers", label: "Customers" },
    { code: "view_suppliers", label: "Suppliers" },
    { code: "view_walk_in", label: "Walk-in Sale" },
    { code: "view_purchases", label: "Purchases" },
    { code: "view_invoices", label: "Invoices" },
    { code: "view_payments", label: "Payments" },
    { code: "view_expenses", label: "Expenses" },
    { code: "view_returns", label: "Returns" },
    { code: "view_ledger", label: "Ledger" },
    { code: "view_daily_pl", label: "Daily P&L" },
    { code: "view_reports_sales", label: "Sales Reports" },
    { code: "view_reports_stock", label: "Stock Reports" },
    { code: "view_reports_financial", label: "Financial Reports" },
  ];
  const [config, setConfig] = useState({
    invoicePrefix: "INV-",
    nextInvoiceNumber: "2024-00001",
    defaultTaxRate: 12,
    paymentTermsDays: 30,
    autoGenerateInvoice: true,
    lowStockAlertEnabled: true,
    expiryAlertEnabled: true,
    expiryAlertDays: 90,
    paymentRemindersEnabled: true,
    orderStatusEmailEnabled: true,
    creditLimitAlertEnabled: true,
  });

  useEffect(() => {
    (async () => {
      try {
        const res = await getCompanyInfo();
        const c = res?.company || {};
        setCompany({
          companyName: c.companyName || "",
          gstNo: c.gstNo || "",
          drugLicenseNo: c.drugLicenseNo || "",
          fssaiLicense: c.fssaiLicense || "",
          address: c.address || "",
          city: c.city || "",
          state: c.state || "",
          pinCode: c.pinCode || "",
          phone: c.phone || "",
          email: c.email || "",
        });
      } catch {}
      try {
        const res2 = await getAppConfig();
        const d = res2?.config || {};
        setConfig({
          invoicePrefix: d.invoicePrefix ?? "INV-",
          nextInvoiceNumber: d.nextInvoiceNumber ?? "2024-00001",
          defaultTaxRate: typeof d.defaultTaxRate === 'number' ? d.defaultTaxRate : Number(d.defaultTaxRate || 12),
          paymentTermsDays: typeof d.paymentTermsDays === 'number' ? d.paymentTermsDays : Number(d.paymentTermsDays || 30),
          autoGenerateInvoice: !!d.autoGenerateInvoice,
          lowStockAlertEnabled: !!d.lowStockAlertEnabled,
          expiryAlertEnabled: !!d.expiryAlertEnabled,
          expiryAlertDays: typeof d.expiryAlertDays === 'number' ? d.expiryAlertDays : Number(d.expiryAlertDays || 90),
          paymentRemindersEnabled: !!d.paymentRemindersEnabled,
          orderStatusEmailEnabled: !!d.orderStatusEmailEnabled,
          creditLimitAlertEnabled: !!d.creditLimitAlertEnabled,
        });
      } catch {}
    })();
  }, []);

  useEffect(() => {
    (async () => {
      try { const res = await getUsers(); setUsers(res?.users || []); } catch (e: any) { console.error(e); }
    })();
  }, []);

  useEffect(() => {
    const me = getCurrentUser();
    if (!me?.id) return;
    (async () => {
      try {
        const res = await getUsers();
        const list = Array.isArray(res?.users) ? res.users : [];
        const u: any = list.find((x: any) => String(x.id) === String(me.id));
        if (!u) return;
        setProfile({
          fullName: String(u.fullName || ""),
          phone: String(u.phone || ""),
          address: String(u.address || ""),
        });
      } catch {
      }
    })();
  }, []);

  const saveProfile = async () => {
    const me: any = getCurrentUser();
    if (!me?.id || profileSaving) return;
    setProfileSaving(true);
    try {
      await updateUser(String(me.id), {
        fullName: profile.fullName,
        phone: profile.phone,
        address: profile.address,
      });

      // keep header/sidebar identity in sync
      try {
        const raw = localStorage.getItem('user');
        const cur = raw ? JSON.parse(raw) : {};
        localStorage.setItem('user', JSON.stringify({ ...cur, fullName: profile.fullName, phone: profile.phone, address: profile.address }));
      } catch {}

      toast.success('Profile saved');
    } catch (e: any) {
      toast.error(e?.message || 'Failed to save profile');
    } finally {
      setProfileSaving(false);
    }
  };

  const openAddUser = () => {
    setEditingUserId(null);
    setUserForm({ username: "", email: "", password: "", role: "staff", isActive: true, permissions: ["view_dashboard"] });
    setUserDialogOpen(true);
  };

  const openEditUser = (u: any) => {
    setEditingUserId(String(u.id));
    setUserForm({ username: u.username || "", email: u.email || "", password: "", role: u.role || "staff", isActive: !!u.isActive, permissions: Array.isArray(u.permissions) ? u.permissions : [] });
    setUserDialogOpen(true);
  };

  const saveUser = async () => {
    if (userSaving) return;
    if (!userForm.username) { toast.error("Username is required"); return; }
    if (!editingUserId && !userForm.password) { toast.error("Password is required"); return; }
    setUserSaving(true);
    try {
      if (editingUserId) {
        await updateUser(editingUserId, { username: userForm.username, email: userForm.email, role: userForm.role, isActive: userForm.isActive, permissions: userForm.permissions, password: userForm.password || undefined });
      } else {
        await createUser({ username: userForm.username, email: userForm.email, role: userForm.role, isActive: userForm.isActive, permissions: userForm.permissions, password: userForm.password });
      }
      const res = await getUsers();
      setUsers(res?.users || []);
      setUserDialogOpen(false);
      setEditingUserId(null);
      toast.success("User saved");
    } catch (e: any) {
      toast.error(e?.message || "Failed to save user");
    } finally {
      setUserSaving(false);
    }
  };

  const onDeleteUser = (u: { id: string; username?: string }) => {
    setDeleteUserId(String(u.id));
    setDeleteUserName(String(u.username || ""));
    setDeleteUserOpen(true);
  };

  const confirmDeleteUser = async () => {
    if (!deleteUserId || deleteUserSaving) return;
    setDeleteUserSaving(true);
    try {
      await deleteUser(deleteUserId);
      const res = await getUsers();
      setUsers(res?.users || []);
      toast.success("User deleted");
      setDeleteUserOpen(false);
      setDeleteUserId(null);
      setDeleteUserName("");
    } catch (e: any) {
      toast.error(e?.message || "Failed to delete user");
    } finally {
      setDeleteUserSaving(false);
    }
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Page Header */}
        <div>
          <h1 className="text-3xl font-bold text-foreground">Settings</h1>
          <p className="text-muted-foreground">
            Manage your system preferences and configurations
          </p>
        </div>

        <Tabs defaultValue="company" className="space-y-6">
          <TabsList className="grid w-full grid-cols-5 lg:w-[760px]">
            <TabsTrigger value="company">Company</TabsTrigger>
            <TabsTrigger value="profile">Profile</TabsTrigger>
            <TabsTrigger value="users">Users</TabsTrigger>
            <TabsTrigger value="notifications">Alerts</TabsTrigger>
            <TabsTrigger value="billing">Billing</TabsTrigger>
          </TabsList>

          <TabsContent value="company" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5" />
                  Company Information
                </CardTitle>
                <CardDescription>
                  Update your company details and branding
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Company Name</Label>
                    <Input value={company.companyName} onChange={(e) => setCompany((s) => ({ ...s, companyName: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>GST Number</Label>
                    <Input value={company.gstNo} onChange={(e) => setCompany((s) => ({ ...s, gstNo: e.target.value }))} />
                  </div>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Drug License No.</Label>
                    <Input value={company.drugLicenseNo} onChange={(e) => setCompany((s) => ({ ...s, drugLicenseNo: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>FSSAI License</Label>
                    <Input value={company.fssaiLicense} onChange={(e) => setCompany((s) => ({ ...s, fssaiLicense: e.target.value }))} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Address</Label>
                  <Input value={company.address} onChange={(e) => setCompany((s) => ({ ...s, address: e.target.value }))} />
                </div>
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label>City</Label>
                    <Input value={company.city} onChange={(e) => setCompany((s) => ({ ...s, city: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>State</Label>
                    <Input value={company.state} onChange={(e) => setCompany((s) => ({ ...s, state: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>PIN Code</Label>
                    <Input value={company.pinCode} onChange={(e) => setCompany((s) => ({ ...s, pinCode: e.target.value }))} />
                  </div>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Phone</Label>
                    <Input value={company.phone} onChange={(e) => setCompany((s) => ({ ...s, phone: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Email</Label>
                    <Input type="email" value={company.email} onChange={(e) => setCompany((s) => ({ ...s, email: e.target.value }))} />
                  </div>
                </div>
                <Separator />
                <div className="flex justify-end">
                  <Button onClick={async () => { try { await saveCompanyInfo(company); } catch {} }}>Save Changes</Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="profile" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Admin Profile
                </CardTitle>
                <CardDescription>
                  Update admin name, phone and address
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Name</Label>
                    <Input value={profile.fullName} onChange={(e) => setProfile((s) => ({ ...s, fullName: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Phone</Label>
                    <Input value={profile.phone} onChange={(e) => setProfile((s) => ({ ...s, phone: e.target.value }))} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Address</Label>
                  <Input value={profile.address} onChange={(e) => setProfile((s) => ({ ...s, address: e.target.value }))} />
                </div>
                <Separator />
                <div className="flex justify-end">
                  <Button onClick={saveProfile} disabled={profileSaving}>{profileSaving ? 'Saving...' : 'Save Profile'}</Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="users" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  User Roles & Permissions
                </CardTitle>
                <CardDescription>
                  Configure role-based access control
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between mb-4">
                  <div className="text-sm text-muted-foreground">Manage users and assign page access.</div>
                  <Button onClick={openAddUser}>
                    <User className="mr-2 h-4 w-4" />
                    Add New User
                  </Button>
                </div>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Username</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Staff Code</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Active</TableHead>
                        <TableHead>Permissions</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {users.map((u) => (
                        <TableRow key={u.id}>
                          <TableCell className="font-medium">{u.username}</TableCell>
                          <TableCell>{u.email}</TableCell>
                          <TableCell>{u.staffCode || ""}</TableCell>
                          <TableCell><Badge variant="outline" className={u.role === 'admin' ? 'border-primary/30 text-primary' : ''}>{u.role}</Badge></TableCell>
                          <TableCell>{u.isActive ? 'Yes' : 'No'}</TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {(u.permissions || []).slice(0,4).map((p) => (
                                <Badge key={p} variant="outline" className="text-[10px]">{p}</Badge>
                              ))}
                              {(u.permissions || []).length > 4 && (
                                <Badge variant="secondary" className="text-[10px]">+{(u.permissions || []).length - 4}</Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button variant="outline" size="sm" onClick={() => openEditUser(u)}>Edit</Button>
                              <Button variant="destructive" size="sm" onClick={() => onDeleteUser(u)}>Delete</Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                <AlertDialog open={deleteUserOpen} onOpenChange={setDeleteUserOpen}>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete user?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This action cannot be undone.
                        {deleteUserName ? ` This will permanently delete “${deleteUserName}”.` : ''}
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel disabled={deleteUserSaving}>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        onClick={(e) => {
                          e.preventDefault();
                          void confirmDeleteUser();
                        }}
                        disabled={deleteUserSaving}>
                        {deleteUserSaving ? 'Deleting...' : 'Delete'}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>

                <Dialog open={userDialogOpen} onOpenChange={setUserDialogOpen}>
                  <DialogContent className="sm:max-w-[720px]">
                    <DialogHeader>
                      <DialogTitle>{editingUserId ? 'Edit User' : 'Add New User'}</DialogTitle>
                      <DialogDescription>Set role and page permissions</DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-2 max-h-[70vh] overflow-y-auto">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Username</Label>
                          <Input value={userForm.username} onChange={(e) => setUserForm((s) => ({ ...s, username: e.target.value }))} />
                        </div>
                        <div className="space-y-2">
                          <Label>Email</Label>
                          <Input type="email" value={userForm.email} onChange={(e) => setUserForm((s) => ({ ...s, email: e.target.value }))} />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>{editingUserId ? 'Reset Password (optional)' : 'Password'}</Label>
                          <Input type="password" value={userForm.password} onChange={(e) => setUserForm((s) => ({ ...s, password: e.target.value }))} placeholder={editingUserId ? 'Leave blank to keep current' : ''} />
                        </div>
                        <div className="space-y-2">
                          <Label>Role</Label>
                          <Select value={userForm.role} onValueChange={(v) => setUserForm((s) => ({ ...s, role: v }))}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="admin">Admin</SelectItem>
                              <SelectItem value="staff">Staff</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Switch checked={userForm.isActive} onCheckedChange={(v) => setUserForm((s) => ({ ...s, isActive: !!v }))} />
                        <span className="text-sm">Active</span>
                      </div>
                      <div className="space-y-2">
                        <Label>Allowed Pages</Label>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                          {PERMISSIONS.map((p) => (
                            <label key={p.code} className="flex items-center gap-2 text-sm">
                              <Checkbox
                                checked={userForm.permissions.includes(p.code)}
                                onCheckedChange={(v) => {
                                  const checked = !!v;
                                  setUserForm((s) => ({
                                    ...s,
                                    permissions: checked ? Array.from(new Set([...(s.permissions || []), p.code])) : (s.permissions || []).filter((x) => x !== p.code),
                                  }));
                                }}
                              />
                              <span>{p.label}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className="flex justify-end gap-2 pt-2">
                      <Button variant="outline" onClick={() => setUserDialogOpen(false)}>Cancel</Button>
                      <Button onClick={saveUser} disabled={userSaving}>{userSaving ? 'Saving...' : 'Save User'}</Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="notifications" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bell className="h-5 w-5" />
                  Alert Settings
                </CardTitle>
                <CardDescription>
                  Configure system alerts and notifications
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Low Stock Alerts</p>
                    <p className="text-sm text-muted-foreground">
                      Get notified when stock falls below minimum level
                    </p>
                  </div>
                  <Switch checked={config.lowStockAlertEnabled} onCheckedChange={(v) => setConfig((s) => ({ ...s, lowStockAlertEnabled: !!v }))} />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Expiry Alerts</p>
                    <p className="text-sm text-muted-foreground">
                      Alert before products expire
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Select value={String(config.expiryAlertDays)} onValueChange={(v) => setConfig((s) => ({ ...s, expiryAlertDays: Number(v) }))}>
                      <SelectTrigger className="w-[100px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="30">30 days</SelectItem>
                        <SelectItem value="60">60 days</SelectItem>
                        <SelectItem value="90">90 days</SelectItem>
                        <SelectItem value="180">180 days</SelectItem>
                      </SelectContent>
                    </Select>
                    <Switch checked={config.expiryAlertEnabled} onCheckedChange={(v) => setConfig((s) => ({ ...s, expiryAlertEnabled: !!v }))} />
                  </div>
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Payment Reminders</p>
                    <p className="text-sm text-muted-foreground">
                      Send payment due reminders to customers
                    </p>
                  </div>
                  <Switch checked={config.paymentRemindersEnabled} onCheckedChange={(v) => setConfig((s) => ({ ...s, paymentRemindersEnabled: !!v }))} />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Order Status Updates</p>
                    <p className="text-sm text-muted-foreground">
                      Email customers when order status changes
                    </p>
                  </div>
                  <Switch checked={config.orderStatusEmailEnabled} onCheckedChange={(v) => setConfig((s) => ({ ...s, orderStatusEmailEnabled: !!v }))} />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Credit Limit Alerts</p>
                    <p className="text-sm text-muted-foreground">
                      Alert when customer exceeds credit limit
                    </p>
                  </div>
                  <Switch checked={config.creditLimitAlertEnabled} onCheckedChange={(v) => setConfig((s) => ({ ...s, creditLimitAlertEnabled: !!v }))} />
                </div>
                <Separator />
                <div className="flex justify-end">
                  <Button onClick={async () => { try { await saveAppConfig(config); } catch {} }}>Save Changes</Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="billing" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Printer className="h-5 w-5" />
                  Invoice Settings
                </CardTitle>
                <CardDescription>
                  Configure invoice generation and printing
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Invoice Prefix</Label>
                    <Input value={config.invoicePrefix} onChange={(e) => setConfig((s) => ({ ...s, invoicePrefix: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Next Invoice Number</Label>
                    <Input value={config.nextInvoiceNumber} onChange={(e) => setConfig((s) => ({ ...s, nextInvoiceNumber: e.target.value }))} />
                  </div>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Default Tax Rate</Label>
                    <Select value={String(config.defaultTaxRate)} onValueChange={(v) => setConfig((s) => ({ ...s, defaultTaxRate: Number(v) }))}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="0">0% (Exempt)</SelectItem>
                        <SelectItem value="5">5% GST</SelectItem>
                        <SelectItem value="12">12% GST</SelectItem>
                        <SelectItem value="18">18% GST</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Payment Terms (Days)</Label>
                    <Input type="number" value={config.paymentTermsDays} onChange={(e) => setConfig((s) => ({ ...s, paymentTermsDays: Number(e.target.value || 0) }))} />
                  </div>
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Auto-generate Invoice</p>
                    <p className="text-sm text-muted-foreground">
                      Create invoice automatically when order is dispatched
                    </p>
                  </div>
                  <Switch checked={config.autoGenerateInvoice} onCheckedChange={(v) => setConfig((s) => ({ ...s, autoGenerateInvoice: !!v }))} />
                </div>
                <Separator />
                <div className="flex justify-end">
                  <Button onClick={async () => { try { await saveAppConfig(config); } catch {} }}>Save Changes</Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

        </Tabs>
      </div>
    </MainLayout>
  );
};

export default Settings;
