import * as THREE from 'three';

const DEFAULT_TOLERANCE = 1e-4;

function vertexIndex(geometry, triangleIndex, corner) {
  const index = geometry.getIndex();
  const offset = triangleIndex * 3 + corner;
  return index ? index.getX(offset) : offset;
}

function vertexAt(geometry, triangleIndex, corner, target = new THREE.Vector3()) {
  return target.fromBufferAttribute(
    geometry.getAttribute('position'),
    vertexIndex(geometry, triangleIndex, corner),
  );
}

function triangleNormal(geometry, triangleIndex, target = new THREE.Vector3()) {
  const a = vertexAt(geometry, triangleIndex, 0, new THREE.Vector3());
  const b = vertexAt(geometry, triangleIndex, 1, new THREE.Vector3());
  const c = vertexAt(geometry, triangleIndex, 2, new THREE.Vector3());
  return target.subVectors(b, a).cross(new THREE.Vector3().subVectors(c, a)).normalize();
}

export function triangleCount(geometry) {
  const position = geometry.getAttribute('position');
  if (!position) return 0;
  return (geometry.getIndex()?.count ?? position.count) / 3;
}

function pointKey(point, tolerance = DEFAULT_TOLERANCE) {
  return [
    Math.round(point.x / tolerance),
    Math.round(point.y / tolerance),
    Math.round(point.z / tolerance),
  ].join(':');
}

function triangleKeys(geometry, triangleIndex, tolerance) {
  return [0, 1, 2].map((corner) =>
    pointKey(vertexAt(geometry, triangleIndex, corner, new THREE.Vector3()), tolerance),
  );
}

export function findCoplanarRegion(
  geometry,
  seedTriangle,
  normalTolerance = 0.995,
  distanceTolerance = DEFAULT_TOLERANCE,
) {
  const position = geometry.getAttribute('position');
  const triangleCount = (geometry.getIndex()?.count ?? position.count) / 3;
  const seedNormal = triangleNormal(geometry, seedTriangle);
  const seedPoint = vertexAt(geometry, seedTriangle, 0);
  const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(seedNormal, seedPoint);
  const candidates = new Map();

  for (let triangle = 0; triangle < triangleCount; triangle += 1) {
    const normal = triangleNormal(geometry, triangle);
    if (normal.dot(seedNormal) < normalTolerance) continue;

    const points = [0, 1, 2].map((corner) => vertexAt(geometry, triangle, corner));
    if (points.some((point) => Math.abs(plane.distanceToPoint(point)) > distanceTolerance)) {
      continue;
    }

    candidates.set(triangle, triangleKeys(geometry, triangle, distanceTolerance));
  }

  const vertexToTriangles = new Map();
  for (const [triangle, keys] of candidates) {
    for (const key of keys) {
      if (!vertexToTriangles.has(key)) vertexToTriangles.set(key, []);
      vertexToTriangles.get(key).push(triangle);
    }
  }

  const regionTriangles = new Set();
  const queue = [seedTriangle];
  while (queue.length) {
    const triangle = queue.pop();
    if (regionTriangles.has(triangle) || !candidates.has(triangle)) continue;
    regionTriangles.add(triangle);
    for (const key of candidates.get(triangle)) {
      for (const neighbor of vertexToTriangles.get(key) ?? []) {
        if (!regionTriangles.has(neighbor)) queue.push(neighbor);
      }
    }
  }

  const vertexKeys = new Set();
  for (const triangle of regionTriangles) {
    for (const key of candidates.get(triangle)) vertexKeys.add(key);
  }

  return {
    normal: seedNormal.clone(),
    triangles: [...regionTriangles],
    vertexKeys,
    tolerance: distanceTolerance,
  };
}

export function pushPullGeometry(geometry, region, distance) {
  const result = geometry.clone();
  const position = result.getAttribute('position');
  const point = new THREE.Vector3();
  const offset = region.normal.clone().multiplyScalar(distance);

  for (let index = 0; index < position.count; index += 1) {
    point.fromBufferAttribute(position, index);
    if (region.vertexKeys.has(pointKey(point, region.tolerance))) {
      point.add(offset);
      position.setXYZ(index, point.x, point.y, point.z);
    }
  }

  position.needsUpdate = true;
  result.computeVertexNormals();
  result.computeBoundingBox();
  result.computeBoundingSphere();
  return result;
}

