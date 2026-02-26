export type AndreaniQuoteRequest = {
  postalCode: string;
  city?: string;
  country?: string;
  weightKg: number;
  volumeCm3?: number;
};

export type AndreaniQuoteOption = {
  serviceId: string;
  serviceName: string;
  price: number;
  estimatedDays?: number;
};

export type AndreaniCreateRequest = {
  orderId: string;
  sender: {
    name: string;
    address: string;
    postalCode: string;
    city: string;
    country: string;
  };
  recipient: {
    name: string;
    address: string;
    postalCode: string;
    city: string;
    country: string;
  };
  packages: Array<{ weightKg: number; declaredValue: number }>;
};

export type AndreaniTracking = {
  status: string;
  history: Array<{ date: string; status: string; detail?: string }>;
};

export interface AndreaniAdapter {
  quote(request: AndreaniQuoteRequest): Promise<AndreaniQuoteOption[]>;
  createShipment(request: AndreaniCreateRequest): Promise<{ trackingCode: string }>;
  track(trackingCode: string): Promise<AndreaniTracking>;
}

export class AndreaniDevelopersAdapter implements AndreaniAdapter {
  constructor(
    private readonly config: {
      loginUrl: string;
      cotizadorUrl: string;
      preenvioUrl: string;
      trackingUrl: string;
      username: string;
      password: string;
      originPostal: string;
      originCity: string;
      originCountry: string;
      contract?: string;
      client?: string;
      category?: string;
    },
  ) {}

  private async getToken() {
    const credentials = Buffer.from(`${this.config.username}:${this.config.password}`).toString("base64");
    const res = await fetch(this.config.loginUrl, {
      method: "GET",
      headers: {
        Authorization: `Basic ${credentials}`,
      },
    });
    if (!res.ok) {
      throw new Error("Andreani auth failed");
    }
    const data = await res.json();
    return data.token;
  }

  async quote(request: AndreaniQuoteRequest) {
    const token = await this.getToken();
    const url = new URL(this.config.cotizadorUrl);
    url.searchParams.set("CpDestino", request.postalCode);
    url.searchParams.set("CiudadDestino", request.city ?? "");
    url.searchParams.set("PaisDestino", request.country ?? "AR");
    url.searchParams.set("CpOrigen", this.config.originPostal);
    url.searchParams.set("CiudadOrigen", this.config.originCity);
    url.searchParams.set("PaisOrigen", this.config.originCountry);
    if (this.config.contract) url.searchParams.set("Contrato", this.config.contract);
    if (this.config.client) url.searchParams.set("Cliente", this.config.client);
    url.searchParams.set("bultos[0].kilos", request.weightKg.toString());
    url.searchParams.set("bultos[0].volumen", String(request.volumeCm3 ?? 1000));
    if (this.config.category) {
      url.searchParams.set("bultos[0].categoriaProducto", this.config.category);
    }

    const res = await fetch(url.toString(), {
      headers: {
        "x-authorization-token": token,
      },
    });
    if (!res.ok) {
      throw new Error("Andreani quote failed");
    }
    const data = await res.json();
    const total = Number(data?.tarifaConIva?.total ?? data?.UltimaMilla ?? 0);
    return [
      {
        serviceId: "andreani",
        serviceName: "Andreani",
        price: total,
      },
    ];
  }

  async createShipment(request: AndreaniCreateRequest) {
    const token = await this.getToken();
    const res = await fetch(this.config.preenvioUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-authorization-token": token,
      },
      body: JSON.stringify({
        IdPedido: request.orderId,
        Origen: {
          Postal: {
            Pais: request.sender.country,
            Localidad: request.sender.city,
            CodigoPostal: request.sender.postalCode,
            Calle: request.sender.address,
          },
        },
        Destino: {
          Postal: {
            Pais: request.recipient.country,
            Localidad: request.recipient.city,
            CodigoPostal: request.recipient.postalCode,
            Calle: request.recipient.address,
          },
        },
      }),
    });
    if (!res.ok) {
      throw new Error("Andreani create failed");
    }
    const data = await res.json();
    return { trackingCode: data.numeroEnvio ?? data.numeroAndreani ?? data.id };
  }

  async track(trackingCode: string) {
    const token = await this.getToken();
    const res = await fetch(`${this.config.trackingUrl}/${trackingCode}/trazas`, {
      headers: { "x-authorization-token": token },
    });
    if (!res.ok) {
      throw new Error("Andreani tracking failed");
    }
    const data = await res.json();
    return {
      status: data.eventos?.[0]?.estado ?? "unknown",
      history: (data.eventos ?? []).map((item: unknown) => ({
        date: item.fecha,
        status: item.estado,
        detail: item.comentario,
      })),
    } as AndreaniTracking;
  }
}
