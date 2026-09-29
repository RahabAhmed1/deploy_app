import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatsCard } from "@/components/dashboard/StatsCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
    Plus,
    Search,
    Truck,
    CheckCircle2,
    Navigation,
    Clock,
    AlertTriangle,
    FileText,
    MapPin,
    Phone,
    ThermometerSnowflake,
    Package,
    Calendar,
    User,
    ClipboardList,
    ShieldCheck
} from "lucide-react";
import { cn } from "@/lib/utils";

const dispatchStats = [
    { title: "Total", value: 4, icon: Truck, variant: "default" },
    { title: "Delivered", value: 1, icon: CheckCircle2, variant: "primary" },
    { title: "In Transit", value: 1, icon: Navigation, variant: "primary" },
    { title: "Pending", value: 1, icon: Clock, variant: "warning" },
    { title: "Failed", value: 1, icon: AlertTriangle, variant: "danger" },
];

const dispatchData = [
    {
        id: "DSP-001",
        date: "2024-01-15",
        orderNo: "ORD-001",
        customer: "MedPlus Pharmacy",
        customerType: "Retailer",
        vehicle: "MH-12-AB-1234",
        driver: "Rajesh Kumar",
        route: "Mumbai — Thane",
        distance: "35 km",
        coldChain: { active: true, temp: "5°C", range: "2-8°C" },
        shipment: { items: 12, details: "4 boxes • 25 kg" },
        documents: { inv: "INV-001", ewb: "EWB-123456" },
        status: "Delivered",
        subStatus: "POD Received"
    },
    {
        id: "DSP-002",
        date: "2024-01-15",
        orderNo: "ORD-002",
        customer: "City Hospital",
        customerType: "Hospital",
        vehicle: "MH-12-CD-5678",
        driver: "Suresh Patil",
        route: "Mumbai — Pune",
        distance: "150 km",
        coldChain: { active: true, temp: "6°C", range: "2-8°C" },
        shipment: { items: 45, details: "15 boxes • 120 kg" },
        documents: { inv: "INV-002", ewb: "EWB-123457" },
        status: "In Transit",
    },
    {
        id: "DSP-003",
        date: "2024-01-14",
        orderNo: "ORD-003",
        customer: "Wellness Distributors",
        customerType: "Wholesaler",
        vehicle: "MH-12-EF-9012",
        driver: "Manoj Singh",
        route: "Mumbai — Nashik",
        distance: "180 km",
        coldChain: { active: false },
        shipment: { items: 30, details: "10 boxes • 80 kg" },
        documents: { inv: "INV-003", ewb: "EWB-123458" },
        status: "Pending",
    },
    {
        id: "DSP-004",
        date: "2024-01-15",
        orderNo: "ORD-004",
        customer: "Apollo Pharmacy",
        customerType: "Retailer",
        vehicle: "MH-12-GH-3456",
        driver: "Vikram Joshi",
        route: "Mumbai — Navi Mumbai",
        distance: "25 km",
        coldChain: { active: true, temp: "12°C", range: "2-8°C", alert: true },
        shipment: { items: 8, details: "3 boxes • 15 kg" },
        documents: { inv: "INV-004", ewb: "EWB-123459" },
        status: "Failed",
    },
];

const statusConfig = {
    "Delivered": {
        bg: "bg-green-50 text-green-600 border-green-100",
        dot: "bg-green-600"
    },
    "In Transit": {
        bg: "bg-blue-50 text-blue-600 border-blue-100",
        dot: "bg-blue-600"
    },
    "Pending": {
        bg: "bg-amber-50 text-amber-600 border-amber-100",
        dot: "bg-amber-600"
    },
    "Failed": {
        bg: "bg-red-50 text-red-600 border-red-100",
        dot: "bg-red-600"
    }
};

