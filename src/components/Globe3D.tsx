import React, { useEffect, useMemo, useRef, useState } from "react";
import { Dimensions, PanResponder, PixelRatio, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import * as THREE from "three";
import type {} from "@react-three/fiber";
import { latLonToVector3 } from "../data/mockData";
import { GLOBE_DOTS_B64, GLOBE_DOTS_COUNT } from "../data/globeDots";
import { useAppTheme } from "../context/AppTheme";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { ErrorBoundary } from "./ErrorBoundary";
import { rotationToFace as rotationToFaceBase } from "../utils/globeMath";

const Fiber = Platform.OS === "web" ? require("@react-three/fiber") : require("@react-three/fiber/native");
const Canvas = Fiber.Canvas as React.ComponentType<any>;
const rawUseFrame = Fiber.useFrame as (callback: (state: any, delta: number) => void) => void;
/** useFrame que nunca derruba o app: se der erro, o quadro é ignorado */
const useFrame = (cb: (state: any, delta: number) => void) =>
  rawUseFrame((state: any, delta: number) => {
    try {
      cb(state, delta);
    } catch (e) {}
  });

// Diagnóstico do desenho (temporário): mostrado em letras pequenas embaixo do globo
const DIAG = {
  created: false,
  frames: 0,
  calls: 0,
  points: 0,
  triangles: 0,
  buffer: "",
  glError: 0,
  lastError: "",
  version: "",
  sceneObjs: 0,
  camera: ""
};

// Proteção contra o app fechar ao desenhar o globo: se fechar com o globo aberto,
// na próxima vez usamos um modo mais simples (0 = completo, 1 = simples, 2 = desligado)
const GUARD_KEY = "guvio_globe_guard_v2";
const LEVEL_KEY = "guvio_globe_level_v2";

// ---------------------------------------------------------------------
// Tipos públicos
// ---------------------------------------------------------------------
export interface GlobeFocusTarget {
  id: string;
  lat: number;
  lon: number;
}

/** Um ponto no globo onde há looks publicados */
export interface GlobeMarker {
  id: string;
  lat: number;
  lon: number;
  city: string;
  country: string;
  count: number;
}

interface Globe3DProps {
  markers?: GlobeMarker[];
  origin?: { lat: number; lon: number } | null;
  selectedId?: string | null;
  onSelectMarker?: (m: GlobeMarker) => void;
  onClearSelection?: () => void;
  focusTarget?: GlobeFocusTarget | null;
  /** avisa quando o dedo está no globo (a tela de fora deve parar de rolar) */
  onInteractionChange?: (active: boolean) => void;
}

type Rotation = { x: number; y: number };

const R = 2;
const CAMERA_Z = 6.7;
const MIN_Z = 4.6;
const MAX_Z = 8.4;
const MAX_TILT = 1.15; // ~66°: não deixa virar de cabeça para baixo
const IDLE_SPIN = 0.06; // rad/s
const RESUME_SPIN_AFTER = 2.5; // s parado antes de voltar a girar sozinho

// ---------------------------------------------------------------------
// Pontos dos continentes (Natural Earth, gerados por scripts/build-globe-dots.mjs)
// ---------------------------------------------------------------------
const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

function decodeBase64(b64: string): Uint8Array {
  const clean = b64.replace(/=+$/, "");
  const out = new Uint8Array(Math.floor((clean.length * 3) / 4));
  let buffer = 0;
  let bits = 0;
  let j = 0;
  for (let i = 0; i < clean.length; i++) {
    buffer = (buffer << 6) | B64.indexOf(clean[i]);
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out[j++] = (buffer >> bits) & 0xff;
    }
  }
  return out;
}

let cachedDots: Float32Array | null = null;
function landDotPositions(): Float32Array {
  if (cachedDots) return cachedDots;
  const bytes = decodeBase64(GLOBE_DOTS_B64);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const pos = new Float32Array(GLOBE_DOTS_COUNT * 3);
  for (let i = 0; i < GLOBE_DOTS_COUNT; i++) {
    const lat = view.getInt16(i * 4, true) / 100;
    const lon = view.getInt16(i * 4 + 2, true) / 100;
    const [x, y, z] = latLonToVector3(lat, lon, R * 1.003);
    pos[i * 3] = x;
    pos[i * 3 + 1] = y;
    pos[i * 3 + 2] = z;
  }
  cachedDots = pos;
  return pos;
}

