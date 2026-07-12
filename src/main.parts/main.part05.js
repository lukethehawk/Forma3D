  snapshot({
    title: t('Creato foro'),
    detail: `${t('diametro')} ${formatMillimeters(diameter)}, ${t('profondita')} ${formatMillimeters(depth)}`,
  });
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
    const previous = popUndoSnapshotForRollback();
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
    currentFileName = file.name;
    sourceStlName = file.name;
    currentModelInfo = modelComplexityInfo(file, geometry);
    clearUndoRedoHistory();
    setModelGeometry(geometry, false);
    ui.fileName.textContent = file.name;
    updateHistoryButtons();
    fitView();
    setStatus(loadedModelStatus(file.name, currentModelInfo));
  } catch (error) {
    console.error(error);
    setStatus('Il file STL non e leggibile.');
  }
}

function sanitizeFileBase(name, fallback = 'forma3d-model') {
  return String(name || fallback)
    .replace(/\.(stl|obj|forma3d\.json|json)$/i, '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9._-]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || fallback;
}

function downloadBlob(blob, filename) {
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
  return filename;
}

function exportGeometryAsStl(geometry, filename) {
  const exporter = new STLExporter();
  const data = exporter.parse(new THREE.Mesh(geometry, modelMaterial), { binary: true });
  const blob = new Blob([data], { type: 'model/stl' });
  setStatus(`Esportato ${downloadBlob(blob, filename)}.`);
}

function exportGeometryAsObj(geometry, filename) {
  const exporter = new OBJExporter();
  const data = exporter.parse(new THREE.Mesh(geometry, modelMaterial));
  const blob = new Blob([data], { type: 'model/obj' });
  setStatus(`Esportato ${downloadBlob(blob, filename)}.`);
}

function selectedGeometryForExport() {
  if (!model || !selected) return null;
  if (selected.type === 'object') return extractTrianglesFromGeometry(model.geometry, selected.triangles);
  if (selected.type === 'face') return extractTrianglesFromGeometry(model.geometry, selected.region.triangles);
  return null;
}

function exportStl() {
  if (!model) return;
  exportGeometryAsStl(model.geometry, `${sanitizeFileBase(currentFileName)}-modified.stl`);
}

function exportObj() {
  if (!model) return;
  exportGeometryAsObj(model.geometry, `${sanitizeFileBase(currentFileName)}-modified.obj`);
}

function exportSelection(format = 'stl') {
  const geometry = selectedGeometryForExport();
  if (!geometry) {
    setStatus('Seleziona una faccia o un corpo prima di esportare la selezione.');
    return;
  }
  const objectName = selected.type === 'object' && selected.objectIndex !== null
    ? objectItems[selected.objectIndex]?.name
    : 'selection';
  const base = `${sanitizeFileBase(currentFileName)}-${sanitizeFileBase(objectName, 'selection')}`;
  if (format === 'obj') exportGeometryAsObj(geometry, `${base}.obj`);
  else exportGeometryAsStl(geometry, `${base}.stl`);
  geometry.dispose();
}

function exportObjectByIndex(index) {
  const item = objectItems[index];
  if (!item || !model) return;
  const geometry = extractTrianglesFromGeometry(model.geometry, item.triangles);
  if (!geometry) return;
  exportGeometryAsStl(geometry, `${sanitizeFileBase(currentFileName)}-${sanitizeFileBase(item.name)}.stl`);
  geometry.dispose();
}

function matrixForCircularPattern(center, axis, radius, angle) {
  const radial = new THREE.Vector3(radius, 0, 0);
  if (axis === 'x') radial.set(0, radius, 0);
  if (axis === 'y') radial.set(radius, 0, 0);
  const rotationAxis = axis === 'x'
    ? new THREE.Vector3(1, 0, 0)
    : axis === 'y'
      ? new THREE.Vector3(0, 1, 0)
      : new THREE.Vector3(0, 0, 1);
  radial.applyAxisAngle(rotationAxis, angle);
  return new THREE.Matrix4().makeTranslation(
    radial.x,
    radial.y,
    radial.z,
  ).multiply(
    new THREE.Matrix4()
      .makeTranslation(center.x, center.y, center.z)
      .multiply(new THREE.Matrix4().makeRotationAxis(rotationAxis, angle))
      .multiply(new THREE.Matrix4().makeTranslation(-center.x, -center.y, -center.z)),
  );
}

function cloneGeometryWithMatrix(geometry, matrix) {
  const clone = geometry.clone();
  clone.applyMatrix4(matrix);
  clone.computeVertexNormals();
  clone.computeBoundingBox();
  clone.computeBoundingSphere();
  return clone;
}

function applyPattern() {
  const item = patternObjectIndex !== null ? objectItems[patternObjectIndex] : null;
  if (!model || !item) {
    setStatus('Scegli un oggetto dal pannello Oggetti prima di creare un pattern.');
    return;
  }
  const count = Math.min(Math.max(Math.floor(parseDecimal(ui.patternCount.value, 0)), 1), 100);
  const source = extractTrianglesFromGeometry(model.geometry, item.triangles);
  if (!source) {
    setStatus('Non riesco a leggere il corpo selezionato.');
    return;
  }
  source.computeBoundingBox();
  const center = source.boundingBox.getCenter(new THREE.Vector3());
  const copies = [];
  if (ui.patternType.value === 'circular') {
    const radius = parseDecimal(ui.patternRadius.value, 0);
    if (!(radius > 0)) {
      source.dispose();
      setStatus('Inserisci un raggio valido per il pattern circolare.');
      return;
    }
    const totalSlots = count + 1;
    for (let index = 1; index <= count; index += 1) {
      const angle = (Math.PI * 2 * index) / totalSlots;
      copies.push(cloneGeometryWithMatrix(
        source,
        matrixForCircularPattern(center, ui.patternAxis.value, radius, angle),
      ));
    }
  } else {
    const offset = inputVector(ui.patternOffsetInputs);
    if (offset.lengthSq() <= 1e-10) {
      source.dispose();
      setStatus('Inserisci almeno una distanza X/Y/Z diversa da zero.');
      return;
    }
    for (let index = 1; index <= count; index += 1) {
      copies.push(cloneGeometryWithMatrix(
        source,
        new THREE.Matrix4().makeTranslation(
          offset.x * index,
          offset.y * index,
          offset.z * index,
        ),
      ));
    }
  }
  const finalGeometry = combineGeometries([model.geometry, ...copies]);
  source.dispose();
  copies.forEach((geometry) => geometry.dispose());
  if (!finalGeometry) {
    setStatus('Il pattern non ha prodotto geometria valida.');
    return;
  }
  snapshot({
    title: t('Creato pattern'),
    detail: `${item.name}, ${count} ${t('copie')}`,
  });
  setModelGeometry(finalGeometry, false, { preserveSketch: true });
  updateHistoryButtons();
  setPatternDrawerOpen(false);
  setStatus(currentLanguage === 'en'
    ? `Pattern created: ${count} copies.`
    : `Pattern creato: ${count} copie.`);
}

function geometryToProjectPositions(geometry) {
  return Array.from(geometry.getAttribute('position').array);
}

function projectGeometryFromPositions(positions) {
  if (!Array.isArray(positions) || positions.length < 9 || positions.length % 9 !== 0) {
    throw new Error('Invalid project geometry.');
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

function vectorToArray(vector) {
  return [vector.x, vector.y, vector.z];
}

function vectorFromArray(value, fallback = new THREE.Vector3()) {
  return Array.isArray(value) && value.length >= 3
    ? new THREE.Vector3(Number(value[0]) || 0, Number(value[1]) || 0, Number(value[2]) || 0)
    : fallback.clone();
}

function serializeGuides() {
  return {
    edges: sketchEdges.map((edge) => ({
      start: vectorToArray(edge.start),
      end: vectorToArray(edge.end),
      axis: edge.axis ?? null,
    })),
    faces: sketchFaces.map((face) => ({
      points: face.points.map(vectorToArray),
    })),
  };
}

function restoreGuides(guides = {}) {
  sketchPoints = [];
  sketchClosed = false;
  sketchEdges = Array.isArray(guides.edges)
    ? guides.edges.map((edge) => {
        const start = vectorFromArray(edge.start);
        const end = vectorFromArray(edge.end);
        return {
          start,
          end,
          axis: Number.isInteger(edge.axis) ? edge.axis : null,
          key: sketchEdgeKey(start, end),
        };
      })
    : [];
  sketchFaces = Array.isArray(guides.faces)
    ? guides.faces.map((face) => {
        const points = Array.isArray(face.points) ? face.points.map((point) => vectorFromArray(point)) : [];
        return {
          points,
          key: points.map(sketchPointKey).join('|'),
        };
      }).filter((face) => face.points.length >= 3)
    : [];
  drawSketchPreview();
  updateSketchApplyState();
}

function projectPayload() {
  if (!model) return null;
  return {
    version: 1,
    name: sanitizeFileBase(currentFileName),
    units: 'mm',
    sourceStlName,
    currentFileName,
    savedAt: new Date().toISOString(),
    camera: {
      position: vectorToArray(camera.position),
      target: vectorToArray(controls.target),
      up: vectorToArray(camera.up),
    },
    objects: objectItems.map((item) => ({
      name: item.name,
      triangleCount: item.triangles.length,
    })),
    guides: serializeGuides(),
    geometry: {
      type: 'triangle-position-float32',
      positions: geometryToProjectPositions(model.geometry),
    },
  };
}

function saveProject() {
  const project = projectPayload();
  if (!project) return;
  const blob = new Blob([JSON.stringify(project, null, 2)], { type: 'application/json' });
  const filename = `${sanitizeFileBase(project.name)}.forma3d.json`;
  downloadBlob(blob, filename);
  setStatus(`Progetto salvato: ${filename}.`);
}

async function openProject(file) {
  try {
    setStatus('Apertura progetto Forma3D...');
    const project = JSON.parse(await file.text());
    if (!project || project.version !== 1) throw new Error('Unsupported project version.');
    const geometry = projectGeometryFromPositions(project.geometry?.positions);
    clearUndoRedoHistory();
    objectNames = Array.isArray(project.objects)
      ? project.objects.map((item, index) => item.name || objectDefaultName(index))
      : [];
    currentFileName = project.currentFileName || file.name;
    sourceStlName = project.sourceStlName || currentFileName;
    currentModelInfo = modelComplexityInfo(file, geometry);
    setModelGeometry(geometry, false, { preserveSketch: true });
    restoreGuides(project.guides);
    ui.fileName.textContent = currentFileName;
    if (project.camera) {
      camera.position.copy(vectorFromArray(project.camera.position, camera.position));
      camera.up.copy(vectorFromArray(project.camera.up, camera.up));
      controls.target.copy(vectorFromArray(project.camera.target, controls.target));
      controls.update();
    } else {
      fitView();
    }
    updateHistoryButtons();
    setStatus(`Progetto ${file.name} aperto.`);
  } catch (error) {
    console.error(error);
    setStatus('Il progetto Forma3D non e leggibile.');
  }
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
ui.openProjectButton.addEventListener('click', () => ui.projectInput.click());
ui.projectInput.addEventListener('change', (event) => {
  const [file] = event.target.files;
  if (file) openProject(file);
  event.target.value = '';
});
ui.removeModelButton.addEventListener('click', removeCurrentModel);
ui.repairModelButton.addEventListener('click', repairCurrentMesh);
ui.repairReportClose?.addEventListener('click', hideRepairReport);
ui.repairReportOverlay?.addEventListener('click', (event) => {
  if (event.target === ui.repairReportOverlay) hideRepairReport();
});
ui.exportButton.addEventListener('click', exportStl);
ui.exportObjButton.addEventListener('click', exportObj);
ui.exportSelectionButton.addEventListener('click', () => exportSelection('stl'));
ui.saveProjectButton.addEventListener('click', saveProject);
ui.fileInfoButton.addEventListener('click', () => {
  if (!currentModelInfo) return;
  const nextHidden = !ui.fileInfoPopover.hidden;
  ui.fileInfoPopover.hidden = nextHidden;
  ui.fileInfoButton.setAttribute('aria-expanded', String(!nextHidden));
});
ui.objectsToggle.addEventListener('click', () => {
  setObjectsDrawerOpen(!objectsDrawerOpen);
});
ui.objectsClose.addEventListener('click', () => {
  setObjectsDrawerOpen(false);
});
ui.historyToggle.addEventListener('click', () => {
  setHistoryDrawerOpen(!historyDrawerOpen);
});
ui.historyClose.addEventListener('click', () => {
  setHistoryDrawerOpen(false);
});
ui.historyList.addEventListener('click', (event) => {
  const row = event.target.closest('.history-row');
  if (!row) return;
  restoreToHistoryIndex(Number(row.dataset.index));
});
ui.objectsList.addEventListener('input', (event) => {
  const target = event.target;
  if (!(target instanceof HTMLInputElement) || target.dataset.action !== 'rename') return;
  const index = Number(target.dataset.index);
  if (!Number.isInteger(index) || !objectItems[index]) return;
  objectNames[index] = target.value.trim() || objectDefaultName(index);
  objectItems[index].name = objectNames[index];
});
ui.objectsList.addEventListener('click', (event) => {
  const button = event.target.closest('button[data-action]');
  if (!button) return;
  event.preventDefault();
  event.stopPropagation();
  const row = button.closest('.object-row');
  const index = Number(row?.dataset.index ?? button.dataset.index);
  const action = button.dataset.action;
  if (!Number.isInteger(index)) return;
  if (action === 'select') selectObjectByIndex(index);
  if (action === 'pattern') {
    if (!objectItems[index]) {
      setStatus('Scegli un oggetto dal pannello Oggetti prima di creare un pattern.');
      return;
    }
    const selectedObject = selectObjectByIndex(index);
    if (selectedObject) {
      setObjectsDrawerOpen(true);
      setPatternDrawerOpen(true, index);
      setStatus(currentLanguage === 'en'
        ? 'Duplicate options opened for the selected object.'
        : 'Opzioni Duplica aperte per l\'oggetto selezionato.');
    }
  }
  if (action === 'export') exportObjectByIndex(index);
  if (action === 'delete') deleteObjectByIndex(index);
});
function setHelpPopoverOpen(open) {
  if (!ui.helpPopover || !ui.helpButton) return;
  ui.helpPopover.hidden = !open;
  ui.helpButton.setAttribute('aria-expanded', String(open));
  if (open) {
    ui.optionsMenu.hidden = true;
    ui.optionsMenuButton.setAttribute('aria-expanded', 'false');
  }
}
ui.optionsMenuButton.addEventListener('click', () => {
  const nextHidden = !ui.optionsMenu.hidden;
  ui.optionsMenu.hidden = nextHidden;
  ui.optionsMenuButton.setAttribute('aria-expanded', String(!nextHidden));
  if (!nextHidden) setHelpPopoverOpen(false);
});
ui.helpButton.addEventListener('click', () => {
  setHelpPopoverOpen(ui.helpPopover.hidden);
});
ui.helpClose.addEventListener('click', () => {
  setHelpPopoverOpen(false);
});
document.addEventListener('click', (event) => {
  if (!ui.fileInfoPopover.hidden
    && !ui.fileInfoPopover.contains(event.target)
    && !ui.fileInfoButton.contains(event.target)) {
    ui.fileInfoPopover.hidden = true;
    ui.fileInfoButton.setAttribute('aria-expanded', 'false');
  }
  if (objectsDrawerOpen
    && !ui.objectsDrawer.contains(event.target)
    && !ui.patternDrawer.contains(event.target)
    && !ui.objectsToggle.contains(event.target)) {
    setObjectsDrawerOpen(false);
  }
  if (historyDrawerOpen
    && !ui.historyDrawer.contains(event.target)
    && !ui.historyToggle.contains(event.target)) {
    setHistoryDrawerOpen(false);
  }
  if (patternDrawerOpen
    && !ui.patternDrawer.contains(event.target)
    && !ui.objectsDrawer.contains(event.target)) {
    setPatternDrawerOpen(false);
  }
  if (!ui.helpPopover.hidden
    && !ui.helpPopover.contains(event.target)
    && !ui.helpButton.contains(event.target)) {
    setHelpPopoverOpen(false);
  }
  if (ui.optionsMenu.hidden) return;
  if (ui.optionsMenu.contains(event.target) || ui.optionsMenuButton.contains(event.target)) return;
  ui.optionsMenu.hidden = true;
  ui.optionsMenuButton.setAttribute('aria-expanded', 'false');
});
ui.languageSelect.addEventListener('change', () => {
  applyLanguage(ui.languageSelect.value);
});
ui.selectionMode.addEventListener('change', () => {
  setSelectionMode(ui.selectionMode.value);
  setStatus(t(selectionMode === 'object'
    ? 'Modalita oggetto: clicca un corpo per selezionarlo.'
    : 'Modalita faccia: clicca una superficie del modello.'));
});
ui.applyTransform.addEventListener('click', transformCurrentModel);
ui.alignFaceGround.addEventListener('click', () => rotateSelectedFaceDown(true));
ui.rotateFaceDown.addEventListener('click', () => rotateSelectedFaceDown(false));
ui.centerOrigin.addEventListener('click', centerTransformTargetOnOrigin);
ui.scaleToMax.addEventListener('click', scaleTransformTargetToMax);
[
  ...ui.transformTranslateInputs,
  ...ui.transformRotateInputs,
  ui.transformScale,
].forEach((input) => {
  input.addEventListener('input', drawTransformPreview);
  input.addEventListener('change', drawTransformPreview);
});
ui.patternClose.addEventListener('click', () => setPatternDrawerOpen(false));
ui.patternType.addEventListener('change', renderPatternDrawer);
ui.applyPattern.addEventListener('click', applyPattern);
ui.splitAxis.addEventListener('change', () => {
  resetSplitDefaults();
  drawSplitPreview();
});
[
  ui.splitPosition,
  ui.splitCap,
  ui.splitSeparate,
].forEach((input) => {
  input.addEventListener('input', drawSplitPreview);
  input.addEventListener('change', drawSplitPreview);
});
ui.applySplit.addEventListener('click', applySplit);
ui.exportSplitNegative.addEventListener('click', () => exportSplitHalf('negative'));
ui.exportSplitPositive.addEventListener('click', () => exportSplitHalf('positive'));
document.querySelector('#reset-split').addEventListener('click', () => {
  resetSplitDefaults();
  drawSplitPreview();
});
document.querySelectorAll('.tool[data-tool]').forEach((button) => {
  button.addEventListener('click', () => setTool(button.dataset.tool));
});
document.querySelectorAll('[data-view]').forEach((button) => {
  button.addEventListener('click', () => setView(button.dataset.view));
});
document.querySelector('#close-panel').addEventListener('click', () => {
  ui.inspector.classList.remove('open');
  if (activeTool !== 'select') {
    setTool('select');
    ui.inspector.classList.remove('open');
  }
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
  ui.coneDiameter,
  ui.coneHeight,
  ui.coneAxis,
  ui.coneOperation,
  ...ui.coneOffsetInputs,
].forEach((input) => {
  input.addEventListener('input', drawConePreview);
  input.addEventListener('change', drawConePreview);
});
ui.applyCone.addEventListener('click', (event) => {
  event.preventDefault();
  applyCone();
});
document.querySelector('#reset-cone').addEventListener('click', () => {
  clearConePlacement();
  setStatus('Clicca il centro di appoggio del cono.');
});
[
  ui.pyramidWidth,
  ui.pyramidDepth,
  ui.pyramidHeight,
  ui.pyramidAxis,
  ui.pyramidOperation,
  ...ui.pyramidOffsetInputs,
].forEach((input) => {
  input.addEventListener('input', drawPyramidPreview);
  input.addEventListener('change', drawPyramidPreview);
});
ui.applyPyramid.addEventListener('click', (event) => {
  event.preventDefault();
  applyPyramid();
});
document.querySelector('#reset-pyramid').addEventListener('click', () => {
  clearPyramidPlacement();
  setStatus('Clicca il centro di appoggio della piramide.');
});
[
  ui.gearTeeth,
  ui.gearModule,
  ui.gearWidth,
  ui.gearBore,
  ui.gearHubDiameter,
  ui.gearHubWidth,
  ui.gearBacklash,
  ui.gearQuality,
  ui.gearAxis,
  ui.gearOperation,
  ...ui.gearOffsetInputs,
].forEach((input) => {
  input.addEventListener('input', scheduleGearPreview);
  input.addEventListener('change', scheduleGearPreview);
});
ui.applyGear.addEventListener('click', (event) => {
  event.preventDefault();
  applyGear();
});
document.querySelector('#reset-gear').addEventListener('click', () => {
  clearGearPlacement();
  setStatus("Clicca il centro di appoggio dell'ingranaggio.");
});
[
  ui.planeShape,
  ui.planeAxis,
  ui.planeWidth,
  ui.planeDepth,
  ...ui.planeOffsetInputs,
].forEach((input) => {
  input.addEventListener('input', drawPlanePreview);
  input.addEventListener('change', drawPlanePreview);
});
ui.applyPlane.addEventListener('click', (event) => {
  event.preventDefault();
  applyPlane();
});
document.querySelector('#reset-plane').addEventListener('click', () => {
  clearPlanePlacement();
  setStatus('Piani: clicca il centro della faccia piatta.');
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
ui.shortenAxis.addEventListener('change', () => {
  resetShortenDefaults();
  drawShortenPreview();
});
ui.shortenWholeModel.addEventListener('change', () => {
  resetShortenDefaults();
  drawShortenPreview();
});
[
  ui.shortenLength,
  ui.shortenCenter,
].forEach((input) => {
  input.addEventListener('input', drawShortenPreview);
  input.addEventListener('change', drawShortenPreview);
});
ui.applyShorten.addEventListener('click', (event) => {
  event.preventDefault();
  applyShorten();
});
document.querySelector('#reset-shorten').addEventListener('click', () => {
  resetShortenDefaults();
  drawShortenPreview();
  setStatus('Accorcia: seleziona un oggetto con doppio click, poi regola asse, lunghezza e centro taglio.');
});
ui.hollowThickness.addEventListener('input', updateHollowState);
ui.hollowThickness.addEventListener('change', updateHollowState);
ui.applyHollow.addEventListener('click', (event) => {
  event.preventDefault();
  applyHollow();
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
ui.newSketchLine.addEventListener('click', () => {
  clearSketchCurrentLine();
});
ui.sketchPlane.addEventListener('change', () => {
  const mode = ui.sketchPlane.value === 'auto'
    ? 'Auto 3D: i punti magnetici restano nella loro posizione reale.'
    : `Piano Linea impostato su ${ui.sketchPlane.value.toUpperCase()}.`;
  drawSketchPreview(sketchPreviewPoint, sketchPreviewAxis);
  setStatus(`${mode} Le linee gia tracciate restano in bozza.`);
});
ui.sketchInference.addEventListener('change', () => {
  setStatus(ui.sketchInference.checked
    ? 'Aggancio assi e parallele attivo. Le linee gia tracciate restano in bozza.'
    : 'Aggancio assi e parallele disattivato. Le linee gia tracciate restano in bozza.');
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
  applyPushPull(parseDecimal(ui.pushPullDistance.value, 0));
});
ui.pushPullVisualHandle?.addEventListener('change', () => {
  localStorage.setItem(PUSH_PULL_VISUAL_STORAGE_KEY, ui.pushPullVisualHandle.checked ? 'true' : 'false');
  ui.pushPullVisualHelp.hidden = !ui.pushPullVisualHandle.checked;
  if (ui.pushPullVisualHandle.checked) refreshPushPullHandle();
  else clearPushPullHandle();
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
  if (event.button === 0 && startPushPullHandleDrag(event)) {
    pointerDown = null;
    return;
  }
  pointerDown = { x: event.clientX, y: event.clientY };
});
canvas.addEventListener('pointerup', (event) => {
  if (appBusy) return;
  if (finishPushPullHandleDrag(event)) {
    pointerDown = null;
    return;
  }
  if (!pointerDown) return;
  const movement = Math.hypot(event.clientX - pointerDown.x, event.clientY - pointerDown.y);
  pointerDown = null;
  if (movement < 4 && event.button === 0 && !['orbit', 'pan'].includes(activeTool)) {
    if (activeTool === 'measure') measureAt(event.clientX, event.clientY);
    else if (activeTool === 'movehole') moveHoleAt(event.clientX, event.clientY);
    else if (activeTool === 'hole') holeAt(event.clientX, event.clientY);
    else if (activeTool === 'box') boxAt(event.clientX, event.clientY);
    else if (activeTool === 'cylinder') cylinderAt(event.clientX, event.clientY);
    else if (activeTool === 'cone') coneAt(event.clientX, event.clientY);
    else if (activeTool === 'pyramid') pyramidAt(event.clientX, event.clientY);
    else if (activeTool === 'gear') gearAt(event.clientX, event.clientY);
    else if (activeTool === 'plane') planeAt(event.clientX, event.clientY);
    else if (activeTool === 'cut') cutAt(event.clientX, event.clientY);
    else if (activeTool === 'text') textAt(event.clientX, event.clientY);
    else if (activeTool === 'line') sketchAt(event.clientX, event.clientY);
    else if (activeTool === 'select') {
      setSelectionMode('face', { clear: false, refresh: false });
      selectAt(event.clientX, event.clientY, 'face');
    } else if (activeTool === 'pushpull') {
      setSelectionMode('face', { clear: false, refresh: false });
      selectAt(event.clientX, event.clientY, 'face');
    }
    else selectAt(event.clientX, event.clientY);
  }
});
canvas.addEventListener('dblclick', (event) => {
  if (appBusy || !['select', 'transform'].includes(activeTool)) return;
  event.preventDefault();
  setSelectionMode('object', { clear: false, refresh: false });
  selectObjectAt(event.clientX, event.clientY);
});
canvas.addEventListener('pointermove', (event) => {
  if (appBusy) return;
  if (updatePushPullHandleDrag(event)) return;
  updateSnapIndicator(event.clientX, event.clientY);
  previewMeasurement(event.clientX, event.clientY);
  previewSketch(event.clientX, event.clientY);
});
canvas.addEventListener('pointercancel', () => {
  cancelPushPullHandleDrag();
  pointerDown = null;
});
canvas.addEventListener('contextmenu', (event) => event.preventDefault());

window.addEventListener('keydown', (event) => {
  if (appBusy) {
    event.preventDefault();
    return;
  }
  if (event.key === 'Escape' && ui.repairReportOverlay && !ui.repairReportOverlay.hidden) {
    event.preventDefault();
    hideRepairReport();
    return;
  }
  if (event.key === 'Escape' && ui.helpPopover && !ui.helpPopover.hidden) {
    event.preventDefault();
    setHelpPopoverOpen(false);
    return;
  }
  if (event.key === 'Escape' && cancelPushPullHandleDrag()) {
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
    v: 'cone',
    i: 'pyramid',
    k: 'gear',
    n: 'plane',
    t: 'cut',
    x: 'shorten',
    u: 'hollow',
    a: 'text',
    l: 'line',
    m: 'measure',
    g: 'transform',
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
applyLanguage(localStorage.getItem('forma3d-language') ?? 'en');

requestRender();
