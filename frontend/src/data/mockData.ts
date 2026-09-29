// Mock data for PharmaFlow Pro Distribution Management System

export interface Product {
  id: string;
  name: string;
  genericName: string;
  manufacturer: string;
  category: string;
  batchNo: string;
  expiryDate: string;
  manufacturingDate: string;
  mrp: number;
  purchasePrice: number;
  stockQuantity: number;
  minStockLevel: number;
  unit: string;
  gstRate: number;
  status: 'active' | 'low-stock' | 'expired' | 'discontinued';
}

export interface Customer {
  id: string;
  name: string;
  type: 'distributor' | 'wholesaler' | 'retailer' | 'hospital';
  contactPerson: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  state: string;
  creditLimit: number;
  outstandingBalance: number;
  gstNo: string;
  drugLicenseNo: string;
  status: 'active' | 'inactive' | 'blocked';
}

export interface Order {
  id: string;
  orderNo: string;
  customerId: string;
  customerName: string;
  customerType: string;
  orderDate: string;
  deliveryDate: string | null;
  totalAmount: number;
  discountAmount: number;
  taxAmount: number;
  netAmount: number;
  status: 'pending' | 'approved' | 'dispatched' | 'delivered' | 'cancelled';
  paymentStatus: 'unpaid' | 'partial' | 'paid';
  items: OrderItem[];
}

export interface OrderItem {
  productId: string;
  productName: string;
  batchNo: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  tax: number;
  total: number;
}

export interface StockMovement {
  id: string;
  date: string;
  productId: string;
  productName: string;
  batchNo: string;
  type: 'in' | 'out' | 'return' | 'damaged';
  quantity: number;
  reference: string;
  remarks: string;
}

export interface Payment {
  id: string;
  date: string;
  customerId: string;
  customerName: string;
  orderId: string;
  amount: number;
  method: 'cash' | 'bank' | 'cheque' | 'upi';
  reference: string;
  status: 'completed' | 'pending' | 'failed';
}

export const products: Product[] = [
  {
    id: 'P001',
    name: 'Paracetamol 500mg',
    genericName: 'Paracetamol',
    manufacturer: 'Cipla Ltd',
    category: 'Analgesics',
    batchNo: 'BAT2024001',
    expiryDate: '2026-06-15',
    manufacturingDate: '2024-06-15',
    mrp: 25.50,
    purchasePrice: 18.00,
    stockQuantity: 5000,
    minStockLevel: 500,
    unit: 'Strip',
    gstRate: 12,
    status: 'active'
  },
  {
    id: 'P002',
    name: 'Amoxicillin 500mg',
    genericName: 'Amoxicillin',
    manufacturer: 'Sun Pharma',
    category: 'Antibiotics',
    batchNo: 'BAT2024002',
    expiryDate: '2025-03-20',
    manufacturingDate: '2024-03-20',
    mrp: 85.00,
    purchasePrice: 62.00,
    stockQuantity: 250,
    minStockLevel: 300,
    unit: 'Strip',
    gstRate: 12,
    status: 'low-stock'
  },
  {
    id: 'P003',
    name: 'Metformin 500mg',
    genericName: 'Metformin HCl',
    manufacturer: 'Dr. Reddy\'s',
    category: 'Antidiabetic',
    batchNo: 'BAT2024003',
    expiryDate: '2026-09-10',
    manufacturingDate: '2024-09-10',
    mrp: 45.00,
    purchasePrice: 32.00,
    stockQuantity: 3500,
    minStockLevel: 400,
    unit: 'Strip',
    gstRate: 5,
    status: 'active'
  },
  {
    id: 'P004',
    name: 'Omeprazole 20mg',
    genericName: 'Omeprazole',
    manufacturer: 'Lupin Ltd',
    category: 'Antacids',
    batchNo: 'BAT2024004',
    expiryDate: '2025-01-25',
    manufacturingDate: '2024-01-25',
    mrp: 65.00,
    purchasePrice: 45.00,
    stockQuantity: 120,
    minStockLevel: 200,
    unit: 'Strip',
    gstRate: 12,
    status: 'low-stock'
  },
  {
    id: 'P005',
    name: 'Aspirin 75mg',
    genericName: 'Aspirin',
    manufacturer: 'Zydus Cadila',
    category: 'Cardiovascular',
    batchNo: 'BAT2024005',
    expiryDate: '2025-12-01',
    manufacturingDate: '2023-12-01',
    mrp: 35.00,
    purchasePrice: 24.00,
    stockQuantity: 4200,
    minStockLevel: 500,
    unit: 'Strip',
    gstRate: 5,
    status: 'active'
  },
  {
    id: 'P006',
    name: 'Cetirizine 10mg',
    genericName: 'Cetirizine',
    manufacturer: 'Cipla Ltd',
    category: 'Antihistamines',
    batchNo: 'BAT2024006',
    expiryDate: '2026-04-18',
    manufacturingDate: '2024-04-18',
    mrp: 28.00,
    purchasePrice: 19.00,
    stockQuantity: 2800,
    minStockLevel: 300,
    unit: 'Strip',
    gstRate: 12,
    status: 'active'
  }
];

