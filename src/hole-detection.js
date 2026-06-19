import * as THREE from 'three';

const AXIS_NAMES = ['x', 'y', 'z'];

function vertexIndex(geometry, triangleIndex, corner) {
  const index = geometry.getIndex();
  const offset = triangleIndex * 3 + corner;
  return index ? index.getX(offset) : offset;
}

function vertexAt(geometry, triangleIndex, corner) {
  return new THREE.Vector3().fromBufferAttribute(
    geometry.getAttribute('position'),
    vertexIndex(geometry, triangleIndex, corner),
  );
}

function triangleData(geometry, triangleIndex, tolerance) {
  const points = [0, 1, 2].map((corner) => vertexAt(geometry, triangleIndex, corner));
  const normal = points[1]
    .clone()
    .sub(points[0])
    .cross(points[2].clone().sub(points[0]))
    .normalize();
  const keys = points.map((point) =>
    [
      Math.round(point.x / tolerance),
      Math.round(point.y / tolerance),
      Math.round(point.z / tolerance),
    ].join(':'),
  );
  return { points, normal, keys };
}

function inferAxis(points) {
  let best = null;
  for (let start = 0; start < 3; start += 1) {
    const edge = points[(start + 1) % 3].clone().sub(points[start]);
    const length = edge.length();
    if (length === 0) continue;
    const normalized = edge.multiplyScalar(1 / length);
    for (let axis = 0; axis < 3; axis += 1) {
      const alignment = Math.abs(normalized.getComponent(axis));
      if (alignment > 0.98 && (!best || length * alignment > best.score)) {
        best = { axis, score: length * alignment };
      }
    }
  }
  return best?.axis ?? null;
}

function solveThreeByThree(matrix, values) {
  const rows = matrix.map((row, index) => [...row, values[index]]);
  for (let column = 0; column < 3; column += 1) {
    let pivot = column;
    for (let row = column + 1; row < 3; row += 1) {
      if (Math.abs(rows[row][column]) > Math.abs(rows[pivot][column])) pivot = row;
    }
    [rows[column], rows[pivot]] = [rows[pivot], rows[column]];
    if (Math.abs(rows[column][column]) < 1e-12) return null;

    const divisor = rows[column][column];
    for (let item = column; item < 4; item += 1) rows[column][item] /= divisor;
    for (let row = 0; row < 3; row += 1) {
      if (row === column) continue;
      const factor = rows[row][column];
      for (let item = column; item < 4; item += 1) {
        rows[row][item] -= factor * rows[column][item];
      }
    }
  }
  return rows.map((row) => row[3]);
}

function fitCircle(points, firstAxis, secondAxis) {
  let sx = 0;
  let sy = 0;
  let sxx = 0;
  let syy = 0;
  let sxy = 0;
  let sxq = 0;
  let syq = 0;
  let sq = 0;

  for (const point of points) {
    const x = point.getComponent(firstAxis);
    const y = point.getComponent(secondAxis);
    const q = x * x + y * y;
    sx += x;
    sy += y;
    sxx += x * x;
    syy += y * y;
    sxy += x * y;
    sxq += x * q;
    syq += y * q;
    sq += q;
  }

  const count = points.length;
  const solution = solveThreeByThree(
    [
      [sxx, sxy, sx],
      [sxy, syy, sy],
      [sx, sy, count],
    ],
    [-sxq, -syq, -sq],
  );
  if (!solution) return null;

  const [d, e, f] = solution;
  const first = -d / 2;
  const second = -e / 2;
  const radiusSquared = first * first + second * second - f;
  if (!(radiusSquared > 0)) return null;
  return { first, second, radius: Math.sqrt(radiusSquared) };
}

