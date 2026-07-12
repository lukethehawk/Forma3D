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

export const MODEL_COMPLEXITY_THRESHOLDS = {
  mediumTriangles: 50000,
  largeTriangles: 250000,
  veryLargeTriangles: 1000000,
};

export function classifyModelComplexity(triangles) {
  if (triangles < MODEL_COMPLEXITY_THRESHOLDS.mediumTriangles) return 'light';
  if (triangles < MODEL_COMPLEXITY_THRESHOLDS.largeTriangles) return 'medium';
  if (triangles <= MODEL_COMPLEXITY_THRESHOLDS.veryLargeTriangles) return 'large';
  return 'very-large';
}

export function modelComplexityInfo(file, geometry) {
  const position = geometry?.getAttribute?.('position');
  const triangles = geometry ? Math.round(triangleCount(geometry)) : 0;
  const vertices = position?.count ?? 0;
  const fileSizeBytes = Number(file?.size) || 0;
  const fileSizeMb = fileSizeBytes / (1024 * 1024);
  const level = classifyModelComplexity(triangles);
  return {
    fileSizeBytes,
    fileSizeMb,
    triangles,
    vertices,
    level,
    isLarge: level === 'large' || level === 'very-large',
    isVeryLarge: level === 'very-large',
    skipConnectedComponents: triangles > MODEL_COMPLEXITY_THRESHOLDS.veryLargeTriangles,
  };
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

function analyzeTriangleTopology(triangles) {
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
    neighbors.get(first.triangleIndex).push(second.triangleIndex);
    neighbors.get(second.triangleIndex).push(first.triangleIndex);
  }

  const visited = new Set();
  let components = 0;
  for (let seed = 0; seed < triangles.length; seed += 1) {
    if (visited.has(seed)) continue;
    components += 1;
    const stack = [seed];
    visited.add(seed);
    while (stack.length) {
      const current = stack.pop();
      for (const next of neighbors.get(current) ?? []) {
        if (visited.has(next)) continue;
        visited.add(next);
        stack.push(next);
      }
    }
  }

  return {
    boundaryEdges,
    components,
    flippedTriangles: 0,
    nonManifoldEdges,
  };
}

function connectedTriangleComponents(triangles, edgeMap = buildTriangleEdgeMap(triangles)) {
  const neighbors = new Map();
  for (const edges of edgeMap.values()) {
    if (edges.length < 2) continue;
    for (let index = 0; index < edges.length; index += 1) {
      for (let nextIndex = index + 1; nextIndex < edges.length; nextIndex += 1) {
        const a = edges[index].triangleIndex;
        const b = edges[nextIndex].triangleIndex;
        if (!neighbors.has(a)) neighbors.set(a, []);
        if (!neighbors.has(b)) neighbors.set(b, []);
        neighbors.get(a).push(b);
        neighbors.get(b).push(a);
      }
    }
  }

  const visited = new Set();
  const components = [];
  for (let seed = 0; seed < triangles.length; seed += 1) {
    if (visited.has(seed)) continue;
    const component = [];
    const stack = [seed];
    visited.add(seed);
    while (stack.length) {
      const current = stack.pop();
      component.push(current);
      for (const next of neighbors.get(current) ?? []) {
        if (visited.has(next)) continue;
        visited.add(next);
        stack.push(next);
      }
    }
    components.push(component);
  }
  return components;
}

function collectBoundaryLoopsFromTriangles(points, triangles, edgeMap = buildTriangleEdgeMap(triangles)) {
  const boundaryEdges = [];
  for (const edges of edgeMap.values()) {
    if (edges.length === 1) {
      const [edge] = edges;
      boundaryEdges.push({
        from: edge.from,
        to: edge.to,
        triangleIndex: edge.triangleIndex,
      });
    }
  }

  const vertexEdges = new Map();
  boundaryEdges.forEach((edge, edgeIndex) => {
    for (const vertex of [edge.from, edge.to]) {
      if (!vertexEdges.has(vertex)) vertexEdges.set(vertex, []);
      vertexEdges.get(vertex).push(edgeIndex);
    }
  });

  const visitedEdges = new Set();
  const loops = [];
  for (let seed = 0; seed < boundaryEdges.length; seed += 1) {
    if (visitedEdges.has(seed)) continue;

    const componentEdges = [];
    const edgeQueue = [seed];
    visitedEdges.add(seed);
    for (let index = 0; index < edgeQueue.length; index += 1) {
      const edgeIndex = edgeQueue[index];
      componentEdges.push(edgeIndex);
      const edge = boundaryEdges[edgeIndex];
      for (const vertex of [edge.from, edge.to]) {
        for (const nextEdge of vertexEdges.get(vertex) ?? []) {
          if (visitedEdges.has(nextEdge)) continue;
          visitedEdges.add(nextEdge);
          edgeQueue.push(nextEdge);
        }
      }
    }

    const componentSet = new Set(componentEdges);
    const vertices = new Set();
    for (const edgeIndex of componentEdges) {
      vertices.add(boundaryEdges[edgeIndex].from);
      vertices.add(boundaryEdges[edgeIndex].to);
    }

    const degrees = [...vertices].map((vertex) => (
      (vertexEdges.get(vertex) ?? []).filter((edgeIndex) => componentSet.has(edgeIndex)).length
    ));
    const branched = degrees.some((degree) => degree > 2);
    const closed = componentEdges.length >= 3 && degrees.every((degree) => degree === 2);
    const startVertex = closed
      ? boundaryEdges[componentEdges[0]].from
      : [...vertices].find((vertex) => (
        (vertexEdges.get(vertex) ?? []).filter((edgeIndex) => componentSet.has(edgeIndex)).length === 1
      )) ?? boundaryEdges[componentEdges[0]].from;

    const ordered = [startVertex];
    const orderedEdges = new Set();
    let current = startVertex;
    let guard = componentEdges.length + 2;
    while (guard > 0) {
      guard -= 1;
      const nextEdge = (vertexEdges.get(current) ?? []).find((edgeIndex) => (
        componentSet.has(edgeIndex) && !orderedEdges.has(edgeIndex)
      ));
      if (nextEdge == null) break;
      orderedEdges.add(nextEdge);
      const edge = boundaryEdges[nextEdge];
      current = edge.from === current ? edge.to : edge.from;
      ordered.push(current);
      if (closed && current === startVertex) break;
    }

    const orderedVertices = closed && ordered[ordered.length - 1] === startVertex
      ? ordered.slice(0, -1)
      : ordered;
    loops.push({
      branched,
      closed: closed && orderedEdges.size === componentEdges.length && ordered[ordered.length - 1] === startVertex,
      edges: componentEdges.map((edgeIndex) => boundaryEdges[edgeIndex]),
      points: orderedVertices.map((vertex) => points[vertex]),
      supportingTriangles: new Set(componentEdges.map((edgeIndex) => boundaryEdges[edgeIndex].triangleIndex)).size,
      vertices: orderedVertices,
    });
  }

  return loops;
}

