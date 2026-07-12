import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {
  collectConnectedComponents,
  combineGeometries,
  cutPlaneGeometry,
  createPushPullRegionGeometry,
  createDisplayEdgesGeometry,
  collectDisplaySnapPoints,
  deleteTrianglesFromGeometry,
  extractTrianglesFromGeometry,
  findConnectedComponent,
  findCoplanarRegion,
  hollowGeometry,
  modelComplexityInfo,
  pushPullGeometry,
  regionHasCoplanarSupport,
  regionHasOpenBoundary,
  repairMeshGeometry,
  removeMiddleSectionGeometry,
  transformTrianglesInGeometry,
  triangleCount,
} from '../src/geometry.js';

function findTopTriangle(geometry) {
  const position = geometry.getAttribute('position');
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  for (let triangle = 0; triangle < position.count / 3; triangle += 1) {
    a.fromBufferAttribute(position, triangle * 3);
    b.fromBufferAttribute(position, triangle * 3 + 1);
    c.fromBufferAttribute(position, triangle * 3 + 2);
    const normal = b.clone().sub(a).cross(c.clone().sub(a)).normalize();
    if (normal.z > 0.99) return triangle;
  }
  throw new Error('Top triangle not found');
}

function findTrianglesByNormal(geometry, predicate) {
  const total = triangleCount(geometry);
  const result = [];
  for (let triangle = 0; triangle < total; triangle += 1) {
    const a = new THREE.Vector3();
    const b = new THREE.Vector3();
    const c = new THREE.Vector3();
    const position = geometry.getAttribute('position');
    const index = geometry.getIndex();
    const vertex = (corner, target) => {
      const vertexIndex = index ? index.getX(triangle * 3 + corner) : triangle * 3 + corner;
      return target.fromBufferAttribute(position, vertexIndex);
    };
    vertex(0, a);
    vertex(1, b);
    vertex(2, c);
    const normal = b.clone().sub(a).cross(c.clone().sub(a)).normalize();
    if (predicate(normal)) result.push(triangle);
  }
  return result;
}

function countTrianglesOnAxisPlane(geometry, axisName, value, tolerance = 1e-6) {
  const axisIndex = { x: 0, y: 1, z: 2 }[axisName] ?? 0;
  const position = geometry.getAttribute('position');
  const index = geometry.getIndex();
  let count = 0;
  for (let triangle = 0; triangle < triangleCount(geometry); triangle += 1) {
    let coplanar = true;
    for (let corner = 0; corner < 3; corner += 1) {
      const vertexIndex = index ? index.getX(triangle * 3 + corner) : triangle * 3 + corner;
      if (Math.abs(position.getComponent(vertexIndex, axisIndex) - value) > tolerance) {
        coplanar = false;
        break;
      }
    }
    if (coplanar) count += 1;
  }
  return count;
}

function countOpenEdgesByPosition(geometry, tolerance = 1e-5) {
  const position = geometry.getAttribute('position');
  const index = geometry.getIndex();
  const pointKey = (vertexIndex) => [
    Math.round(position.getX(vertexIndex) / tolerance),
    Math.round(position.getY(vertexIndex) / tolerance),
    Math.round(position.getZ(vertexIndex) / tolerance),
  ].join(':');
  const edgeMap = new Map();
  for (let triangle = 0; triangle < triangleCount(geometry); triangle += 1) {
    const vertices = [0, 1, 2].map((corner) => {
      const offset = triangle * 3 + corner;
      return pointKey(index ? index.getX(offset) : offset);
    });
    for (const [from, to] of [[0, 1], [1, 2], [2, 0]]) {
      if (vertices[from] === vertices[to]) continue;
      const key = vertices[from] < vertices[to]
        ? `${vertices[from]}|${vertices[to]}`
        : `${vertices[to]}|${vertices[from]}`;
      edgeMap.set(key, (edgeMap.get(key) ?? 0) + 1);
    }
  }
  return [...edgeMap.values()].filter((count) => count === 1).length;
}

