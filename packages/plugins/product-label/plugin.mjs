export const hooks = {
  "product.decorate": ({ product }) => {
    const createdAt = new Date(product.createdAt ?? Date.now());
    const days = (Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24);
    if (days <= 7) {
      return { label: "Nuevo" };
    }
    return null;
  },
};

export const uiSlots = {
  "admin.dashboard": () => ({
    title: "Etiqueta de producto",
    body: "Los productos nuevos se marcan con la etiqueta 'Nuevo' en el storefront.",
  }),
  "storefront.home": () => ({
    title: "Nuevos ingresos",
    body: "Revisá los productos publicados en los últimos 7 días.",
  }),
};