function boundaryLoopPlane(points, vertices) {
  const normal = new THREE.Vector3();
  for (let index = 0; index < vertices.length; index += 1) {
    const current = points[vertices[index]];
    const next = points[vertices[(index + 1) % vertices.length]];
    normal.x += (current.y - next.y) * (current.z + next.z);
    normal.y += (current.z - next.z) * (current.x + next.x);
    normal.z += (current.x - next.x) * (current.y + next.y);
  }
  if (normal.lengthSq() < 1e-12) return null;
  normal.normalize();
  const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(normal, points[vertices[0]]);
  return { normal, plane };
}

function boundaryLoopDiameter(points, vertices) {
  const box = new THREE.Box3();
  for (const vertex of vertices) box.expandByPoint(points[vertex]);
  return box.getSize(new THREE.Vector3()).length();
}

function triangulateBoundaryLoop(points, vertices, axis) {
  const polygon = vertices.map((vertex) => ({
    vertex,
    projected: projection2D(points[vertex], axis),
  }));
  const triangles = [];
  const sign = Math.sign(projectedArea(vertices.map((vertex) => points[vertex]), axis)) || 1;
  let guard = polygon.length * polygon.length;

  while (polygon.length > 3 && guard > 0) {
    guard -= 1;
    let clipped = false;
    for (let index = 0; index < polygon.length; index += 1) {
      const previous = polygon[(index - 1 + polygon.length) % polygon.length];
      const current = polygon[index];
      const next = polygon[(index + 1) % polygon.length];
      const cross = (
        (current.projected.x - previous.projected.x) * (next.projected.y - current.projected.y)
        - (current.projected.y - previous.projected.y) * (next.projected.x - current.projected.x)
      ) * sign;
      if (cross <= 1e-10) continue;

      const containsPoint = polygon.some((candidate, candidateIndex) => {
        if (
          candidateIndex === index
          || candidateIndex === (index - 1 + polygon.length) % polygon.length
          || candidateIndex === (index + 1) % polygon.length
        ) {
          return false;
        }
        return pointInTriangle2D(candidate.projected, previous.projected, current.projected, next.projected, sign);
      });
      if (containsPoint) continue;

      triangles.push([previous.vertex, current.vertex, next.vertex]);
      polygon.splice(index, 1);
      clipped = true;
      break;
    }
    if (!clipped) break;
  }

  if (polygon.length === 3) {
    triangles.push([polygon[0].vertex, polygon[1].vertex, polygon[2].vertex]);
  } else if (!triangles.length && vertices.length >= 3) {
    for (let index = 1; index < vertices.length - 1; index += 1) {
      triangles.push([vertices[0], vertices[index], vertices[index + 1]]);
    }
  }
  return triangles;
}

function fillConservativeBoundaryHoles(points, triangles, options = {}) {
  const warnings = [];
  const fillHoles = options.fillHoles !== false && options.preserveWinding !== true;
  if (!fillHoles) {
    return {
      addedTriangles: 0,
      filledHoles: 0,
      loops: collectBoundaryLoopsFromTriangles(points, triangles),
      warnings,
    };
  }

  const triangleLimit = Math.max(options.holeFillTriangleLimit ?? MODEL_COMPLEXITY_THRESHOLDS.largeTriangles, 0);
  if (triangles.length > triangleLimit) {
    return {
      addedTriangles: 0,
      filledHoles: 0,
      loops: collectBoundaryLoopsFromTriangles(points, triangles),
      warnings: ['hole-fill-skipped-large-mesh'],
    };
  }

  const maxHoleEdges = Math.max(options.maxHoleEdges ?? 48, 3);
  const maxHoleDiameter = Math.max(options.maxHoleDiameter ?? 80, 0);
  const planarityTolerance = Math.max(options.holePlanarityTolerance ?? 0.05, 0);
  let addedTriangles = 0;
  let filledHoles = 0;
  let loops = collectBoundaryLoopsFromTriangles(points, triangles);

  for (const loop of loops) {
    if (!loop.closed || loop.branched) {
      warnings.push('hole-fill-skipped-open-or-branched-loop');
      continue;
    }
    if (loop.edges.length > maxHoleEdges) {
      warnings.push('hole-fill-skipped-large-loop');
      continue;
    }
    if (loop.supportingTriangles <= 2) {
      warnings.push('hole-fill-skipped-open-sheet');
      continue;
    }
    const diameter = boundaryLoopDiameter(points, loop.vertices);
    if (diameter > maxHoleDiameter) {
      warnings.push('hole-fill-skipped-large-diameter');
      continue;
    }
    const planeInfo = boundaryLoopPlane(points, loop.vertices);
    if (!planeInfo) {
      warnings.push('hole-fill-skipped-ambiguous-plane');
      continue;
    }
    const maxDistance = loop.vertices.reduce((max, vertex) =>
      Math.max(max, Math.abs(planeInfo.plane.distanceToPoint(points[vertex]))), 0);
    if (maxDistance > planarityTolerance) {
      warnings.push('hole-fill-skipped-non-planar-loop');
      continue;
    }

    const axis = Math.abs(planeInfo.normal.x) > Math.abs(planeInfo.normal.y)
      && Math.abs(planeInfo.normal.x) > Math.abs(planeInfo.normal.z)
      ? 0
      : Math.abs(planeInfo.normal.y) > Math.abs(planeInfo.normal.z)
        ? 1
        : 2;
    const newTriangles = triangulateBoundaryLoop(points, loop.vertices, axis)
      .filter((triangle) => triangleAreaSquared(points, triangle[0], triangle[1], triangle[2]) > 1e-16);
    if (!newTriangles.length) {
      warnings.push('hole-fill-skipped-triangulation-failed');
      continue;
    }
    triangles.push(...newTriangles);
    addedTriangles += newTriangles.length;
    filledHoles += 1;
  }

  loops = collectBoundaryLoopsFromTriangles(points, triangles);
  return {
    addedTriangles,
    filledHoles,
    loops,
    warnings,
  };
}

