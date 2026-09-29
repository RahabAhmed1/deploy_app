const runtimeApiBase = (typeof window !== 'undefined' && (window as any)?.pharmaflow?.apiBaseUrl) as string | undefined;
// In Docker/K8s: VITE_API_BASE_URL is set to empty string, use relative URL (nginx proxies /api/*)
// In Electron/local: falls back to localhost:5000
const envApiBase = import.meta.env.VITE_API_BASE_URL;
export const apiBaseUrl = runtimeApiBase || (envApiBase === '__RELATIVE__' ? '' : (envApiBase || 'http://localhost:5000'));

function authHeaders(extra?: Record<string, string>) {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  const base: Record<string, string> = { ...(extra || {}) };
  if (token) base.Authorization = `Bearer ${token}`;
  return base;
}

export async function waitForApi(timeoutMs = 20000) {
  const start = Date.now();
  let lastErr: any = null;
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`${apiBaseUrl}/health`, { cache: 'no-store' });
      if (res.ok) return true;
    } catch (e) {
      lastErr = e;
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw lastErr || new Error('API not reachable');
}

export async function login(identifier: string, password: string) {
  const res = await fetch(`${apiBaseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier, password }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data?.ok) {
    throw new Error(data?.error || 'Login failed');
  }
  return data as { ok: true; token: string; user: { id: string; username: string; role: string } };
}

export async function createProduct(payload: any) {
  const res = await fetch(`${apiBaseUrl}/api/products`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || 'Failed to create product');
  }
  return res.json();
}

export async function getProducts() {
  const res = await fetch(`${apiBaseUrl}/api/products`);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || 'Failed to fetch products');
  }
  return res.json();
}

export async function updateProduct(id: string, payload: any) {
  const res = await fetch(`${apiBaseUrl}/api/products/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || 'Failed to update product');
  }
  return res.json();
}

export async function deleteProduct(id: string) {
  const res = await fetch(`${apiBaseUrl}/api/products/${id}`, { method: 'DELETE' });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || 'Failed to delete product');
  }
  return res.json();
}

// Product Batches
export async function getProductBatches(params?: { productId?: string }) {
  const query = new URLSearchParams();
  if (params?.productId) query.set('productId', params.productId);
  const qs = query.toString();
  const url = `${apiBaseUrl}/api/product-batches${qs ? `?${qs}` : ''}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function createProductBatch(payload: any) {
  const res = await fetch(`${apiBaseUrl}/api/product-batches`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function getStockMovements() {
  const res = await fetch(`${apiBaseUrl}/api/stock-movements`);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || 'Failed to fetch stock movements');
  }
  return res.json();
}

export async function createStockMovement(payload: any) {
  const res = await fetch(`${apiBaseUrl}/api/stock-movements`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || 'Failed to create stock movement');
  }
  return res.json();
}

export async function updateStockMovement(id: string, payload: any) {
  const res = await fetch(`${apiBaseUrl}/api/stock-movements/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || 'Failed to update stock movement');
  }
  return res.json();
}

export async function deleteStockMovement(id: string) {
  const res = await fetch(`${apiBaseUrl}/api/stock-movements/${id}`, { method: 'DELETE' });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || 'Failed to delete stock movement');
  }
  return res.json();
}

