import React, { useMemo, useRef, useState } from "react";
import {
  Dimensions,
  PanResponder,
  Platform,
  StyleSheet,
  Text,
  View,
} from "react-native";
import * as THREE from "three";
import type {} from "@react-three/fiber";
import { COUNTRIES, Country, latLonToVector3 } from "../data/mockData";

const Fiber = Platform.OS === "web"
  ? require("@react-three/fiber")
  : require("@react-three/fiber/native");
const Canvas = Fiber.Canvas as React.ComponentType<any>;
const useFrame = Fiber.useFrame as (callback: (state: any, delta: number) => void) => void;

type LonLat = [number, number];
type Rotation = { x: number; y: number; z: number };

type GestureState = {
  startX: number;
  startY: number;
  lastX: number;
  lastY: number;
  moved: number;
  pinchStartDistance: number;
  pinchStartCameraZ: number;
};

// Polígonos de continentes do Planeta Terra
const LAND_POLYGONS: LonLat[][] = [
  // América do Norte & Alasca
  [[-168, 65], [-160, 71], [-140, 70], [-130, 70], [-120, 76], [-95, 76], [-80, 74], [-73, 62], [-60, 60], [-55, 52], [-65, 44], [-70, 42], [-76, 35], [-81, 25], [-97, 26], [-105, 23], [-117, 32], [-124, 48], [-130, 55], [-145, 60], [-168, 65]],
  // México e América Central
  [[-117, 32], [-105, 23], [-97, 19], [-91, 15], [-83, 8], [-77, 8], [-80, 15], [-87, 21], [-97, 26], [-105, 23]],
  // Groenlândia
  [[-73, 60], [-55, 60], [-20, 76], [-30, 83], [-50, 83], [-70, 76], [-73, 60]],
  // América do Sul
  [[-77, 8], [-72, 11], [-60, 10], [-50, 6], [-44, -2], [-35, -5], [-35, -9], [-38, -13], [-41, -20], [-48, -28], [-53, -33], [-65, -42], [-66, -55], [-75, -53], [-73, -42], [-71, -30], [-76, -18], [-81, -5], [-80, 2], [-77, 8]],
  // Península Ibérica
  [[-9, 36], [-9, 43], [-3, 43], [-2, 36], [-9, 36]],
  // França, Alemanha e Europa Ocidental
  [[-3, 43], [-4, 48], [3, 51], [8, 54], [14, 54], [16, 48], [13, 45], [7, 43], [-3, 43]],
  // Itália
  [[9, 45], [13, 45], [18, 40], [15, 38], [12, 42], [9, 45]],
  // Escandinávia
  [[5, 58], [10, 63], [18, 70], [28, 70], [30, 60], [22, 56], [12, 56], [5, 58]],
  // Reino Unido e Irlanda
  [[-10, 50], [-5, 50], [1, 53], [0, 58], [-6, 58], [-10, 50]],
  // África
  [[-17, 33], [-5, 36], [10, 37], [25, 32], [33, 31], [43, 12], [51, 11], [46, 7], [40, -3], [35, -12], [32, -26], [28, -33], [20, -35], [16, -34], [12, -18], [9, -1], [2, 5], [-5, 5], [-15, 12], [-17, 21], [-17, 33]],
  // Madagascar
  [[43, -25], [50, -12], [47, -15], [43, -25]],
  // Eurásia & Rússia
  [[30, 60], [40, 66], [60, 73], [90, 77], [130, 72], [170, 67], [180, 65], [160, 55], [140, 48], [130, 42], [120, 32], [100, 22], [80, 26], [60, 25], [45, 35], [30, 50], [30, 60]],
  // Índia
  [[68, 24], [77, 31], [88, 27], [90, 22], [80, 13], [77, 8], [73, 15], [68, 24]],
  // Sudeste Asiático
  [[96, 22], [108, 21], [109, 11], [104, 1], [100, 6], [96, 22]],
  // Japão
  [[129, 31], [136, 34], [142, 40], [146, 45], [140, 46], [133, 40], [129, 31]],
  // Indonésia & Filipinas
  [[95, -5], [115, -7], [125, -8], [140, -3], [130, 5], [100, 5], [95, -5]],
  // Austrália
  [[113, -22], [120, -14], [135, -12], [142, -10], [153, -28], [150, -37], [138, -35], [115, -34], [113, -22]],
  // Nova Zelândia
  [[166, -46], [178, -37], [174, -42], [166, -46]],
  // Antártida
  [[-180, -88], [180, -88], [180, -64], [-180, -64]]
];

