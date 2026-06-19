import * as THREE from 'three';

export function normalizeGeometry(geometry) {
  geometry.deleteAttribute('uv');
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

function ensureNonIndexed(geometry) {
  return geometry.index ? geometry.toNonIndexed() : geometry;
}

export function createBoxGeometryFromBase(center, size) {
  const geometry = ensureNonIndexed(new THREE.BoxGeometry(
    Math.max(size.x, 0.1),
    Math.max(size.y, 0.1),
    Math.max(size.z, 0.1),
  ));
  geometry.translate(center.x, center.y, center.z + size.z / 2);
  return normalizeGeometry(geometry);
}

export function createCylinderGeometryFromBase(center, radius, height, axis = new THREE.Vector3(0, 0, 1), segments = 64) {
  const safeRadius = Math.max(radius, 0.05);
  const safeHeight = Math.max(height, 0.1);
  const direction = axis.clone().normalize();
  const geometry = ensureNonIndexed(new THREE.CylinderGeometry(safeRadius, safeRadius, safeHeight, segments));
  geometry.quaternion = undefined;
  geometry.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction));
  geometry.translate(
    center.x + direction.x * safeHeight / 2,
    center.y + direction.y * safeHeight / 2,
    center.z + direction.z * safeHeight / 2,
  );
  return normalizeGeometry(geometry);
}

export function createExtrudedPolygonGeometry(points, height) {
  if (points.length < 3) {
    throw new Error('Servono almeno tre punti per creare una faccia.');
  }

  const z = points[0].z;
  const shape = new THREE.Shape();
  shape.moveTo(points[0].x, points[0].y);
  for (let index = 1; index < points.length; index += 1) {
    shape.lineTo(points[index].x, points[index].y);
  }
  shape.closePath();

  const geometry = ensureNonIndexed(new THREE.ExtrudeGeometry(shape, {
    depth: Math.max(height, 0.1),
    bevelEnabled: false,
    steps: 1,
  }));
  geometry.translate(0, 0, z);
  return normalizeGeometry(geometry);
}
