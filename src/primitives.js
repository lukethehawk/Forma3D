import * as THREE from 'three';
import { TextGeometry } from 'three/addons/geometries/TextGeometry.js';

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

export function createConeGeometryFromBase(center, radius, height, axis = new THREE.Vector3(0, 0, 1), segments = 64) {
  const safeRadius = Math.max(radius, 0.05);
  const safeHeight = Math.max(height, 0.1);
  const direction = axis.clone().normalize();
  const geometry = ensureNonIndexed(new THREE.ConeGeometry(safeRadius, safeHeight, segments));
  geometry.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction));
  geometry.translate(
    center.x + direction.x * safeHeight / 2,
    center.y + direction.y * safeHeight / 2,
    center.z + direction.z * safeHeight / 2,
  );
  return normalizeGeometry(geometry);
}

export function createPyramidGeometryFromBase(center, size, height, axis = new THREE.Vector3(0, 0, 1)) {
  const safeSize = new THREE.Vector2(
    Math.max(size.x, 0.1),
    Math.max(size.y, 0.1),
  );
  const safeHeight = Math.max(height, 0.1);
  const direction = axis.clone().normalize();
  const baseX = new THREE.Vector3(1, 0, 0);
  if (Math.abs(baseX.dot(direction)) > 0.95) baseX.set(0, 1, 0);
  baseX.addScaledVector(direction, -baseX.dot(direction)).normalize();
  const baseY = direction.clone().cross(baseX).normalize();
  const corners = [
    center.clone().addScaledVector(baseX, -safeSize.x / 2).addScaledVector(baseY, -safeSize.y / 2),
    center.clone().addScaledVector(baseX, safeSize.x / 2).addScaledVector(baseY, -safeSize.y / 2),
    center.clone().addScaledVector(baseX, safeSize.x / 2).addScaledVector(baseY, safeSize.y / 2),
    center.clone().addScaledVector(baseX, -safeSize.x / 2).addScaledVector(baseY, safeSize.y / 2),
  ];
  const apex = center.clone().addScaledVector(direction, safeHeight);
  const positions = [
    corners[0], corners[2], corners[1],
    corners[0], corners[3], corners[2],
    corners[0], corners[1], apex,
    corners[1], corners[2], apex,
    corners[2], corners[3], apex,
    corners[3], corners[0], apex,
  ].flatMap((point) => [point.x, point.y, point.z]);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  return normalizeGeometry(geometry);
}

export function createExtrudedPolygonGeometry(points, height) {
  const { shape, origin, xAxis, yAxis, normal } = shapeFromPlanarPoints(points);

  const geometry = ensureNonIndexed(new THREE.ExtrudeGeometry(shape, {
    depth: Math.max(height, 0.1),
    bevelEnabled: false,
    steps: 1,
  }));
  geometry.applyMatrix4(new THREE.Matrix4()
    .makeBasis(xAxis, yAxis, normal)
    .setPosition(origin));
  return normalizeGeometry(geometry);
}

export function createPolygonFaceGeometry(points) {
  const { shape, origin, xAxis, yAxis } = shapeFromPlanarPoints(points);
  const geometry = ensureNonIndexed(new THREE.ShapeGeometry(shape));
  geometry.applyMatrix4(new THREE.Matrix4()
    .makeBasis(xAxis, yAxis, new THREE.Vector3().crossVectors(xAxis, yAxis).normalize())
    .setPosition(origin));
  return normalizeGeometry(geometry);
}

function shapeFromPlanarPoints(points) {
  if (points.length < 3) {
    throw new Error('Servono almeno tre punti per creare una faccia.');
  }
  const origin = points[0].clone();
  let normal = new THREE.Vector3();
  for (let index = 1; index < points.length - 1; index += 1) {
    normal.crossVectors(
      points[index].clone().sub(origin),
      points[index + 1].clone().sub(origin),
    );
    if (normal.lengthSq() > 1e-8) break;
  }
  if (normal.lengthSq() < 1e-8) {
    throw new Error('La sagoma deve avere almeno tre punti non allineati.');
  }
  normal.normalize();

  let xAxis = points[1].clone().sub(origin);
  xAxis.addScaledVector(normal, -xAxis.dot(normal));
  if (xAxis.lengthSq() < 1e-8) {
    xAxis = new THREE.Vector3(1, 0, 0);
    xAxis.addScaledVector(normal, -xAxis.dot(normal));
  }
  xAxis.normalize();
  const yAxis = normal.clone().cross(xAxis).normalize();

  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  for (let index = 1; index < points.length; index += 1) {
    const offset = points[index].clone().sub(origin);
    shape.lineTo(offset.dot(xAxis), offset.dot(yAxis));
  }
  shape.closePath();

  return {
    normal,
    origin,
    shape,
    xAxis,
    yAxis,
  };
}

export function createTextGeometryFromBase(base, text, font, options = {}) {
  const content = String(text ?? '').trim();
  if (!content) {
    throw new Error('Inserisci il testo da creare.');
  }
  if (!font) {
    throw new Error('Font non disponibile.');
  }

  const size = Math.max(options.size ?? 12, 0.5);
  const depth = Math.max(options.depth ?? 2, 0.1);
  const widthScale = Math.max(options.widthScale ?? 1, 0.2);
  const bevelSize = Math.max(options.bevelSize ?? 0, 0);
  const italic = Boolean(options.italic);
  const rotationZ = THREE.MathUtils.degToRad(options.rotationZ ?? 0);
  const curveSegments = Math.max(1, Math.min(12, Math.floor(options.curveSegments ?? 5)));
  const bevelSegments = bevelSize > 0
    ? Math.max(1, Math.min(3, Math.floor(options.bevelSegments ?? 1)))
    : 0;
  const direction = options.direction?.isVector3
    ? options.direction.clone()
    : new THREE.Vector3(0, 0, 1);
  if (direction.lengthSq() < 1e-8) direction.set(0, 0, 1);
  direction.normalize();

  const geometry = ensureNonIndexed(new TextGeometry(content, {
    font,
    size,
    depth,
    curveSegments,
    steps: 1,
    bevelEnabled: bevelSize > 0,
    bevelThickness: bevelSize,
    bevelSize,
    bevelSegments,
  }));

  geometry.computeBoundingBox();
  const initialBox = geometry.boundingBox;
  geometry.translate(-initialBox.min.x, -initialBox.min.y, -initialBox.min.z);
  geometry.scale(widthScale, 1, 1);

  if (italic) {
    const shear = new THREE.Matrix4().set(
      1, Math.tan(THREE.MathUtils.degToRad(12)), 0, 0,
      0, 1, 0, 0,
      0, 0, 1, 0,
      0, 0, 0, 1,
    );
    geometry.applyMatrix4(shear);
  }

  geometry.computeBoundingBox();
  const styledBox = geometry.boundingBox;
  geometry.translate(-styledBox.min.x, -styledBox.min.y, -styledBox.min.z);
  geometry.rotateZ(rotationZ);
  geometry.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(
    new THREE.Vector3(0, 0, 1),
    direction,
  ));
  geometry.translate(base.x, base.y, base.z);

  return normalizeGeometry(geometry);
}
