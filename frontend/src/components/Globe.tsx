import { useEffect, useRef } from 'react';
import createGlobe from 'cobe';

// Longitude used only to start the rotation over the user's origin region.
const START_LON: Record<string, number> = {
  ET: 40.5, NG: 7.5, IN: 78.9, NP: 84.1, PH: 121.8,
  BD: 90.4, KE: 37.9, GH: -1.0, PK: 69.3, EG: 30.8,
};

interface GlobeProps {
  nationality: string;
  destination: string;
}

export default function Globe({ nationality }: GlobeProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const phiRef = useRef(0);
  const widthRef = useRef(0);

  useEffect(() => {
    if (!canvasRef.current) return;

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const startPhi = (-(START_LON[nationality] ?? 40.5) * Math.PI) / 180 + Math.PI / 6;
    phiRef.current = startPhi;

    const onResize = () => {
      if (canvasRef.current) {
        widthRef.current = canvasRef.current.offsetWidth;
      }
    };
    window.addEventListener('resize', onResize);
    onResize();

    const globe = createGlobe(canvasRef.current, {
      devicePixelRatio: 2,
      width: widthRef.current * 2,
      height: widthRef.current * 2,
      phi: startPhi,
      theta: 0.28,
      dark: 1,
      diffuse: 3,
      mapSamples: 40000,
      mapBrightness: 12,
      baseColor: [0.2, 0.32, 0.34],
      markerColor: [0.15, 1, 0.82],
      glowColor: [0.05, 0.55, 0.46],
      markers: [],
    });

    let frameId: number;
    const animate = () => {
      if (!prefersReducedMotion) {
        phiRef.current += 0.002;
      }
      globe.update({
        phi: phiRef.current,
        width: widthRef.current * 2,
        height: widthRef.current * 2,
      });
      frameId = requestAnimationFrame(animate);
    };
    frameId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(frameId);
      globe.destroy();
      window.removeEventListener('resize', onResize);
    };
  }, [nationality]);

  return (
    <div className="relative w-full flex items-center justify-center" style={{ maxWidth: 124 }}>
      {/* soft halo behind the globe */}
      <div
        aria-hidden
        className="absolute inset-[2%] rounded-full bg-primary/25 blur-[28px]"
      />
      <canvas
        ref={canvasRef}
        className="relative w-full aspect-square"
        style={{ contain: 'layout paint size', maxWidth: 124 }}
      />
    </div>
  );
}
