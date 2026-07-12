  if (!Number.isFinite(length)) {
    setStatus('Digita una lunghezza valida in millimetri, per esempio 115,26.');
    return;
  }
  if (!sketchPreviewPoint) {
    setStatus('Muovi il mouse nella direzione del segmento, poi scrivi la lunghezza.');
    return;
  }
  const constrained = constrainPointToSketchPlane(applySketchLengthConstraint(sketchPreviewPoint));
  sketchPreviewPoint = constrained;
  drawSketchPreview(constrained, sketchPreviewAxis);
  setStatus(`Lunghezza segmento impostata a ${formatMillimeters(length)}. Premi Invio per fissare il punto.`);
}

function sketchPointKey(point) {
  return `${point.x.toFixed(3)}:${point.y.toFixed(3)}:${point.z.toFixed(3)}`;
}

function sketchEdgeKey(start, end) {
  return [sketchPointKey(start), sketchPointKey(end)].sort().join('|');
}

function sketchFaceKey(points) {
  return points.map(sketchPointKey).sort().join('|');
}

function sketchDisplayPoints() {
  const points = new Map();
  for (const point of sketchPoints) points.set(sketchPointKey(point), point);
  for (const edge of sketchEdges) {
    points.set(sketchPointKey(edge.start), edge.start);
    points.set(sketchPointKey(edge.end), edge.end);
  }
  for (const face of sketchFaces) {
    for (const point of face.points) points.set(sketchPointKey(point), point);
  }
  return [...points.values()];
}

function sketchSnapTargets() {
  const targets = sketchDisplayPoints().map((point) => ({
    point,
    kind: 'vertice',
  }));
  for (const edge of sketchEdges) {
    targets.push({
      kind: 'punto medio',
      point: edge.start.clone().add(edge.end).multiplyScalar(0.5),
    });
    targets.push({
      end: edge.end,
      kind: 'linea guida',
      start: edge.start,
    });
  }
  return targets;
}

function constructionSnapTargets() {
  return sketchEdges.length || sketchFaces.length || sketchPoints.length
    ? sketchSnapTargets()
    : [];
}

function sketchEdgeExists(start, end) {
  const key = sketchEdgeKey(start, end);
  return sketchEdges.some((edge) => edge.key === key);
}

function modelEdgeExists(start, end) {
  if (!model) return false;
  const position = model.geometry.getAttribute('position');
  const key = sketchEdgeKey(start, end);
  const point = new THREE.Vector3();
  const trianglePoints = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
  for (let triangle = 0; triangle < position.count / 3; triangle += 1) {
    for (let corner = 0; corner < 3; corner += 1) {
      point.fromBufferAttribute(position, triangle * 3 + corner);
      trianglePoints[corner].copy(point);
    }
    if (
      sketchEdgeKey(trianglePoints[0], trianglePoints[1]) === key ||
      sketchEdgeKey(trianglePoints[1], trianglePoints[2]) === key ||
      sketchEdgeKey(trianglePoints[2], trianglePoints[0]) === key
    ) {
      return true;
    }
  }
  return false;
}

function sketchOrModelEdgeExists(start, end) {
  return sketchEdgeExists(start, end) || modelEdgeExists(start, end);
}

function addSketchFace(points) {
  const key = sketchFaceKey(points);
  if (sketchFaces.some((face) => face.key === key)) return false;
  try {
    const geometry = createPolygonFaceGeometry(points);
    geometry.dispose();
  } catch {
    return false;
  }
  sketchFaces.push({
    key,
    points: points.map((point) => point.clone()),
  });
  return true;
}

function detectSketchFacesForEdge(start, end) {
  let created = 0;
  for (const candidate of sketchDisplayPoints()) {
    if (candidate.distanceTo(start) < 1e-4 || candidate.distanceTo(end) < 1e-4) continue;
    if (
      sketchOrModelEdgeExists(start, candidate) &&
      sketchOrModelEdgeExists(end, candidate) &&
      addSketchFace([start, end, candidate])
    ) {
      created += 1;
    }
  }
  return created;
}

function updateSketchApplyState() {
  ui.applySketch.disabled = sketchFaces.length === 0;
  ui.applySketch.textContent = sketchFaces.length
    ? `Applica ${sketchFaces.length} facce`
    : 'Applica facce';
}

function commitSketchEdge(start, end, axis = null) {
  if (start.distanceTo(end) < 1e-4) return { added: false, faces: 0 };
  const key = sketchEdgeKey(start, end);
  if (sketchEdges.some((edge) => edge.key === key)) {
    return { added: false, duplicate: true, faces: 0 };
  }
  sketchEdges.push({
    axis,
    end: end.clone(),
    key,
    start: start.clone(),
  });
  return {
    added: true,
    faces: detectSketchFacesForEdge(start, end),
  };
}

