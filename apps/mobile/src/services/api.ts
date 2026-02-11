import AsyncStorage from "@react-native-async-storage/async-storage";
import type {
  MobileLoginResponse,
  StockLookupResponse,
  ReceiveStockRequest,
  FulfillmentOrder,
  UpdateOrderStatusRequest,
} from "@erp/shared";

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3001";

async function request<T>(path: string, options: RequestInit = {}) {
  const res = await fetch(`${API_URL}${path}`, options);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Request failed: ${res.status}`);
  }
  return (await res.json()) as T;
}

export async function login(email: string, password: string): Promise<MobileLoginResponse> {
  const data = await request<MobileLoginResponse>("/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  await AsyncStorage.setItem("mobile_token", data.accessToken);
  return data;
}

export async function getToken() {
  return AsyncStorage.getItem("mobile_token");
}

export async function clearToken() {
  return AsyncStorage.removeItem("mobile_token");
}

export async function lookupStock(token: string, code: string): Promise<StockLookupResponse> {
  return request<StockLookupResponse>(`/stock/lookup?code=${encodeURIComponent(code)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function receiveStock(token: string, payload: ReceiveStockRequest) {
  return request("/stock/movements/receive", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  });
}

export async function listOrders(token: string, status?: string): Promise<FulfillmentOrder[]> {
  const query = status ? `?status=${encodeURIComponent(status)}` : "";
  return request<FulfillmentOrder[]>(`/fulfillment/orders${query}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function updateOrderStatus(token: string, orderId: string, payload: UpdateOrderStatusRequest) {
  return request(`/fulfillment/orders/${orderId}/status`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  });
}
