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
      <meshPhysicalMaterial
        color={data.color}
        metalness={0.4}
        roughness={0.25}
        transmission={0.35}
        thickness={1.2}
        ior={1.4}
        clearcoat={1}
        clearcoatRoughness={0.05}
        emissive={data.color}
        emissiveIntensity={0.18}
        transparent
        opacity={0.85}
      />
    </mesh>
  );
}

function Scene({ count = 9 }: { count?: number }) {
  const cubes = useMemo<CubeData[]>(() => {
    const palette = ["#c026d3", "#a855f7", "#7c3aed", "#e879f9", "#9333ea"];
    return Array.from({ length: count }).map((_, i) => {
      const side = i % 2 === 0 ? 1 : -1;
      return {
        position: [
          side * (3 + Math.random() * 5),
          -8 + Math.random() * 16,
          -3 + Math.random() * 4,
        ],
        scale: 0.7 + Math.random() * 1.4,
        rotationSpeed: [
          (Math.random() - 0.5) * 0.01,
          (Math.random() - 0.5) * 0.012,
          (Math.random() - 0.5) * 0.006,
        ],
        driftSpeed: 0.2 + Math.random() * 0.5,
        driftAmp: 0.4 + Math.random() * 0.8,
        phase: Math.random() * Math.PI * 2,
        color: palette[i % palette.length],
      };
    });
  }, [count]);
  return (
    <>
      <ambientLight intensity={0.6} />
      <directionalLight position={[5, 5, 5]} intensity={1.2} color="#f0abfc" />
      <directionalLight position={[-5, -3, 2]} intensity={0.7} color="#a855f7" />
      <pointLight position={[0, 0, 6]} intensity={0.9} color="#c026d3" />
      {cubes.map((c, i) => (
        <FloatingCube key={i} data={c} />
      ))}
    </>
  );
}

export function ReferralCubes() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 -z-10 opacity-90"
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