function addSketchPoint(point, axis = null) {
  if (sketchPoints.length >= 3 && point.distanceTo(sketchPoints[0]) < 2.5) {
    const start = sketchPoints[sketchPoints.length - 1];
    const end = sketchPoints[0];
    commitSketchEdge(start, end, axis);
    addSketchFace(sketchPoints);
    sketchPoints = [end.clone()];
    sketchClosed = false;
    sketchLengthInput = '';
    sketchPreviewPoint = null;
    sketchPreviewAxis = null;
    ui.measureValue.value = `${sketchFaces.length} facce`;
    updateMeasureBoxMode();
    updateSketchApplyState();
    drawSketchPreview();
    setStatus('Faccia chiusa in bozza. Puoi continuare a tracciare linee o applicare le facce.');
    return;
  }

  if (!sketchPoints.length) {
    sketchPoints.push(point);
    sketchClosed = false;
    sketchPreviewPoint = null;
    sketchPreviewAxis = null;
    sketchLengthInput = '';
    ui.measureValue.value = '-- mm';
    updateMeasureBoxMode();
    drawSketchPreview();
    setStatus('Primo punto fissato. Clicca il secondo punto per creare una linea.');
    return;
  }

  const start = sketchPoints[sketchPoints.length - 1];
  const committed = commitSketchEdge(start, point, axis);
  sketchPoints.push(point);
  if (committed.duplicate) {
    sketchPoints = [point.clone()];
  }
  sketchClosed = false;
  sketchPreviewPoint = null;
  sketchPreviewAxis = null;
  sketchLengthInput = '';
  ui.measureValue.value = '-- mm';
  updateMeasureBoxMode();
  updateSketchApplyState();
  const lockText = axis === 'parallel'
    ? 'Segmento parallelo a un lato precedente. '
    : axis !== null
      ? `Segmento bloccato su asse ${['X', 'Y', 'Z'][axis]}. `
      : '';
  ui.sketchInfo.textContent = `${sketchEdges.length} guide, ${sketchFaces.length} facce. ${lockText}Usa Nuova linea per ripartire da un altro punto.`;
  drawSketchPreview();
  setStatus(committed.faces
    ? `${committed.faces} faccia chiusa creata in bozza.`
    : committed.duplicate
      ? 'Guida gia presente: riparto dal punto scelto.'
      : 'Guida aggiunta alla scena.');
}

function isAutoSketchPlane() {
  return ui.sketchPlane.value === 'auto';
}

function sketchPlaneNormal() {
  const plane = ui.sketchPlane.value;
  if (plane === 'xz') return new THREE.Vector3(0, 1, 0);
  if (plane === 'yz') return new THREE.Vector3(1, 0, 0);
  return new THREE.Vector3(0, 0, 1);
}

function sketchAutoWorkPlane() {
  const origin = sketchPoints[sketchPoints.length - 1] ?? new THREE.Vector3(0, 0, 0);
  const normal = camera.getWorldDirection(new THREE.Vector3()).normalize();
  return new THREE.Plane().setFromNormalAndCoplanarPoint(normal, origin);
}

function sketchWorkPlane() {
  if (isAutoSketchPlane()) return sketchAutoWorkPlane();
  const normal = sketchPlaneNormal();
  const origin = sketchPoints[0] ?? new THREE.Vector3(0, 0, 0);
  return new THREE.Plane().setFromNormalAndCoplanarPoint(normal, origin);
}

function constrainPointToSketchPlane(point) {
  if (!sketchPoints.length || isAutoSketchPlane()) return point;
  return sketchWorkPlane().projectPoint(point, new THREE.Vector3());
}

function sketchAxisInferenceEnabled() {
  return ui.sketchInference.checked;
}

function sketchSegmentColor(start, end, axis = null) {
  if (axis === 0) return measureColors.x;
  if (axis === 1) return measureColors.y;
  if (axis === 2) return measureColors.z;
  if (axis === 'parallel') return 0x8e44ad;

  const delta = end.clone().sub(start);
  if (delta.lengthSq() < 1e-8) return 0xe46f2b;
  const values = [Math.abs(delta.x), Math.abs(delta.y), Math.abs(delta.z)];
  const dominant = values.indexOf(Math.max(...values));
  return dominant === 0 ? measureColors.x : dominant === 1 ? measureColors.y : measureColors.z;
}

