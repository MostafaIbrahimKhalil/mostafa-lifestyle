// سيرفر الإشعارات (Cloudflare Worker) — بيبعت إشعارات Web Push في مواعيدها.
// التطبيق بيبعتله "جدول" فيه مواعيد ونصوص التذكيرات بس — مفيش أي بيانات تانية.
// المحتاجه: KV namespace مربوط باسم PUSH، وCron كل دقيقة "* * * * *".
// الكرون ما بيكتبش على الاشتراكات خالص (عشان ما يمسحش جدول جديد)، بيبعت اللي ميعاده في الدقيقة دي بس.
// مفاتيح VAPID بتتعمل لوحدها أول مرة وتتحفظ في KV.

const ALLOWED_ORIGINS = ['https://mostafaibrahimkhalil.github.io', 'http://localhost:5173', 'http://localhost:4173']
const VAPID_SUBJECT = 'mailto:noreply@mostafa-lifestyle.app'
const MAX_ITEMS = 200
const LATE_LIMIT_MS = 15 * 60 * 1000 // لو الإشعار اتأخر أكتر من ربع ساعة ما نبعتهوش

// ===== أدوات base64url =====
const enc = new TextEncoder()
function b64u(buf) {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf)
  let s = ''
  for (const b of bytes) s += String.fromCharCode(b)
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
function unb64u(str) {
  const s = str.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((str.length + 3) % 4)
  const bin = atob(s)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}
function concat(...arrs) {
  const len = arrs.reduce((n, a) => n + a.length, 0)
  const out = new Uint8Array(len)
  let o = 0
  for (const a of arrs) {
    out.set(a, o)
    o += a.length
  }
  return out
}

// ===== مفاتيح VAPID =====
async function getVapid(env) {
  const saved = await env.PUSH.get('vapid', 'json')
  if (saved) return saved
  const kp = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify'])
  const privateJwk = await crypto.subtle.exportKey('jwk', kp.privateKey)
  const publicRaw = new Uint8Array(await crypto.subtle.exportKey('raw', kp.publicKey))
  const vapid = { privateJwk, publicKey: b64u(publicRaw) }
  await env.PUSH.put('vapid', JSON.stringify(vapid))
  return vapid
}

async function vapidAuth(endpoint, vapid) {
  const aud = new URL(endpoint).origin
  const header = b64u(enc.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })))
  const payload = b64u(
    enc.encode(JSON.stringify({ aud, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: VAPID_SUBJECT })),
  )
  const key = await crypto.subtle.importKey('jwk', vapid.privateJwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, [
    'sign',
  ])
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, enc.encode(`${header}.${payload}`))
  return `vapid t=${header}.${payload}.${b64u(sig)}, k=${vapid.publicKey}`
}

// ===== تشفير الرسالة (RFC 8291 — aes128gcm) =====
async function hkdf(salt, ikm, info, length) {
  const key = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info }, key, length * 8)
  return new Uint8Array(bits)
}

export async function encryptPayload(subscription, plaintext) {
  const uaPublic = unb64u(subscription.keys.p256dh)
  const authSecret = unb64u(subscription.keys.auth)
  const local = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits'])
  const asPublic = new Uint8Array(await crypto.subtle.exportKey('raw', local.publicKey))
  const uaKey = await crypto.subtle.importKey('raw', uaPublic, { name: 'ECDH', namedCurve: 'P-256' }, false, [])
  const shared = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: uaKey }, local.privateKey, 256))

  const keyInfo = concat(enc.encode('WebPush: info\0'), uaPublic, asPublic)
  const ikm = await hkdf(authSecret, shared, keyInfo, 32)
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const cek = await hkdf(salt, ikm, enc.encode('Content-Encoding: aes128gcm\0'), 16)
  const nonce = await hkdf(salt, ikm, enc.encode('Content-Encoding: nonce\0'), 12)

  const data = concat(enc.encode(plaintext), new Uint8Array([2])) // 0x02 = آخر سجل
  const aesKey = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt'])
  const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, aesKey, data))

  const rs = new Uint8Array(4)
  new DataView(rs.buffer).setUint32(0, 4096)
  return concat(salt, rs, new Uint8Array([asPublic.length]), asPublic, cipher)
}

async function sendPush(subscription, message, vapid, ttl = 1800) {
  const body = await encryptPayload(subscription, JSON.stringify(message))
  const res = await fetch(subscription.endpoint, {
    method: 'POST',
    headers: {
      Authorization: await vapidAuth(subscription.endpoint, vapid),
      'Content-Encoding': 'aes128gcm',
      'Content-Type': 'application/octet-stream',
      TTL: String(ttl),
      Urgency: 'high',
    },
    body,
  })
  return res.status
}

// ===== التخزين =====
// subs: الاشتراكات وجداولها — بيكتبها التطبيق بس
// log: آخر إشعار اتبعت لكل اشتراك ونتيجته — عشان نعرف المشكلة فين
async function loadAll(env) {
  return (await env.PUSH.get('subs', 'json')) || {}
}
async function saveAll(env, all) {
  await env.PUSH.put('subs', JSON.stringify(all))
}
async function loadLog(env) {
  return (await env.PUSH.get('log', 'json')) || {}
}
async function saveLog(env, log) {
  await env.PUSH.put('log', JSON.stringify(log))
}

