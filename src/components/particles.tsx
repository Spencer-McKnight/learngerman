"use client";

import { useEffect, useRef, useCallback } from "react";

interface Mote {
  x: number;
  y: number;
  vy: number;
  vx: number;
  radius: number;
  opacity: number;
  maxOpacity: number;
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

function isDarkMode() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-color-scheme: dark)").matches
  );
}

function prefersReducedMotion() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

export function AmbientParticles() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (prefersReducedMotion()) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    const COUNT = 18;
    const motes: Mote[] = Array.from({ length: COUNT }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      vy: -(0.15 + Math.random() * 0.25),
      vx: (Math.random() - 0.5) * 0.12,
      radius: 1.2 + Math.random() * 1.8,
      opacity: 0,
      maxOpacity: 0.04 + Math.random() * 0.045,
    }));

    let raf = 0;
    let last = 0;
    const FPS_INTERVAL = 1000 / 15;

    const draw = (now: number) => {
      raf = requestAnimationFrame(draw);
      if (now - last < FPS_INTERVAL) return;
      last = now;

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const dark = isDarkMode();
      const rgb = dark ? "160, 180, 220" : "180, 165, 140";

      for (const m of motes) {
        m.x += m.vx;
        m.y += m.vy;
        if (m.opacity < m.maxOpacity) m.opacity += 0.002;
        if (m.y < -10) {
          m.y = canvas.height + 10;
          m.x = Math.random() * canvas.width;
          m.opacity = 0;
        }
        ctx.beginPath();
        ctx.arc(m.x, m.y, m.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${rgb}, ${m.opacity})`;
        ctx.fill();
      }
    };
    raf = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className="pointer-events-none fixed inset-0 z-0"
    />
  );
}

const SPARK_COLOURS = ["#2563eb", "#ffffff", "#0f3d7a", "#7aa5ec"];

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

    const newSparks: Spark[] = Array.from({ length: 8 }, () => ({
      x: originX,
      y: originY,
      vx: (Math.random() - 0.5) * 6,
      vy: -(2 + Math.random() * 4),
      radius: 1.5 + Math.random() * 2,
      opacity: 1,
      colour: SPARK_COLOURS[Math.floor(Math.random() * SPARK_COLOURS.length)],
    }));
    sparksRef.current = [...sparksRef.current, ...newSparks];

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

  const SparkCanvas = (
    <canvas
      ref={canvasRef}
      aria-hidden
      className="pointer-events-none fixed inset-0 z-[55]"
    />
  );

  return { fire, SparkCanvas };
}