// Customers
export async function getCustomers() {
  const res = await fetch(`${apiBaseUrl}/api/customers`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function createCustomer(payload: any) {
  const res = await fetch(`${apiBaseUrl}/api/customers`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function updateCustomer(id: string, payload: any) {
  const res = await fetch(`${apiBaseUrl}/api/customers/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function deleteCustomer(id: string) {
  const res = await fetch(`${apiBaseUrl}/api/customers/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

// Orders
export async function getOrders() {
  const res = await fetch(`${apiBaseUrl}/api/orders`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function createOrder(payload: any) {
  const res = await fetch(`${apiBaseUrl}/api/orders`, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function updateOrderStatus(id: string, status: string) {
  const res = await fetch(`${apiBaseUrl}/api/orders/${id}/status`, {
    method: 'PATCH',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ status }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function updateOrder(id: string, payload: any) {
  const res = await fetch(`${apiBaseUrl}/api/orders/${id}`, {
    method: 'PUT',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function deleteOrder(id: string) {
  const res = await fetch(`${apiBaseUrl}/api/orders/${id}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function convertOrderEstimateToSale(id: string) {
  const res = await fetch(`${apiBaseUrl}/api/orders/${id}/convert-to-sale`, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({}),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

// Returns
export async function getReturns() {
  const res = await fetch(`${apiBaseUrl}/api/returns`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function createReturn(payload: any) {
  const res = await fetch(`${apiBaseUrl}/api/returns`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function updateReturnStatus(id: string, status: string) {
  const res = await fetch(`${apiBaseUrl}/api/returns/${id}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

// Supplier Returns
export async function getSupplierReturns() {
  const res = await fetch(`${apiBaseUrl}/api/supplier-returns`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function createSupplierReturn(payload: any) {
  const res = await fetch(`${apiBaseUrl}/api/supplier-returns`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function updateSupplierReturnStatus(id: string, status: string) {
  const res = await fetch(`${apiBaseUrl}/api/supplier-returns/${id}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

// Payments
export async function getPayments() {
  const res = await fetch(`${apiBaseUrl}/api/payments`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function createPayment(payload: any) {
  const res = await fetch(`${apiBaseUrl}/api/payments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

// Dashboard
export async function getDashboardStats() {
  const res = await fetch(`${apiBaseUrl}/api/dashboard`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

// Reports
export async function getSalesSeries() {
  const res = await fetch(`${apiBaseUrl}/api/reports/sales-series`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function getCategoryShare() {
  const res = await fetch(`${apiBaseUrl}/api/reports/category-share`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function getRevenueByCustomerType() {
  const res = await fetch(`${apiBaseUrl}/api/reports/revenue-by-customer-type`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function getProductSalesHistory(params: { productId: string; limit?: number }) {
  const query = new URLSearchParams();
  query.set('productId', params.productId);
  if (params.limit !== undefined) query.set('limit', String(params.limit));
  const qs = query.toString();
  const url = `${apiBaseUrl}/api/reports/product-sales-history${qs ? `?${qs}` : ''}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

// Invoices
export async function getInvoices() {
  const res = await fetch(`${apiBaseUrl}/api/invoices`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function createInvoice(payload: any) {
  const res = await fetch(`${apiBaseUrl}/api/invoices`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

// Invoice details by number (used in Returns form)
export async function getInvoiceByNumber(invoiceNo: string) {
  const res = await fetch(`${apiBaseUrl}/api/invoices/by-number/${encodeURIComponent(invoiceNo)}`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

// Settings
export async function getCompanyInfo() {
  const res = await fetch(`${apiBaseUrl}/api/settings/company`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function saveCompanyInfo(payload: any) {
  const res = await fetch(`${apiBaseUrl}/api/settings/company`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function getAppConfig() {
  const res = await fetch(`${apiBaseUrl}/api/settings/config`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function saveAppConfig(payload: any) {
  const res = await fetch(`${apiBaseUrl}/api/settings/config`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

// Users
export async function getUsers() {
  const res = await fetch(`${apiBaseUrl}/api/users`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function createUser(payload: any) {
  const res = await fetch(`${apiBaseUrl}/api/users`, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function updateUser(id: string, payload: any) {
  const res = await fetch(`${apiBaseUrl}/api/users/${id}`, {
    method: 'PUT',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function deleteUser(id: string) {
  const res = await fetch(`${apiBaseUrl}/api/users/${id}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

// Suppliers
export async function getSuppliers() {
  const res = await fetch(`${apiBaseUrl}/api/suppliers`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function createSupplier(payload: any) {
  const res = await fetch(`${apiBaseUrl}/api/suppliers`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function updateSupplier(id: string, payload: any) {
  const res = await fetch(`${apiBaseUrl}/api/suppliers/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function deleteSupplier(id: string) {
  const res = await fetch(`${apiBaseUrl}/api/suppliers/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

// Purchases
export async function getPurchases(params?: { supplierId?: string; supplierName?: string }) {
  const query = new URLSearchParams();
  if (params?.supplierId) query.set('supplierId', params.supplierId);
  if (params?.supplierName) query.set('supplierName', params.supplierName);
  const qs = query.toString();
  const url = `${apiBaseUrl}/api/purchases${qs ? `?${qs}` : ''}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function createPurchase(payload: any) {
  const res = await fetch(`${apiBaseUrl}/api/purchases`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function updatePurchase(id: string, payload: any) {
  const res = await fetch(`${apiBaseUrl}/api/purchases/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function postPurchase(id: string) {
  const res = await fetch(`${apiBaseUrl}/api/purchases/${id}/post`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function deletePurchase(id: string) {
  const res = await fetch(`${apiBaseUrl}/api/purchases/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

// Supplier Payments
export async function getSupplierPayments(params?: { supplierId?: string; purchaseId?: string }) {
  const query = new URLSearchParams();
  if (params?.supplierId) query.set('supplierId', params.supplierId);
  if (params?.purchaseId) query.set('purchaseId', params.purchaseId);
  const qs = query.toString();
  const url = `${apiBaseUrl}/api/supplier-payments${qs ? `?${qs}` : ''}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function createSupplierPayment(payload: any) {
  const res = await fetch(`${apiBaseUrl}/api/supplier-payments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

// Expenses
export async function getExpenses(params?: { from?: string; to?: string }) {
  const query = new URLSearchParams();
  if (params?.from) query.set('from', params.from);
  if (params?.to) query.set('to', params.to);
  const qs = query.toString();
  const url = `${apiBaseUrl}/api/expenses${qs ? `?${qs}` : ''}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function createExpense(payload: any) {
  const res = await fetch(`${apiBaseUrl}/api/expenses`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function deleteExpense(id: string) {
  const res = await fetch(`${apiBaseUrl}/api/expenses/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