function uniqueAxisValues(geometry, axis) {
  const position = geometry.getAttribute('position');
  const values = new Set();
  for (let index = 0; index < position.count; index += 1) {
    values.add(Number(position.getComponent(index, axis).toFixed(6)));
  }
  return [...values].sort((a, b) => a - b);
}

function hasCapTriangleNearCenter(geometry, axis, planePosition, radius = 0.25) {
  const position = geometry.getAttribute('position');
  const points = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
  for (let triangle = 0; triangle < triangleCount(geometry); triangle += 1) {
    for (let corner = 0; corner < 3; corner += 1) {
      points[corner].fromBufferAttribute(position, triangle * 3 + corner);
    }
    if (points.some((point) => Math.abs(point.getComponent(axis) - planePosition) > 1e-5)) {
      continue;
    }
    const centroid = points[0].clone().add(points[1]).add(points[2]).multiplyScalar(1 / 3);
    const projectedRadius = axis === 0
      ? Math.hypot(centroid.y, centroid.z)
      : axis === 1
        ? Math.hypot(centroid.x, centroid.z)
        : Math.hypot(centroid.x, centroid.y);
    if (projectedRadius < radius) return true;
  }
  return false;
}

test('findCoplanarRegion groups the two triangles of a box face', () => {
  const geometry = new THREE.BoxGeometry(10, 8, 6).toNonIndexed();
  const region = findCoplanarRegion(geometry, findTopTriangle(geometry));
  assert.equal(region.triangles.length, 2);
  assert.ok(region.normal.z > 0.99);
});

test('pushPullGeometry moves a planar cap and stretches the solid', () => {
  const geometry = new THREE.BoxGeometry(10, 8, 6).toNonIndexed();
  const region = findCoplanarRegion(geometry, findTopTriangle(geometry));
  const result = pushPullGeometry(geometry, region, 4);
  result.computeBoundingBox();
  assert.ok(Math.abs(result.boundingBox.max.z - 7) < 1e-6);
  assert.ok(Math.abs(result.boundingBox.min.z + 3) < 1e-6);
});

test('pushPullGeometry extrudes a standalone flat face into a volume', () => {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([
    -5, -5, 0,
    5, -5, 0,
    5, 5, 0,
    -5, -5, 0,
    5, 5, 0,
    -5, 5, 0,
  ], 3));
  geometry.computeVertexNormals();
  const region = findCoplanarRegion(geometry, 0);
  const result = pushPullGeometry(geometry, region, 6);
  result.computeBoundingBox();
  assert.equal(Math.round(result.boundingBox.min.z), 0);
  assert.equal(Math.round(result.boundingBox.max.z), 6);
  assert.ok(triangleCount(result) > triangleCount(geometry));
  assert.equal(result.getAttribute('normal').count, result.getAttribute('position').count);
});

test('regionHasCoplanarSupport recognizes a 2D profile placed on a solid face', () => {
  const box = new THREE.BoxGeometry(20, 20, 6).toNonIndexed();
  const plane = new THREE.BufferGeometry();
  plane.setAttribute('position', new THREE.Float32BufferAttribute([
    -4, -4, 3,
    4, -4, 3,
    4, 4, 3,
    -4, -4, 3,
    4, 4, 3,
    -4, 4, 3,
  ], 3));
  const boxTriangles = triangleCount(box);
  const geometry = combineGeometries([box, plane]);
  const region = findCoplanarRegion(geometry, boxTriangles);
  assert.equal(regionHasOpenBoundary(geometry, region), true);
  assert.equal(regionHasCoplanarSupport(geometry, region), true);
  plane.dispose();
});

