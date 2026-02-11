import { useEffect, useMemo, useState } from "react";
import { SafeAreaView, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { BarCodeScanner } from "expo-barcode-scanner";
import type { RoleName, StockLookupResponse } from "@erp/shared";
import { clearToken, getToken, listOrders, login, lookupStock, receiveStock, updateOrderStatus } from "./src/services/api";

type Screen = "scan" | "receive" | "orders";

export default function App() {
  const [token, setToken] = useState<string | null>(null);
  const [role, setRole] = useState<RoleName | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [screen, setScreen] = useState<Screen>("scan");
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [manualCode, setManualCode] = useState("");
  const [scanResult, setScanResult] = useState<StockLookupResponse | null>(null);
  const [receiveVariantId, setReceiveVariantId] = useState("");
  const [receiveLocationId, setReceiveLocationId] = useState("");
  const [receiveQty, setReceiveQty] = useState("1");
  const [orders, setOrders] = useState<any[]>([]);
  const [ordersStatus, setOrdersStatus] = useState("PAID");

  useEffect(() => {
    getToken().then((stored) => {
      if (stored) setToken(stored);
    });
  }, []);

  useEffect(() => {
    BarCodeScanner.requestPermissionsAsync().then(({ status }) => {
      setHasPermission(status === "granted");
    });
  }, []);

  const canOperate = useMemo(() => {
    return role === "admin" || role === "manager" || role === "deposito" || role === "caja";
  }, [role]);

  async function handleLogin() {
    setError(null);
    try {
      const res = await login(email, password);
      setToken(res.accessToken);
      setRole(res.user.role);
    } catch (err) {
      setError("Credenciales inválidas");
    }
  }

  async function handleLogout() {
    await clearToken();
    setToken(null);
    setRole(null);
  }

  async function runLookup(code: string) {
    if (!token) return;
    setError(null);
    try {
      const data = await lookupStock(token, code);
      setScanResult(data);
      setReceiveVariantId(data.variantId);
    } catch (err) {
      setError("No se encontró el producto");
    }
  }

  async function submitReceive() {
    if (!token) return;
    setError(null);
    try {
      await receiveStock(token, {
        variantId: receiveVariantId,
        locationId: receiveLocationId,
        quantity: Number(receiveQty),
        reason: "receive",
      });
      setError("Recepción registrada");
    } catch (err) {
      setError("No se pudo registrar recepción");
    }
  }

  async function loadOrders() {
    if (!token) return;
    setError(null);
    try {
      const data = await listOrders(token, ordersStatus);
      setOrders(data);
    } catch (err) {
      setError("No se pudieron cargar pedidos");
    }
  }

  async function changeStatus(orderId: string, status: "PACKED" | "SHIPPED") {
    if (!token) return;
    setError(null);
    try {
      await updateOrderStatus(token, orderId, { status });
      await loadOrders();
    } catch (err) {
      setError("No se pudo actualizar estado");
    }
  }

  if (!token) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.title}>ERP Mobile</Text>
        <TextInput style={styles.input} placeholder="Email" value={email} onChangeText={setEmail} />
        <TextInput style={styles.input} placeholder="Password" secureTextEntry value={password} onChangeText={setPassword} />
        <TouchableOpacity style={styles.primary} onPress={handleLogin}>
          <Text style={styles.primaryText}>Ingresar</Text>
        </TouchableOpacity>
        {error && <Text style={styles.error}>{error}</Text>}
      </SafeAreaView>
    );
  }

  if (!canOperate) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.title}>Sin permisos</Text>
        <Text>Tu rol actual no habilita operaciones móviles.</Text>
        <TouchableOpacity style={styles.secondary} onPress={handleLogout}>
          <Text style={styles.secondaryText}>Cerrar sesión</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>ERP Mobile</Text>
      <View style={styles.tabRow}>
        <TouchableOpacity style={screen === "scan" ? styles.tabActive : styles.tab} onPress={() => setScreen("scan")}>
          <Text style={styles.tabText}>Scan</Text>
        </TouchableOpacity>
        <TouchableOpacity style={screen === "receive" ? styles.tabActive : styles.tab} onPress={() => setScreen("receive")}>
          <Text style={styles.tabText}>Recepción</Text>
        </TouchableOpacity>
        <TouchableOpacity style={screen === "orders" ? styles.tabActive : styles.tab} onPress={() => setScreen("orders")}>
          <Text style={styles.tabText}>Picking</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.panel}>
        {screen === "scan" && (
          <View style={{ gap: 12 }}>
            <Text style={styles.sectionTitle}>Escaneo de barcode</Text>
            {hasPermission === false && <Text>Permiso de cámara denegado.</Text>}
            {hasPermission && (
              <View style={styles.cameraBox}>
                <BarCodeScanner
                  onBarCodeScanned={({ data }) => runLookup(data)}
                  style={StyleSheet.absoluteFillObject}
                />
              </View>
            )}
            <TextInput
              style={styles.input}
              placeholder="Código manual"
              value={manualCode}
              onChangeText={setManualCode}
            />
            <TouchableOpacity style={styles.primary} onPress={() => runLookup(manualCode)}>
              <Text style={styles.primaryText}>Buscar</Text>
            </TouchableOpacity>

            {scanResult && (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>{scanResult.name}</Text>
                <Text>SKU: {scanResult.sku}</Text>
                <Text>Stock: {scanResult.stock}</Text>
                <Text>Precio: ${scanResult.price}</Text>
              </View>
            )}
          </View>
        )}

        {screen === "receive" && (
          <View style={{ gap: 12 }}>
            <Text style={styles.sectionTitle}>Recepción de mercadería</Text>
            <TextInput
              style={styles.input}
              placeholder="Variant ID"
              value={receiveVariantId}
              onChangeText={setReceiveVariantId}
            />
            <TextInput
              style={styles.input}
              placeholder="Location ID"
              value={receiveLocationId}
              onChangeText={setReceiveLocationId}
            />
            <TextInput
              style={styles.input}
              placeholder="Cantidad"
              keyboardType="numeric"
              value={receiveQty}
              onChangeText={setReceiveQty}
            />
            <TouchableOpacity style={styles.primary} onPress={submitReceive}>
              <Text style={styles.primaryText}>Registrar</Text>
            </TouchableOpacity>
          </View>
        )}

        {screen === "orders" && (
          <View style={{ gap: 12 }}>
            <Text style={styles.sectionTitle}>Picking / Packing</Text>
            <TextInput
              style={styles.input}
              placeholder="Estado (PAID/PACKED)"
              value={ordersStatus}
              onChangeText={setOrdersStatus}
            />
            <TouchableOpacity style={styles.primary} onPress={loadOrders}>
              <Text style={styles.primaryText}>Cargar pedidos</Text>
            </TouchableOpacity>
            {orders.map((order) => (
              <View key={order.id} style={styles.card}>
                <Text style={styles.cardTitle}>Pedido {order.id}</Text>
                <Text>Cliente: {order.customerName}</Text>
                <Text>Estado: {order.status}</Text>
                <Text>Items:</Text>
                {order.items.map((item: any, idx: number) => (
                  <Text key={`${order.id}-${idx}`}>- {item.quantity} x {item.name}</Text>
                ))}
                <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
                  <TouchableOpacity style={styles.secondary} onPress={() => changeStatus(order.id, "PACKED")}>
                    <Text style={styles.secondaryText}>Marcar PACKED</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.secondary} onPress={() => changeStatus(order.id, "SHIPPED")}>
                    <Text style={styles.secondaryText}>Marcar SHIPPED</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}

        {error && <Text style={styles.error}>{error}</Text>}
        <TouchableOpacity style={styles.secondary} onPress={handleLogout}>
          <Text style={styles.secondaryText}>Cerrar sesión</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f6f6f6",
    padding: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    marginBottom: 12,
  },
  input: {
    backgroundColor: "#fff",
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  primary: {
    backgroundColor: "#111",
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  primaryText: {
    color: "#fff",
    fontWeight: "600",
  },
  secondary: {
    backgroundColor: "#fff",
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#111",
    alignItems: "center",
  },
  secondaryText: {
    color: "#111",
  },
  error: {
    color: "#dc2626",
    marginTop: 8,
  },
  tabRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 12,
  },
  tab: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: "#e5e7eb",
    borderRadius: 6,
  },
  tabActive: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: "#f97316",
    borderRadius: 6,
  },
  tabText: {
    color: "#111",
    fontWeight: "600",
  },
  panel: {
    paddingBottom: 24,
    gap: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
  },
  cameraBox: {
    height: 220,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#111",
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    gap: 4,
  },
  cardTitle: {
    fontWeight: "700",
  },
});
