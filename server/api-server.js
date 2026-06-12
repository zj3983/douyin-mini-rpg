import { createServer } from 'node:http'

const sessionCookie = 'vt_session'
const maxBodyBytes = 1024 * 1024 * 2

export function createApiServer({ service }) {
  return createServer(async (request, response) => {
    try {
      setCommonHeaders(response)
      if (request.method === 'OPTIONS') {
        response.writeHead(204)
        response.end()
        return
      }

      const url = new URL(request.url ?? '/', 'http://127.0.0.1')
      if (!url.pathname.startsWith('/api/')) {
        sendJson(response, 404, { error: { code: 'NOT_FOUND', message: '接口不存在。' } })
        return
      }

      if (request.method === 'GET' && url.pathname === '/api/health') {
        sendJson(response, 200, { ok: true })
        return
      }

      if (request.method === 'POST' && url.pathname === '/api/register') {
        const body = await readJson(request)
        const result = await service.register(body)
        setSessionCookie(response, result.token)
        sendJson(response, 201, { user: result.user })
        return
      }

      if (request.method === 'POST' && url.pathname === '/api/login') {
        const body = await readJson(request)
        const result = await service.login(body)
        setSessionCookie(response, result.token)
        sendJson(response, 200, { user: result.user })
        return
      }

      if (request.method === 'POST' && url.pathname === '/api/logout') {
        response.setHeader('set-cookie', `${sessionCookie}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`)
        sendJson(response, 200, { ok: true })
        return
      }

      if (request.method === 'GET' && url.pathname === '/api/me') {
        const user = await service.getUserByToken(readToken(request))
        sendJson(response, 200, { user })
        return
      }

      if (request.method === 'PUT' && url.pathname === '/api/password') {
        const body = await readJson(request)
        await service.changePassword(readToken(request), body)
        sendJson(response, 200, { ok: true })
        return
      }

      if (request.method === 'GET' && url.pathname === '/api/save') {
        const save = await service.readSave(readToken(request))
        sendJson(response, 200, { save })
        return
      }

      if (request.method === 'PUT' && url.pathname === '/api/save') {
        const body = await readJson(request)
        await service.writeSave(readToken(request), body.save ?? null)
        sendJson(response, 200, { ok: true })
        return
      }

      sendJson(response, 404, { error: { code: 'NOT_FOUND', message: '接口不存在。' } })
    } catch (error) {
      const status = Number(error.status) || 500
      sendJson(response, status, {
        error: {
          code: error.code || 'SERVER_ERROR',
          message: error.message || '服务器错误。',
        },
      })
    }
  })
}

function setCommonHeaders(response) {
  response.setHeader('access-control-allow-origin', 'http://localhost:5173')
  response.setHeader('access-control-allow-credentials', 'true')
  response.setHeader('access-control-allow-methods', 'GET,POST,PUT,OPTIONS')
  response.setHeader('access-control-allow-headers', 'content-type,authorization')
  response.setHeader('cache-control', 'no-store')
}

function sendJson(response, status, body) {
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8' })
  response.end(JSON.stringify(body))
}

async function readJson(request) {
  const text = await readBody(request)
  if (!text) return {}
  const normalized = text.charCodeAt(0) === 0xFEFF ? text.slice(1) : text
  try {
    return JSON.parse(normalized)
  } catch {
    const error = new Error('JSON 格式不正确。')
    error.status = 400
    error.code = 'INVALID_JSON'
    throw error
  }
}

function readBody(request) {
  return new Promise((resolve, reject) => {
    let size = 0
    let body = ''
    request.setEncoding('utf8')
    request.on('data', (chunk) => {
      size += Buffer.byteLength(chunk)
      if (size > maxBodyBytes) {
        const error = new Error('请求内容过大。')
        error.status = 413
        error.code = 'BODY_TOO_LARGE'
        reject(error)
        request.destroy()
        return
      }
      body += chunk
    })
    request.on('end', () => resolve(body))
    request.on('error', reject)
  })
}

function readToken(request) {
  const authorization = request.headers.authorization ?? ''
  if (authorization.toLowerCase().startsWith('bearer ')) return authorization.slice(7).trim()
  const cookie = request.headers.cookie ?? ''
  const parts = cookie.split(';').map((part) => part.trim())
  const pair = parts.find((part) => part.startsWith(`${sessionCookie}=`))
  return pair ? decodeURIComponent(pair.slice(sessionCookie.length + 1)) : ''
}

function setSessionCookie(response, token) {
  response.setHeader('set-cookie', `${sessionCookie}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800`)
}