export function detectCylindricalHole(
  geometry,
  seedTriangle,
  tolerance = 1e-4,
) {
  const position = geometry.getAttribute('position');
  const triangleCount = (geometry.getIndex()?.count ?? position.count) / 3;
  const triangles = Array.from({ length: triangleCount }, (_, triangle) =>
    triangleData(geometry, triangle, tolerance),
  );
  const seed = triangles[seedTriangle];
  const axis = inferAxis(seed.points);
  if (axis === null) {
    throw new Error('La superficie selezionata non sembra cilindrica.');
  }

  const edgeToTriangles = new Map();
  for (let triangle = 0; triangle < triangleCount; triangle += 1) {
    const keys = triangles[triangle].keys;
    for (let edge = 0; edge < 3; edge += 1) {
      const edgeKey = [keys[edge], keys[(edge + 1) % 3]].sort().join('|');
      if (!edgeToTriangles.has(edgeKey)) edgeToTriangles.set(edgeKey, []);
      edgeToTriangles.get(edgeKey).push(triangle);
    }
  }

  const candidates = new Set();
  for (let triangle = 0; triangle < triangleCount; triangle += 1) {
    const data = triangles[triangle];
    const coordinates = data.points.map((point) => point.getComponent(axis));
    const extent = Math.max(...coordinates) - Math.min(...coordinates);
    if (Math.abs(data.normal.getComponent(axis)) < 0.08 && extent > tolerance * 2) {
      candidates.add(triangle);
    }
  }

  const component = [];
  const visited = new Set([seedTriangle]);
  const queue = [seedTriangle];
  while (queue.length) {
    const triangle = queue.pop();
    if (!candidates.has(triangle)) continue;
    component.push(triangle);
    const keys = triangles[triangle].keys;
    for (let edge = 0; edge < 3; edge += 1) {
      const edgeKey = [keys[edge], keys[(edge + 1) % 3]].sort().join('|');
      for (const neighbor of edgeToTriangles.get(edgeKey) ?? []) {
        if (!visited.has(neighbor) && candidates.has(neighbor)) {
          visited.add(neighbor);
          queue.push(neighbor);
        }
      }
    }
  }

  if (component.length < 8) {
    throw new Error('Non trovo una parete cilindrica completa.');
  }

  const radialAxes = [0, 1, 2].filter((item) => item !== axis);
  const uniquePoints = new Map();
  for (const triangle of component) {
    const data = triangles[triangle];
    data.keys.forEach((key, index) => uniquePoints.set(key, data.points[index]));
  }

  const points = [...uniquePoints.values()];
  const center = new THREE.Vector3();
  const circle = fitCircle(points, radialAxes[0], radialAxes[1]);
  if (!circle) throw new Error('Non riesco a calcolare il centro del foro.');
  center.setComponent(radialAxes[0], circle.first);
  center.setComponent(radialAxes[1], circle.second);

  const axisCoordinates = points.map((point) => point.getComponent(axis));
  const min = Math.min(...axisCoordinates);
  const max = Math.max(...axisCoordinates);
  center.setComponent(axis, (min + max) / 2);

  const radii = points.map((point) =>
    Math.hypot(
      point.getComponent(radialAxes[0]) - center.getComponent(radialAxes[0]),
      point.getComponent(radialAxes[1]) - center.getComponent(radialAxes[1]),
    ),
  );
  const radius = circle.radius;
  const deviation = Math.sqrt(
    radii.reduce((sum, value) => sum + (value - radius) ** 2, 0) / radii.length,
  );

  if (!(radius > tolerance) || deviation / radius > 0.06) {
    throw new Error('La parete selezionata non forma un foro circolare regolare.');
  }

  let orientation = 0;
  for (const triangle of component) {
    const data = triangles[triangle];
    const centroid = data.points[0].clone().add(data.points[1]).add(data.points[2]).divideScalar(3);
    const radial = centroid.clone().sub(center);
    radial.setComponent(axis, 0);
    orientation += data.normal.dot(radial);
  }

  if (orientation >= 0) {
    throw new Error('Hai selezionato un cilindro esterno, non la parete interna di un foro.');
  }

  return {
    axis,
    axisName: AXIS_NAMES[axis],
    center,
    radius,
    depth: max - min,
    min,
    max,
    triangles: component,
    segments: Math.max(32, Math.round(component.length / 2)),
    deviation,
  };
}