const Dispatches = () => {
    const [searchTerm, setSearchTerm] = useState("");

    return (
        <MainLayout>
            <div className="space-y-6">
                {/* Header */}
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <h1 className="text-3xl font-bold text-foreground">Dispatches</h1>
                        <p className="text-muted-foreground">
                            Manage shipments, track deliveries, and monitor cold chain
                        </p>
                    </div>
                    <Dialog>
                        <DialogTrigger asChild>
                            <Button>
                                <Plus className="mr-2 h-4 w-4" /> New Dispatch
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-[800px] h-[90vh] p-0 flex flex-col">
                            <DialogHeader className="p-6 pb-2">
                                <DialogTitle>Create New Dispatch</DialogTitle>
                                <DialogDescription>Register a new dispatch with all relevant logistics and compliance data.</DialogDescription>
                            </DialogHeader>
                            <ScrollArea className="flex-1 px-6 pb-6">
                                <div className="space-y-8 py-4">
                                    {/* Section 1: Order & Customer Details */}
                                    <div className="space-y-4">
                                        <div className="flex items-center gap-2 text-[#10b981] font-semibold border-b pb-2">
                                            <ClipboardList className="h-4 w-4" />
                                            <span className="text-sm">Order & Customer Details</span>
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                            <div className="space-y-2">
                                                <Label className="text-xs">Order ID</Label>
                                                <Select>
                                                    <SelectTrigger className="bg-neutral-50 border-none h-9 text-xs">
                                                        <SelectValue placeholder="Select order" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="ORD-001">ORD-2024-001</SelectItem>
                                                        <SelectItem value="ORD-002">ORD-2024-002</SelectItem>
                                                        <SelectItem value="ORD-003">ORD-2024-003</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div className="space-y-2">
                                                <Label className="text-xs">Customer Name</Label>
                                                <Input readOnly placeholder="Auto-filled from order" className="bg-neutral-50 border-none h-9 text-xs" />
                                            </div>
                                            <div className="space-y-2">
                                                <Label className="text-xs">Customer Type</Label>
                                                <Input readOnly placeholder="Auto-filled from order" className="bg-neutral-50 border-none h-9 text-xs" />
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <Label className="text-xs">Delivery Address</Label>
                                                <Textarea placeholder="Full delivery address" className="bg-neutral-50 border-none resize-none h-20 text-xs text-muted-foreground" />
                                            </div>
                                            <div className="grid grid-cols-1 gap-4">
                                                <div className="space-y-2">
                                                    <Label className="text-xs">Contact Person & Phone</Label>
                                                    <div className="flex gap-2">
                                                        <Input placeholder="Contact name" className="bg-neutral-50 border-none h-9 text-xs" />
                                                        <Input placeholder="Phone number" className="bg-neutral-50 border-none h-9 text-xs" />
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Section 2: Vehicle & Driver Details */}
                                    <div className="space-y-4">
                                        <div className="flex items-center gap-2 text-[#10b981] font-semibold border-b pb-2">
                                            <Truck className="h-4 w-4" />
                                            <span className="text-sm">Vehicle & Driver Details</span>
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                            <div className="space-y-2">
                                                <Label className="text-xs">Vehicle Number</Label>
                                                <Input placeholder="MH-12-XX-0000" className="bg-neutral-50 border-none h-9 text-xs" />
                                            </div>
                                            <div className="space-y-2">
                                                <Label className="text-xs">Vehicle Type</Label>
                                                <Select>
                                                    <SelectTrigger className="bg-neutral-50 border-none h-9 text-xs text-muted-foreground">
                                                        <SelectValue placeholder="Select type" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="van">Refrigerated Van</SelectItem>
                                                        <SelectItem value="truck">Semi-Truck</SelectItem>
                                                        <SelectItem value="small">Small Delivery Van</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div className="space-y-2">
                                                <Label className="text-xs">Vehicle Capacity</Label>
                                                <Input placeholder="e.g., 500 kg" className="bg-neutral-50 border-none h-9 text-xs" />
                                            </div>
                                            <div className="space-y-2">
                                                <Label className="text-xs">Driver Name</Label>
                                                <Input placeholder="Driver full name" className="bg-neutral-50 border-none h-9 text-xs" />
                                            </div>
                                            <div className="space-y-2">
                                                <Label className="text-xs">Driver Phone</Label>
                                                <Input placeholder="+91 XXXXX XXXXX" className="bg-neutral-50 border-none h-9 text-xs" />
                                            </div>
                                            <div className="space-y-2">
                                                <Label className="text-xs">Driver License No.</Label>
                                                <Input placeholder="License number" className="bg-neutral-50 border-none h-9 text-xs" />
                                            </div>
                                            <div className="space-y-2 col-span-1 md:col-span-1">
                                                <Label className="text-xs">GPS Tracker ID</Label>
                                                <Input placeholder="Tracker device ID" className="bg-neutral-50 border-none h-9 text-xs" />
                                            </div>
                                            <div className="space-y-2 col-span-1 md:col-span-2">
                                                <Label className="text-xs">Estimated Route</Label>
                                                <Input placeholder="e.g., Mumbai — Thane" className="bg-neutral-50 border-none h-9 text-xs" />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Section 3: Shipment Details */}
                                    <div className="space-y-4">
                                        <div className="flex items-center gap-2 text-[#10b981] font-semibold border-b pb-2">
                                            <Package className="h-4 w-4" />
                                            <span className="text-sm">Shipment Details</span>
                                        </div>
                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                            <div className="space-y-2">
                                                <Label className="text-xs">Total Items</Label>
                                                <Input type="number" placeholder="0" className="bg-neutral-50 border-none h-9 text-xs" />
                                            </div>
                                            <div className="space-y-2">
                                                <Label className="text-xs">Number of Boxes</Label>
                                                <Input type="number" placeholder="0" className="bg-neutral-50 border-none h-9 text-xs" />
                                            </div>
                                            <div className="space-y-2">
                                                <Label className="text-xs">Total Weight (kg)</Label>
                                                <Input type="number" placeholder="0" className="bg-neutral-50 border-none h-9 text-xs" />
                                            </div>
                                            <div className="space-y-2">
                                                <Label className="text-xs">Total Volume (m³)</Label>
                                                <Input type="number" placeholder="0" className="bg-neutral-50 border-none h-9 text-xs" />
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <Label className="text-xs">Dispatch Date & Time</Label>
                                                <div className="relative">
                                                    <Input type="datetime-local" className="bg-neutral-50 border-none h-9 text-xs text-muted-foreground" />
                                                </div>
                                            </div>
                                            <div className="space-y-2">
                                                <Label className="text-xs">Expected Delivery Date & Time</Label>
                                                <div className="relative">
                                                    <Input type="datetime-local" className="bg-neutral-50 border-none h-9 text-xs text-muted-foreground" />
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Section 4: Cold Chain Requirements */}
                                    <div className="space-y-4">
                                        <div className="flex items-center gap-2 text-[#10b981] font-semibold border-b pb-2">
                                            <ThermometerSnowflake className="h-4 w-4" />
                                            <span className="text-sm">Cold Chain Requirements</span>
                                        </div>
                                        <div className="flex items-center space-x-2">
                                            <Switch id="cold-chain" />
                                            <Label htmlFor="cold-chain" className="text-xs font-medium text-[#10b981]">This shipment requires cold chain</Label>
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                            <div className="space-y-2">
                                                <Label className="text-xs">Min Temperature (°C)</Label>
                                                <Input type="number" defaultValue="2" className="bg-neutral-50 border-none h-9 text-xs" />
                                            </div>
                                            <div className="space-y-2">
                                                <Label className="text-xs">Max Temperature (°C)</Label>
                                                <Input type="number" defaultValue="8" className="bg-neutral-50 border-none h-9 text-xs" />
                                            </div>
                                            <div className="space-y-2">
                                                <Label className="text-xs">Temperature Logger ID</Label>
                                                <Input placeholder="Logger device ID" className="bg-neutral-50 border-none h-9 text-xs" />
                                            </div>
                                            <div className="space-y-2">
                                                <Label className="text-xs">Cold Box Count</Label>
                                                <Input type="number" placeholder="0" className="bg-neutral-50 border-none h-9 text-xs" />
                                            </div>
                                            <div className="space-y-2">
                                                <Label className="text-xs">Ice Pack Count</Label>
                                                <Input type="number" placeholder="0" className="bg-neutral-50 border-none h-9 text-xs" />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Section 5: Documentation */}
                                    <div className="space-y-4">
                                        <div className="flex items-center gap-2 text-[#10b981] font-semibold border-b pb-2">
                                            <FileText className="h-4 w-4" />
                                            <span className="text-sm">Documentation</span>
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                            <div className="space-y-2">
                                                <Label className="text-xs">Invoice Number</Label>
                                                <Input placeholder="INV-XXX" className="bg-neutral-50 border-none h-9 text-xs text-muted-foreground" />
                                            </div>
                                            <div className="space-y-2">
                                                <Label className="text-xs">E-Way Bill Number</Label>
                                                <Input placeholder="EWB-XXXXXX" className="bg-neutral-50 border-none h-9 text-xs text-muted-foreground" />
                                            </div>
                                            <div className="space-y-2">
                                                <Label className="text-xs">Delivery Challan No.</Label>
                                                <Input placeholder="CH-XXX" className="bg-neutral-50 border-none h-9 text-xs" />
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <Label className="text-xs">Drug License Reference</Label>
                                                <Input placeholder="License reference" className="bg-neutral-50 border-none h-9 text-xs text-muted-foreground" />
                                            </div>
                                            <div className="space-y-2">
                                                <Label className="text-xs">GST Invoice Reference</Label>
                                                <Input placeholder="GST reference" className="bg-neutral-50 border-none h-9 text-xs text-muted-foreground" />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Section 6: Priority & Instructions */}
                                    <div className="space-y-4">
                                        <div className="flex items-center gap-2 text-[#10b981] font-semibold border-b pb-2">
                                            <ShieldCheck className="h-4 w-4" />
                                            <span className="text-sm">Priority & Instructions</span>
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <Label className="text-xs">Priority Level</Label>
                                                <Select>
                                                    <SelectTrigger className="bg-neutral-50 border-none h-9 text-xs text-muted-foreground">
                                                        <SelectValue placeholder="Select priority" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="low">Low</SelectItem>
                                                        <SelectItem value="medium">Medium</SelectItem>
                                                        <SelectItem value="high">High</SelectItem>
                                                        <SelectItem value="urgent">Urgent / Life-Saving</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div className="space-y-2">
                                                <Label className="text-xs">Handling Instructions</Label>
                                                <Select>
                                                    <SelectTrigger className="bg-neutral-50 border-none h-9 text-xs text-muted-foreground">
                                                        <SelectValue placeholder="Select handling" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="fragile">Fragile - Handle with Care</SelectItem>
                                                        <SelectItem value="upright">Keep Upright</SelectItem>
                                                        <SelectItem value="no-stack">Do Not Stack</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div className="space-y-2 col-span-1 md:col-span-2">
                                                <Label className="text-xs">Special Instructions / Remarks</Label>
                                                <Textarea placeholder="Any special delivery instructions..." className="bg-neutral-50 border-none resize-none h-20 text-xs text-muted-foreground" />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </ScrollArea>
                            <div className="p-6 pt-2 border-t flex justify-end gap-3 bg-white rounded-b-lg">
                                <Button variant="outline" className="text-xs h-9 px-6 border-neutral-200">Cancel</Button>
                                <Button className="bg-[#10b981] hover:bg-[#059669] text-white text-xs h-9 px-6 font-semibold">Create Dispatch</Button>
                            </div>
                        </DialogContent>
                    </Dialog>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {dispatchStats.map((stat) => (
                        <StatsCard
                            key={stat.title}
                            title={stat.title}
                            value={stat.value}
                            icon={stat.icon}
                            variant={stat.variant as any}
                        />
                    ))}
                </div>

                {/* Filters */}
                < Card >
                    <CardContent className="p-4 flex flex-col md:flex-row gap-4">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Search by ID, customer, driver, vehicle..."
                                className="pl-10"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                        <div className="flex gap-2">
                            <Select defaultValue="all">
                                <SelectTrigger className="w-[160px]">
                                    <SelectValue placeholder="All Status" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Status</SelectItem>
                                    <SelectItem value="delivered">Delivered</SelectItem>
                                    <SelectItem value="transit">In Transit</SelectItem>
                                    <SelectItem value="pending">Pending</SelectItem>
                                    <SelectItem value="failed">Failed</SelectItem>
                                </SelectContent>
                            </Select>
                            <Select defaultValue="all">
                                <SelectTrigger className="w-[160px]">
                                    <SelectValue placeholder="All Vehicles" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Vehicles</SelectItem>
                                    <SelectItem value="mh12">MH-12 Series</SelectItem>
                                    <SelectItem value="truck">Heavy Trucks</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </CardContent>
                </Card >

                {/* Table Section */}
                < Card >
                    <CardHeader>
                        <CardTitle>Dispatch Records ({dispatchData.length})</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Dispatch & Date</TableHead>
                                        <TableHead>Customer & Order</TableHead>
                                        <TableHead>Vehicle & Driver</TableHead>
                                        <TableHead>Route</TableHead>
                                        <TableHead>Shipment</TableHead>
                                        <TableHead>Cold Chain</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead className="text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {dispatchData.map((dispatch) => (
                                        <TableRow key={dispatch.id}>
                                            <TableCell>
                                                <div className="space-y-1">
                                                    <p className="font-medium text-foreground text-primary">{dispatch.id}</p>
                                                    <div className="text-[10px] text-muted-foreground flex items-center gap-1 uppercase">
                                                        <Calendar className="h-3 w-3" /> {dispatch.date}
                                                    </div>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="space-y-1">
                                                    <p className="font-medium text-foreground">{dispatch.customer}</p>
                                                    <div className="flex items-center gap-2">
                                                        <Badge variant="outline" className="text-[10px] h-4 py-0 font-medium">
                                                            {dispatch.customerType}
                                                        </Badge>
                                                        <span className="text-[10px] text-muted-foreground uppercase">{dispatch.orderNo}</span>
                                                    </div>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="space-y-1">
                                                    <p className="text-sm font-medium">{dispatch.vehicle}</p>
                                                    <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                                                        <User className="h-3 w-3" /> {dispatch.driver}
                                                    </div>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="space-y-1">
                                                    <p className="text-sm">{dispatch.route}</p>
                                                    <p className="text-[10px] text-muted-foreground uppercase">{dispatch.distance}</p>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="space-y-1">
                                                    <p className="text-sm font-medium">{dispatch.shipment.items} Items</p>
                                                    <p className="text-[10px] text-muted-foreground uppercase">{dispatch.shipment.details}</p>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                {dispatch.coldChain.active ? (
                                                    <div className="flex flex-col gap-1">
                                                        <div className="flex items-center gap-1.5">
                                                            <ThermometerSnowflake className={cn("h-3.5 w-3.5", dispatch.coldChain.alert ? "text-red-500" : "text-blue-500")} />
                                                            <span className={cn("text-xs font-bold", dispatch.coldChain.alert ? "text-red-600" : "text-blue-600")}>
                                                                {dispatch.coldChain.temp}
                                                            </span>
                                                        </div>
                                                        <div className="h-1 w-12 bg-neutral-100 rounded-full overflow-hidden">
                                                            <div className={cn("h-full w-2/3 rounded-full", dispatch.coldChain.alert ? "bg-red-500" : "bg-blue-500")} />
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <span className="text-xs text-muted-foreground">Standard</span>
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                <Badge className={cn("px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider", statusConfig[dispatch.status as keyof typeof statusConfig]?.bg)}>
                                                    {dispatch.status}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex justify-end gap-2">
                                                    <Button variant="ghost" size="icon">
                                                        <Search className="h-4 w-4" />
                                                    </Button>
                                                    <Button variant="ghost" size="icon">
                                                        <MapPin className="h-4 w-4 text-primary" />
                                                    </Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    </CardContent>
                </Card >
            </div >
        </MainLayout >
    );
};

export default Dispatches;
