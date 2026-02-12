import Link from "next/link";
import { readCatalog, readPortalIndex } from "../lib/data";

export default function DeveloperPortalOpenApiPage() {
  const index = readPortalIndex();
  const v1 = readCatalog("v1");
  const v2 = readCatalog("v2");

  return (
    <>
      <div className="card" style={{ marginBottom: 16 }}>
        <h2>OpenAPI Published Specs</h2>
        <p>Generated automatically from repository contracts.</p>
        <ul>
          {index.versions.map((item: any) => (
            <li key={item.version}>
              {item.version} ({item.endpointCount} endpoints) - <Link href={`/developer-api/openapi/${item.version}.json`}>download</Link>
            </li>
          ))}
        </ul>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <h2>v1 Catalog</h2>
        <p>Generated: {new Date(v1.generatedAt).toLocaleString()}</p>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={{ textAlign: "left" }}>Method</th>
              <th style={{ textAlign: "left" }}>Route</th>
              <th style={{ textAlign: "left" }}>Operation ID</th>
              <th style={{ textAlign: "left" }}>Source</th>
            </tr>
          </thead>
          <tbody>
            {v1.endpoints.map((item) => (
              <tr key={`v1:${item.method}:${item.route}`}>
                <td>{item.method}</td>
                <td>{item.route}</td>
                <td>{item.operationId}</td>
                <td><code>{item.source ?? "-"}</code></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card">
        <h2>v2 Catalog</h2>
        <p>Generated: {new Date(v2.generatedAt).toLocaleString()}</p>
        <p>Total endpoints: {v2.endpointCount}</p>
      </div>
    </>
  );
}
