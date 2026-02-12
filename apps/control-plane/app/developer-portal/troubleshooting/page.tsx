export default function DeveloperPortalTroubleshootingPage() {
  return (
    <div className="card">
      <h2>Troubleshooting</h2>

      <h3>401 Unauthorized</h3>
      <ul>
        <li>Missing `x-api-key` header.</li>
        <li>Malformed key format. Expected `<prefix>.<secret>`.</li>
        <li>Revoked key.</li>
      </ul>

      <h3>403 Forbidden</h3>
      <ul>
        <li>Key does not include required scope for route.</li>
      </ul>

      <h3>429 Too Many Requests</h3>
      <ul>
        <li>Rate limit exceeded for key+IP window.</li>
        <li>Increase `rateLimitPerMin` only when justified.</li>
      </ul>

      <h3>Webhook Signature Mismatch</h3>
      <ul>
        <li>Ensure raw request body is used for HMAC validation.</li>
        <li>Verify endpoint secret matches configured value.</li>
        <li>Validate timestamp tolerance and server clock drift.</li>
      </ul>

      <h3>Operational Checks</h3>
      <ul>
        <li>Admin usage panel for request rates and status codes.</li>
        <li>Developer webhook delivery logs for endpoint errors.</li>
        <li>Immutable audit entries for external API access.</li>
      </ul>
    </div>
  );
}
