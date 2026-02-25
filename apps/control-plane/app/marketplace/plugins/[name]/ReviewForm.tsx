"use client";

import { useState } from "react";

export function ReviewForm({ pluginName, versions }: { pluginName: string; versions: string[] }) {
  const [reviewerName, setReviewerName] = useState("");
  const [rating, setRating] = useState("5");
  const [version, setVersion] = useState(versions[0] ?? "");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submitReview() {
    setMessage(null);
    setError(null);
    const res = await fetch(`/api/marketplace/plugins/${encodeURIComponent(pluginName)}/reviews`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        reviewerName,
        rating: Number(rating),
        version: version || undefined,
        title: title || undefined,
        body: body || undefined,
      }),
    });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(payload.error ?? "review submit failed");
      return;
    }
    setMessage("Review published.");
    setTitle("");
    setBody("");
  }

  return (
    <section className="card" style={{ marginTop: 16 }}>
      <h2>Rate this plugin</h2>
      {message ? <p style={{ color: "green" }}>{message}</p> : null}
      {error ? <p style={{ color: "crimson" }}>{error}</p> : null}
      <label>
        Name
        <input value={reviewerName} onChange={(e) => setReviewerName(e.target.value)} />
      </label>
      <label>
        Rating
        <select value={rating} onChange={(e) => setRating(e.target.value)}>
          {[5, 4, 3, 2, 1].map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </select>
      </label>
      <label>
        Version
        <select value={version} onChange={(e) => setVersion(e.target.value)}>
          {versions.map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </select>
      </label>
      <label>
        Title
        <input value={title} onChange={(e) => setTitle(e.target.value)} />
      </label>
      <label>
        Review
        <textarea rows={4} value={body} onChange={(e) => setBody(e.target.value)} />
      </label>
      <button onClick={submitReview}>Publish Review</button>
    </section>
  );
}

