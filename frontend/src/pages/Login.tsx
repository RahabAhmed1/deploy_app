import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Pill, User, Lock, ArrowRight, Eye, EyeOff } from "lucide-react";
import { login, waitForApi } from "@/lib/api";
import { toast } from "@/components/ui/sonner";

const LoginPage = () => {
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [identifier, setIdentifier] = useState("");
    const [password, setPassword] = useState("");
    const navigate = useNavigate();

    useEffect(() => {
        const root = typeof document !== 'undefined' ? (document.getElementById('root') as HTMLElement | null) : null;
        const prev = {
            htmlOverflow: typeof document !== 'undefined' ? document.documentElement.style.overflow : '',
            bodyOverflow: typeof document !== 'undefined' ? document.body.style.overflow : '',
            bodyHeight: typeof document !== 'undefined' ? document.body.style.height : '',
            rootPadding: root ? root.style.padding : '',
            rootMaxWidth: root ? root.style.maxWidth : '',
            rootMargin: root ? root.style.margin : '',
            rootHeight: root ? root.style.height : '',
            rootOverflow: root ? root.style.overflow : '',
        };

        try {
            document.documentElement.style.overflow = 'hidden';
            document.body.style.overflow = 'hidden';
            document.body.style.height = '100vh';
            if (root) {
                root.style.padding = '0';
                root.style.maxWidth = 'none';
                root.style.margin = '0';
                root.style.height = '100vh';
                root.style.overflow = 'hidden';
            }
        } catch {}

        return () => {
            try {
                document.documentElement.style.overflow = prev.htmlOverflow;
                document.body.style.overflow = prev.bodyOverflow;
                document.body.style.height = prev.bodyHeight;
                if (root) {
                    root.style.padding = prev.rootPadding;
                    root.style.maxWidth = prev.rootMaxWidth;
                    root.style.margin = prev.rootMargin;
                    root.style.height = prev.rootHeight;
                    root.style.overflow = prev.rootOverflow;
                }
            } catch {}
        };
    }, []);

    const handleLogin = async (e?: React.FormEvent) => {
        e?.preventDefault();
        try {
            setIsLoading(true);
            const res = await login(identifier, password);
            localStorage.setItem("token", res.token);
            localStorage.setItem("user", JSON.stringify(res.user));
            toast.success("Signed in successfully");
            const perms = Array.isArray((res.user as any)?.permissions) ? (res.user as any).permissions as string[] : [];
            const isAdmin = (res.user as any)?.role === "admin";
            const routeMap: Array<{ perm: string; path: string }> = [
              { perm: "view_dashboard", path: "/dashboard" },
              { perm: "view_products", path: "/products" },
              { perm: "view_orders", path: "/orders" },
              { perm: "view_walk_in", path: "/walk-in" },
              { perm: "view_invoices", path: "/invoices" },
              { perm: "view_customers", path: "/customers" },
              { perm: "view_suppliers", path: "/suppliers" },
              { perm: "view_purchases", path: "/purchases" },
              { perm: "view_payments", path: "/payments" },
              { perm: "view_expenses", path: "/expenses" },
              { perm: "view_returns", path: "/returns" },
              { perm: "view_ledger", path: "/ledger" },
              { perm: "view_daily_pl", path: "/daily-pl" },
              { perm: "view_reports_sales", path: "/reports/sales" },
              { perm: "view_reports_stock", path: "/reports/stock" },
              { perm: "view_reports_financial", path: "/reports/financial" },
            ];
            const target = isAdmin ? "/dashboard" : (routeMap.find(r => perms.includes(r.perm))?.path || "");
            if (target) {
              navigate(target);
            } else {
              toast.error("No page access assigned. Ask an admin to grant permissions.");
            }
        } catch (err: any) {
            toast.error(err?.message || "Login failed");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        try {
            if (typeof window !== "undefined" && (window as any).pharmaflow) {
                setIdentifier((v) => v || "admin");
                setPassword((v) => v || "123");
                const t = localStorage.getItem("token");
                if (!t) {
                    (async () => {
                        try {
                            await waitForApi(20000);
                            await handleLogin();
                        } catch (e) {
                            // Swallow error; UI will show toast on manual attempt
                        }
                    })();
                }
            }
        } catch {}
    }, []);

    return (
        <div className="min-h-screen w-full flex items-center justify-center overflow-hidden bg-background p-4 sm:p-0">
            {/* Background Decorations */}
            <div className="hidden sm:block absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/5 rounded-full blur-[120px] pointer-events-none" />
            <div className="hidden sm:block absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-primary/10 rounded-full blur-[120px] pointer-events-none" />

            <div className="w-full max-w-[440px] px-4 relative z-10">
                {/* Logo Section */}
                <div className="flex flex-col items-center mb-8">
                    <div className="h-16 w-16 bg-primary rounded-2xl flex items-center justify-center shadow-lg shadow-primary/20 mb-4 animate-in fade-in zoom-in duration-700">
                        <Pill className="h-10 w-10 text-white" />
                    </div>
                    <h1 className="text-3xl font-bold tracking-tight text-foreground">PharmaFlow <span className="text-primary">Pro</span></h1>
                    <p className="text-muted-foreground mt-2 text-sm">Nexus of Pharmaceutical Excellence</p>
                </div>

                <Card className="border-border/50 shadow-lg sm:shadow-2xl shadow-primary/10 backdrop-blur-sm bg-card/90 animate-in fade-in slide-in-from-bottom-8 duration-700 w-full">
                    <CardHeader className="space-y-1 pb-4">
                        <CardTitle className="text-2xl text-center">Welcome Back</CardTitle>
                        <CardDescription className="text-center">
                            Authorized access only. Please sign in to continue.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <form onSubmit={handleLogin} className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="email">Email or Username</Label>
                                <div className="relative">
                                    <Input
                                        id="email"
                                        placeholder="admin@pharmaflow.pro"
                                        type="text"
                                        required
                                        value={identifier}
                                        onChange={(e) => setIdentifier(e.target.value)}
                                        className="h-12 pl-10 bg-background/50 border-border focus:border-primary focus:ring-primary/10 transition-all rounded-xl shadow-sm text-sm sm:text-base"
                                    />
                                    <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <Label htmlFor="password">Password</Label>
                                </div>
                                <div className="relative">
                                    <Input
                                        id="password"
                                        type={showPassword ? "text" : "password"}
                                        required
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="h-12 pl-10 pr-10 bg-background/50 border-border focus:border-primary focus:ring-primary/10 transition-all rounded-xl shadow-sm text-sm sm:text-base"
                                    />
                                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground hover:text-foreground transition-colors"
                                    >
                                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                    </button>
                                </div>
                            </div>

                            <div className="flex items-center space-x-2 py-2">
                                <Switch id="remember" className="data-[state=checked]:bg-primary" />
                                <Label htmlFor="remember" className="text-sm font-normal text-muted-foreground cursor-pointer">
                                    Remember me for 30 days
                                </Label>
                            </div>

                            <Button
                                type="submit"
                                className="w-full h-12 text-base font-semibold transition-all rounded-xl shadow-lg shadow-primary/20 mt-2"
                                disabled={isLoading}
                            >
                                {isLoading ? (
                                    <div className="flex items-center gap-2">
                                        <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        Authenticating...
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-2">
                                        Sign In <ArrowRight className="h-4 w-4" />
                                    </div>
                                )}
                            </Button>
                        </form>
                    </CardContent>
                    <CardFooter className="flex flex-col border-t border-border p-6 bg-muted/20 rounded-b-3xl">
                        <p className="text-xs sm:text-sm text-center text-muted-foreground">
                            Protected by industry-grade encryption.
                        </p>
                    </CardFooter>
                </Card>

                {/* Footer text */}
                <div className="mt-8 text-center text-xs text-muted-foreground/60">
                    &copy; 2024 PharmaFlow Pro. All rights reserved.
                </div>
            </div>
        </div>
    );
};

export default LoginPage;
