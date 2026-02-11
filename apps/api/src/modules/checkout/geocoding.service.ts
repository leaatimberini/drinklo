import { Injectable } from "@nestjs/common";

export type GeoPoint = { lat: number; lng: number };

@Injectable()
export class GeocodingService {
  async geocode(address: string): Promise<GeoPoint> {
    const url = new URL("https://nominatim.openstreetmap.org/search");
    url.searchParams.set("q", address);
    url.searchParams.set("format", "json");
    url.searchParams.set("limit", "1");

    const res = await fetch(url.toString(), {
      headers: {
        "User-Agent": "erp-monorepo/1.0",
      },
    });

    if (!res.ok) {
      throw new Error("Geocoding failed");
    }

    const data = (await res.json()) as Array<{ lat: string; lon: string }>;
    if (!data[0]) {
      throw new Error("Address not found");
    }

    return { lat: Number(data[0].lat), lng: Number(data[0].lon) };
  }
}
