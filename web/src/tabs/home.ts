import gsap from 'gsap'
import { h, at, G } from '../dom'
import { state } from '../state'
import { HealthStrip } from '../stage/health'
import { fetchSampleTx, type Snapshot } from '../api'

/** Home: is Elysium settling properly right now? Four lights, one sentence, one search box. */
export function homeTab(openTab: (id: string) => void, lookup: (hash: string) => void) {
  const el = h('div')
  const title = at(h('h2', { class: 'h2 home-title', html: 'Is Elysium <em>settling</em> right now?' }), G.x(1), 0); el.append(title)
  const sentence = at(h('p', { class: 'home-sentence', 'aria-live': 'polite' }, 'Connecting…'), G.x(1), 72, G.w(9)); el.append(sentence)
  const strip = at(h('div', { class: 'home-health' }), G.x(1), 180, G.w(12)); el.append(strip)
  const health = new HealthStrip(strip, (k) => openTab(k === 'sequencer' ? 'live' : k === 'data' ? 'batches' : k))

  const searchT = at(h('div', { class: 'lbl' }, 'follow a transaction'), G.x(1), 430); el.append(searchT)
  const input = h('input', { id: 'home-search', type: 'search', placeholder: 'Paste an Elysium transaction hash', spellcheck: 'false', autocomplete: 'off', 'aria-label': 'Elysium transaction hash' }) as HTMLInputElement
  at(input, G.x(1), 456, G.w(9) - 16); el.append(input)
  const sample = h('button', { class: 'btn ely', type: 'button' }, 'Try the newest batched tx'); at(sample, G.x(10), 456, G.w(3)); sample.style.position = 'absolute'; sample.style.justifyContent = 'center'; sample.style.height = '52px'; el.append(sample)
  const hint = at(h('div', { class: 'home-hint' }, 'You will see where it is: included on Elysium, batched to HyperEVM, confirmed, or asserted.'), G.x(1), 520, G.w(9)); el.append(hint)

  const go = (hash: string) => { hash = hash.trim(); if (!/^0x[0-9a-fA-F]{64}$/.test(hash)) { hint.textContent = 'That is not a transaction hash. It starts with 0x and has 64 hex characters.'; return } openTab('track'); setTimeout(() => lookup(hash), 300) }
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(input.value) })
  input.addEventListener('paste', () => setTimeout(() => go(input.value), 10))
  sample.addEventListener('click', async () => { hint.textContent = 'Fetching a transaction from the newest batch…'; const r = await fetchSampleTx(state.net); if (r.hash) go(r.hash); else hint.textContent = 'No batched block with transactions yet.' })

  const links = at(h('div', { class: 'home-links' }), G.x(1), 600, G.w(12)); el.append(links)
  const mk = (id: string, label: string, desc: string) => { const b = h('button', { class: 'home-link', type: 'button' }, [h('span', { class: 'hl-t' }, label), h('span', { class: 'hl-d' }, desc)]); b.addEventListener('click', () => openTab(id)); links.append(b) }
  mk('live', 'Live', 'Blocks and batches moving')
  mk('batches', 'Batches', 'Every batch as it landed')
  mk('assertions', 'Assertions', 'State claims and confirmations')
  mk('bridge', 'Bridge', 'Crossings per minute')
  mk('network', 'Network', 'Contracts this reads')

  let lastShape = ''
  function summarize(s: Snapshot) {
    const hh = s.health; const last = s.batches.at(-1); const now = s.now
    const coarse = (sec: number) => sec < 90 ? 'moments' : sec < 3600 ? `${Math.round(sec / 60)} min` : `${(sec / 3600).toFixed(1)} h`
    const parts = [
      `Blocks every <b>${Math.round(s.elysium.blockInterval / 10) * 10} ms</b>.`,
      last ? `Last batch landed <b>${coarse(now - last.l1Time)} ago</b>${s.elysium.unbatchedSeconds > 300 ? `, batching <b>${coarse(s.elysium.unbatchedSeconds)}</b> behind head` : ''}.` : '',
      hh.data.mode === 'anytrust' ? 'Data is posted as <b>AnyTrust certificates</b>.' : hh.data.mode === 'fulldata' ? 'Data is being posted <b>in full</b>, the committee fallback.' : '',
      hh.assertions.openCount ? `<b>${hh.assertions.openCount}</b> state claim${hh.assertions.openCount === 1 ? '' : 's'} waiting to confirm.` : 'No state claims waiting.',
    ].filter(Boolean).join(' ')
    const shape = parts.replace(/\d[\d,.]*/g, '#')
    if (shape !== lastShape) { lastShape = shape; sentence.innerHTML = parts; gsap.fromTo(sentence, { opacity: .4 }, { opacity: 1, duration: .5 }) } else sentence.innerHTML = parts
  }
  state.onSnapshot.on((s) => { health.update(s.health); summarize(s) })
  state.onNet.on(() => { lastShape = ''; sentence.textContent = 'Connecting…' })
  return { el, onShow: () => gsap.fromTo([title, sentence, strip, searchT, input, sample, hint, links], { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: .45, stagger: .05, ease: 'power2.out', overwrite: true }), focus: () => input.focus() }
}
