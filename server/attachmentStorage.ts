import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { ENV } from "./_core/env";

const MAX_ATTACHMENT_SIZE = 15 * 1024 * 1024;

function getS3Client() {
  if (!ENV.s3Bucket) {
    throw new Error("S3_BUCKET is required when ATTACHMENTS_STORAGE=s3");
  }

  const hasAccessKey = Boolean(ENV.s3AccessKeyId);
  const hasSecret = Boolean(ENV.s3SecretAccessKey);
  if (hasAccessKey !== hasSecret) {
    throw new Error("Set both S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY, or neither when using an IAM role");
  }

  return new S3Client({
    region: ENV.s3Region || "us-east-1",
    endpoint: ENV.s3Endpoint || undefined,
    forcePathStyle: ENV.s3ForcePathStyle,
    credentials: hasAccessKey
      ? { accessKeyId: ENV.s3AccessKeyId, secretAccessKey: ENV.s3SecretAccessKey }
      : undefined,
  });
}

function decodeDataUrl(dataUrl: string): Buffer {
  const match = dataUrl.match(/^data:([^;,]+)?;base64,([A-Za-z0-9+/=\r\n]+)$/);
  if (!match) throw new Error("Invalid file data");

  const data = Buffer.from(match[2], "base64");
  if (data.length === 0 || data.length > MAX_ATTACHMENT_SIZE) {
    throw new Error("Attachment size must be between 1 byte and 15 MB");
  }
  return data;
}

function safeFileName(fileName: string) {
  return fileName.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 160) || "attachment";
}

export function usesS3AttachmentStorage() {
  return ENV.attachmentsStorage === "s3";
}

export async function uploadAttachment(input: {
  entityType: string;
  entityId: number;
  fileName: string;
  contentType: string;
  size: number;
  dataUrl: string;
}) {
  const data = decodeDataUrl(input.dataUrl);
  if (data.length !== input.size) throw new Error("Attachment size does not match its contents");

  const key = `attachments/${input.entityType}/${input.entityId}/${crypto.randomUUID()}-${safeFileName(input.fileName)}`;
  const client = getS3Client();
  await client.send(
    new PutObjectCommand({
      Bucket: ENV.s3Bucket,
      Key: key,
      Body: data,
      ContentType: input.contentType,
      ContentDisposition: `attachment; filename*=UTF-8''${encodeURIComponent(input.fileName)}`,
    }),
  );
  return key;
}

export async function getAttachmentDownloadUrl(storageKey: string) {
  return getSignedUrl(
    getS3Client(),
    new GetObjectCommand({ Bucket: ENV.s3Bucket, Key: storageKey }),
    { expiresIn: 15 * 60 },
  );
}

export async function deleteAttachmentObject(storageKey: string) {
  await getS3Client().send(new DeleteObjectCommand({ Bucket: ENV.s3Bucket, Key: storageKey }));
}
