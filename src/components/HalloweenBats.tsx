import React, { useEffect, useRef } from 'react';

export interface HalloweenBatsProps {
  className?: string;
}

export const HalloweenBats: React.FC<HalloweenBatsProps> = ({ className = '' }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let isMounted = true;
    let animId = 0;

    const COLOR = '#060309';
    const EYE = '#ff1a12';
    const FANGS = '#f2efe6';

    const SHOULDER = [0.05, 0.0];
    const ELBOW = [0.32, -0.34];
    const WRIST = [0.56, -0.42];
    const TIP1 = [1.24, -0.22];
    const SEG = [
      [[0.96, 0.02], [1.12, 0.36]],
      [[0.84, 0.18], [0.88, 0.60]],
      [[0.62, 0.30], [0.50, 0.68]],
      [[0.36, 0.28], [0.10, 0.26]],
    ];
    const CLAW = [[0.50, -0.40], [0.60, -0.68], [0.64, -0.40]];

    function drawBat(cx: number, cy: number, S: number, theta: number, flapSquash: number) {
      if (!ctx) return;
      const c = Math.cos(theta);
      const s = Math.sin(theta);

      function tr(p: number[], side: number): [number, number] {
        const xr = p[0] * c + p[1] * s;
        const yr = (-p[0] * s + p[1] * c) * flapSquash;
        return [cx + side * xr * S, cy + yr * S];
      }

      ctx.fillStyle = COLOR;

      // Alas con membrana gótica y garras
      [1, -1].forEach((side) => {
        let p: [number, number];
        ctx.beginPath();
        p = tr(SHOULDER, side);
        ctx.moveTo(p[0], p[1]);
        p = tr(ELBOW, side);
        ctx.lineTo(p[0], p[1]);
        p = tr(WRIST, side);
        ctx.lineTo(p[0], p[1]);
        p = tr(TIP1, side);
        ctx.lineTo(p[0], p[1]);
        for (let i = 0; i < SEG.length; i++) {
          const q = tr(SEG[i][0], side);
          const t = tr(SEG[i][1], side);
          ctx.quadraticCurveTo(q[0], q[1], t[0], t[1]);
        }
        ctx.closePath();
        ctx.fill();

        // Garra del pulgar
        ctx.beginPath();
        for (let k = 0; k < CLAW.length; k++) {
          p = tr(CLAW[k], side);
          if (k === 0) ctx.moveTo(p[0], p[1]);
          else ctx.lineTo(p[0], p[1]);
        }
        ctx.closePath();
        ctx.fill();
      });

      // Cuerpo
      ctx.beginPath();
      ctx.ellipse(cx, cy + 0.17 * S, 0.13 * S, 0.24 * S, 0, 0, Math.PI * 2);
      ctx.fill();

      // Cabeza
      ctx.beginPath();
      ctx.ellipse(cx, cy - 0.10 * S, 0.12 * S, 0.12 * S, 0, 0, Math.PI * 2);
      ctx.fill();

      // Hocico
      ctx.beginPath();
      ctx.moveTo(cx - 0.07 * S, cy - 0.06 * S);
      ctx.lineTo(cx + 0.07 * S, cy - 0.06 * S);
      ctx.lineTo(cx, cy + 0.07 * S);
      ctx.closePath();
      ctx.fill();

      // Orejas puntiagudas
      [1, -1].forEach((side) => {
        ctx.beginPath();
        ctx.moveTo(cx + side * 0.12 * S, cy - 0.14 * S);
        ctx.lineTo(cx + side * 0.15 * S, cy - 0.54 * S);
        ctx.lineTo(cx + side * 0.01 * S, cy - 0.20 * S);
        ctx.closePath();
        ctx.fill();
      });

      // Colmillos
      ctx.fillStyle = FANGS;
      [1, -1].forEach((side) => {
        ctx.beginPath();
        ctx.moveTo(cx + side * 0.035 * S, cy - 0.01 * S);
        ctx.lineTo(cx + side * 0.07 * S, cy - 0.01 * S);
        ctx.lineTo(cx + side * 0.05 * S, cy + 0.075 * S);
        ctx.closePath();
        ctx.fill();
      });

      // Ojos rojos brillantes
      ctx.save();
      ctx.fillStyle = EYE;
      ctx.shadowColor = EYE;
      ctx.shadowBlur = Math.max(4, 0.25 * S);
      [1, -1].forEach((side) => {
        ctx.beginPath();
        ctx.ellipse(cx + side * 0.055 * S, cy - 0.115 * S, 0.034 * S, 0.026 * S, side * -0.45, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.restore();
    }

    // Configuración de los 3 murciélagos en el espacio del canvas
    // [centroX, centroY, ampX, ampY, vueltasX, vueltasY, faseX, faseY, tamaño, aleteos, faseAleteo]
    const BATS = [
      [135, 62, 38, 18, 1, 2, 0.00, 0.25, 26, 5, 0.0],
      [78, 38, 22, 14, 2, 3, 0.30, 0.10, 20, 7, 0.4],
      [190, 80, 24, 15, 1, 2, 0.55, 0.00, 16, 8, 0.7],
    ];

    const PERIOD = 4800;
    const TAU = Math.PI * 2;

    function resize() {
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      const w = rect.width || 170;
      const h = rect.height || 85;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      if (ctx) {
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      }
    }

    resize();

    let resizeObserver: ResizeObserver | null = null;
    if (typeof window !== 'undefined' && 'ResizeObserver' in window) {
      resizeObserver = new ResizeObserver(resize);
      resizeObserver.observe(canvas);
    }
    window.addEventListener('resize', resize);

    function frame(now: number) {
      if (!isMounted || !ctx || !canvas) return;
      const rect = canvas.getBoundingClientRect();
      const W = rect.width || 170;
      const H = rect.height || 85;

      ctx.clearRect(0, 0, W, H);
      const t = (now % PERIOD) / PERIOD;
      const sx = W / 240;
      const sy = H / 120;
      const su = Math.min(sx, sy);

      for (let i = 0; i < BATS.length; i++) {
        const b = BATS[i];
        const flap = Math.sin(TAU * (b[9] * t + b[10]));
        const x = b[0] + b[2] * Math.sin(TAU * (b[4] * t + b[6]));
        const y = b[1] + b[3] * Math.sin(TAU * (b[5] * t + b[7])) + 2.5 * flap;
        const theta = ((6 + 42 * flap) * Math.PI) / 180;
        const squash = 1 - 0.12 * flap;
        drawBat(x * sx, y * sy, b[8] * su, theta, squash);
      }

      animId = requestAnimationFrame(frame);
    }

    animId = requestAnimationFrame(frame);

    return () => {
      isMounted = false;
      cancelAnimationFrame(animId);
      if (resizeObserver) resizeObserver.disconnect();
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <div
      className={`atlas-header-bats-stamp ${className}`.trim()}
      title="¡Murciélagos de terror! 🦇🎃"
      aria-label="Decoración de Halloween: Siluetas de murciélagos animados"
      role="img"
    >
      <canvas ref={canvasRef} className="atlas-bats-canvas" />
    </div>
  );
};

export default HalloweenBats;
