/**
 * storage.js — Cloudflare R2 upload service
 *
 * Uses the S3-compatible API provided by R2.
 * Required env vars:
 *   R2_ACCOUNT_ID     — Cloudflare account ID
 *   R2_ACCESS_KEY_ID  — R2 API token Access Key ID
 *   R2_SECRET_ACCESS_KEY — R2 API token Secret Access Key
 *   R2_BUCKET_NAME    — R2 bucket name (e.g. "padi-assets")
 *   R2_PUBLIC_URL     — public URL for the bucket (e.g. https://assets.yourpadi.com)
 *
 * Install: npm install @aws-sdk/client-s3
 */

import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { randomUUID } from 'crypto'

const R2_ENDPOINT = `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`

let s3Client = null

function getClient() {
  if (!s3Client) {
    s3Client = new S3Client({
      region:   'auto',
      endpoint: R2_ENDPOINT,
      credentials: {
        accessKeyId:     process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
      },
    })
  }
  return s3Client
}

/**
 * Upload a buffer to R2 and return the public URL.
 *
 * @param {Buffer} buffer       — file contents
 * @param {string} mimeType     — e.g. 'image/jpeg'
 * @param {string} folder       — path prefix in the bucket (e.g. 'tq-images')
 * @returns {Promise<string>}   — public URL
 */
export async function uploadToR2(buffer, mimeType, folder = 'uploads') {
  const ext    = mimeType.split('/')[1]?.split(';')[0] || 'bin'
  const key    = `${folder}/${randomUUID()}.${ext}`
  const bucket = process.env.R2_BUCKET_NAME

  if (!bucket || !process.env.R2_ACCOUNT_ID) {
    throw new Error('R2 environment variables not configured (R2_ACCOUNT_ID, R2_BUCKET_NAME required).')
  }

  await getClient().send(new PutObjectCommand({
    Bucket:      bucket,
    Key:         key,
    Body:        buffer,
    ContentType: mimeType,
    // Objects are publicly accessible via the custom domain set on the bucket
  }))

  const base = (process.env.R2_PUBLIC_URL || `${R2_ENDPOINT}/${bucket}`).replace(/\/$/, '')
  return `${base}/${key}`
}