export function deleteTrianglesFromGeometry(geometry, triangleIndexes) {
  const position = geometry.getAttribute('position');
  const index = geometry.getIndex();
  const triangleCount = (index?.count ?? position.count) / 3;
  const deleted = new Set(triangleIndexes);
  const positions = [];
  const point = new THREE.Vector3();

  for (let triangle = 0; triangle < triangleCount; triangle += 1) {
    if (deleted.has(triangle)) continue;

    for (let corner = 0; corner < 3; corner += 1) {
      const vertex = index ? index.getX(triangle * 3 + corner) : triangle * 3 + corner;
      point.fromBufferAttribute(position, vertex);
      positions.push(point.x, point.y, point.z);
    }
  }

  if (!positions.length) return null;

  const result = new THREE.BufferGeometry();
  result.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  result.computeVertexNormals();
  result.computeBoundingBox();
  result.computeBoundingSphere();
  return result;
}

export function combineGeometries(geometries) {
  const positions = [];
  const point = new THREE.Vector3();

  for (const geometry of geometries) {
    const source = geometry.index ? geometry.toNonIndexed() : geometry;
    const position = source.getAttribute('position');
    if (!position) {
      if (source !== geometry) source.dispose();
      continue;
    }

    for (let index = 0; index < position.count; index += 1) {
      point.fromBufferAttribute(position, index);
      positions.push(point.x, point.y, point.z);
    }

    if (source !== geometry) source.dispose();
  }

  if (!positions.length) return null;

  const result = new THREE.BufferGeometry();
  result.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  result.computeVertexNormals();
  result.computeBoundingBox();
  result.computeBoundingSphere();
  return result;
}

function edgeKey(a, b, tolerance) {
  const keys = [pointKey(a, tolerance), pointKey(b, tolerance)].sort();
  return `${keys[0]}|${keys[1]}`;
}

function isOnOuterBoundary(a, b, box, tolerance) {
  const onSameMinX = Math.abs(a.x - box.min.x) <= tolerance && Math.abs(b.x - box.min.x) <= tolerance;
  const onSameMaxX = Math.abs(a.x - box.max.x) <= tolerance && Math.abs(b.x - box.max.x) <= tolerance;
  const onSameMinY = Math.abs(a.y - box.min.y) <= tolerance && Math.abs(b.y - box.min.y) <= tolerance;
  const onSameMaxY = Math.abs(a.y - box.max.y) <= tolerance && Math.abs(b.y - box.max.y) <= tolerance;
  return onSameMinX || onSameMaxX || onSameMinY || onSameMaxY;
}

function shouldShowBoundaryEdge(a, b, box, tolerance) {
  const longEdge = a.distanceTo(b) > 18;
  if (longEdge && !isOnOuterBoundary(a, b, box, tolerance)) {
    return false;
  }
  return true;
}

export function createDisplayEdgesGeometry(geometry, angleDegrees = 80, tolerance = DEFAULT_TOLERANCE) {
  const position = geometry.getAttribute('position');
  if (!position) return null;

  const triangleTotal = triangleCount(geometry);
  const box = new THREE.Box3().setFromBufferAttribute(position);
  const threshold = Math.cos(THREE.MathUtils.degToRad(angleDegrees));
  const edgeMap = new Map();

  for (let triangle = 0; triangle < triangleTotal; triangle += 1) {
    const points = [0, 1, 2].map((corner) => vertexAt(geometry, triangle, corner, new THREE.Vector3()));
    const normal = triangleNormal(geometry, triangle);
    for (const [start, end] of [[0, 1], [1, 2], [2, 0]]) {
      const key = edgeKey(points[start], points[end], tolerance);
      if (!edgeMap.has(key)) edgeMap.set(key, []);
      edgeMap.get(key).push({
        a: points[start],
        b: points[end],
        normal,
      });
    }
  }

  const positions = [];
  for (const edges of edgeMap.values()) {
    const [edge] = edges;
    const isBoundary = edges.length === 1;
    const isCrease = edges.some((current, index) =>
      edges.slice(index + 1).some((other) => current.normal.dot(other.normal) < threshold),
    );
    if ((isBoundary && shouldShowBoundaryEdge(edge.a, edge.b, box, tolerance)) || isCrease) {
      positions.push(edge.a.x, edge.a.y, edge.a.z, edge.b.x, edge.b.y, edge.b.z);
    }
  }

  const result = new THREE.BufferGeometry();
  result.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  return result;
}

export function createRegionGeometry(geometry, triangleIndexes, offset = 0.03) {
  const positions = [];
  for (const triangle of triangleIndexes) {
    const normal = triangleNormal(geometry, triangle);
    for (let corner = 0; corner < 3; corner += 1) {
      const point = vertexAt(geometry, triangle, corner).addScaledVector(normal, offset);
      positions.push(point.x, point.y, point.z);
    }
  }

  const highlight = new THREE.BufferGeometry();
  highlight.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  return highlight;
}
