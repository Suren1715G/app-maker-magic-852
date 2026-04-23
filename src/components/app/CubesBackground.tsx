import { Canvas, useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useLocation } from "react-router-dom";
import { Environment } from "@react-three/drei";

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
      <meshPhysicalMaterial
        color={data.color}
        metalness={1}
        roughness={0.08}
        clearcoat={1}
        clearcoatRoughness={0.05}
        reflectivity={1}
        envMapIntensity={1.6}
      />
    </mesh>
  );
}

function CubesScene() {
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

function OrbitalRing({
  radius,
  tilt,
  color,
  speed,
  thickness = 0.04,
}: {
  radius: number;
  tilt: [number, number, number];
  color: string;
  speed: number;
  thickness?: number;
}) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame((state) => {
    if (!ref.current) return;
    ref.current.rotation.z = state.clock.getElapsedTime() * speed;
  });
  return (
    <mesh ref={ref} rotation={tilt}>
      <torusGeometry args={[radius, thickness, 16, 128]} />
      <meshPhysicalMaterial
        color={color}
        metalness={1}
        roughness={0.05}
        clearcoat={1}
        clearcoatRoughness={0.02}
        emissive={color}
        emissiveIntensity={0.6}
        envMapIntensity={2}
        toneMapped={false}
      />
    </mesh>
  );
}

function MiniCube({
  position,
  scale,
  color,
  speed,
}: {
  position: [number, number, number];
  scale: number;
  color: string;
  speed: number;
}) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame((state) => {
    if (!ref.current) return;
    const t = state.clock.getElapsedTime();
    ref.current.rotation.x = t * speed;
    ref.current.rotation.y = t * speed * 0.7;
    ref.current.position.y = position[1] + Math.sin(t * 0.6 + position[0]) * 0.3;
  });
  return (
    <mesh ref={ref} position={position} scale={scale}>
      <boxGeometry args={[1, 1, 1]} />
      <meshPhysicalMaterial
        color={color}
        metalness={1}
        roughness={0.08}
        clearcoat={1}
        clearcoatRoughness={0.05}
        envMapIntensity={1.8}
      />
    </mesh>
  );
}

function OrbitsScene() {
  const minis = useMemo(
    () =>
      Array.from({ length: 14 }).map((_, i) => ({
        position: [
          (Math.random() - 0.5) * 14,
          (Math.random() - 0.5) * 8,
          (Math.random() - 0.5) * 4,
        ] as [number, number, number],
        scale: 0.25 + Math.random() * 0.5,
        color: PALETTE[i % PALETTE.length],
        speed: 0.3 + Math.random() * 0.6,
      })),
    []
  );
  return (
    <>
      <ambientLight intensity={0.5} />
      <pointLight position={[0, 0, 5]} intensity={1.2} color="#c026d3" />
      <pointLight position={[6, -3, 3]} intensity={0.8} color="#f97316" />
      <pointLight position={[-6, 3, 3]} intensity={0.8} color="#3b82f6" />
      <OrbitalRing radius={5.5} tilt={[1.2, 0.3, 0.4]} color="#a855f7" speed={0.15} />
      <OrbitalRing radius={6.8} tilt={[0.6, 1.1, -0.2]} color="#f97316" speed={-0.12} thickness={0.05} />
      <OrbitalRing radius={4.2} tilt={[1.4, -0.5, 0.8]} color="#ec4899" speed={0.2} thickness={0.03} />
      <OrbitalRing radius={8} tilt={[0.3, 0.8, 1.2]} color="#3b82f6" speed={-0.08} thickness={0.04} />
      {minis.map((m, i) => (
        <MiniCube key={i} {...m} />
      ))}
    </>
  );
}

function ParticleField() {
  const ref = useRef<THREE.Points>(null);
  const { positions, colors } = useMemo(() => {
    const count = 600;
    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);
    const palette = [
      new THREE.Color("#c026d3"),
      new THREE.Color("#3b82f6"),
      new THREE.Color("#f97316"),
      new THREE.Color("#a855f7"),
    ];
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 24;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 16;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 10;
      const c = palette[Math.floor(Math.random() * palette.length)];
      col[i * 3] = c.r;
      col[i * 3 + 1] = c.g;
      col[i * 3 + 2] = c.b;
    }
    return { positions: pos, colors: col };
  }, []);

  useFrame((state) => {
    if (!ref.current) return;
    ref.current.rotation.y = state.clock.getElapsedTime() * 0.04;
    ref.current.rotation.x = Math.sin(state.clock.getElapsedTime() * 0.1) * 0.1;
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={positions.length / 3}
          array={positions}
          itemSize={3}
        />
        <bufferAttribute
          attach="attributes-color"
          count={colors.length / 3}
          array={colors}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.08}
        vertexColors
        transparent
        opacity={0.9}
        sizeAttenuation
        depthWrite={false}
      />
    </points>
  );
}

function ParticlesScene() {
  return (
    <>
      <ambientLight intensity={0.6} />
      <ParticleField />
    </>
  );
}

function PrismShape() {
  const ref = useRef<THREE.Mesh>(null);
  useFrame((state) => {
    if (!ref.current) return;
    const t = state.clock.getElapsedTime();
    ref.current.rotation.x = t * 0.15;
    ref.current.rotation.y = t * 0.2;
  });
  return (
    <mesh ref={ref}>
      <icosahedronGeometry args={[3, 0]} />
      <meshPhysicalMaterial
        color="#e0e0e0"
        metalness={1}
        roughness={0.04}
        clearcoat={1}
        clearcoatRoughness={0.02}
        envMapIntensity={2.2}
        emissive="#c026d3"
        emissiveIntensity={0.25}
        wireframe
      />
    </mesh>
  );
}

function PrismScene() {
  return (
    <>
      <ambientLight intensity={0.5} />
      <pointLight position={[5, 5, 5]} intensity={1.2} color="#ec4899" />
      <pointLight position={[-5, -3, 4]} intensity={1} color="#3b82f6" />
      <PrismShape />
      <CubesScene />
    </>
  );
}

type Variant = "cubes" | "orbits" | "particles" | "prism";

function pickVariant(pathname: string): Variant {
  if (pathname === "/" || pathname.startsWith("/calls")) return "cubes";
  if (pathname.startsWith("/calendar") || pathname.startsWith("/leads")) return "orbits";
  if (pathname.startsWith("/sms") || pathname.startsWith("/notifications")) return "particles";
  if (pathname.startsWith("/analytics") || pathname.startsWith("/reviews") || pathname.startsWith("/assistant"))
    return "prism";
  // default for billing/referrals/support/settings
  return "cubes";
}

export function CubesBackground() {
  const location = useLocation();
  const variant = pickVariant(location.pathname);

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
        key={variant}
        camera={{ position: [0, 0, 10], fov: 55 }}
        dpr={[1, 1.5]}
        gl={{ antialias: true, alpha: true }}
      >
        <Environment preset="night" background={false} />
        {variant === "cubes" && <CubesScene />}
        {variant === "orbits" && <OrbitsScene />}
        {variant === "particles" && <ParticlesScene />}
        {variant === "prism" && <PrismScene />}
      </Canvas>
    </div>
  );
}