function sketchInferenceDirections() {
  if (!sketchAxisInferenceEnabled()) return [];
  if (sketchPoints.length < 2) return [];
  const directions = [];
  for (let index = 1; index < sketchPoints.length; index += 1) {
    const direction = sketchPoints[index].clone().sub(sketchPoints[index - 1]);
    if (direction.lengthSq() > 1e-8) directions.push(direction);
  }
  return directions;
}

function sketchAt(clientX, clientY) {
  const axisStart = sketchPoints.length ? sketchPoints[sketchPoints.length - 1] : null;
  const extraSnapPoints = sketchSnapTargets();
  const pick = pickWorkPoint(clientX, clientY, {
    allowScreenSnap: true,
    axisStart: sketchAxisInferenceEnabled() ? axisStart : null,
    inferenceDirections: sketchInferenceDirections(),
    extraSnapPoints,
    preferWorkPlane: sketchPoints.length > 0,
    projectSnapsToWorkPlane: !isAutoSketchPlane(),
    screenSnapPoints: [...extraSnapPoints, ...snapPoints],
    workPlane: sketchWorkPlane(),
  });
  if (!pick) {
    setStatus('Clicca sul piano di lavoro o su un punto agganciabile.');
    return;
  }

  const point = sketchPoints.length
    ? constrainPointToSketchPlane(applySketchLengthConstraint(pick.point.clone()))
    : pick.point.clone();
  addSketchPoint(point, pick.axis);
}

function previewSketch(clientX, clientY) {
  if (activeTool !== 'line' || !sketchPoints.length || sketchClosed) return;
  const extraSnapPoints = sketchSnapTargets();
  const pick = pickWorkPoint(clientX, clientY, {
    allowScreenSnap: true,
    axisStart: sketchAxisInferenceEnabled() ? sketchPoints[sketchPoints.length - 1] : null,
    inferenceDirections: sketchInferenceDirections(),
    extraSnapPoints,
    preferWorkPlane: true,
    projectSnapsToWorkPlane: !isAutoSketchPlane(),
    screenSnapPoints: [...extraSnapPoints, ...snapPoints],
    workPlane: sketchWorkPlane(),
  });
  if (!pick) return;
  const point = constrainPointToSketchPlane(applySketchLengthConstraint(pick.point.clone()));
  sketchPreviewPoint = point;
  sketchPreviewAxis = pick.axis;
  updateSketchLengthReadout(point);
  drawSketchPreview(point, pick.axis);
}

function commitSketchPreviewPoint() {
  if (activeTool !== 'line' || !sketchPoints.length || sketchClosed) return false;
  const length = parseLengthInput(sketchLengthInput || ui.measureValue.value);
  if (sketchLengthInput && !Number.isFinite(length)) {
    setStatus('La lunghezza non e valida. Usa un numero come 115,26.');
    return true;
  }
  if (!sketchPreviewPoint) {
    setStatus('Muovi il mouse nella direzione del segmento prima di confermare la lunghezza.');
    return true;
  }
  addSketchPoint(sketchPreviewPoint.clone(), sketchPreviewAxis);
  return true;
}

function handleSketchLengthShortcut(event) {
  if (activeTool !== 'line' || !sketchPoints.length || sketchClosed) return false;
  if (event.ctrlKey || event.altKey || event.metaKey) return false;

  if (event.key === 'Enter') {
    event.preventDefault();
    return commitSketchPreviewPoint();
  }

  if (event.key === 'Escape') {
    sketchLengthInput = '';
    ui.measureValue.value = sketchPreviewPoint ? formatMillimeters(sketchPreviewPoint.distanceTo(sketchPoints[sketchPoints.length - 1])) : '-- mm';
    drawSketchPreview(sketchPreviewPoint, sketchPreviewAxis);
    setStatus('Lunghezza manuale annullata.');
    return true;
  }

  if (event.key === 'Backspace') {
    event.preventDefault();
    setSketchLengthInput(sketchLengthInput.slice(0, -1));
    return true;
  }

  if (/^[0-9,.]$/.test(event.key)) {
    event.preventDefault();
    setSketchLengthInput(`${sketchLengthInput}${event.key}`);
    return true;
  }

  return false;
}

