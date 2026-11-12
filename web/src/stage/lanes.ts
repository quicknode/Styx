import gsap from 'gsap'
import { at, h, layer, s, txt, prepDraw, G } from '../dom'
import type { Assertion, Batch, Head } from '../api'
import { fmtAge } from '../api'

/**
 * Two lanes: Elysium (100 ms blocks) above HyperEVM (1 s blocks), joined by a
 * connector where batch certificates drop. Everything inside is driven by live
 * events; ambient motion comes from the blocks themselves.
 */
export class Lanes {
  root: HTMLElement
  svg: SVGSVGElement
  elyLane: HTMLElement; l1Lane: HTMLElement
  elyNum: HTMLElement; l1Num: HTMLElement
  bracket: SVGPathElement; bracketLbl: SVGTextElement
  openSeq: HTMLElement; openBlocks: HTMLElement; openAge: HTMLElement
  markers: HTMLElement
  asrtRow: HTMLElement
  lastBatch?: Batch
  lastSeq = 0
  openStartBlock = 0
  headNum = 0
  l1Head = 0
  blocksSinceBatch = 0
  // geometry
  EY = 88; L1Y = 300; TRACK_L = G.x(1) + 24; TRACK_R = G.x(1) + G.w(12) - 360
  constructor(stage: HTMLElement) {
    this.root = h('div', { style: 'position:absolute;inset:0' })
    stage.append(this.root)
    this.svg = layer(); this.root.append(this.svg)

    // Elysium lane panel
    const elyPanel = at(h('div', { class: 'panel tint ely' }, [h('span', { class: 'panel-title ely' }, 'Elysium · L2 blocks · 100 ms')]), G.x(1), 24, G.w(12), 128)
    this.root.append(elyPanel)
    this.elyLane = at(h('div', { class: 'lane' }, [h('div', { class: 'track' })]), this.TRACK_L, this.EY - 30, this.TRACK_R - this.TRACK_L, 60)
    this.root.append(this.elyLane)
    this.elyNum = at(h('div', { class: 'num ely', html: '—' }), this.TRACK_R + 36, this.EY - 44)
    this.root.append(this.elyNum)
    this.openSeq = at(h('div', { class: 'lbl ely' }, 'latest block · batch — forming'), this.TRACK_R + 36, this.EY + 2)
    this.openBlocks = at(h('div', { class: 'lbl' }, ''), this.TRACK_R + 36, this.EY + 22)
    this.root.append(this.openSeq, this.openBlocks)

    // HyperEVM lane panel
    const l1Panel = at(h('div', { class: 'panel tint hl' }, [h('span', { class: 'panel-title hl' }, 'HyperEVM · settlement · 1 s blocks')]), G.x(1), 232, G.w(12), 140)
    this.root.append(l1Panel)
    this.l1Lane = at(h('div', { class: 'lane' }, [h('div', { class: 'track' })]), this.TRACK_L, this.L1Y - 30, this.TRACK_R - this.TRACK_L, 60)
    this.root.append(this.l1Lane)
    this.l1Num = at(h('div', { class: 'num hl', html: '—' }), this.TRACK_R + 36, this.L1Y - 34)
    this.root.append(this.l1Num)
    this.openAge = at(h('div', { class: 'lbl hl' }, ''), this.TRACK_R + 36, this.L1Y + 12)
    this.root.append(this.openAge)
    this.markers = at(h('div', { style: 'position:absolute;inset:0;pointer-events:none' }), 0, 0)
    this.root.append(this.markers)

    this.bracket = s('path', { class: 'ln ely', d: '' }); this.bracketLbl = txt(0, 0, '')

    // connector label
    const conn = s('path', { class: 'hair2 dash', d: `M ${this.TRACK_R - 60} ${this.EY + 22} V ${this.L1Y - 22}` })
    this.svg.append(conn)
    this.svg.append(txt(this.TRACK_R - 48, (this.EY + this.L1Y) / 2 + 4, 'certificate → calldata', ''))

    // assertion row under the HyperEVM lane
    this.asrtRow = at(h('div', { style: 'position:absolute' }), G.x(1), 392, G.w(12), 80)
    this.root.append(this.asrtRow)
    const rowRule = s('path', { class: 'hair', d: `M ${G.x(1)} 404 H ${G.x(1) + G.w(12)}` }); this.svg.append(rowRule)
    this.svg.append(txt(G.x(1), 396, 'Assertions on HyperEVM · ○ created  ● confirmed', ''))

    // draw-on
    for (const p of [conn, rowRule]) { const len = prepDraw(p as SVGGeometryElement); gsap.to(p, { strokeDashoffset: 0, duration: 1.2, ease: 'power2.out', delay: .4 }) }
    gsap.from([elyPanel, l1Panel], { opacity: 0, y: 12, duration: .9, stagger: .15, ease: 'power3.out' })
  }

