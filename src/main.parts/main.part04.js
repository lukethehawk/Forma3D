  if (!Number.isFinite(length)) {
    setStatus('Digita una lunghezza valida in millimetri, per esempio 115,26.');
    return;
  }
  if (!sketchPreviewPoint) {
    setStatus('Muovi il mouse nella direzione del segmento, poi scrivi la lunghezza.');
    return;
  }
  const constrained = applySketchLengthConstraint(sketchPreviewPoint);
  constrained.z = sketchPoints[0].z;
  sketchPreviewPoint = constrained;
  drawSketchPreview(constrained, sketchPreviewAxis);
  setStatus(`Lunghezza segmento impostata a ${formatMillimeters(length)}. Premi Invio per fissare il punto.`);
}

function addSketchPoint(point, axis = null) {
  if (sketchPoints.length >= 3 && point.distanceTo(sketchPoints[0]) < 2.5) {
    sketchClosed = true;
    sketchLengthInput = '';
    sketchPreviewPoint = null;
    sketchPreviewAxis = null;
    ui.measureValue.value = `${sketchPoints.length} lati`;
    updateMeasureBoxMode();
    ui.sketchInfo.textContent = `Faccia chiusa con ${sketchPoints.length} punti. Ora puoi estruderla.`;
    ui.applySketch.disabled = false;
    drawSketchPreview();
    setStatus('Faccia chiusa. Inserisci la distanza e premi Estrudi sagoma.');
    return;
  }

  sketchPoints.push(point);
  sketchClosed = false;
  sketchPreviewPoint = null;
  sketchPreviewAxis = null;
  sketchLengthInput = '';
  ui.applySketch.disabled = true;
  ui.measureValue.value = '-- mm';
  updateMeasureBoxMode();
  ui.sketchInfo.textContent = `${sketchPoints.length} punti. ${axis !== null ? `Segmento bloccato su asse ${['X', 'Y', 'Z'][axis]}. ` : ''}Torna vicino al primo punto per chiudere.`;
  drawSketchPreview();
  setStatus(sketchPoints.length === 1
    ? 'Primo punto fissato. Muovi il mouse, digita la lunghezza se vuoi, poi Invio o clic.'
    : 'Punto aggiunto alla sagoma.');
}

function sketchAt(clientX, clientY) {
  const axisStart = sketchPoints.length ? sketchPoints[sketchPoints.length - 1] : null;
  const pick = pickWorkPoint(clientX, clientY, { axisStart });
  if (!pick) {
    setStatus('Clicca sul piano di lavoro o su un punto agganciabile.');
    return;
  }

  const point = sketchPoints.length ? applySketchLengthConstraint(pick.point.clone()) : pick.point.clone();
  if (sketchPoints.length) point.z = sketchPoints[0].z;
  addSketchPoint(point, pick.axis);
}

function previewSketch(clientX, clientY) {
  if (activeTool !== 'line' || !sketchPoints.length || sketchClosed) return;
  const pick = pickWorkPoint(clientX, clientY, {
    axisStart: sketchPoints[sketchPoints.length - 1],
  });
  if (!pick) return;
  const point = applySketchLengthConstraint(pick.point.clone());
  point.z = sketchPoints[0].z;
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
  if (!sketchClosed || sketchPoints.length < 3) {
    setStatus('Chiudi prima la sagoma tornando vicino al primo punto.');
    return;
  }
  const height = parseDecimal(ui.sketchDepth.value, 0);
  if (!(height > 0)) {
    setStatus('Inserisci una distanza di estrusione maggiore di zero.');
    return;
  }
  try {
    const geometry = createExtrudedPolygonGeometry(sketchPoints, height);
    applyPrimitiveGeometry(
      geometry,
      ui.sketchOperation.value,
      ui.sketchOperation.value === 'subtract' ? 'Sagoma estrusa e sottratta dal solido.' : 'Sagoma estrusa e unita al solido.',
    );
  } catch (error) {
    setStatus(error instanceof Error ? error.message : 'Non riesco a estrudere questa sagoma.');
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
    setModelGeometry(geometry, false);
    updateHistoryButtons();
    setStatus(
      `Foro spostato: X ${formatMillimeters(offset.x, true)}, Y ${formatMillimeters(offset.y, true)}, Z ${formatMillimeters(offset.z, true)}.`,
    );
  } catch (error) {
    console.error(`Errore spostamento foro: ${error?.stack ?? error}`);
    const previous = undoStack.pop();
    if (previous) setModelGeometry(previous, false);
    updateHistoryButtons();
    setStatus('Non riesco a spostare il foro su questa mesh.');
  }
}

function applyPushPull(distance) {
  if (!selected || !model) {
    setStatus('Prima clicca una superficie piana.');
    return;
  }
  if (!Number.isFinite(distance) || distance === 0) {
    setStatus('Inserisci una distanza diversa da zero.');
    return;
  }
  snapshot();
  const geometry = pushPullGeometry(model.geometry, selected.region, distance);
  setModelGeometry(geometry, false);
  updateHistoryButtons();
  setStatus(`Spingi/Tira applicato: ${distance.toFixed(2)} mm.`);
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
