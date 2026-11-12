import './style.css'
import gsap from 'gsap'
import { connect, fetchSnapshot, fetchNetworks, type Net, type Snapshot } from './api'
import { state } from './state'
import { Tabs } from './tabs'
import { HealthStrip } from './stage/health'
import { liveTab } from './tabs/live'
import { batchesTab } from './tabs/batches'
import { assertionsTab } from './tabs/assertions'
import { bridgeTab } from './tabs/bridge'
import { trackTab } from './tabs/track'
import { networkTab } from './tabs/network'

const deck = document.getElementById('deck')!
function fit() { const sc = Math.min(innerWidth / 1920, innerHeight / 1080); deck.style.transform = `translate(-50%,-50%) scale(${sc})` }
addEventListener('resize', fit); fit()

const stage = document.getElementById('stage')!
const caption = document.getElementById('caption')!
const counter = document.getElementById('counter')!
const netname = document.getElementById('netname')!
const title = document.getElementById('title')!

const tabs = new Tabs(document.getElementById('tabs')!, stage)
const health = new HealthStrip(document.getElementById('health')!, (k) => tabs.show(k === 'sequencer' ? 'live' : k === 'data' ? 'batches' : k))
document.getElementById('netswitch')!.setAttribute('role', 'group'); document.getElementById('netswitch')!.setAttribute('aria-label', 'Network')
const live = liveTab((id) => tabs.show(id))
const batches = batchesTab(); const asserts = assertionsTab(); const bridge = bridgeTab(); const track = trackTab(); const network = networkTab()
tabs.add({ id: 'live', label: 'Live', key: '1', el: live.el })
tabs.add({ id: 'batches', label: 'Batches', key: '2', el: batches.el, onShow: batches.onShow })
tabs.add({ id: 'assertions', label: 'Assertions', key: '3', el: asserts.el, onShow: asserts.onShow })
tabs.add({ id: 'bridge', label: 'Bridge', key: '4', el: bridge.el, onShow: bridge.onShow })
tabs.add({ id: 'track', label: 'Track', key: '5', el: track.el, onShow: track.onShow })
tabs.add({ id: 'network', label: 'Network', key: '6', el: network.el, onShow: network.onShow })
const TITLES: Record<string, string> = {
  live: 'Settling to <span class="acc">HyperEVM</span>, live.', batches: 'Blocks into <span class="acc">batches</span>.', assertions: 'Claims, then <span class="acc">confirmations</span>.',
  bridge: 'HYPE crossing <span class="acc">both ways</span>.', track: 'One transaction, <span class="acc">four rungs</span>.', network: 'Read from the <span class="acc">contracts</span>.',
}
const origShow = tabs.show.bind(tabs)
tabs.show = (id: string, push = true) => { origShow(id, push); const t = tabs.current?.id ?? 'live'; gsap.to(title, { opacity: 0, duration: .2, onComplete: () => { title.innerHTML = TITLES[t]; gsap.to(title, { opacity: 1, duration: .4 }) } }) }

gsap.from('#toprule', { scaleX: 0, duration: 1.2, ease: 'power3.out' })
gsap.from('#top, #bottom', { opacity: 0, y: 8, duration: .9, ease: 'power3.out', stagger: .1 })

// ---- network switch ----
const sw = document.getElementById('netswitch')!
function paintNet() { for (const b of Array.from(sw.querySelectorAll('button')) as HTMLButtonElement[]) b.classList.toggle('on', b.dataset.net === state.net); netname.textContent = `Elysium ${state.net}` }
let disconnect: (() => void) | null = null
let lastSentence = ''
function applySnapshot(s: Snapshot) {
  state.snapshot = s
  health.update(s.health)
  state.onSnapshot.emit(s)
  if (s.health.sentence !== lastSentence) { lastSentence = s.health.sentence; gsap.to(caption, { opacity: 0, duration: .25, onComplete: () => { caption.textContent = lastSentence; gsap.to(caption, { opacity: 1, duration: .5 }) } }) }
  const last = s.batches.at(-1)
  counter.innerHTML = [`chain ${s.network.elysiumChainId} → ${s.network.hyperevmChainId}`, last ? `batch #${last.seq} · ${last.daHeader} · ${last.dataBytes} bytes${last.l2Blocks ? ` · ${last.l2Blocks} blocks` : ''}` : '', `l1 lag ${s.elysium.l1Lag} blocks · delayed msgs ${s.delayedMessages.lastHour}/h`].filter(Boolean).join('<br>')
}
function start(net: Net) {
  disconnect?.(); state.net = net; localStorage.setItem('esm.net', net); paintNet()
  state.snapshot = null; lastSentence = ''; caption.textContent = `Connecting to Elysium ${net}…`
  state.onNet.emit(net)
  fetchSnapshot(net).then((s) => { if ((s as any).network) applySnapshot(s) }).catch(() => {})
  disconnect = connect(net, {
    snapshot: applySnapshot,
    head: (hd) => state.onHead.emit(hd),
    l1head: (number, timestamp) => state.onL1Head.emit({ number, timestamp }),
    batch: (b) => { state.onBatch.emit(b); flash() },
    batch_detail: (b) => state.onBatchDetail.emit(b),
    assertion_created: (a) => state.onAssertion.emit({ a, confirmed: false }),
    assertion_confirmed: (a) => { state.onAssertion.emit({ a, confirmed: true }); flash() },
    deposit: (m) => state.onDeposit.emit(m),
    withdrawal: (w) => state.onWithdrawal.emit(w),
    status: (ok) => { if (!ok) caption.textContent = 'Reconnecting to the monitor…' },
  })
  const tab = tabs.current?.id ?? tabs.fromHash()
  location.hash = `tab=${tab}&net=${net}`
}
sw.addEventListener('click', (e) => { const b = (e.target as HTMLElement).closest('button') as HTMLButtonElement | null; if (b?.dataset.net && b.dataset.net !== state.net) start(b.dataset.net as Net) })
fetchNetworks().then((r) => { for (const b of Array.from(sw.querySelectorAll('button')) as HTMLButtonElement[]) b.disabled = !r.networks.includes(b.dataset.net as Net); if (!r.networks.includes(state.net) && r.networks[0]) state.net = r.networks[0]; start(state.net) }).catch(() => start(state.net))

/** A soft paper flash on settlement events, the way a stamp lands. */
function flash() { const f = document.createElement('div'); f.style.cssText = 'position:absolute;inset:0;background:var(--ely);opacity:0;pointer-events:none;z-index:9'; deck.append(f); gsap.to(f, { opacity: .08, duration: .12, yoyo: true, repeat: 1, onComplete: () => f.remove() }) }

// ---- keyboard ----
addEventListener('keydown', (e) => {
  if ((e.target as HTMLElement)?.tagName === 'INPUT') { if (e.key === 'Escape') (e.target as HTMLElement).blur(); return }
  if (e.key === '/') { e.preventDefault(); tabs.show('track'); setTimeout(() => track.focus(), 350) }
  if (e.key === 'p') { state.paused = !state.paused; if (state.paused) gsap.globalTimeline.pause(); else gsap.globalTimeline.resume(); caption.textContent = state.paused ? 'Paused. Press p to resume.' : lastSentence }
  if (e.key === 'm') start('mainnet'); if (e.key === 't') start('testnet')
})
tabs.show(tabs.fromHash(), false)