// ---------------------------------------------------------------------
// Matemática de rotação
// ---------------------------------------------------------------------
function rotationToFace(lat: number, lon: number): Rotation {
  // inclina só parte da latitude: o polo não "cai" para a frente e o ponto fica um pouco acima do centro
  return rotationToFaceBase(lat, lon, MAX_TILT, 0.62);
}

/** menor caminho angular (evita o globo dar uma volta inteira) */
function nearestAngle(from: number, to: number) {
  const twoPi = Math.PI * 2;
  let d = (to - from) % twoPi;
  if (d > Math.PI) d -= twoPi;
  if (d < -Math.PI) d += twoPi;
  return from + d;
}

function vector3ToLatLon(v: THREE.Vector3) {
  const n = v.clone().normalize();
  const lat = THREE.MathUtils.radToDeg(Math.asin(n.y));
  const lon = THREE.MathUtils.radToDeg(Math.atan2(n.z, -n.x)) - 180;
  return { lat, lon: ((lon + 540) % 360) - 180 };
}

function angularDistanceDeg(lat1: number, lon1: number, lat2: number, lon2: number) {
  const a = new THREE.Vector3(...latLonToVector3(lat1, lon1, 1));
  const b = new THREE.Vector3(...latLonToVector3(lat2, lon2, 1));
  return THREE.MathUtils.radToDeg(Math.acos(THREE.MathUtils.clamp(a.dot(b), -1, 1)));
}

function touchDistance(touches: readonly any[]) {
  if (touches.length < 2) return 0;
  const dx = touches[0].pageX - touches[1].pageX;
  const dy = touches[0].pageY - touches[1].pageY;
  return Math.sqrt(dx * dx + dy * dy);
}

// ---------------------------------------------------------------------
// Paletas
// ---------------------------------------------------------------------
function palette(dark: boolean) {
  return dark
    ? { ocean: "#0A0E16", dots: "#E9EDF5", glow: "#3D7BFF", marker: "#FF3B5C", me: "#34C759", arc: "#5B9BFF" }
    : { ocean: "#F3F5F8", dots: "#2A2F38", glow: "#8DB0FF", marker: "#FF2D55", me: "#1FAD4B", arc: "#2F6BFF" };
}

// ---------------------------------------------------------------------
// Camadas da cena
// ---------------------------------------------------------------------
function LandDots({ color, pixelRatio }: { color: string; pixelRatio: number }) {
  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(landDotPositions(), 3));
    g.computeBoundingSphere();
    return g;
  }, []);

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        uniforms: {
          uColor: { value: new THREE.Color(color) },
          uSize: { value: 2.3 * pixelRatio }
        },
        vertexShader: `
          uniform float uSize;
          varying float vFacing;
          void main() {
            vec4 mv = modelViewMatrix * vec4(position, 1.0);
            vec3 n = normalize(mat3(modelViewMatrix) * position);
            vFacing = n.z;
            // perto da borda os pontos encolhem, para não formar um contorno pesado
            gl_PointSize = uSize * (6.7 / -mv.z) * mix(0.35, 1.0, smoothstep(0.0, 0.55, n.z));
            gl_Position = projectionMatrix * mv;
          }
        `,
        fragmentShader: `
          uniform vec3 uColor;
          varying float vFacing;
          void main() {
            vec2 c = gl_PointCoord - vec2(0.5);
            float d = length(c);
            if (d > 0.5) discard;
            float edge = 1.0 - smoothstep(0.38, 0.5, d);
            // pontos na borda do globo ficam mais suaves (efeito de profundidade)
            float depth = smoothstep(0.06, 0.6, vFacing);
            gl_FragColor = vec4(uColor, edge * mix(0.05, 0.92, depth));
          }
        `
      }),
    []
  );

  useEffect(() => {
    material.uniforms.uColor.value.set(color);
    material.uniforms.uSize.value = 2.3 * pixelRatio;
  }, [color, pixelRatio]);

  return <points geometry={geometry} material={material} frustumCulled={false} />;
}

/** versão simples dos pontos (sem shader próprio), usada no modo seguro */
/** pontos dos continentes só com materiais padrão do three (modo compatível) */
function LandDotsLite({ color }: { color: string }) {
  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(landDotPositions(), 3));
    return g;
  }, []);
  const material = useMemo(() => {
    const m = new THREE.PointsMaterial({ size: 0.05, sizeAttenuation: true, transparent: true, depthWrite: false });
    // pontos redondos sem textura: descarta o que fica fora do círculo (funciona no iPhone e na web)
    m.onBeforeCompile = shader => {
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <clipping_planes_fragment>",
        `vec2 guvioCoord = gl_PointCoord - vec2(0.5);
        float guvioDist = length(guvioCoord);
        if (guvioDist > 0.5) discard;
        #include <clipping_planes_fragment>`
      );
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <premultiplied_alpha_fragment>",
        `gl_FragColor.a *= 1.0 - smoothstep(0.36, 0.5, guvioDist);
        #include <premultiplied_alpha_fragment>`
      );
    };
    m.customProgramCacheKey = () => "guvio-round-dots";
    return m;
  }, []);
  useEffect(() => {
    material.color.set(color);
  }, [color]);
  return <points geometry={geometry} material={material} frustumCulled={false} />;
}

