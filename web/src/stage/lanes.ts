import gsap from 'gsap'
import { at, h, layer, G } from '../dom'
import type { Assertion, Batch, Head } from '../api'
import { fmtAge } from '../api'

gsap.config({ force3D: true })

/**
 * Two lanes, one ticker. Everything that moves is a transform on a single
 * container per lane, advanced by gsap.ticker, so the stage stays at 60 fps
 * no matter how many blocks are on screen.
 */
export class Lanes {
  root: HTMLElement
  svg: SVGSVGElement
  markers: HTMLElement
  elyTitle!: HTMLElement; l1Title!: HTMLElement; l1Times: number[] = []
  elyNum: HTMLElement; l1Num: HTMLElement; openSeq: HTMLElement; openBlocks: HTMLElement; openAge: HTMLElement
  asrtRow: HTMLElement
  // geometry (stage coords)
  X = G.x(1); W = G.w(12)
  EY = 120; L1Y = 390
  TRACK_L = G.x(1) + 32; TRACK_R = G.x(1) + G.w(12) - 420
  // moving groups
  elyGroup: HTMLElement; l1Group: HTMLElement
  elyT0 = performance.now(); l1T0 = performance.now()
  ELY_SPEED = 90 / 1000   // px per ms: a 100 ms block is 9 px apart
  L1_SPEED = 14 / 1000    // 1 s blocks 14 px apart
  lastSeq = 0; openStartBlock = 0; l1Head = 0
  assertions: Assertion[] = []
  unbatchedBlocks = 0; unbatchedSeconds = 0

  constructor(stage: HTMLElement) {
    this.root = h('div', { style: 'position:absolute;inset:0' }); stage.append(this.root)
    this.svg = layer(); this.root.append(this.svg)

    this.elyTitle = h('span', { class: 'panel-title ely' }, 'Elysium · L2 blocks')
    this.l1Title = h('span', { class: 'panel-title hl' }, 'HyperEVM · settlement')
    const elyPanel = at(h('div', { class: 'panel tint ely' }, [this.elyTitle]), this.X, 40, this.W, 160)
    const l1Panel = at(h('div', { class: 'panel tint hl' }, [this.l1Title]), this.X, 310, this.W, 160)
    this.root.append(elyPanel, l1Panel)

    const laneW = this.TRACK_R - this.TRACK_L
    const mkLane = (y: number) => {
      const lane = at(h('div', { class: 'lane', style: 'overflow:hidden' }), this.TRACK_L, y - 40, laneW, 80)
      lane.append(h('div', { class: 'track' }))
      const grp = h('div', { class: 'grp' }); lane.append(grp)
      this.root.append(lane); return grp
    }
    this.elyGroup = mkLane(this.EY); this.l1Group = mkLane(this.L1Y)
    this.markers = at(h('div', { style: 'position:absolute;inset:0;pointer-events:none' }), 0, 0); this.root.append(this.markers)

    // right column, aligned on one baseline grid
    const RX = this.TRACK_R + 40
    this.elyNum = at(h('div', { class: 'num ely big' }, '—'), RX, this.EY - 46)
    this.openSeq = at(h('div', { class: 'lbl ely' }, 'latest block'), RX, this.EY + 10)
    this.openBlocks = at(h('div', { class: 'lbl' }, ''), RX, this.EY + 34)
    this.l1Num = at(h('div', { class: 'num hl big' }, '—'), RX, this.L1Y - 46)
    this.openAge = at(h('div', { class: 'lbl hl' }, ''), RX, this.L1Y + 10)
    this.root.append(this.elyNum, this.openSeq, this.openBlocks, this.l1Num, this.openAge)

    // connector

    this.asrtRow = h('div')
    gsap.from([elyPanel, l1Panel], { opacity: 0, y: 14, duration: .9, stagger: .15, ease: 'power3.out' })

    gsap.ticker.add(this.tick)
    for (const grp of [this.elyGroup, this.l1Group]) {
      grp.parentElement!.addEventListener('mousemove', (e) => {
        const t = (e.target as HTMLElement); const n = t.dataset.n
        if (!n) { this.hideTip(); return }
        const isL2 = grp === this.elyGroup
        this.showTip(e, `<b>${isL2 ? 'Elysium' : 'HyperEVM'} block ${Number(n).toLocaleString('en-US')}</b><br>${t.dataset.t ? new Date(Number(t.dataset.t) * 1000).toLocaleTimeString('en-US', { hour12: false }) : ''}${isL2 ? '<br><span class="dim">waiting for the next batch</span>' : ''}`)
      })
      grp.parentElement!.addEventListener('mouseleave', () => this.hideTip())
    }
  }
  private tip?: HTMLElement
  private showTip(e: MouseEvent, html: string) {
    const deck = document.getElementById('deck')!
    if (!this.tip) { this.tip = h('div', { class: 'tip' }); deck.append(this.tip) }
    const r = deck.getBoundingClientRect(); const sc = r.width / 1920
    this.tip.innerHTML = html; this.tip.style.left = Math.min(1920 - 340, (e.clientX - r.left) / sc + 16) + 'px'; this.tip.style.top = ((e.clientY - r.top) / sc - 12) + 'px'; this.tip.style.opacity = '1'
  }
  private hideTip() { if (this.tip) this.tip.style.opacity = '0' }