function applySketch() {
  if (!sketchFaces.length) {
    setStatus('Traccia linee fino a chiudere almeno una faccia.');
    return;
  }
  try {
    const geometries = sketchFaces.map((face) => createPolygonFaceGeometry(face.points));
    const geometry = combineGeometries(geometries);
    for (const item of geometries) item.dispose();
    if (!geometry) {
      setStatus('Non riesco a creare facce da queste linee.');
      return;
    }
    const appliedCount = sketchFaces.length;
    const applied = appendGeometryToModel(geometry, `${appliedCount} facce applicate al modello.`);
    if (applied) {
      sketchFaces = [];
      updateSketchApplyState();
      drawSketchPreview();
    }
  } catch (error) {
    setStatus(error instanceof Error ? error.message : 'Non riesco ad applicare queste facce.');
  }
}

function createHoleCylinder(hole, center, radius, depth, material) {
  return createPreviewCylinder(center, radius, depth, axisVector(hole.axis), material, hole.segments);
}

function drawHoleCreatePreview() {
  if (!holeCreate?.center || activeTool !== 'hole') return;
  if (holeCreatePreview) {
    scene.remove(holeCreatePreview);
    disposeObject(holeCreatePreview);
    holeCreatePreview = null;
    requestRender();
  }

  const material = new THREE.MeshBasicMaterial({
    color: 0x00c853,
    wireframe: true,
    transparent: true,
    opacity: 1,
    depthTest: false,
  });
  const radius = Math.max(parseDecimal(ui.holeDiameter.value, 0) / 2, 0.1);
  const depth = Math.max(parseDecimal(ui.holeDepth.value, 0), 0.2);
  const previewCenter = holeCreate.center.clone().addScaledVector(holeCreate.normal, -depth / 2);
  holeCreatePreview = new THREE.Group();
  holeCreatePreview.add(createPreviewCylinder(previewCenter, radius, depth, holeCreate.normal, material));
  addTransientOverlay(holeCreatePreview, 'hole-create-preview');
}

function updateHoleCreateFromInputs() {
  if (!holeCreate?.basePoint) return;
  const offset = new THREE.Vector3();
  ui.holeOffsetInputs.forEach((input, axis) => {
    offset.setComponent(axis, axis === holeCreate.lockedAxis ? 0 : parseDecimal(input.value, 0));
  });
  holeCreate.center = holeCreate.basePoint.clone().add(offset);
  ui.holeCreateHelp.textContent = `Centro: X ${holeCreate.center.x.toFixed(2)}, Y ${holeCreate.center.y.toFixed(2)}, Z ${holeCreate.center.z.toFixed(2)} mm.`;
  ui.applyHole.disabled = false;
  drawHoleCreatePreview();
}

function setHoleCreatePoint(hit) {
  const normal = hit.face.normal.clone().normalize();
  const lockedAxis = dominantAxis(normal);
  holeCreate = {
    basePoint: hit.point.clone(),
    center: hit.point.clone(),
    normal,
    lockedAxis,
  };
  ui.holeCreateInfo.textContent = `Centro X ${hit.point.x.toFixed(2)}, Y ${hit.point.y.toFixed(2)}, Z ${hit.point.z.toFixed(2)} mm`;
  ui.holeCreateAxis.textContent = `Direzione foro: asse ${['X', 'Y', 'Z'][lockedAxis]} bloccato.`;
  ui.holeOffsetInputs.forEach((input, axis) => {
    input.value = '0';
    input.disabled = axis === lockedAxis;
  });
  updateHoleCreateFromInputs();
  setStatus('Centro foro impostato. Regola diametro, profondita o offset, poi crea il foro.');
}

function holeAt(clientX, clientY) {
  const hit = raycastModel(clientX, clientY);
  if (!hit) {
    setStatus('Clicca una superficie del modello per impostare il foro.');
    return;
  }
  setHoleCreatePoint(hit);
}

function drawHoleMovePreview() {
  if (!holeMove?.hole || activeTool !== 'movehole') return;
  if (holeMovePreview) {
    scene.remove(holeMovePreview);
    disposeObject(holeMovePreview);
    holeMovePreview = null;
    requestRender();
  }

  const oldMaterial = new THREE.MeshBasicMaterial({
    color: 0xe46f2b,
    wireframe: true,
    transparent: true,
    opacity: 0.9,
    depthTest: false,
  });
  const newMaterial = new THREE.MeshBasicMaterial({
    color: 0x28a45f,
    wireframe: true,
    transparent: true,
    opacity: 0.95,
    depthTest: false,
  });
  holeMovePreview = new THREE.Group();
  holeMovePreview.add(
    createHoleCylinder(
      holeMove.hole,
      holeMove.hole.center,
      holeMove.hole.radius * 1.02,
      holeMove.hole.depth,
      oldMaterial,
    ),
  );
  if (holeMove.targetCenter) {
    holeMovePreview.add(
      createHoleCylinder(
        holeMove.hole,
        holeMove.targetCenter,
        holeMove.hole.radius * 1.02,
        holeMove.hole.depth,
        newMaterial,
      ),
    );
  }
  addTransientOverlay(holeMovePreview, 'hole-move-preview');
}

