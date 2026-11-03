import React, { useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { ThreeCanvas } from '@remotion/three';
import { useThree } from '@react-three/fiber';
import { cancelRender, continueRender, delayRender, useCurrentFrame, useVideoConfig } from 'remotion';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { stageAt } from './timeline';
import { ScreenAssets, SH, SW } from '../interaction-proof/screen';
import { drawMainScreen, loadMainScreenAssets } from './screens';

function roundedShape(w: number, h: number, r: number) {
  const s = new THREE.Shape(), x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y); return s;
}
function solid(w: number, h: number, r: number, depth: number, bevel = .025) {
  const geometry = new THREE.ExtrudeGeometry(roundedShape(w, h, r), {
    depth, steps: 1, bevelEnabled: true, bevelSegments: 4, bevelSize: bevel, bevelThickness: bevel, curveSegments: 24,
  });
  geometry.translate(0, 0, -depth / 2); return geometry;
}
function surface(w: number, h: number, r: number) {
  const geometry = new THREE.ShapeGeometry(roundedShape(w, h, r), 32);
  const position = geometry.attributes.position, uv = geometry.attributes.uv;
  for (let i = 0; i < position.count; i++) uv.setXY(i, (position.getX(i) + w / 2) / w, (position.getY(i) + h / 2) / h);
  return geometry;
}
function World({ assets, renderScale }: { assets: ScreenAssets; renderScale: number }) {
  const frame = useCurrentFrame(), t = frame / 60;
  const shot = stageAt(t);
  const { camera, gl, scene } = useThree();
  const materials = useMemo(() => ({
    metal: new THREE.MeshStandardMaterial({ color: '#7a837b', metalness: .95, roughness: .27 }),
    glass: new THREE.MeshStandardMaterial({ color: '#080b09', metalness: .2, roughness: .12 }),
    back: new THREE.MeshStandardMaterial({ color: '#b7c4b5', metalness: .4, roughness: .37 }),
    dark: new THREE.MeshStandardMaterial({ color: '#17201b', metalness: .8, roughness: .25 }),
  }), []);
  const geometry = useMemo(() => ({
    body: solid(3.30, 7.01, .43, .245, .036),
    glass: surface(3.27, 6.98, .425),
    screen: surface(3.18, 3.18 * SH / SW, .38),
    back: surface(3.25, 6.96, .42),
    island: solid(.90, .255, .125, .009, .001),
    cameraPlate: solid(1.38, 1.48, .31, .08, .025),
    button: solid(.045, .53, .02, .08, .008),
  }), []);
  const screen = useMemo(() => {
    const factor = Math.max(2, 3 * renderScale);
    const canvas = document.createElement('canvas'); canvas.width = SW * factor; canvas.height = SH * factor;
    const ctx = canvas.getContext('2d'); if (!ctx) throw Error('Canvas2D unavailable');
    const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 8; texture.minFilter = THREE.LinearFilter; texture.magFilter = THREE.LinearFilter;
    texture.generateMipmaps = false;
    return { canvas, ctx, texture, factor };
  }, [renderScale]);
  useLayoutEffect(() => {
    drawMainScreen(screen.ctx, assets, t, screen.factor); screen.texture.needsUpdate = true;
    camera.position.set(shot.x, shot.y, shot.z);
    camera.lookAt(shot.x, shot.y, 0); camera.updateProjectionMatrix();
  }, [t, assets, screen, camera, shot.x, shot.y, shot.z]);
  useLayoutEffect(() => {
    const pmrem = new THREE.PMREMGenerator(gl), room = new RoomEnvironment();
    const env = pmrem.fromScene(room, .04); scene.environment = env.texture;
    return () => { scene.environment = null; env.dispose(); room.dispose(); pmrem.dispose(); };
  }, [gl, scene]);
  useEffect(() => () => {
    screen.texture.dispose(); Object.values(geometry).forEach(g => g.dispose()); Object.values(materials).forEach(m => m.dispose());
  }, [screen, geometry, materials]);
  return <>
    <ambientLight intensity={.7} />
    <directionalLight position={[-4, 7, 8]} intensity={3.2} color="#fff9ed" />
    <directionalLight position={[5, 1, 4]} intensity={1.8} color="#e0f2e2" />
    <directionalLight position={[-3, -4, -2]} intensity={2.4} color="#ffffff" />
    <group position={[shot.deviceX, shot.deviceY, 0]} rotation={[shot.rotateX, shot.rotateY, shot.rotateZ]}>
      <mesh geometry={geometry.body} material={materials.metal} />
      <mesh geometry={geometry.glass} material={materials.glass} position={[0, 0, .164]} />
      <mesh geometry={geometry.screen} position={[0, 0, .171]}>
        <meshBasicMaterial map={screen.texture} toneMapped={false} />
      </mesh>
      <mesh geometry={geometry.island} position={[0, 3.235, .18]}>
        <meshBasicMaterial color="#000" />
      </mesh>
      <mesh position={[.30, 3.235, .19]}><circleGeometry args={[.049, 32]} /><meshStandardMaterial color="#0e1725" metalness={.5} roughness={.13} /></mesh>
      <mesh geometry={geometry.back} material={materials.back} position={[0, 0, -.164]} rotation={[0, Math.PI, 0]} />
      <group position={[-.78, 2.57, -.22]} rotation={[0, Math.PI, 0]}>
        <mesh geometry={geometry.cameraPlate} material={materials.back} />
        {[[-.32, .39], [-.32, -.39], [.33, 0]].map(([x, y], i) => <group key={i} position={[x, y, .10]}>
          <mesh rotation={[Math.PI / 2, 0, 0]} material={materials.metal}><cylinderGeometry args={[.255, .255, .13, 40]} /></mesh>
          <mesh position={[0, 0, .071]} material={materials.dark}><circleGeometry args={[.218, 40]} /></mesh>
          <mesh position={[0, 0, .075]}><circleGeometry args={[.14, 40]} /><meshStandardMaterial color="#0b1828" metalness={.8} roughness={.1} /></mesh>
        </group>)}
      </group>
      {[[-1.69, 1.6], [-1.69, .94], [1.69, 1.13]].map(([x, y], i) => <mesh key={i} geometry={geometry.button} material={materials.metal} position={[x, y, 0]} />)}
      {[-2.67, 2.67].map(y => <React.Fragment key={y}>
        <mesh position={[-1.66, y, 0]}><boxGeometry args={[.033, .035, .24]} /><meshStandardMaterial color="#404b42" /></mesh>
        <mesh position={[1.66, y, 0]}><boxGeometry args={[.033, .035, .24]} /><meshStandardMaterial color="#404b42" /></mesh>
      </React.Fragment>)}
    </group>
  </>;
}

export function MainPhone({ renderScale = 1 }: { renderScale?: number }) {
  const { width, height } = useVideoConfig();
  const [assets, setAssets] = useState<ScreenAssets | null>(null);
  const [hold] = useState(() => delayRender('Loading original mobile fonts and campaign artwork'));
  useEffect(() => {
    let active = true;
    loadMainScreenAssets().then(value => { if (active) { setAssets(value); continueRender(hold); } }).catch(cancelRender);
    return () => { active = false; };
  }, [hold]);
  if (!assets) return null;
  return <ThreeCanvas width={width} height={height} dpr={renderScale} camera={{ fov: 32, near: .1, far: 100, position: [0, 0, 15.2] }}
    gl={{ antialias: true, alpha: true, preserveDrawingBuffer: true, powerPreference: 'high-performance' }}>
    <World assets={assets} renderScale={renderScale} />
  </ThreeCanvas>;
}
