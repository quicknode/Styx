import './style.css'
import gsap from 'gsap'
import { connect, fetchSnapshot, fetchNetworks, type Net, type Snapshot } from './api'
import { state } from './state'
import { Tabs } from './tabs'
import { homeTab } from './tabs/home'
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
const netname = document.getElementById('netname')!

const tabs = new Tabs(document.getElementById('tabs')!, stage)
document.getElementById('netswitch')!.setAttribute('role', 'group'); document.getElementById('netswitch')!.setAttribute('aria-label', 'Network')
const live = liveTab((id) => tabs.show(id))
const batches = batchesTab(); const asserts = assertionsTab(); const bridge = bridgeTab(); const track = trackTab(); const network = networkTab()
const home = homeTab((id) => tabs.show(id), (hash) => track.lookup(hash))
tabs.add({ id: 'home', label: 'Home', key: '1', el: home.el, onShow: home.onShow })
tabs.add({ id: 'live', label: 'Live', key: '2', el: live.el })
tabs.add({ id: 'batches', label: 'Batches', key: '3', el: batches.el, onShow: batches.onShow })
tabs.add({ id: 'assertions', label: 'Assertions', key: '4', el: asserts.el, onShow: asserts.onShow })
tabs.add({ id: 'bridge', label: 'Bridge', key: '5', el: bridge.el, onShow: bridge.onShow })
tabs.add({ id: 'track', label: 'Track', key: '6', el: track.el, onShow: track.onShow })
tabs.add({ id: 'network', label: 'Network', key: '7', el: network.el, onShow: network.onShow })

gsap.from('#toprule', { scaleX: 0, duration: 1.2, ease: 'power3.out' })
gsap.from('#top', { opacity: 0, y: 8, duration: .9, ease: 'power3.out' })

// ---- network switch ----
const sw = document.getElementById('netswitch')!
function paintNet() { for (const b of Array.from(sw.querySelectorAll('button')) as HTMLButtonElement[]) b.classList.toggle('on', b.dataset.net === state.net); netname.textContent = `Elysium ${state.net}` }
let disconnect: (() => void) | null = null
function applySnapshot(s: Snapshot) {
  state.snapshot = s
  state.onSnapshot.emit(s)
}
function start(net: Net) {
  disconnect?.(); state.net = net; localStorage.setItem('esm.net', net); paintNet()
  state.snapshot = null
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
  if (e.key === '/') { e.preventDefault(); tabs.show('home'); setTimeout(() => home.focus(), 350) }
  if (e.key === 'p') { state.paused = !state.paused; if (state.paused) gsap.globalTimeline.pause(); else gsap.globalTimeline.resume() }
  if (e.key === 'm') start('mainnet'); if (e.key === 't') start('testnet')
})
tabs.show(tabs.fromHash(), false)
