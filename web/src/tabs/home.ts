import gsap from 'gsap'
import { h, at, G } from '../dom'
import { state } from '../state'
import { tooltip } from '../ui'
import { fetchSampleTx, fmtAge, fmtAgeShort, type Health, type Snapshot } from '../api'

const RULE: Record<string, string> = {
  sequencer: '<b>Live</b> while the newest Elysium block is under 4 s old.<br>Pending under 20 s. Failure beyond.',
  batches: '<b>Live</b> while the last batch is younger than twice the measured cadence.<br>Pending under four times.',
  data: 'Reads the first byte of each batch payload.<br><b>0x88</b> is an AnyTrust certificate. Full data means the committee fell back.',
  assertions: 'A claim confirms only after the challenge window read from the rollup contract.<br><b>Live</b> while no open claim is older than the window plus 25%.',
}
const ITEMS: { key: keyof Omit<Health, 'sentence'>; label: string; word: (hh: Health) => string }[] = [
  { key: 'sequencer', label: 'Sequencer', word: (x) => ({ live: 'producing', pending: 'slowing', failure: 'no blocks', unknown: 'checking' })[x.sequencer.state] },
  { key: 'batches', label: 'Batches', word: (x) => ({ live: 'on time', pending: 'late', failure: 'stalled', unknown: 'measuring' })[x.batches.state] },
  { key: 'data', label: 'Data', word: (x) => x.data.mode === 'anytrust' ? 'AnyTrust' : x.data.mode === 'fulldata' ? 'full data' : x.data.mode === 'blob' ? 'blob' : 'checking' },
  { key: 'assertions', label: 'Claims', word: (x) => ({ live: 'in window', pending: 'behind', failure: 'stalled', unknown: 'checking' })[x.assertions.state] },
]

/** Verdict first, then the instrument bar, then the detail, then the action. */
function verdict(hh: Health): { html: string; cls: string } {
  if (hh.sequencer.state === 'failure') return { html: 'No new Elysium <em>blocks</em>.', cls: 'warn' }
  if (hh.batches.state === 'failure') return { html: 'Batches have <em>stalled</em>.', cls: 'warn' }
  if (hh.assertions.state === 'failure') return { html: 'Claim confirmations have <em>stalled</em>.', cls: 'warn' }
  if (hh.data.mode === 'fulldata') return { html: 'Data is posting <em>in full</em>, the committee fallback.', cls: 'amber' }
  if (hh.batches.state === 'pending') return { html: 'Batches are running <em>late</em>.', cls: 'amber' }
  if (hh.sequencer.state === 'pending') return { html: 'Blocks are <em>slowing</em>.', cls: 'amber' }
  if (hh.assertions.state === 'pending') return { html: 'Claim confirmations are <em>falling behind</em>.', cls: 'amber' }
  const known = [hh.sequencer.state, hh.batches.state, hh.assertions.state].every((s) => s === 'live')
  return known ? { html: 'Elysium is settling <em>normally</em>.', cls: 'ok' } : { html: 'Checking the <em>chain</em>…', cls: '' }
}

