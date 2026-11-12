import gsap from 'gsap'
import { h, at, layer, s as svg, txt } from '../dom'
import { state } from '../state'
import { tooltip } from '../ui'
import { titleRow, hero, Facts, ROW } from '../layout'
import { fmtAge, fmtTime, type Batch } from '../api'

/**
 * Fairness: can every transaction get in? Deposits and messages from HyperEVM queue in the delayed inbox
 * until the sequencer reads them. If it ignores one past the window, anyone can force it in.
 */
export function fairnessTab() {
  const el = h('div')
  titleRow(el, 'Can every transaction get <em>in</em>?')
  const CH = ROW.heroH, CW = 1776
  const chart = hero(el, CH); chart.setAttribute('role', 'img'); chart.setAttribute('aria-label', 'Delayed messages absorbed per batch')
  const axis = layer(CW, CH); chart.append(axis)
  const bars = h('div', { style: 'position:absolute;inset:0' }); chart.append(bars)
  const facts = new Facts(el)
  const note = at(h('p', { class: 'prose', style: 'font-size:18px;width:' + CW + 'px' }, ''), 72, ROW.facts + 130); el.append(note)

  let sig = ''
  function draw(force = false) {
    const s = state.snapshot; if (!s) return
    const list = s.batches.filter((b) => b.delayedRead !== undefined).slice(-49)
    const absorbed = list.slice(1).map((b, i) => ({ b, n: Math.max(0, b.delayedRead! - list[i].delayedRead!) }))
    const nsig = absorbed.map((x) => `${x.b.seq}.${x.n}`).join(',')
    if (!force && nsig === sig) { drawFacts(); return }
    const animate = force || !sig || absorbed.at(-1)?.b.seq !== undefined && !sig.endsWith(`${absorbed.at(-1)!.b.seq}.${absorbed.at(-1)!.n}`)
    sig = nsig
    bars.innerHTML = ''; axis.innerHTML = ''
    if (!absorbed.length) return
    const max = Math.max(1, ...absorbed.map((x) => x.n))
    const bw = CW / absorbed.length
    axis.append(svg('path', { class: 'hair2', d: `M 0 ${CH - 28} H ${CW}` }))
    ;[0.5, 1].forEach((f) => { const y = CH - 28 - (CH - 60) * f; axis.append(svg('path', { class: 'hair', d: `M 0 ${y} H ${CW}` })); axis.append(txt(0, y - 6, `${Math.round(max * f).toLocaleString('en-US')} messages`)) })
    axis.append(txt(0, CH - 8, `#${absorbed[0].b.seq}`)); axis.append(txt(CW, CH - 8, `#${absorbed.at(-1)!.b.seq} · newest`, '', 'end'))
    absorbed.forEach((x, i) => {
      const hgt = Math.max(3, (x.n / max) * (CH - 60))
      const bar = at(h('div', { class: 'bar ' + (x.b.forced ? 'hatch' : 'hl') }), i * bw + 3, 0, Math.max(3, bw - 6), hgt); bar.style.top = ''; bar.style.bottom = '28px'
      tooltip(bar, () => `<b>batch #${x.b.seq}</b><br>read ${x.n.toLocaleString('en-US')} delayed message${x.n === 1 ? '' : 's'} from HyperEVM<br>${fmtTime(x.b.l1Time)}${x.b.forced ? '<br><b>forced inclusion</b>' : ''}`)
      bars.append(bar)
    })
    if (animate) gsap.from(bars.children, { scaleY: 0, duration: .3, stagger: .004, ease: 'power3.out', overwrite: true })
    drawFacts()
  }
  function drawFacts() {
    const s = state.snapshot; if (!s) return
    const q = s.inclusion
    const win = q.forceWindowSec ? fmtAge(q.forceWindowSec) : '—'
    const overdue = q.forceWindowSec && q.oldestWaitingSec > q.forceWindowSec
    facts.set([
      { k: 'waiting to be read', v: `${q.backlog.toLocaleString('en-US')}`, s: `of ${q.submitted.toLocaleString('en-US')} messages ever sent from HyperEVM`, cls: overdue ? 'warn' : '' },
      { k: 'oldest waiting', v: q.oldestWaitingSec ? `${fmtAge(q.oldestWaitingSec)}` : 'none', s: q.absorbedLast ? `last batch read ${q.absorbedLast.toLocaleString('en-US')}` : 'queue is empty', cls: overdue ? 'warn' : q.oldestWaitingSec > 3600 ? 'amber' : '' },
      { k: 'force window', v: `${win}`, s: 'after this, anyone can include a message themselves' },
      { k: 'forced inclusions', v: `${q.forcedLast24h}`, s: 'in the last 24 h', cls: q.forcedLast24h ? 'amber' : '' },
    ])
    note.innerHTML = `Deposits and messages sent from HyperEVM wait in a <em>delayed inbox</em> until the sequencer reads them into a batch. ${q.submitted24h.toLocaleString('en-US')} were sent in the last 24 h. If the sequencer ignores one for longer than the force window, anyone can call <code>forceInclusion</code> on HyperEVM and the chain must accept it, which is what keeps a single sequencer honest. Forced batches show hatched.`
  }
  state.onSnapshot.on(() => { if (el.style.display !== 'none') draw() })
  state.onNet.on(() => { bars.innerHTML = ''; sig = '' })
  return { el, onShow: () => draw(true) }
}
