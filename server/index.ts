import 'dotenv/config'
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { Collector } from './collector.js'
import { loadNetwork } from './networks.js'
import { lookupTx } from './tx.js'
import type { Event } from './types.js'

const net = loadNetwork()
const collector = new Collector(net, Number(process.env.BACKFILL_BLOCKS ?? 10800))
const clients = new Set<http.ServerResponse>()

collector.on('event', (e: Event) => broadcast(e))
setInterval(() => { if (collector.ready) broadcast({ type: 'snapshot', snapshot: collector.snapshot() }) }, 2000)

function broadcast(e: Event) {
  const line = `event: ${e.type}\ndata: ${JSON.stringify(e)}\n\n`
  for (const res of clients) res.write(line)
}

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const dist = path.resolve(__dirname, '../web/dist')
const MIME: Record<string, string> = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2', '.json': 'application/json' }

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', 'http://x')
  res.setHeader('access-control-allow-origin', '*')
  try {
    if (url.pathname === '/api/snapshot') return json(res, collector.ready ? collector.snapshot() : { ready: false })
    if (url.pathname === '/api/health') return json(res, collector.ready ? collector.health() : { ready: false })
    if (url.pathname.startsWith('/api/tx/')) return json(res, await lookupTx(collector, url.pathname.slice(8)))
    if (url.pathname === '/api/events') {
      res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache', connection: 'keep-alive' })
      res.write(`event: hello\ndata: ${JSON.stringify({ network: net.name, ready: collector.ready })}\n\n`)
      if (collector.ready) res.write(`event: snapshot\ndata: ${JSON.stringify({ type: 'snapshot', snapshot: collector.snapshot() })}\n\n`)
      clients.add(res)
      req.on('close', () => clients.delete(res))
      return
    }
    // static
    let p = path.join(dist, url.pathname === '/' ? 'index.html' : url.pathname)
    if (!p.startsWith(dist)) { res.writeHead(403); return res.end() }
    if (!fs.existsSync(p) || fs.statSync(p).isDirectory()) p = path.join(dist, 'index.html')
    if (!fs.existsSync(p)) { res.writeHead(404); return res.end('build the web app first: pnpm build') }
    res.writeHead(200, { 'content-type': MIME[path.extname(p)] ?? 'application/octet-stream' })
    fs.createReadStream(p).pipe(res)
  } catch (e) {
    json(res, { error: (e as Error).message }, 500)
  }
})
function json(res: http.ServerResponse, body: unknown, code = 200) { res.writeHead(code, { 'content-type': 'application/json' }); res.end(JSON.stringify(body)) }

const port = Number(process.env.PORT ?? 8787)
server.listen(port, () => console.log(`[server] ${net.name} monitor on http://localhost:${port}`))
collector.start().catch((e) => { console.error('[collector] fatal', e); process.exit(1) })
