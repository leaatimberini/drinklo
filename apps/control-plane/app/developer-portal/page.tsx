import Link from "next/link";
import { readCatalog, readPortalIndex } from "./lib/data";

export default function DeveloperPortalPage() {
  const index = readPortalIndex();
  const v1 = readCatalog("v1");

  return (
    <>
      <div className="card" style={{ marginBottom: 16 }}>
        <h2>Quick Start</h2>
        <ol>
          <li>Create an API key from admin: Developer API.</li>
          <li>Assign scopes to least privilege.</li>
          <li>Call `/developer/v1/*` with `x-api-key` header.</li>
          <li>Configure outbound webhook endpoint and validate signature.</li>
        </ol>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <h2>Published Specs</h2>
        <p>Generated from `packages/shared/contracts/openapi/*.json`.</p>
        <ul>
          {index.versions.map((item: any) => (
            <li key={item.version}>
              {item.version} - {item.endpointCount} endpoints - <Link href={`/developer-api/openapi/${item.version}.json`}>raw json</Link>
            </li>
          ))}
        </ul>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <h2>v1 Endpoint Catalog</h2>
        <p>Total: {v1.endpointCount}</p>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={{ textAlign: "left" }}>Method</th>
              <th style={{ textAlign: "left" }}>Route</th>
              <th style={{ textAlign: "left" }}>Operation</th>
            </tr>
          </thead>
          <tbody>
            {v1.endpoints.slice(0, 60).map((item) => (
              <tr key={`${item.method}:${item.route}`}>
                <td>{item.method}</td>
                <td>{item.route}</td>
                <td>{item.operationId}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p style={{ marginTop: 8 }}>
          Full list: <Link href="/developer-portal/openapi">OpenAPI section</Link>
        </p>
      </div>

      <div className="card">
        <h2>Guides</h2>
        <ul>
          <li><Link href="/developer-portal/auth">Authentication and scopes</Link></li>
          <li><Link href="/developer-portal/webhooks">Webhook events and signature</Link></li>
          <li><Link href="/developer-portal/troubleshooting">Troubleshooting and errors</Link></li>
          <li><Link href="/developer-portal/changelog">API changelog</Link></li>
        </ul>
      </div>
    </>
  );
}
