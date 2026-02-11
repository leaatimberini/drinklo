const DB_NAME = "erp-pos";
const DB_VERSION = 1;

export type CatalogItem = {
  productId: string;
  variantId: string;
  name: string;
  sku: string;
  barcode?: string | null;
  price: number;
  stock: number;
  updatedAt: string;
};

export type OfflineSaleDraft = {
  clientTxnId: string;
  items: Array<{ productId: string; variantId?: string; quantity: number }>;
  discount: number;
  paymentMethod: "cash" | "card" | "transfer";
  paidAmount: number;
  localCreatedAt?: string;
};

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains("catalog")) {
        db.createObjectStore("catalog", { keyPath: "variantId" });
      }
      if (!db.objectStoreNames.contains("drafts")) {
        db.createObjectStore("drafts", { keyPath: "clientTxnId" });
      }
      if (!db.objectStoreNames.contains("meta")) {
        db.createObjectStore("meta", { keyPath: "key" });
      }
    };
    request.onsuccess = () => resolve(request.result);
  });
}

function wrapRequest<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function waitForTx(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onabort = () => reject(tx.error);
    tx.onerror = () => reject(tx.error);
  });
}

export async function saveCatalog(items: CatalogItem[]) {
  const db = await openDb();
  const tx = db.transaction("catalog", "readwrite");
  const store = tx.objectStore("catalog");
  for (const item of items) {
    store.put(item);
  }
  await waitForTx(tx);
}

export async function getCatalog(): Promise<CatalogItem[]> {
  const db = await openDb();
  const tx = db.transaction("catalog", "readonly");
  const store = tx.objectStore("catalog");
  return wrapRequest(store.getAll());
}

export async function clearCatalog() {
  const db = await openDb();
  const tx = db.transaction("catalog", "readwrite");
  tx.objectStore("catalog").clear();
  await waitForTx(tx);
}

export async function saveDraft(draft: OfflineSaleDraft) {
  const db = await openDb();
  const tx = db.transaction("drafts", "readwrite");
  tx.objectStore("drafts").put(draft);
  await waitForTx(tx);
}

export async function getDrafts(): Promise<OfflineSaleDraft[]> {
  const db = await openDb();
  const tx = db.transaction("drafts", "readonly");
  return wrapRequest(tx.objectStore("drafts").getAll());
}

export async function deleteDraft(clientTxnId: string) {
  const db = await openDb();
  const tx = db.transaction("drafts", "readwrite");
  tx.objectStore("drafts").delete(clientTxnId);
  await waitForTx(tx);
}

export async function getMeta<T = string>(key: string): Promise<T | null> {
  const db = await openDb();
  const tx = db.transaction("meta", "readonly");
  const record = await wrapRequest(tx.objectStore("meta").get(key));
  return record?.value ?? null;
}

export async function setMeta<T = string>(key: string, value: T) {
  const db = await openDb();
  const tx = db.transaction("meta", "readwrite");
  tx.objectStore("meta").put({ key, value });
  await waitForTx(tx);
}
