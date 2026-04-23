import { Canvas, useFrame } from "@react-three/fiber";
import { MeshDistortMaterial } from "@react-three/drei";
import { useRef } from "react";
import type { Mesh } from "three";

function Orb({ speaking, connected }: { speaking: boolean; connected: boolean }) {
  const mesh = useRef<Mesh>(null);

  useFrame((_, delta) => {
    if (!mesh.current) return;
    const targetScale = speaking ? 1.15 : connected ? 1.05 : 1;
    mesh.current.scale.x += (targetScale - mesh.current.scale.x) * 0.1;
    mesh.current.scale.y = mesh.current.scale.x;
    mesh.current.scale.z = mesh.current.scale.x;
    mesh.current.rotation.y += delta * (speaking ? 0.6 : 0.15);
    mesh.current.rotation.x += delta * (speaking ? 0.2 : 0.05);
  });

  return (
    <mesh ref={mesh}>
      <sphereGeometry args={[1, 32, 32]} />
      <MeshDistortMaterial
        color={speaking ? "#a855f7" : connected ? "#6366f1" : "#475569"}
        emissive={speaking ? "#7c3aed" : "#312e81"}
        emissiveIntensity={speaking ? 0.6 : 0.25}
        distort={speaking ? 0.45 : connected ? 0.25 : 0.15}
        speed={speaking ? 3 : 1}
        roughness={0.2}
        metalness={0.6}
      />
    </mesh>
  );
}

export function ReceptionistOrb({
  speaking,
  connected,
  size = 64,
}: {
  speaking: boolean;
  connected: boolean;
  size?: number;
}) {
  return (
    <div style={{ width: size, height: size }} className="rounded-full overflow-hidden">
      <Canvas
        camera={{ position: [0, 0, 2.6], fov: 45 }}
        dpr={[1, 1.5]}
        frameloop="always"
        gl={{ antialias: false, powerPreference: "low-power", alpha: true }}
      >
        <ambientLight intensity={0.6} />
        <directionalLight position={[2, 2, 2]} intensity={1.2} />
        <pointLight position={[-2, -1, -1]} intensity={0.8} color="#a855f7" />
        <Orb speaking={speaking} connected={connected} />
      </Canvas>
    </div>
  );
}
