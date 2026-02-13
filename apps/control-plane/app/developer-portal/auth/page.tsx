export default function DeveloperPortalAuthPage() {
  return (
    <div className="card">
      <h2>Auth and Scopes</h2>
      <p>Use `x-api-key` header with value {"<prefix>.<secret>"}.</p>

      <h3>Flow</h3>
      <ol>
        <li>Generate key in admin.</li>
        <li>Store once: key secret is shown only at creation.</li>
        <li>Assign required scopes only.</li>
        <li>Monitor usage and rate-limit hits in admin portal.</li>
      </ol>

      <h3>Scopes</h3>
      <ul>
        <li>`read:products`</li>
        <li>`read:categories`</li>
        <li>`read:pricelists`</li>
        <li>`read:stock`</li>
      </ul>

      <h3>Example</h3>
      <pre>{`curl -H "x-api-key: dpk_xxx.yyy" \\
  "https://api.example.com/developer/v1/products?page=1&pageSize=20"`}</pre>

      <h3>Rate Limit</h3>
      <p>Limit is enforced per API key + IP in 1 minute windows.</p>
      <p>429 responses are logged and visible in usage metrics.</p>
    </div>
  );
}