  private tick = () => {
    const now = performance.now()
    const ex = -(now - this.elyT0) * this.ELY_SPEED
    const lx = -(now - this.l1T0) * this.L1_SPEED
    this.elyGroup.style.transform = `translate3d(${ex}px,0,0)`
    this.l1Group.style.transform = `translate3d(${lx}px,0,0)`
    // cull offscreen children (cheap: only check the first child)
    const laneW = this.TRACK_R - this.TRACK_L
    for (const grp of [this.elyGroup, this.l1Group]) {
      const first = grp.firstElementChild as HTMLElement | null
      if (first && Number(first.dataset.x) + (grp === this.elyGroup ? -ex : -lx) < -40) first.remove()
    }
    void laneW
    // markers ride the L1 lane
    for (const m of Array.from(this.markers.children) as HTMLElement[]) {
      const bx = Number(m.dataset.x); if (!Number.isFinite(bx)) continue
      const x = this.TRACK_L + bx + lx
      if (x < this.TRACK_L - 30) { m.remove(); continue }
      m.style.transform = `translate3d(${x - this.TRACK_R}px,0,0)`
    }
  }

  /** x inside the moving group where "now" is, i.e. the right edge. */
  private elyNowX() { return (performance.now() - this.elyT0) * this.ELY_SPEED + (this.TRACK_R - this.TRACK_L) }
  private l1NowX() { return (performance.now() - this.l1T0) * this.L1_SPEED + (this.TRACK_R - this.TRACK_L) }

