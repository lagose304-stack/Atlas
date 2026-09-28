import React, { useEffect, useRef } from 'react';

export const HalloweenPumpkin: React.FC<{ className?: string }> = ({ className = '' }) => {
  const svgRef = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;

    const f = svg.querySelector('#face') as SVGGElement | null;
    const glow = svg.querySelector('#glow') as SVGGElement | null;
    const pl = svg.querySelector('#pl') as SVGEllipseElement | null;
    const pr = svg.querySelector('#pr') as SVGEllipseElement | null;

    if (!f || !glow || !pl || !pr) return;

    let isMounted = true;
    const timeouts: ReturnType<typeof setTimeout>[] = [];

    const wait = (ms: number) =>
      new Promise<void>((resolve) => {
        const id = setTimeout(resolve, ms);
        timeouts.push(id);
      });

    const rnd = (a: number, b: number) => a + Math.random() * (b - a);
    const busy = () => ['snarl', 'stare', 'grin'].some((c) => f.classList.contains(c));

    const flash = async (c: string, ms: number) => {
      if (!isMounted) return;
      f.classList.add(c);
      await wait(ms);
      if (isMounted) f.classList.remove(c);
    };

    const look = (x: number, y: number) => {
      if (!isMounted) return;
      const t = `translate(${x}px,${y}px)`;
      pl.style.transform = t;
      pr.style.transform = t;
    };

    const expr = async () => {
      if (!isMounted) return;
      const r = Math.random();
      if (r < 0.28) {
        look(0, 2);
        await flash('snarl', rnd(1300, 2000));
      } else if (r < 0.55) {
        look(0, 2);
        await flash('stare', rnd(2200, 3500));
      } else if (r < 0.75) {
        await flash('grin', rnd(1800, 2800));
      } else if (r < 0.88) {
        await flash('twitch', 380);
      } else {
        glow.classList.add('out');
        await wait(rnd(120, 260));
        if (isMounted) glow.classList.remove('out');
      }
      if (isMounted) {
        const id = setTimeout(expr, rnd(1800, 4000));
        timeouts.push(id);
      }
    };

    const blinker = async () => {
      if (!isMounted) return;
      if (!f.classList.contains('stare')) {
        await flash('blink', 180);
      }
      if (isMounted) {
        const id = setTimeout(blinker, rnd(2500, 6000));
        timeouts.push(id);
      }
    };

    const roam = () => {
      if (!isMounted) return;
      if (!busy()) {
        const p = [
          [-16, 5],
          [16, 5],
          [0, -5],
          [-10, 10],
          [12, -3],
        ][Math.floor(Math.random() * 5)];
        look(p[0], p[1]);
      }
      if (isMounted) {
        const id = setTimeout(roam, rnd(1400, 3000));
        timeouts.push(id);
      }
    };

    const handleClick = () => {
      if (!busy()) {
        flash('snarl', 1600);
      }
    };

    svg.addEventListener('click', handleClick);

    const t1 = setTimeout(blinker, 1500);
    const t2 = setTimeout(roam, 800);
    const t3 = setTimeout(expr, 2000);
    timeouts.push(t1, t2, t3);

    return () => {
      isMounted = false;
      svg.removeEventListener('click', handleClick);
      timeouts.forEach((id) => clearTimeout(id));
    };
  }, []);

  return (
    <svg
      ref={svgRef}
      id="p"
      viewBox="0 0 400 390"
      role="img"
      aria-label="Calabaza de Halloween tenebrosa con cara animada"
      className={`atlas-jack-svg ${className}`.trim()}
    >
      <defs>
        <radialGradient id="sh" cx="50%" cy="45%" r="60%">
          <stop offset="0%" stopColor="#d4570f" />
          <stop offset="60%" stopColor="#a83e08" />
          <stop offset="100%" stopColor="#3a1402" />
        </radialGradient>
        <clipPath id="cl">
          <path d="M86 138 L170 184 L98 200 Z" />
        </clipPath>
        <clipPath id="cr">
          <path d="M314 138 L230 184 L302 200 Z" />
        </clipPath>
      </defs>
      <g className="body tb">
        <path
          d="M200 72 C190 44 208 26 236 20"
          fill="none"
          stroke="var(--stem)"
          strokeWidth="18"
          strokeLinecap="round"
        />
        <ellipse cx="200" cy="218" rx="188" ry="152" fill="url(#sh)" />
        <path
          d="M200 66 v304 M135 76 C88 150 88 285 135 362 M265 76 C312 150 312 285 265 362"
          stroke="#3a1402"
          strokeWidth="4"
          fill="none"
          opacity="0.6"
        />
        <path
          d="M40 200 l14 10 l-6 14 M352 250 l-16 8 l4 16"
          stroke="#2a0d00"
          strokeWidth="2.5"
          fill="none"
          opacity="0.6"
        />

        <g id="face" className="face">
          <g className="body-shake tb">
            <path
              className="brow brow-l tb"
              d="M74 116 L176 168"
              stroke="var(--dark)"
              strokeWidth="13"
              strokeLinecap="round"
              fill="none"
            />
            <path
              className="brow brow-r tb"
              d="M326 116 L224 168"
              stroke="var(--dark)"
              strokeWidth="13"
              strokeLinecap="round"
              fill="none"
            />

            <g className="glow" id="glow" fill="var(--glow)">
              <g className="eye eye-l tb">
                <path className="eyeshape" d="M86 138 L170 184 L98 200 Z" />
                <g clipPath="url(#cl)">
                  <ellipse id="pl" className="pupil" cx="138" cy="176" rx="4" ry="15" fill="var(--dark)" />
                </g>
              </g>
              <g className="eye eye-r tb">
                <path className="eyeshape" d="M314 138 L230 184 L302 200 Z" />
                <g clipPath="url(#cr)">
                  <ellipse id="pr" className="pupil" cx="262" cy="176" rx="4" ry="15" fill="var(--dark)" />
                </g>
              </g>
              <path d="M200 208 L182 244 L194 238 L200 246 L208 238 L220 244 Z" />
              <path
                className="m m-idle tb"
                d="M85 238 L110 262 L125 244 L150 276 L168 254 L200 284 L232 254 L250 276 L275 244 L290 262 L315 238 L290 290 L272 272 L245 318 L225 296 L200 326 L175 296 L155 318 L128 272 L110 290 Z"
              />
              <path
                className="m m-snarl tb"
                d="M75 235 L105 262 L122 238 L150 285 L170 250 L200 300 L230 250 L250 285 L278 238 L295 262 L325 235 L310 320 L285 300 L262 345 L235 318 L200 362 L165 318 L138 345 L115 300 L90 320 Z"
              />
            </g>
          </g>
        </g>
      </g>
    </svg>
  );
};

export default HalloweenPumpkin;
