"use client";

import { useEffect, useRef } from "react";
import { createPulseRibbon } from "./ribbonEngine";
import styles from "./visuals.module.css";

// The ECG ribbon in the hero's own band. Without WebGL2 the hero keeps its
// copy and shows no art.
export default function PulseRibbon() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    try {
      return createPulseRibbon(canvas) ?? undefined;
    } catch {
      canvas.style.display = "none";
    }
  }, []);

  return <canvas ref={ref} className={styles.ribbon} aria-hidden="true" />;
}
