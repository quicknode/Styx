import gsap from 'gsap'
import { h } from '../dom'
import { state, selectBatch } from '../state'
import { tooltip } from '../ui'
import { Lanes } from '../stage/lanes'
import { BridgePanel } from '../stage/bridge'
import { Tracker } from '../stage/tracker'
import { fmtAge, fmtTime } from '../api'

/** The overview: two lanes, assertion row, bridge panel, and the compact tracker. Markers are clickable. */
export function liveTab(openTab: (id: string) => void) {
  const el = h('div', { class: 'lanes-clickable' })
  const lanes = new Lanes(el)
  const bridge = new BridgePanel(el)
  const tracker = new Tracker(el)
  let seeded = false

  const wireMarker = (m: HTMLElement) => {
    const seq = Number(m.dataset.seq); if (!seq) return
    m.addEventListener('click', () => { selectBatch(seq); openTab('batches') })
    tooltip(m, () => {
      const b = state.snapshot?.batches.find((x) => x.seq === seq); if (!b) return `batch #${seq}`
      return `<b>batch #${b.seq}</b><br>${b.l2Blocks ? b.l2Blocks.toLocaleString('en-US') + ' Elysium blocks' : ''}${b.l2FirstBlock ? ` (${b.l2FirstBlock.toLocaleString('en-US')} → ${b.l2LastBlock!.toLocaleString('en-US')})` : ''}<br>${b.daMode === 'anytrust' ? 'AnyTrust certificate' : b.daMode} · ${b.dataBytes} bytes<br>landed ${fmtTime(b.l1Time)}${b.postingDelay !== undefined ? ` · ${fmtAge(b.postingDelay)} after its last block` : ''}<br><span style="color:var(--ink-50)">click for details</span>`
    })
  }
  // observe markers added by the lanes so each gets a tooltip and click
  const mo = new MutationObserver((muts) => { for (const mu of muts) for (const n of Array.from(mu.addedNodes)) if (n instanceof HTMLElement && n.classList.contains('marker') && !n.classList.contains('asrt')) wireMarker(n) })
  mo.observe(lanes.markers, { childList: true })
  // tag markers with seq when created: patch the two creation points by reading the label text
  const tagAll = () => { for (const m of Array.from(lanes.markers.children) as HTMLElement[]) { if (!m.dataset.seq && !m.classList.contains('asrt')) { const t = m.textContent?.match(/#(\d+)/); if (t) { m.dataset.seq = t[1]; wireMarker(m) } } } }

  state.onSnapshot.on((s) => {
    const last = s.batches.at(-1)
    lanes.setOpen(last, s.elysium.head, s.now)
    lanes.setBacklog(s.elysium.unbatchedBlocks, s.elysium.unbatchedSeconds)
    if (!seeded) { seeded = true; lanes.assertions = s.assertions; lanes.seedMarkers(s.batches, s.assertions); lanes.renderAssertions(); if (s.hyperevm.head) lanes.onL1Head(s.hyperevm.head); tagAll() }
    bridge.setCounts(s.bridge.perHour)
  })
  state.onHead.on((hd) => { if (!state.paused) lanes.onHead(hd) })
  state.onL1Head.on(({ number }) => lanes.onL1Head(number))
  state.onBatch.on((b) => { lanes.onBatch(b, Math.floor(Date.now() / 1000)); setTimeout(tagAll, 50) })
  state.onBatchDetail.on((b) => lanes.onBatchDetail(b))
  state.onAssertion.on(({ a, confirmed }) => { const i = lanes.assertions.findIndex((x) => x.hash === a.hash); if (i >= 0) lanes.assertions[i] = { ...lanes.assertions[i], ...a }; else lanes.assertions.push(a); lanes.onAssertion(a, confirmed) })
  state.onDeposit.on((m) => bridge.deposit(m))
  state.onWithdrawal.on((w) => bridge.withdrawal(w))
  state.onNet.on(() => { seeded = false; lanes.markers.innerHTML = ''; lanes.asrtRow.innerHTML = ''; lanes.assertions = [] })

  const keepAges = setInterval(() => { const last = state.snapshot?.batches.at(-1); if (last) lanes.openAge.textContent = `last batch #${last.seq} · ${fmtAge(Math.floor(Date.now() / 1000) - last.l1Time)} ago` }, 1000)
  void keepAges
  return { el, tracker, lanes }
}
export function pulse(el: Element) { gsap.fromTo(el, { scale: 1.06 }, { scale: 1, duration: .5, ease: 'back.out(2)' }) }
