import crypto from "crypto";
import fs from "fs";

export type WsaaConfig = {
  certPath?: string;
  keyPath?: string;
  certPem?: string;
  keyPem?: string;
  cuit: string;
  environment: "HOMO" | "PROD";
};

export class WsaaClient {
  constructor(private readonly config: WsaaConfig) {}

  loadCert() {
    if (this.config.certPem) {
      return this.config.certPem;
    }
    if (!this.config.certPath) {
      throw new Error("AFIP cert path not configured");
    }
    return fs.readFileSync(this.config.certPath, "utf8");
  }

  loadKey() {
    if (this.config.keyPem) {
      return this.config.keyPem;
    }
    if (!this.config.keyPath) {
      throw new Error("AFIP key path not configured");
    }
    return fs.readFileSync(this.config.keyPath, "utf8");
  }

  async getToken() {
    // Stub: build TRA, sign with X.509 and call WSAA
    // Return token/sign
    const token = crypto.randomBytes(16).toString("hex");
    const sign = crypto.randomBytes(16).toString("hex");
    return { token, sign, generatedAt: new Date() };
  }
}