test('createPushPullRegionGeometry creates a closed cutter for a supported profile', () => {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([
    -5, -5, 0,
    5, -5, 0,
    5, 5, 0,
    -5, -5, 0,
    5, 5, 0,
    -5, 5, 0,
  ], 3));
  const region = findCoplanarRegion(geometry, 0);
  const cutter = createPushPullRegionGeometry(geometry, region, -4);
  cutter.computeBoundingBox();
  assert.equal(Math.round(cutter.boundingBox.min.z), -4);
  assert.equal(Math.round(cutter.boundingBox.max.z), 0);
  assert.equal(cutter.getAttribute('normal').count, cutter.getAttribute('position').count);
});

test('deleteTrianglesFromGeometry removes a selected planar region', () => {
  const geometry = new THREE.BoxGeometry(10, 8, 6).toNonIndexed();
  const region = findCoplanarRegion(geometry, findTopTriangle(geometry));
  const result = deleteTrianglesFromGeometry(geometry, region.triangles);
  assert.ok(result);
  assert.equal(result.getAttribute('position').count, geometry.getAttribute('position').count - 6);
});

test('deleteTrianglesFromGeometry returns null when no triangles remain', () => {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([
    0, 0, 0,
    1, 0, 0,
    0, 1, 0,
  ], 3));
  assert.equal(deleteTrianglesFromGeometry(geometry, [0]), null);
});

test('triangleCount supports indexed and non-indexed geometry', () => {
  const indexed = new THREE.BoxGeometry(10, 8, 6);
  const nonIndexed = indexed.toNonIndexed();
  assert.equal(triangleCount(indexed), 12);
  assert.equal(triangleCount(nonIndexed), 12);
});

test('modelComplexityInfo classifies triangle ranges and file size', () => {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(9 * 50000), 3));
  const info = modelComplexityInfo({ size: 2 * 1024 * 1024 }, geometry);
  assert.equal(info.fileSizeMb, 2);
  assert.equal(info.triangles, 50000);
  assert.equal(info.vertices, 150000);
  assert.equal(info.level, 'medium');
  assert.equal(info.skipConnectedComponents, false);
});

test('modelComplexityInfo defers connected components above one million triangles', () => {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(9 * 1000001), 3));
  const info = modelComplexityInfo({ size: 0 }, geometry);
  assert.equal(info.level, 'very-large');
  assert.equal(info.isLarge, true);
  assert.equal(info.isVeryLarge, true);
  assert.equal(info.skipConnectedComponents, true);
});

test('cutPlaneGeometry shortens a box and caps the cut side', () => {
  const geometry = new THREE.BoxGeometry(10, 8, 6).toNonIndexed();
  const result = cutPlaneGeometry(geometry, {
    axis: 'x',
    cap: true,
    keepSide: 'negative',
    position: 0,
  });

  assert.ok(result);
  result.geometry.computeBoundingBox();
  assert.ok(Math.abs(result.geometry.boundingBox.min.x + 5) < 1e-6);
  assert.ok(Math.abs(result.geometry.boundingBox.max.x) < 1e-6);
  assert.ok(result.report.removedTriangles > 0);
  assert.ok(result.report.capTriangles > 0);
});

test('cutPlaneGeometry can cut without cap for advanced/debug workflows', () => {
  const geometry = new THREE.BoxGeometry(10, 8, 6).toNonIndexed();
  const result = cutPlaneGeometry(geometry, {
    axis: 'x',
    cap: false,
    keepSide: 'positive',
    position: 0,
  });

  assert.ok(result);
  assert.equal(result.report.capTriangles, 0);
  result.geometry.computeBoundingBox();
  assert.ok(Math.abs(result.geometry.boundingBox.min.x) < 1e-6);
  assert.ok(Math.abs(result.geometry.boundingBox.max.x - 5) < 1e-6);
});

test('cutPlaneGeometry can discard coplanar source faces for split exports', () => {
  const box = new THREE.BoxGeometry(10, 8, 6).toNonIndexed();
  const sheet = new THREE.BufferGeometry();
  sheet.setAttribute('position', new THREE.Float32BufferAttribute([
    0, -2, -2,
    0, 2, -2,
    0, 2, 2,
    0, -2, -2,
    0, 2, 2,
    0, -2, 2,
  ], 3));
  const geometry = combineGeometries([box, sheet]);
  const result = cutPlaneGeometry(geometry, {
    axis: 'x',
    cap: false,
    discardCoplanarFaces: true,
    keepSide: 'positive',
    position: 0,
  });

  assert.ok(result);
  assert.equal(countTrianglesOnAxisPlane(result.geometry, 'x', 0), 0);
  assert.ok(result.report.removedTriangles >= 2);
});

