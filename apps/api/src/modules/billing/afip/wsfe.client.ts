export type WsfeConfig = {
  cuit: string;
  environment: "HOMO" | "PROD";
  token: string;
  sign: string;
};

export class WsfeClient {
  constructor(private readonly config: WsfeConfig) {}

  async requestCae(payload: {
    type: "A" | "B" | "C" | "M";
    pointOfSale: number;
    number: number;
    total: number;
    currency: string;
  }) {
    // Stub: call WSFEv1 with token/sign and return CAE
    return {
      cae: `CAE-${payload.type}-${payload.number}`,
      caeDue: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      result: "A",
      raw: payload,
    };
  }
}
