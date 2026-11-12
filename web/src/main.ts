import './style.css'
import gsap from 'gsap'
import { connect, fetchSnapshot, fmtAge, type Assertion, type Snapshot } from './api'
import { HealthStrip } from './stage/health'
import { Lanes } from './stage/lanes'
import { BridgePanel } from './stage/bridge'
import { Tracker } from './stage/tracker'

// scale the fixed 1920x1080 deck to the window
const deck = document.getElementById('deck')!
function fit() { const sc = Math.min(innerWidth / 1920, innerHeight / 1080); deck.style.transform = `translate(-50%,-50%) scale(${sc})` }
addEventListener('resize', fit); fit()

const stage = document.getElementById('stage')!
const health = new HealthStrip(document.getElementById('health')!)
const lanes = new Lanes(stage)
const bridge = new BridgePanel(stage)
const tracker = new Tracker(stage)
const caption = document.getElementById('caption')!
const counter = document.getElementById('counter')!
const netname = document.getElementById('netname')!

gsap.from('#toprule', { scaleX: 0, duration: 1.2, ease: 'power3.out' })
gsap.from('#top, #bottom', { opacity: 0, y: 8, duration: .9, ease: 'power3.out', stagger: .1 })

let snap: Snapshot | null = null
let lastSentence = ''
function applySnapshot(s: Snapshot) {
  const first = !snap
  snap = s
  netname.textContent = `Elysium ${s.network.name}`
  health.update(s.health)
  const last = s.batches.at(-1)
  lanes.setOpen(last, s.elysium.head, s.now)
  lanes.setBacklog(s.elysium.unbatchedBlocks, s.elysium.unbatchedSeconds)
  if (first) {
    lanes.assertions = s.assertions; lanes.seedMarkers(s.batches, s.assertions); lanes.renderAssertions()
    if (s.hyperevm.head) lanes.onL1Head(s.hyperevm.head)
  }
  bridge.setCounts(s.bridge.perHour)
  if (s.health.sentence !== lastSentence) {
    lastSentence = s.health.sentence
    gsap.to(caption, { opacity: 0, duration: .25, onComplete: () => { caption.textContent = lastSentence; gsap.to(caption, { opacity: 1, duration: .5 }) } })
  }
  counter.innerHTML = [
    `chain ${s.network.elysiumChainId} → ${s.network.hyperevmChainId}`,
    last ? `batch #${last.seq} · ${last.daHeader} · ${last.dataBytes} bytes${last.l2Blocks ? ` · ${last.l2Blocks} blocks` : ''}` : '',
    `l1 lag ${s.elysium.l1Lag} blocks · delayed msgs ${s.delayedMessages.lastHour}/h`,
  ].filter(Boolean).join('<br>')
}

fetchSnapshot().then((s) => { if ((s as any).network) applySnapshot(s) }).catch(() => {})
connect({
  snapshot: applySnapshot,
  head: (hd) => lanes.onHead(hd),
  l1head: (n) => lanes.onL1Head(n),
  batch: (b) => { lanes.onBatch(b, Math.floor(Date.now() / 1000)); flash() },
  batch_detail: (b) => lanes.onBatchDetail(b),
  assertion_created: (a) => { upsert(a); lanes.onAssertion(a, false) },
  assertion_confirmed: (a) => { upsert(a); lanes.onAssertion(a, true); flash() },
  deposit: (m) => bridge.deposit(m),
  withdrawal: (w) => bridge.withdrawal(w),
  status: (ok) => { if (!ok) caption.textContent = 'Reconnecting to the monitor…' },
})
function upsert(a: Assertion) {
  const i = lanes.assertions.findIndex((x) => x.hash === a.hash)
  if (i >= 0) lanes.assertions[i] = { ...lanes.assertions[i], ...a }; else lanes.assertions.push(a)
}
/** A soft paper flash on settlement events, the way a stamp lands. */
function flash() {
  const f = document.createElement('div')
  f.style.cssText = 'position:absolute;inset:0;background:var(--ely);opacity:0;pointer-events:none;z-index:9'
  deck.append(f)
  gsap.to(f, { opacity: .08, duration: .12, yoyo: true, repeat: 1, onComplete: () => f.remove() })
}
// keep relative ages fresh
setInterval(() => { if (snap) { const last = snap.batches.at(-1); if (last) lanes.openAge.textContent = `last batch ${fmtAge(Math.floor(Date.now() / 1000) - last.l1Time)} ago` } }, 1000)
