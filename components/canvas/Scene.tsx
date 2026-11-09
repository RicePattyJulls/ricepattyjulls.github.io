"use client";

import { useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  Points,
  PointMaterial,
  AdaptiveDpr,
  PerformanceMonitor,
} from "@react-three/drei";
import * as THREE from "three";
import { useScrollProgressRef } from "@/lib/scroll";

/* ------------------------------------------------------------------ *
 * Drifting particle field — the ambient "energy".
 * ------------------------------------------------------------------ */
function ParticleField({ count = 1400 }: { count?: number }) {
  const ref = useRef<THREE.Points>(null);
  const scroll = useScrollProgressRef();

  const positions = useMemo(() => {
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      arr[i * 3] = (Math.random() - 0.5) * 22;
      arr[i * 3 + 1] = (Math.random() - 0.5) * 14;
      arr[i * 3 + 2] = (Math.random() - 0.5) * 14;
    }
    return arr;
  }, [count]);

  useFrame((state, delta) => {
    if (!ref.current) return;
    ref.current.rotation.y += delta * 0.02;
    ref.current.rotation.x = scroll.current * 0.4;
    ref.current.position.y = scroll.current * 2.2;
  });

  return (
    <Points ref={ref} positions={positions} stride={3} frustumCulled={false}>
      <PointMaterial
        transparent
        color="#8f7bff"
        size={0.026}
        sizeAttenuation
        depthWrite={false}
        opacity={0.5}
      />
    </Points>
  );
}

/* Scroll-reactive camera drift. */
function Rig() {
  const scroll = useScrollProgressRef();
  const { camera, pointer } = useThree();
  const target = useMemo(() => new THREE.Vector3(), []);
  useFrame(() => {
    // Core is the anchored, centered hub: only a gentle mouse parallax,
    // with a soft drift/recede as the visitor scrolls past the hero.
    const s = scroll.current;
    target.set(pointer.x * 0.4, pointer.y * 0.25 - s * 0.8, 6 + s * 1.4);
    camera.position.lerp(target, 0.05);
    camera.lookAt(0, -s * 0.45, 0);
  });
  return null;
}

export default function Scene() {
  return (
    <Canvas
      className="scene-layer"
      // R3F sets inline position:relative + width/height:100% on its container,
      // which overrides the .scene-layer class. Force a true fixed, full-viewport,
      // non-blocking background so the core projects to the screen centre.
      style={{
        position: "fixed",
        inset: 0,
        width: "100vw",
        height: "100vh",
        pointerEvents: "none",
      }}
      dpr={[1, 1.8]}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      camera={{ position: [0, 0, 6], fov: 42 }}
    >
      <PerformanceMonitor />
      <AdaptiveDpr pixelated={false} />
      <fog attach="fog" args={["#05060a", 8, 18]} />

      <ParticleField />
      <Rig />
    </Canvas>
  );
}
