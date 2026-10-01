import * as stylex from '@stylexjs/stylex';
import { useEffect, useRef } from 'react';
import { onCelebrate, pointer } from '../lib/events';
import { GOAL_HEX } from '../lib/meta';

/*
 * Shipping something deserves a moment. A short burst of design primitives
 * (squares, circles, triangles, pen-tool anchors) from where you clicked.
 */

const styles = stylex.create({
  canvas: { position: 'fixed', inset: 0, zIndex: 90, pointerEvents: 'none', width: '100%', height: '100%' },
});

type Shape = 'square' | 'circle' | 'triangle' | 'anchor';
interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  vr: number;
  size: number;
  color: string;
  shape: Shape;
  life: number;
}

const SHAPES: Shape[] = ['square', 'circle', 'triangle', 'anchor'];

export function Confetti() {
  const ref = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    let particles: Particle[] = [];
    let raf = 0;

    const resize = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize);

    const draw = () => {
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
      particles = particles.filter((p) => p.life > 0 && p.y < window.innerHeight + 40);
      for (const p of particles) {
        p.vy += 0.32;
        p.vx *= 0.985;
        p.x += p.vx;
        p.y += p.vy;
        p.rot += p.vr;
        p.life -= 1;
        ctx.save();
        ctx.globalAlpha = Math.min(1, p.life / 30);
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 1.6;
        const s = p.size;
        if (p.shape === 'square') ctx.fillRect(-s / 2, -s / 2, s, s * 0.7);
        else if (p.shape === 'circle') {
          ctx.beginPath();
          ctx.arc(0, 0, s / 2.4, 0, Math.PI * 2);
          ctx.fill();
        } else if (p.shape === 'triangle') {
          ctx.beginPath();
          ctx.moveTo(0, -s / 2);
          ctx.lineTo(s / 2, s / 2);
          ctx.lineTo(-s / 2, s / 2);
          ctx.closePath();
          ctx.fill();
        } else {
          // Pen-tool anchor: a square point with two bezier handles.
          ctx.beginPath();
          ctx.moveTo(-s, 0);
          ctx.lineTo(s, 0);
          ctx.stroke();
          ctx.fillRect(-s / 4, -s / 4, s / 2, s / 2);
          ctx.beginPath();
          ctx.arc(-s, 0, 1.6, 0, Math.PI * 2);
          ctx.arc(s, 0, 1.6, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }
      if (particles.length) raf = requestAnimationFrame(draw);
      else ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
    };

    const off = onCelebrate((d) => {
      if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
      const x = d.x ?? (pointer.x || window.innerWidth / 2);
      const y = d.y ?? (pointer.y || window.innerHeight / 2);
      const palette = d.colors?.length ? d.colors : Object.values(GOAL_HEX);
      for (let i = 0; i < 70; i++) {
        const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.1;
        const speed = 5 + Math.random() * 8;
        particles.push({
          x,
          y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          rot: Math.random() * Math.PI,
          vr: (Math.random() - 0.5) * 0.3,
          size: 6 + Math.random() * 6,
          color: palette[i % palette.length],
          shape: SHAPES[i % SHAPES.length],
          life: 70 + Math.random() * 40,
        });
      }
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(draw);
    });

    return () => {
      off();
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return <canvas ref={ref} aria-hidden="true" {...stylex.props(styles.canvas)} />;
}
