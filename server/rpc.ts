export interface Log {
  address: string
  topics: string[]
  data: string
  blockNumber: string
  transactionHash: string
  logIndex: string
}

export class RpcError extends Error {
  constructor(public code: number, message: string) { super(message) }
}

export class Rpc {
  private id = 1
  constructor(public url: string) {}

  /** POST with retries on transport failures and 5xx/429. JSON-RPC errors are returned to the caller unchanged. */
  private async post(body: unknown, label: string): Promise<any> {
    let lastErr: unknown
    for (let attempt = 0; attempt < 4; attempt++) {
      try {
        const res = await fetch(this.url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(30000) })
        if (res.status === 429 || res.status >= 500) throw new RpcError(res.status, `${label}: HTTP ${res.status}`)
        if (!res.ok) throw new RpcError(res.status, `${label}: HTTP ${res.status}`)
        return await res.json()
      } catch (e) {
        lastErr = e
        const code = e instanceof RpcError ? e.code : 0
        const transient = !(e instanceof RpcError) || code === 429 || code >= 500
        if (!transient || attempt === 3) throw e
        await new Promise((r) => setTimeout(r, 400 * 2 ** attempt + Math.random() * 200))
      }
    }
    throw lastErr
  }

  async call<T = any>(method: string, params: unknown[] = []): Promise<T> {
    const j = await this.post({ jsonrpc: '2.0', id: this.id++, method, params }, method)
    if (j.error) throw new RpcError(j.error.code ?? -1, `${method}: ${j.error.message}`)
    return j.result as T
  }

  async batch(calls: { method: string; params: unknown[] }[]): Promise<any[]> {
    if (calls.length === 0) return []
    const body = calls.map((c, i) => ({ jsonrpc: '2.0', id: i + 1, method: c.method, params: c.params }))
    const j = (await this.post(body, 'batch')) as any[]
    const byId = new Map(j.map((r) => [r.id, r]))
    return calls.map((_, i) => {
      const r = byId.get(i + 1)
      if (!r) return undefined
      if (r.error) return { __error: r.error }
      return r.result
    })
  }

  blockNumber = async () => hexToNum(await this.call<string>('eth_blockNumber'))

  getBlock = (tag: string | number, full = false) =>
    this.call<any>('eth_getBlockByNumber', [typeof tag === 'number' ? toHex(tag) : tag, full])

  getLogs = (p: { fromBlock: number; toBlock: number; address?: string | string[]; topics?: (string | null)[] }) =>
    this.call<Log[]>('eth_getLogs', [{ ...p, fromBlock: toHex(p.fromBlock), toBlock: toHex(p.toBlock) }])
}

export const toHex = (n: number | bigint) => '0x' + n.toString(16)
export const hexToNum = (h: string) => Number(BigInt(h))
export const hexToBig = (h: string) => BigInt(h)
/** Read the i-th 32-byte word of ABI data (hex string with 0x). */
export const word = (data: string, i: number) => '0x' + data.slice(2 + i * 64, 2 + (i + 1) * 64)
export const addrFromWord = (w: string) => '0x' + w.slice(-40)