function removeSmallTriangleComponents(triangles, options = {}) {
  const components = connectedTriangleComponents(triangles);
  const minComponentTriangles = Math.max(options.minComponentTriangles ?? 4, 1);
  const smallComponents = components.filter((component) => component.length < minComponentTriangles);
  const removeSmallComponents = options.removeSmallComponents === true;
  if (!removeSmallComponents || !smallComponents.length || smallComponents.length === components.length) {
    return {
      components,
      removedSmallComponents: 0,
      smallComponentsDetected: smallComponents.length,
      triangles,
    };
  }

  const removeTriangles = new Set(smallComponents.flat());
  return {
    components: components.filter((component) => !component.some((triangle) => removeTriangles.has(triangle))),
    removedSmallComponents: smallComponents.length,
    smallComponentsDetected: smallComponents.length,
    triangles: triangles.filter((_, index) => !removeTriangles.has(index)),
  };
}

function compactIndexedTriangles(points, triangles) {
  const used = new Map();
  const compactedPoints = [];
  const compactedTriangles = triangles.map((triangle) => triangle.map((vertex) => {
    if (!used.has(vertex)) {
      used.set(vertex, compactedPoints.length);
      compactedPoints.push(points[vertex]);
    }
    return used.get(vertex);
  }));
  return {
    points: compactedPoints,
    triangles: compactedTriangles,
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
  const warnings = [];

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
  const holeFill = fillConservativeBoundaryHoles(points, triangles, {
    ...options,
    areaTolerance,
  });
  warnings.push(...holeFill.warnings);

  const componentCleanup = removeSmallTriangleComponents(triangles, options);
  if (componentCleanup.triangles !== triangles) {
    triangles.length = 0;
    triangles.push(...componentCleanup.triangles);
  }
  if (componentCleanup.smallComponentsDetected && options.removeSmallComponents !== true) {
    warnings.push('small-components-detected');
  }
  if (!triangles.length) return null;

  const compacted = compactIndexedTriangles(points, triangles);
  points.length = 0;
  points.push(...compacted.points);
  triangles.length = 0;
  triangles.push(...compacted.triangles);

  const topology = options.preserveWinding === true
    ? analyzeTriangleTopology(triangles)
    : orientTrianglesConsistently(points, triangles);
  const finalLoops = collectBoundaryLoopsFromTriangles(points, triangles);
  if (topology.boundaryEdges) warnings.push('boundary-edges-remaining');
  if (topology.nonManifoldEdges) warnings.push('non-manifold-edges-remaining');

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
      addedTriangles: holeFill.addedTriangles,
      boundaryEdges: topology.boundaryEdges,
      boundaryLoops: finalLoops.length,
      components: topology.components,
      filledHoles: holeFill.filledHoles,
      flippedTriangles: topology.flippedTriangles,
      nonManifoldEdges: topology.nonManifoldEdges,
      removedDegenerateTriangles,
      removedDuplicateTriangles,
      removedSmallComponents: componentCleanup.removedSmallComponents,
      planarizedVertices,
      trianglesAfter: triangles.length,
      trianglesBefore,
      verticesAfter: points.length,
      verticesBefore,
      warnings: [...new Set(warnings)],
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
    result.deleteAttribute('normal');
  }

  result.getAttribute('position').needsUpdate = true;
  result.computeVertexNormals();
  result.computeBoundingBox();
  result.computeBoundingSphere();
  return result;
}

function planeAxisValue(point, axis) {
  return axis === 0 ? point.x : axis === 1 ? point.y : point.z;
}

function setPlaneAxisValue(point, axis, value) {
  if (axis === 0) point.x = value;
  else if (axis === 1) point.y = value;
  else point.z = value;
}

function interpolatePlanePoint(a, b, da, db, axis, planePosition) {
  const denominator = da - db;
  const t = Math.abs(denominator) <= 1e-12 ? 0 : da / denominator;
  const point = a.clone().lerp(b, THREE.MathUtils.clamp(t, 0, 1));
  setPlaneAxisValue(point, axis, planePosition);
  return point;
}

function clipTriangleToHalfSpace(points, distances, axis, planePosition, tolerance) {
  const clipped = [];
  const intersections = [];

  for (let index = 0; index < points.length; index += 1) {
    const current = points[index];
    const next = points[(index + 1) % points.length];
    const currentDistance = distances[index];
    const nextDistance = distances[(index + 1) % distances.length];
    const currentInside = currentDistance >= -tolerance;
    const nextInside = nextDistance >= -tolerance;

    if (currentInside && nextInside) {
      clipped.push(next.clone());
    } else if (currentInside && !nextInside) {
      const intersection = interpolatePlanePoint(current, next, currentDistance, nextDistance, axis, planePosition);
      clipped.push(intersection);
      intersections.push(intersection);
    } else if (!currentInside && nextInside) {
      const intersection = interpolatePlanePoint(current, next, currentDistance, nextDistance, axis, planePosition);
      clipped.push(intersection, next.clone());
      intersections.push(intersection);
    }
  }

  return { clipped, intersections };
}

function pushTrianglePositions(positions, a, b, c, areaTolerance) {
  const areaSquared = new THREE.Vector3()
    .subVectors(b, a)
    .cross(new THREE.Vector3().subVectors(c, a))
    .lengthSq() * 0.25;
  if (areaSquared <= areaTolerance) return false;
  positions.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
  return true;
}

function projection2D(point, axis) {
  if (axis === 0) return { x: point.y, y: point.z };
  if (axis === 1) return { x: point.x, y: point.z };
  return { x: point.x, y: point.y };
}

function projectedArea(points, axis) {
  let area = 0;
  for (let index = 0; index < points.length; index += 1) {
    const current = projection2D(points[index], axis);
    const next = projection2D(points[(index + 1) % points.length], axis);
    area += current.x * next.y - next.x * current.y;
  }
  return area * 0.5;
}

