"use client";

import { useEffect, useMemo, useState } from "react";

type Supplier = { id: string; name: string };
type VariantLine = { variantId: string; quantityOrdered: number; unitCost: number };

type PurchaseOrder = {
  id: string;
  status: string;
  supplier: { name: string };
  items: Array<{
    id: string;
    variant: { sku: string; name: string; barcode?: string | null };
    quantityOrdered: number;
    quantityReceived: number;
    unitCost: string;
  }>;
};

export default function PurchasingPage() {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
  const [token, setToken] = useState("");
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [msg, setMsg] = useState<string | null>(null);

  const [supplierName, setSupplierName] = useState("");
  const [selectedSupplier, setSelectedSupplier] = useState("");
  const [lines, setLines] = useState<VariantLine[]>([{ variantId: "", quantityOrdered: 1, unitCost: 0 }]);

  const [receiveOrderId, setReceiveOrderId] = useState("");
  const [barcode, setBarcode] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [receiveCost, setReceiveCost] = useState(0);

  const headers = useMemo(
    () => ({ Authorization: `Bearer ${token}`, "Content-Type": "application/json" }),
    [token],
  );

  async function loadAll() {
    setMsg(null);
    const [sRes, oRes] = await Promise.all([
      fetch(`${apiUrl}/purchasing/suppliers`, { headers: { Authorization: `Bearer ${token}` } }),
      fetch(`${apiUrl}/purchasing/orders`, { headers: { Authorization: `Bearer ${token}` } }),
    ]);
    if (!sRes.ok || !oRes.ok) {
      setMsg("No se pudo cargar compras");
      return;
    }
    setSuppliers(await sRes.json());
    const ordersData: PurchaseOrder[] = await oRes.json();
    setOrders(ordersData);
    if (!receiveOrderId && ordersData.length > 0) {
      setReceiveOrderId(ordersData[0].id);
    }
  }

  useEffect(() => {
    if (token) void loadAll();
  }, [token]);

  async function createSupplier() {
    const res = await fetch(`${apiUrl}/purchasing/suppliers`, {
      method: "POST",
      headers,
      body: JSON.stringify({ name: supplierName }),
    });
    if (!res.ok) return setMsg("Error creando proveedor");
    setSupplierName("");
    await loadAll();
  }

  async function createPo() {
    const res = await fetch(`${apiUrl}/purchasing/orders`, {
      method: "POST",
      headers,
      body: JSON.stringify({ supplierId: selectedSupplier, items: lines }),
    });
    if (!res.ok) return setMsg("Error creando PO");
    setMsg("PO creada");
    await loadAll();
  }

  async function approvePo(id: string) {
    const res = await fetch(`${apiUrl}/purchasing/orders/${id}/approve`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return setMsg("Error aprobando PO");
    await loadAll();
  }

  async function receiveGoods() {
    if (!receiveOrderId) return;
    const body: unknown = { items: [{ barcode, quantityReceived: quantity, unitCost: receiveCost }] };
    const res = await fetch(`${apiUrl}/purchasing/orders/${receiveOrderId}/receive`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });
    if (!res.ok) return setMsg("Error recibiendo mercadería");
    setMsg("Recepción registrada");
    setBarcode("");
    setQuantity(1);
    await loadAll();
  }

  const selectedOrder = orders.find((o) => o.id === receiveOrderId);

  return (
    <main style={{ padding: 24, display: "grid", gap: 16 }}>
      <h1>Compras</h1>
      <label>
        JWT
        <input value={token} onChange={(e) => setToken(e.target.value)} />
      </label>
      {msg && <p>{msg}</p>}

      <section className="card">
        <h2>Proveedores</h2>
        <div style={{ display: "flex", gap: 8 }}>
          <input placeholder="Nombre proveedor" value={supplierName} onChange={(e) => setSupplierName(e.target.value)} />
          <button onClick={createSupplier}>Crear</button>
        </div>
      </section>

      <section className="card">
        <h2>Nueva Orden de Compra</h2>
        <select value={selectedSupplier} onChange={(e) => setSelectedSupplier(e.target.value)}>
          <option value="">Proveedor</option>
          {suppliers.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>

        {lines.map((line, idx) => (
          <div key={idx} style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 8, marginTop: 8 }}>
            <input
              placeholder="Variant ID"
              value={line.variantId}
              onChange={(e) => {
                const next = [...lines];
                next[idx] = { ...line, variantId: e.target.value };
                setLines(next);
              }}
            />
            <input
              type="number"
              value={line.quantityOrdered}
              onChange={(e) => {
                const next = [...lines];
                next[idx] = { ...line, quantityOrdered: Number(e.target.value) };
                setLines(next);
              }}
            />
            <input
              type="number"
              value={line.unitCost}
              onChange={(e) => {
                const next = [...lines];
                next[idx] = { ...line, unitCost: Number(e.target.value) };
                setLines(next);
              }}
            />
          </div>
        ))}
        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
          <button onClick={() => setLines([...lines, { variantId: "", quantityOrdered: 1, unitCost: 0 }])}>Agregar ítem</button>
          <button onClick={createPo}>Crear PO</button>
        </div>
      </section>

      <section className="card">
        <h2>Recepción (scanner barcode)</h2>
        <select value={receiveOrderId} onChange={(e) => setReceiveOrderId(e.target.value)}>
          <option value="">Seleccionar PO</option>
          {orders.map((o) => (
            <option key={o.id} value={o.id}>{o.id.slice(0, 8)} - {o.supplier.name} - {o.status}</option>
          ))}
        </select>
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 8, marginTop: 8 }}>
          <input placeholder="Barcode" value={barcode} onChange={(e) => setBarcode(e.target.value)} />
          <input type="number" value={quantity} onChange={(e) => setQuantity(Number(e.target.value))} />
          <input type="number" value={receiveCost} onChange={(e) => setReceiveCost(Number(e.target.value))} placeholder="Costo" />
        </div>
        <button style={{ marginTop: 8 }} onClick={receiveGoods}>Registrar recepción</button>

        {selectedOrder && (
          <table style={{ width: "100%", marginTop: 12, fontSize: 12 }}>
            <thead>
              <tr><th align="left">SKU</th><th align="left">Producto</th><th align="left">Ordenado</th><th align="left">Recibido</th><th align="left">Dif.</th></tr>
            </thead>
            <tbody>
              {selectedOrder.items.map((item) => (
                <tr key={item.id}>
                  <td>{item.variant.sku}</td>
                  <td>{item.variant.name}</td>
                  <td>{item.quantityOrdered}</td>
                  <td>{item.quantityReceived}</td>
                  <td>{item.quantityReceived - item.quantityOrdered}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="card">
        <h2>Órdenes de compra</h2>
        {orders.map((order) => (
          <div key={order.id} style={{ borderBottom: "1px solid #ddd", padding: "8px 0" }}>
            <strong>{order.id.slice(0, 8)}</strong> - {order.supplier.name} - {order.status}
            {order.status === "DRAFT" && <button style={{ marginLeft: 8 }} onClick={() => approvePo(order.id)}>Aprobar</button>}
          </div>
        ))}
      </section>
    </main>
  );
}
