import { Injectable } from "@nestjs/common";
import crypto from "node:crypto";

@Injectable()
export class PluginMarketplaceService {
  private controlPlaneUrl = process.env.CONTROL_PLANE_URL ?? "";
  private agentSecret = process.env.AGENT_SECRET ?? "";
  private instanceId = process.env.INSTANCE_ID ?? "";

  private sign(payload: string) {
    if (!this.agentSecret) return "";
    return crypto.createHmac("sha256", this.agentSecret).update(payload).digest("hex");
  }

  async requestPlugin(payload: { pluginName: string; version?: string; action: string }) {
    if (!this.controlPlaneUrl || !this.agentSecret || !this.instanceId) {
      throw new Error("Control-plane not configured");
    }
    const body = {
      instance_id: this.instanceId,
      pluginName: payload.pluginName,
      version: payload.version ?? null,
      action: payload.action,
    };
    const rawBody = JSON.stringify(body);
    const signature = this.sign(rawBody);
    const res = await fetch(`${this.controlPlaneUrl.replace(/\/$/, "")}/api/plugins/requests`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-agent-signature": signature,
      },
      body: rawBody,
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(text || "request failed");
    }
    return res.json();
  }
}