function pointInTriangle2D(point, a, b, c, sign) {
  const edge = (p1, p2, p) =>
    ((p2.x - p1.x) * (p.y - p1.y) - (p2.y - p1.y) * (p.x - p1.x)) * sign;
  const tolerance = -1e-9;
  return edge(a, b, point) >= tolerance
    && edge(b, c, point) >= tolerance
    && edge(c, a, point) >= tolerance;
}

function pointInPolygon2D(point, polygon) {
  let inside = false;
  for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index, index += 1) {
    const current = polygon[index];
    const last = polygon[previous];
    const intersects = ((current.y > point.y) !== (last.y > point.y))
      && point.x < ((last.x - current.x) * (point.y - current.y)) / ((last.y - current.y) || 1e-20) + current.x;
    if (intersects) inside = !inside;
  }
  return inside;
}

function normalizeLoopPoints(loop, axis, desiredNormalSign) {
  const unique = [];
  const seen = new Set();
  for (const point of loop) {
    const key = pointKey(point);
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(point.clone());
  }
  if (unique.length < 3) return null;

  const projectionNormalSign = axis === 1 ? -1 : 1;
  const desiredAreaSign = desiredNormalSign * projectionNormalSign;
  const area = projectedArea(unique, axis);
  if (Math.abs(area) < 1e-10) return null;
  if (Math.sign(area) !== Math.sign(desiredAreaSign)) unique.reverse();
  return unique;
}

function pushTriangleWithAxisNormal(triangles, a, b, c, axis, desiredNormalSign) {
  const normal = new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(c, a));
  const component = axis === 0 ? normal.x : axis === 1 ? normal.y : normal.z;
  if (Math.sign(component || desiredNormalSign) === Math.sign(desiredNormalSign)) {
    triangles.push([a, b, c]);
  } else {
    triangles.push([a, c, b]);
  }
}

function loopCentroid(loop, target = new THREE.Vector3()) {
  target.set(0, 0, 0);
  for (const point of loop) target.add(point);
  return target.multiplyScalar(1 / loop.length);
}

function angleAround(point, center, axis) {
  const projected = projection2D(point, axis);
  const projectedCenter = projection2D(center, axis);
  return Math.atan2(projected.y - projectedCenter.y, projected.x - projectedCenter.x);
}

function rotateLoopToNearestAngle(loop, targetAngle, center, axis) {
  let bestIndex = 0;
  let bestDistance = Infinity;
  for (let index = 0; index < loop.length; index += 1) {
    const angle = angleAround(loop[index], center, axis);
    const distance = Math.abs(Math.atan2(Math.sin(angle - targetAngle), Math.cos(angle - targetAngle)));
    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = index;
    }
  }
  return [...loop.slice(bestIndex), ...loop.slice(0, bestIndex)];
}

function triangulateRingBetweenLoops(outerLoop, innerLoop, axis, desiredNormalSign) {
  const triangles = [];
  const center = loopCentroid(outerLoop).add(loopCentroid(innerLoop)).multiplyScalar(0.5);
  const outer = [...outerLoop].sort((a, b) => angleAround(a, center, axis) - angleAround(b, center, axis));
  let inner = [...innerLoop].sort((a, b) => angleAround(a, center, axis) - angleAround(b, center, axis));
  inner = rotateLoopToNearestAngle(inner, angleAround(outer[0], center, axis), center, axis);

  if (outer.length === inner.length) {
    for (let index = 0; index < outer.length; index += 1) {
      const next = (index + 1) % outer.length;
      pushTriangleWithAxisNormal(triangles, outer[index], outer[next], inner[next], axis, desiredNormalSign);
      pushTriangleWithAxisNormal(triangles, outer[index], inner[next], inner[index], axis, desiredNormalSign);
    }
    return triangles;
  }

  const count = Math.max(outer.length, inner.length);
  for (let index = 0; index < count; index += 1) {
    const outerCurrent = outer[Math.floor((index / count) * outer.length) % outer.length];
    const outerNext = outer[Math.floor(((index + 1) / count) * outer.length) % outer.length];
    const innerCurrent = inner[Math.floor((index / count) * inner.length) % inner.length];
    const innerNext = inner[Math.floor(((index + 1) / count) * inner.length) % inner.length];
    pushTriangleWithAxisNormal(triangles, outerCurrent, outerNext, innerNext, axis, desiredNormalSign);
    pushTriangleWithAxisNormal(triangles, outerCurrent, innerNext, innerCurrent, axis, desiredNormalSign);
  }
  return triangles;
}

function triangulateLoop(loop, axis, desiredNormalSign) {
  const unique = normalizeLoopPoints(loop, axis, desiredNormalSign);
  if (!unique) return [];

  const vertices = unique.map((point, index) => ({
    index,
    point,
    projected: projection2D(point, axis),
  }));
  const triangles = [];
  const sign = Math.sign(projectedArea(vertices.map((vertex) => vertex.point), axis)) || 1;
  let guard = vertices.length * vertices.length;

  while (vertices.length > 3 && guard > 0) {
    guard -= 1;
    let clipped = false;
    for (let index = 0; index < vertices.length; index += 1) {
      const previous = vertices[(index - 1 + vertices.length) % vertices.length];
      const current = vertices[index];
      const next = vertices[(index + 1) % vertices.length];
      const cross = (
        (current.projected.x - previous.projected.x) * (next.projected.y - current.projected.y)
        - (current.projected.y - previous.projected.y) * (next.projected.x - current.projected.x)
      ) * sign;
      if (cross <= 1e-10) continue;

      const containsPoint = vertices.some((candidate, candidateIndex) => {
        if (
          candidateIndex === index
          || candidateIndex === (index - 1 + vertices.length) % vertices.length
          || candidateIndex === (index + 1) % vertices.length
        ) {
          return false;
        }
        return pointInTriangle2D(candidate.projected, previous.projected, current.projected, next.projected, sign);
      });
      if (containsPoint) continue;

      triangles.push([previous.point, current.point, next.point]);
      vertices.splice(index, 1);
      clipped = true;
      break;
    }
    if (!clipped) break;
  }

  if (vertices.length === 3) {
    triangles.push([vertices[0].point, vertices[1].point, vertices[2].point]);
  } else if (!triangles.length && unique.length >= 3) {
    for (let index = 1; index < unique.length - 1; index += 1) {
      triangles.push([unique[0], unique[index], unique[index + 1]]);
    }
  }

  return triangles;
}

