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
  const { direction, xAxis: baseX, yAxis: baseY } = planeBasisFromNormal(axis);
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

function planeBasisFromNormal(normal) {
  const direction = normal.clone();
  if (direction.lengthSq() < 1e-8) direction.set(0, 0, 1);
  direction.normalize();
  const xAxis = new THREE.Vector3(1, 0, 0);
  if (Math.abs(xAxis.dot(direction)) > 0.95) xAxis.set(0, 1, 0);
  xAxis.addScaledVector(direction, -xAxis.dot(direction)).normalize();
  const yAxis = direction.clone().cross(xAxis).normalize();
  return { direction, xAxis, yAxis };
}

export function createPlaneGeometryFromBase(
  center,
  shape = 'rectangle',
  size = new THREE.Vector2(20, 20),
  axis = new THREE.Vector3(0, 0, 1),
  segments = 64,
) {
  const safeSize = new THREE.Vector2(
    Math.max(size.x, 0.1),
    Math.max(size.y, 0.1),
  );
  const { xAxis, yAxis } = planeBasisFromNormal(axis);
  const positions = [];

  const addTriangle = (a, b, c) => {
    positions.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
  };

  if (shape === 'circle') {
    const radius = Math.max(safeSize.x / 2, 0.05);
    const safeSegments = Math.max(12, Math.min(128, Math.floor(segments)));
    for (let index = 0; index < safeSegments; index += 1) {
      const a0 = (index / safeSegments) * Math.PI * 2;
      const a1 = ((index + 1) / safeSegments) * Math.PI * 2;
      const p0 = center.clone()
        .addScaledVector(xAxis, Math.cos(a0) * radius)
        .addScaledVector(yAxis, Math.sin(a0) * radius);
      const p1 = center.clone()
        .addScaledVector(xAxis, Math.cos(a1) * radius)
        .addScaledVector(yAxis, Math.sin(a1) * radius);
      addTriangle(center, p0, p1);
    }
  } else {
    const width = safeSize.x;
    const depth = shape === 'square' ? safeSize.x : safeSize.y;
    const corners = [
      center.clone().addScaledVector(xAxis, -width / 2).addScaledVector(yAxis, -depth / 2),
      center.clone().addScaledVector(xAxis, width / 2).addScaledVector(yAxis, -depth / 2),
      center.clone().addScaledVector(xAxis, width / 2).addScaledVector(yAxis, depth / 2),
      center.clone().addScaledVector(xAxis, -width / 2).addScaledVector(yAxis, depth / 2),
    ];
    addTriangle(corners[0], corners[1], corners[2]);
    addTriangle(corners[0], corners[2], corners[3]);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  return normalizeGeometry(geometry);
}

const GEAR_QUALITY = {
  low: { flankSteps: 1, tipSteps: 1, circleSegments: 16 },
  medium: { flankSteps: 2, tipSteps: 2, circleSegments: 32 },
  high: { flankSteps: 3, tipSteps: 4, circleSegments: 64 },
};

function clampNumber(value, min, max, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return THREE.MathUtils.clamp(number, min, max);
}

function polarPoint(radius, angle) {
  return new THREE.Vector2(Math.cos(angle) * radius, Math.sin(angle) * radius);
}

function addProfileSegment(points, start, end, steps) {
  const count = Math.max(1, Math.floor(steps));
  for (let index = 1; index <= count; index += 1) {
    const t = index / count;
    points.push({
      angle: THREE.MathUtils.lerp(start.angle, end.angle, t),
      radius: THREE.MathUtils.lerp(start.radius, end.radius, t),
    });
  }
}

function createGearProfile({ teeth, module, boreRadius, backlash, quality }) {
  const settings = GEAR_QUALITY[quality] ?? GEAR_QUALITY.medium;
  const pitchRadius = (teeth * module) / 2;
  const outerRadius = pitchRadius + module;
  const margin = Math.max(0.2, module * 0.25);
  const rootRadius = Math.max(pitchRadius - module * 1.25, boreRadius + margin, margin);
  const shoulderRadius = pitchRadius + module * 0.25;
  const toothAngle = (Math.PI * 2) / teeth;
  const backlashAngle = THREE.MathUtils.clamp(
    backlash / Math.max(pitchRadius, 0.1),
    0,
    toothAngle * 0.08,
  );
  const profile = [];

  for (let tooth = 0; tooth < teeth; tooth += 1) {
    const start = tooth * toothAngle;
    const anchors = [
      { angle: start, radius: rootRadius },
      { angle: start + toothAngle * 0.18 + backlashAngle, radius: shoulderRadius },
      { angle: start + toothAngle * 0.32 + backlashAngle, radius: outerRadius },
      { angle: start + toothAngle * 0.68 - backlashAngle, radius: outerRadius },
      { angle: start + toothAngle * 0.82 - backlashAngle, radius: shoulderRadius },
      { angle: start + toothAngle, radius: rootRadius },
    ];

    if (tooth === 0) profile.push(anchors[0]);
    addProfileSegment(profile, anchors[0], anchors[1], settings.flankSteps);
    addProfileSegment(profile, anchors[1], anchors[2], settings.flankSteps);
    addProfileSegment(profile, anchors[2], anchors[3], settings.tipSteps);
    addProfileSegment(profile, anchors[3], anchors[4], settings.flankSteps);
    if (tooth < teeth - 1) addProfileSegment(profile, anchors[4], anchors[5], settings.flankSteps);
  }

  return {
    outerRadius,
    points: profile.map((point) => polarPoint(point.radius, point.angle)),
    rootRadius,
  };
}

function pushTriangle(positions, a, b, c) {
  positions.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
}

function makePoint2D(point, z) {
  return new THREE.Vector3(point.x, point.y, z);
}

function appendExtrudedRing(positions, outerPoints, innerRadius, zMin, zMax) {
  const centerBottom = new THREE.Vector3(0, 0, zMin);
  const centerTop = new THREE.Vector3(0, 0, zMax);
  const hasHole = innerRadius > 0;

  for (let index = 0; index < outerPoints.length; index += 1) {
    const next = (index + 1) % outerPoints.length;
    const outerA = outerPoints[index];
    const outerB = outerPoints[next];
    const bottomA = makePoint2D(outerA, zMin);
    const bottomB = makePoint2D(outerB, zMin);
    const topA = makePoint2D(outerA, zMax);
    const topB = makePoint2D(outerB, zMax);

    pushTriangle(positions, bottomA, bottomB, topB);
    pushTriangle(positions, bottomA, topB, topA);

    if (hasHole) {
      const angleA = Math.atan2(outerA.y, outerA.x);
      const angleB = Math.atan2(outerB.y, outerB.x);
      const innerA2 = polarPoint(innerRadius, angleA);
      const innerB2 = polarPoint(innerRadius, angleB);
      const innerBottomA = makePoint2D(innerA2, zMin);
      const innerBottomB = makePoint2D(innerB2, zMin);
      const innerTopA = makePoint2D(innerA2, zMax);
      const innerTopB = makePoint2D(innerB2, zMax);

      pushTriangle(positions, topA, topB, innerTopB);
      pushTriangle(positions, topA, innerTopB, innerTopA);
      pushTriangle(positions, bottomA, innerBottomB, bottomB);
      pushTriangle(positions, bottomA, innerBottomA, innerBottomB);
      pushTriangle(positions, innerBottomB, innerBottomA, innerTopA);
      pushTriangle(positions, innerBottomB, innerTopA, innerTopB);
    } else {
      pushTriangle(positions, centerTop, topA, topB);
      pushTriangle(positions, centerBottom, bottomB, bottomA);
    }
  }
}

function appendHubExtension(positions, innerRadius, outerRadius, zMin, zMax, segments) {
  if (!(outerRadius > innerRadius) || !(zMax > zMin)) return;
  const points = [];
  const safeSegments = Math.max(12, Math.floor(segments));
  for (let index = 0; index < safeSegments; index += 1) {
    const angle = (index / safeSegments) * Math.PI * 2;
    points.push(polarPoint(outerRadius, angle));
  }
  appendExtrudedRing(positions, points, innerRadius, zMin, zMax);
}

export function createGearGeometryFromBase(center, options = {}, axis = new THREE.Vector3(0, 0, 1)) {
  const teeth = Math.round(clampNumber(options.teeth, 6, 200, 24));
  const module = clampNumber(options.module, 0.2, 50, 2);
  const width = clampNumber(options.width, 0.5, 500, 8);
  const backlash = clampNumber(options.backlash, 0, module * 0.45, 0.15);
  const quality = ['low', 'medium', 'high'].includes(options.quality) ? options.quality : 'medium';
  const requestedBoreRadius = Math.max(clampNumber(options.boreDiameter, 0, 100000, 5) / 2, 0);
  const previewProfile = createGearProfile({
    backlash,
    boreRadius: 0,
    module,
    quality,
    teeth,
  });
  const boreMargin = Math.max(0.2, module * 0.25);
  const boreRadius = Math.min(requestedBoreRadius, Math.max(previewProfile.rootRadius - boreMargin, 0));
  const profile = createGearProfile({
    backlash,
    boreRadius,
    module,
    quality,
    teeth,
  });
  const positions = [];

  appendExtrudedRing(positions, profile.points, boreRadius, 0, width);

  const settings = GEAR_QUALITY[quality] ?? GEAR_QUALITY.medium;
  const hubDiameter = clampNumber(options.hubDiameter, 0, profile.rootRadius * 2, 0);
  const hubWidth = clampNumber(options.hubWidth, width, width * 4, width);
  const hubMinRadius = boreRadius + boreMargin;
  const hubMaxRadius = profile.rootRadius - boreMargin;
  const hubRadius = hubDiameter > 0 && hubMaxRadius > hubMinRadius
    ? THREE.MathUtils.clamp(hubDiameter / 2, hubMinRadius, hubMaxRadius)
    : 0;
  if (hubRadius > boreRadius + 1e-6 && hubWidth > width + 1e-6) {
    appendHubExtension(positions, boreRadius, hubRadius, width, hubWidth, settings.circleSegments);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  const direction = axis.clone();
  if (direction.lengthSq() < 1e-8) direction.set(0, 0, 1);
  direction.normalize();
  geometry.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), direction));
  geometry.translate(center.x, center.y, center.z);
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