function updateHoleMoveInputs(offset) {
  ui.moveHoleInputs.forEach((input, axis) => {
    input.value = axis === holeMove.hole.axis ? '0' : offset.getComponent(axis).toFixed(2);
    input.disabled = axis === holeMove.hole.axis;
  });
}

function updateHoleTargetFromInputs() {
  if (!holeMove?.hole) return;
  const offset = new THREE.Vector3();
  ui.moveHoleInputs.forEach((input, axis) => {
    offset.setComponent(axis, axis === holeMove.hole.axis ? 0 : parseDecimal(input.value, 0));
  });
  holeMove.targetCenter = holeMove.hole.center.clone().add(offset);
  ui.applyMoveHole.disabled = offset.lengthSq() < 1e-8;
  ui.moveHoleHelp.textContent = `Nuovo centro: X ${holeMove.targetCenter.x.toFixed(2)}, Y ${holeMove.targetCenter.y.toFixed(2)}, Z ${holeMove.targetCenter.z.toFixed(2)} mm.`;
  drawHoleMovePreview();
}

function moveHoleAt(clientX, clientY) {
  const hit = raycastModel(clientX, clientY);
  if (!hit) {
    setStatus('Clicca sul foro o sulla superficie del modello.');
    return;
  }

  if (!holeMove?.hole) {
    try {
      const hole = detectCylindricalHole(model.geometry, hit.faceIndex);
      holeMove = { hole, targetCenter: null };
      ui.moveHoleInfo.textContent = `Diametro ${(hole.radius * 2).toFixed(2)} mm - profondita ${hole.depth.toFixed(2)} mm`;
      ui.moveHoleAxis.textContent = `Asse del foro: ${hole.axisName.toUpperCase()}. Questo asse resta bloccato.`;
      ui.moveHoleInputs.forEach((input, axis) => {
        input.disabled = axis === hole.axis;
      });
      drawHoleMovePreview();
      setStatus('Foro riconosciuto. Ora clicca il nuovo centro.');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Non riesco a riconoscere questo foro.');
    }
    return;
  }

  const offset = hit.point.clone().sub(holeMove.hole.center);
  offset.setComponent(holeMove.hole.axis, 0);
  holeMove.targetCenter = holeMove.hole.center.clone().add(offset);
  updateHoleMoveInputs(offset);
  updateHoleTargetFromInputs();
  setStatus('Nuova posizione impostata. Controlla gli spostamenti e applica.');
}

function createBooleanCylinder(hole, center, radius, depth) {
  const geometry = new THREE.CylinderGeometry(radius, radius, depth, Math.max(hole.segments, 48));
  geometry.deleteAttribute('uv');
  const brush = new Brush(geometry, modelMaterial);
  brush.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), axisVector(hole.axis));
  brush.position.copy(center);
  brush.updateMatrixWorld(true);
  return brush;
}

function createBooleanCylinderFromDirection(center, radius, depth, direction, segments = 64) {
  const geometry = new THREE.CylinderGeometry(radius, radius, depth, segments);
  geometry.deleteAttribute('uv');
  const brush = new Brush(geometry, modelMaterial);
  brush.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.clone().normalize());
  brush.position.copy(center);
  brush.updateMatrixWorld(true);
  return brush;
}

function applyMoveHole() {
  if (!holeMove?.hole || !holeMove.targetCenter || !model) return;
  snapshot();
  setStatus('Spostamento del foro in corso...');

  try {
    const sourceGeometry = model.geometry.clone();
    sourceGeometry.clearGroups();
    const source = new Brush(sourceGeometry, modelMaterial);
    source.updateMatrixWorld(true);

    const hole = holeMove.hole;
    const fill = createBooleanCylinder(
      hole,
      hole.center,
      hole.radius * 1.015,
      hole.depth,
    );
    const filled = evaluator.evaluate(source, fill, ADDITION);

    const cutter = createBooleanCylinder(
      hole,
      holeMove.targetCenter,
      hole.radius,
      hole.depth + Math.max(0.02, hole.radius * 0.01),
    );
    const moved = evaluator.evaluate(filled, cutter, SUBTRACTION);
    const geometry = moved.geometry.clone();
    geometry.clearGroups();
    geometry.computeVertexNormals();

    const offset = holeMove.targetCenter.clone().sub(hole.center);
    setModelGeometry(geometry, false, { preserveSketch: true });
    updateHistoryButtons();
    setStatus(
      `Foro spostato: X ${formatMillimeters(offset.x, true)}, Y ${formatMillimeters(offset.y, true)}, Z ${formatMillimeters(offset.z, true)}.`,
    );
  } catch (error) {
    console.error(`Errore spostamento foro: ${error?.stack ?? error}`);
    const previous = undoStack.pop();
    if (previous) setModelGeometry(previous, false, { preserveSketch: true });
    updateHistoryButtons();
    setStatus('Non riesco a spostare il foro su questa mesh.');
  }
}