function triangulateCutLoops(rawLoops, axis, desiredNormalSign) {
  const loops = rawLoops
    .map((loop) => normalizeLoopPoints(loop, axis, desiredNormalSign))
    .filter(Boolean)
    .map((points) => ({
      area: Math.abs(projectedArea(points, axis)),
      centroid: loopCentroid(points),
      points,
      projected: points.map((point) => projection2D(point, axis)),
    }))
    .sort((a, b) => b.area - a.area);
  const used = new Set();
  const triangles = [];

  for (let outerIndex = 0; outerIndex < loops.length; outerIndex += 1) {
    if (used.has(outerIndex)) continue;
    const outer = loops[outerIndex];
    const holes = [];
    for (let candidateIndex = outerIndex + 1; candidateIndex < loops.length; candidateIndex += 1) {
      if (used.has(candidateIndex)) continue;
      const candidate = loops[candidateIndex];
      if (pointInPolygon2D(projection2D(candidate.centroid, axis), outer.projected)) {
        holes.push(candidate);
        used.add(candidateIndex);
      }
    }

    if (holes.length === 1) {
      triangles.push(...triangulateRingBetweenLoops(outer.points, holes[0].points, axis, desiredNormalSign));
    } else {
      triangles.push(...triangulateLoop(outer.points, axis, desiredNormalSign));
    }
    used.add(outerIndex);
  }

  return triangles;
}

function buildCutLoops(segments, tolerance = DEFAULT_TOLERANCE) {
  const vertices = [];
  const vertexByKey = new Map();
  const adjacency = new Map();
  const edgeKeys = new Set();

  const addVertex = (point) => {
    const key = pointKey(point, tolerance);
    if (!vertexByKey.has(key)) {
      vertexByKey.set(key, vertices.length);
      vertices.push(point.clone());
    }
    return vertexByKey.get(key);
  };

  for (const segment of segments) {
    const a = addVertex(segment[0]);
    const b = addVertex(segment[1]);
    if (a === b) continue;
    const key = orderedEdgeKey(a, b);
    if (edgeKeys.has(key)) continue;
    edgeKeys.add(key);
    if (!adjacency.has(a)) adjacency.set(a, new Set());
    if (!adjacency.has(b)) adjacency.set(b, new Set());
    adjacency.get(a).add(b);
    adjacency.get(b).add(a);
  }

  const unused = new Set(edgeKeys);
  const loops = [];
  let openChains = 0;

  while (unused.size) {
    const [startKey] = unused;
    const [start, next] = startKey.split('|').map(Number);
    unused.delete(startKey);
    const loop = [start, next];
    let previous = start;
    let current = next;

    while (current !== start) {
      const candidates = [...(adjacency.get(current) ?? [])]
        .filter((candidate) => candidate !== previous && unused.has(orderedEdgeKey(current, candidate)));
      if (!candidates.length) {
        openChains += 1;
        break;
      }
      const candidate = candidates[0];
      unused.delete(orderedEdgeKey(current, candidate));
      previous = current;
      current = candidate;
      if (current !== start) loop.push(current);
    }

    if (current === start && loop.length >= 3) {
      loops.push(loop.map((index) => vertices[index]));
    }
  }

  return { loops, openChains };
}

export function cutPlaneGeometry(geometry, options = {}) {
  const position = geometry.getAttribute('position');
  if (!position) return null;

  const axisMap = { x: 0, y: 1, z: 2 };
  const axis = axisMap[options.axis] ?? 0;
  const planePosition = Number(options.position);
  if (!Number.isFinite(planePosition)) return null;

  const keepSide = options.keepSide === 'negative' ? 'negative' : 'positive';
  const cap = options.cap !== false;
  const tolerance = Math.max(options.tolerance ?? DEFAULT_TOLERANCE, 1e-8);
  const areaTolerance = Math.max(options.areaTolerance ?? tolerance * tolerance, 1e-16);
  const keepSign = keepSide === 'positive' ? 1 : -1;
  const positions = [];
  const segments = [];
  const total = triangleCount(geometry);
  let keptTriangles = 0;
  let removedTriangles = 0;
  let clippedTriangles = 0;
  let outputTriangles = 0;

  for (let triangle = 0; triangle < total; triangle += 1) {
    const points = [0, 1, 2].map((corner) => vertexAt(geometry, triangle, corner, new THREE.Vector3()));
    const distances = points.map((point) => keepSign * (planeAxisValue(point, axis) - planePosition));
    const isCoplanarSourceFace = options.discardCoplanarFaces === true
      && distances.every((distance) => Math.abs(distance) <= tolerance);
    if (isCoplanarSourceFace) {
      removedTriangles += 1;
      continue;
    }

    const insideCount = distances.filter((distance) => distance >= -tolerance).length;

    if (insideCount === 3) {
      if (pushTrianglePositions(positions, points[0], points[1], points[2], areaTolerance)) {
        keptTriangles += 1;
        outputTriangles += 1;
      }
      continue;
    }
    if (insideCount === 0) {
      removedTriangles += 1;
      continue;
    }

    clippedTriangles += 1;
    const { clipped, intersections } = clipTriangleToHalfSpace(points, distances, axis, planePosition, tolerance);
    for (let index = 1; index < clipped.length - 1; index += 1) {
      if (pushTrianglePositions(positions, clipped[0], clipped[index], clipped[index + 1], areaTolerance)) {
        outputTriangles += 1;
      }
    }
    if (intersections.length >= 2) {
      segments.push([intersections[0], intersections[intersections.length - 1]]);
    }
  }

  let capTriangles = 0;
  let capLoops = 0;
  let openChains = 0;
  if (cap && segments.length) {
    const loops = buildCutLoops(segments, tolerance);
    capLoops = loops.loops.length;
    openChains = loops.openChains;
    const capNormalSign = keepSide === 'positive' ? -1 : 1;
    for (const triangle of triangulateCutLoops(loops.loops, axis, capNormalSign)) {
      if (pushTrianglePositions(positions, triangle[0], triangle[1], triangle[2], areaTolerance)) {
        capTriangles += 1;
        outputTriangles += 1;
      }
    }
  }

  if (!positions.length) return null;
  const result = new THREE.BufferGeometry();
  result.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  result.computeVertexNormals();
  result.computeBoundingBox();
  result.computeBoundingSphere();

  return {
    geometry: result,
    report: {
      capLoops,
      capTriangles,
      clippedTriangles,
      keptTriangles,
      openChains,
      outputTriangles,
      removedTriangles,
      sourceTriangles: total,
    },
  };
}

