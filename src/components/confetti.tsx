"use client";

import { useEffect, useRef } from "react";

/**
 * Signage confetti: Ortsschild yellow carries the burst, the sign's ink
 * and the one accent give it depth. No rainbow — the palette is the
 * identity. Fires once per `burst` change; silent under reduced motion.
 */
interface Piece {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rotation: number;
  spin: number;
  width: number;
  height: number;
  colour: string;
  flutter: number;
}

function paletteFromTokens(): string[] {
  const style = getComputedStyle(document.documentElement);
  const read = (name: string, fallback: string) => style.getPropertyValue(name).trim() || fallback;
  const yellow = read("--milestone", "#f7c600");
  const ink = read("--milestone-ink", "#1b1f24");
  const accent = read("--accent-hover", "#1d5fd6");
  return [yellow, yellow, yellow, yellow, accent, accent, ink];
}

export function Confetti({ burst }: { burst: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (burst === 0) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = window.innerWidth * dpr;
    canvas.height = window.innerHeight * dpr;
    context.scale(dpr, dpr);
    const width = window.innerWidth;
    const height = window.innerHeight;

    const palette = paletteFromTokens();
    const pieces: Piece[] = Array.from({ length: 100 }, () => ({
      x: width / 2 + (Math.random() - 0.5) * 120,
      y: height * 0.38,
      vx: (Math.random() - 0.5) * 11,
      vy: -7 - Math.random() * 8,
      rotation: Math.random() * Math.PI,
      spin: (Math.random() - 0.5) * 0.3,
      width: 5 + Math.random() * 6,
      height: 8 + Math.random() * 8,
      colour: palette[Math.floor(Math.random() * palette.length)],
      flutter: Math.random() * Math.PI * 2,
    }));

    const TOTAL = 150;
    let frame = 0;
    let raf = 0;
    const draw = () => {
      frame++;
      context.clearRect(0, 0, width, height);
      const fade = Math.max(0, 1 - Math.max(0, frame - TOTAL * 0.6) / (TOTAL * 0.4));
      for (const piece of pieces) {
        piece.vy += 0.18;
        piece.vx *= 0.993;
        piece.flutter += 0.12;
        piece.x += piece.vx + Math.sin(piece.flutter) * 0.6;
        piece.y += piece.vy;
        piece.rotation += piece.spin;
        context.save();
        context.translate(piece.x, piece.y);
        context.rotate(piece.rotation);
        context.globalAlpha = fade;
        context.fillStyle = piece.colour;
        // A flutter in width reads as a card tumbling.
        const w = piece.width * (0.4 + 0.6 * Math.abs(Math.cos(piece.flutter)));
        context.fillRect(-w / 2, -piece.height / 2, w, piece.height);
        context.restore();
      }
      if (frame < TOTAL) raf = requestAnimationFrame(draw);
      else context.clearRect(0, 0, width, height);
    };
    raf = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(raf);
      context.clearRect(0, 0, width, height);
    };
  }, [burst]);

  return <canvas ref={canvasRef} aria-hidden className="pointer-events-none fixed inset-0 z-60 h-full w-full" />;
}
