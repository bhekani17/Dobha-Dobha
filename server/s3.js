const { S3Client, PutObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

// Neon Object Storage configuration (S3-compatible)
const bucketName = process.env.AWS_S3_BUCKET_NAME || process.env.S3_BUCKET_NAME || 'assets';
const region = process.env.AWS_S3_REGION || process.env.AWS_REGION || 'us-east-2';
const endpoint = process.env.AWS_ENDPOINT_URL_S3;

// Initialize S3 client for Neon Object Storage or AWS S3
const s3Client = new S3Client({
  region,
  endpoint: endpoint || undefined,
  credentials: process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
    ? {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      }
    : undefined,
  forcePathStyle: !!endpoint, // Required for Neon Object Storage (virtual-hosted style not supported)
});

function normalizeBase64(input) {
  if (!input) return null;
  const trimmed = input.trim();
  const matches = trimmed.match(/^data:(image\/.*|application\/.*|video\/.*);base64,(.*)$/i);

  if (matches) {
    return { contentType: matches[1], data: matches[2] };
  }

  return { contentType: 'application/octet-stream', data: trimmed };
}

async function uploadBase64ToS3({ base64Data, key, contentType }) {
  if (!bucketName) {
    throw new Error('AWS_S3_BUCKET_NAME is not configured');
  }

  const normalized = normalizeBase64(base64Data);
  const buffer = Buffer.from(normalized.data, 'base64');
  const targetKey = key || `uploads/${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const resolvedContentType = contentType || normalized.contentType || 'application/octet-stream';

  await s3Client.send(new PutObjectCommand({
    Bucket: bucketName,
    Key: targetKey,
    Body: buffer,
    ContentType: resolvedContentType,
  }));

  // For Neon Object Storage or S3, generate presigned URL for direct, secure viewing
  let presignedUrl = null;
  try {
    presignedUrl = await getSignedUrl(s3Client, new GetObjectCommand({
      Bucket: bucketName,
      Key: targetKey,
    }), { expiresIn: 7 * 24 * 3600 });
  } catch (signErr) {
    console.warn('Could not presign S3 URL:', signErr.message);
  }

  const baseUrl = endpoint ? `${endpoint}/${bucketName}` : `https://${bucketName}.s3.${region}.amazonaws.com`;
  return {
    url: presignedUrl || `${baseUrl}/${targetKey}`,
    key: targetKey,
    storage: endpoint ? 'neon' : 'aws',
  };
}

// Generate presigned URL for secure file access (useful for Neon Object Storage)
async function getPresignedUrl(key, expiresIn = 3600) {
  if (!bucketName) {
    throw new Error('AWS_S3_BUCKET_NAME is not configured');
  }

  const command = new GetObjectCommand({
    Bucket: bucketName,
    Key: key,
  });

  return await getSignedUrl(s3Client, command, { expiresIn });
}

module.exports = {
  s3Client,
  uploadBase64ToS3,
  getPresignedUrl,
};
