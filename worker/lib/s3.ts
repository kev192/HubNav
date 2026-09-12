// 轻量 S3 SigV4 客户端：适配 Cloudflare Workers 原生 fetch/crypto，
// 不引入 Node SDK，避免把大体积 AWS SDK 打进 Worker。

import type { S3AddressingStyle } from '../../shared/types'

export interface S3Config {
  endpointUrl: string
  addressingStyle: S3AddressingStyle
  bucket: string
  region: string
  accessKeyId: string
  secretAccessKey: string
}

export class S3RequestError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'S3RequestError'
    this.status = status
  }
}

const encoder = new TextEncoder()

function uriEncode(value: string, encodeSlash = true): string {
  return encodeURIComponent(value)
    .replace(/[!'()*]/g, (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`)
    .replace(/%7E/g, '~')
    .replace(/%2F/g, encodeSlash ? '%2F' : '/')
}

async function sha256Hex(data: Uint8Array<ArrayBuffer> | string): Promise<string> {
  const bytes = typeof data === 'string' ? encoder.encode(data) : data
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

async function hmacSha256(key: Uint8Array<ArrayBuffer>, value: string): Promise<Uint8Array<ArrayBuffer>> {
  const cryptoKey = await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(value))
  return new Uint8Array(signature)
}

function normalizeEndpoint(endpointUrl: string): URL {
  const raw = endpointUrl.trim()
  const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`
  const url = new URL(withProtocol)
  if (!url.hostname) throw new Error('invalid S3 endpoint')
  url.hash = ''
  url.search = ''
  url.pathname = url.pathname.replace(/\/+$/, '')
  return url
}

function buildObjectUrl(config: S3Config, objectKey: string): URL {
  const endpoint = normalizeEndpoint(config.endpointUrl)
  if (config.addressingStyle === 'virtual-hosted') {
    const endpointPort = endpoint.port ? `:${endpoint.port}` : ''
    const virtualHost = `${config.bucket}.${endpoint.hostname}${endpointPort}`
    return new URL(`${endpoint.protocol}//${virtualHost}${endpoint.pathname}/${uriEncode(objectKey, false)}`)
  }
  const endpointPort = endpoint.port ? `:${endpoint.port}` : ''
  return new URL(`${endpoint.protocol}//${endpoint.hostname}${endpointPort}${endpoint.pathname}/${config.bucket}/${uriEncode(objectKey, false)}`)
}

function canonicalQuery(query: Record<string, string>): string {
  return Object.entries(query)
    .map(([key, value]) => [uriEncode(key), uriEncode(value)] as const)
    .sort((left, right) => (left[0] < right[0] ? -1 : left[0] > right[0] ? 1 : left[1] < right[1] ? -1 : left[1] > right[1] ? 1 : 0))
    .map(([key, value]) => `${key}=${value}`)
    .join('&')
}

async function signedFetch(
  config: S3Config,
  method: string,
  url: URL,
  body?: string,
  contentType?: string,
): Promise<Response> {
  const payloadHash = await sha256Hex(body ?? '')
  const amzDate = new Date().toISOString().replace(/[:-]|\.\d{3}/g, '')
  const dateStamp = amzDate.slice(0, 8)
  const headers = new Headers({
    'x-amz-content-sha256': payloadHash,
    'x-amz-date': amzDate,
  })
  if (contentType) headers.set('content-type', contentType)

  const canonicalHeaders = [
    ['host', url.host],
    ...(contentType ? [['content-type', contentType] as const] : []),
    ['x-amz-content-sha256', payloadHash],
    ['x-amz-date', amzDate],
  ].sort((left, right) => (left[0] < right[0] ? -1 : 1))
  const canonicalHeadersText = canonicalHeaders.map(([key, value]) => `${key}:${value}\n`).join('')
  const signedHeaders = canonicalHeaders.map(([key]) => key).join(';')
  const canonicalRequest = [
    method,
    url.pathname,
    canonicalQuery(Object.fromEntries(url.searchParams.entries())),
    canonicalHeadersText,
    signedHeaders,
    payloadHash,
  ].join('\n')

  const scope = `${dateStamp}/${config.region}/s3/aws4_request`
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    scope,
    await sha256Hex(canonicalRequest),
  ].join('\n')

  const kDate = await hmacSha256(encoder.encode(`AWS4${config.secretAccessKey}`), dateStamp)
  const kRegion = await hmacSha256(kDate, config.region)
  const kService = await hmacSha256(kRegion, 's3')
  const signingKey = await hmacSha256(kService, 'aws4_request')
  const signatureBytes = await hmacSha256(signingKey, stringToSign)
  const signature = [...signatureBytes].map((byte) => byte.toString(16).padStart(2, '0')).join('')

  headers.set('authorization', `AWS4-HMAC-SHA256 Credential=${config.accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`)

  const response = await fetch(url, {
    method,
    headers,
    body: body === undefined ? undefined : body,
  })
  if (!response.ok) {
    const text = await response.text()
    const code = /<Code>([^<]+)<\/Code>/.exec(text)?.[1]
    const message = /<Message>([^<]+)<\/Message>/.exec(text)?.[1]
    throw new S3RequestError(`S3 request failed: ${code ?? response.status}${message ? ` - ${message}` : ''}`, response.status)
  }
  return response
}

export async function s3PutObject(config: S3Config, objectKey: string, content: string): Promise<number> {
  const response = await signedFetch(config, 'PUT', buildObjectUrl(config, objectKey), content, 'application/json')
  await response.body?.cancel()
  return Number(response.headers.get('content-length') ?? 0) || encoder.encode(content).length
}

export async function s3GetObject(config: S3Config, objectKey: string): Promise<string> {
  const response = await signedFetch(config, 'GET', buildObjectUrl(config, objectKey))
  return await response.text()
}

export async function s3DeleteObject(config: S3Config, objectKey: string): Promise<void> {
  const response = await signedFetch(config, 'DELETE', buildObjectUrl(config, objectKey))
  await response.body?.cancel()
}
