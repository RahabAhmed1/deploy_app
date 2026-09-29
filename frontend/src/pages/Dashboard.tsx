import { useEffect, useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { StatsCard } from "@/components/dashboard/StatsCard";
import { SalesChart } from "@/components/dashboard/SalesChart";
import { CategoryChart } from "@/components/dashboard/CategoryChart";
import { RecentOrders } from "@/components/dashboard/RecentOrders";
import { LowStockAlert } from "@/components/dashboard/LowStockAlert";
import { ExpiryAlert } from "@/components/dashboard/ExpiryAlert";
import { getDashboardStats } from "@/lib/api";
import { formatCurrency } from "@/lib/currency";
import {
  Package,
  ShoppingCart,
  Users,
  IndianRupee,
  AlertTriangle,
  Clock,
  TrendingUp,
  CreditCard,
} from "lucide-react";

const Dashboard = () => {
  const [stats, setStats] = useState({
    totalProducts: 0,
    lowStockItems: 0,
    expiringItems: 0,
    totalOrders: 0,
    pendingOrders: 0,
    totalCustomers: 0,
    totalRevenue: 0,
    outstandingReceivables: 0,
    todaySales: 0,
    monthlyGrowth: 0,
  });

  useEffect(() => {
    (async () => {
      try {
        const res = await getDashboardStats();
        if (res?.stats) setStats(res.stats);
      } catch (e) {
        console.error(e);
      }
    })();
  }, []);
  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Page Header */}
        <div>
          <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground">
            Welcome back! Here's your business overview.
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatsCard
            title="Total Revenue"
            value={formatCurrency(stats.totalRevenue)}
            subtitle="This month"
            icon={IndianRupee}
            variant="primary"
            trend={{ value: stats.monthlyGrowth, isPositive: stats.monthlyGrowth >= 0 }}
          />
          <StatsCard
            title="Total Orders"
            value={stats.totalOrders}
            subtitle={`${stats.pendingOrders} pending`}
            icon={ShoppingCart}
          />
          <StatsCard
            title="Total Products"
            value={stats.totalProducts}
            subtitle={`${stats.lowStockItems} low stock`}
            icon={Package}
          />
          <StatsCard
            title="Active Customers"
            value={stats.totalCustomers}
            icon={Users}
          />
        </div>

        {/* Secondary Stats */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatsCard
            title="Today's Sales"
            value={formatCurrency(stats.todaySales)}
            icon={TrendingUp}
          />
          <StatsCard
            title="Outstanding"
            value={formatCurrency(stats.outstandingReceivables)}
            icon={CreditCard}
            variant="warning"
          />
          <StatsCard
            title="Low Stock Items"
            value={stats.lowStockItems}
            icon={AlertTriangle}
            variant="danger"
          />
          <StatsCard
            title="Expiring Soon"
            value={stats.expiringItems}
            icon={Clock}
            variant="warning"
          />
        </div>

        {/* Charts Row */}
        <div className="grid gap-6 lg:grid-cols-2">
          <SalesChart />
          <CategoryChart />
        </div>

        {/* Bottom Row */}
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <RecentOrders />
          </div>
          <div className="space-y-6">
            <LowStockAlert />
            <ExpiryAlert />
          </div>
        </div>
      </div>
    </MainLayout>
  );
};

export default Dashboard;