  /** Called on every Elysium head: spawn a block at the right edge and slide the lane. */
  onHead(hd: Head) {
    this.headNum = hd.number
    this.elyNum.innerHTML = hd.number.toLocaleString('en-US')
    if (this.openStartBlock) this.blocksSinceBatch = hd.number - this.openStartBlock
    const b = h('div', { class: 'tick' })
    const laneW = this.TRACK_R - this.TRACK_L
    b.style.left = laneW + 'px'
    this.elyLane.append(b)
    gsap.fromTo(b, { scaleY: 2.2, opacity: 0 }, { scaleY: 1, opacity: 1, duration: .3, ease: 'power2.out' })
    gsap.to(b, { left: 0, duration: 18, ease: 'none', onComplete: () => b.remove() })
    gsap.to(b, { opacity: .35, duration: 6, delay: 6, ease: 'none' })
    this.updateBlocksWaiting()
  }
  onL1Head(n: number) {
    this.l1Head = n
    this.l1Num.innerHTML = n.toLocaleString('en-US')
    const b = h('div', { class: 'blk hl' })
    const laneW = this.TRACK_R - this.TRACK_L
    b.style.left = laneW + 'px'
    this.l1Lane.append(b)
    gsap.to(b, { left: 0, duration: 120, ease: 'none', onComplete: () => b.remove() })
    gsap.fromTo(b, { scale: 1.5, opacity: 0 }, { scale: 1, opacity: 1, duration: .4, ease: 'back.out(2)' })
    // slide batch markers with the lane
    for (const m of Array.from(this.markers.children) as HTMLElement[]) {
      const t0 = Number(m.dataset.t0 || 0); if (!t0) continue
    }
    this.layoutMarkers()
  }
  unbatchedBlocks = 0; unbatchedSeconds = 0
  setBacklog(blocks: number, seconds: number) { this.unbatchedBlocks = blocks; this.unbatchedSeconds = seconds; this.updateBlocksWaiting() }
  private updateBlocksWaiting() {
    if (!this.unbatchedBlocks) { this.openBlocks.textContent = ''; return }
    const behind = this.unbatchedSeconds >= 120 ? `${Math.round(this.unbatchedSeconds / 60)} min behind head` : `${Math.round(this.unbatchedSeconds)} s behind head`
    this.openBlocks.innerHTML = `${this.unbatchedBlocks.toLocaleString('en-US')} blocks waiting<br>${behind}`
    this.openBlocks.style.lineHeight = '20px'
    this.openBlocks.className = 'lbl ' + (this.unbatchedSeconds > 900 ? 'amber' : '')
  }
  setOpen(lastBatch: Batch | undefined, head: Head | null, now: number) {
    if (lastBatch) {
      this.lastBatch = lastBatch; this.lastSeq = lastBatch.seq
      if (lastBatch.l2LastBlock) this.openStartBlock = lastBatch.l2LastBlock
      this.openSeq.textContent = `latest block · batch #${lastBatch.seq + 1} forming`
      this.openAge.textContent = `last batch #${lastBatch.seq} · ${fmtAge(now - lastBatch.l1Time)} ago`
    }
  }

