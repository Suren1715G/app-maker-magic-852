import { Canvas, useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";

type CubeData = {
  position: [number, number, number];
  scale: number;
  rotationSpeed: [number, number, number];
  driftSpeed: number;
  driftAmp: number;
  phase: number;
  color: string;
};

const PALETTE = [
  "#c026d3", // fuchsia
  "#9333ea", // purple
  "#7c3aed", // violet
  "#3b82f6", // blue
  "#1e40af", // deep blue
  "#e879f9", // light pink
  "#a855f7", // light purple
];

function FloatingCube({ data }: { data: CubeData }) {
  const ref = useRef<THREE.Mesh>(null);
  const baseY = data.position[1];

  useFrame((state) => {
    if (!ref.current) return;
    const t = state.clock.getElapsedTime();
    ref.current.rotation.x += data.rotationSpeed[0];
    ref.current.rotation.y += data.rotationSpeed[1];
    ref.current.rotation.z += data.rotationSpeed[2];
    ref.current.position.y =
      baseY + Math.sin(t * data.driftSpeed + data.phase) * data.driftAmp;
  });

  return (
    <mesh ref={ref} position={data.position} scale={data.scale}>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial
        color={data.color}
        roughness={0.35}
        metalness={0.55}
        emissive={data.color}
        emissiveIntensity={0.18}
      />
    </mesh>
  );
}

function Scene() {
  const cubes = useMemo<CubeData[]>(() => {
    const arr: CubeData[] = [];
    const count = 22;
    for (let i = 0; i < count; i++) {
      // Spread cubes around the viewport, mostly to the sides.
      const side = Math.random() > 0.5 ? 1 : -1;
      const x = side * (3 + Math.random() * 7);
      const y = -6 + Math.random() * 12;
      const z = -6 + Math.random() * 6;
      arr.push({
        position: [x, y, z],
        scale: 0.4 + Math.random() * 1.4,
        rotationSpeed: [
          (Math.random() - 0.5) * 0.006,
          (Math.random() - 0.5) * 0.008,
          (Math.random() - 0.5) * 0.004,
        ],
        driftSpeed: 0.2 + Math.random() * 0.5,
        driftAmp: 0.2 + Math.random() * 0.6,
        phase: Math.random() * Math.PI * 2,
        color: PALETTE[Math.floor(Math.random() * PALETTE.length)],
      });
    }
    return arr;
  }, []);

  return (
    <>
      <ambientLight intensity={0.45} />
      <directionalLight position={[5, 5, 5]} intensity={0.8} color="#f0abfc" />
      <directionalLight position={[-5, -3, 2]} intensity={0.5} color="#60a5fa" />
      <pointLight position={[0, 0, 5]} intensity={0.6} color="#a855f7" />
      {cubes.map((c, i) => (
        <FloatingCube key={i} data={c} />
      ))}
    </>
  );
}

export function CubesBackground() {
  return (
    <div
      aria-hidden
      className="fixed inset-0 -z-10 pointer-events-none opacity-70"
      style={{
        maskImage:
          "radial-gradient(ellipse 80% 70% at 50% 50%, black 40%, transparent 95%)",
        WebkitMaskImage:
          "radial-gradient(ellipse 80% 70% at 50% 50%, black 40%, transparent 95%)",
      }}
    >
      <Canvas
        camera={{ position: [0, 0, 10], fov: 55 }}
        dpr={[1, 1.5]}
        gl={{ antialias: true, alpha: true }}
      >
        <Scene />
      </Canvas>
    </div>
  );
}