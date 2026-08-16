import * as THREE from 'three';

export function getOctGeo() {
  const octRadius = 1.125;
  const detail = 0;
  const baseGeo = new THREE.OctahedronGeometry(octRadius, detail);
  
  const octNormals = [
     new THREE.Vector3(1, 1, 1).normalize(),
     new THREE.Vector3(1, -1, 1).normalize(),
     new THREE.Vector3(1, -1, -1).normalize(),
     new THREE.Vector3(1, 1, -1).normalize(),
     new THREE.Vector3(-1, 1, -1).normalize(),
     new THREE.Vector3(-1, -1, -1).normalize(),
     new THREE.Vector3(-1, -1, 1).normalize(),
     new THREE.Vector3(-1, 1, 1).normalize()
  ];

  const nonIndexed = baseGeo.toNonIndexed();
  const posArray = nonIndexed.attributes.position.array;
  const finalUv = new Float32Array((posArray.length / 3) * 2);
  
  const buckets = Array.from({length: 8}, () => ({ pos: [], uv: [] }));
  const triangleCount = posArray.length / 9;
  
  for (let i = 0; i < triangleCount; i++) {
    const v0 = new THREE.Vector3(posArray[i*9+0], posArray[i*9+1], posArray[i*9+2]);
    const v1 = new THREE.Vector3(posArray[i*9+3], posArray[i*9+4], posArray[i*9+5]);
    const v2 = new THREE.Vector3(posArray[i*9+6], posArray[i*9+7], posArray[i*9+8]);
    
    const center = new THREE.Vector3().add(v0).add(v1).add(v2).divideScalar(3).normalize();
    
    let bestMatch = 0;
    let maxDot = -Infinity;
    for (let j = 0; j < 8; j++) {
       const d = center.dot(octNormals[j]);
       if (d > maxDot) {
         maxDot = d;
         bestMatch = j;
       }
    }
    
    const normal = octNormals[bestMatch];
    const up = new THREE.Vector3(0, 1, 0);
    if (Math.abs(normal.y) > 0.9) up.set(1, 0, 0);
    const right = new THREE.Vector3().crossVectors(up, normal).normalize();
    const localUpVec = new THREE.Vector3().crossVectors(normal, right).normalize();
    
    for(let vIdx of [v0, v1, v2]) {
       const projX = vIdx.dot(right);
       const projY = vIdx.dot(localUpVec);
       const u = 0.5 + projX * 0.55;
       const v = 0.5 + projY * 0.55;
       buckets[bestMatch].uv.push(u, v);
    }
    for (let k = 0; k < 9; k++) buckets[bestMatch].pos.push(posArray[i*9+k]);
  }
  
  const finalPos = new Float32Array(posArray.length);
  const finalUvArr = new Float32Array(finalUv.length);
  
  nonIndexed.clearGroups();
  let offset = 0;
  for (let i = 0; i < 8; i++) {
    const pBucket = buckets[i].pos;
    const uBucket = buckets[i].uv;
    finalPos.set(pBucket, offset * 3);
    finalUvArr.set(uBucket, offset * 2);
    const count = pBucket.length / 3;
    nonIndexed.addGroup(offset, count, i);
    offset += count;
  }
  
  nonIndexed.setAttribute('position', new THREE.BufferAttribute(finalPos, 3));
  nonIndexed.setAttribute('uv', new THREE.BufferAttribute(finalUvArr, 2));
  nonIndexed.computeVertexNormals();
  return nonIndexed;
}