test('cutPlaneGeometry returns null when the kept side is empty', () => {
  const geometry = new THREE.BoxGeometry(10, 8, 6).toNonIndexed();
  const result = cutPlaneGeometry(geometry, {
    axis: 'x',
    keepSide: 'positive',
    position: 10,
  });

  assert.equal(result, null);
});

test('removeMiddleSectionGeometry removes a centered section and closes the gap', () => {
  const geometry = new THREE.BoxGeometry(10, 8, 6).toNonIndexed();
  const result = removeMiddleSectionGeometry(geometry, {
    axis: 'x',
    start: -1,
    end: 1,
  });

  assert.ok(result);
  const repaired = repairMeshGeometry(result.geometry, { planarize: false });
  const output = repaired.geometry.toNonIndexed();
  output.computeBoundingBox();
  assert.ok(Math.abs(output.boundingBox.min.x + 5) < 1e-6);
  assert.ok(Math.abs(output.boundingBox.max.x - 3) < 1e-6);
  assert.equal(Math.round(output.boundingBox.max.x - output.boundingBox.min.x), 8);
  assert.ok(result.report.removedTriangles > 0);
});

test('removeMiddleSectionGeometry caps non-matching cut profiles before closing the gap', () => {
  const geometry = new THREE.CylinderGeometry(2, 4, 10, 32).toNonIndexed();
  const result = removeMiddleSectionGeometry(geometry, {
    axis: 'y',
    start: -1,
    end: 1,
  });

  assert.ok(result);
  assert.ok(result.report.negativeCapTriangles > 0);
  assert.ok(result.report.positiveCapTriangles > 0);
  assert.equal(countOpenEdgesByPosition(result.geometry), 0);
});

test('removeMiddleSectionGeometry returns null when one side would be empty', () => {
  const geometry = new THREE.BoxGeometry(10, 8, 6).toNonIndexed();
  const result = removeMiddleSectionGeometry(geometry, {
    axis: 'x',
    start: -10,
    end: 0,
  });

  assert.equal(result, null);
});

test('hollowGeometry creates an inner shell for a simple box', () => {
  const geometry = new THREE.BoxGeometry(10, 8, 6).toNonIndexed();
  const result = hollowGeometry(geometry, 1);
  assert.ok(result);
  assert.ok(result.geometry);
  assert.ok(triangleCount(result.geometry) > triangleCount(geometry));
  assert.equal(result.report.sourceTriangles, triangleCount(geometry));
  assert.equal(result.openBoundaryCount, 0);
  result.geometry.computeBoundingBox();
  assert.ok(Math.abs(result.geometry.boundingBox.max.x - 5) < 1e-6);
  assert.ok(Math.abs(result.geometry.boundingBox.min.x + 5) < 1e-6);
  assert.deepEqual(uniqueAxisValues(result.geometry, 0), [-5, -4, 4, 5]);
  assert.deepEqual(uniqueAxisValues(result.geometry, 1), [-4, -3, 3, 4]);
  assert.deepEqual(uniqueAxisValues(result.geometry, 2), [-3, -2, 2, 3]);
});

test('hollowGeometry rejects invalid wall thickness', () => {
  const geometry = new THREE.BoxGeometry(10, 8, 6).toNonIndexed();
  assert.throws(() => hollowGeometry(geometry, 0), /greater than 0/);
  assert.throws(() => hollowGeometry(geometry, -1), /greater than 0/);
});

