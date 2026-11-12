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

  async call<T = any>(method: string, params: unknown[] = []): Promise<T> {
    const res = await fetch(this.url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: this.id++, method, params }),
    })
    if (!res.ok) throw new RpcError(res.status, `${method}: HTTP ${res.status}`)
    const j = (await res.json()) as any
    if (j.error) throw new RpcError(j.error.code ?? -1, `${method}: ${j.error.message}`)
    return j.result as T
  }

  async batch(calls: { method: string; params: unknown[] }[]): Promise<any[]> {
    if (calls.length === 0) return []
    const body = calls.map((c, i) => ({ jsonrpc: '2.0', id: i + 1, method: c.method, params: c.params }))
    const res = await fetch(this.url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
    if (!res.ok) throw new RpcError(res.status, `batch: HTTP ${res.status}`)
    const j = (await res.json()) as any[]
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
