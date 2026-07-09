import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { FontLoader } from 'three/addons/loaders/FontLoader.js';
import helvetikerRegularData from 'three/examples/fonts/helvetiker_regular.typeface.json' with { type: 'json' };
import {
  createBoxGeometryFromBase,
  createConeGeometryFromBase,
  createCylinderGeometryFromBase,
  createExtrudedPolygonGeometry,
  createGearGeometryFromBase,
  createPlaneGeometryFromBase,
  createPyramidGeometryFromBase,
  createPolygonFaceGeometry,
  createTextGeometryFromBase,
} from '../src/primitives.js';

const testFont = new FontLoader().parse(helvetikerRegularData);

test('createBoxGeometryFromBase places the base on the picked point z', () => {
  const geometry = createBoxGeometryFromBase(
    new THREE.Vector3(10, 20, 3),
    new THREE.Vector3(8, 6, 4),
  );
  geometry.computeBoundingBox();
  assert.equal(geometry.boundingBox.min.z, 3);
  assert.equal(geometry.boundingBox.max.z, 7);
});

test('createCylinderGeometryFromBase extrudes along the chosen axis', () => {
  const geometry = createCylinderGeometryFromBase(
    new THREE.Vector3(1, 2, 3),
    2,
    10,
    new THREE.Vector3(1, 0, 0),
  );
  geometry.computeBoundingBox();
  assert.equal(Math.round(geometry.boundingBox.min.x), 1);
  assert.equal(Math.round(geometry.boundingBox.max.x), 11);
});

test('createConeGeometryFromBase extrudes from the picked base', () => {
  const geometry = createConeGeometryFromBase(
    new THREE.Vector3(0, 0, 2),
    4,
    9,
    new THREE.Vector3(0, 0, 1),
  );
  geometry.computeBoundingBox();
  assert.equal(Math.round(geometry.boundingBox.min.z), 2);
  assert.equal(Math.round(geometry.boundingBox.max.z), 11);
});

test('createPyramidGeometryFromBase creates a square-based pyramid', () => {
  const geometry = createPyramidGeometryFromBase(
    new THREE.Vector3(0, 0, 3),
    new THREE.Vector2(8, 6),
    10,
    new THREE.Vector3(0, 0, 1),
  );
  geometry.computeBoundingBox();
  assert.equal(Math.round(geometry.boundingBox.min.z), 3);
  assert.equal(Math.round(geometry.boundingBox.max.z), 13);
  assert.equal(Math.round(geometry.boundingBox.max.x - geometry.boundingBox.min.x), 8);
});

test('createPlaneGeometryFromBase creates a flat circle on the requested plane', () => {
  const geometry = createPlaneGeometryFromBase(
    new THREE.Vector3(2, 0, 0),
    'circle',
    new THREE.Vector2(8, 8),
    new THREE.Vector3(1, 0, 0),
    24,
  );
  geometry.computeBoundingBox();
  assert.equal(Math.round(geometry.boundingBox.min.x), 2);
  assert.equal(Math.round(geometry.boundingBox.max.x), 2);
  assert.equal(Math.round(geometry.boundingBox.max.y - geometry.boundingBox.min.y), 8);
  assert.equal(Math.round(geometry.boundingBox.max.z - geometry.boundingBox.min.z), 8);
});

test('createGearGeometryFromBase creates a valid default gear', () => {
  const geometry = createGearGeometryFromBase(new THREE.Vector3(0, 0, 2));
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  assert.ok(geometry.getAttribute('position').count > 0);
  assert.ok(geometry.boundingSphere.radius > 0);
  assert.equal(Math.round(geometry.boundingBox.min.z), 2);
  assert.equal(Math.round(geometry.boundingBox.max.z), 10);
});

test('createGearGeometryFromBase increases vertices with tooth count', () => {
  const small = createGearGeometryFromBase(new THREE.Vector3(), { teeth: 12, quality: 'medium' });
  const large = createGearGeometryFromBase(new THREE.Vector3(), { teeth: 36, quality: 'medium' });
  assert.ok(large.getAttribute('position').count > small.getAttribute('position').count);
});