test('hollowGeometry closes open boundary edges with side walls', () => {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([
    -5, -5, 0,
    5, -5, 0,
    5, 5, 0,
    -5, -5, 0,
    5, 5, 0,
    -5, 5, 0,
  ], 3));
  const result = hollowGeometry(geometry, 1);
  assert.ok(result);
  assert.equal(result.openBoundaryCount, 4);
  assert.equal(result.report.wallTriangles, 8);
  assert.equal(triangleCount(result.geometry), triangleCount(geometry) * 2 + 8);
});

test('repairMeshGeometry can preserve inverted hollow inner winding', () => {
  const geometry = new THREE.BoxGeometry(10, 8, 6).toNonIndexed();
  const hollow = hollowGeometry(geometry, 1);
  const repaired = repairMeshGeometry(hollow.geometry, {
    planarize: false,
    preserveWinding: true,
  });
  assert.ok(repaired);
  assert.equal(repaired.report.flippedTriangles, 0);
  assert.equal(triangleCount(repaired.geometry), triangleCount(hollow.geometry));
});

test('side shorten can repair a hollow mesh without flipping the inner shell', () => {
  const geometry = new THREE.BoxGeometry(20, 10, 8).toNonIndexed();
  const hollow = hollowGeometry(geometry, 1);
  const shortened = cutPlaneGeometry(hollow.geometry, {
    axis: 'x',
    cap: true,
    keepSide: 'negative',
    position: 2,
  });
  const repaired = repairMeshGeometry(shortened.geometry, {
    planarize: false,
    preserveWinding: true,
  });
  assert.ok(repaired);
  assert.equal(repaired.report.flippedTriangles, 0);
  assert.ok(triangleCount(repaired.geometry) >= triangleCount(shortened.geometry) - 2);
});

test('side shorten caps a hollow box as a wall ring instead of filling the cavity', () => {
  const geometry = new THREE.BoxGeometry(20, 10, 8).toNonIndexed();
  const hollow = hollowGeometry(geometry, 1);
  const shortened = cutPlaneGeometry(hollow.geometry, {
    axis: 'x',
    cap: true,
    keepSide: 'negative',
    position: 0,
  });
  assert.ok(shortened);
  assert.equal(hasCapTriangleNearCenter(shortened.geometry, 0, 0), false);
  assert.ok(shortened.report.capTriangles > 0);
});

test('combineGeometries appends geometry positions without a boolean operation', () => {
  const first = new THREE.BoxGeometry(10, 8, 6);
  const second = new THREE.BoxGeometry(2, 2, 2).toNonIndexed();
  const combined = combineGeometries([first, second]);
  assert.ok(combined);
  assert.equal(triangleCount(combined), triangleCount(first) + triangleCount(second));
});

test('findConnectedComponent selects only the clicked separate body', () => {
  const first = new THREE.BoxGeometry(10, 8, 6).toNonIndexed();
  const second = new THREE.BoxGeometry(2, 2, 2).toNonIndexed();
  second.translate(30, 0, 0);
  const combined = combineGeometries([first, second]);
  const firstTriangles = triangleCount(first);
  const secondComponent = findConnectedComponent(combined, firstTriangles);
  assert.equal(secondComponent.triangles.length, triangleCount(second));
  assert.equal(secondComponent.triangles.includes(0), false);
});

test('collectConnectedComponents enumerates separate bodies', () => {
  const left = new THREE.BoxGeometry(4, 4, 4).toNonIndexed();
  const right = new THREE.BoxGeometry(4, 4, 4).toNonIndexed();
  right.translate(10, 0, 0);
  const geometry = combineGeometries([left, right]);

  const components = collectConnectedComponents(geometry);

  assert.equal(components.length, 2);
  assert.deepEqual(components.map((component) => component.triangles.length), [12, 12]);
});

