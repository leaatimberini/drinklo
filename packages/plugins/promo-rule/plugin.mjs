export const hooks = {
  "pricing.unitPrice": ({ item }) => {
    if (item.quantity >= 6) {
      return { unitPrice: Math.round(item.unitPrice * 0.9), label: "Promo x6" };
    }
    return null;
  },
};

export const uiSlots = {
  "admin.dashboard": () => ({
    title: "Regla promo",
    body: "Descuento 10% para items con cantidad >= 6.",
  }),
};
