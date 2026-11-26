import 'dotenv/config'
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { Collector } from './collector.js'
import { NETWORKS, type NetworkName } from './networks.js'
import { lookupTx } from './tx.js'
import type { Event } from './types.js'

/** Run one collector per configured network so the UI can switch without a restart. */
const wanted = (process.env.NETWORKS ?? process.env.NETWORK ?? 'mainnet').split(',').map((x) => x.trim()).filter(Boolean) as NetworkName[]
const collectors = new Map<NetworkName, Collector>()
const clients = new Map<NetworkName, Set<http.ServerResponse>>()
for (const n of wanted) {
  if (!NETWORKS[n]) { console.warn(`[server] unknown network ${n}`); continue }
  try {
    const c = new Collector(NETWORKS[n](), Number(process.env.BACKFILL_BLOCKS ?? 10800))
    collectors.set(n, c); clients.set(n, new Set())
    c.on('event', (e: Event) => broadcast(n, e))
    c.start().catch((e) => console.error(`[collector:${n}] fatal`, e))
  } catch (e) { console.warn(`[server] skipping ${n}: ${(e as Error).message}`) }
}
setInterval(() => { for (const [n, c] of collectors) if (c.ready) broadcast(n, { type: 'snapshot', snapshot: c.snapshot() }) }, 2000)

function broadcast(n: NetworkName, e: Event) {
  const line = `event: ${e.type}\ndata: ${JSON.stringify(e)}\n\n`
  for (const res of clients.get(n) ?? []) res.write(line)
}

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const dist = path.resolve(__dirname, '../web/dist')
const MIME: Record<string, string> = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2', '.json': 'application/json' }

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', 'http://x')
  try {
    if (url.pathname === '/api/networks') return json(res, { networks: [...collectors.keys()], ready: Object.fromEntries([...collectors].map(([n, c]) => [n, c.ready])) })
    const m = url.pathname.match(/^\/api\/(mainnet|testnet)\/(snapshot|health|events|sample-tx|tx\/(0x[0-9a-fA-F]{64}))$/)
    if (m) {
      const net = m[1] as NetworkName; const c = collectors.get(net)
      if (!c) return json(res, { error: `network ${net} is not running` }, 404)
      const what = m[2]
      if (what === 'snapshot') return json(res, c.ready ? c.snapshot() : { ready: false })
      if (what === 'health') return json(res, c.ready ? c.health() : { ready: false })
      if (what === 'sample-tx') return json(res, { hash: await c.sampleTx() })
      if (what.startsWith('tx/')) return json(res, await lookupTx(c, m[3]))
      if (what === 'events') {
        res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache', connection: 'keep-alive' })
        res.write(`event: hello\ndata: ${JSON.stringify({ network: net, ready: c.ready })}\n\n`)
        if (c.ready) res.write(`event: snapshot\ndata: ${JSON.stringify({ type: 'snapshot', snapshot: c.snapshot() })}\n\n`)
        clients.get(net)!.add(res)
        req.on('close', () => clients.get(net)!.delete(res))
        return
      }
    }
    let p = path.join(dist, url.pathname === '/' ? 'index.html' : url.pathname)
    if (!p.startsWith(dist)) { res.writeHead(403); return res.end() }
    if (!fs.existsSync(p) || fs.statSync(p).isDirectory()) p = path.join(dist, 'index.html')
    if (!fs.existsSync(p)) return json(res, { error: 'not found' }, 404)
    res.writeHead(200, { 'content-type': MIME[path.extname(p)] ?? 'application/octet-stream' })
    fs.createReadStream(p).pipe(res)
  } catch (e) { json(res, { error: (e as Error).message }, 500) }
})
function json(res: http.ServerResponse, body: unknown, code = 200) { res.writeHead(code, { 'content-type': 'application/json' }); res.end(JSON.stringify(body)) }
const port = Number(process.env.PORT ?? 8787)
server.listen(port, () => console.log(`[server] monitoring ${[...collectors.keys()].join(', ')} on http://localhost:${port}`))