  private lastTickAt = 0
  private interval = 100
  setInterval(ms: number) { if (ms > 30 && ms < 2000) { this.interval = ms; this.elyTitle.textContent = `Elysium · L2 blocks · every ${Math.round(ms)} ms` } }
  /** Heads arrive in bursts over the socket; place ticks at an even cadence so the lane reads as the chain's real rhythm. */
  onHead(hd: Head) {
    this.setNum(this.elyNum, hd.number)
    const now = performance.now()
    let when = Math.max(now, this.lastTickAt + this.interval * 0.9)
    if (when - now > 600) when = now // never fall far behind reality
    this.lastTickAt = when
    const t = h('div', { class: 'tick' }); t.dataset.n = String(hd.number); t.dataset.t = String(hd.timestamp); const x = (when - this.elyT0) * this.ELY_SPEED + (this.TRACK_R - this.TRACK_L)
    t.dataset.x = String(x); t.style.transform = `translate3d(${x}px,0,0)`
    this.elyGroup.append(t)
    gsap.fromTo(t, { scaleY: 2.4, opacity: 0 }, { scaleY: 1, opacity: 1, duration: .35, ease: 'power2.out' })
    this.updateWaiting()
  }
  onL1Head(n: number, ts?: number) {
    if (n <= this.l1Head) return
    this.l1Head = n; this.setNum(this.l1Num, n)
    if (ts) { this.l1HeadTime = ts; this.l1Times.push(ts); if (this.l1Times.length > 30) this.l1Times.shift() }
    if (this.l1Times.length > 5) { const iv = (this.l1Times.at(-1)! - this.l1Times[0]) / (this.l1Times.length - 1); this.l1Title.textContent = `HyperEVM · settlement · every ${iv.toFixed(1)} s` }
    const b = h('div', { class: 'blk hl' }); b.dataset.n = String(n); if (ts) b.dataset.t = String(ts); const x = this.l1NowX()
    b.dataset.x = String(x); b.style.transform = `translate3d(${x}px,0,0)`
    this.l1Group.append(b)
    gsap.fromTo(b, { scale: 1.8, opacity: 0 }, { scale: 1, opacity: 1, duration: .5, ease: 'back.out(2.5)' })
  }
  private lastNums = new Map<HTMLElement, number>()
  /** Roll a number in: tween the value so digits flow instead of jumping. */
  private setNum(el: HTMLElement, n: number) {
    const from = this.lastNums.get(el) ?? n
    this.lastNums.set(el, n)
    if (from === n || Math.abs(n - from) > 50) { el.textContent = n.toLocaleString('en-US'); return }
    const o = { v: from }
    gsap.to(o, { v: n, duration: .4, ease: 'power2.out', onUpdate: () => { el.textContent = Math.round(o.v).toLocaleString('en-US') } })
  }
  setBacklog(blocks: number, seconds: number) { this.unbatchedBlocks = blocks; this.unbatchedSeconds = seconds; this.updateWaiting() }
  private updateWaiting() {
    if (!this.unbatchedBlocks) { this.openBlocks.textContent = ''; return }
    const behind = this.unbatchedSeconds >= 120 ? `${Math.round(this.unbatchedSeconds / 60)} min behind head` : `${Math.round(this.unbatchedSeconds)} s behind head`
    this.openBlocks.textContent = `${this.unbatchedBlocks.toLocaleString('en-US')} waiting · ${behind}`
    this.openBlocks.className = 'lbl ' + (this.unbatchedSeconds > 900 ? 'amber' : '')
  }
  setOpen(lastBatch: Batch | undefined, _head: Head | null, now: number) {
    if (!lastBatch) return
    this.lastSeq = lastBatch.seq
    this.openSeq.textContent = `latest block · batch #${lastBatch.seq + 1} forming`
    this.openAge.textContent = `last batch #${lastBatch.seq} · ${fmtAge(now - lastBatch.l1Time)} ago`
  }

  /** A batch landed: a certificate card drops down the connector, squashes, and stamps a marker on the L1 lane. */
  onBatch(b: Batch, _now: number) {
    const cx = this.TRACK_R - 80
    const cert = h('div', { class: 'cert' + (b.daMode === 'fulldata' ? ' full' : '') }, [h('i'), `#${b.seq} · ${b.daMode === 'anytrust' ? 'AnyTrust cert' : b.daMode}${b.l2Blocks ? ` · ${b.l2Blocks.toLocaleString('en-US')} blocks` : ''}`])
    at(cert, cx, this.EY); this.root.append(cert)
    const ring = h('div', { class: 'ring' }); at(ring, cx, this.L1Y); this.root.append(ring)
    gsap.timeline({ onComplete: () => { cert.remove(); ring.remove() } })
      .fromTo(cert, { scale: .5, opacity: 0, y: 0 }, { scale: 1, opacity: 1, duration: .4, ease: 'back.out(2)' })
      .to(cert, { y: this.L1Y - this.EY, duration: 1.0, ease: 'power2.in' }, '+=.25')
      .to(cert, { scaleY: .6, scaleX: 1.25, duration: .12, ease: 'power1.out' })
      .to(cert, { scaleY: 1, scaleX: 1, opacity: 0, duration: .3, ease: 'power2.out' })
      .fromTo(ring, { scale: .2, opacity: .9 }, { scale: 3, opacity: 0, duration: .9, ease: 'power2.out' }, '-=.4')
    this.addMarker(b.seq, b.l1Block, b.l1Time, true)
    this.lastSeq = b.seq
    this.openSeq.textContent = `latest block · batch #${b.seq + 1} forming`
    this.openAge.textContent = `last batch #${b.seq} · just now`
    gsap.fromTo(this.l1Num, { scale: 1.1 }, { scale: 1, duration: .6, ease: 'back.out(2)', delay: 1.3 })
  }
  onBatchDetail(_b: Batch) {}

