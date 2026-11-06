"use client";

import { useCallback, useEffect, useRef } from "react";

/**
 * "Regnitz" — the ambient layer behind the home surfaces. The floating
 * motes were kitsch against a signage identity, so this is two soft
 * accent-tinted washes drifting very slowly (28 s cycle) on the porcelain
 * ground, like light on the river. Pure CSS: no canvas, no rAF, no
 * repaint cost; `prefers-reduced-motion` freezes it via the global rule.
 * The export name is kept so `HomeClient` needs no change.
 */
export function AmbientParticles() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      <div
        className="animate-regnitz absolute -left-1/4 -top-1/4 size-[70vmax] rounded-pill opacity-70 blur-3xl"
        style={{
          background: "radial-gradient(closest-side, var(--accent-soft), transparent 70%)",
        }}
      />
      <div
        className="animate-regnitz absolute -bottom-1/3 -right-1/4 size-[60vmax] rounded-pill opacity-60 blur-3xl"
        style={{
          background: "radial-gradient(closest-side, var(--surface-sunken), transparent 70%)",
          animationDelay: "-14s",
          animationDirection: "reverse",
        }}
      />
    </div>
  );
}

interface Spark {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  opacity: number;
  colour: string;
}

function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function sparkPalette(): string[] {
  const style = getComputedStyle(document.documentElement);
  const read = (name: string, fallback: string) => style.getPropertyValue(name).trim() || fallback;
  return [read("--accent", "#154889"), read("--accent-hover", "#1d5fd6"), read("--success", "#1f7a33")];
}

/**
 * A small spark burst at a point (a correct answer). Signage colours
 * only — accent and success; the yellow stays reserved. Returns `fire`
 * and the canvas to render once per screen.
 */
export function useSparkle() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sparksRef = useRef<Spark[]>([]);
  const rafRef = useRef(0);

  useEffect(() => {
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  const fire = useCallback((originX: number, originY: number) => {
    if (prefersReducedMotion()) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const palette = sparkPalette();
    const fresh: Spark[] = Array.from({ length: 8 }, () => ({
      x: originX,
      y: originY,
      vx: (Math.random() - 0.5) * 6,
      vy: -(2 + Math.random() * 4),
      radius: 1.5 + Math.random() * 2,
      opacity: 1,
      colour: palette[Math.floor(Math.random() * palette.length)],
    }));
    sparksRef.current = [...sparksRef.current, ...fresh];

    cancelAnimationFrame(rafRef.current);
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const alive: Spark[] = [];
      for (const s of sparksRef.current) {
        s.vy += 0.15;
        s.x += s.vx;
        s.y += s.vy;
        s.opacity -= 0.035;
        if (s.opacity <= 0) continue;
        alive.push(s);
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.radius, 0, Math.PI * 2);
        ctx.globalAlpha = s.opacity;
        ctx.fillStyle = s.colour;
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      sparksRef.current = alive;
      if (alive.length > 0) rafRef.current = requestAnimationFrame(draw);
      else ctx.clearRect(0, 0, canvas.width, canvas.height);
    };
    rafRef.current = requestAnimationFrame(draw);
  }, []);

  const SparkCanvas = <canvas ref={canvasRef} aria-hidden className="pointer-events-none fixed inset-0 z-55" />;

  return { fire, SparkCanvas };
}