export const customers: Customer[] = [
  {
    id: 'C001',
    name: 'MedPlus Distributors',
    type: 'distributor',
    contactPerson: 'Rajesh Kumar',
    phone: '+91 9876543210',
    email: 'rajesh@medplus.com',
    address: '123 Industrial Area',
    city: 'Mumbai',
    state: 'Maharashtra',
    creditLimit: 500000,
    outstandingBalance: 125000,
    gstNo: '27AABCU9603R1ZM',
    drugLicenseNo: 'DL-MH-2024-001',
    status: 'active'
  },
  {
    id: 'C002',
    name: 'City Pharma Wholesale',
    type: 'wholesaler',
    contactPerson: 'Amit Sharma',
    phone: '+91 9876543211',
    email: 'amit@citypharma.com',
    address: '456 Market Street',
    city: 'Delhi',
    state: 'Delhi',
    creditLimit: 300000,
    outstandingBalance: 85000,
    gstNo: '07AABCU9603R1ZM',
    drugLicenseNo: 'DL-DL-2024-002',
    status: 'active'
  },
  {
    id: 'C003',
    name: 'HealthFirst Retail',
    type: 'retailer',
    contactPerson: 'Priya Patel',
    phone: '+91 9876543212',
    email: 'priya@healthfirst.com',
    address: '789 Main Road',
    city: 'Bangalore',
    state: 'Karnataka',
    creditLimit: 100000,
    outstandingBalance: 45000,
    gstNo: '29AABCU9603R1ZM',
    drugLicenseNo: 'DL-KA-2024-003',
    status: 'active'
  },
  {
    id: 'C004',
    name: 'Apollo Hospital',
    type: 'hospital',
    contactPerson: 'Dr. Suresh Reddy',
    phone: '+91 9876543213',
    email: 'pharmacy@apollo.com',
    address: '321 Healthcare Lane',
    city: 'Hyderabad',
    state: 'Telangana',
    creditLimit: 1000000,
    outstandingBalance: 320000,
    gstNo: '36AABCU9603R1ZM',
    drugLicenseNo: 'DL-TG-2024-004',
    status: 'active'
  }
];

export const orders: Order[] = [
  {
    id: 'O001',
    orderNo: 'ORD-2024-001',
    customerId: 'C001',
    customerName: 'MedPlus Distributors',
    customerType: 'distributor',
    orderDate: '2024-12-28',
    deliveryDate: null,
    totalAmount: 125000,
    discountAmount: 6250,
    taxAmount: 14250,
    netAmount: 133000,
    status: 'pending',
    paymentStatus: 'unpaid',
    items: [
      { productId: 'P001', productName: 'Paracetamol 500mg', batchNo: 'BAT2024001', quantity: 1000, unitPrice: 18.00, discount: 5, tax: 12, total: 19152 },
      { productId: 'P003', productName: 'Metformin 500mg', batchNo: 'BAT2024003', quantity: 800, unitPrice: 32.00, discount: 5, tax: 5, total: 25536 }
    ]
  },
  {
    id: 'O002',
    orderNo: 'ORD-2024-002',
    customerId: 'C002',
    customerName: 'City Pharma Wholesale',
    customerType: 'wholesaler',
    orderDate: '2024-12-27',
    deliveryDate: '2024-12-30',
    totalAmount: 85000,
    discountAmount: 4250,
    taxAmount: 9690,
    netAmount: 90440,
    status: 'dispatched',
    paymentStatus: 'partial',
    items: [
      { productId: 'P002', productName: 'Amoxicillin 500mg', batchNo: 'BAT2024002', quantity: 500, unitPrice: 62.00, discount: 5, tax: 12, total: 32922 }
    ]
  },
  {
    id: 'O003',
    orderNo: 'ORD-2024-003',
    customerId: 'C003',
    customerName: 'HealthFirst Retail',
    customerType: 'retailer',
    orderDate: '2024-12-26',
    deliveryDate: '2024-12-28',
    totalAmount: 45000,
    discountAmount: 2250,
    taxAmount: 5130,
    netAmount: 47880,
    status: 'delivered',
    paymentStatus: 'paid',
    items: [
      { productId: 'P005', productName: 'Aspirin 75mg', batchNo: 'BAT2024005', quantity: 600, unitPrice: 24.00, discount: 5, tax: 5, total: 14364 },
      { productId: 'P006', productName: 'Cetirizine 10mg', batchNo: 'BAT2024006', quantity: 400, unitPrice: 19.00, discount: 5, tax: 12, total: 8056 }
    ]
  },
  {
    id: 'O004',
    orderNo: 'ORD-2024-004',
    customerId: 'C004',
    customerName: 'Apollo Hospital',
    customerType: 'hospital',
    orderDate: '2024-12-29',
    deliveryDate: null,
    totalAmount: 320000,
    discountAmount: 16000,
    taxAmount: 36480,
    netAmount: 340480,
    status: 'approved',
    paymentStatus: 'unpaid',
    items: [
      { productId: 'P001', productName: 'Paracetamol 500mg', batchNo: 'BAT2024001', quantity: 3000, unitPrice: 18.00, discount: 5, tax: 12, total: 57456 },
      { productId: 'P002', productName: 'Amoxicillin 500mg', batchNo: 'BAT2024002', quantity: 2000, unitPrice: 62.00, discount: 5, tax: 12, total: 131688 }
    ]
  }
];

