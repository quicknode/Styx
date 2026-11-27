import { h, at, G } from '../dom'
import { state, selectBatch } from '../state'
import { tooltip } from '../ui'
import { Facts, ROW } from '../layout'
import { Lanes } from '../stage/lanes'
import { BridgePanel } from '../stage/bridge'
import { fmtAge, fmtAgeShort } from '../api'
import { view } from '../view'

/** Live: two lanes, bridge rails, four facts. Everything else lives on its own tab. */
export function liveTab(openTab: (id: string) => void) {
  const el = h('div', { class: 'lanes-clickable' })
  const lanes = new Lanes(el)
  const bridge = new BridgePanel(el)
  const facts = new Facts(el, 680)
  let seeded = false

  const wireMarker = (m: HTMLElement) => {
    const seq = Number(m.dataset.seq); if (!seq || m.dataset.wired) return
    m.dataset.wired = '1'; m.setAttribute('role', 'button'); m.setAttribute('tabindex', '0'); m.setAttribute('aria-label', `Batch ${seq}, open details`)
    const open = () => { selectBatch(seq); openTab('batches') }
    m.addEventListener('click', open); m.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open() } })
    tooltip(m, () => { const b = state.snapshot?.batches.find((x) => x.seq === seq); return b ? `<b>batch #${b.seq}</b><br>${b.l2Blocks ? b.l2Blocks.toLocaleString('en-US') + ' blocks' : ''} · ${b.daMode === 'anytrust' ? 'AnyTrust cert' : b.daMode}<br><span class="dim">click for details</span>` : `batch #${seq}` })
  }
  new MutationObserver((muts) => { for (const mu of muts) for (const n of Array.from(mu.addedNodes)) if (n instanceof HTMLElement && n.classList.contains('marker') && !n.classList.contains('asrt')) wireMarker(n) }).observe(lanes.markers, { childList: true })

  const refreshFacts = (s: typeof state.snapshot) => {
    if (!s) return
    const last = s.batches.at(-1); const now = s.now
    const conf = s.assertions.filter((a) => a.confirmedTime).at(-1)
    facts.set([
      { k: 'block time', v: `${Math.round(s.elysium.blockInterval)} <em>ms</em>`, s: `block ${s.elysium.head?.number.toLocaleString('en-US') ?? '—'}` },
      { k: 'last batch', v: last ? `${fmtAgeShort(now - last.l1Time)} <em>ago</em>` : '—', s: last ? `#${last.seq}${s.health.batches.medianInterval ? ` · every ${fmtAge(s.health.batches.medianInterval)}` : ''}` : '', cls: 'hl' },
      { k: 'batching lag', v: s.elysium.unbatchedSeconds ? `${fmtAgeShort(s.elysium.unbatchedSeconds)} <em>behind</em>` : 'caught <em>up</em>', s: s.elysium.unbatchedBlocks ? `${s.elysium.unbatchedBlocks.toLocaleString('en-US')} blocks waiting` : '', cls: s.elysium.unbatchedSeconds > 900 ? 'amber' : '' },
      { k: 'last assertion', v: conf ? `${fmtAgeShort(now - conf.confirmedTime!)} <em>ago</em>` : 'none <em>yet</em>', s: `${s.health.assertions.openCount} open · ${s.health.assertions.confirmPeriod >= 3600 ? Math.round(s.health.assertions.confirmPeriod / 3600) + ' h' : s.health.assertions.confirmPeriod + ' s'} window` },
    ])
  }
  state.onSnapshot.on((s) => {
    const last = s.batches.at(-1)
    lanes.setOpen(last, s.elysium.head, s.now)
    lanes.setBacklog(s.elysium.unbatchedBlocks, s.elysium.unbatchedSeconds)
    lanes.setInterval(s.elysium.blockInterval)
    if (!seeded) { seeded = true; lanes.seedMarkers(s.batches, s.assertions); if (s.hyperevm.head) lanes.onL1Head(s.hyperevm.head); for (const m of Array.from(lanes.markers.children) as HTMLElement[]) wireMarker(m) }
    bridge.setCounts(s.bridge.perHour)
    { const w = s.bridge.withdrawals.at(-1); bridge.setLastWithdrawal(w ? s.now - w.l1Time : null, s.withdrawals24h) }
    refreshFacts(s)
  })
  state.onHead.on((hd) => { if (!state.paused) lanes.onHead(hd) })
  state.onL1Head.on(({ number, timestamp }) => lanes.onL1Head(number, timestamp))
  state.onBatch.on((b) => lanes.onBatch(b, Math.floor(Date.now() / 1000)))
  state.onAssertion.on(({ a, confirmed }) => lanes.onAssertion(a, confirmed))
  state.onDeposit.on((m) => bridge.deposit(m))
  state.onWithdrawal.on((w) => bridge.withdrawal(w))
  state.onNet.on(() => { seeded = false; lanes.markers.innerHTML = '' })
  // a new width or mode: the lanes and the bridge panel re-lay themselves out and the next snapshot reseeds the markers
  view.onChange.on(() => { lanes.layout(); bridge.layout(); seeded = false })
  setInterval(() => { const last = state.snapshot?.batches.at(-1); if (last) lanes.openAge.textContent = `last batch #${last.seq} · ${fmtAge(Math.floor(Date.now() / 1000) - last.l1Time)} ago` }, 1000)
  void at; void G
  return { el, lanes }
}