export function homeTab(openTab: (id: string) => void, lookup: (hash: string) => void) {
  const el = h('div')
  const title = at(h('h2', { class: 'verdict', 'aria-live': 'polite', html: 'Checking the <em>chain</em>…' }), G.x(1), 0); el.append(title)
  const bar = at(h('div', { class: 'statusbar', role: 'list' }), G.x(1), 104, G.w(12)); el.append(bar)
  const items = new Map<string, { root: HTMLElement; word: HTMLElement; state: string }>()
  for (const it of ITEMS) {
    const word = h('span', { class: 'sword' }, '—')
    const root = h('div', { class: 'sb', role: 'listitem', tabindex: '0' }, [h('span', { class: 'sq', 'aria-hidden': 'true' }), h('span', { class: 'sl' }, it.label), word])
    root.addEventListener('click', () => openTab(it.key === 'sequencer' ? 'live' : it.key === 'data' ? 'batches' : it.key))
    root.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); root.click() } })
    tooltip(root, () => `${state.snapshot ? `<b>${state.snapshot.health[it.key].detail}</b><br>` : ''}${RULE[it.key]}`)
    bar.append(root); items.set(it.key, { root, word, state: '' })
  }
  const sentence = at(h('p', { class: 'home-detail' }, ''), G.x(1), 184, G.w(12)); el.append(sentence)
  const next = at(h('p', { class: 'home-next' }, ''), G.x(1), 240, G.w(10)); el.append(next)

  const rule = at(h('div', { class: 'hair-x' }), G.x(1), 352, G.w(12)); el.append(rule)
  const searchT = at(h('h3', { class: 'home-search-lbl', html: 'Where is my <em>transaction</em>?' }), G.x(1), 404); el.append(searchT)
  const input = h('input', { id: 'home-search', type: 'search', placeholder: 'Paste an Elysium transaction hash', spellcheck: 'false', autocomplete: 'off', 'aria-label': 'Elysium transaction hash' }) as HTMLInputElement
  at(input, G.x(1), 476, G.w(9) - 16); el.append(input)
  const sample = h('button', { class: 'home-go', type: 'button' }, [h('span', {}, 'Try the newest batched tx'), h('span', { class: 'arrow', 'aria-hidden': 'true' }, '→')]); at(sample, G.x(10), 476, G.w(3)); el.append(sample)
  const hint = at(h('div', { class: 'home-hint' }, 'You will see where it is: included on Elysium, batched to HyperEVM, confirmed, or asserted.'), G.x(1), 564, G.w(9)); el.append(hint)

  const go = (hash: string) => { hash = hash.trim(); if (!/^0x[0-9a-fA-F]{64}$/.test(hash)) { hint.textContent = 'That is not a transaction hash. It starts with 0x and has 64 hex characters.'; return } openTab('track'); setTimeout(() => lookup(hash), 300) }
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(input.value) })
  input.addEventListener('paste', () => setTimeout(() => go(input.value), 10))
  sample.addEventListener('click', async () => { hint.textContent = 'Fetching a transaction from the newest batch…'; const r = await fetchSampleTx(state.net); if (r.hash) go(r.hash); else hint.textContent = 'No batched block with transactions yet.' })

  let lastVerdict = ''; let lastShape = ''
  function apply(s: Snapshot) {
    const hh = s.health
    const v = verdict(hh)
    if (v.html !== lastVerdict) { lastVerdict = v.html; title.className = 'verdict ' + v.cls; gsap.to(title, { opacity: 0, y: -4, duration: .2, onComplete: () => { title.innerHTML = v.html; gsap.to(title, { opacity: 1, y: 0, duration: .45, ease: 'power2.out' }) } }) }
    for (const it of ITEMS) {
      const e = items.get(it.key)!; const st = hh[it.key].state; const w = it.word(hh)
      if (e.word.textContent !== w) e.word.textContent = w
      if (e.state !== st) { e.root.classList.remove('live', 'pending', 'failure'); if (st !== 'unknown') e.root.classList.add(st); gsap.fromTo(e.root.querySelector('.sq'), { scale: 1.8 }, { scale: 1, duration: .5, ease: 'back.out(2)' }); e.state = st }
    }
    const last = s.batches.at(-1); const now = s.now
    const n = (x: string) => `<b class="n">${x}</b>`
    const parts = [
      `Blocks every ${n(Math.round(s.elysium.blockInterval / 10) * 10 + ' ms')}.`,
      last ? `Last batch landed ${n(fmtAgeShort(now - last.l1Time))} ago${s.elysium.unbatchedSeconds > 300 ? `, batching ${n(fmtAgeShort(s.elysium.unbatchedSeconds))} behind head` : ''}.` : '',
      hh.assertions.openCount && hh.assertions.confirmPeriod ? (hh.assertions.pastWindow ? `${n(String(hh.assertions.openCount))} state claims open, ${n(String(hh.assertions.pastWindow))} past the ${n(Math.round(hh.assertions.confirmPeriod / 3600) + ' h')} window${hh.assertions.confirmEvery ? `, one confirms every ${n(fmtAgeShort(hh.assertions.confirmEvery))}` : ''}.` : `${n(String(hh.assertions.openCount))} state claim${hh.assertions.openCount === 1 ? '' : 's'} inside the ${n(Math.round(hh.assertions.confirmPeriod / 3600) + ' h')} challenge window.`) : '',
    ].filter(Boolean).join(' ')
    const shape = parts.replace(/\d[\d,.]*/g, '#')
    sentence.innerHTML = parts
    if (shape !== lastShape) { lastShape = shape; gsap.fromTo(sentence, { opacity: .4 }, { opacity: 1, duration: .4 }) }
    if (last && hh.batches.medianInterval) { const eta = hh.batches.medianInterval - (now - last.l1Time); next.textContent = eta > 30 ? `Next batch expected in about ${fmtAgeShort(eta)}.` : 'Next batch expected any moment.' } else next.textContent = ''
  }
  state.onSnapshot.on(apply)
  state.onNet.on(() => { lastVerdict = ''; lastShape = ''; title.innerHTML = 'Checking the <em>chain</em>…'; title.className = 'verdict'; sentence.textContent = ''; next.textContent = '' })
  return { el, onShow: () => gsap.fromTo([title, bar, sentence, next, rule, searchT, input, sample, hint], { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: .45, stagger: .05, ease: 'power2.out', overwrite: true }), focus: () => input.focus() }
}
