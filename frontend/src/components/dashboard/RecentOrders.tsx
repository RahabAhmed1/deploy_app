import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getOrders } from "@/lib/api";
import { formatCurrency } from "@/lib/currency";
import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";

const statusStyles = {
  pending: 'bg-chart-4/10 text-chart-4 border-chart-4/20',
  approved: 'bg-chart-1/10 text-chart-1 border-chart-1/20',
  dispatched: 'bg-chart-3/10 text-chart-3 border-chart-3/20',
  delivered: 'bg-primary/10 text-primary border-primary/20',
  cancelled: 'bg-destructive/10 text-destructive border-destructive/20',
};

const paymentStyles = {
  unpaid: 'bg-destructive/10 text-destructive border-destructive/20',
  partial: 'bg-chart-4/10 text-chart-4 border-chart-4/20',
  paid: 'bg-primary/10 text-primary border-primary/20',
};

type Order = {
  id: string;
  orderNo: string;
  customerName: string;
  orderDate: string;
  netAmount: number;
  status: keyof typeof statusStyles;
  paymentStatus: keyof typeof paymentStyles;
};

export function RecentOrders() {
  const [recentOrders, setRecentOrders] = useState<Order[]>([]);
  useEffect(() => {
    (async () => {
      try {
        const res = await getOrders();
        const list: Order[] = (res?.orders || []).slice(0, 5);
        setRecentOrders(list);
      } catch (e) {
        console.error(e);
      }
    })();
  }, []);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Recent Orders</CardTitle>
        <Button variant="ghost" size="sm" asChild>
          <Link to="/orders" className="flex items-center gap-1">
            View All <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {recentOrders.map((order) => (
            <div
              key={order.id}
              className="flex items-center justify-between rounded-lg border border-border p-4 transition-colors hover:bg-muted/50"
            >
              <div className="space-y-1">
                <p className="font-medium text-foreground">{order.orderNo}</p>
                <p className="text-sm text-muted-foreground">{order.customerName}</p>
                <p className="text-xs text-muted-foreground">{order.orderDate}</p>
              </div>
              <div className="text-right space-y-2">
                <p className="font-semibold text-foreground">{formatCurrency(order.netAmount)}</p>
                <div className="flex gap-2">
                  <Badge variant="outline" className={statusStyles[order.status]}>
                    {order.status}
                  </Badge>
                  <Badge variant="outline" className={paymentStyles[order.paymentStatus]}>
                    {order.paymentStatus}
                  </Badge>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