function pointInPolygon(lon: number, lat: number, polygon: LonLat[]) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];
    const intersects =
      yi > lat !== yj > lat &&
      lon < ((xj - xi) * (lat - yi)) / (yj - yi || 1e-9) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

function isLand(lat: number, lon: number) {
  return LAND_POLYGONS.some((polygon) => pointInPolygon(lon, lat, polygon));
}

// Textura circular em memória para eliminar cantos quadrados de partículas
function createCircularParticleTexture(): THREE.Texture {
  if (Platform.OS !== "web" || typeof document === "undefined") {
    return new THREE.Texture();
  }
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.beginPath();
    ctx.arc(32, 32, 28, 0, Math.PI * 2);
    ctx.fillStyle = "#FFFFFF";
    ctx.fill();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

// Resolução de alta definição com latitudeStep = 1.35
function buildLandParticleGeometry(radius = 2.006) {
  const positions: number[] = [];
  const latitudeStep = 1.35;

  for (let lat = -88; lat <= 88; lat += latitudeStep) {
    const cosLat = Math.max(0.18, Math.cos((lat * Math.PI) / 180));
    const longitudeStep = latitudeStep / cosLat;

    for (let lon = -180; lon < 180; lon += longitudeStep) {
      if (!isLand(lat, lon)) continue;
      const [x, y, z] = latLonToVector3(lat, lon, radius);
      positions.push(x, y, z);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.computeBoundingSphere();
  return geometry;
}

function targetRotationFor(lat: number, lon: number): Rotation {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lon + 180) * (Math.PI / 180);
  return {
    x: phi - Math.PI / 2,
    y: -theta - Math.PI / 2,
    z: 0,
  };
}

function distanceBetweenTouches(touches: readonly any[]) {
  if (touches.length < 2) return 0;
  const dx = touches[0].pageX - touches[1].pageX;
  const dy = touches[0].pageY - touches[1].pageY;
  return Math.sqrt(dx * dx + dy * dy);
}

function vector3ToLatLon(v: THREE.Vector3) {
  const n = v.clone().normalize();
  const lat = THREE.MathUtils.radToDeg(Math.asin(n.y));
  const lon = THREE.MathUtils.radToDeg(Math.atan2(n.z, -n.x)) - 180;
  const wrappedLon = ((lon + 540) % 360) - 180;
  return { lat, lon: wrappedLon };
}

function angularDistanceDeg(lat1: number, lon1: number, lat2: number, lon2: number) {
  const p1 = latLonToVector3(lat1, lon1, 1);
  const p2 = latLonToVector3(lat2, lon2, 1);
  const a = new THREE.Vector3(...p1).normalize();
  const b = new THREE.Vector3(...p2).normalize();
  return THREE.MathUtils.radToDeg(Math.acos(THREE.MathUtils.clamp(a.dot(b), -1, 1)));
}

// Marcadores de países via InstancedMesh batched com iluminação dinâmica
function InstancedCountryMarkers({ selectedCountry }: { selectedCountry: Country | null }) {
  const meshRef = useRef<THREE.InstancedMesh>(null!);
  const tempObject = useMemo(() => new THREE.Object3D(), []);
  const tempColor = useMemo(() => new THREE.Color(), []);

  const markerPositions = useMemo(() => {
    return COUNTRIES.map((c) => latLonToVector3(c.lat, c.lon, 2.038));
  }, []);

  useFrame(({ clock }) => {
    if (!meshRef.current) return;
    const time = clock.elapsedTime;

    COUNTRIES.forEach((c, idx) => {
      const [x, y, z] = markerPositions[idx];
      tempObject.position.set(x, y, z);

      const isSelected = selectedCountry?.id === c.id;
      const scale = isSelected ? 1.5 + Math.sin(time * 6) * 0.35 : 0.85;
      tempObject.scale.setScalar(scale);
      tempObject.updateMatrix();

      meshRef.current.setMatrixAt(idx, tempObject.matrix);

      if (isSelected) {
        tempColor.set("#FF2D55");
      } else {
        tempColor.set("#007AFF");
      }
      meshRef.current.setColorAt(idx, tempColor);
    });

    meshRef.current.instanceMatrix.needsUpdate = true;
    if (meshRef.current.instanceColor) {
      meshRef.current.instanceColor.needsUpdate = true;
    }
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, COUNTRIES.length]}>
      <sphereGeometry args={[0.038, 12, 12]} />
      <meshBasicMaterial transparent opacity={0.95} />
    </instancedMesh>
  );
}

interface EarthSceneProps {
  selectedCountry: Country | null;
  rotationRef: React.MutableRefObject<Rotation>;
  targetRef: React.MutableRefObject<Rotation | null>;
  interactingRef: React.MutableRefObject<boolean>;
  cameraZRef: React.MutableRefObject<number>;
}

function EarthScene({
  selectedCountry,
  rotationRef,
  targetRef,
  interactingRef,
  cameraZRef,
}: EarthSceneProps) {
  const globeRef = useRef<THREE.Group>(null!);
  const landGeometry = useMemo(() => buildLandParticleGeometry(2.006), []);
  const particleMap = useMemo(() => createCircularParticleTexture(), []);

  useFrame((state, delta) => {
    if (!globeRef.current) return;

    const target = targetRef.current;
    if (target) {
      rotationRef.current.x = THREE.MathUtils.damp(rotationRef.current.x, target.x, 5.4, delta);
      rotationRef.current.y = THREE.MathUtils.damp(rotationRef.current.y, target.y, 5.4, delta);
      rotationRef.current.z = THREE.MathUtils.damp(rotationRef.current.z, target.z, 5.4, delta);

      const error =
        Math.abs(rotationRef.current.x - target.x) +
        Math.abs(rotationRef.current.y - target.y);
      if (error < 0.004) targetRef.current = null;
    } else if (!interactingRef.current) {
      rotationRef.current.y += delta * 0.055;
    }

    globeRef.current.rotation.set(
      rotationRef.current.x,
      rotationRef.current.y,
      rotationRef.current.z
    );

    state.camera.position.z = THREE.MathUtils.damp(
      state.camera.position.z,
      cameraZRef.current,
      10,
      delta
    );
    state.camera.updateProjectionMatrix();
  });

  return (
    <group ref={globeRef}>
      <ambientLight intensity={1.1} />
      <directionalLight position={[5, 3, 5]} intensity={1.8} />

      {/* Esfera do Oceano */}
      <mesh>
        <sphereGeometry args={[1.988, 32, 32]} />
        <meshBasicMaterial color="#06080C" transparent opacity={0.94} />
      </mesh>

      {/* Halo Atmosférico de Brilho Fresnel em 3D */}
      <mesh>
        <sphereGeometry args={[2.025, 32, 32]} />
        <meshBasicMaterial color="#007AFF" transparent opacity={0.12} side={THREE.BackSide} />
      </mesh>

      {/* Partículas Círculares de Continentes (Alta Densidade) */}
      <points geometry={landGeometry} frustumCulled={false}>
        <pointsMaterial
          color="#FFFFFF"
          size={0.044}
          map={particleMap.image ? particleMap : undefined}
          sizeAttenuation
          transparent
          alphaTest={0.1}
          opacity={0.98}
        />
      </points>

      {/* Marcadores Batched Instanciados na GPU */}
      <InstancedCountryMarkers selectedCountry={selectedCountry} />
    </group>
  );
}

export interface GlobeFocusTarget {
  id: string;
  lat: number;
  lon: number;
}

interface Globe3DProps {
  selectedCountry: Country | null;
  onSelectCountry: (country: Country) => void;
  focusTarget?: GlobeFocusTarget | null;
}

export const Globe3D: React.FC<Globe3DProps> = React.memo(({
  selectedCountry,
  onSelectCountry,
  focusTarget,
}) => {
  const screenWidth = Dimensions.get("window").width;
  const globeSize = Math.min(screenWidth * 0.86, 360);
  const rotationRef = useRef<Rotation>({ x: 0.08, y: -0.25, z: 0 });
  const targetRef = useRef<Rotation | null>(null);
  const interactingRef = useRef(false);
  const cameraZRef = useRef(5.15);
  const gestureRef = useRef<GestureState>({
    startX: 0,
    startY: 0,
    lastX: 0,
    lastY: 0,
    moved: 0,
    pinchStartDistance: 0,
    pinchStartCameraZ: 5.15,
  });
  const [layoutSize, setLayoutSize] = useState({ width: globeSize, height: globeSize });

  React.useEffect(() => {
    if (!focusTarget) return;
    targetRef.current = targetRotationFor(focusTarget.lat, focusTarget.lon);
  }, [focusTarget?.id, focusTarget?.lat, focusTarget?.lon]);

  const selectCountryFromTap = (x: number, y: number) => {
    const width = layoutSize.width || globeSize;
    const height = layoutSize.height || globeSize;
    const ndc = new THREE.Vector2((x / width) * 2 - 1, -(y / height) * 2 + 1);
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.set(0, 0, cameraZRef.current);
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(ndc, camera);
    const hit = new THREE.Vector3();
    if (!raycaster.ray.intersectSphere(new THREE.Sphere(new THREE.Vector3(0, 0, 0), 2.08), hit)) {
      return;
    }

    const euler = new THREE.Euler(
      rotationRef.current.x,
      rotationRef.current.y,
      rotationRef.current.z,
      "XYZ"
    );
    const inverse = new THREE.Quaternion().setFromEuler(euler).invert();
    const localPoint = hit.clone().applyQuaternion(inverse);
    const geo = vector3ToLatLon(localPoint);

    let nearest: Country | null = null;
    let nearestDistance = Infinity;
    for (const country of COUNTRIES) {
      const d = angularDistanceDeg(geo.lat, geo.lon, country.lat, country.lon);
      if (d < nearestDistance) {
        nearest = country;
        nearestDistance = d;
      }
    }

    if (nearest && nearestDistance < 24) {
      onSelectCountry(nearest);
      targetRef.current = targetRotationFor(nearest.lat, nearest.lon);
    }
  };

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (evt) => {
          const touches = evt.nativeEvent.touches;
          interactingRef.current = true;
          targetRef.current = null;
          gestureRef.current.startX = evt.nativeEvent.locationX;
          gestureRef.current.startY = evt.nativeEvent.locationY;
          gestureRef.current.lastX = evt.nativeEvent.pageX;
          gestureRef.current.lastY = evt.nativeEvent.pageY;
          gestureRef.current.moved = 0;

          if (touches.length >= 2) {
            gestureRef.current.pinchStartDistance = distanceBetweenTouches(touches);
            gestureRef.current.pinchStartCameraZ = cameraZRef.current;
          }
        },
        onPanResponderMove: (evt) => {
          const touches = evt.nativeEvent.touches;

          if (touches.length >= 2) {
            const currentDistance = distanceBetweenTouches(touches);
            const startDistance = gestureRef.current.pinchStartDistance || currentDistance;
            if (startDistance > 0 && currentDistance > 0) {
              const nextZ =
                gestureRef.current.pinchStartCameraZ * (startDistance / currentDistance);
              cameraZRef.current = THREE.MathUtils.clamp(nextZ, 4.25, 6.05);
            }
            gestureRef.current.moved += 4;
            return;
          }

          const x = evt.nativeEvent.pageX;
          const y = evt.nativeEvent.pageY;
          const dx = x - gestureRef.current.lastX;
          const dy = y - gestureRef.current.lastY;
          gestureRef.current.lastX = x;
          gestureRef.current.lastY = y;
          gestureRef.current.moved += Math.abs(dx) + Math.abs(dy);

          rotationRef.current.y += dx * 0.0072;
          rotationRef.current.x += dy * 0.0058;
        },
        onPanResponderRelease: (evt) => {
          interactingRef.current = false;
          if (gestureRef.current.moved < 12) {
            selectCountryFromTap(evt.nativeEvent.locationX, evt.nativeEvent.locationY);
          }
        },
        onPanResponderTerminate: () => {
          interactingRef.current = false;
        },
      }),
    [layoutSize.width, layoutSize.height, onSelectCountry]
  );

  return (
    <View style={styles.container}>
      <View
        style={[styles.canvasContainer, { width: globeSize, height: globeSize }]}
        onLayout={(e) => setLayoutSize(e.nativeEvent.layout)}
        {...panResponder.panHandlers}
      >
        <Canvas
          camera={{ position: [0, 0, 5.15], fov: 45, near: 0.1, far: 100 }}
          style={{ width: "100%", height: "100%", backgroundColor: "transparent" }}
          gl={{ alpha: true, antialias: false, powerPreference: "high-performance" }}
          dpr={1}
        >
          <EarthScene
            selectedCountry={selectedCountry}
            rotationRef={rotationRef}
            targetRef={targetRef}
            interactingRef={interactingRef}
            cameraZRef={cameraZRef}
          />
        </Canvas>
      </View>

      {selectedCountry && (
        <View style={styles.countryBadgeContainer} pointerEvents="none">
          <Text style={styles.countryBadgeTitle}>{selectedCountry.name}</Text>
          <Text style={styles.countryBadgeSubtitle}>Explorar estilo →</Text>
        </View>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    marginVertical: 6,
  },
  canvasContainer: {
    overflow: "hidden",
    borderRadius: 999,
    backgroundColor: "transparent",
    alignSelf: "center",
  },
  countryBadgeContainer: {
    position: "absolute",
    bottom: 4,
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.88)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(0,0,0,0.08)",
  },
  countryBadgeTitle: {
    color: "#111111",
    fontSize: 14,
    fontWeight: "700",
  },
  countryBadgeSubtitle: {
    marginTop: 1,
    color: "#777777",
    fontSize: 10,
    fontWeight: "500",
  },
});
