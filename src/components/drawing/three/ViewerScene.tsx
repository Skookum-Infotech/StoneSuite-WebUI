// Everything inside the 3D canvas: lights, a floor grid, the pieces, and orbit controls.
// The camera is placed whenever the layout's size changes or a view button is pressed.

import { useEffect, useRef, type ElementRef } from 'react';
import { useThree } from '@react-three/fiber';
import { MOUSE, TOUCH, type Texture } from 'three';
import { OrbitControls } from '@react-three/drei';
import { cameraPose, type ViewPreset } from '@/lib/drawing/three/cameraViews';
import { FLOOR_COLOR, FLOOR_SPAN_FACTOR, MM_TO_SCENE } from '@/lib/drawing/three/constants';
import type { AreaSolids } from '@/lib/drawing/three/solids';
import { CabinetMesh } from './CabinetMesh';
import { PieceMesh } from './PieceMesh';

/** Grid lines per side of the floor. */
const FLOOR_DIVISIONS = 30;
const GRID_LINE_COLOR = '#c9c6c0';
const KEY_LIGHT_POSITION: [number, number, number] = [4, 8, 5];
const KEY_LIGHT_INTENSITY = 2.2;
const FILL_LIGHT_INTENSITY = 0.9;
const CANVAS_LABEL = '3D view of the drawing. Drag to rotate, scroll to zoom, arrow keys to move.';

/** Renders the current view and returns it as a PNG (null if the browser could not encode it). */
export type CaptureFn = () => Promise<Blob | null>;

export interface ViewRequest {
  preset: ViewPreset;
  /** Changes on every press, so pressing the same view again re-frames it. */
  nonce: number;
}

interface ViewerSceneProps {
  solids: AreaSolids;
  view: ViewRequest;
  /** The loaded slab textures, by photo link. */
  photos: Record<string, Texture>;
  /** Hands the parent the function that saves the view as a picture, once the scene is ready. */
  onCaptureReady: (capture: CaptureFn) => void;
  /** The hand tool: dragging moves the view instead of turning it. */
  handOn: boolean;
}

export function ViewerScene({ solids, view, photos, onCaptureReady, handOn }: ViewerSceneProps) {
  const camera = useThree((s) => s.camera);
  const scene = useThree((s) => s.scene);
  const gl = useThree((s) => s.gl);
  const domElement = useThree((s) => s.gl.domElement);
  const controls = useRef<ElementRef<typeof OrbitControls>>(null);
  const { bounds } = solids;

  // Frame the pieces on open and on every view press (and when the layout's size changes).
  useEffect(() => {
    const { position, target } = cameraPose(view.preset, bounds);
    camera.position.set(...position);
    controls.current?.target.set(...target);
    controls.current?.update();
  }, [camera, bounds, view]);

  // Drawn again right before it is read: the canvas does not keep its picture between frames.
  useEffect(() => {
    onCaptureReady(() => {
      gl.render(scene, camera);
      return new Promise<Blob | null>((resolve) => gl.domElement.toBlob(resolve, 'image/png'));
    });
  }, [gl, scene, camera, onCaptureReady]);

  // The canvas takes keyboard focus so the arrow keys orbit and pan it.
  useEffect(() => {
    domElement.setAttribute('tabindex', '0');
    domElement.setAttribute('aria-label', CANVAS_LABEL);
    return () => {
      domElement.removeAttribute('tabindex');
      domElement.removeAttribute('aria-label');
    };
  }, [domElement]);

  const floorSize = bounds.sizeMm * MM_TO_SCENE * FLOOR_SPAN_FACTOR;

  return (
    <>
      <color attach="background" args={[FLOOR_COLOR]} />
      <hemisphereLight intensity={FILL_LIGHT_INTENSITY} />
      <directionalLight position={KEY_LIGHT_POSITION} intensity={KEY_LIGHT_INTENSITY} />
      <gridHelper
        args={[floorSize, FLOOR_DIVISIONS, GRID_LINE_COLOR, GRID_LINE_COLOR]}
        position={[bounds.centerX * MM_TO_SCENE, 0, -bounds.centerY * MM_TO_SCENE]}
      />
      <group scale={MM_TO_SCENE}>
        {solids.cabinets.map((cabinet) => <CabinetMesh key={cabinet.id} cabinet={cabinet} />)}
        {solids.pieces.map((solid) => (
          <PieceMesh key={solid.id} solid={solid} photo={solid.texture ? photos[solid.texture.photoUrl] ?? null : null} photos={photos} />
        ))}
      </group>
      <OrbitControls
        ref={controls}
        makeDefault
        enableDamping
        keyEvents={domElement}
        maxPolarAngle={Math.PI / 2}
        mouseButtons={{ LEFT: handOn ? MOUSE.PAN : MOUSE.ROTATE, MIDDLE: MOUSE.DOLLY, RIGHT: MOUSE.PAN }}
        touches={{ ONE: handOn ? TOUCH.PAN : TOUCH.ROTATE, TWO: TOUCH.DOLLY_PAN }}
      />
    </>
  );
}
