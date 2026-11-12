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
const netbtn = document.getElementById('netbtn') as HTMLButtonElement
const netmenu = document.getElementById('netmenu') as HTMLUListElement
const livedot = document.getElementById('livedot')!
function paintNet() {
  netbtn.firstChild!.textContent = state.net === 'mainnet' ? 'Mainnet' : 'Testnet'; netname.textContent = state.net
  for (const li of Array.from(netmenu.children) as HTMLElement[]) li.setAttribute('aria-selected', String(li.dataset.net === state.net))
}
function toggleMenu(open?: boolean) { const o = open ?? netmenu.hidden; netmenu.hidden = !o; netbtn.setAttribute('aria-expanded', String(o)); if (o) (netmenu.querySelector('[aria-selected=true]') as HTMLElement)?.classList.add('focus') }
netbtn.addEventListener('click', () => toggleMenu())
netmenu.addEventListener('click', (e) => { const li = (e.target as HTMLElement).closest('li') as HTMLElement | null; if (!li || li.getAttribute('aria-disabled') === 'true') return; toggleMenu(false); if (li.dataset.net !== state.net) start(li.dataset.net as Net) })
addEventListener('click', (e) => { if (!netmenu.hidden && !(e.target as HTMLElement).closest('#netswitch')) toggleMenu(false) })
netbtn.addEventListener('keydown', (e) => { if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleMenu(true); (netmenu.querySelector('li') as HTMLElement)?.focus() } })
netmenu.addEventListener('keydown', (e) => { const items = Array.from(netmenu.querySelectorAll('li')) as HTMLElement[]; const i = items.indexOf(document.activeElement as HTMLElement); if (e.key === 'ArrowDown') { e.preventDefault(); items[(i + 1) % items.length].focus() } if (e.key === 'ArrowUp') { e.preventDefault(); items[(i - 1 + items.length) % items.length].focus() } if (e.key === 'Escape') { toggleMenu(false); netbtn.focus() } if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); (document.activeElement as HTMLElement).click() } })
for (const li of Array.from(netmenu.children)) li.setAttribute('tabindex', '-1')
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
    status: (ok) => { downSince = ok ? 0 : (downSince || Date.now()); paintDot() },
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
  const tx = location.hash.match(/tx=(0x[0-9a-fA-F]{64})/)?.[1]
  location.hash = `tab=${tab}&net=${net}${tx ? `&tx=${tx}` : ''}`
}
fetchNetworks().then((r) => { for (const li of Array.from(netmenu.children) as HTMLElement[]) li.setAttribute('aria-disabled', String(!r.networks.includes(li.dataset.net as Net))); if (!r.networks.includes(state.net) && r.networks[0]) state.net = r.networks[0]; start(state.net) }).catch(() => start(state.net))
/** The dot means "this page is receiving live data". Red only after the stream has been down for 6 s or the sequencer has stalled, so a blip never flashes it. */
let downSince = 0; let seqDown = false
function paintDot() { const down = (downSince && Date.now() - downSince > 6000) || seqDown; livedot.classList.toggle('off', !!down); livedot.title = down ? (seqDown ? 'No new Elysium blocks for 20 s' : 'Reconnecting to the monitor') : 'Live: receiving Elysium blocks' }
setInterval(paintDot, 1000)
state.onSnapshot.on((s) => { seqDown = s.health.sequencer.state === 'failure'; paintDot() })

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
