"use client";

/**
 * A small dependency-free confetti burst in the signage palette.
 * Fires once per `burst` increment; respects prefers-reduced-motion.
 */

import { useEffect, useRef } from "react";

const COLOURS = ["#f7c600", "#154889", "#ffffff", "#1d5fd6", "#f7c600"];

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
}

export function Confetti({ burst }: { burst: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (burst === 0) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    const pieces: Piece[] = Array.from({ length: 110 }, () => ({
      x: canvas.width / 2 + (Math.random() - 0.5) * 120,
      y: canvas.height * 0.35,
      vx: (Math.random() - 0.5) * 11,
      vy: -6 - Math.random() * 7,
      rotation: Math.random() * Math.PI,
      spin: (Math.random() - 0.5) * 0.3,
      width: 6 + Math.random() * 6,
      height: 8 + Math.random() * 8,
      colour: COLOURS[Math.floor(Math.random() * COLOURS.length)],
    }));

    let frame = 0;
    let raf = 0;
    const draw = () => {
      frame++;
      context.clearRect(0, 0, canvas.width, canvas.height);
      for (const piece of pieces) {
        piece.vy += 0.22;
        piece.x += piece.vx;
        piece.y += piece.vy;
        piece.rotation += piece.spin;
        context.save();
        context.translate(piece.x, piece.y);
        context.rotate(piece.rotation);
        context.globalAlpha = Math.max(0, 1 - frame / 150);
        context.fillStyle = piece.colour;
        context.fillRect(-piece.width / 2, -piece.height / 2, piece.width, piece.height);
        context.restore();
      }
      if (frame < 150) raf = requestAnimationFrame(draw);
      else context.clearRect(0, 0, canvas.width, canvas.height);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [burst]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className="pointer-events-none fixed inset-0 z-[60]"
    />
  );
}
