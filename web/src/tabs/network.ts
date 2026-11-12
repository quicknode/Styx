import { h, at, G } from '../dom'
import { state } from '../state'
import { copyBtn, link, row, enter } from '../ui'
import { fmtAge } from '../api'

const DESC: Record<string, string> = {
  rollup: 'The rollup: configuration and confirmed state. Emits assertion events.',
  sequencerInbox: 'Receives batches from the sequencer. Emits SequencerBatchDelivered.',
  bridge: 'Holds bridged HYPE and records every message between the chains.',
  inbox: 'Where deposits and messages from HyperEVM to Elysium are submitted.',
  outbox: 'Executes withdrawals on HyperEVM once their assertion is confirmed.',
}

/** Network: chain facts, the contracts this monitor reads, and exactly how each health light is computed. */
export function networkTab() {
  const el = h('div')
  el.append(at(h('div', { class: 'h2', html: 'What this monitor <em>reads</em>, and how it judges.' }), G.x(1), 16))
  const facts = at(h('div', { style: 'position:absolute;display:flex;gap:48px' }), G.x(1), 86); el.append(facts)
  const widths = [190, 440, 560]
  const table = at(h('div', { class: 'table' }), G.x(1), 200, G.w(8)); el.append(table)
  const head = h('div', { class: 'th' }); ['contract', 'address on hyperevm', 'role'].forEach((t, i) => head.append(h('div', { class: 'td', style: `width:${widths[i]}px` }, t))); table.append(head)
  const body = h('div'); table.append(body)
  const rules = at(h('div', { class: 'panel' }, [h('span', { class: 'panel-title' }, 'How the health strip decides')]), G.x(10), 200, G.w(3), 470); el.append(rules)
  const rulesBody = h('div', { class: 'prose', style: 'position:absolute;left:24px;right:24px;top:28px;font-size:13.5px;line-height:1.55' }); rules.append(rulesBody)
  const foot = at(h('div', { class: 'prose', style: 'font-size:14px;width:' + G.w(8) + 'px;color:var(--ink-50)' }, ''), G.x(1), 540); el.append(foot)

  function draw() {
    const s = state.snapshot; if (!s) return
    facts.innerHTML = ''
    const kv = (k: string, v: string, sub = '') => facts.append(h('div', { class: 'kv', style: 'position:relative' }, [h('div', { class: 'k' }, k), h('div', { class: 'v', html: v }), ...(sub ? [h('div', { class: 's' }, sub)] : [])]))
    kv('network', `Elysium <em>${s.network.name}</em>`, `chain id ${s.network.elysiumChainId}`)
    kv('settles to', 'HyperEVM', `chain id ${s.network.hyperevmChainId}`)
    kv('block interval', `${Math.round(s.elysium.blockInterval)} <em>ms</em>`, 'measured over the last 120 heads')
    kv('batch cadence', `every ${fmtAge(s.health.batches.medianInterval)}`, 'median of the last 12')
    kv('parent lag', `${s.elysium.l1Lag} <em>blocks</em>`, 'HyperEVM head minus the head Elysium has seen')
    enter(facts.children, .05)
    body.innerHTML = ''
    for (const [k, addr] of Object.entries(s.network.contracts)) {
      const r = row([k.replace(/([A-Z])/g, ' $1').toLowerCase(), '', DESC[k] ?? ''], widths)
      r.children[1].append(link(`${s.network.explorer.hyperevm}/address/${addr}`, addr), copyBtn(addr)); r.children[1].classList.add('mono'); r.children[2].classList.add('dim')
      body.append(r)
    }
    enter(body.children, .04)
    const hh = s.health
    rulesBody.innerHTML = `<b>Sequencer</b> is live while the newest Elysium block is under 4 s old, pending under 20 s, failure beyond.<br><br><b>Batches</b> compare the age of the last batch with the median gap of the last 12 (${fmtAge(hh.batches.medianInterval)} now): live under 2×, pending under 4×.<br><br><b>Data availability</b> reads the first byte of the batch payload. <code>0x88</code> is an AnyTrust certificate. Full data posted to HyperEVM means the committee fell back.<br><br><b>Assertions</b> compare the last confirmation with the median creation gap, floored at one hour: live under 2×, pending under 4×.<br><br>Nothing here is self-reported. Every value comes from HyperEVM logs and Elysium headers over Quicknode endpoints.`
    foot.innerHTML = `Built on Elysium. Not affiliated with or endorsed by Kinetiq or Hyperliquid. Contract addresses from <a class="lnk" target="_blank" rel="noopener" href="https://elysium.kinetiq.xyz/docs/contract-addresses">Kinetiq's contract-addresses page</a>. Explorers: <a class="lnk" target="_blank" rel="noopener" href="${s.network.explorer.elysium}">Elysium</a> · <a class="lnk" target="_blank" rel="noopener" href="${s.network.explorer.hyperevm}">HyperEVM</a>.`
  }
  state.onSnapshot.on(() => { if (el.style.display !== 'none') draw() })
  return { el, onShow: draw }
}
