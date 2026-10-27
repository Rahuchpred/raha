// Next.js mount. The SVG is a string built at render time (server component
// friendly); motion attaches on the client. Copy iso.js and iso-motion.js
// next to this file.
'use client'

import { useEffect, useMemo, useRef } from 'react'
import { render } from './iso.js'
import { liftStack, pointerWave } from './iso-motion.js'

type Motion =
  | { kind: 'lift'; step: number; max?: number }
  | { kind: 'wave'; rest: number[]; make: (i: number, h: number) => unknown }

export function IsoFigure({ scene, motion, title, className }: {
  scene: { objects: unknown[]; [k: string]: unknown }
  motion?: Motion
  title?: string
  className?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  // A fixed uid keeps server and client markup identical.
  const svg = useMemo(() => render({ ...scene, title, uid: 'iso-' + (title ?? 'fig').replace(/\W+/g, '-') } as never), [scene, title])

  useEffect(() => {
    const el = ref.current?.querySelector('svg')
    if (!el || !motion) return
    if (motion.kind === 'lift') return liftStack(el, { step: motion.step, max: motion.max })
    return pointerWave(el, { rest: motion.rest, make: motion.make as never })
  }, [motion])

  return <div ref={ref} className={className} dangerouslySetInnerHTML={{ __html: svg }} />
}
