import { readChangelog } from "../lib/data";

export default function DeveloperPortalChangelogPage() {
  const changelog = readChangelog();

  return (
    <div className="card">
      <h2>API Changelog</h2>
      <p>Auto-generated from git history (`apps/api` + OpenAPI contracts).</p>
      <p>Generated: {new Date(changelog.generatedAt).toLocaleString()}</p>

      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th style={{ textAlign: "left" }}>Date</th>
            <th style={{ textAlign: "left" }}>SHA</th>
            <th style={{ textAlign: "left" }}>Subject</th>
          </tr>
        </thead>
        <tbody>
          {changelog.entries.map((entry) => (
            <tr key={`${entry.sha}:${entry.date}`}>
              <td>{entry.date}</td>
              <td><code>{entry.sha}</code></td>
              <td>{entry.subject}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
