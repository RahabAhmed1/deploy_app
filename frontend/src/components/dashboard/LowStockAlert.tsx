import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { getProducts } from "@/lib/api";
import { AlertTriangle } from "lucide-react";

export function LowStockAlert() {
  const [lowStockProducts, setLowStockProducts] = useState<Array<{ id: string; name: string; batchNo: string; stockQuantity: number; minStockLevel: number }>>([]);
  useEffect(() => {
    (async () => {
      try {
        const res = await getProducts();
        const items = (res?.products || []).map((p: any) => ({
          id: String(p.id),
          name: p.name || "",
          batchNo: p.batchNo || "",
          stockQuantity: typeof p.stockQuantity === 'number' ? p.stockQuantity : Number(p.stockQuantity || 0),
          minStockLevel: typeof p.minStockLevel === 'number' ? p.minStockLevel : Number(p.minStockLevel || 0),
        }));
        setLowStockProducts(items.filter((p) => p.stockQuantity <= p.minStockLevel));
      } catch (e) {
        console.error(e);
      }
    })();
  }, []);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center gap-2">
        <AlertTriangle className="h-5 w-5 text-destructive" />
        <CardTitle>Low Stock Alerts</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {lowStockProducts.map((product) => {
            const stockPercentage = (product.stockQuantity / product.minStockLevel) * 100;
            return (
              <div key={product.id} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-foreground">{product.name}</p>
                    <p className="text-xs text-muted-foreground">
                      Batch: {product.batchNo}
                    </p>
                  </div>
                  <Badge variant="destructive">
                    {product.stockQuantity} / {product.minStockLevel}
                  </Badge>
                </div>
                <Progress
                  value={stockPercentage}
                  className="h-2"
                />
              </div>
            );
          })}
          {lowStockProducts.length === 0 && (
            <p className="text-center text-muted-foreground py-4">
              All products are well stocked
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
