CreatePreview);
    disposeObject(holeCreatePreview);
    holeCreatePreview = null;
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
  snapshot();
  try {
    const sourceGeometry = model.geometry.clone();
    sourceGeometry.clearGroups();
    const source = new Brush(sourceGeometry, modelMaterial);
    source.updateMatrixWorld(true);

    const radius = diameter / 2;
    const normal = holeCreate.normal.clone().normalize();
    const margin = Math.max(0.02, radius * 0.01);
    const cutter = createBooleanCylinderFromDirection(
      holeCreate.center.clone().addScaledVector(normal, -(depth / 2) + margin / 2),
      radius,
      depth + margin,
      normal,
      64,
    );

    const result = evaluator.evaluate(source, cutter, SUBTRACTION);
    const geometry = result.geometry.clone();
    geometry.clearGroups();
    geometry.computeVertexNormals();
    setModelGeometry(geometry, false);
    sourceGeometry.dispose();
    updateHistoryButtons();
    setStatus(`Foro creato: diametro ${diameter.toFixed(2)} mm, profondita ${depth.toFixed(2)} mm.`);
  } catch (error) {
    console.error(`Errore foratura: ${error?.stack ?? error}`);
    const previous = undoStack.pop();
    if (previous) setModelGeometry(previous, false);
    updateHistoryButtons();
    const detail = error instanceof Error ? ` (${error.message})` : '';
    setStatus(`Non riesco a forare questa mesh: potrebbe non essere un solido chiuso.${detail}`);
  }
}

async function openStl(file) {
  try {
    setStatus('Apertura STL...');
    const data = await file.arrayBuffer();
    const geometry = new STLLoader().parse(data);
    geometry.computeBoundingBox();
    const box = geometry.boundingBox;
    const center = box.getCenter(new THREE.Vector3());
    geometry.translate(-center.x, -center.y, -box.min.z);
    for (const item of undoStack) item.dispose();
    for (const item of redoStack) item.dispose();
    undoStack.length = 0;
    redoStack.length = 0;
    setModelGeometry(geometry, false);
    currentFileName = file.name;
    ui.fileName.textContent = file.name;
    updateHistoryButtons();
    fitView();
    setStatus(`${file.name} aperto. Unita interpretata: millimetri.`);
  } catch (error) {
    console.error(error);
    setStatus('Il file STL non e leggibile.');
  }
}

function exportStl() {
  if (!model) return;
  const exporter = new STLExporter();
  const data = exporter.parse(model, { binary: true });
  const blob = new Blob([data], { type: 'model/stl' });
  const link = document.createElement('a');
  const base = currentFileName.replace(/\.stl$/i, '');
  link.href = URL.createObjectURL(blob);
  link.download = `${base}-modificato.stl`;
  link.click();
  URL.revokeObjectURL(link.href);
  setStatus(`Esportato ${link.download}.`);
}

function resize() {
  const width = viewport.clientWidth;
  const height = viewport.clientHeight;
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}

document.querySelector('#open-file').addEventListener('click', () => ui.fileInput.click());
ui.fileInput.addEventListener('change', (event) => {
  const [file] = event.target.files;
  if (file) openStl(file);
  event.target.value = '';
});
document.querySelector('#export-file').addEventListener('click', exportStl);
document.querySelectorAll('.tool').forEach((button) => {
  button.addEventListener('click', () => setTool(button.dataset.tool));
});
document.querySelectorAll('[data-view]').forEach((button) => {
  button.addEventListener('click', () => setView(button.dataset.view));
});
document.querySelector('#close-panel').addEventListener('click', () => {
  ui.inspector.classList.remove('open');
  setTool('select');
});
document.querySelector('#clear-measure').addEventListener('click', () => {
  clearMeasurement();
  setStatus('Nuova misura: clicca il primo punto.');
});
ui.applyMoveHole.addEventListener('click', (event) => {
  event.preventDefault();
  applyMoveHole();
});
document.querySelector('#reset-move-hole').addEventListener('click', () => {
  clearHoleMove();
  setStatus('Clicca la parete interna del foro da spostare.');
});
ui.moveHoleInputs.forEach((input) => {
  input.addEventListener('input', updateHoleTargetFromInputs);
});
ui.holeOffsetInputs.forEach((input) => {
  input.addEventListener('input', updateHoleCreateFromInputs);
});
[
  ui.boxWidth,
  ui.boxDepth,
  ui.boxHeight,
  ui.boxOperation,
  ...ui.boxOffsetInputs,
].forEach((input) => {
  input.addEventListener('input', drawBoxPreview);
  input.addEventListener('change', drawBoxPreview);
});
ui.applyBox.addEventListener('click', (event) => {
  event.preventDefault();
  applyBox();
});
document.querySelector('#reset-box').addEventListener('click', () => {
  clearBoxPlacement();
  setStatus('Clicca il punto di appoggio del parallelepipedo.');
});
[
  ui.cylinderDiameter,
  ui.cylinderHeight,
  ui.cylinderAxis,
  ui.cylinderOperation,
  ...ui.cylinderOffsetInputs,
].forEach((input) => {
  input.addEventListener('input', drawCylinderPreview);
  input.addEventListener('change', drawCylinderPreview);
});
ui.applyCylinder.addEventListener('click', (event) => {
  event.preventDefault();
  applyCylinder();
});
document.querySelector('#reset-cylinder').addEventListener('click', () => {
  clearCylinderPlacement();
  setStatus('Clicca il centro di appoggio del cilindro.');
});
[
  ui.cutShape,
  ui.cutWidth,
  ui.cutDepth,
  ui.cutHeight,
  ui.cutDiameter,
  ui.cutCylinderHeight,
  ui.cutAxis,
  ...ui.cutOffsetInputs,
].forEach((input) =