import { Card, CardContent } from "@/components/ui/card";
import { LucideIcon, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatsCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  variant?: 'default' | 'primary' | 'warning' | 'danger';
}

const variantStyles = {
  default: 'bg-card backdrop-blur-sm border-border/50',
  primary: 'bg-primary/5 border-primary/20',
  warning: 'bg-amber-50/50 border-amber-200/50',
  danger: 'bg-red-50/50 border-red-200/50',
};

const iconVariantStyles = {
  default: 'bg-muted text-muted-foreground',
  primary: 'bg-primary text-primary-foreground shadow-sm shadow-primary/20',
  warning: 'bg-amber-100 text-amber-600',
  danger: 'bg-red-100 text-red-600',
};

export function StatsCard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  variant = 'default',
}: StatsCardProps) {
  return (
    <Card className={cn(
      "relative overflow-hidden transition-all duration-300 hover:scale-[1.02] hover:shadow-xl group",
      variantStyles[variant]
    )}>
      <div className="absolute top-0 right-0 -tr-4 opacity-5 pointer-events-none group-hover:scale-110 transition-transform">
        <Icon className="h-24 w-24" />
      </div>
      <CardContent className="p-6 relative">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{title}</p>
            <div className="flex items-baseline gap-2">
              <p className="text-3xl font-bold text-foreground tracking-tight">{value}</p>
              {trend && (
                <span
                  className={cn(
                    "text-xs font-bold px-1.5 py-0.5 rounded-full flex items-center gap-0.5",
                    trend.isPositive ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"
                  )}
                >
                  {trend.isPositive ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                  {Math.abs(trend.value)}%
                </span>
              )}
            </div>
            {subtitle && (
              <p className="text-[11px] text-muted-foreground font-medium italic mt-1">{subtitle}</p>
            )}
          </div>
          <div
            className={cn(
              "flex h-12 w-12 items-center justify-center rounded-2xl transform transition-transform group-hover:rotate-12",
              iconVariantStyles[variant]
            )}
          >
            <Icon className="h-6 w-6" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
