import * as THREE from "three";

/**
 * Rotação (Euler XYZ do grupo do globo) que traz o ponto lat/lon para o centro da tela (+z).
 * Com latLonToVector3: girar em Y por (π/2 − θ) leva o meridiano para a frente,
 * e girar em X pela latitude sobe/desce o ponto até o centro.
 */
export function rotationToFace(lat: number, lon: number, maxTilt = Math.PI / 2, tiltFactor = 1) {
  const theta = (lon + 180) * (Math.PI / 180);
  return {
    x: THREE.MathUtils.clamp(THREE.MathUtils.degToRad(lat) * tiltFactor, -maxTilt, maxTilt),
    y: Math.PI / 2 - theta
  };
}
