import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  Users,
  FileText,
  Settings,
  Warehouse,
  CreditCard,
  TrendingUp,
  AlertTriangle,
  Truck,
  BarChart3,
  Pill,
  LogOut,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import { hasPermission, isAdmin } from "@/lib/auth";

const mainNavItems = [
  { title: "Dashboard", icon: LayoutDashboard, path: "/dashboard", perm: "view_dashboard" },
  { title: "Products", icon: Package, path: "/products", perm: "view_products" },
  { title: "Inventory", icon: Warehouse, path: "/inventory", perm: "view_inventory" },
  { title: "Orders", icon: ShoppingCart, path: "/orders", perm: "view_orders" },
  { title: "Customers", icon: Users, path: "/customers", perm: "view_customers" },
  { title: "Suppliers", icon: Users, path: "/suppliers", perm: "view_suppliers" },
];

const operationsItems = [
  { title: "Walk-in Sale", icon: ShoppingCart, path: "/walk-in", perm: "view_walk_in" },
  { title: "Purchases", icon: Truck, path: "/purchases", perm: "view_purchases" },
  { title: "Invoices", icon: FileText, path: "/invoices", perm: "view_invoices" },
  { title: "Payments", icon: CreditCard, path: "/payments", perm: "view_payments" },
  { title: "Expenses", icon: FileText, path: "/expenses", perm: "view_expenses" },
  { title: "Customer Returns", icon: AlertTriangle, path: "/returns", perm: "view_returns" },
  { title: "Supplier Returns", icon: Truck, path: "/supplier-returns", perm: "view_returns" },
  { title: "Ledger", icon: FileText, path: "/ledger", perm: "view_ledger" },
  { title: "Party Ledger", icon: FileText, path: "/party-ledger", perm: "view_ledger" },
  { title: "Daily P&L", icon: TrendingUp, path: "/daily-pl", perm: "view_daily_pl" },
];

const reportsItems = [
  { title: "Sales Reports", icon: TrendingUp, path: "/reports/sales", perm: "view_reports_sales" },
  { title: "Stock Reports", icon: BarChart3, path: "/reports/stock", perm: "view_reports_stock" },
  { title: "Financial Reports", icon: FileText, path: "/reports/financial", perm: "view_reports_financial" },
  { title: "Accounts Receivable", icon: FileText, path: "/receivables", perm: "view_reports_financial" },
];

export function AppSidebar() {
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = () => {
    try {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
    } catch {}
    navigate("/login", { replace: true });
  };

  const NavItem = ({ item }: { item: typeof mainNavItems[0] }) => {
    const isActive = location.pathname === item.path;
    return (
      <SidebarMenuItem>
        <SidebarMenuButton
          asChild
          className={cn(
            "transition-all duration-200",
            isActive && "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground"
          )}
        >
          <Link to={item.path}>
            <item.icon className="h-4 w-4" />
            <span>{item.title}</span>
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  };

  return (
    <Sidebar className="border-r border-border">
      <SidebarHeader className="p-4 border-b border-border">
        <Link to="/dashboard" className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#10b981] shadow-sm">
            <Pill className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="font-semibold text-lg text-foreground">PharmaFlow Pro</h1>
            <p className="text-xs text-muted-foreground">Distribution System</p>
          </div>
        </Link>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Main Menu</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainNavItems.filter((i) => hasPermission((i as any).perm)).map((item) => (
                <NavItem key={item.path} item={item} />
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Operations</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {operationsItems.filter((i) => hasPermission((i as any).perm)).map((item) => (
                <NavItem key={item.path} item={item} />
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Reports</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {reportsItems.filter((i) => hasPermission((i as any).perm)).map((item) => (
                <NavItem key={item.path} item={item} />
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-4 border-t border-border">
        <SidebarMenu>
          {isAdmin() && (
            <SidebarMenuItem>
              <SidebarMenuButton asChild>
                <Link to="/settings">
                  <Settings className="h-4 w-4" />
                  <span>Settings</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          )}
          <SidebarMenuItem>
            <SidebarMenuButton onClick={handleLogout} className="mt-2 text-destructive hover:text-destructive hover:bg-destructive/10">
              <LogOut className="h-4 w-4" />
              <span>Logout</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
