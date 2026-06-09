import { useEffect, useRef } from 'react';
import createGlobe from 'cobe';

const COORDS: Record<string, [number, number]> = {
  ET: [9.1, 40.5],
  NG: [9.1, 7.5],
  IN: [20.6, 78.9],
  NP: [28.4, 84.1],
  PH: [12.9, 121.8],
  BD: [23.7, 90.4],
  KE: [0.0, 37.9],
  GH: [7.9, -1.0],
  PK: [30.4, 69.3],
  EG: [26.8, 30.8],
  GB: [55.4, -3.4],
  US: [37.1, -95.7],
  CA: [56.1, -106.3],
  DE: [51.2, 10.5],
  AU: [-25.3, 133.8],
  FR: [46.2, 2.2],
  NL: [52.1, 5.3],
  SE: [60.1, 18.6],
};

interface GlobeProps {
  nationality: string;
  destination: string;
}

export default function Globe({ nationality, destination }: GlobeProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const phiRef = useRef(0);
  const widthRef = useRef(0);

  useEffect(() => {
    if (!canvasRef.current) return;

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const origin = COORDS[nationality] || [9.1, 40.5];
    const dest = COORDS[destination] || [55.4, -3.4];

    // Start facing the origin country
    const startPhi = (-origin[1] * Math.PI) / 180 + Math.PI / 6;
    phiRef.current = startPhi;

    const markers = [
      { location: origin as [number, number], size: 0.1 },
      { location: dest as [number, number], size: 0.1 },
    ];

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
      theta: 0.2,
      dark: 0,
      diffuse: 1.2,
      mapSamples: 24000,
      mapBrightness: 2.5,
      baseColor: [0.92, 0.92, 0.94],
      markerColor: [0.15, 0.15, 0.18],
      glowColor: [1, 1, 1],
      markers,
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
  }, [nationality, destination]);

  return (
    <canvas
      ref={canvasRef}
      className="w-full aspect-square"
      style={{ contain: 'layout paint size', maxWidth: 80 }}
    />
  );
}
