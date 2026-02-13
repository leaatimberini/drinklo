export default function DeveloperPortalWebhooksPage() {
  return (
    <div className="card">
      <h2>Webhooks</h2>
      <p>Outgoing events are configured per company and delivered to active endpoints.</p>

      <h3>Supported Events</h3>
      <ul>
        <li>`OrderCreated`</li>
        <li>`PaymentApproved`</li>
        <li>`StockLow`</li>
      </ul>

      <h3>Headers</h3>
      <ul>
        <li>`x-devwebhook-id`</li>
        <li>`x-devwebhook-event`</li>
        <li>`x-devwebhook-timestamp`</li>
        <li>`x-devwebhook-signature` (`t=&lt;unix&gt;,v1=&lt;hmac&gt;`)</li>
      </ul>

      <h3>Signature</h3>
      <p>Signed payload: `&lt;timestamp&gt;.&lt;raw-json-body&gt;` using HMAC SHA-256.</p>

      <h3>Node Verification Example</h3>
      <pre>{`import crypto from "node:crypto";

function verify(secret, ts, body, signature) {
  const expected = crypto.createHmac("sha256", secret).update(ts + "." + body).digest("hex");
  return signature.includes("v1=" + expected);
}`}</pre>

      <h3>Retries</h3>
      <p>Delivery logs store statusCode or error per endpoint delivery attempt.</p>
    </div>
  );
}
