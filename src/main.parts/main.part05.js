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
  requestRender();
}

document.querySelector('#open-file').addEventListener('click', () => ui.fileInput.click());
ui.fileInput.addEventListener('change', (event) => {
  const [file] = event.target.files;
  if (file) openStl(file);
  event.target.value = '';
});
ui.removeModelButton.addEventListener('click', removeCurrentModel);
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
].forEach((input) => {
  input.addEventListener('input', updateCutFields);
  input.addEventListener('change', updateCutFields);
});
ui.applyCut.addEventListener('click', (event) => {
  event.preventDefault();
  applyCut();
});
document.querySelector('#reset-cut').addEventListener('click', () => {
  clearCutPlacement();
  setStatus('Sottrai: clicca il punto in cui piazzare la figura di taglio.');
});
[
  ui.textContent,
  ui.textFont,
  ui.textOperation,
  ui.textSize,
  ui.textDepth,
  ui.textWidth,
  ui.textBevel,
  ui.textRotation,
  ui.textBold,
  ui.textItalic,
  ...ui.textOffsetInputs,
].forEach((input) => {
  input.addEventListener('input', drawTextPreview);
  input.addEventListener('change', drawTextPreview);
});
ui.applyText.addEventListener('click', (event) => {
  event.preventDefault();
  applyText();
});
document.querySelector('#reset-text').addEventListener('click', () => {
  clearTextPlacement();
  setStatus('Testo: clicca il punto basso sinistro in cui appoggiarlo.');
});
ui.applySketch.addEventListener('click', (event) => {
  event.preventDefault();
  applySketch();
});
document.querySelector('#reset-sketch').addEventListener('click', () => {
  clearSketch();
  setStatus('Linea: clicca il primo punto della sagoma.');
});
ui.holeDiameter.addEventListener('input', drawHoleCreatePreview);
ui.holeDepth.addEventListener('input', drawHoleCreatePreview);
ui.applyHole.addEventListener('click', (event) => {
  event.preventDefault();
  applyHole();
});
document.querySelector('#reset-hole').addEventListener('click', () => {
  clearHoleCreate();
  setStatus('Clicca una superficie per impostare il centro del foro.');
});
ui.pushPullForm.addEventListener('submit', (event) => {
  event.preventDefault();
  applyPushPull(parseDecimal(document.querySelector('#pushpull-distance').value, 0));
});
ui.measureValue.addEventListener('focus', () => {
  if (activeTool !== 'line' || !sketchPoints.length || sketchClosed) return;
  if (!sketchLengthInput) ui.measureValue.select();
});
ui.measureValue.addEventListener('input', () => {
  if (activeTool !== 'line' || !sketchPoints.length || sketchClosed) return;
  setSketchLengthInput(ui.measureValue.value);
});
ui.measureValue.addEventListener('keydown', (event) => {
  if (activeTool !== 'line' || !sketchPoints.length || sketchClosed) return;
  if (event.key === 'Enter') {
    event.preventDefault();
    commitSketchPreviewPoint();
  }
  if (event.key === 'Escape') {
    event.preventDefault();
    sketchLengthInput = '';
    ui.measureValue.blur();
    updateSketchLengthReadout(sketchPreviewPoint);
    setStatus('Lunghezza manuale annullata.');
  }
});
ui.undo.addEventListener('click', () => restoreFrom(undoStack, redoStack));
ui.redo.addEventListener('click', () => restoreFrom(redoStack, undoStack));

canvas.addEventListener('pointerdown', (event) => {
  if (appBusy) return;
  pointerDown = { x: event.clientX, y: event.clientY };
});
canvas.addEventListener('pointerup', (event) => {
  if (appBusy) return;
  if (!pointerDown) return;
  const movement = Math.hypot(event.clientX - pointerDown.x, event.clientY - pointerDown.y);
  pointerDown = null;
  if (movement < 4 && event.button === 0 && !['orbit', 'pan'].includes(activeTool)) {
    if (activeTool === 'measure') measureAt(event.clientX, event.clientY);
    else if (activeTool === 'movehole') moveHoleAt(event.clientX, event.clientY);
    else if (activeTool === 'hole') holeAt(event.clientX, event.clientY);
    else if (activeTool === 'box') boxAt(event.clientX, event.clientY);
    else if (activeTool === 'cylinder') cylinderAt(event.clientX, event.clientY);
    else if (activeTool === 'cut') cutAt(event.clientX, event.clientY);
    else if (activeTool === 'text') textAt(event.clientX, event.clientY);
    else if (activeTool === 'line') sketchAt(event.clientX, event.clientY);
    else selectAt(event.clientX, event.clientY);
  }
});
canvas.addEventListener('pointermove', (event) => {
  if (appBusy) return;
  previewMeasurement(event.clientX, event.clientY);
  previewSketch(event.clientX, event.clientY);
});
canvas.addEventListener('contextmenu', (event) => event.preventDefault());

window.addEventListener('keydown', (event) => {
  if (appBusy) {
    event.preventDefault();
    return;
  }
  if (event.target === ui.measureValue && activeTool === 'line') return;
  if (handleSketchLengthShortcut(event)) return;
  if (event.target.matches('input, textarea, select')) return;
  if (handleDeleteKey(event)) return;
  if (event.ctrlKey && event.key.toLowerCase() === 'z') {
    event.preventDefault();
    restoreFrom(undoStack, redoStack);
    return;
  }
  if (event.ctrlKey && event.key.toLowerCase() === 'y') {
    event.preventDefault();
    restoreFrom(redoStack, undoStack);
    return;
  }
  const shortcuts = {
    ' ': 'select',
    p: 'pushpull',
    h: 'hole',
    f: 'movehole',
    b: 'box',
    c: 'cylinder',
    t: 'cut',
    a: 'text',
    l: 'line',
    m: 'measure',
    o: 'orbit',
  };
  const tool = shortcuts[event.key.toLowerCase()];
  if (tool) {
    event.preventDefault();
    setTool(tool);
  }
  if (event.key === 'Escape') {
    if (activeTool === 'measure' && measurementStart && !measurementEnd) {
      clearMeasurement();
      setStatus('Misura annullata.');
    } else {
      setTool('select');
    }
  }
});

new ResizeObserver(resize).observe(viewport);
createExample();
updateInspector();

requestRender();