export function removeMiddleSectionGeometry(geometry, options = {}) {
  const axisMap = { x: 0, y: 1, z: 2 };
  const axis = axisMap[options.axis] ?? 0;
  const start = Number(options.start);
  const end = Number(options.end);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return null;

  const axisKey = ['x', 'y', 'z'][axis];
  const negative = cutPlaneGeometry(geometry, {
    axis: axisKey,
    cap: false,
    keepSide: 'negative',
    position: start,
  });
  const positive = cutPlaneGeometry(geometry, {
    axis: axisKey,
    cap: false,
    keepSide: 'positive',
    position: end,
  });
  if (!negative?.geometry || !positive?.geometry) {
    negative?.geometry?.dispose();
    positive?.geometry?.dispose();
    return null;
  }

  const gap = end - start;
  const translation = new THREE.Vector3();
  setPlaneAxisValue(translation, axis, -gap);
  positive.geometry.translate(translation.x, translation.y, translation.z);

  const result = combineGeometries([negative.geometry, positive.geometry]);
  const report = {
    gap,
    negativeTriangles: triangleCount(negative.geometry),
    positiveTriangles: triangleCount(positive.geometry),
    outputTriangles: result ? triangleCount(result) : 0,
    removedTriangles: negative.report.removedTriangles + positive.report.removedTriangles,
    sourceTriangles: triangleCount(geometry),
  };
  negative.geometry.dispose();
  positive.geometry.dispose();
  if (!result) return null;

  return {
    geometry: result,
    report,
  };
}

function collectBoundaryEdges(cornerKeys, triangleTotal) {
  const edgeMap = new Map();

  for (let triangle = 0; triangle < triangleTotal; triangle += 1) {
    const offset = triangle * 3;
    const triangleKeys = [
      cornerKeys[offset],
      cornerKeys[offset + 1],
      cornerKeys[offset + 2],
    ];

    for (const [fromCorner, toCorner] of [[0, 1], [1, 2], [2, 0]]) {
      const fromKey = triangleKeys[fromCorner];
      const toKey = triangleKeys[toCorner];
      if (fromKey === toKey) continue;
      const key = orderedEdgeKey(fromKey, toKey);
      if (!edgeMap.has(key)) edgeMap.set(key, []);
      edgeMap.get(key).push({ fromKey, toKey });
    }
  }

  const boundaryEdges = [];
  let nonManifoldEdges = 0;
  for (const edges of edgeMap.values()) {
    if (edges.length === 1) boundaryEdges.push(edges[0]);
    else if (edges.length > 2) nonManifoldEdges += 1;
  }

  return { boundaryEdges, nonManifoldEdges };
}

function mergeVertexPlane(planes, normal, constant, tolerance) {
  for (const plane of planes) {
    if (plane.normal.dot(normal) > 0.999 && Math.abs(plane.constant - constant) <= tolerance) {
      plane.weight += 1;
      return;
    }
  }
  planes.push({
    constant,
    normal: normal.clone(),
    weight: 1,
  });
}

function solveSymmetric3(matrix, rhs, target = new THREE.Vector3()) {
  const [
    a00, a01, a02,
    a10, a11, a12,
    a20, a21, a22,
  ] = matrix;
  const det = (
    a00 * (a11 * a22 - a12 * a21)
    - a01 * (a10 * a22 - a12 * a20)
    + a02 * (a10 * a21 - a11 * a20)
  );
  if (Math.abs(det) <= 1e-12) return null;

  const [b0, b1, b2] = rhs;
  target.set(
    (
      b0 * (a11 * a22 - a12 * a21)
      - a01 * (b1 * a22 - a12 * b2)
      + a02 * (b1 * a21 - a11 * b2)
    ) / det,
    (
      a00 * (b1 * a22 - a12 * b2)
      - b0 * (a10 * a22 - a12 * a20)
      + a02 * (a10 * b2 - b1 * a20)
    ) / det,
    (
      a00 * (a11 * b2 - b1 * a21)
      - a01 * (a10 * b2 - b1 * a20)
      + b0 * (a10 * a21 - a11 * a20)
    ) / det,
  );
  return Number.isFinite(target.x) && Number.isFinite(target.y) && Number.isFinite(target.z)
    ? target
    : null;
}

function offsetVertexFromPlanes(vertex, thickness, warnings) {
  if (vertex.planes.length < 3) return null;

  const matrix = new Array(9).fill(0);
  const rhs = [0, 0, 0];
  for (const plane of vertex.planes) {
    const { normal, weight } = plane;
    const targetConstant = plane.constant - thickness;
    matrix[0] += normal.x * normal.x * weight;
    matrix[1] += normal.x * normal.y * weight;
    matrix[2] += normal.x * normal.z * weight;
    matrix[3] += normal.y * normal.x * weight;
    matrix[4] += normal.y * normal.y * weight;
    matrix[5] += normal.y * normal.z * weight;
    matrix[6] += normal.z * normal.x * weight;
    matrix[7] += normal.z * normal.y * weight;
    matrix[8] += normal.z * normal.z * weight;
    rhs[0] += normal.x * targetConstant * weight;
    rhs[1] += normal.y * targetConstant * weight;
    rhs[2] += normal.z * targetConstant * weight;
  }

  const solved = solveSymmetric3(matrix, rhs, new THREE.Vector3());
  if (!solved) return null;

  const displacement = solved.clone().sub(vertex.position);
  if (displacement.length() > Math.max(thickness * 8, thickness + 1)) {
    warnings.push('offset-plane-fallback');
    return null;
  }
  if (displacement.dot(vertex.normal) > 1e-6) {
    warnings.push('offset-plane-outward-fallback');
    return null;
  }
  return solved;
}