function pushPullVisualEnabled() {
  return Boolean(ui.pushPullVisualHandle?.checked);
}

function selectedRegionCenter() {
  if (!model || !selected?.region?.triangles?.length) return selected?.point?.clone?.() ?? new THREE.Vector3();
  const position = model.geometry.getAttribute('position');
  const keys = new Set();
  const center = new THREE.Vector3();
  const point = new THREE.Vector3();
  let count = 0;
  for (const triangle of selected.region.triangles) {
    for (let corner = 0; corner < 3; corner += 1) {
      point.fromBufferAttribute(position, triangle * 3 + corner);
      const key = `${point.x.toFixed(5)},${point.y.toFixed(5)},${point.z.toFixed(5)}`;
      if (keys.has(key)) continue;
      keys.add(key);
      center.add(point);
      count += 1;
    }
  }
  return count ? center.multiplyScalar(1 / count) : selected.point.clone();
}

function pushPullHandleLength() {
  if (!model) return 30;
  const box = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3()).length();
  return THREE.MathUtils.clamp(size * 0.12, 24, 90);
}

function clearPushPullPreview() {
  if (pushPullHandleFrameRequest) {
    cancelAnimationFrame(pushPullHandleFrameRequest);
    pushPullHandleFrameRequest = 0;
  }
  if (!pushPullHandlePreview) return;
  scene.remove(pushPullHandlePreview);
  disposeObject(pushPullHandlePreview);
  pushPullHandlePreview = null;
  requestRender();
}

function clearPushPullHandle() {
  clearPushPullPreview();
  if (pushPullHandle) {
    scene.remove(pushPullHandle);
    disposeObject(pushPullHandle);
    pushPullHandle = null;
  }
  if (pushPullHandleDrag?.pointerId != null) {
    try {
      canvas.releasePointerCapture(pushPullHandleDrag.pointerId);
    } catch {
      // Pointer capture may already be released by the browser.
    }
  }
  if (pushPullHandleDrag) controls.enabled = pushPullHandleDrag.controlsEnabled;
  pushPullHandleDrag = null;
  requestRender();
}

function createPushPullHandle(origin, normal) {
  const direction = normal.clone().normalize();
  const length = pushPullHandleLength();
  const group = new THREE.Group();
  group.position.copy(origin).addScaledVector(direction, 0.45);
  group.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), direction);
  group.userData.pushPullHandle = true;
  group.userData.origin = origin.clone();
  group.userData.normal = direction.clone();

  const material = new THREE.MeshBasicMaterial({
    color: 0x0b84d8,
    depthTest: false,
    depthWrite: false,
  });
  const tipMaterial = new THREE.MeshBasicMaterial({
    color: 0xff7a22,
    depthTest: false,
    depthWrite: false,
  });
  const hitMaterial = new THREE.MeshBasicMaterial({
    color: 0xff7a22,
    transparent: true,
    opacity: 0.08,
    depthTest: false,
    depthWrite: false,
  });

  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.85, length * 0.7, 16), material);
  shaft.position.z = length * 0.35;
  const cone = new THREE.Mesh(new THREE.ConeGeometry(3.8, 8, 24), tipMaterial);
  cone.position.z = length * 0.76;
  const hit = new THREE.Mesh(new THREE.SphereGeometry(7, 18, 12), hitMaterial);
  hit.position.z = length * 0.82;
  hit.userData.pushPullHandleHit = true;

  for (const child of [shaft, cone, hit]) {
    child.renderOrder = 80;
    child.userData.pushPullHandle = true;
    group.add(child);
  }
  return group;
}

function refreshPushPullHandle() {
  clearPushPullHandle();
  if (activeTool !== 'pushpull' || !pushPullVisualEnabled() || !model || selected?.type !== 'face') return;
  const normal = selected.normal.clone().normalize();
  if (normal.lengthSq() < 1e-8) return;
  pushPullHandle = createPushPullHandle(selectedRegionCenter(), normal);
  scene.add(pushPullHandle);
  ui.pushPullVisualHelp.hidden = false;
  setStatus('Trascina la freccia: Shift aggancia a 1 mm, Esc annulla.');
  requestRender();
}

