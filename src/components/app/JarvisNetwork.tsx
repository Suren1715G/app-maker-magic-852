import { Canvas, useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";

type Node = {
  pos: THREE.Vector3;
  color: string;
  scale: number;
  pulse: number;
};

// Distribute N points evenly on a sphere using the Fibonacci spiral
function fibonacciSphere(n: number, radius: number): THREE.Vector3[] {
  const pts: THREE.Vector3[] = [];
  const phi = Math.PI * (Math.sqrt(5) - 1);
  for (let i = 0; i < n; i++) {
    const y = 1 - (i / (n - 1)) * 2;
    const r = Math.sqrt(1 - y * y);
    const theta = phi * i;
    pts.push(
      new THREE.Vector3(Math.cos(theta) * r, y, Math.sin(theta) * r).multiplyScalar(radius),
    );
  }
  return pts;
}

function NodeMesh({ node }: { node: Node }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame((state) => {
    if (!ref.current) return;
    const t = state.clock.getElapsedTime();
    const p = 1 + Math.sin(t * 1.5 + node.pulse) * 0.15;
    ref.current.scale.setScalar(node.scale * p);
  });
  return (
    <mesh ref={ref} position={node.pos}>
      <sphereGeometry args={[0.08, 16, 16]} />
      <meshStandardMaterial
        color={node.color}
        emissive={node.color}
        emissiveIntensity={1.4}
        toneMapped={false}
      />
    </mesh>
  );
}

function Network() {
  const group = useRef<THREE.Group>(null);

  const { nodes, lineGeom } = useMemo(() => {
    const RADIUS = 2.2;
    const N = 42;
    const positions = fibonacciSphere(N, RADIUS);
    const orange = "#fb923c";
    const purple = "#c026d3";
    const lightPurple = "#e879f9";

    const nodes: Node[] = positions.map((pos, i) => ({
      pos,
      color: i % 5 === 0 ? orange : i % 3 === 0 ? lightPurple : purple,
      scale: 0.7 + Math.random() * 0.9,
      pulse: Math.random() * Math.PI * 2,
    }));

    // Build edges: connect each node to its k-nearest neighbors
    const k = 3;
    const edgePositions: number[] = [];
    const seen = new Set<string>();
    for (let i = 0; i < N; i++) {
      const dists = positions
        .map((p, j) => ({ j, d: positions[i].distanceTo(p) }))
        .filter((x) => x.j !== i)
        .sort((a, b) => a.d - b.d)
        .slice(0, k);
      for (const { j } of dists) {
        const key = i < j ? `${i}-${j}` : `${j}-${i}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const a = positions[i];
        const b = positions[j];
        edgePositions.push(a.x, a.y, a.z, b.x, b.y, b.z);
      }
    }
    const lineGeom = new THREE.BufferGeometry();
    lineGeom.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(edgePositions, 3),
    );
    return { nodes, lineGeom };
  }, []);

  useFrame((_, dt) => {
    if (!group.current) return;
    group.current.rotation.y += dt * 0.12;
    group.current.rotation.x += dt * 0.04;
  });

  return (
    <group ref={group}>
      <lineSegments geometry={lineGeom}>
        <lineBasicMaterial
          color="#a855f7"
          transparent
          opacity={0.35}
          toneMapped={false}
        />
      </lineSegments>
      {nodes.map((n, i) => (
        <NodeMesh key={i} node={n} />
      ))}
    </group>
  );
}

export function JarvisNetwork() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
      <Canvas
        camera={{ position: [0, 0, 5.5], fov: 50 }}
        dpr={[1, 1.5]}
        gl={{ antialias: true, alpha: true }}
      >
        <ambientLight intensity={0.5} />
        <pointLight position={[3, 3, 3]} intensity={1.2} color="#e879f9" />
        <pointLight position={[-3, -2, 2]} intensity={0.9} color="#fb923c" />
        <Network />
      </Canvas>
    </div>
  );
}
