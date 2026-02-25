import { useEffect, useMemo, useState } from "react";
import { Image, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { BarCodeScanner } from "expo-barcode-scanner";
import type { RoleName, StockLookupResponse } from "@erp/shared";
import { clearToken, getToken, listOrders, login, lookupStock, receiveStock, updateOrderStatus } from "./src/services/api";
import { buildAppPalette, resolveMobileBranding } from "./src/branding/whiteLabel";
import { downloadBrandingConfig, getCachedBrandingConfig } from "./src/services/mobileBranding";

type Screen = "scan" | "receive" | "orders";

export default function App() {
  const [branding, setBranding] = useState(() => resolveMobileBranding());
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

  const palette = useMemo(() => buildAppPalette(branding), [branding]);

  useEffect(() => {
    getToken().then((stored) => {
      if (stored) setToken(stored);
    });
  }, []);

  useEffect(() => {
    getCachedBrandingConfig().then((cached) => {
      if (cached) setBranding(cached as any);
    }).catch(() => undefined);
    downloadBrandingConfig().then((remote) => {
      if (remote) setBranding(remote as any);
    }).catch(() => undefined);
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
    } catch {
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
    } catch {
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
    } catch {
      setError("No se pudo registrar recepción");
    }
  }

  async function loadOrders() {
    if (!token) return;
    setError(null);
    try {
      const data = await listOrders(token, ordersStatus);
      setOrders(data);
    } catch {
      setError("No se pudieron cargar pedidos");
    }
  }

  async function changeStatus(orderId: string, status: "PACKED" | "SHIPPED") {
    if (!token) return;
    setError(null);
    try {
      await updateOrderStatus(token, orderId, { status });
      await loadOrders();
    } catch {
      setError("No se pudo actualizar estado");
    }
  }

  if (!token) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: palette.bg }]}>
        <HeaderBranding branding={branding} palette={palette} />
        <TextInput style={[styles.input, themedInput(palette)]} placeholder="Email" placeholderTextColor={palette.textMuted} value={email} onChangeText={setEmail} />
        <TextInput style={[styles.input, themedInput(palette)]} placeholder="Password" placeholderTextColor={palette.textMuted} secureTextEntry value={password} onChangeText={setPassword} />
        <TouchableOpacity style={[styles.primary, { backgroundColor: palette.primary, borderRadius: palette.radii.md }]} onPress={handleLogin}>
          <Text style={[styles.primaryText, { color: palette.primaryText }]}>Ingresar</Text>
        </TouchableOpacity>
        {error && <Text style={[styles.error, { color: palette.danger }]}>{error}</Text>}
      </SafeAreaView>
    );
  }

  if (!canOperate) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: palette.bg }]}>
        <HeaderBranding branding={branding} palette={palette} />
        <Text style={[styles.title, { color: palette.text }]}>Sin permisos</Text>
        <Text style={{ color: palette.text }}>Tu rol actual no habilita operaciones móviles.</Text>
        <TouchableOpacity style={[styles.secondary, themedSecondary(palette)]} onPress={handleLogout}>
          <Text style={[styles.secondaryText, { color: palette.primary }]}>Cerrar sesión</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: palette.bg }]}>
      <HeaderBranding branding={branding} palette={palette} />
      <Text style={{ color: palette.textMuted, fontSize: 12, marginBottom: 8 }}>
        OTA: {branding.ota.channel} / runtime {branding.ota.runtimeVersion}
      </Text>
      <View style={styles.tabRow}>
        <TouchableOpacity style={screen === "scan" ? [styles.tabActive, { backgroundColor: palette.accent }] : [styles.tab, { backgroundColor: palette.border }]} onPress={() => setScreen("scan")}>
          <Text style={[styles.tabText, { color: palette.text }]}>Scan</Text>
        </TouchableOpacity>
        <TouchableOpacity style={screen === "receive" ? [styles.tabActive, { backgroundColor: palette.accent }] : [styles.tab, { backgroundColor: palette.border }]} onPress={() => setScreen("receive")}>
          <Text style={[styles.tabText, { color: palette.text }]}>Recepción</Text>
        </TouchableOpacity>
        <TouchableOpacity style={screen === "orders" ? [styles.tabActive, { backgroundColor: palette.accent }] : [styles.tab, { backgroundColor: palette.border }]} onPress={() => setScreen("orders")}>
          <Text style={[styles.tabText, { color: palette.text }]}>Picking</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.panel}>
        {screen === "scan" && (
          <View style={{ gap: 12 }}>
            <Text style={[styles.sectionTitle, { color: palette.text }]}>Escaneo de barcode</Text>
            {hasPermission === false && <Text style={{ color: palette.text }}>Permiso de cámara denegado.</Text>}
            {hasPermission && (
              <View style={[styles.cameraBox, { borderRadius: palette.radii.lg }]}>
                <BarCodeScanner onBarCodeScanned={({ data }) => runLookup(data)} style={StyleSheet.absoluteFillObject} />
              </View>
            )}
            <TextInput style={[styles.input, themedInput(palette)]} placeholder="Código manual" placeholderTextColor={palette.textMuted} value={manualCode} onChangeText={setManualCode} />
            <TouchableOpacity style={[styles.primary, { backgroundColor: palette.primary, borderRadius: palette.radii.md }]} onPress={() => runLookup(manualCode)}>
              <Text style={[styles.primaryText, { color: palette.primaryText }]}>Buscar</Text>
            </TouchableOpacity>
            {scanResult && (
              <View style={[styles.card, themedCard(palette)]}>
                <Text style={[styles.cardTitle, { color: palette.text }]}>{scanResult.name}</Text>
                <Text style={{ color: palette.text }}>SKU: {scanResult.sku}</Text>
                <Text style={{ color: palette.text }}>Stock: {scanResult.stock}</Text>
                <Text style={{ color: palette.text }}>Precio: ${scanResult.price}</Text>
              </View>
            )}
          </View>
        )}

        {screen === "receive" && (
          <View style={{ gap: 12 }}>
            <Text style={[styles.sectionTitle, { color: palette.text }]}>Recepción de mercadería</Text>
            <TextInput style={[styles.input, themedInput(palette)]} placeholder="Variant ID" placeholderTextColor={palette.textMuted} value={receiveVariantId} onChangeText={setReceiveVariantId} />
            <TextInput style={[styles.input, themedInput(palette)]} placeholder="Location ID" placeholderTextColor={palette.textMuted} value={receiveLocationId} onChangeText={setReceiveLocationId} />
            <TextInput style={[styles.input, themedInput(palette)]} placeholder="Cantidad" placeholderTextColor={palette.textMuted} keyboardType="numeric" value={receiveQty} onChangeText={setReceiveQty} />
            <TouchableOpacity style={[styles.primary, { backgroundColor: palette.primary, borderRadius: palette.radii.md }]} onPress={submitReceive}>
              <Text style={[styles.primaryText, { color: palette.primaryText }]}>Registrar</Text>
            </TouchableOpacity>
          </View>
        )}

        {screen === "orders" && (
          <View style={{ gap: 12 }}>
            <Text style={[styles.sectionTitle, { color: palette.text }]}>Picking / Packing</Text>
            <TextInput style={[styles.input, themedInput(palette)]} placeholder="Estado (PAID/PACKED)" placeholderTextColor={palette.textMuted} value={ordersStatus} onChangeText={setOrdersStatus} />
            <TouchableOpacity style={[styles.primary, { backgroundColor: palette.primary, borderRadius: palette.radii.md }]} onPress={loadOrders}>
              <Text style={[styles.primaryText, { color: palette.primaryText }]}>Cargar pedidos</Text>
            </TouchableOpacity>
            {orders.map((order) => (
              <View key={order.id} style={[styles.card, themedCard(palette)]}>
                <Text style={[styles.cardTitle, { color: palette.text }]}>Pedido {order.id}</Text>
                <Text style={{ color: palette.text }}>Cliente: {order.customerName}</Text>
                <Text style={{ color: palette.text }}>Estado: {order.status}</Text>
                <Text style={{ color: palette.text }}>Items:</Text>
                {order.items.map((item: any, idx: number) => (
                  <Text key={`${order.id}-${idx}`} style={{ color: palette.text }}>
                    - {item.quantity} x {item.name}
                  </Text>
                ))}
                <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
                  <TouchableOpacity style={[styles.secondary, themedSecondary(palette)]} onPress={() => changeStatus(order.id, "PACKED")}>
                    <Text style={[styles.secondaryText, { color: palette.primary }]}>Marcar PACKED</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.secondary, themedSecondary(palette)]} onPress={() => changeStatus(order.id, "SHIPPED")}>
                    <Text style={[styles.secondaryText, { color: palette.primary }]}>Marcar SHIPPED</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}

        {error && <Text style={[styles.error, { color: palette.danger }]}>{error}</Text>}
        <TouchableOpacity style={[styles.secondary, themedSecondary(palette)]} onPress={handleLogout}>
          <Text style={[styles.secondaryText, { color: palette.primary }]}>Cerrar sesión</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

function HeaderBranding({ branding, palette }: { branding: ReturnType<typeof resolveMobileBranding>; palette: ReturnType<typeof buildAppPalette> }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 12 }}>
      {branding.logoUrl ? (
        <Image source={{ uri: branding.logoUrl }} style={{ width: 32, height: 32, borderRadius: 8 }} />
      ) : (
        <View style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: palette.accent }} />
      )}
      <View>
        <Text style={[styles.title, { marginBottom: 0, color: palette.text }]}>{branding.appName}</Text>
        <Text style={{ color: palette.textMuted, fontSize: 12 }}>{branding.channel.toUpperCase()}</Text>
      </View>
    </View>
  );
}

function themedInput(palette: ReturnType<typeof buildAppPalette>) {
  return {
    backgroundColor: palette.surface,
    borderColor: palette.border,
    borderRadius: palette.radii.md,
    color: palette.text,
  } as const;
}

function themedCard(palette: ReturnType<typeof buildAppPalette>) {
  return {
    backgroundColor: palette.surface,
    borderColor: palette.border,
    borderRadius: palette.radii.lg,
  } as const;
}

function themedSecondary(palette: ReturnType<typeof buildAppPalette>) {
  return {
    backgroundColor: palette.surface,
    borderColor: palette.primary,
    borderRadius: palette.radii.md,
  } as const;
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