test('createGearGeometryFromBase clamps bore and keeps finite positions', () => {
  const geometry = createGearGeometryFromBase(new THREE.Vector3(), {
    boreDiameter: 100,
    module: 1,
    teeth: 8,
    width: 2,
  });
  const position = geometry.getAttribute('position');
  for (let index = 0; index < position.count; index += 1) {
    assert.ok(Number.isFinite(position.getX(index)));
    assert.ok(Number.isFinite(position.getY(index)));
    assert.ok(Number.isFinite(position.getZ(index)));
  }
  geometry.computeBoundingBox();
  assert.ok(geometry.boundingBox.max.z > geometry.boundingBox.min.z);
});

test('createGearGeometryFromBase supports oriented base extrusion', () => {
  const geometry = createGearGeometryFromBase(
    new THREE.Vector3(1, 2, 3),
    { width: 6, teeth: 16, module: 1.5 },
    new THREE.Vector3(1, 0, 0),
  );
  geometry.computeBoundingBox();
  assert.equal(Math.round(geometry.boundingBox.min.x), 1);
  assert.equal(Math.round(geometry.boundingBox.max.x), 7);
});

test('createExtrudedPolygonGeometry creates a solid from a closed 2D face', () => {
  const geometry = createExtrudedPolygonGeometry(
    [
      new THREE.Vector3(0, 0, 2),
      new THREE.Vector3(10, 0, 2),
      new THREE.Vector3(10, 10, 2),
      new THREE.Vector3(0, 10, 2),
    ],
    5,
  );
  geometry.computeBoundingBox();
  assert.equal(geometry.boundingBox.min.z, 2);
  assert.equal(geometry.boundingBox.max.z, 7);
});

test('createExtrudedPolygonGeometry supports vertical sketch planes', () => {
  const geometry = createExtrudedPolygonGeometry(
    [
      new THREE.Vector3(0, 2, 0),
      new THREE.Vector3(0, 2, 10),
      new THREE.Vector3(10, 2, 0),
    ],
    4,
  );
  geometry.computeBoundingBox();
  assert.equal(Math.round(geometry.boundingBox.min.y), 2);
  assert.equal(Math.round(geometry.boundingBox.max.y), 6);
  assert.equal(Math.round(geometry.boundingBox.max.z), 10);
});

test('createPolygonFaceGeometry creates a flat vertical face', () => {
  const geometry = createPolygonFaceGeometry([
    new THREE.Vector3(0, 2, 0),
    new THREE.Vector3(0, 2, 10),
    new THREE.Vector3(10, 2, 0),
  ]);
  geometry.computeBoundingBox();
  assert.equal(Math.round(geometry.boundingBox.min.y), 2);
  assert.equal(Math.round(geometry.boundingBox.max.y), 2);
  assert.equal(Math.round(geometry.boundingBox.max.z), 10);
});

test('createTextGeometryFromBase creates extruded text from the picked base point', () => {
  const geometry = createTextGeometryFromBase(
    new THREE.Vector3(4, 5, 2),
    'A',
    testFont,
    { size: 10, depth: 3, widthScale: 1.4 },
  );
  geometry.computeBoundingBox();
  assert.equal(Math.round(geometry.boundingBox.min.x), 4);
  assert.equal(Math.round(geometry.boundingBox.min.y), 5);
  assert.equal(Math.round(geometry.boundingBox.min.z), 2);
  assert.equal(Math.round(geometry.boundingBox.max.z), 5);
  assert.ok(geometry.boundingBox.max.x - geometry.boundingBox.min.x > 10);
});

test('createTextGeometryFromBase extrudes text along the requested direction', () => {
  const geometry = createTextGeometryFromBase(
    new THREE.Vector3(4, 5, 2),
    'A',
    testFont,
    {
      size: 10,
      depth: 3,
      direction: new THREE.Vector3(0, 0, -1),
    },
  );
  geometry.computeBoundingBox();
  assert.equal(Math.round(geometry.boundingBox.max.z), 2);
  assert.equal(Math.round(geometry.boundingBox.min.z), -1);
});

test('createTextGeometryFromBase supports readable inward engraving by offsetting the base', () => {
  const geometry = createTextGeometryFromBase(
    new THREE.Vector3(4, 5, -1),
    'A',
    testFont,
    {
      size: 10,
      depth: 3,
      direction: new THREE.Vector3(0, 0, 1),
    },
  );
  geometry.computeBoundingBox();
  assert.equal(Math.round(geometry.boundingBox.max.z), 2);
  assert.equal(Math.round(geometry.boundingBox.min.z), -1);
  assert.equal(Math.round(geometry.boundingBox.min.x), 4);
  assert.equal(Math.round(geometry.boundingBox.min.y), 5);
});

