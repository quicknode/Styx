import gsap from 'gsap'

/**
 * The Styx river line. Instead of looping keyframes, the curve is regenerated every frame
 * from a sum of slow sines with unrelated frequencies, so it drifts like water and never
 * repeats, and every change of direction is continuous.
 */
export function startWave(path: SVGPathElement, width = 96, mid = 6) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return
  const N = 32
  const xs = Array.from({ length: N + 1 }, (_, i) => (i / N) * width)
  const t0 = performance.now()
  let shift = 0
  // one fixed, irregular profile that slides sideways under the wordmark: the shape travels, it does not morph
  const profile = (u: number) => 0.52 * Math.sin(u * 0.19) + 0.31 * Math.sin(u * 0.047 + 1.7) + 0.17 * Math.sin(u * 0.31 + 0.6)
  const tick = () => {
    const t = (performance.now() - t0) / 1000
    shift += (0.9 + 0.35 * Math.sin(t * 0.41)) * 0.03 * (gsap.ticker.deltaRatio() || 1)   // sideways speed wanders slowly, never stops or reverses
    const amp = 2.4 + 0.4 * Math.sin(t * 0.23)
    const ys = xs.map((x) => mid + amp * profile(x + shift))
    let d = `M ${xs[0].toFixed(2)} ${ys[0].toFixed(2)}`
    for (let i = 0; i < N; i++) {
      const p0 = i ? [xs[i - 1], ys[i - 1]] : [xs[0], ys[0]]
      const p1 = [xs[i], ys[i]], p2 = [xs[i + 1], ys[i + 1]]
      const p3 = i + 2 <= N ? [xs[i + 2], ys[i + 2]] : p2
      const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6]
      const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6]
      d += ` C ${c1[0].toFixed(2)} ${c1[1].toFixed(2)} ${c2[0].toFixed(2)} ${c2[1].toFixed(2)} ${p2[0].toFixed(2)} ${p2[1].toFixed(2)}`
    }
    path.setAttribute('d', d)
  }
  gsap.ticker.add(tick)
  return () => gsap.ticker.remove(tick)
}