function shouldUseLightPushPullPreview() {
  const totalTriangles = currentModelInfo?.triangles ?? (model ? triangleCount(model.geometry) : 0);
  return totalTriangles > PUSH_PULL_VISUAL_MODEL_TRIANGLE_LIMIT
    || (selected?.region?.triangles?.length ?? 0) > PUSH_PULL_VISUAL_REGION_TRIANGLE_LIMIT;
}

function drawPushPullPreview(distance) {
  pushPullHandleFrameRequest = 0;
  clearPushPullPreview();
  if (!model || selected?.type !== 'face' || Math.abs(distance) < 0.01) return;
  if (shouldUseLightPushPullPreview()) {
    setStatus('Preview semplificata per mesh grande: rilascio per applicare.');
    return;
  }
  const geometry = createPushPullRegionGeometry(model.geometry, selected.region, distance);
  const material = new THREE.MeshBasicMaterial({
    color: distance >= 0 ? 0x25a85a : 0xe46f2b,
    transparent: true,
    opacity: 0.34,
    side: THREE.DoubleSide,
    depthTest: false,
    depthWrite: false,
  });
  pushPullHandlePreview = new THREE.Mesh(geometry, material);
  pushPullHandlePreview.renderOrder = 45;
  scene.add(pushPullHandlePreview);
  requestRender();
}

function schedulePushPullPreview(distance) {
  pushPullHandlePendingDistance = distance;
  if (pushPullHandleFrameRequest) return;
  pushPullHandleFrameRequest = requestAnimationFrame(() => {
    drawPushPullPreview(pushPullHandlePendingDistance);
  });
}

function startPushPullHandleDrag(event) {
  if (activeTool !== 'pushpull' || !pushPullVisualEnabled() || !pushPullHandle || appBusy) return false;
  setRayFromPointer(event.clientX, event.clientY);
  const hits = raycaster.intersectObjects(pushPullHandle.children, true);
  if (!hits.length) return false;

  const origin = pushPullHandle.userData.origin.clone();
  const normal = pushPullHandle.userData.normal.clone().normalize();
  const viewDirection = camera.getWorldDirection(new THREE.Vector3()).normalize();
  const dragPlane = new THREE.Plane().setFromNormalAndCoplanarPoint(viewDirection, origin);
  const startPoint = raycaster.ray.intersectPlane(dragPlane, new THREE.Vector3());
  const box = model ? new THREE.Box3().setFromObject(model) : null;
  const pixelScale = Math.max((box?.getSize(new THREE.Vector3()).length() ?? 100) / 360, 0.08);
  const screenNormal = normal.clone().projectOnPlane(viewDirection);
  const useMouseFallback = !startPoint || Math.abs(normal.dot(viewDirection)) > 0.82 || screenNormal.lengthSq() < 0.02;

  pushPullHandleDrag = {
    pointerId: event.pointerId,
    origin,
    normal,
    dragPlane,
    startPoint,
    startClientY: event.clientY,
    startDistance: 0,
    currentDistance: 0,
    pixelScale,
    useMouseFallback,
    controlsEnabled: controls.enabled,
  };
  controls.enabled = false;
  canvas.setPointerCapture?.(event.pointerId);
  event.preventDefault();
  event.stopPropagation();
  return true;
}

function updatePushPullHandleDrag(event) {
  if (!pushPullHandleDrag) return false;
  let distance = pushPullHandleDrag.startDistance;
  if (pushPullHandleDrag.useMouseFallback) {
    distance += (pushPullHandleDrag.startClientY - event.clientY) * pushPullHandleDrag.pixelScale;
  } else {
    setRayFromPointer(event.clientX, event.clientY);
    const point = raycaster.ray.intersectPlane(pushPullHandleDrag.dragPlane, new THREE.Vector3());
    if (point) distance += point.sub(pushPullHandleDrag.startPoint).dot(pushPullHandleDrag.normal);
  }
  if (event.shiftKey) distance = Math.round(distance);
  if (!Number.isFinite(distance)) return true;

  pushPullHandleDrag.currentDistance = distance;
  ui.pushPullDistance.value = formatDecimal(distance);
  ui.measureValue.value = `${formatDecimal(distance)} mm`;
  setStatus(`${t('Anteprima Spingi/Tira:')} ${formatDecimal(distance)} mm.`);
  schedulePushPullPreview(distance);
  event.preventDefault();
  return true;
}

