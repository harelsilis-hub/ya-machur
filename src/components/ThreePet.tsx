'use client';

import { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { ContactShadows, Environment, Float, PresentationControls } from '@react-three/drei';
import * as THREE from 'three';

type Species = 'bird' | 'cat' | 'dragon' | 'robot' | 'ocean';
type Stage = 'egg' | 'baby' | 'adult';

interface ThreePetProps {
  species: Species;
  stage: Stage;
  isHappy?: boolean;
  isDead?: boolean;
}

function PetModel({ species, stage, isHappy, isDead }: ThreePetProps) {
  const groupRef = useRef<THREE.Group>(null);
  const isEgg = stage === 'egg';

  // Animation constants
  const floatIntensity = isHappy ? 4 : 1;
  const speed = isHappy ? 4 : 1;

  useFrame((state) => {
    if (!groupRef.current) return;
    const t = state.clock.getElapsedTime();

    if (isDead) {
      groupRef.current.position.y = Math.sin(t * 0.5) * 0.1;
      groupRef.current.rotation.z = Math.sin(t * 0.5) * 0.1;
    } else if (isHappy) {
      groupRef.current.position.y = Math.abs(Math.sin(t * 10)) * 0.5;
      groupRef.current.scale.y = 1 + Math.sin(t * 10) * 0.1;
      groupRef.current.scale.x = 1 - Math.sin(t * 10) * 0.05;
    } else {
      // Idle breathing
      groupRef.current.scale.y = 1 + Math.sin(t * 2) * 0.02;
      groupRef.current.scale.x = 1 - Math.sin(t * 2) * 0.01;
    }
  });

  const colors = useMemo(() => {
    if (isDead) return { main: '#94a3b8', accent: '#64748b' };
    switch (species) {
      case 'bird': return { main: '#fbbf24', accent: '#f59e0b' };
      case 'cat': return { main: '#f472b6', accent: '#db2777' };
      case 'dragon': return { main: '#a855f7', accent: '#7c3aed' };
      case 'robot': return { main: '#94a3b8', accent: '#3b82f6' };
      case 'ocean': return { main: '#38bdf8', accent: '#0284c7' };
      default: return { main: '#ffffff', accent: '#cccccc' };
    }
  }, [species, isDead]);

  return (
    <group ref={groupRef}>
      {isEgg ? (
        <mesh castShadow>
          <sphereGeometry args={[0.6, 32, 32]} />
          <meshPhysicalMaterial 
            color="#ffffff" 
            roughness={0.1} 
            clearcoat={1} 
            metalness={0.1}
            emissive={isDead ? '#000000' : colors.main}
            emissiveIntensity={0.1}
          />
          {/* Egg spots */}
          {[...Array(5)].map((_, i) => (
            <mesh key={i} position={[Math.sin(i) * 0.4, Math.cos(i) * 0.4, 0.4]}>
              <sphereGeometry args={[0.1, 16, 16]} />
              <meshBasicMaterial color={colors.accent} />
            </mesh>
          ))}
        </mesh>
      ) : (
        <group>
          {/* Main Body */}
          <mesh castShadow>
            <sphereGeometry args={[stage === 'baby' ? 0.5 : 0.7, 32, 32]} />
            <meshPhysicalMaterial color={colors.main} roughness={0.2} clearcoat={1} />
          </mesh>

          {/* Eyes */}
          <group position={[0.2, 0.1, 0.5]}>
            <mesh>
              <sphereGeometry args={[0.1, 16, 16]} />
              <meshBasicMaterial color="#000000" />
            </mesh>
          </group>
          <group position={[-0.2, 0.1, 0.5]}>
            <mesh>
              <sphereGeometry args={[0.1, 16, 16]} />
              <meshBasicMaterial color="#000000" />
            </mesh>
          </group>

          {/* Species specific traits */}
          {species === 'bird' && (
            <mesh position={[0, -0.1, 0.6]} rotation={[Math.PI / 2, 0, 0]}>
              <coneGeometry args={[0.15, 0.3, 4]} />
              <meshPhysicalMaterial color="#fb923c" />
            </mesh>
          )}
          {species === 'cat' && (
            <group>
              <mesh position={[0.3, 0.5, 0]}>
                <coneGeometry args={[0.15, 0.3, 3]} />
                <meshPhysicalMaterial color={colors.accent} />
              </mesh>
              <mesh position={[-0.3, 0.5, 0]}>
                <coneGeometry args={[0.15, 0.3, 3]} />
                <meshPhysicalMaterial color={colors.accent} />
              </mesh>
            </group>
          )}
          {species === 'robot' && (
             <mesh position={[0, 0, 0]}>
               <boxGeometry args={[0.8, 0.8, 0.8]} />
               <meshPhysicalMaterial color={colors.main} metalness={0.8} roughness={0.1} />
             </mesh>
          )}
          {species === 'dragon' && (
            <group>
              <mesh position={[0, 0.6, -0.2]}>
                <coneGeometry args={[0.1, 0.4, 16]} />
                <meshPhysicalMaterial color="#ef4444" />
              </mesh>
            </group>
          )}
          {species === 'ocean' && (
            <mesh rotation={[Math.PI / 2, 0, 0]}>
              <capsuleGeometry args={[0.5, 0.5, 16, 32]} />
              <meshPhysicalMaterial color={colors.main} />
            </mesh>
          )}
        </group>
      )}
    </group>
  );
}

export default function ThreePet({ species, stage, isHappy, isDead }: ThreePetProps) {
  return (
    <div style={{ width: '100%', height: '100%', minHeight: '150px' }}>
      <Canvas shadows camera={{ position: [0, 0, 4], fov: 45 }}>
        <ambientLight intensity={0.7} />
        <spotLight position={[10, 10, 10]} angle={0.15} penumbra={1} shadow-mapSize={[512, 512]} castShadow />
        <pointLight position={[-10, -10, -10]} intensity={0.5} />
        
        <PresentationControls
          global
          snap
          rotation={[0, 0.3, 0]}
          polar={[-Math.PI / 3, Math.PI / 3]}
          azimuth={[-Math.PI / 1.4, Math.PI / 1.4]}
        >
          <Float speed={2} rotationIntensity={0.5} floatIntensity={0.5}>
            <PetModel species={species} stage={stage} isHappy={isHappy} isDead={isDead} />
          </Float>
        </PresentationControls>

        <ContactShadows position={[0, -1, 0]} opacity={0.4} scale={10} blur={2.5} far={4} />
        <Environment preset="city" />
      </Canvas>
    </div>
  );
}
