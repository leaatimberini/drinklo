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
    return preference.create({ body: payload });
  }

  async getPayment(paymentId: string) {
    const payment = new MpPayment(this.client);
    return payment.get({ id: paymentId });
  }
}
