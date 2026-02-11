import { S3Client, CreateBucketCommand, HeadBucketCommand } from "@aws-sdk/client-s3";
import { S3StorageAdapter } from "./s3.adapter";

const runMinioTests = process.env.MINIO_TESTS === "true";
const describeIf = runMinioTests ? describe : describe.skip;

describeIf("S3StorageAdapter (MinIO)", () => {
  const bucket = process.env.STORAGE_BUCKET ?? "erp";
  const region = process.env.STORAGE_REGION ?? "us-east-1";
  const endpoint = process.env.STORAGE_ENDPOINT ?? "http://localhost:9000";
  const accessKeyId = process.env.STORAGE_ACCESS_KEY ?? "minioadmin";
  const secretAccessKey = process.env.STORAGE_SECRET_KEY ?? "minioadmin";

  const client = new S3Client({
    region,
    endpoint,
    forcePathStyle: true,
    credentials: { accessKeyId, secretAccessKey },
  });

  const adapter = new S3StorageAdapter({
    bucket,
    region,
    endpoint,
    accessKeyId,
    secretAccessKey,
    forcePathStyle: true,
    publicBaseUrl: endpoint,
  });

  beforeAll(async () => {
    try {
      await client.send(new HeadBucketCommand({ Bucket: bucket }));
    } catch {
      await client.send(new CreateBucketCommand({ Bucket: bucket }));
    }
  });

  it("puts, gets, signs, deletes", async () => {
    const key = `tests/storage-${Date.now()}.txt`;
    const body = Buffer.from("hello-minio");

    await adapter.put({ key, body, contentType: "text/plain" });
    const got = await adapter.get(key);
    expect(got.toString()).toBe("hello-minio");

    const url = await adapter.signedUrl(key, 60);
    const res = await fetch(url);
    const text = await res.text();
    expect(text).toBe("hello-minio");

    await adapter.delete(key);
  });
});
