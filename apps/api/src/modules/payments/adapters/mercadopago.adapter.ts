import { MercadoPagoConfig, Preference, Payment as MpPayment } from "mercadopago";

export class MercadoPagoAdapter {
  private client: MercadoPagoConfig;

  constructor(private readonly config: { accessToken: string }) {
    this.client = new MercadoPagoConfig({ accessToken: config.accessToken });
  }

  async createPreference(payload: {
    items: Array<{ title: string; quantity: number; unit_price: number; currency_id?: string }>;
    external_reference: string;
    back_urls?: { success?: string; failure?: string; pending?: string };
    notification_url?: string;
  }) {
    const preference = new Preference(this.client);
    return preference.create({ body: payload as any });
  }

  async getPayment(paymentId: string) {
    const payment = new MpPayment(this.client);
    return payment.get({ id: paymentId });
  }

  private async request<T = any>(method: string, path: string, body?: any): Promise<T> {
    const res = await fetch(`https://api.mercadopago.com${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${this.config.accessToken}`,
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`mercadopago_${method.toLowerCase()}_${path}_failed:${res.status}:${text.slice(0, 500)}`);
    }
    return (await res.json()) as T;
  }

  async createPreapproval(payload: {
    reason: string;
    external_reference: string;
    payer_email?: string;
    back_url?: string;
    status?: "authorized" | "pending" | "paused";
    auto_recurring: {
      frequency: number;
      frequency_type: "months";
      transaction_amount: number;
      currency_id: string;
      start_date?: string;
      end_date?: string;
    };
  }) {
    return this.request("POST", "/preapproval", payload);
  }

  async updatePreapproval(
    preapprovalId: string,
    payload: Partial<{
      reason: string;
      status: "authorized" | "pending" | "paused" | "cancelled";
      back_url: string;
      auto_recurring: {
        frequency: number;
        frequency_type: "months";
        transaction_amount: number;
        currency_id: string;
      };
      next_payment_date: string;
    }>,
  ) {
    return this.request("PUT", `/preapproval/${encodeURIComponent(preapprovalId)}`, payload);
  }

  async getPreapproval(preapprovalId: string) {
    return this.request("GET", `/preapproval/${encodeURIComponent(preapprovalId)}`);
  }
}