export function hollowGeometry(geometry, thickness, options = {}) {
  const wallThickness = Number(thickness);
  if (!(wallThickness > 0)) {
    throw new RangeError('Hollow thickness must be greater than 0.');
  }

  const source = geometry?.index ? geometry.toNonIndexed() : geometry?.clone();
  const position = source?.getAttribute('position');
  if (!position) {
    source?.dispose?.();
    throw new Error('Hollow requires a geometry with positions.');
  }

  const tolerance = Math.max(options.tolerance ?? DEFAULT_TOLERANCE, 1e-8);
  const areaTolerance = Math.max(options.areaTolerance ?? tolerance * tolerance, 1e-16);
  const triangleTotal = Math.floor(position.count / 3);
  const positions = [];
  const cornerKeys = new Array(position.count);
  const vertices = new Map();
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  const normal = new THREE.Vector3();
  const center = new THREE.Vector3();
  const fallback = new THREE.Vector3();

  source.computeBoundingBox();
  source.boundingBox.getCenter(center);

  const ensureVertex = (point) => {
    const key = pointKey(point, tolerance);
    if (!vertices.has(key)) {
      vertices.set(key, {
        count: 0,
        inner: new THREE.Vector3(),
        normal: new THREE.Vector3(),
        planes: [],
        position: new THREE.Vector3(),
      });
    }
    const vertex = vertices.get(key);
    vertex.position.add(point);
    vertex.count += 1;
    return key;
  };

  for (let index = 0; index < position.count; index += 1) {
    a.fromBufferAttribute(position, index);
    cornerKeys[index] = ensureVertex(a);
  }

  for (let triangle = 0; triangle < triangleTotal; triangle += 1) {
    a.fromBufferAttribute(position, triangle * 3);
    b.fromBufferAttribute(position, triangle * 3 + 1);
    c.fromBufferAttribute(position, triangle * 3 + 2);
    normal.subVectors(b, a).cross(new THREE.Vector3().subVectors(c, a));
    if (normal.lengthSq() <= areaTolerance) continue;
    normal.normalize();
    const constants = [
      normal.dot(a),
      normal.dot(b),
      normal.dot(c),
    ];
    vertices.get(cornerKeys[triangle * 3]).normal.add(normal);
    vertices.get(cornerKeys[triangle * 3 + 1]).normal.add(normal);
    vertices.get(cornerKeys[triangle * 3 + 2]).normal.add(normal);
    mergeVertexPlane(vertices.get(cornerKeys[triangle * 3]).planes, normal, constants[0], tolerance);
    mergeVertexPlane(vertices.get(cornerKeys[triangle * 3 + 1]).planes, normal, constants[1], tolerance);
    mergeVertexPlane(vertices.get(cornerKeys[triangle * 3 + 2]).planes, normal, constants[2], tolerance);
  }

  const warnings = [];
  for (const vertex of vertices.values()) {
    vertex.position.multiplyScalar(1 / vertex.count);
    if (vertex.normal.lengthSq() <= 1e-20) {
      fallback.subVectors(vertex.position, center);
      if (fallback.lengthSq() <= 1e-20) fallback.set(0, 0, 1);
      vertex.normal.copy(fallback);
      warnings.push('fallback-normal');
    }
    vertex.normal.normalize();
    const planeOffset = offsetVertexFromPlanes(vertex, wallThickness, warnings);
    if (planeOffset) {
      vertex.inner.copy(planeOffset);
    } else {
      vertex.inner.copy(vertex.position).addScaledVector(vertex.normal, -wallThickness);
    }
  }

  for (let triangle = 0; triangle < triangleTotal; triangle += 1) {
    a.fromBufferAttribute(position, triangle * 3);
    b.fromBufferAttribute(position, triangle * 3 + 1);
    c.fromBufferAttribute(position, triangle * 3 + 2);
    pushTrianglePositions(positions, a, b, c, areaTolerance);

    const innerA = vertices.get(cornerKeys[triangle * 3]).inner;
    const innerB = vertices.get(cornerKeys[triangle * 3 + 1]).inner;
    const innerC = vertices.get(cornerKeys[triangle * 3 + 2]).inner;
    pushTrianglePositions(positions, innerC, innerB, innerA, areaTolerance);
  }

  const { boundaryEdges, nonManifoldEdges } = collectBoundaryEdges(cornerKeys, triangleTotal);
  for (const edge of boundaryEdges) {
    const outerA = vertices.get(edge.fromKey).position;
    const outerB = vertices.get(edge.toKey).position;
    const innerA = vertices.get(edge.fromKey).inner;
    const innerB = vertices.get(edge.toKey).inner;
    pushTrianglePositions(positions, outerA, outerB, innerB, areaTolerance);
    pushTrianglePositions(positions, outerA, innerB, innerA, areaTolerance);
  }

  if (boundaryEdges.length) warnings.push('open-boundary-capped');
  if (nonManifoldEdges) warnings.push('non-manifold-edges');
  if (!positions.length) {
    source.dispose();
    return null;
  }

  const result = new THREE.BufferGeometry();
  result.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  result.computeVertexNormals();
  result.computeBoundingBox();
  result.computeBoundingSphere();
  source.dispose();

  return {
    geometry: result,
    openBoundaryCount: boundaryEdges.length,
    warnings: [...new Set(warnings)],
    report: {
      innerTriangles: triangleTotal,
      nonManifoldEdges,
      openBoundaryCount: boundaryEdges.length,
      outputTriangles: triangleCount(result),
      sourceTriangles: triangleTotal,
      wallTriangles: boundaryEdges.length * 2,
    },
  };
}

export function createPushPullRegionGeometry(geometry, region, distance) {
  const positions = [];
  const sourcePosition = geometry.getAttribute('position');
  const offset = region.normal.clone().multiplyScalar(distance);
  const point = new THREE.Vector3();
  const sourcePoints = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
  const movedPoints = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
  const reverseCaps = distance < 0;

  const addTrianglePoints = (a, b, c) => {
    positions.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
  };

  for (const triangle of region.triangles) {
    for (let corner = 0; corner < 3; corner += 1) {
      point.fromBufferAttribute(sourcePosition, triangle * 3 + corner);
      sourcePoints[corner].copy(point);
      movedPoints[corner].copy(point).add(offset);
    }

    if (reverseCaps) {
      addTrianglePoints(sourcePoints[0], sourcePoints[1], sourcePoints[2]);
      addTrianglePoints(movedPoints[2], movedPoints[1], movedPoints[0]);
    } else {
      addTrianglePoints(movedPoints[0], movedPoints[1], movedPoints[2]);
      addTrianglePoints(sourcePoints[2], sourcePoints[1], sourcePoints[0]);
    }
  }

  for (const edge of collectOpenRegionBoundaryEdges(geometry, region)) {
    const movedStart = edge.start.clone().add(offset);
    const movedEnd = edge.end.clone().add(offset);
    positions.push(
      edge.start.x, edge.start.y, edge.start.z,
      edge.end.x, edge.end.y, edge.end.z,
      movedEnd.x, movedEnd.y, movedEnd.z,
      edge.start.x, edge.start.y, edge.start.z,
      movedEnd.x, movedEnd.y, movedEnd.z,
      movedStart.x, movedStart.y, movedStart.z,
    );
  }

  const result = new THREE.BufferGeometry();
  result.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  result.computeVertexNormals();
  result.computeBoundingBox();
  result.computeBoundingSphere();
  return result;
}

