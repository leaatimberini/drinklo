import Link from "next/link";
import { prisma } from "../lib/prisma";
import { computeRatingSummary } from "../lib/plugin-marketplace-public";

export const dynamic = "force-dynamic";

export default async function PublicMarketplacePage() {
  const releases = await prisma.pluginRelease.findMany({
    where: { reviewStatus: "approved" },
    include: {
      publisher: { select: { name: true } },
      reviews: { where: { status: "PUBLISHED" }, select: { rating: true } },
    },
    orderBy: [{ name: "asc" }, { createdAt: "desc" }],
    take: 500,
  });

  const latestByPlugin = new Map<string, (typeof releases)[number]>();
  for (const release of releases) {
    if (!latestByPlugin.has(release.name)) latestByPlugin.set(release.name, release);
  }

  const items = Array.from(latestByPlugin.values());

  return (
    <main>
      <h1>Plugin Marketplace (Public)</h1>
      <p>Discover approved plugins, compatibility and community reviews.</p>
      <section className="card">
        {items.length === 0 ? <p>No plugins published yet.</p> : null}
        {items.map((release) => {
          const rating = computeRatingSummary(release.reviews);
          return (
            <div key={release.id} style={{ borderBottom: "1px solid #eee", padding: "10px 0" }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <Link href={`/marketplace/plugins/${encodeURIComponent(release.name)}`}>
                  <strong>{release.name}</strong>
                </Link>
                <span>{release.version}</span>
                <span>({release.channel})</span>
                {release.certified ? (
                  <span style={{ background: "#e8fff1", color: "#166534", padding: "2px 6px", borderRadius: 6 }}>
                    Certified
                  </span>
                ) : (
                  <span style={{ background: "#f3f4f6", color: "#4b5563", padding: "2px 6px", borderRadius: 6 }}>
                    Community
                  </span>
                )}
              </div>
              <div>Publisher: {release.publisher?.name ?? "-"}</div>
              <div>Compatibility: {release.compatibility ?? "see matrix"}</div>
              <div>
                Rating: {rating.average.toFixed(2)} / 5 ({rating.count} reviews)
              </div>
            </div>
          );
        })}
      </section>
    </main>
  );
}
