import gsap from 'gsap'
import { h, at, G } from '../dom'
import { state } from '../state'
import { HealthStrip } from '../stage/health'
import { fetchSampleTx, type Snapshot } from '../api'

/** Home: is Elysium settling properly right now? Four lights, one sentence, one search box. */
export function homeTab(openTab: (id: string) => void, lookup: (hash: string) => void) {
  const el = h('div')
  const searchT = at(h('h2', { class: 'home-search-lbl', html: 'Where is my <em>transaction</em>?' }), G.x(1), 0); el.append(searchT)
  const input = h('input', { id: 'home-search', type: 'search', placeholder: 'Paste an Elysium transaction hash', spellcheck: 'false', autocomplete: 'off', 'aria-label': 'Elysium transaction hash' }) as HTMLInputElement
  at(input, G.x(1), 72, G.w(9) - 16); el.append(input)
  const sample = h('button', { class: 'btn ely', type: 'button' }, 'Try the newest batched tx'); at(sample, G.x(10), 72, G.w(3)); sample.style.position = 'absolute'; sample.style.justifyContent = 'center'; sample.style.height = '72px'; el.append(sample)
  const hint = at(h('div', { class: 'home-hint' }, 'You will see where it is: included on Elysium, batched to HyperEVM, confirmed, or asserted.'), G.x(1), 156, G.w(9)); el.append(hint)

  const strip = at(h('div', { class: 'home-health' }), G.x(1), 236, G.w(12)); el.append(strip)
  const health = new HealthStrip(strip, (k) => openTab(k === 'sequencer' ? 'live' : k === 'data' ? 'batches' : k))

  const title = at(h('h2', { class: 'h2 home-title', html: 'Is Elysium <em>settling</em> right now?' }), G.x(1), 480); el.append(title)
  const sentence = at(h('p', { class: 'home-sentence', 'aria-live': 'polite' }, 'Connecting…'), G.x(1), 552, G.w(9)); el.append(sentence)

  const go = (hash: string) => { hash = hash.trim(); if (!/^0x[0-9a-fA-F]{64}$/.test(hash)) { hint.textContent = 'That is not a transaction hash. It starts with 0x and has 64 hex characters.'; return } openTab('track'); setTimeout(() => lookup(hash), 300) }
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(input.value) })
  input.addEventListener('paste', () => setTimeout(() => go(input.value), 10))
  sample.addEventListener('click', async () => { hint.textContent = 'Fetching a transaction from the newest batch…'; const r = await fetchSampleTx(state.net); if (r.hash) go(r.hash); else hint.textContent = 'No batched block with transactions yet.' })


  let lastShape = ''
  function summarize(s: Snapshot) {
    const hh = s.health; const last = s.batches.at(-1); const now = s.now
    const coarse = (sec: number) => sec < 90 ? 'moments' : sec < 3600 ? `${Math.round(sec / 60)} min` : `${(sec / 3600).toFixed(1)} h`
    const parts = [
      `Blocks every <b class="n">${Math.round(s.elysium.blockInterval / 10) * 10} ms</b>.`,
      last ? `Last batch landed <b class="n">${coarse(now - last.l1Time)}</b> ago${s.elysium.unbatchedSeconds > 300 ? `, batching <b class="n">${coarse(s.elysium.unbatchedSeconds)}</b> behind head` : ''}.` : '',
      hh.data.mode === 'anytrust' ? 'Data is posted as <b>AnyTrust certificates</b>.' : hh.data.mode === 'fulldata' ? 'Data is being posted <b>in full</b>, the committee fallback.' : '',
      hh.assertions.openCount ? `<b class="n">${hh.assertions.openCount}</b> state claim${hh.assertions.openCount === 1 ? '' : 's'} waiting to confirm.` : 'No state claims waiting.',
    ].filter(Boolean).join(' ')
    const shape = parts.replace(/\d[\d,.]*/g, '#')
    if (shape !== lastShape) { lastShape = shape; sentence.innerHTML = parts; gsap.fromTo(sentence, { opacity: .4 }, { opacity: 1, duration: .5 }) } else sentence.innerHTML = parts
  }
  state.onSnapshot.on((s) => { health.update(s.health); summarize(s) })
  state.onNet.on(() => { lastShape = ''; sentence.textContent = 'Connecting…' })
  return { el, onShow: () => gsap.fromTo([searchT, input, sample, hint, strip, title, sentence], { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: .45, stagger: .05, ease: 'power2.out', overwrite: true }), focus: () => input.focus() }
}