export function regionHasOpenBoundary(geometry, region) {
  return collectOpenRegionBoundaryEdges(geometry, region).length > 0;
}

export function regionHasCoplanarSupport(geometry, region, tolerance = DEFAULT_TOLERANCE) {
  const position = geometry.getAttribute('position');
  if (!position) return false;

  const selected = new Set(region.triangles);
  const selectedBox = new THREE.Box3();
  const point = new THREE.Vector3();
  for (const triangle of region.triangles) {
    for (let corner = 0; corner < 3; corner += 1) {
      selectedBox.expandByPoint(vertexAt(geometry, triangle, corner, point));
    }
  }
  selectedBox.expandByScalar(Math.max(tolerance * 100, 0.01));

  const seedPoint = vertexAt(geometry, region.triangles[0], 0, new THREE.Vector3());
  const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(region.normal, seedPoint);
  const triangleTotal = triangleCount(geometry);

  for (let triangle = 0; triangle < triangleTotal; triangle += 1) {
    if (selected.has(triangle)) continue;
    const normal = triangleNormal(geometry, triangle);
    if (normal.dot(region.normal) < 0.995) continue;

    const triangleBox = new THREE.Box3();
    let coplanar = true;
    for (let corner = 0; corner < 3; corner += 1) {
      const vertex = vertexAt(geometry, triangle, corner, point);
      if (Math.abs(plane.distanceToPoint(vertex)) > Math.max(tolerance * 100, 0.01)) {
        coplanar = false;
        break;
      }
      triangleBox.expandByPoint(vertex);
    }
    if (coplanar && triangleBox.intersectsBox(selectedBox)) return true;
  }

  return false;
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

export function extractTrianglesFromGeometry(geometry, triangleIndexes) {
  const position = geometry.getAttribute('position');
  const index = geometry.getIndex();
  const selected = new Set(triangleIndexes);
  const positions = [];
  const point = new THREE.Vector3();
  const triangleTotal = triangleCount(geometry);

  for (let triangle = 0; triangle < triangleTotal; triangle += 1) {
    if (!selected.has(triangle)) continue;

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

export function findConnectedComponent(geometry, seedTriangle, tolerance = DEFAULT_TOLERANCE) {
  const triangleTotal = triangleCount(geometry);
  if (seedTriangle < 0 || seedTriangle >= triangleTotal) {
    return {
      triangles: [],
    };
  }

  const edgeMap = new Map();
  for (let triangle = 0; triangle < triangleTotal; triangle += 1) {
    const points = [0, 1, 2].map((corner) => vertexAt(geometry, triangle, corner, new THREE.Vector3()));
    for (const [start, end] of [[0, 1], [1, 2], [2, 0]]) {
      const key = edgeKey(points[start], points[end], tolerance);
      if (!edgeMap.has(key)) edgeMap.set(key, []);
      edgeMap.get(key).push(triangle);
    }
  }

  const visited = new Set([seedTriangle]);
  const queue = [seedTriangle];
  for (let index = 0; index < queue.length; index += 1) {
    const triangle = queue[index];
    const points = [0, 1, 2].map((corner) => vertexAt(geometry, triangle, corner, new THREE.Vector3()));
    for (const [start, end] of [[0, 1], [1, 2], [2, 0]]) {
      const key = edgeKey(points[start], points[end], tolerance);
      for (const neighbor of edgeMap.get(key) ?? []) {
        if (visited.has(neighbor)) continue;
        visited.add(neighbor);
        queue.push(neighbor);
      }
    }
  }

  return {
    triangles: queue,
  };
}

export function collectConnectedComponents(geometry, tolerance = DEFAULT_TOLERANCE) {
  const triangleTotal = triangleCount(geometry);
  const edgeMap = new Map();

  for (let triangle = 0; triangle < triangleTotal; triangle += 1) {
    const points = [0, 1, 2].map((corner) => vertexAt(geometry, triangle, corner, new THREE.Vector3()));
    for (const [start, end] of [[0, 1], [1, 2], [2, 0]]) {
      const key = edgeKey(points[start], points[end], tolerance);
      if (!edgeMap.has(key)) edgeMap.set(key, []);
      edgeMap.get(key).push(triangle);
    }
  }

  const visited = new Set();
  const components = [];
  for (let seed = 0; seed < triangleTotal; seed += 1) {
    if (visited.has(seed)) continue;

    const triangles = [];
    const queue = [seed];
    visited.add(seed);

    for (let index = 0; index < queue.length; index += 1) {
      const triangle = queue[index];
      triangles.push(triangle);
      const points = [0, 1, 2].map((corner) => vertexAt(geometry, triangle, corner, new THREE.Vector3()));
      for (const [start, end] of [[0, 1], [1, 2], [2, 0]]) {
        const key = edgeKey(points[start], points[end], tolerance);
        for (const neighbor of edgeMap.get(key) ?? []) {
          if (visited.has(neighbor)) continue;
          visited.add(neighbor);
          queue.push(neighbor);
        }
      }
    }

    components.push({ triangles });
  }

  return components;
}

export function transformTrianglesInGeometry(geometry, triangleIndexes, matrix) {
  const selected = new Set(triangleIndexes);
  const positions = [];
  const point = new THREE.Vector3();
  const triangleTotal = triangleCount(geometry);

  for (let triangle = 0; triangle < triangleTotal; triangle += 1) {
    const shouldTransform = selected.has(triangle);
    for (let corner = 0; corner < 3; corner += 1) {
      vertexAt(geometry, triangle, corner, point);
      if (shouldTransform) point.applyMatrix4(matrix);
      positions.push(point.x, point.y, point.z);
    }
  }

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