function finishPushPullHandleDrag(event) {
  if (!pushPullHandleDrag) return false;
  const distance = pushPullHandleDrag.currentDistance;
  const pointerId = pushPullHandleDrag.pointerId;
  const controlsEnabled = pushPullHandleDrag.controlsEnabled;
  clearPushPullHandle();
  controls.enabled = controlsEnabled;
  try {
    canvas.releasePointerCapture?.(pointerId);
  } catch {
    // Pointer capture can be gone after cancel or browser focus changes.
  }
  event.preventDefault();
  if (!Number.isFinite(distance) || Math.abs(distance) < 0.05) {
    setStatus('Spingi/Tira visuale: distanza troppo piccola, nessuna modifica.');
    return true;
  }
  applyPushPull(distance);
  return true;
}

function cancelPushPullHandleDrag() {
  if (!pushPullHandleDrag) return false;
  clearPushPullPreview();
  const { controlsEnabled } = pushPullHandleDrag;
  pushPullHandleDrag = null;
  controls.enabled = controlsEnabled;
  refreshPushPullHandle();
  setStatus('Spingi/Tira visuale annullato.');
  return true;
}

function applyPushPull(distance) {
  if (!selected || !model || selected.type !== 'face') {
    setStatus(t(selected?.type === 'object'
      ? 'In modalita Oggetto puoi cancellare o trasformare il solido. Per Spingi/Tira passa a Faccia.'
      : 'Prima clicca una superficie piana.'));
    return;
  }
  if (!Number.isFinite(distance) || distance === 0) {
    setStatus('Inserisci una distanza diversa da zero.');
    return;
  }
  clearPushPullHandle();
  if (
    regionHasOpenBoundary(model.geometry, selected.region)
    && regionHasCoplanarSupport(model.geometry, selected.region)
  ) {
    applySupportedProfilePushPull(distance);
    return;
  }
  snapshot();
  const geometry = pushPullGeometry(model.geometry, selected.region, distance);
  setModelGeometry(geometry, false, { preserveSketch: true });
  updateHistoryButtons();
  setStatus(`Spingi/Tira applicato: ${distance.toFixed(2)} mm.`);
}

function applySupportedProfilePushPull(distance) {
  const overlap = Math.max(0.03, Math.abs(distance) * 0.002);
  const sign = Math.sign(distance);
  const sourceGeometry = deleteTrianglesFromGeometry(model.geometry, selected.region.triangles);
  if (!sourceGeometry) {
    const geometry = pushPullGeometry(model.geometry, selected.region, distance);
    snapshot();
    setModelGeometry(geometry, false, { preserveSketch: true });
    updateHistoryButtons();
    setStatus(`Spingi/Tira applicato: ${distance.toFixed(2)} mm.`);
    return;
  }

  const toolGeometry = createPushPullRegionGeometry(
    model.geometry,
    selected.region,
    distance + sign * overlap,
  );
  toolGeometry.translate(
    selected.normal.x * -sign * overlap,
    selected.normal.y * -sign * overlap,
    selected.normal.z * -sign * overlap,
  );

  snapshot();
  try {
    const operation = distance > 0 ? 'add' : 'subtract';
    const resultGeometry = booleanGeometry(sourceGeometry, toolGeometry, operation);
    setModelGeometry(resultGeometry, false, { preserveSketch: true });
    updateHistoryButtons();
    setStatus(distance > 0
      ? `Profilo tirato: ${distance.toFixed(2)} mm.`
      : `Profilo spinto nel solido: ${distance.toFixed(2)} mm.`);
  } catch (error) {
    console.error(`Errore Spingi/Tira su profilo: ${error?.stack ?? error}`);
    const previous = undoStack.pop();
    if (previous) setModelGeometry(previous, false, { preserveSketch: true });
    updateHistoryButtons();
    setStatus('Non riesco ad applicare Spingi/Tira su questo profilo: prova una distanza diversa o ripara la mesh.');
  } finally {
    sourceGeometry.dispose();
    toolGeometry.dispose();
  }
}

function applyHole() {
  if (!holeCreate?.center || !model) {
    setStatus('Prima clicca il centro del foro su una superficie.');
    return;
  }
  const diameter = parseDecimal(ui.holeDiameter.value, 0);
  const depth = parseDecimal(ui.holeDepth.value, 0);
  if (!(diameter > 0) || !(depth > 0)) {
    setStatus('Diametro e profondita devono essere maggiori di zero.');
    return;
  }

  setStatus('Calcolo del foro in corso...');