function cors(req) {
  const origin = req.headers.get('Origin') || ''
  return {
    'Access-Control-Allow-Origin': ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  }
}
function json(req, data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', ...cors(req) } })
}

async function idFor(endpoint) {
  const h = await crypto.subtle.digest('SHA-256', enc.encode(endpoint))
  return b64u(new Uint8Array(h)).slice(0, 22)
}

function validSub(s) {
  return (
    s &&
    typeof s.endpoint === 'string' &&
    s.endpoint.startsWith('https://') &&
    typeof s.keys?.p256dh === 'string' &&
    typeof s.keys?.auth === 'string'
  )
}

function cleanSchedule(items) {
  if (!Array.isArray(items)) return []
  const now = Date.now()
  return items
    .filter((x) => x && Number.isFinite(x.at) && x.at > now - 60000 && x.at < now + 3 * 86400000)
    .slice(0, MAX_ITEMS)
    .map((x) => ({
      at: Math.round(x.at),
      title: String(x.title || '').slice(0, 80),
      body: String(x.body || '').slice(0, 200),
      tag: String(x.tag || '').slice(0, 40),
      url: String(x.url || '').slice(0, 200),
    }))
    .sort((a, b) => a.at - b.at)
}

export default {
  async fetch(req, env) {
    if (req.method === 'OPTIONS') return new Response(null, { headers: cors(req) })
    const url = new URL(req.url)
    try {
      if (url.pathname === '/vapid' && req.method === 'GET') {
        const v = await getVapid(env)
        return json(req, { publicKey: v.publicKey })
      }
      if (url.pathname === '/subscribe' && req.method === 'POST') {
        const body = await req.json()
        if (!validSub(body.subscription)) return json(req, { error: 'bad subscription' }, 400)
        const id = await idFor(body.subscription.endpoint)
        const all = await loadAll(env)
        all[id] = {
          subscription: body.subscription,
          schedule: cleanSchedule(body.schedule),
          updatedAt: Date.now(),
        }
        // نشيل الاشتراكات اللي ما اتحدّثتش من أكتر من ١٠ أيام
        for (const [k, v] of Object.entries(all)) if (Date.now() - v.updatedAt > 10 * 86400000) delete all[k]
        await saveAll(env, all)
        return json(req, { ok: true, id, scheduled: all[id].schedule.length })
      }
      if (url.pathname === '/test' && req.method === 'POST') {
        const body = await req.json()
        if (!validSub(body.subscription)) return json(req, { error: 'bad subscription' }, 400)
        const vapid = await getVapid(env)
        const status = await sendPush(
          body.subscription,
          { title: 'مصطفى لايف', body: 'الإشعارات من السيرفر شغالة تمام ✓', tag: 'test' },
          vapid,
        )
        const id = await idFor(body.subscription.endpoint)
        const log = await loadLog(env)
        log[id] = { at: Date.now(), status, title: 'تجربة' }
        await saveLog(env, log)
        return json(req, { ok: status < 300, status, id })
      }
      if (url.pathname === '/status' && req.method === 'GET') {
        const id = url.searchParams.get('id') || ''
        const [all, log] = await Promise.all([loadAll(env), loadLog(env)])
        const e = all[id]
        const now = Date.now()
        const left = e ? e.schedule.filter((x) => x.at > now) : []
        return json(req, {
          found: !!e,
          updatedAt: e?.updatedAt || null,
          scheduled: left.length,
          next: left[0] ? { at: left[0].at, title: left[0].title } : null,
          last: log[id] || null,
          serverTime: now,
        })
      }
      if (url.pathname === '/' || url.pathname === '/health') return json(req, { ok: true, service: 'mostafa-push' })
      return json(req, { error: 'not found' }, 404)
    } catch (err) {
      return json(req, { error: String(err?.message || err) }, 500)
    }
  },

  async scheduled(event, env, ctx) {
    ctx.waitUntil(runDue(env, event.scheduledTime || Date.now()))
  },
}

// كل دقيقة: نبعت اللي ميعاده جوه الدقيقة اللي فاتت بس — من غير ما نكتب على الجداول
async function runDue(env, tick) {
  const all = await loadAll(env)
  const from = tick - 60000
  let vapid = null
  let log = null
  for (const [id, entry] of Object.entries(all)) {
    const due = (entry.schedule || []).filter((x) => x.at > from && x.at <= tick)
    if (!due.length) continue
    vapid ||= await getVapid(env)
    log ||= await loadLog(env)
    for (const item of due) {
      const status = await sendPush(
        entry.subscription,
        { title: item.title, body: item.body, tag: item.tag, url: item.url },
        vapid,
        Math.max(60, Math.round((LATE_LIMIT_MS - (Date.now() - item.at)) / 1000)),
      )
      log[id] = { at: Date.now(), status, title: item.title }
      if (status === 404 || status === 410) break // الاشتراك اتلغى من الموبايل
    }
  }
  if (log) await saveLog(env, log)
}