  /** A batch landed on HyperEVM: close the bracket, drop a certificate, stamp a marker on the L1 lane. */
  onBatch(b: Batch, now: number) {
    const cert = h('div', { class: 'cert' + (b.daMode === 'fulldata' ? ' full' : '') }, [h('i'), `#${b.seq} · ${b.daMode === 'anytrust' ? 'AnyTrust cert' : b.daMode === 'fulldata' ? 'full data' : b.daMode}${b.l2Blocks ? ` · ${b.l2Blocks.toLocaleString('en-US')} blocks` : ''}`])
    at(cert, this.TRACK_R - 60, this.EY)
    this.root.append(cert)
    const tl = gsap.timeline({ onComplete: () => cert.remove() })
    tl.fromTo(cert, { scale: .6, opacity: 0 }, { scale: 1, opacity: 1, duration: .35, ease: 'back.out(2)' })
      .to(this.bracket, { opacity: .2, duration: .2 }, 0)
      .to(cert, { top: this.L1Y, duration: 1.1, ease: 'power2.in' }, '+=.2')
      .to(cert, { scale: .3, opacity: 0, duration: .25 })
      .to(this.bracket, { opacity: 1, duration: .3 })
    // marker on the HyperEVM lane at the right edge
    const m = h('div', { class: 'marker', html: `<div class="sq"></div>#${b.seq}` })
    m.dataset.block = String(b.l1Block)
    at(m, this.TRACK_R, this.L1Y + 12)
    this.markers.append(m)
    gsap.fromTo(m, { opacity: 0, y: -10 }, { opacity: 1, y: 0, duration: .5, delay: 1.5, ease: 'back.out(2)' })
    gsap.fromTo(this.l1Lane, { x: 0 }, { x: 0, duration: .01 })
    this.lastBatch = b; this.lastSeq = b.seq; this.blocksSinceBatch = 0
    this.openSeq.textContent = `latest block · batch #${b.seq + 1} forming`
    this.openAge.textContent = `last batch #${b.seq} · just now`
    // pulse the whole L1 panel
    gsap.fromTo(this.l1Num, { scale: 1.08 }, { scale: 1, duration: .6, ease: 'back.out(2)', delay: 1.4 })
  }
  onBatchDetail(b: Batch) {
    if (b.seq === this.lastSeq && b.l2LastBlock) { this.openStartBlock = b.l2LastBlock }
  }
  /** Place batch and assertion markers by HyperEVM block relative to the head (1 block = lane speed). */
  layoutMarkers() {
    const laneW = this.TRACK_R - this.TRACK_L
    const pxPerBlock = laneW / 120
    for (const m of Array.from(this.markers.children) as HTMLElement[]) {
      const blk = Number(m.dataset.block); if (!blk || !this.l1Head) continue
      const x = this.TRACK_R - (this.l1Head - blk) * pxPerBlock
      if (x < this.TRACK_L - 20) { m.remove(); continue }
      m.style.left = x + 'px'
    }
  }
  seedMarkers(batches: Batch[], asserts: Assertion[]) {
    this.markers.innerHTML = ''
    for (const b of batches.slice(-8)) {
      const m = h('div', { class: 'marker', html: `<div class="sq"></div>#${b.seq}` }); m.dataset.block = String(b.l1Block); at(m, this.TRACK_R, this.L1Y + 12); this.markers.append(m)
    }
    for (const a of asserts.slice(-6)) {
      const blk = a.confirmedBlock ?? a.createdBlock; if (!blk) continue
      const m = h('div', { class: 'marker asrt' + (a.confirmedBlock ? ' ok' : ''), html: `<div class="sq"></div>${a.confirmedBlock ? 'confirmed' : 'created'}` }); m.dataset.block = String(blk); at(m, this.TRACK_R, this.L1Y - 50); this.markers.append(m)
    }
    this.layoutMarkers()
  }
  onAssertion(a: Assertion, confirmed: boolean) {
    const blk = confirmed ? a.confirmedBlock! : a.createdBlock!
    const m = h('div', { class: 'marker asrt' + (confirmed ? ' ok' : ''), html: `<div class="sq"></div>${confirmed ? 'confirmed' : 'created'}` })
    m.dataset.block = String(blk); at(m, this.TRACK_R, this.L1Y - 50); this.markers.append(m)
    gsap.fromTo(m, { opacity: 0, scale: 1.6 }, { opacity: 1, scale: 1, duration: .6, ease: 'back.out(2)' })
    this.renderAssertions()
  }
  assertions: Assertion[] = []
  renderAssertions() {
    this.asrtRow.innerHTML = ''
    const now = Math.floor(Date.now() / 1000)
    const list = this.assertions.filter((a) => a.createdTime || a.confirmedTime).slice(-4)
    const colW = G.w(12) / 4
    list.forEach((a, i) => {
      const x = i * colW
      const created = a.createdTime ? `created ${fmtAge(now - a.createdTime)} ago` : 'created earlier'
      const lag = a.createdTime && a.confirmedTime ? `confirmed after ${fmtAge(a.confirmedTime - a.createdTime)}` : a.confirmedTime ? `confirmed ${fmtAge(now - a.confirmedTime)} ago` : 'awaiting confirmation'
      const el = at(h('div', { style: 'position:absolute;top:0;display:flex;align-items:center;gap:12px' }, [
        h('div', { class: 'callout' + (a.confirmedTime ? ' filled' : ''), style: 'position:relative;transform:none;left:0;top:0' }, a.confirmedTime ? '●' : '○'),
        h('div', {}, [
          h('div', { class: 'lbl', style: 'position:relative;color:var(--ink)' }, `${a.hash.slice(0, 10)} · ${created}`),
          h('div', { class: 'lbl ' + (a.confirmedTime ? 'ely' : 'amber'), style: 'position:relative;margin-top:4px' }, lag),
        ]),
      ]), x, 22)
      this.asrtRow.append(el)
    })
    gsap.from(this.asrtRow.children, { opacity: 0, y: 6, duration: .5, stagger: .06, ease: 'power2.out' })
  }
}