export const stockMovements: StockMovement[] = [
  { id: 'SM001', date: '2024-12-29', productId: 'P001', productName: 'Paracetamol 500mg', batchNo: 'BAT2024001', type: 'in', quantity: 2000, reference: 'PO-2024-089', remarks: 'Regular stock replenishment' },
  { id: 'SM002', date: '2024-12-28', productId: 'P001', productName: 'Paracetamol 500mg', batchNo: 'BAT2024001', type: 'out', quantity: 1000, reference: 'ORD-2024-001', remarks: 'Order dispatch' },
  { id: 'SM003', date: '2024-12-27', productId: 'P002', productName: 'Amoxicillin 500mg', batchNo: 'BAT2024002', type: 'out', quantity: 500, reference: 'ORD-2024-002', remarks: 'Order dispatch' },
  { id: 'SM004', date: '2024-12-26', productId: 'P004', productName: 'Omeprazole 20mg', batchNo: 'BAT2024004', type: 'return', quantity: 50, reference: 'RET-2024-001', remarks: 'Customer return - near expiry' },
  { id: 'SM005', date: '2024-12-25', productId: 'P003', productName: 'Metformin 500mg', batchNo: 'BAT2024003', type: 'damaged', quantity: 25, reference: 'DMG-2024-001', remarks: 'Damaged during handling' }
];

export const payments: Payment[] = [
  { id: 'PAY001', date: '2024-12-28', customerId: 'C003', customerName: 'HealthFirst Retail', orderId: 'O003', amount: 47880, method: 'bank', reference: 'TXN123456789', status: 'completed' },
  { id: 'PAY002', date: '2024-12-27', customerId: 'C002', customerName: 'City Pharma Wholesale', orderId: 'O002', amount: 50000, method: 'cheque', reference: 'CHQ-987654', status: 'pending' },
  { id: 'PAY003', date: '2024-12-26', customerId: 'C001', customerName: 'MedPlus Distributors', orderId: 'O001', amount: 75000, method: 'upi', reference: 'UPI-456789123', status: 'completed' }
];

export const dashboardStats = {
  totalProducts: 156,
  lowStockItems: 12,
  expiringItems: 8,
  totalOrders: 245,
  pendingOrders: 18,
  totalCustomers: 89,
  totalRevenue: 2850000,
  outstandingReceivables: 575000,
  todaySales: 125000,
  monthlyGrowth: 12.5
};

export const salesData = [
  { month: 'Jul', sales: 185000, orders: 32 },
  { month: 'Aug', sales: 210000, orders: 38 },
  { month: 'Sep', sales: 195000, orders: 35 },
  { month: 'Oct', sales: 245000, orders: 42 },
  { month: 'Nov', sales: 280000, orders: 48 },
  { month: 'Dec', sales: 320000, orders: 55 }
];

export const categoryData = [
  { name: 'Analgesics', value: 28 },
  { name: 'Antibiotics', value: 22 },
  { name: 'Antidiabetic', value: 18 },
  { name: 'Cardiovascular', value: 15 },
  { name: 'Antacids', value: 10 },
  { name: 'Others', value: 7 }
];

export const revenueByCustomerType = [
  { type: 'Distributors', revenue: 1200000, percentage: 42 },
  { type: 'Wholesalers', revenue: 850000, percentage: 30 },
  { type: 'Retailers', revenue: 450000, percentage: 16 },
  { type: 'Hospitals', revenue: 350000, percentage: 12 }
];
