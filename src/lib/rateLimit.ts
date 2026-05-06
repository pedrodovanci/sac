import type { NextRequest } from 'next/server'

export type RateLimitResult = { allowed: true } | { allowed: false; retryAfter: number }

const memory = new Map<string, { count: number; reset: number }>()

function normalizeEnv(value: string | undefined) {
  if (!value) return undefined
  const trimmed = value.trim()
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"') && trimmed.length >= 2) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'") && trimmed.length >= 2)
  ) {
    return trimmed.slice(1, -1)
  }
  return trimmed
}

function getClientIp(request: NextRequest) {
  const xff = request.headers.get('x-forwarded-for')
  if (xff) return xff.split(',')[0]?.trim() || 'unknown'
  return request.headers.get('x-real-ip') || 'unknown'
}

async function redisRequest(path: string) {
  const url = normalizeEnv(process.env.UPSTASH_REDIS_REST_URL)
  const token = normalizeEnv(process.env.UPSTASH_REDIS_REST_TOKEN)
  if (!url || !token) throw new Error('missing_upstash_env')

  const res = await fetch(`${url}/${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store'
  })
  if (!res.ok) throw new Error('upstash_error')
  return (await res.json()) as { result?: any }
}

async function checkRateLimitRedis(key: string, limit: number, windowMs: number): Promise<RateLimitResult> {
  const ttlSeconds = Math.max(1, Math.ceil(windowMs / 1000))
  const safeKey = encodeURIComponent(key)

  const incr = await redisRequest(`incr/${safeKey}`)
  const count = Number(incr.result)

  if (count === 1) await redisRequest(`expire/${safeKey}/${ttlSeconds}`)

  if (Number.isFinite(count) && count <= limit) return { allowed: true }

  const pttl = await redisRequest(`pttl/${safeKey}`)
  const ttlMs = Number(pttl.result)
  const retryAfter = Number.isFinite(ttlMs) && ttlMs > 0 ? Math.ceil(ttlMs / 1000) : ttlSeconds
  return { allowed: false, retryAfter }
}

function checkRateLimitMemory(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now()
  const record = memory.get(key)
  if (!record || now > record.reset) {
    memory.set(key, { count: 1, reset: now + windowMs })
    return { allowed: true }
  }
  if (record.count >= limit) {
    return { allowed: false, retryAfter: Math.ceil((record.reset - now) / 1000) }
  }
  record.count++
  return { allowed: true }
}

export async function checkRateLimit(
  request: NextRequest,
  key: string,
  limit: number,
  windowMs: number
): Promise<RateLimitResult> {
  const ip = getClientIp(request)
  const finalKey = `${key}:${ip}`

  try {
    if (normalizeEnv(process.env.UPSTASH_REDIS_REST_URL) && normalizeEnv(process.env.UPSTASH_REDIS_REST_TOKEN)) {
      return await checkRateLimitRedis(finalKey, limit, windowMs)
    }
  } catch {
  }

  return checkRateLimitMemory(finalKey, limit, windowMs)
}