test('extractTrianglesFromGeometry returns only the requested body', () => {
  const left = new THREE.BoxGeometry(4, 4, 4).toNonIndexed();
  const right = new THREE.BoxGeometry(4, 4, 4).toNonIndexed();
  right.translate(10, 0, 0);
  const geometry = combineGeometries([left, right]);
  const [component] = collectConnectedComponents(geometry);

  const extracted = extractTrianglesFromGeometry(geometry, component.triangles);

  assert.equal(triangleCount(extracted), 12);
  extracted.computeBoundingBox();
  assert.ok(extracted.boundingBox.max.x < 3);
});

test('transformTrianglesInGeometry moves only selected triangles', () => {
  const first = new THREE.BoxGeometry(10, 8, 6).toNonIndexed();
  const second = new THREE.BoxGeometry(2, 2, 2).toNonIndexed();
  second.translate(30, 0, 0);
  const combined = combineGeometries([first, second]);
  const firstTriangles = triangleCount(first);
  const secondComponent = findConnectedComponent(combined, firstTriangles);
  const matrix = new THREE.Matrix4().makeTranslation(0, 20, 0);
  const result = transformTrianglesInGeometry(combined, secondComponent.triangles, matrix);
  const originalFirstVertex = new THREE.Vector3().fromBufferAttribute(combined.getAttribute('position'), 0);
  const originalMovedVertex = new THREE.Vector3().fromBufferAttribute(combined.getAttribute('position'), firstTriangles * 3);
  const firstVertex = new THREE.Vector3().fromBufferAttribute(result.getAttribute('position'), 0);
  const movedVertex = new THREE.Vector3().fromBufferAttribute(result.getAttribute('position'), firstTriangles * 3);
  assert.equal(firstVertex.y, originalFirstVertex.y);
  assert.equal(Math.round(movedVertex.y - originalMovedVertex.y), 20);
});

test('createDisplayEdgesGeometry keeps the visible box outline', () => {
  const geometry = new THREE.BoxGeometry(10, 8, 6).toNonIndexed();
  const edges = createDisplayEdgesGeometry(geometry, 80);
  assert.ok(edges);
  assert.equal(edges.getAttribute('position').count, 24);
});

test('createDisplayEdgesGeometry hides coplanar triangulation boundaries but keeps open contours', () => {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([
    0, 0, 0,
    10, 0, 0,
    10, 10, 0,
    0, 0, 0,
    10, 10, 0,
    0, 10, 0,
  ], 3));
  const edges = createDisplayEdgesGeometry(geometry, 80);
  assert.ok(edges);
  assert.equal(edges.getAttribute('position').count, 8);
});

test('collectDisplaySnapPoints exposes visible edge vertices, midpoints and face centers', () => {
  const geometry = new THREE.BoxGeometry(10, 8, 6).toNonIndexed();
  const targets = collectDisplaySnapPoints(geometry, 80);
  assert.equal(targets.filter((target) => target.kind === 'vertice').length, 8);
  assert.equal(targets.filter((target) => target.kind === 'punto medio').length, 12);
  assert.equal(targets.filter((target) => target.kind === 'centro faccia').length, 6);
});

test('repairMeshGeometry welds coincident vertices and removes invalid triangles', () => {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([
    0, 0, 0,
    1, 0, 0,
    0, 1, 0,
    0, 0, 0,
    1, 0, 0,
    0, 1, 0.00001,
    0, 0, 0,
    0, 0, 0,
    0, 1, 0,
  ], 3));

  const repaired = repairMeshGeometry(geometry, { tolerance: 0.001 });

  assert.ok(repaired);
  assert.equal(repaired.report.trianglesBefore, 3);
  assert.equal(repaired.report.trianglesAfter, 1);
  assert.equal(repaired.report.verticesAfter, 3);
  assert.equal(repaired.report.removedDuplicateTriangles, 1);
  assert.equal(repaired.report.removedDegenerateTriangles, 1);
  assert.equal(triangleCount(repaired.geometry), 1);
});

