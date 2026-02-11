import { Injectable } from "@nestjs/common";
import { chromium } from "playwright";

@Injectable()
export class PdfService {
  renderQuoteTemplate(quote: any) {
    const rows = quote.items
      .map(
        (item: any) => `
        <tr>
          <td>${item.name}</td>
          <td>${item.sku ?? ""}</td>
          <td>${item.quantity}</td>
          <td>${Number(item.unitPrice)}</td>
          <td>${Number(item.total)}</td>
        </tr>`,
      )
      .join("");

    return `
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; padding: 24px; }
            h1 { margin-bottom: 8px; }
            table { width: 100%; border-collapse: collapse; margin-top: 16px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background: #f4f4f4; }
            .totals { margin-top: 16px; }
          </style>
        </head>
        <body>
          <h1>Presupuesto</h1>
          <p>Cliente: ${quote.customerName}</p>
          <p>Fecha: ${new Date(quote.createdAt).toLocaleDateString()}</p>
          <table>
            <thead>
              <tr>
                <th>Producto</th>
                <th>SKU</th>
                <th>Cant.</th>
                <th>Precio</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              ${rows}
            </tbody>
          </table>
          <div class="totals">
            <p>Subtotal: ${Number(quote.subtotal)}</p>
            <p>Descuento: ${Number(quote.discount)}</p>
            <p><strong>Total: ${Number(quote.total)} ${quote.currency}</strong></p>
          </div>
        </body>
      </html>
    `;
  }

  renderOrderTemplate(order: any) {
    const rows = order.items
      .map(
        (item: any) => `
        <tr>
          <td>${item.name}</td>
          <td>${item.sku ?? ""}</td>
          <td>${item.quantity}</td>
          <td>${Number(item.unitPrice)}</td>
        </tr>`,
      )
      .join("");

    const total = order.items.reduce(
      (sum: number, item: any) => sum + Number(item.unitPrice) * item.quantity,
      0,
    );

    return `
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; padding: 24px; }
            h1 { margin-bottom: 8px; }
            table { width: 100%; border-collapse: collapse; margin-top: 16px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background: #f4f4f4; }
            .totals { margin-top: 16px; }
          </style>
        </head>
        <body>
          <h1>Orden #${order.id}</h1>
          <p>Cliente: ${order.customerName}</p>
          <p>Fecha: ${new Date(order.createdAt).toLocaleDateString()}</p>
          <table>
            <thead>
              <tr>
                <th>Producto</th>
                <th>SKU</th>
                <th>Cant.</th>
                <th>Precio</th>
              </tr>
            </thead>
            <tbody>
              ${rows}
            </tbody>
          </table>
          <div class="totals">
            <p>Envío: ${Number(order.shippingCost)}</p>
            <p><strong>Total: ${Number(order.shippingCost) + total} ${order.currency ?? "ARS"}</strong></p>
          </div>
        </body>
      </html>
    `;
  }

  renderInvoiceTemplate(invoice: any) {
    return `
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; padding: 24px; }
            h1 { margin-bottom: 8px; }
            .meta { margin-top: 12px; }
          </style>
        </head>
        <body>
          <h1>Factura ${invoice.type} ${invoice.pointOfSale}-${invoice.number}</h1>
          <div class="meta">
            <p>CAE: ${invoice.cae}</p>
            <p>Vencimiento CAE: ${new Date(invoice.caeDue).toLocaleDateString()}</p>
            <p>Total: ${Number(invoice.total)} ${invoice.currency}</p>
            <p>Estado: ${invoice.status}</p>
          </div>
        </body>
      </html>
    `;
  }

  async renderPdf(html: string) {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle" });
    const buffer = await page.pdf({ format: "A4" });
    await browser.close();
    return buffer;
  }
}