  l1HeadTime = 0
  /** x inside the L1 group for a parent-chain timestamp: distance from the newest HyperEVM block time, so placement follows the chain clock. */
  private xForL1Time(t: number) { const ref = this.l1HeadTime || Math.floor(Date.now() / 1000); return this.l1NowX() - Math.max(0, ref - t) * 1000 * this.L1_SPEED }
  private addMarker(seq: number, l1Block: number, l1Time: number, animate: boolean) {
    const m = h('div', { class: 'marker', html: `<div class="sq"></div>#${seq}` })
    m.dataset.seq = String(seq); m.dataset.block = String(l1Block)
    m.dataset.x = String(this.xForL1Time(l1Time))
    at(m, this.TRACK_R, this.L1Y + 16); this.markers.append(m)
    if (animate) gsap.fromTo(m, { opacity: 0, y: -16 }, { opacity: 1, y: 0, duration: .5, delay: 1.5, ease: 'back.out(2)' })
  }
  seedMarkers(batches: Batch[], _asserts: Assertion[]) {
    this.markers.innerHTML = ''
    for (const b of batches.slice(-12)) this.addMarker(b.seq, b.l1Block, b.l1Time, false)
  }
  layoutMarkers() {}
  onAssertion(a: Assertion, confirmed: boolean) {
    const t = confirmed ? a.confirmedTime! : a.createdTime!
    const m = h('div', { class: 'marker asrt' + (confirmed ? ' ok' : ''), html: `<div class="sq"></div>${confirmed ? 'claim confirmed' : 'claim posted'}` })
    m.dataset.x = String(this.xForL1Time(t))
    m.style.pointerEvents = 'auto'
    m.addEventListener('mousemove', (e) => this.showTip(e, confirmed
      ? `<b>State claim confirmed</b><br>The claim ${a.hash.slice(0, 10)}… passed its challenge window with no dispute. Withdrawals it covers can now execute.`
      : `<b>State claim posted</b><br>The sequencer told HyperEVM what Elysium's state is after a run of batches: ${a.hash.slice(0, 10)}…<br>It now waits out the challenge window before it counts.`))
    m.addEventListener('mouseleave', () => this.hideTip())
    at(m, this.TRACK_R, this.L1Y - 58); this.markers.append(m)
    gsap.fromTo(m, { opacity: 0, scale: 1.8 }, { opacity: 1, scale: 1, duration: .6, ease: 'back.out(2)' })
    this.renderAssertions()
  }
  renderAssertions() { return
    // kept for API compatibility; the Live tab no longer shows the row
  }
  private _renderAssertionsOld() {
    this.asrtRow.innerHTML = ''
    const now = Math.floor(Date.now() / 1000)
    const list = this.assertions.filter((a) => a.createdTime || a.confirmedTime).slice(-3)
    const colW = this.W / 3
    list.forEach((a, i) => {
      const created = a.createdTime ? `posted ${fmtAge(now - a.createdTime)} ago` : 'posted before lookback'
      const lag = a.confirmedTime ? (a.createdTime ? `confirmed after ${fmtAge(a.confirmedTime - a.createdTime)}` : `confirmed ${fmtAge(now - a.confirmedTime)} ago`) : 'awaiting confirmation'
      const el = at(h('div', { class: 'asrt-item' }, [
        h('div', { class: 'callout' + (a.confirmedTime ? ' filled' : '') }, a.confirmedTime ? '●' : '○'),
        h('div', {}, [h('div', { class: 'asrt-k' }, a.hash.slice(0, 10)), h('div', { class: 'asrt-v' }, created), h('div', { class: 'asrt-v ' + (a.confirmedTime ? 'ely' : 'amber') }, lag)]),
      ]), i * colW, 20)
      this.asrtRow.append(el)
    })
    gsap.fromTo(this.asrtRow.children, { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: .5, stagger: .08, ease: 'power2.out' })
  }
}