/** brilho da atmosfera com esferas transparentes (modo compatível) */
function AtmosphereLite({ color }: { color: string }) {
  const layers = [
    { scale: 1.02, opacity: 0.32 },
    { scale: 1.05, opacity: 0.18 },
    { scale: 1.09, opacity: 0.09 },
    { scale: 1.14, opacity: 0.04 }
  ];
  return (
    <>
      {layers.map(l => (
        <mesh key={l.scale} scale={l.scale}>
          <sphereGeometry args={[R, 48, 48]} />
          <meshBasicMaterial color={color} transparent opacity={l.opacity} side={THREE.BackSide} depthWrite={false} />
        </mesh>
      ))}
    </>
  );
}

function Atmosphere({ color }: { color: string }) {
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        side: THREE.BackSide,
        uniforms: { uColor: { value: new THREE.Color(color) } },
        vertexShader: `
          varying vec3 vNormal;
          void main() {
            vNormal = normalize(normalMatrix * normal);
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: `
          uniform vec3 uColor;
          varying vec3 vNormal;
          void main() {
            float intensity = pow(0.62 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 3.0);
            gl_FragColor = vec4(uColor, clamp(intensity, 0.0, 1.0) * 0.9);
          }
        `
      }),
    []
  );
  useEffect(() => {
    material.uniforms.uColor.value.set(color);
  }, [color]);
  return (
    <mesh material={material} scale={1.16}>
      <sphereGeometry args={[R, 48, 48]} />
    </mesh>
  );
}

/** Pontos onde há looks: um disco que pulsa + halo; o selecionado fica maior */
const MAX_MARKERS = 512;

/**
 * Pontos onde há looks: um disco que pulsa + halo; o selecionado fica maior.
 * As malhas são criadas UMA vez com capacidade fixa (só muda o "count"):
 * recriar objetos 3D quando a quantidade muda quebrava o app no iPhone
 * ("Cannot delete property '__r3f' of undefined").
 */
function Markers({
  markers,
  selectedId,
  color
}: {
  markers: GlobeMarker[];
  selectedId?: string | null;
  color: string;
}) {
  const tmp = useMemo(() => new THREE.Object3D(), []);
  const { core, halo } = useMemo(() => {
    const haloMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.3, depthWrite: false, side: THREE.DoubleSide });
    const coreMat = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
    const h = new THREE.InstancedMesh(new THREE.CircleGeometry(0.045, 24), haloMat, MAX_MARKERS);
    const c = new THREE.InstancedMesh(new THREE.CircleGeometry(0.04, 24), coreMat, MAX_MARKERS);
    h.count = 0;
    c.count = 0;
    h.frustumCulled = false;
    c.frustumCulled = false;
    return { core: c, halo: h };
  }, []);

  useEffect(() => {
    (core.material as THREE.MeshBasicMaterial).color.set(color);
    (halo.material as THREE.MeshBasicMaterial).color.set(color);
  }, [color]);

  const placements = useMemo(
    () =>
      markers.slice(0, MAX_MARKERS).map(m => {
        const p = new THREE.Vector3(...latLonToVector3(m.lat, m.lon, R * 1.012));
        const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), p.clone().normalize());
        const weight = Math.min(1.6, 0.85 + Math.log10(1 + m.count) * 0.6);
        return { p, q, weight, id: m.id };
      }),
    [markers]
  );

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    placements.forEach((pl, i) => {
      const selected = pl.id === selectedId;
      tmp.position.copy(pl.p);
      tmp.quaternion.copy(pl.q);
      tmp.scale.setScalar(pl.weight * (selected ? 1.5 : 1));
      tmp.updateMatrix();
      core.setMatrixAt(i, tmp.matrix);

      const phase = (t * 0.9 + i * 0.37) % 1;
      tmp.scale.setScalar(pl.weight * (selected ? 1.6 : 1) * (1 + phase * 1.8));
      tmp.updateMatrix();
      halo.setMatrixAt(i, tmp.matrix);
    });
    core.count = placements.length;
    halo.count = placements.length;
    core.instanceMatrix.needsUpdate = true;
    halo.instanceMatrix.needsUpdate = true;
    (halo.material as THREE.MeshBasicMaterial).opacity = 0.35 * (1 - ((t * 0.9) % 1));
  });

  return (
    <>
      <primitive object={halo} />
      <primitive object={core} />
    </>
  );
}

/** Ponto verde da sua localização. Sempre montado (só fica invisível sem localização). */
function MyLocation({ origin, color }: { origin?: { lat: number; lon: number } | null; color: string }) {
  const ringRef = useRef<THREE.Mesh>(null!);
  const lat = origin?.lat ?? 0;
  const lon = origin?.lon ?? 0;
  const { p, q } = useMemo(() => {
    const p = new THREE.Vector3(...latLonToVector3(lat, lon, R * 1.013));
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), p.clone().normalize());
    return { p, q };
  }, [lat, lon]);

  useFrame(({ clock }) => {
    if (!ringRef.current) return;
    const phase = (clock.elapsedTime * 0.7) % 1;
    ringRef.current.scale.setScalar(1 + phase * 3);
    (ringRef.current.material as THREE.MeshBasicMaterial).opacity = 0.5 * (1 - phase);
  });

  return (
    <group position={p} quaternion={q} visible={!!origin}>
      <mesh>
        <circleGeometry args={[0.042, 24]} />
        <meshBasicMaterial color="#FFFFFF" side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0, 0, 0.001]}>
        <circleGeometry args={[0.03, 24]} />
        <meshBasicMaterial color={color} side={THREE.DoubleSide} />
      </mesh>
      <mesh ref={ringRef}>
        <ringGeometry args={[0.04, 0.05, 32]} />
        <meshBasicMaterial color={color} transparent opacity={0.5} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

/**
 * Linha animada da sua cidade até a cidade escolhida.
 * O objeto da linha é sempre o mesmo (só a geometria muda), pelo mesmo motivo dos marcadores.
 */
function Arc({
  from,
  to,
  color
}: {
  from?: { lat: number; lon: number } | null;
  to?: { lat: number; lon: number } | null;
  color: string;
}) {
  const line = useMemo(() => {
    const material = new THREE.LineDashedMaterial({ dashSize: 0.1, gapSize: 0.06, transparent: true, opacity: 0.95 });
    const l = new THREE.Line(new THREE.BufferGeometry(), material);
    l.visible = false;
    l.frustumCulled = false;
    return l;
  }, []);

  useEffect(() => {
    (line.material as THREE.LineDashedMaterial).color.set(color);
  }, [color]);

  useEffect(() => {
    if (!from || !to) {
      line.visible = false;
      return;
    }
    const start = new THREE.Vector3(...latLonToVector3(from.lat, from.lon, R * 1.01));
    const end = new THREE.Vector3(...latLonToVector3(to.lat, to.lon, R * 1.01));
    const dist = start.distanceTo(end);
    if (dist < 0.02) {
      line.visible = false;
      return;
    }
    const mid = start.clone().add(end).multiplyScalar(0.5);
    if (mid.length() < 0.01) mid.set(0, R, 0); // pontos opostos
    mid.normalize().multiplyScalar(R * 1.01 + Math.min(1.1, dist * 0.42));
    const curve = new THREE.QuadraticBezierCurve3(start, mid, end);
    const old = line.geometry;
    line.geometry = new THREE.BufferGeometry().setFromPoints(curve.getPoints(80));
    old.dispose();
    line.computeLineDistances();
    line.visible = true;
  }, [from?.lat, from?.lon, to?.lat, to?.lon]);

  useFrame(({ clock }) => {
    (line.material as any).dashOffset = -clock.elapsedTime * 0.9;
  });

  return <primitive object={line} />;
}

interface SceneProps {
  lite: boolean;
  dark: boolean;
  pixelRatio: number;
  markers: GlobeMarker[];
  selected: GlobeMarker | null;
  origin?: { lat: number; lon: number } | null;
  rotationRef: React.MutableRefObject<Rotation>;
  velocityRef: React.MutableRefObject<Rotation>;
  targetRef: React.MutableRefObject<Rotation | null>;
  interactingRef: React.MutableRefObject<boolean>;
  idleRef: React.MutableRefObject<number>;
  cameraZRef: React.MutableRefObject<number>;
}

function Scene({
  lite,
  dark,
  pixelRatio,
  markers,
  selected,
  origin,
  rotationRef,
  velocityRef,
  targetRef,
  interactingRef,
  idleRef,
  cameraZRef
}: SceneProps) {
  const groupRef = useRef<THREE.Group>(null!);
  const colors = palette(dark);

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.05);
    const rot = rotationRef.current;
    const target = targetRef.current;

    if (target) {
      // viagem suave até o ponto escolhido
      rot.x = THREE.MathUtils.damp(rot.x, target.x, 4.5, dt);
      rot.y = THREE.MathUtils.damp(rot.y, target.y, 4.5, dt);
      if (Math.abs(rot.x - target.x) + Math.abs(rot.y - target.y) < 0.002) targetRef.current = null;
      velocityRef.current = { x: 0, y: 0 };
    } else if (!interactingRef.current) {
      // embalo depois de soltar o dedo
      const v = velocityRef.current;
      rot.x += v.x * dt;
      rot.y += v.y * dt;
      const friction = Math.exp(-4.2 * dt);
      v.x *= friction;
      v.y *= friction;
      idleRef.current += dt;
      // volta a girar sozinho quando ficar parado
      if (idleRef.current > RESUME_SPIN_AFTER && !selected) {
        const ramp = Math.min(1, (idleRef.current - RESUME_SPIN_AFTER) / 1.5);
        rot.y += IDLE_SPIN * ramp * dt;
      }
    }

    rot.x = THREE.MathUtils.clamp(rot.x, -MAX_TILT, MAX_TILT);
    groupRef.current?.rotation.set(rot.x, rot.y, 0);

    state.camera.position.z = THREE.MathUtils.damp(state.camera.position.z, cameraZRef.current, 8, dt);
    state.camera.updateProjectionMatrix();
  });

  return (
    <>
      {lite ? <AtmosphereLite color={colors.glow} /> : <Atmosphere color={colors.glow} />}
      <group ref={groupRef}>
        <mesh>
          <sphereGeometry args={[R * 0.995, 64, 64]} />
          <meshBasicMaterial color={colors.ocean} />
        </mesh>
        {lite ? <LandDotsLite color={colors.dots} /> : <LandDots color={colors.dots} pixelRatio={pixelRatio} />}
        <Markers markers={markers} selectedId={selected?.id} color={colors.marker} />
        <MyLocation origin={origin} color={colors.me} />
        <Arc from={origin} to={selected} color={colors.arc} />
      </group>
    </>
  );
}

// ---------------------------------------------------------------------
// Componente
// ---------------------------------------------------------------------
export const Globe3D: React.FC<Globe3DProps> = React.memo(
  ({ markers = [], origin, selectedId, onSelectMarker, onClearSelection, focusTarget, onInteractionChange }) => {
    // guarda a função mais recente sem recriar o PanResponder
    const interactionCb = useRef(onInteractionChange);
    interactionCb.current = onInteractionChange;
    const setTouching = (active: boolean) => interactionCb.current?.(active);
    const { dark } = useAppTheme();
    const screenWidth = Dimensions.get("window").width;
    const size = Math.min(screenWidth * 0.9, 380);
    const pixelRatio = Math.min(PixelRatio.get(), 2);
    const [level, setLevel] = useState<number | null>(null);

    // decide o modo do globo (e arma a proteção) antes de desenhar
    useEffect(() => {
      let cleared: ReturnType<typeof setTimeout> | undefined;
      (async () => {
        try {
          const [guard, saved] = await Promise.all([AsyncStorage.getItem(GUARD_KEY), AsyncStorage.getItem(LEVEL_KEY)]);
          let lvl = Number(saved || 0) || 0;
          // no iPhone/Android o modo completo (shaders próprios) não desenha no expo-gl:
          // começa direto no modo compatível, que só usa materiais padrão
          if (Platform.OS !== "web") lvl = Math.max(lvl, 1);
          if (guard === "1") {
            lvl = Math.min(2, lvl + 1); // fechou da última vez: usa um modo mais simples
            await AsyncStorage.setItem(LEVEL_KEY, String(lvl));
          }
          if (lvl < 2) await AsyncStorage.setItem(GUARD_KEY, "1");
          setLevel(lvl);
          // passou alguns segundos desenhando sem fechar: está seguro
          cleared = setTimeout(() => AsyncStorage.removeItem(GUARD_KEY).catch(() => {}), 6000);
        } catch (e) {
          setLevel(1);
        }
      })();
      return () => {
        if (cleared) clearTimeout(cleared);
        AsyncStorage.removeItem(GUARD_KEY).catch(() => {});
      };
    }, []);

    const disableGlobe = (err?: Error) => {
      AsyncStorage.setItem(LEVEL_KEY, "2").catch(() => {});
      AsyncStorage.removeItem(GUARD_KEY).catch(() => {});
      setGlobeError(err?.message || "erro gráfico");
      setLevel(2);
    };
    const [globeError, setGlobeError] = useState<string | null>(null);
    const [diag, setDiag] = useState<string | null>(null);
    const failedRef = useRef(false);

    /** algo falhou ao desenhar: tenta o modo compatível; se já estava nele, desliga e mostra o motivo */
    const reportRenderProblem = (msg: string) => {
      if (failedRef.current) return;
      failedRef.current = true;
      setDiag(msg.slice(0, 240));
      setLevel(prev => {
        const next = (prev ?? 0) >= 1 ? 2 : 1;
        AsyncStorage.setItem(LEVEL_KEY, String(next)).catch(() => {});
        if (next === 2) setGlobeError(msg.slice(0, 240));
        return next;
      });
      // libera uma nova tentativa no modo seguinte
      setTimeout(() => (failedRef.current = false), 500);
    };

    const onCreated = (state: any) => {
      try {
        const gl = state.gl;
        const ctx = gl.getContext?.();
        DIAG.created = true;
        DIAG.frames = 0;
        DIAG.lastError = "";
        try {
          DIAG.buffer = `${ctx?.drawingBufferWidth}x${ctx?.drawingBufferHeight}`;
          DIAG.version = String(ctx?.getParameter?.(ctx.VERSION) || "").slice(0, 40);
        } catch (e) {}
        const render = gl.render.bind(gl);
        gl.render = (scene: any, camera: any) => {
          try {
            render(scene, camera);
            DIAG.frames += 1;
            if (DIAG.frames % 60 === 1) {
              let n = 0;
              scene?.traverse?.(() => n++);
              DIAG.sceneObjs = n;
              DIAG.camera = `${camera?.type || "?"}${camera?.isCamera ? "" : "!"} z${Number(camera?.position?.z).toFixed(1)}`;
            }
            DIAG.calls = gl.info?.render?.calls ?? 0;
            DIAG.points = gl.info?.render?.points ?? 0;
            DIAG.triangles = gl.info?.render?.triangles ?? 0;
            if (DIAG.frames % 30 === 1) {
              const err = ctx?.getError?.();
              if (err) DIAG.glError = err;
            }
          } catch (e: any) {
            DIAG.lastError = String(e?.message || e).slice(0, 160);
            reportRenderProblem(`render: ${e?.message || e}`);
            try {
              ctx?.endFrameEXP?.();
            } catch (err) {}
          }
        };
      } catch (e: any) {
        DIAG.lastError = `onCreated: ${e?.message || e}`;
      }
    };


    const startRot = origin ? rotationToFace(origin.lat, origin.lon) : { x: 0.35, y: -0.6 };
    const rotationRef = useRef<Rotation>(startRot);
    const velocityRef = useRef<Rotation>({ x: 0, y: 0 });
    const targetRef = useRef<Rotation | null>(null);
    const interactingRef = useRef(false);
    const idleRef = useRef(0);
    const cameraZRef = useRef(CAMERA_Z);
    const gesture = useRef({ lastX: 0, lastY: 0, lastT: 0, moved: 0, pinchStart: 0, pinchZ: CAMERA_Z, startX: 0, startY: 0 });
    const [layout, setLayout] = useState({ width: size, height: size });

    const selected = useMemo(() => markers.find(m => m.id === selectedId) || null, [markers, selectedId]);

    const flyTo = (lat: number, lon: number) => {
      const t = rotationToFace(lat, lon);
      targetRef.current = { x: t.x, y: nearestAngle(rotationRef.current.y, t.y) };
      idleRef.current = 0;
    };

    // primeira localização conhecida: vira o globo para a cidade do usuário
    const centeredOnOrigin = useRef(false);
    useEffect(() => {
      if (origin && !centeredOnOrigin.current && !focusTarget) {
        centeredOnOrigin.current = true;
        flyTo(origin.lat, origin.lon);
      }
    }, [origin?.lat, origin?.lon]);

    useEffect(() => {
      if (focusTarget) flyTo(focusTarget.lat, focusTarget.lon);
    }, [focusTarget?.id]);

    const pickAt = (x: number, y: number) => {
      const w = layout.width || size;
      const h = layout.height || size;
      const camera = new THREE.PerspectiveCamera(42, w / h, 0.1, 100);
      camera.position.set(0, 0, cameraZRef.current);
      camera.lookAt(0, 0, 0);
      camera.updateMatrixWorld();
      camera.updateProjectionMatrix();
      const ray = new THREE.Raycaster();
      ray.setFromCamera(new THREE.Vector2((x / w) * 2 - 1, -(y / h) * 2 + 1), camera);
      const hit = new THREE.Vector3();
      if (!ray.ray.intersectSphere(new THREE.Sphere(new THREE.Vector3(), R), hit)) {
        if (selected) onClearSelection?.();
        return;
      }
      const inv = new THREE.Quaternion()
        .setFromEuler(new THREE.Euler(rotationRef.current.x, rotationRef.current.y, 0, "XYZ"))
        .invert();
      const geo = vector3ToLatLon(hit.applyQuaternion(inv));

      // tolerância cresce quando o globo está mais longe (zoom out)
      const tolerance = 4 + (cameraZRef.current - MIN_Z) * 1.4;
      let best: GlobeMarker | null = null;
      let bestD = Infinity;
      for (const m of markers) {
        const d = angularDistanceDeg(geo.lat, geo.lon, m.lat, m.lon);
        if (d < bestD) {
          bestD = d;
          best = m;
        }
      }
      if (best && bestD < tolerance) {
        onSelectMarker?.(best);
        flyTo(best.lat, best.lon);
      } else if (selected) {
        onClearSelection?.();
      }
    };

    const pan = useMemo(
      () =>
        PanResponder.create({
          onStartShouldSetPanResponder: () => true,
          onMoveShouldSetPanResponder: () => true,
          // o globo pega o gesto antes da tela que rola
          onStartShouldSetPanResponderCapture: () => true,
          onMoveShouldSetPanResponderCapture: () => true,
          onPanResponderTerminationRequest: () => false,
          onPanResponderGrant: e => {
            setTouching(true);
            const g = gesture.current;
            interactingRef.current = true;
            targetRef.current = null;
            velocityRef.current = { x: 0, y: 0 };
            idleRef.current = 0;
            g.lastX = e.nativeEvent.pageX;
            g.lastY = e.nativeEvent.pageY;
            g.startX = e.nativeEvent.locationX;
            g.startY = e.nativeEvent.locationY;
            g.lastT = Date.now();
            g.moved = 0;
            g.pinchStart = 0;
          },
          onPanResponderMove: e => {
            const g = gesture.current;
            const touches = e.nativeEvent.touches;
            if (touches.length >= 2) {
              const d = touchDistance(touches);
              if (!g.pinchStart) {
                g.pinchStart = d;
                g.pinchZ = cameraZRef.current;
              }
              if (d > 0) cameraZRef.current = THREE.MathUtils.clamp(g.pinchZ * (g.pinchStart / d), MIN_Z, MAX_Z);
              g.moved += 10;
              return;
            }
            const now = Date.now();
            const x = e.nativeEvent.pageX;
            const y = e.nativeEvent.pageY;
            const dx = x - g.lastX;
            const dy = y - g.lastY;
            const dt = Math.max(1, now - g.lastT) / 1000;
            g.lastX = x;
            g.lastY = y;
            g.lastT = now;
            g.moved += Math.abs(dx) + Math.abs(dy);

            // girar mais devagar quando está com zoom
            const k = 0.0062 * (cameraZRef.current / CAMERA_Z);
            rotationRef.current.y += dx * k;
            rotationRef.current.x = THREE.MathUtils.clamp(rotationRef.current.x + dy * k, -MAX_TILT, MAX_TILT);
            // velocidade suavizada para o embalo
            const v = velocityRef.current;
            v.y = v.y * 0.6 + ((dx * k) / dt) * 0.4;
            v.x = v.x * 0.6 + ((dy * k) / dt) * 0.4;
          },
          onPanResponderRelease: () => {
            setTouching(false);
            const g = gesture.current;
            interactingRef.current = false;
            idleRef.current = 0;
            if (Date.now() - g.lastT > 80) velocityRef.current = { x: 0, y: 0 }; // parou antes de soltar
            const v = velocityRef.current;
            v.x = THREE.MathUtils.clamp(v.x, -2, 2);
            v.y = THREE.MathUtils.clamp(v.y, -3.5, 3.5);
            if (g.moved < 10) pickAt(g.startX, g.startY);
          },
          onPanResponderTerminate: () => {
            setTouching(false);
            interactingRef.current = false;
          }
        }),
      [layout.width, layout.height, markers, selected, onSelectMarker, onClearSelection]
    );

    const colors = palette(dark);

    return (
      <View style={styles.container}>
        <View
          style={{ width: size, height: size }}
          onLayout={e => setLayout(e.nativeEvent.layout)}
          {...pan.panHandlers}
          // trava a rolagem da tela no instante em que o dedo encosta (antes do iOS começar a rolar)
          onTouchStart={() => setTouching(true)}
          onTouchEnd={() => setTouching(false)}
          onTouchCancel={() => setTouching(false)}
        >
          {level === null ? null : level >= 2 ? (
            <Pressable
              style={styles.off}
              onLongPress={() => {
                // segurar reativa o globo completo
                AsyncStorage.multiRemove([LEVEL_KEY, GUARD_KEY]).catch(() => {});
                setGlobeError(null);
                setLevel(0);
              }}
            >
              <Text style={[styles.offText, { color: dark ? "#8E8E93" : "#8A8A8E" }]}>
                🌍 Globo em modo de segurança
              </Text>
              {globeError ? (
                <Text style={[styles.offSub, { color: dark ? "#6C6C70" : "#A0A0A5" }]} numberOfLines={3}>
                  {globeError}
                </Text>
              ) : null}
              <Text style={[styles.offSub, { color: dark ? "#6C6C70" : "#A0A0A5" }]}>Segure aqui para tentar de novo</Text>
            </Pressable>
          ) : (
            <ErrorBoundary fallback={() => null} onError={disableGlobe}>
                        <Canvas
                          key={`globe-${level}`}
                          onCreated={onCreated}
                          pointerEvents="none"
              camera={{ position: [0, 0, CAMERA_Z], fov: 42, near: 0.1, far: 100 }}
              style={{ width: "100%", height: "100%", backgroundColor: "transparent" }}
              gl={{ alpha: true, antialias: false, powerPreference: "default" }}
              dpr={level === 0 ? pixelRatio : 1}
            >
              <Scene
                lite={level !== 0}
                dark={dark}
                pixelRatio={pixelRatio}
                markers={markers}
                selected={selected}
                origin={origin}
                rotationRef={rotationRef}
                velocityRef={velocityRef}
                targetRef={targetRef}
                interactingRef={interactingRef}
                idleRef={idleRef}
                cameraZRef={cameraZRef}
              />
            </Canvas>
            </ErrorBoundary>
          )}
        </View>

        {selected ? (
          <Pressable
            onPress={onClearSelection}
            style={[
              styles.badge,
              { backgroundColor: dark ? "rgba(28,28,32,0.92)" : "rgba(255,255,255,0.94)", borderColor: dark ? "#2C2C30" : "#E5E5EA" }
            ]}
          >
            <View style={[styles.badgeDot, { backgroundColor: colors.marker }]} />
            <View>
              <Text style={[styles.badgeTitle, { color: dark ? "#FFF" : "#111" }]}>
                {selected.city}
                {selected.country ? `, ${selected.country}` : ""}
              </Text>
              <Text style={[styles.badgeSub, { color: dark ? "#9A9AA0" : "#6B6B70" }]}>
                {selected.count} {selected.count === 1 ? "look" : "looks"} · toque para limpar
              </Text>
            </View>
          </Pressable>
        ) : markers.length > 0 ? (
          <Text style={[styles.hint, { color: dark ? "#8E8E93" : "#8A8A8E" }]}>
            Toque num ponto para ver os looks da cidade
          </Text>
        ) : null}
        {diag && level === 1 ? (
          // diagnóstico temporário: mostra por que saiu do modo completo
          <Text style={[styles.diag, { color: dark ? "#5A5A60" : "#B0B0B5" }]} numberOfLines={2}>
            modo compatível · {diag}
          </Text>
        ) : null}
      </View>
    );
  }
);

const styles = StyleSheet.create({
  container: { width: "100%", alignItems: "center", justifyContent: "center", marginVertical: 6 },
  badge: {
    position: "absolute",
    bottom: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth
  },
  badgeDot: { width: 8, height: 8, borderRadius: 4 },
  badgeTitle: { fontSize: 14, fontWeight: "800" },
  badgeSub: { fontSize: 10, fontWeight: "600", marginTop: 1 },
  hint: { position: "absolute", bottom: 4, fontSize: 11, fontWeight: "600" },
  diagBottom: { fontSize: 9, textAlign: "center", paddingHorizontal: 16, marginTop: 4 },
  diag: { position: "absolute", top: 0, fontSize: 9, textAlign: "center", paddingHorizontal: 20 },
  off: { flex: 1, alignItems: "center", justifyContent: "center", gap: 6, padding: 24 },
  offText: { fontSize: 14, fontWeight: "800" },
  offSub: { fontSize: 11, textAlign: "center" }
});