test('repairMeshGeometry planarizes vertices near large flat faces', () => {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([
    0, 0, 0,
    10, 0, 0,
    10, 10, 0,
    0, 0, 0,
    10, 10, 0,
    0, 10, 0,
    2, 2, 0.03,
    4, 2, 0,
    2, 4, 0,
  ], 3));

  const repaired = repairMeshGeometry(geometry, { tolerance: 0.001, planarizeTolerance: 0.05 });
  const position = repaired.geometry.getAttribute('position');
  const point = new THREE.Vector3();
  let maxZ = 0;
  for (let index = 0; index < position.count; index += 1) {
    point.fromBufferAttribute(position, index);
    maxZ = Math.max(maxZ, Math.abs(point.z));
  }

  assert.ok(repaired.report.planarizedVertices >= 1);
  assert.ok(maxZ < 1e-8);
});

test('repairMeshGeometry reports open boundary edges', () => {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([
    0, 0, 0,
    1, 0, 0,
    0, 1, 0,
  ], 3));

  const repaired = repairMeshGeometry(geometry);

  assert.ok(repaired);
  assert.equal(repaired.report.boundaryEdges, 3);
  assert.equal(repaired.report.boundaryLoops, 1);
  assert.equal(repaired.report.nonManifoldEdges, 0);
});

test('repairMeshGeometry closes a simple planar box hole conservatively', () => {
  const box = new THREE.BoxGeometry(10, 10, 10).toNonIndexed();
  const topTriangles = findTrianglesByNormal(box, (normal) => normal.z > 0.99);
  const openBox = deleteTrianglesFromGeometry(box, topTriangles);

  const repaired = repairMeshGeometry(openBox, { planarize: false });

  assert.ok(repaired);
  assert.equal(repaired.report.filledHoles, 1);
  assert.equal(repaired.report.addedTriangles, 2);
  assert.equal(repaired.report.boundaryEdges, 0);
  assert.equal(triangleCount(repaired.geometry), 12);
});

test('repairMeshGeometry does not close loops above the conservative edge limit', () => {
  const box = new THREE.BoxGeometry(10, 10, 10).toNonIndexed();
  const topTriangles = findTrianglesByNormal(box, (normal) => normal.z > 0.99);
  const openBox = deleteTrianglesFromGeometry(box, topTriangles);

  const repaired = repairMeshGeometry(openBox, {
    maxHoleEdges: 3,
    planarize: false,
  });

  assert.ok(repaired);
  assert.equal(repaired.report.filledHoles, 0);
  assert.equal(repaired.report.addedTriangles, 0);
  assert.equal(repaired.report.boundaryEdges, 4);
  assert.ok(repaired.report.warnings.includes('hole-fill-skipped-large-loop'));
});

test('repairMeshGeometry reports multiple components without removing them by default', () => {
  const box = new THREE.BoxGeometry(10, 10, 10).toNonIndexed();
  const speck = new THREE.BufferGeometry();
  speck.setAttribute('position', new THREE.Float32BufferAttribute([
    30, 0, 0,
    31, 0, 0,
    30, 1, 0,
  ], 3));
  const geometry = combineGeometries([box, speck]);

  const repaired = repairMeshGeometry(geometry, { planarize: false });

  assert.ok(repaired);
  assert.equal(repaired.report.components, 2);
  assert.equal(repaired.report.removedSmallComponents, 0);
  assert.ok(repaired.report.warnings.includes('small-components-detected'));
});

test('repairMeshGeometry removes small components only when explicitly enabled', () => {
  const box = new THREE.BoxGeometry(10, 10, 10).toNonIndexed();
  const speck = new THREE.BufferGeometry();
  speck.setAttribute('position', new THREE.Float32BufferAttribute([
    30, 0, 0,
    31, 0, 0,
    30, 1, 0,
  ], 3));
  const geometry = combineGeometries([box, speck]);

  const repaired = repairMeshGeometry(geometry, {
    minComponentTriangles: 2,
    planarize: false,
    removeSmallComponents: true,
  });

  assert.ok(repaired);
  assert.equal(repaired.report.components, 1);
  assert.equal(repaired.report.removedSmallComponents, 1);
  assert.equal(triangleCount(repaired.geometry), 12);
});
