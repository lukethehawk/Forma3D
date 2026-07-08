import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {
  combineGeometries,
  createDisplayEdgesGeometry,
  collectDisplaySnapPoints,
  deleteTrianglesFromGeometry,
  findCoplanarRegion,
  pushPullGeometry,
  repairMeshGeometry,
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

test('combineGeometries appends geometry positions without a boolean operation', () => {
  const first = new THREE.BoxGeometry(10, 8, 6);
  const second = new THREE.BoxGeometry(2, 2, 2).toNonIndexed();
  const combined = combineGeometries([first, second]);
  assert.ok(combined);
  assert.equal(triangleCount(combined), triangleCount(first) + triangleCount(second));
});

test('createDisplayEdgesGeometry keeps the visible box outline', () => {
  const geometry = new THREE.BoxGeometry(10, 8, 6).toNonIndexed();
  const edges = createDisplayEdgesGeometry(geometry, 80);
  assert.ok(edges);
  assert.equal(edges.getAttribute('position').count, 24);
});

test('collectDisplaySnapPoints exposes visible edge vertices and midpoints', () => {
  const geometry = new THREE.BoxGeometry(10, 8, 6).toNonIndexed();
  const targets = collectDisplaySnapPoints(geometry, 80);
  assert.equal(targets.filter((target) => target.kind === 'vertice').length, 8);
  assert.equal(targets.filter((target) => target.kind === 'punto medio').length, 12);
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
  assert.equal(repaired.report.nonManifoldEdges, 0);
});
