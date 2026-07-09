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

function orderedEdgeKey(a, b) {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

function triangleAreaSquared(points, a, b, c) {
  const ab = new THREE.Vector3().subVectors(points[b], points[a]);
  const ac = new THREE.Vector3().subVectors(points[c], points[a]);
  return ab.cross(ac).lengthSq() * 0.25;
}

function triangleSignedVolume(points, triangle) {
  return points[triangle[0]].dot(
    new THREE.Vector3().crossVectors(points[triangle[1]], points[triangle[2]]),
  ) / 6;
}

function buildTriangleEdgeMap(triangles) {
  const edgeMap = new Map();
  triangles.forEach((triangle, triangleIndex) => {
    for (const [fromCorner, toCorner] of [[0, 1], [1, 2], [2, 0]]) {
      const from = triangle[fromCorner];
      const to = triangle[toCorner];
      const key = orderedEdgeKey(from, to);
      if (!edgeMap.has(key)) edgeMap.set(key, []);
      edgeMap.get(key).push({
        triangleIndex,
        from,
        to,
      });
    }
  });
  return edgeMap;
}

function orientTrianglesConsistently(points, triangles) {
  const edgeMap = buildTriangleEdgeMap(triangles);
  const neighbors = new Map();
  let boundaryEdges = 0;
  let nonManifoldEdges = 0;

  for (const edges of edgeMap.values()) {
    if (edges.length === 1) {
      boundaryEdges += 1;
      continue;
    }
    if (edges.length > 2) {
      nonManifoldEdges += 1;
      continue;
    }

    const [first, second] = edges;
    if (!neighbors.has(first.triangleIndex)) neighbors.set(first.triangleIndex, []);
    if (!neighbors.has(second.triangleIndex)) neighbors.set(second.triangleIndex, []);
    neighbors.get(first.triangleIndex).push(second);
    neighbors.get(second.triangleIndex).push(first);
  }

  const visited = new Set();
  let flippedTriangles = 0;
  let components = 0;

  for (let seed = 0; seed < triangles.length; seed += 1) {
    if (visited.has(seed)) continue;
    components += 1;
    const component = [];
    const queue = [seed];
    visited.add(seed);

    while (queue.length) {
      const currentIndex = queue.shift();
      component.push(currentIndex);
      const current = triangles[currentIndex];
      for (const edge of neighbors.get(currentIndex) ?? []) {
        if (visited.has(edge.triangleIndex)) continue;
        const neighbor = triangles[edge.triangleIndex];
        const currentFrom = current.includes(edge.from) && current[(current.indexOf(edge.from) + 1) % 3] === edge.to;
        const neighborFrom = neighbor.includes(edge.from) && neighbor[(neighbor.indexOf(edge.from) + 1) % 3] === edge.to;
        if (currentFrom === neighborFrom) {
          [neighbor[1], neighbor[2]] = [neighbor[2], neighbor[1]];
          flippedTriangles += 1;
        }
        visited.add(edge.triangleIndex);
        queue.push(edge.triangleIndex);
      }
    }

    const volume = component.reduce((sum, triangleIndex) =>
      sum + triangleSignedVolume(points, triangles[triangleIndex]), 0);
    if (volume < 0) {
      for (const triangleIndex of component) {
        [triangles[triangleIndex][1], triangles[triangleIndex][2]] =
          [triangles[triangleIndex][2], triangles[triangleIndex][1]];
      }
      flippedTriangles += component.length;
    }
  }

  return {
    boundaryEdges,
    components,
    flippedTriangles,
    nonManifoldEdges,
  };
}

function normalizePlaneNormal(normal) {
  const result = normal.clone().normalize();
  const components = [result.x, result.y, result.z];
  const dominant = components
    .map((value) => Math.abs(value))
    .indexOf(Math.max(...components.map((value) => Math.abs(value))));
  if (components[dominant] < 0) result.negate();
  return result;
}

function triangleNormalFromPoints(points, triangle, target = new THREE.Vector3()) {
  return target
    .subVectors(points[triangle[1]], points[triangle[0]])
    .cross(new THREE.Vector3().subVectors(points[triangle[2]], points[triangle[0]]))
    .normalize();
}

function planarizeNearlyCoplanarVertices(points, triangles, options = {}) {
  const planarizeTolerance = Math.max(options.planarizeTolerance ?? 0.05, 0);
  if (planarizeTolerance <= 0) return 0;

  const normalStep = Math.max(options.planarNormalStep ?? 0.002, 1e-6);
  const distanceStep = Math.max(options.planarDistanceStep ?? planarizeTolerance, 1e-8);
  const minTriangles = Math.max(options.minPlanarTriangles ?? 2, 1);
  const minArea = Math.max(options.minPlanarArea ?? 1, 0);
  const planes = new Map();

  for (const triangle of triangles) {
    const normal = normalizePlaneNormal(triangleNormalFromPoints(points, triangle));
    if (normal.lengthSq() < 1e-8) continue;
    const distance = normal.dot(points[triangle[0]]);
    const area = Math.sqrt(triangleAreaSquared(points, triangle[0], triangle[1], triangle[2]));
    if (!(area > 0)) continue;

    const key = [
      Math.round(normal.x / normalStep),
      Math.round(normal.y / normalStep),
      Math.round(normal.z / normalStep),
      Math.round(distance / distanceStep),
    ].join(':');
    if (!planes.has(key)) {
      planes.set(key, {
        area: 0,
        distanceSum: 0,
        normalSum: new THREE.Vector3(),
        triangles: 0,
      });
    }
    const plane = planes.get(key);
    plane.area += area;
    plane.distanceSum += distance * area;
    plane.normalSum.addScaledVector(normal, area);
    plane.triangles += 1;
  }

  const candidates = [...planes.values()]
    .filter((plane) => plane.triangles >= minTriangles && plane.area >= minArea && plane.normalSum.lengthSq() > 1e-8)
    .map((plane) => {
      const normal = plane.normalSum.normalize();
      return {
        area: plane.area,
        distance: plane.distanceSum / plane.area,
        normal,
      };
    })
    .sort((a, b) => b.area - a.area);

  let planarizedVertices = 0;
  for (const point of points) {
    let best = null;
    for (const plane of candidates) {
      const signedDistance = plane.normal.dot(point) - plane.distance;
      const distance = Math.abs(signedDistance);
      if (distance > planarizeTolerance) continue;
      if (!best || distance < best.distance) {
        best = { plane, signedDistance, distance };
      }
    }
    if (!best || best.distance <= 1e-8) continue;
    point.addScaledVector(best.plane.normal, -best.signedDistance);
    planarizedVertices += 1;
  }

  return planarizedVertices;
}

export function repairMeshGeometry(geometry, options = {}) {
  const position = geometry.getAttribute('position');
  if (!position) return null;

  const tolerance = Math.max(options.tolerance ?? DEFAULT_TOLERANCE, 1e-8);
  const areaTolerance = Math.max(options.areaTolerance ?? tolerance * tolerance, 1e-16);
  const index = geometry.getIndex();
  const trianglesBefore = triangleCount(geometry);
  const verticesBefore = position.count;
  const point = new THREE.Vector3();
  const vertexGroups = new Map();
  const canonicalBySource = [];

  for (let sourceIndex = 0; sourceIndex < position.count; sourceIndex += 1) {
    point.fromBufferAttribute(position, sourceIndex);
    if (!Number.isFinite(point.x) || !Number.isFinite(point.y) || !Number.isFinite(point.z)) {
      canonicalBySource[sourceIndex] = -1;
      continue;
    }

    const key = pointKey(point, tolerance);
    if (!vertexGroups.has(key)) {
      vertexGroups.set(key, {
        index: vertexGroups.size,
        sum: new THREE.Vector3(),
        count: 0,
      });
    }
    const group = vertexGroups.get(key);
    group.sum.add(point);
    group.count += 1;
    canonicalBySource[sourceIndex] = group.index;
  }

  const points = Array.from(vertexGroups.values())
    .sort((a, b) => a.index - b.index)
    .map((group) => group.sum.multiplyScalar(1 / group.count));
  const triangles = [];
  const seenTriangles = new Set();
  let removedDegenerateTriangles = 0;
  let removedDuplicateTriangles = 0;

  for (let triangleIndex = 0; triangleIndex < trianglesBefore; triangleIndex += 1) {
    const aSource = index ? index.getX(triangleIndex * 3) : triangleIndex * 3;
    const bSource = index ? index.getX(triangleIndex * 3 + 1) : triangleIndex * 3 + 1;
    const cSource = index ? index.getX(triangleIndex * 3 + 2) : triangleIndex * 3 + 2;
    const triangle = [
      canonicalBySource[aSource],
      canonicalBySource[bSource],
      canonicalBySource[cSource],
    ];

    if (
      triangle.some((vertex) => vertex < 0) ||
      triangle[0] === triangle[1] ||
      triangle[1] === triangle[2] ||
      triangle[2] === triangle[0] ||
      triangleAreaSquared(points, triangle[0], triangle[1], triangle[2]) <= areaTolerance
    ) {
      removedDegenerateTriangles += 1;
      continue;
    }

    const sortedKey = [...triangle].sort((a, b) => a - b).join('|');
    if (seenTriangles.has(sortedKey)) {
      removedDuplicateTriangles += 1;
      continue;
    }
    seenTriangles.add(sortedKey);
    triangles.push(triangle);
  }

  if (!triangles.length) return null;

  const planarizedVertices = options.planarize === false
    ? 0
    : planarizeNearlyCoplanarVertices(points, triangles, options);
  if (planarizedVertices) {
    const cleanedTriangles = [];
    const seenAfterPlanarize = new Set();
    for (const triangle of triangles) {
      const keys = triangle.map((vertex) => pointKey(points[vertex], tolerance));
      if (
        keys[0] === keys[1] ||
        keys[1] === keys[2] ||
        keys[2] === keys[0] ||
        triangleAreaSquared(points, triangle[0], triangle[1], triangle[2]) <= areaTolerance
      ) {
        removedDegenerateTriangles += 1;
        continue;
      }
      const sortedKey = [...keys].sort().join('|');
      if (seenAfterPlanarize.has(sortedKey)) {
        removedDuplicateTriangles += 1;
        continue;
      }
      seenAfterPlanarize.add(sortedKey);
      cleanedTriangles.push(triangle);
    }
    triangles.length = 0;
    triangles.push(...cleanedTriangles);
  }
  if (!triangles.length) return null;
  const topology = orientTrianglesConsistently(points, triangles);
  const positions = [];
  for (const point of points) {
    positions.push(point.x, point.y, point.z);
  }

  const indices = [];
  for (const triangle of triangles) {
    indices.push(...triangle);
  }

  const result = new THREE.BufferGeometry();
  result.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  result.setIndex(indices);
  result.computeVertexNormals();
  result.computeBoundingBox();
  result.computeBoundingSphere();

  return {
    geometry: result,
    report: {
      boundaryEdges: topology.boundaryEdges,
      components: topology.components,
      flippedTriangles: topology.flippedTriangles,
      nonManifoldEdges: topology.nonManifoldEdges,
      removedDegenerateTriangles,
      removedDuplicateTriangles,
      planarizedVertices,
      trianglesAfter: triangles.length,
      trianglesBefore,
      verticesAfter: points.length,
      verticesBefore,
      weldedVertices: verticesBefore - points.length,
    },
  };
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
  const openBoundaryEdges = collectOpenRegionBoundaryEdges(geometry, region);
  const basePositions = [];

  for (let index = 0; index < position.count; index += 1) {
    point.fromBufferAttribute(position, index);
    if (region.vertexKeys.has(pointKey(point, region.tolerance))) {
      point.add(offset);
      position.setXYZ(index, point.x, point.y, point.z);
    }
  }

  if (openBoundaryEdges.length) {
    const sourcePosition = geometry.getAttribute('position');
    for (const triangle of region.triangles) {
      for (let corner = 2; corner >= 0; corner -= 1) {
        point.fromBufferAttribute(sourcePosition, triangle * 3 + corner);
        basePositions.push(point.x, point.y, point.z);
      }
    }
    for (const edge of openBoundaryEdges) {
      const movedStart = edge.start.clone().add(offset);
      const movedEnd = edge.end.clone().add(offset);
      basePositions.push(
        edge.start.x, edge.start.y, edge.start.z,
        edge.end.x, edge.end.y, edge.end.z,
        movedEnd.x, movedEnd.y, movedEnd.z,
        edge.start.x, edge.start.y, edge.start.z,
        movedEnd.x, movedEnd.y, movedEnd.z,
        movedStart.x, movedStart.y, movedStart.z,
      );
    }
  }

  if (basePositions.length) {
    const mergedPositions = new Float32Array(position.count * 3 + basePositions.length);
    mergedPositions.set(position.array);
    mergedPositions.set(basePositions, position.count * 3);
    result.setAttribute('position', new THREE.Float32BufferAttribute(mergedPositions, 3));
  }

  position.needsUpdate = true;
  result.computeVertexNormals();
  result.computeBoundingBox();
  result.computeBoundingSphere();
  return result;
}

function collectOpenRegionBoundaryEdges(geometry, region) {
  const position = geometry.getAttribute('position');
  const selectedTriangles = new Set(region.triangles);
  const selectedEdges = new Map();
  const unselectedEdgeKeys = new Set();
  const points = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];

  for (let triangle = 0; triangle < position.count / 3; triangle += 1) {
    for (let corner = 0; corner < 3; corner += 1) {
      points[corner].fromBufferAttribute(position, triangle * 3 + corner);
    }
    for (const [from, to] of [[0, 1], [1, 2], [2, 0]]) {
      const key = edgeKey(points[from], points[to], region.tolerance);
      if (selectedTriangles.has(triangle)) {
        if (!selectedEdges.has(key)) {
          selectedEdges.set(key, {
            count: 0,
            start: points[from].clone(),
            end: points[to].clone(),
          });
        }
        selectedEdges.get(key).count += 1;
      } else {
        unselectedEdgeKeys.add(key);
      }
    }
  }

  return [...selectedEdges.values()].filter((edge) =>
    edge.count === 1 && !unselectedEdgeKeys.has(edgeKey(edge.start, edge.end, region.tolerance)),
  );
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

function collectDisplayEdges(geometry, angleDegrees = 80, tolerance = DEFAULT_TOLERANCE) {
  const position = geometry.getAttribute('position');
  if (!position) return [];

  const triangleTotal = triangleCount(geometry);
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

  const result = [];
  for (const edges of edgeMap.values()) {
    const [edge] = edges;
    const isBoundary = edges.length === 1;
    const isCrease = isBoundary || edges.some((current, index) =>
      edges.slice(index + 1).some((other) => current.normal.dot(other.normal) < threshold),
    );
    if (isCrease) {
      result.push({
        a: edge.a.clone(),
        b: edge.b.clone(),
      });
    }
  }
  return result;
}

function planeKeyFromTriangle(geometry, triangle, tolerance) {
  const normal = triangleNormal(geometry, triangle);
  if (normal.lengthSq() < 1e-8) return null;
  const point = vertexAt(geometry, triangle, 0);
  const distance = normal.dot(point);
  const planeTolerance = tolerance * 50;
  return [
    Math.round(normal.x / 0.001),
    Math.round(normal.y / 0.001),
    Math.round(normal.z / 0.001),
    Math.round(distance / planeTolerance),
  ].join(':');
}

function collectCoplanarPlaneCenters(geometry, tolerance = DEFAULT_TOLERANCE) {
  const position = geometry.getAttribute('position');
  if (!position) return [];

  const triangleTotal = triangleCount(geometry);
  const point = new THREE.Vector3();
  const planes = new Map();

  for (let triangle = 0; triangle < triangleTotal; triangle += 1) {
    const key = planeKeyFromTriangle(geometry, triangle, tolerance);
    if (!key) continue;
    if (!planes.has(key)) {
      planes.set(key, {
        box: new THREE.Box3(),
        triangles: 0,
      });
    }
    const plane = planes.get(key);
    plane.triangles += 1;
    for (let corner = 0; corner < 3; corner += 1) {
      point.copy(vertexAt(geometry, triangle, corner));
      plane.box.expandByPoint(point);
    }
  }

  const centers = [];
  const centerKeys = new Set();
  for (const plane of planes.values()) {
    if (plane.triangles < 2 || plane.box.isEmpty()) continue;
    const size = plane.box.getSize(new THREE.Vector3());
    if (size.lengthSq() < tolerance * tolerance) continue;
    const center = plane.box.getCenter(new THREE.Vector3());
    const key = pointKey(center, tolerance * 50);
    if (centerKeys.has(key)) continue;
    centerKeys.add(key);
    centers.push(center);
  }
  return centers;
}

export function createDisplayEdgesGeometry(geometry, angleDegrees = 80, tolerance = DEFAULT_TOLERANCE) {
  const positions = [];
  for (const edge of collectDisplayEdges(geometry, angleDegrees, tolerance)) {
    positions.push(edge.a.x, edge.a.y, edge.a.z, edge.b.x, edge.b.y, edge.b.z);
  }
  const result = new THREE.BufferGeometry();
  result.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  return result;
}

export function collectDisplaySnapPoints(geometry, angleDegrees = 80, tolerance = DEFAULT_TOLERANCE) {
  const targets = [];
  const keySet = new Set();

  const addTarget = (point, kind) => {
    const key = `${kind}:${point.x.toFixed(3)}:${point.y.toFixed(3)}:${point.z.toFixed(3)}`;
    if (keySet.has(key)) return;
    keySet.add(key);
    targets.push({
      kind,
      point: point.clone(),
    });
  };

  for (const edge of collectDisplayEdges(geometry, angleDegrees, tolerance)) {
    addTarget(edge.a, 'vertice');
    addTarget(edge.b, 'vertice');
    addTarget(edge.a.clone().add(edge.b).multiplyScalar(0.5), 'punto medio');
  }
  for (const center of collectCoplanarPlaneCenters(geometry, tolerance)) {
    addTarget(center, 'centro faccia');
  }

  return targets;
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
