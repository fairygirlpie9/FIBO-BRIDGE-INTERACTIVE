import React, { useRef, useEffect } from 'react';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
import { OrbitControls, TransformControls, Grid, Environment, ContactShadows, SpotLight, useHelper } from '@react-three/drei';
import * as THREE from 'three';
import { SceneParams, ControlMode, Vector3 } from '../types';

interface Scene3DProps {
  params: SceneParams;
  onLightMove: (pos: Vector3) => void;
  mode: ControlMode;
}

const LightSource = ({ 
  position, 
  color, 
  intensity, 
  onDrag, 
  mode 
}: { 
  position: Vector3; 
  color: string; 
  intensity: number;
  onDrag: (v: Vector3) => void;
  mode: ControlMode;
}) => {
  const lightRef = useRef<THREE.SpotLight>(null);
  const meshRef = useRef<THREE.Mesh>(null);
  const transformRef = useRef<any>(null); // Type definition for TransformControls is tricky in some versions

  // Convert kelvin/hex + intensity to actual ThreeJS light params
  // Note: ThreeJS intensities work differently than our abstract 0-100 scale
  const effectiveIntensity = intensity * 2; 

  useEffect(() => {
    if (transformRef.current) {
        const controls = transformRef.current;
        const callback = () => {
             if (meshRef.current) {
                const p = meshRef.current.position;
                onDrag({ x: p.x, y: p.y, z: p.z });
             }
        };
        controls.addEventListener('dragging-changed', (event: any) => {
             // Optional: Disable orbit controls handled by parent logic usually
        });
        controls.addEventListener('change', callback);
        return () => controls.removeEventListener('change', callback);
    }
  }, [onDrag]);

  return (
    <>
      <TransformControls 
        ref={transformRef}
        object={meshRef}
        mode="translate"
        enabled={mode === ControlMode.DRAG_KEY}
        showX={mode === ControlMode.DRAG_KEY}
        showY={mode === ControlMode.DRAG_KEY}
        showZ={mode === ControlMode.DRAG_KEY}
      />
      
      <mesh ref={meshRef} position={[position.x, position.y, position.z]} castShadow>
        <sphereGeometry args={[0.2, 16, 16]} />
        <meshBasicMaterial color={color} />
      </mesh>

      <SpotLight
        ref={lightRef}
        position={[position.x, position.y, position.z]}
        target-position={[0, 1, 0]} // Target the subject's head area
        color={color}
        intensity={effectiveIntensity}
        angle={0.6}
        penumbra={0.5}
        castShadow
        shadow-bias={-0.0001}
      />
    </>
  );
};

const Subject = () => {
  return (
    <group position={[0, 0, 0]}>
      {/* Legs */}
      <mesh position={[-0.2, 0.75, 0]} castShadow receiveShadow>
        <capsuleGeometry args={[0.12, 1.5, 4, 8]} />
        <meshStandardMaterial color="#888" roughness={0.3} metalness={0.1} />
      </mesh>
      <mesh position={[0.2, 0.75, 0]} castShadow receiveShadow>
        <capsuleGeometry args={[0.12, 1.5, 4, 8]} />
        <meshStandardMaterial color="#888" roughness={0.3} metalness={0.1} />
      </mesh>
      
      {/* Torso */}
      <mesh position={[0, 1.8, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.6, 0.9, 0.3]} />
        <meshStandardMaterial color="#ddd" roughness={0.5} />
      </mesh>

      {/* Head */}
      <mesh position={[0, 2.4, 0]} castShadow receiveShadow>
        <sphereGeometry args={[0.2, 32, 32]} />
        <meshStandardMaterial color="#fff" roughness={0.2} />
      </mesh>
    </group>
  );
};

const CameraRig = ({ params }: { params: SceneParams }) => {
    const { camera } = useThree();
    
    useEffect(() => {
        // Simple FOV approximation based on lens mm
        // 50mm is roughly 40-45 deg fov. 24mm is wider.
        let fov = 45;
        if (params.lensType === '24mm') fov = 74;
        if (params.lensType === '35mm') fov = 54;
        if (params.lensType === '50mm') fov = 40;
        if (params.lensType === '85mm') fov = 24;

        (camera as THREE.PerspectiveCamera).fov = fov;
        camera.updateProjectionMatrix();
    }, [params.lensType, camera]);

    return null;
}

export const Scene3D: React.FC<Scene3DProps> = ({ params, onLightMove, mode }) => {
  return (
    <div className="w-full h-full bg-black rounded-lg overflow-hidden border border-zinc-800 shadow-2xl relative">
       <div className="absolute top-4 left-4 z-10 text-xs text-zinc-500 font-mono pointer-events-none">
          PREVIEW MONITOR<br/>
          Interactive 3D Stage • HDR Linear
      </div>

      <Canvas shadows dpr={[1, 2]} camera={{ position: [0, 2, 6], fov: 45 }}>
        <color attach="background" args={['#050505']} />
        
        <CameraRig params={params} />

        <ambientLight intensity={0.1} />
        
        <LightSource 
          position={params.keyLight.position} 
          color={params.keyLight.gel}
          intensity={params.keyLight.intensity}
          onDrag={onLightMove}
          mode={mode}
        />

        <Subject />

        <ContactShadows opacity={0.6} scale={10} blur={2.5} far={4} />
        
        <Grid infiniteGrid fadeDistance={30} sectionColor="#333" cellColor="#111" />
        
        <OrbitControls 
            makeDefault 
            enabled={mode === ControlMode.ORBIT}
            target={[0, 1.2, 0]}
            maxPolarAngle={Math.PI / 1.8}
        />
        
        <Environment preset="night" blur={0.8} background={false} />
      </Canvas>
    </div>
  );
};