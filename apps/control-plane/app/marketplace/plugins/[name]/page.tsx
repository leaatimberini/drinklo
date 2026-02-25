import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "../../../lib/prisma";
import { computeRatingSummary, normalizeCompatibilityMatrix } from "../../../lib/plugin-marketplace-public";
import { ReviewForm } from "./ReviewForm";

export const dynamic = "force-dynamic";

export default async function PublicPluginPage({ params }: { params: Promise<{ name: string }> }) {
  const { name: rawName } = await params;
  const name = decodeURIComponent(rawName);

  const releases = await prisma.pluginRelease.findMany({
    where: { name, reviewStatus: "approved" },
    include: {
      publisher: { select: { id: true, name: true, verificationStatus: true } },
      reviews: {
        where: { status: "PUBLISHED" },
        orderBy: { createdAt: "desc" },
        take: 50,
      },
    },
    orderBy: [{ createdAt: "desc" }],
    take: 20,
  });

  if (releases.length === 0) return notFound();

  const latest = releases[0];
  const allReviews = releases.flatMap((r) => r.reviews);
  const rating = computeRatingSummary(allReviews);

  return (
    <main>
      <p>
        <Link href="/marketplace">Marketplace</Link> / <strong>{name}</strong>
      </p>
      <h1>
        {name} {latest.certified ? <span style={{ color: "#166534" }}>Certified</span> : null}
      </h1>
      <p>
        Latest release: {latest.version} ({latest.channel}) by {latest.publisher?.name ?? "-"}
      </p>
      <p>
        Rating: {rating.average.toFixed(2)} / 5 ({rating.count} reviews)
      </p>

      <section className="card" style={{ marginBottom: 16 }}>
        <h2>Compatibility Matrix</h2>
        {normalizeCompatibilityMatrix((latest as any).compatibilityMatrix).length > 0 ? (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th align="left">Platform</th>
                <th align="left">Status</th>
                <th align="left">Notes</th>
              </tr>
            </thead>
            <tbody>
              {normalizeCompatibilityMatrix((latest as any).compatibilityMatrix).map((row) => (
                <tr key={row.platformVersion}>
                  <td>{row.platformVersion}</td>
                  <td>{row.status}</td>
                  <td>{row.notes ?? "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p>{latest.compatibility ?? "No explicit matrix provided"}</p>
        )}
      </section>

      <section className="card" style={{ marginBottom: 16 }}>
        <h2>Changelog</h2>
        {releases.map((release) => (
          <details key={release.id} open={release.id === latest.id} style={{ borderBottom: "1px solid #eee", padding: "8px 0" }}>
            <summary>
              {release.version} ({release.channel}) {release.certified ? "- Certified" : ""}
            </summary>
            <div>Compatibility: {release.compatibility ?? "-"}</div>
            <div>Permissions: {release.permissions.join(", ") || "-"}</div>
            <div>Dependencies: {release.dependencies.join(", ") || "-"}</div>
            <pre style={{ background: "#f7f7f7", padding: 8, whiteSpace: "pre-wrap" }}>
              {release.changelog ?? "No changelog provided"}
            </pre>
          </details>
        ))}
      </section>

      <section className="card" style={{ marginBottom: 16 }}>
        <h2>Reviews</h2>
        {allReviews.length === 0 ? <p>No reviews yet.</p> : null}
        {allReviews.map((review) => (
          <div key={review.id} style={{ borderBottom: "1px solid #eee", padding: "8px 0" }}>
            <strong>{review.title || "Review"}</strong> - {review.rating}/5 by {review.reviewerName}
            <div style={{ fontSize: 12, color: "#666" }}>
              {new Date(review.createdAt).toLocaleString()} · version {review.version ?? "-"}
            </div>
            <p style={{ marginTop: 4 }}>{review.body ?? ""}</p>
          </div>
        ))}
      </section>

      <ReviewForm pluginName={name} versions={releases.map((r) => r.version)} />
    </main>
  );
}
