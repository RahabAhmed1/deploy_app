import { Bell, Search, User, Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useEffect, useState } from "react";
import { getDashboardStats } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";

export function AppHeader() {
  const [isDark, setIsDark] = useState(false);
  const [notif, setNotif] = useState({ lowStockItems: 0, expiringItems: 0, pendingOrders: 0 });
  const [meLabel, setMeLabel] = useState({ name: 'Admin User', role: 'Administrator' });

  useEffect(() => {
    try {
      const saved = localStorage.getItem('theme');
      const preferDark = saved ? saved === 'dark' : (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
      setIsDark(!!preferDark);
      document.documentElement.classList.toggle('dark', !!preferDark);
    } catch {}
    (async () => {
      try {
        const res = await getDashboardStats();
        const s = res?.stats || {};
        setNotif({
          lowStockItems: Number(s.lowStockItems || 0),
          expiringItems: Number(s.expiringItems || 0),
          pendingOrders: Number(s.pendingOrders || 0),
        });
      } catch {}
    })();

    try {
      const me: any = getCurrentUser();
      const nm = String(me?.fullName || me?.username || 'Admin User');
      const rl = String(me?.role || 'Administrator');
      setMeLabel({ name: nm, role: rl === 'admin' ? 'Administrator' : rl });
    } catch {}
  }, []);

  const toggleTheme = () => {
    const next = !isDark;
    setIsDark(next);
    document.documentElement.classList.toggle('dark', next);
    try { localStorage.setItem('theme', next ? 'dark' : 'light'); } catch {}
  };

  return (
    <header className="sticky top-0 z-50 flex h-16 items-center gap-4 border-b border-border bg-card px-4 md:px-6">
      <SidebarTrigger className="md:hidden" />
      
      <div className="flex-1 flex items-center gap-4">
        <div className="relative max-w-md flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search products, orders, customers..."
            className="pl-10 bg-background"
          />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={toggleTheme}>
          {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="relative">
              <Bell className="h-5 w-5" />
              <Badge className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs">
                {(notif.lowStockItems + notif.expiringItems + notif.pendingOrders) || 0}
              </Badge>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80">
            <DropdownMenuLabel>Notifications</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {(notif.lowStockItems + notif.expiringItems + notif.pendingOrders) === 0 ? (
              <DropdownMenuItem className="flex flex-col items-start gap-1 py-3">
                <span className="text-xs text-muted-foreground">No new notifications</span>
              </DropdownMenuItem>
            ) : (
              <>
                <DropdownMenuItem className="flex flex-col items-start gap-1 py-3">
                  <span className="font-medium">Low Stock Alerts</span>
                  <span className="text-xs text-muted-foreground">{notif.lowStockItems} products at or below minimum level</span>
                </DropdownMenuItem>
                <DropdownMenuItem className="flex flex-col items-start gap-1 py-3">
                  <span className="font-medium">Expiring Soon</span>
                  <span className="text-xs text-muted-foreground">{notif.expiringItems} products expiring in 90 days</span>
                </DropdownMenuItem>
                <DropdownMenuItem className="flex flex-col items-start gap-1 py-3">
                  <span className="font-medium">Pending Orders</span>
                  <span className="text-xs text-muted-foreground">{notif.pendingOrders} orders awaiting action</span>
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <User className="h-4 w-4" />
          </div>
          <div className="hidden md:block text-left">
            <p className="text-sm font-medium">{meLabel.name}</p>
            <p className="text-xs text-muted-foreground">{meLabel.role}</p>
          </div>
        </div>
      </div>
    </header>
  );
}
