import { h, at, G } from '../dom'
import { state } from '../state'
import { copyBtn, link } from '../ui'
import { titleRow, Facts, ROW } from '../layout'
import { fmtAge } from '../api'

const NAME: Record<string, string> = { rollup: 'Rollup', sequencerInbox: 'Sequencer inbox', bridge: 'Bridge', inbox: 'Inbox', outbox: 'Outbox' }
const WHAT: Record<string, string> = { rollup: 'assertions', sequencerInbox: 'batches', bridge: 'deposits', inbox: 'messages in', outbox: 'withdrawals' }

/** Network: four facts and the five contracts this monitor reads, nothing else. */
export function networkTab() {
  const el = h('div')
  titleRow(el, 'Read from the <em>contracts</em>, nothing self-reported.')
  const facts = new Facts(el, ROW.hero + 16)
  const list = at(h('ul', { class: 'contracts', 'aria-label': 'Rollup contracts on HyperEVM' }), G.x(1), ROW.hero + 180, G.w(12)); el.append(list)
  const foot = at(h('p', { class: 'foot' }), G.x(1), ROW.hero + 180 + 5 * 56 + 40, G.w(12)); el.append(foot)
  function draw() {
    const s = state.snapshot; if (!s) return
    facts.set([
      { k: 'network', v: `Elysium <em>${s.network.name}</em>`, s: `chain ${s.network.elysiumChainId} · settles to HyperEVM ${s.network.hyperevmChainId}` },
      { k: 'block interval', v: `${Math.round(s.elysium.blockInterval)} <em>ms</em>`, s: 'measured over the last 120 heads' },
      { k: 'batch cadence', v: s.health.batches.medianInterval ? `every ${fmtAge(s.health.batches.medianInterval)}` : 'measuring', s: 'median of the last 12' },
      { k: 'parent lag', v: `${s.elysium.l1Lag} <em>blocks</em>`, s: 'HyperEVM blocks Elysium has not seen yet' },
    ])
    list.innerHTML = ''
    for (const [k, addr] of Object.entries(s.network.contracts)) {
      const li = h('li', { class: 'contract' }, [
        h('span', { class: 'cn' }, NAME[k] ?? k), h('span', { class: 'cw' }, WHAT[k] ?? ''),
        h('span', { class: 'ca' }, [link(`${s.network.explorer.hyperevm}/address/${addr}`, addr), copyBtn(addr)]),
      ])
      list.append(li)
    }
    foot.innerHTML = `Built on Elysium. Not affiliated with or endorsed by Kinetiq or Hyperliquid. Addresses from <a class="lnk" target="_blank" rel="noopener" href="https://elysium.kinetiq.xyz/docs/contract-addresses">Kinetiq's contract list</a>. How each health light decides is explained in its tooltip.`
  }
  state.onSnapshot.on(() => { if (el.style.display !== 'none') draw() })
  return { el, onShow: draw }
}
