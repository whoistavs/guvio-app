import * as THREE from "three";
import { latLonToVector3 } from "../../data/mockData";

import { rotationToFace } from "../../utils/globeMath";

// o ponto escolhido precisa ficar de frente para a câmera (+z)

describe("globo: virar para uma cidade", () => {
  const cities: [string, number, number][] = [
    ["Barcelos", 41.54, -8.62],
    ["Campinas", -22.9, -47.06],
    ["Tóquio", 35.68, 139.69],
    ["Nova York", 40.71, -74.0],
    ["Sydney", -33.87, 151.21]
  ];
  it.each(cities)("%s fica no centro da tela", (_name, lat, lon) => {
    const r = rotationToFace(lat, lon);
    const p = new THREE.Vector3(...latLonToVector3(lat, lon, 1));
    p.applyEuler(new THREE.Euler(r.x, r.y, 0, "XYZ"));
    expect(p.z).toBeGreaterThan(0.999);
  });
});
