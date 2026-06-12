import { join } from 'node:path'
import { createApiServer } from './api-server.js'
import { createAuthService } from './auth-service.js'
import { createFileAuthStore } from './auth-store.js'

const port = Number(process.env.PORT || 4174)
const dataFile = process.env.AUTH_DATA_FILE || join(process.cwd(), 'data', 'auth.json')

const store = await createFileAuthStore(dataFile)
const service = createAuthService({ store })
const server = createApiServer({ service })

server.listen(port, '127.0.0.1', () => {
  console.log(`douyin-mini-rpg api listening on http://127.0.0.1:${port}`)
})

process.on('SIGTERM', () => {
  server.close(() => process.exit(0))
})
