import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getProducts } from "@/lib/api";
import { Clock } from "lucide-react";

export function ExpiryAlert() {
  const [expiringProducts, setExpiringProducts] = useState<Array<{ id: string; name: string; batchNo: string; expiryDate: string }>>([]);

  useEffect(() => {
    (async () => {
      try {
        const res = await getProducts();
        const now = new Date();
        const threshold = new Date(now);
        threshold.setMonth(threshold.getMonth() + 3);
        const items = (res?.products || [])
          .filter((p: any) => p.expiryDate)
          .filter((p: any) => new Date(p.expiryDate) <= threshold)
          .map((p: any) => ({ id: String(p.id), name: p.name || "", batchNo: p.batchNo || "", expiryDate: p.expiryDate }));
        setExpiringProducts(items);
      } catch (e) {
        console.error(e);
      }
    })();
  }, []);

  const getDaysUntilExpiry = (expiryDate: string) => {
    const expiry = new Date(expiryDate);
    const now = new Date();
    const diff = expiry.getTime() - now.getTime();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  };

  const getExpiryBadgeStyle = (days: number) => {
    if (days <= 30) return 'bg-destructive text-destructive-foreground';
    if (days <= 60) return 'bg-chart-4 text-foreground';
    return 'bg-chart-1 text-foreground';
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center gap-2">
        <Clock className="h-5 w-5 text-chart-4" />
        <CardTitle>Expiring Soon</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {expiringProducts.map((product) => {
            const daysUntilExpiry = getDaysUntilExpiry(product.expiryDate);
            return (
              <div
                key={product.id}
                className="flex items-center justify-between rounded-lg border border-border p-3"
              >
                <div>
                  <p className="font-medium text-foreground">{product.name}</p>
                  <p className="text-xs text-muted-foreground">
                    Batch: {product.batchNo}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Expiry: {product.expiryDate}
                  </p>
                </div>
                <Badge className={getExpiryBadgeStyle(daysUntilExpiry)}>
                  {daysUntilExpiry} days
                </Badge>
              </div>
            );
          })}
          {expiringProducts.length === 0 && (
            <p className="text-center text-muted-foreground py-4">
              No products expiring soon
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
