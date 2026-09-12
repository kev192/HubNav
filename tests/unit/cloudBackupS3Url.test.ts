import { afterEach, describe, expect, it, vi } from 'vitest'
import { s3PutObject, type S3Config } from '../../worker/lib/s3'

const config: S3Config = {
  endpointUrl: 'https://041fc3445089ff26704467847bc604ff.r2.cloudflarestorage.com',
  addressingStyle: 'path',
  bucket: 'navhub-backup',
  region: 'auto',
  accessKeyId: 'test-access-key',
  secretAccessKey: 'test-secret',
}

describe('S3 request URL construction', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('does not produce a double slash for root endpoints', async () => {
    const urls: string[] = []
    vi.stubGlobal('fetch', async (input: RequestInfo | URL) => {
      urls.push(String(input))
      return new Response('', {
        status: 200,
        headers: { 'content-length': '2' },
      })
    })

    await s3PutObject(config, 'navhub-backups/backup.json', '{}')
    expect(urls).toEqual([
      'https://041fc3445089ff26704467847bc604ff.r2.cloudflarestorage.com/navhub-backup/navhub-backups/backup.json',
    ])
  })

  it('supports virtual-hosted style and endpoint base paths', async () => {
    const urls: string[] = []
    vi.stubGlobal('fetch', async (input: RequestInfo | URL) => {
      urls.push(String(input))
      return new Response('', {
        status: 200,
        headers: { 'content-length': '2' },
      })
    })

    await s3PutObject(
      { ...config, endpointUrl: 'https://minio.example.com/minio/' },
      'backup.json',
      '{}',
    )
    await s3PutObject(
      { ...config, addressingStyle: 'virtual-hosted' },
      'backup.json',
      '{}',
    )

    expect(urls).toEqual([
      'https://minio.example.com/minio/navhub-backup/backup.json',
      'https://navhub-backup.041fc3445089ff26704467847bc604ff.r2.cloudflarestorage.com/backup.json',
    ])
  })
})