export function getSmoothBeveledOctGeo() {
  const R = 0.90; // inner octahedron radius
  const r = 0.22; // bevel radius
  const segments = 6; // number of subdivisions for the bevel
  
  const pos = [];
  const uv = [];
  
  function addTri(v0, v1, v2, u0, u1, u2) {
      const p0 = new THREE.Vector3().fromArray(v0);
      const p1 = new THREE.Vector3().fromArray(v1);
      const p2 = new THREE.Vector3().fromArray(v2);
      const center = new THREE.Vector3().add(p0).add(p1).add(p2).divideScalar(3);
      const normal = new THREE.Vector3().subVectors(p1, p0).cross(new THREE.Vector3().subVectors(p2, p0));
      
      if (normal.dot(center) < 0) {
        pos.push(v0[0], v0[1], v0[2], v2[0], v2[1], v2[2], v1[0], v1[1], v1[2]);
        uv.push(u0[0], u0[1], u2[0], u2[1], u1[0], u1[1]);
      } else {
        pos.push(v0[0], v0[1], v0[2], v1[0], v1[1], v1[2], v2[0], v2[1], v2[2]);
        uv.push(u0[0], u0[1], u1[0], u1[1], u2[0], u2[1]);
      }
  }
  
  function addQuad(v0, v1, v2, v3, u0, u1, u2, u3) {
      addTri(v0, v1, v2, u0, u1, u2);
      addTri(v0, v2, v3, u0, u2, u3);
  }
  
  const dirs = [
     [1, 1, 1], [1, -1, 1], [1, -1, -1], [1, 1, -1],
     [-1, 1, -1], [-1, -1, -1], [-1, -1, 1], [-1, 1, 1]
  ];
  
  const octNormals = dirs.map(d => new THREE.Vector3(d[0], d[1], d[2]).normalize());
  const groups = Array.from({length: 8}, () => ({ start: 0, count: 0 }));
  const bevelGroup = { start: 0, count: 0 };
  
  let offset = 0;
  const buv = [0.05, 0.05];
  
  for (let i = 0; i < 8; i++) {
     const dir = dirs[i];
     const N = octNormals[i];
     
     // 숫자 방향이 Z축 꼭짓점을 향하도록 localUp 설정
     const upDir = new THREE.Vector3(-dir[0] * R / 3, -dir[1] * R / 3, 2 * dir[2] * R / 3);
     const localUp = upDir.clone().normalize();
     const right = new THREE.Vector3().crossVectors(localUp, N).normalize();
     
     function getUV(v) {
         const vec = new THREE.Vector3().fromArray(v);
         const projX = vec.dot(right);
         const projY = vec.dot(localUp);
         return [0.5 + projX * 0.75, 0.5 + projY * 0.75];
     }
     
     const vX = new THREE.Vector3(dir[0]*R, 0, 0).add(N.clone().multiplyScalar(r)).toArray();
     const vY = new THREE.Vector3(0, dir[1]*R, 0).add(N.clone().multiplyScalar(r)).toArray();
     const vZ = new THREE.Vector3(0, 0, dir[2]*R).add(N.clone().multiplyScalar(r)).toArray();
     
     groups[i].start = offset;
     addTri(vX, vY, vZ, getUV(vX), getUV(vY), getUV(vZ));
     offset += 3;
     groups[i].count = 3;
  }
  
  bevelGroup.start = offset;
  
  const edgeAxes = [
      { a: [R,0,0], b: [0,R,0], d1: [1,1,1], d2: [1,1,-1] },
      { a: [R,0,0], b: [0,-R,0], d1: [1,-1,1], d2: [1,-1,-1] },
      { a: [-R,0,0], b: [0,R,0], d1: [-1,1,1], d2: [-1,1,-1] },
      { a: [-R,0,0], b: [0,-R,0], d1: [-1,-1,1], d2: [-1,-1,-1] },
      
      { a: [R,0,0], b: [0,0,R], d1: [1,1,1], d2: [1,-1,1] },
      { a: [R,0,0], b: [0,0,-R], d1: [1,1,-1], d2: [1,-1,-1] },
      { a: [-R,0,0], b: [0,0,R], d1: [-1,1,1], d2: [-1,-1,1] },
      { a: [-R,0,0], b: [0,0,-R], d1: [-1,1,-1], d2: [-1,-1,-1] },
      
      { a: [0,R,0], b: [0,0,R], d1: [1,1,1], d2: [-1,1,1] },
      { a: [0,R,0], b: [0,0,-R], d1: [1,1,-1], d2: [-1,1,-1] },
      { a: [0,-R,0], b: [0,0,R], d1: [1,-1,1], d2: [-1,-1,1] },
      { a: [0,-R,0], b: [0,0,-R], d1: [1,-1,-1], d2: [-1,-1,-1] },
  ];
  
  for (let e of edgeAxes) {
      const N1 = new THREE.Vector3(...e.d1).normalize();
      const N2 = new THREE.Vector3(...e.d2).normalize();
      const vA = new THREE.Vector3(...e.a);
      const vB = new THREE.Vector3(...e.b);
      
      for (let s = 0; s < segments; s++) {
          const t1 = s / segments;
          const t2 = (s + 1) / segments;
          
          const nA = N1.clone().lerp(N2, t1).normalize();
          const nB = N1.clone().lerp(N2, t2).normalize();
          
          const pA1 = vA.clone().add(nA.clone().multiplyScalar(r)).toArray();
          const pB1 = vB.clone().add(nA.clone().multiplyScalar(r)).toArray();
          const pA2 = vA.clone().add(nB.clone().multiplyScalar(r)).toArray();
          const pB2 = vB.clone().add(nB.clone().multiplyScalar(r)).toArray();
          
          addQuad(pA1, pB1, pB2, pA2, buv, buv, buv, buv);
          offset += 6;
      }
  }
  
  const cornerAxes = [
      { v: [R,0,0], xIdx: 1, yIdx: 2 },  // +X
      { v: [-R,0,0], xIdx: 1, yIdx: 2 }, // -X
      { v: [0,R,0], xIdx: 0, yIdx: 2 },  // +Y
      { v: [0,-R,0], xIdx: 0, yIdx: 2 }, // -Y
      { v: [0,0,R], xIdx: 0, yIdx: 1 },  // +Z
      { v: [0,0,-R], xIdx: 0, yIdx: 1 }, // -Z
  ];
  
  for (let c of cornerAxes) {
      const baseV = new THREE.Vector3(...c.v);
      const signX = c.v[0] !== 0 ? Math.sign(c.v[0]) : 1;
      const signY = c.v[1] !== 0 ? Math.sign(c.v[1]) : 1;
      const signZ = c.v[2] !== 0 ? Math.sign(c.v[2]) : 1;
      
      for (let i = 0; i < segments; i++) {
          for (let j = 0; j < segments; j++) {
              const u1 = -1 + 2 * (i / segments);
              const u2 = -1 + 2 * ((i + 1) / segments);
              const v1 = -1 + 2 * (j / segments);
              const v2 = -1 + 2 * ((j + 1) / segments);
              
              function getNormal(u, v) {
                  const d = [0, 0, 0];
                  if (c.v[0] !== 0) { d[0] = signX; d[1] = u; d[2] = v; }
                  else if (c.v[1] !== 0) { d[0] = u; d[1] = signY; d[2] = v; }
                  else { d[0] = u; d[1] = v; d[2] = signZ; }
                  return new THREE.Vector3(...d).normalize();
              }
              
              const n00 = getNormal(u1, v1);
              const n10 = getNormal(u2, v1);
              const n01 = getNormal(u1, v2);
              const n11 = getNormal(u2, v2);
              
              const p00 = baseV.clone().add(n00.multiplyScalar(r)).toArray();
              const p10 = baseV.clone().add(n10.multiplyScalar(r)).toArray();
              const p01 = baseV.clone().add(n01.multiplyScalar(r)).toArray();
              const p11 = baseV.clone().add(n11.multiplyScalar(r)).toArray();
              
              addQuad(p00, p10, p11, p01, buv, buv, buv, buv);
              offset += 6;
          }
      }
  }
  
  bevelGroup.count = offset - bevelGroup.start;
  
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pos), 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(uv), 2));
  geo.computeVertexNormals();
  
  for(let i=0; i<8; i++) geo.addGroup(groups[i].start, groups[i].count, i);
  geo.addGroup(bevelGroup.start, bevelGroup.count, 0);
  
  return geo;
}
