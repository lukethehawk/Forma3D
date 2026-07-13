 input.value = '0';
    input.disabled = true;
  });
  ui.applyMoveHole.disabled = true;
}

function clearBoxPlacement() {
  boxPlacement = null;
  if (boxPreview) {
    scene.remove(boxPreview);
    disposeObject(boxPreview);
    boxPreview = null;
    requestRender();
  }
  ui.boxInfo.textContent = t('Clicca dove vuoi appoggiare il parallelepipedo.');
  ui.boxOffsetInputs.forEach((input) => {
    input.value = '0';
  });
  ui.applyBox.disabled = true;
}

function clearCylinderPlacement() {
  cylinderPlacement = null;
  if (cylinderPreview) {
    scene.remove(cylinderPreview);
    disposeObject(cylinderPreview);
    cylinderPreview = null;
    requestRender();
  }
  ui.cylinderInfo.textContent = t('Clicca dove vuoi appoggiare il cilindro.');
  ui.cylinderOffsetInputs.forEach((input) => {
    input.value = '0';
  });
  ui.applyCylinder.disabled = true;
}

function clearConePlacement() {
  conePlacement = null;
  if (conePreview) {
    scene.remove(conePreview);
    disposeObject(conePreview);
    conePreview = null;
    requestRender();
  }
  ui.coneInfo.textContent = t('Clicca dove vuoi appoggiare il cono.');
  ui.coneOffsetInputs.forEach((input) => {
    input.value = '0';
  });
  ui.applyCone.disabled = true;
}

function clearPyramidPlacement() {
  pyramidPlacement = null;
  if (pyramidPreview) {
    scene.remove(pyramidPreview);
    disposeObject(pyramidPreview);
    pyramidPreview = null;
    requestRender();
  }
  ui.pyramidInfo.textContent = t('Clicca dove vuoi appoggiare la piramide.');
  ui.pyramidOffsetInputs.forEach((input) => {
    input.value = '0';
  });
  ui.applyPyramid.disabled = true;
}

function clearGearPlacement() {
  gearPlacement = null;
  if (gearPreviewTimer) {
    clearTimeout(gearPreviewTimer);
    gearPreviewTimer = null;
  }
  if (gearPreview) {
    scene.remove(gearPreview);
    disposeObject(gearPreview);
    gearPreview = null;
    requestRender();
  }
  ui.gearInfo.textContent = t("Clicca dove vuoi appoggiare l'ingranaggio.");
  ui.gearOffsetInputs.forEach((input) => {
    input.value = '0';
  });
  ui.applyGear.disabled = true;
}

function clearPlanePlacement() {
  planePlacement = null;
  if (planePreview) {
    scene.remove(planePreview);
    disposeObject(planePreview);
    planePreview = null;
    requestRender();
  }
  ui.planeInfo.textContent = t('Clicca dove vuoi creare il piano.');
  ui.planeOffsetInputs.forEach((input) => {
    input.value = '0';
  });
  ui.applyPlane.disabled = true;
}

function clearJointPlacement() {
  jointPlacement = null;
  if (jointPreview) {
    scene.remove(jointPreview);
    disposeObject(jointPreview);
    jointPreview = null;
    requestRender();
  }
  ui.jointInfo.textContent = t('Clicca dove vuoi creare il profilo.');
  ui.jointOffsetInputs.forEach((input) => {
    input.value = '0';
  });
  ui.applyJoint.disabled = true;
}

function clearCutPlacement() {
  cutPlacement = null;
  if (cutPreview) {
    scene.remove(cutPreview);
    disposeObject(cutPreview);
    cutPreview = null;
    requestRender();
  }
  ui.cutInfo.textContent = t('Scegli forma e clicca dove vuoi togliere materiale.');
  ui.cutOffsetInputs.forEach((input) => {
    input.value = '0';
  });
  ui.applyCut.disabled = true;
}

function clearShortenPlacement() {
  if (shortenPreview) {
    scene.remove(shortenPreview);
    disposeObject(shortenPreview);
    shortenPreview = null;
    requestRender();
  }
  if (ui.shortenInfo) {
    ui.shortenInfo.textContent = t('Seleziona un oggetto, poi accorcialo con un piano di taglio e richiudi la superficie.');
  }
  if (ui.applyShorten) ui.applyShorten.disabled = !model;
}

function clearSplitPlacement() {
  if (splitPreview) {
    scene.remove(splitPreview);
    disposeObject(splitPreview);
    splitPreview = null;
    requestRender();
  }
  if (ui.splitInfo) {
    ui.splitInfo.textContent = t('Taglia il modello con un piano e opzionalmente separa le due meta.');
  }
  if (ui.splitReadout) {
    ui.splitReadout.textContent = t('La linea blu indica il piano di taglio.');
  }
  if (ui.applySplit) ui.applySplit.disabled = !model;
  if (ui.exportSplitNegative) ui.exportSplitNegative.disabled = !model;
  if (ui.exportSplitPositive) ui.exportSplitPositive.disabled = !model;
}

function clearHollowState() {
  if (ui.hollowInfo) {
    ui.hollowInfo.textContent = t('Svuota il modello mantenendo la superficie esterna e creando una parete interna.');
  }
  if (ui.applyHollow) ui.applyHollow.disabled = !model;
}

function clearTextPlacement() {
  textPreviewRequest += 1;
  textPlacement = null;
  if (textPreview) {
    scene.remove(textPreview);
    disposeObject(textPreview);
    textPreview = null;
    requestRender();
  }
  ui.textInfo.textContent = t('Clicca dove vuoi appoggiare il testo.');
  ui.textOffsetInputs.forEach((input) => {
    input.value = '0';
  });
  ui.applyText.disabled = true;
}

function clearTransformPreview() {
  if (!transformPreview) return;
  scene.remove(transformPreview);
  disposeObject(transformPreview);
  transformPreview = null;
  requestRender();
}

function clearPatternPreview() {
  if (!patternPreview) return;
  scene.remove(patternPreview);
  disposeObject(patternPreview);
  patternPreview = null;
  requestRender();
}

function clearSketch() {
  sketchPoints = [];
  sketchEdges = [];
  sketchFaces = [];
  sketchClosed = false;
  sketchPreviewPoint = null;
  sketchPreviewAxis = null;
  sketchLengthInput = '';
  if (sketchPreview) {
    scene.remove(sketchPreview);
    disposeObject(sketchPreview);
    sketchPreview = null;
    requestRender();
  }
  ui.sketchInfo.textContent = t('Clicca punti, vertici o punti medi. Le guide restano finche premi Ricomincia.');
  updateMeasureBoxMode();
  ui.applySketch.textContent = t('Applica facce');
  ui.applySketch.disabled = true;
}

function clearSketchCurrentLine() {
  sketchPoints = [];
  sketchClosed = false;
  sketchPreviewPoint = null;
  sketchPreviewAxis = null;
  sketchLengthInput = '';
  ui.measureValue.value = '-- mm';
  updateMeasureBoxMode();
  drawSketchPreview();
  ui.sketchInfo.textContent = currentLanguage === 'en'
    ? `${sketchEdges.length} guides and ${sketchFaces.length} draft faces. Click a point to start another line.`
    : `${sketchEdges.length} guide e ${sketchFaces.length} facce in bozza. Clicca un punto per iniziare un'altra linea.`;
}

function updateEdges() {
  if (edges) {
    scene.remove(edges);
    edges.geometry.dispose();
    edges = null;
    requestRender();
  }
  if (!model) return;
  if (triangleCount(model.geometry) > MAX_EDGE_TRIANGLES) {
    return;
  }
  edges = new THREE.LineSegments(createDisplayEdgesGeometry(model.geometry, MODEL_EDGE_ANGLE), edgeMaterial);
  edges.renderOrder = 2;
  scene.add(edges);
  requestRender();
}

function updateModelActions() {
  const hasModel = Boolean(model);
  ui.exportButton.disabled = !hasModel;
  ui.exportObjButton.disabled = !hasModel;
  ui.exportSelectionButton.disabled = !hasModel || !selected;
  ui.saveProjectButton.disabled = !hasModel;
  ui.repairModelButton.disabled = !hasModel;
  ui.removeModelButton.disabled = !hasModel;
  if (ui.emptyState) ui.emptyState.hidden = hasModel;
}

function objectDefaultName(index) {
  return currentLanguage === 'en' ? `Body ${index + 1}` : `Corpo ${index + 1}`;
}

function objectIndexForTriangles(triangles) {
  const source = new Set(triangles);
  return objectItems.findIndex((item) =>
    item.triangles.length === triangles.length
    && item.triangles.every((triangle) => source.has(triangle)));
}

function refreshObjectItems() {
  if (!model) {
    objectItems = [];
    objectNames = [];
    objectItemsDeferred = false;
    patternObjectIndex = null;
    setPatternDrawerOpen(false);
    renderObjectsDrawer();
    return;
  }

  const info = currentModelInfo ?? modelComplexityInfo(null, model.geometry);
  if (info.skipConnectedComponents) {
    objectItems = [];
    objectNames = [];
    objectItemsDeferred = true;
    renderObjectsDrawer();
    return;
  }

  objectItemsDeferred = false;
  const previousNames = objectNames.slice();
  const components = collectConnectedComponents(model.geometry);
  objectItems = components.map((component, index) => ({
    index,
    id: `body-${index}`,
    name: previousNames[index] || objectDefaultName(index),
    triangles: component.triangles,
  }));
  objectNames = objectItems.map((item) => item.name);
  if (patternObjectIndex !== null && !objectItems[patternObjectIndex]) {
    patternObjectIndex = null;
    setPatternDrawerOpen(false);
  }
  renderObjectsDrawer();
  renderPatternDrawer();
}

function setObjectsDrawerOpen(open) {
  objectsDrawerOpen = Boolean(open);
  if (objectsDrawerOpen) setHistoryDrawerOpen(false);
  ui.objectsDrawer.classList.toggle('open', objectsDrawerOpen);
  ui.objectsDrawer.setAttribute('aria-hidden', String(!objectsDrawerOpen));
  ui.objectsToggle.classList.toggle('active', objectsDrawerOpen);
}

function setPatternDrawerOpen(open, index = patternObjectIndex) {
  const nextOpen = Boolean(open);
  const nextIndex = Number(index);
  if (nextOpen && (!Number.isInteger(nextIndex) || !objectItems[nextIndex])) {
    patternDrawerOpen = false;
    patternObjectIndex = null;
  } else {
    patternDrawerOpen = nextOpen;
    patternObjectIndex = patternDrawerOpen ? nextIndex : null;
  }
  ui.patternDrawer.classList.toggle('open', patternDrawerOpen);
  ui.patternDrawer.setAttribute('aria-hidden', String(!patternDrawerOpen));
  if (!patternDrawerOpen) clearPatternPreview();
  renderPatternDrawer();
  drawPatternPreview();
}

function renderPatternDrawer() {
  if (!ui.patternTarget) return;
  const item = patternObjectIndex !== null ? objectItems[patternObjectIndex] : null;
  ui.patternTarget.textContent = item
    ? currentLanguage === 'en'
      ? `Target: ${item.name} (${item.triangles.length} triangles)`
      : `Oggetto: ${item.name} (${item.triangles.length} triangoli)`
    : currentLanguage === 'en'
      ? 'Select an object from Objects.'
      : 'Seleziona un oggetto da Oggetti.';
  const isCircular = ui.patternType?.value === 'circular';
  if (ui.patternLinearFields) ui.patternLinearFields.hidden = isCircular;
  if (ui.patternCircularFields) ui.patternCircularFields.hidden = !isCircular;
}

function defaultHistoryAction() {
  return {
    title: t('Modifica'),
    detail: t('Snapshot mesh'),
    createdAt: new Date().toISOString(),
  };
}

function normalizeHistoryAction(action) {
  const fallback = defaultHistoryAction();
  return {
    title: String(action?.title || fallback.title),
    detail: String(action?.detail || fallback.detail),
    createdAt: action?.createdAt || fallback.createdAt,
  };
}

function setHistoryDrawerOpen(open) {
  historyDrawerOpen = Boolean(open);
  if (historyDrawerOpen) {
    setObjectsDrawerOpen(false);
    setPatternDrawerOpen(false);
  }
  ui.historyDrawer.classList.toggle('open', historyDrawerOpen);
  ui.historyDrawer.setAttribute('aria-hidden', String(!historyDrawerOpen));
  ui.historyToggle.classList.toggle('active', historyDrawerOpen);
  ui.historyToggle.setAttribute('aria-expanded', String(historyDrawerOpen));
}

function renderHistoryDrawer() {
  if (!ui.historyList || !ui.historyCount) return;
  const heading = ui.historyDrawer.querySelector('.history-drawer-heading strong');
  const summaryLabel = ui.historyDrawer.querySelector('.history-drawer-summary span:last-child');
  if (heading) heading.textContent = currentLanguage === 'en' ? 'History' : 'Storia';
  if (summaryLabel) summaryLabel.textContent = currentLanguage === 'en' ? 'actions' : 'azioni';
  ui.historyCount.textContent = String(undoHistory.length);
  ui.historyList.replaceChildren();

  if (!undoHistory.length) {
    const empty = document.createElement('span');
    empty.textContent = t('Nessuna modifica');
    ui.historyList.append(empty);
    return;
  }

  undoHistory.forEach((entry, index) => {
    const row = document.createElement('button');
    row.type = 'button';
    row.className = `history-row${index === undoHistory.length - 1 ? ' current' : ''}`;
    row.dataset.index = String(index);
    row.setAttribute('aria-label', entry.title);

    const title = document.createElement('strong');
    title.textContent = index === undoHistory.length - 1
      ? `${entry.title} - ${t('Stato corrente')}`
      : entry.title;
    row.append(title);

    const detail = document.createElement('small');
    detail.textContent = entry.detail;
    row.append(detail);

    ui.historyList.append(row);
  });
}

function clearHistoryMetadata() {
  undoHistory.length = 0;
  redoHistory.length = 0;
  renderHistoryDrawer();
}

function clearUndoRedoHistory() {
  for (const geometry of undoStack) geometry.dispose();
  for (const geometry of redoStack) geometry.dispose();
  undoStack.length = 0;
  redoStack.length = 0;
  clearHistoryMetadata();
  updateHistoryButtons();
}

function popUndoSnapshotForRollback() {
  const previous = undoStack.pop();
  undoHistory.pop();
  renderHistoryDrawer();
  return previous;
}

function restoreToHistoryIndex(index) {
  if (!Number.isInteger(index) || index < 0 || index >= undoHistory.length) return;
  const steps = undoHistory.length - 1 - index;
  for (let step = 0; step < steps; step += 1) {
    restoreFrom(undoStack, redoStack, { silent: true });
  }
  if (steps > 0) {
    updateHistoryButtons();
    setStatus('Passaggio cronologia applicato.');
  }
}

function renderObjectsDrawer() {
  if (!ui.objectsList || !ui.objectsCount) return;
  const heading = ui.objectsDrawer.querySelector('.objects-drawer-heading strong');
  const summaryLabel = ui.objectsDrawer.querySelector('.objects-drawer-summary span:last-child');
  if (heading) heading.textContent = currentLanguage === 'en' ? 'Objects' : 'Oggetti';
  if (summaryLabel) summaryLabel.textContent = currentLanguage === 'en' ? 'connected bodies' : 'corpi connessi';
  ui.objectsCount.textContent = String(objectItems.length);
  ui.objectsList.replaceChildren();

  if (!objectItems.length) {
    const empty = document.createElement('span');
    empty.textContent = objectItemsDeferred
      ? currentLanguage === 'en'
        ? 'Object analysis deferred for this very large mesh.'
        : 'Analisi oggetti rimandata per questa mesh molto grande.'
      : t('Nessun corpo');
    ui.objectsList.append(empty);
    return;
  }

  const activeTriangles = selected?.type === 'object' ? selected.triangles : null;
  for (const item of objectItems) {
    const isSelected = activeTriangles
      && item.triangles.length === activeTriangles.length
      && item.triangles.every((triangle, index) => triangle === activeTriangles[index]);
    const row = document.createElement('div');
    row.className = `object-row${isSelected ? ' selected' : ''}`;
    row.dataset.index = String(item.index);

    const nameInput = document.createElement('input');
    nameInput.value = item.name;
    nameInput.dataset.action = 'rename';
    nameInput.dataset.index = String(item.index);
    nameInput.setAttribute('aria-label', t('Nome oggetto'));
    row.append(nameInput);

    const meta = document.createElement('small');
    meta.textContent = currentLanguage === 'en'
      ? `${item.triangles.length} triangles`
      : `${item.triangles.length} triangoli`;
    row.append(meta);

    const actions = document.createElement('div');
    actions.className = 'object-actions';
    const actionButtons = [
      ['select', currentLanguage === 'en' ? 'Select' : 'Sel.'],
      ['pattern', currentLanguage === 'en' ? 'Duplicate' : 'Duplica'],
      ['export', currentLanguage === 'en' ? 'Export' : 'Export'],
      ['delete', currentLanguage === 'en' ? 'Delete' : 'Elimina'],
    ];
    for (const [action, label] of actionButtons) {
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.action = action;
      button.dataset.index = String(item.index);
      button.textContent = label;
      actions.append(button);
    }
    row.append(actions);
    ui.objectsList.append(row);
  }
}

function setModelGeometry(geometry, recordHistory = true, options = {}) {
  const { preserveSketch = false } = options;
  if (recordHistory && model) snapshot();
  clearTransientOverlays();
  clearSelection();
  clearMeasurement();
  clearHoleCreate();
  clearHoleMove();
  clearBoxPlacement();
  clearCylinderPlacement();
  clearConePlacement();
  clearPyramidPlacement();
  clearGearPlacement();
  clearPlanePlacement();
  clearJointPlacement();
  clearCutPlacement();
  clearShortenPlacement();
  clearSplitPlacement();
  clearHollowState();
  clearTextPlacement();
  clearTransformPreview();
  if (!preserveSketch) clearSketch();

  if (model) {
    scene.remove(model);
    model.geometry.dispose();
  }

  if (geometry.index) {
    const nonIndexed = geometry.toNonIndexed();
    geometry.dispose();
    geometry = nonIndexed;
  }
  geometry.deleteAttribute('uv');
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  model = new THREE.Mesh(geometry, modelMaterial);
  scene.add(model);
  snapPoints = collectDisplaySnapPoints(model.geometry, MODEL_EDGE_ANGLE);
  currentModelInfo = modelComplexityInfo({ size: currentModelInfo?.fileSizeBytes ?? 0 }, model.geometry);
  renderFileInfo();
  refreshObjectItems();
  updateEdges();
  updateModelActions();
  if (preserveSketch && (sketchEdges.length || sketchFaces.length || sketchPoints.length)) {
    updateSketchApplyState();
    drawSketchPreview();
  }
  requestRender();
}

function snapshot(action = defaultHistoryAction()) {
  undoStack.push(model.geometry.clone());
  undoHistory.push(normalizeHistoryAction(action));
  if (undoStack.length > 30) {
    undoStack.shift().dispose();
    undoHistory.shift();
  }
  for (const geometry of redoStack) geometry.dispose();
  redoStack.length = 0;
  redoHistory.length = 0;
  updateHistoryButtons();
}

function restoreFrom(source, destination, options = {}) {
  if (!source.length) return;
  if (model) destination.push(model.geometry.clone());
  const geometry = source.pop();
  if (source === undoStack && destination === redoStack) {
    const action = undoHistory.pop();
    if (action) redoHistory.push(action);
  } else if (source === redoStack && destination === undoStack) {
    const action = redoHistory.pop();
    if (action) undoHistory.push(action);
  }
  setModelGeometry(geometry, false, { preserveSketch: true });
  ui.fileName.textContent = currentFileName;
  updateHistoryButtons();
  if (!options.silent) setStatus('Passaggio cronologia applicato.');
}

function updateHistoryButtons() {
  ui.undo.disabled = undoStack.length === 0;
  ui.redo.disabled = redoStack.length === 0;
  renderHistoryDrawer();
}

function setSelectionMode(mode, options = {}) {
  const {
    clear = true,
    persist = true,
    refresh = true,
  } = options;
  selectionMode = mode === 'object' ? 'object' : 'face';
  if (persist) localStorage.setItem('forma3d-selection-mode', selectionMode);
  ui.selectionMode.value = selectionMode;
  if (clear) clearSelection();
  if (refresh) updateInspector();
}

function clearCurrentModel(message = 'Modello rimosso. Apri un STL o crea una nuova figura.') {
  clearTransientOverlays();
  clearSelection();
  clearMeasurement();
  clearHoleCreate();
  clearHoleMove();
  clearBoxPlacement();
  clearCylinderPlacement();
  clearConePlacement();
  clearPyramidPlacement();
  clearGearPlacement();
  clearPlanePlacement();
  clearCutPlacement();
  clearShortenPlacement();
  clearSplitPlacement();
  clearTextPlacement();
  clearTransformPreview();
  clearSketch();

  if (model) {
    scene.remove(model);
    model.geometry.dispose();
    model = null;
  }

  updateEdges();
  snapPoints = [];
  clearSnapIndicator();
  currentFileName = 'modello-senza-titolo.stl';
  sourceStlName = 'modello-senza-titolo.stl';
  currentModelInfo = null;
  renderFileInfo();
  ui.fileName.textContent = t('Nessun modello');
  updateModelActions();
  refreshObjectItems();
  setObjectsDrawerOpen(false);
  setPatternDrawerOpen(false);
  setHistoryDrawerOpen(false);
  updateHistoryButtons();
  setTool('select');
  setStatus(message);
}

function removeCurrentModel() {
  if (!model) {
    setStatus('Non c e nessun modello da rimuovere.');
    return;
  }
  clearUndoRedoHistory();
  clearCurrentModel('Figura rimossa. Apri un STL o crea una nuova geometria.');
}

function deleteSelectedRegion() {
  if (!selected || !model) {
    setStatus(t(selectionMode === 'object'
      ? "Seleziona l'oggetto da cancellare."
      : 'Seleziona una superficie da cancellare, oppure usa Rimuovi modello per togliere tutto.'));
    return false;
  }

  if (selected.type === 'object') {
    const selectedTriangles = selected.triangles ?? [];
    const removedCount = selectedTriangles.length;
    if (!removedCount) {
      setStatus(t("Seleziona l'oggetto da cancellare."));
      return false;
    }
    snapshot({
      title: t('Cancellato oggetto'),
      detail: `${removedCount} ${t('facce')}`,
    });
    const geometry = deleteTrianglesFromGeometry(model.geometry, selectedTriangles);
    if (!geometry) {
      clearCurrentModel(t("Oggetto cancellato. Usa Ctrl+Z per ripristinarlo."));
    } else {
      setModelGeometry(geometry, false, { preserveSketch: true });
      setStatus(currentLanguage === 'en'
        ? `Object deleted: ${removedCount} triangles removed. Use Ctrl+Z to undo.`
        : `Oggetto cancellato: ${removedCount} triangoli rimossi. Usa Ctrl+Z per annullare.`);
    }
    updateHistoryButtons();
    return true;
  }

  const triangleCount = selected.region.triangles.length;
  const geometry = deleteTrianglesFromGeometry(model.geometry, selected.region.triangles);
  snapshot({
    title: t('Cancellata superficie'),
    detail: `${triangleCount} ${t('facce')}`,
  });
  if (!geometry) {
    clearCurrentModel('Tutte le superfici sono state cancellate. Usa Annulla per ripristinare.');
  } else {
    setModelGeometry(geometry, false, { preserveSketch: true });
    updateHistoryButtons();
    setStatus(`Superficie cancellata: ${triangleCount} triangoli rimossi. Usa Ctrl+Z per annullare.`);
  }
  return true;
}

function deleteObjectByIndex(index) {
  const item = objectItems[index];
  if (!item || !model) return;
  setSelectedObjectFromTriangles(item.triangles, null, index);
  deleteSelectedRegion();
}

function formatRepairReport(report) {
  const isEnglish = currentLanguage === 'en';
  const cleanup = isEnglish
    ? [
      `${report.weldedVertices} welded vertices`,
      `${report.removedDegenerateTriangles} degenerate triangles removed`,
      `${report.removedDuplicateTriangles} duplicates removed`,
      `${report.filledHoles ?? 0} holes filled`,
      `${report.removedSmallComponents ?? 0} small components removed`,
    ].join(', ')
    : [
      `${report.weldedVertices} vertici saldati`,
      `${report.removedDegenerateTriangles} triangoli degeneri rimossi`,
      `${report.removedDuplicateTriangles} duplicati rimossi`,
      `${report.filledHoles ?? 0} buchi chiusi`,
      `${report.removedSmallComponents ?? 0} componenti piccole rimosse`,
    ].join(', ');
  const topology = [];
  if (report.boundaryEdges) {
    topology.push(isEnglish
      ? `${report.boundaryEdges} open edges remain`
      : `${report.boundaryEdges} bordi aperti restano`);
  }
  if (report.nonManifoldEdges) {
    topology.push(isEnglish
      ? `${report.nonManifoldEdges} non-manifold edges remain`
      : `${report.nonManifoldEdges} spigoli non-manifold restano`);
  }
  const warning = topology.length
    ? (isEnglish ? ` Warning: ${topology.join(', ')}.` : ` Attenzione: ${topology.join(', ')}.`)
    : '';
  return isEnglish
    ? `Mesh repaired: ${report.trianglesBefore} -> ${report.trianglesAfter} triangles, ${cleanup}.${warning}`
    : `Mesh riparata: ${report.trianglesBefore} -> ${report.trianglesAfter} triangoli, ${cleanup}.${warning}`;
}

function repairWarningText(warning) {
  const english = {
    'boundary-edges-remaining': 'Open edges remain: check the model in the slicer or try a smaller, cleaner repair pass.',
    'hole-fill-skipped-ambiguous-plane': 'A hole was skipped because its plane was ambiguous.',
    'hole-fill-skipped-large-diameter': 'A hole was skipped because its diameter is above the conservative limit.',
    'hole-fill-skipped-large-loop': 'A hole was skipped because it has too many boundary edges.',
    'hole-fill-skipped-large-mesh': 'Automatic hole filling was limited because the mesh is large.',
    'hole-fill-skipped-non-planar-loop': 'A hole was skipped because its boundary is not planar enough.',
    'hole-fill-skipped-open-or-branched-loop': 'An open or branched boundary chain was detected and left unchanged.',
    'hole-fill-skipped-open-sheet': 'An isolated open sheet was detected and was not treated as a hole.',
    'hole-fill-skipped-triangulation-failed': 'A hole was detected but could not be triangulated safely.',
    'non-manifold-edges-remaining': 'Non-manifold edges remain: this may need slicer repair or a dedicated mesh tool.',
    'small-components-detected': 'Small disconnected components were detected but not removed automatically.',
  };
  const italian = {
    'boundary-edges-remaining': 'Restano bordi aperti: controlla il modello nello slicer o prova una riparazione piu pulita.',
    'hole-fill-skipped-ambiguous-plane': 'Un buco e stato saltato perche il suo piano e ambiguo.',
    'hole-fill-skipped-large-diameter': 'Un buco e stato saltato perche il diametro supera il limite conservativo.',
    'hole-fill-skipped-large-loop': 'Un buco e stato saltato perche ha troppi bordi.',
    'hole-fill-skipped-large-mesh': 'La chiusura automatica dei buchi e stata limitata perche la mesh e grande.',
    'hole-fill-skipped-non-planar-loop': 'Un buco e stato saltato perche il contorno non e abbastanza planare.',
    'hole-fill-skipped-open-or-branched-loop': 'Una catena aperta o ramificata e stata rilevata e lasciata invariata.',
    'hole-fill-skipped-open-sheet': 'Una superficie isolata aperta e stata rilevata ma non trattata come buco.',
    'hole-fill-skipped-triangulation-failed': 'Un buco e stato rilevato ma non triangolato in modo sicuro.',
    'non-manifold-edges-remaining': 'Restano spigoli non-manifold: potrebbe servire lo slicer o uno strumento mesh dedicato.',
    'small-components-detected': 'Sono state rilevate piccole componenti scollegate, ma non sono state rimosse automaticamente.',
  };
  return (currentLanguage === 'en' ? english : italian)[warning] ?? warning;
}

function repairMetricRows(report) {
  const rows = currentLanguage === 'en'
    ? [
      ['Triangles', `${report.trianglesBefore} -> ${report.trianglesAfter}`],
      ['Vertices', `${report.verticesBefore} -> ${report.verticesAfter}`],
      ['Welded vertices', report.weldedVertices],
      ['Degenerate triangles removed', report.removedDegenerateTriangles],
      ['Duplicate triangles removed', report.removedDuplicateTriangles],
      ['Flipped triangles', report.flippedTriangles],
      ['Planarized vertices', report.planarizedVertices ?? 0],
      ['Filled holes', report.filledHoles ?? 0],
      ['Added triangles', report.addedTriangles ?? 0],
      ['Boundary loops remaining', report.boundaryLoops ?? 0],
      ['Open edges remaining', report.boundaryEdges],
      ['Non-manifold edges', report.nonManifoldEdges],
      ['Connected components', report.components],
      ['Small components removed', report.removedSmallComponents ?? 0],
    ]
    : [
      ['Triangoli', `${report.trianglesBefore} -> ${report.trianglesAfter}`],
      ['Vertici', `${report.verticesBefore} -> ${report.verticesAfter}`],
      ['Vertici saldati', report.weldedVertices],
      ['Triangoli degeneri rimossi', report.removedDegenerateTriangles],
      ['Triangoli duplicati rimossi', report.removedDuplicateTriangles],
      ['Triangoli riorientati', report.flippedTriangles],
      ['Vertici planarizzati', report.planarizedVertices ?? 0],
      ['Buchi chiusi', report.filledHoles ?? 0],
      ['Triangoli aggiunti', report.addedTriangles ?? 0],
      ['Loop aperti rimasti', report.boundaryLoops ?? 0],
      ['Bordi aperti rimasti', report.boundaryEdges],
      ['Spigoli non-manifold', report.nonManifoldEdges],
      ['Componenti connesse', report.components],
      ['Componenti piccole rimosse', report.removedSmallComponents ?? 0],
    ];
  return rows;
}

function hideRepairReport() {
  ui.repairReportOverlay.hidden = true;
}

function showRepairReport(report) {
  if (!ui.repairReportOverlay) return;
  ui.repairReportTitle.textContent = currentLanguage === 'en'
    ? 'Repair completed'
    : 'Riparazione completata';
  ui.repairReportSummary.textContent = formatRepairReport(report);
  ui.repairReportMetrics.replaceChildren();
  for (const [label, value] of repairMetricRows(report)) {
    const term = document.createElement('dt');
    term.textContent = label;
    const detail = document.createElement('dd');
    detail.textContent = String(value);
    ui.repairReportMetrics.append(term, detail);
  }

  const warnings = [...new Set(report.warnings ?? [])].map(repairWarningText);
  ui.repairReportWarningTitle.textContent = currentLanguage === 'en' ? 'Warnings' : 'Attenzione';
  ui.repairReportWarnings.replaceChildren();
  ui.repairReportWarningBox.hidden = warnings.length === 0;
  for (const warning of warnings) {
    const item = document.createElement('li');
    item.textContent = warning;
    ui.repairReportWarnings.append(item);
  }
  ui.repairReportOverlay.hidden = false;
}

async function repairCurrentMesh() {
  if (!model) {
    setStatus('Apri o crea un modello prima di riparare la mesh.');
    return;
  }

  showBusy('Riparazione mesh...', 'Analizzo bordi aperti, saldo vertici vicini, rimuovo triangoli difettosi e chiudo piccoli buchi planari.');
  await waitForNextFrame();
  await waitForNextFrame();

  let report = null;
  try {
    const repaired = repairMeshGeometry(model.geometry);
    if (!repaired?.geometry) {
      setStatus('La riparazione non ha prodotto una mesh valida. Usa Annulla o riapri il file originale.');
      return;
    }
    snapshot({
      title: t('Riparata mesh'),
      detail: currentLanguage === 'en'
        ? `${repaired.report.trianglesBefore} -> ${repaired.report.trianglesAfter} triangles, ${repaired.report.weldedVertices} welded, ${repaired.report.filledHoles ?? 0} holes filled`
        : `${repaired.report.trianglesBefore} -> ${repaired.report.trianglesAfter} triangoli, ${repaired.report.weldedVertices} saldati, ${repaired.report.filledHoles ?? 0} buchi chiusi`,
    });
    setModelGeometry(repaired.geometry, false, { preserveSketch: true });
    updateHistoryButtons();
    report = repaired.report;
    setStatus(formatRepairReport(report));
  } catch (error) {
    console.error(`Errore riparazione mesh: ${error?.stack ?? error}`);
    setStatus('Non riesco a riparare questa mesh.');
  } finally {
    hideBusy();
  }
  if (report) showRepairReport(report);
}

function transformValuesFromInputs() {
  return {
    translation: inputVector(ui.transformTranslateInputs),
    rotation: new THREE.Euler(
      THREE.MathUtils.degToRad(parseDecimal(ui.transformRotateInputs[0].value, 0)),
      THREE.MathUtils.degToRad(parseDecimal(ui.transformRotateInputs[1].value, 0)),
      THREE.MathUtils.degToRad(parseDecimal(ui.transformRotateInputs[2].value, 0)),
      'XYZ',
    ),
    scale: parseDecimal(ui.transformScale.value, 1),
  };
}

function transformHasChanges(values) {
  const hasTranslation = values.translation.lengthSq() > 1e-10;
  const hasRotation = Math.abs(values.rotation.x) + Math.abs(values.rotation.y) + Math.abs(values.rotation.z) > 1e-10;
  const hasScale = Math.abs(values.scale - 1) > 1e-10;
  return hasTranslation || hasRotation || hasScale;
}

function transformMatrixForBox(box, values) {
  const center = box.getCenter(new THREE.Vector3());
  const matrix = new THREE.Matrix4();
  matrix.multiply(new THREE.Matrix4().makeTranslation(values.translation.x, values.translation.y, values.translation.z));
  matrix.multiply(new THREE.Matrix4().makeTranslation(center.x, center.y, center.z));
  matrix.multiply(new THREE.Matrix4().makeRotationFromEuler(values.rotation));
  matrix.multiply(new THREE.Matrix4().makeScale(values.scale, values.scale, values.scale));
  matrix.multiply(new THREE.Matrix4().makeTranslation(-center.x, -center.y, -center.z));
  return matrix;
}

function resetTransformInputs() {
  ui.transformTranslateInputs.forEach((input) => {
    input.value = '0';
  });
  ui.transformRotateInputs.forEach((input) => {
    input.value = '0';
  });
  ui.transformScale.value = '1';
}

function transformedGeometryFromInputs() {
  if (!model) {
    return null;
  }

  const values = transformValuesFromInputs();
  if (!(values.scale > 0)) {
    return null;
  }

  if (!transformHasChanges(values)) {
    return null;
  }

  let geometry;
  if (selected?.type === 'object' && selected.triangles?.length) {
    const box = selectionBoxFromTriangles(model.geometry, selected.triangles);
    if (!box) return null;
    geometry = transformTrianglesInGeometry(
      model.geometry,
      selected.triangles,
      transformMatrixForBox(box, values),
    );
  } else {
    return null;
  }
  return {
    geometry,
    values,
  };
}

function drawTransformPreview() {
  if (activeTool !== 'transform') return;
  clearTransformPreview();
  const transformed = transformedGeometryFromInputs();
  if (!transformed) return;
  transformPreview = setPreviewMesh(
    transformPreview,
    transformed.geometry,
    0x1679b8,
    'transform-preview',
  );
}

function transformCurrentModel() {
  if (!model) {
    setStatus('Apri o crea un modello prima di trasformarlo.');
    return;
  }

  if (!selected || selected.type !== 'object') {
    setStatus('Seleziona una faccia o un corpo prima di trasformarlo.');
    return;
  }

  const transformed = transformedGeometryFromInputs();
  if (!transformed) {
    const scale = parseDecimal(ui.transformScale.value, 1);
    setStatus(scale > 0
      ? 'Inserisci almeno uno spostamento, una rotazione o una scala diversa da 1.'
      : 'La scala deve essere maggiore di zero.');
    return;
  }

  clearTransformPreview();
  snapshot({
    title: t('Trasformato corpo'),
    detail: `X ${formatMillimeters(transformed.values.translation.x, true)}, Y ${formatMillimeters(transformed.values.translation.y, true)}, Z ${formatMillimeters(transformed.values.translation.z, true)}, R ${formatDecimal(THREE.MathUtils.radToDeg(transformed.values.rotation.x))}/${formatDecimal(THREE.MathUtils.radToDeg(transformed.values.rotation.y))}/${formatDecimal(THREE.MathUtils.radToDeg(transformed.values.rotation.z))} deg, S ${formatDecimal(transformed.values.scale)}x`,
  });
  setModelGeometry(transformed.geometry, false, { preserveSketch: true });
  updateHistoryButtons();
  resetTransformInputs();
  requestRender();
  setStatus(
    `Trasformazione applicata: X ${formatMillimeters(transformed.values.translation.x, true)}, Y ${formatMillimeters(transformed.values.translation.y, true)}, Z ${formatMillimeters(transformed.values.translation.z, true)}, scala ${formatDecimal(transformed.values.scale)}x.`,
  );
}

function currentTransformTarget() {
  if (!model) return null;
  if (selected?.type === 'object' && selected.triangles?.length) {
    const box = selectionBoxFromTriangles(model.geometry, selected.triangles);
    if (!box) return null;
    return {
      box,
      label: t('oggetto'),
      triangles: [...selected.triangles],
    };
  }
  return null;
}

function updateTransformQuickActions() {
  if (!ui.applyTransform) return;
  const hasTarget = Boolean(model && selected?.type === 'object' && selected.triangles?.length);
  const hasFaceReference = Boolean(hasTarget && transformFaceReference);
  ui.applyTransform.disabled = !hasTarget;
  ui.alignFaceGround.disabled = !hasTarget;
  ui.rotateFaceDown.disabled = !hasFaceReference;
  ui.centerOrigin.disabled = !hasTarget;
  ui.scaleToMax.disabled = !hasTarget;
}

function selectTransformReferenceAt(clientX, clientY) {
  const picked = pickSelectableRegion(clientX, clientY);
  if (!picked) {
    clearSelection();
    transformFaceReference = null;
    updateTransformQuickActions();
    setStatus('Trasforma: clicca una faccia per impostare il riferimento.');
    return;
  }

  const { hit, region } = picked;
  const selectionPoint = hit.point?.clone?.() ?? new THREE.Vector3();
  const selectionNormal = region.normal.clone();
  if (regionHasOpenBoundary(model.geometry, region)) {
    const viewDirection = camera.position.clone().sub(selectionPoint);
    if (viewDirection.lengthSq() > 1e-8 && selectionNormal.dot(viewDirection) < 0) {
      selectionNormal.negate();
    }
  }
  transformFaceReference = {
    normal: selectionNormal,
    point: selectionPoint,
    seedTriangle: region.triangles[0],
  };
  setSelectionMode('object', { clear: false, refresh: false });
  const selectedBody = selectObjectComponent(region.triangles[0], selectionPoint);
  if (!selectedBody) {
    transformFaceReference = null;
    updateTransformQuickActions();
    setStatus('Non riesco a selezionare il corpo collegato alla faccia.');
    return;
  }
  if (highlight) {
    scene.remove(highlight);
    disposeObject(highlight);
  }
  const target = currentTransformTarget();
  if (target) {
    highlight = createTransformReferenceOverlay(model.geometry, region.triangles, target.box);
    addTransientOverlay(highlight, 'selection');
  }
  setStatus('Faccia di riferimento selezionata. Sposta e scala agiscono sul corpo collegato.');
  updateTransformQuickActions();
}

function transformedTargetBox(target, matrix) {
  const geometry = target.triangles
    ? extractTrianglesFromGeometry(model.geometry, target.triangles)
    : model.geometry.clone();
  if (!geometry) return null;
  geometry.applyMatrix4(matrix);
  geometry.computeBoundingBox();
  const box = geometry.boundingBox.clone();
  geometry.dispose();
  return box;
}

function applyMatrixToTransformTarget(matrix, title, detail, status) {
  const target = currentTransformTarget();
  if (!target) {
    setStatus('Apri un modello o seleziona un corpo prima di trasformare.');
    return;
  }
  const geometry = target.triangles
    ? transformTrianglesInGeometry(model.geometry, target.triangles, matrix)
    : model.geometry.clone();
  if (!target.triangles) {
    geometry.applyMatrix4(matrix);
    geometry.computeVertexNormals();
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
  }
  snapshot({ title: t(title), detail });
  setModelGeometry(geometry, false, { preserveSketch: true });
  updateHistoryButtons();
  resetTransformInputs();
  requestRender();
  setStatus(status);
}

function placeTransformTargetOnBed() {
  if (transformFaceReference) {
    rotateSelectedFaceDown(true);
    return;
  }
  const target = currentTransformTarget();
  if (!target) {
    setStatus('Apri un modello o seleziona un corpo prima di trasformare.');
    return;
  }
  const matrix = new THREE.Matrix4().makeTranslation(0, 0, -target.box.min.z);
  applyMatrixToTransformTarget(
    matrix,
    'Trasformato corpo',
    t('appoggiato al piano'),
    t('Corpo selezionato appoggiato al piano Z=0.'),
  );
  updateTransformQuickActions();
}

function transformRotationAround(center, quaternion) {
  const matrix = new THREE.Matrix4();
  matrix.multiply(new THREE.Matrix4().makeTranslation(center.x, center.y, center.z));
  matrix.multiply(new THREE.Matrix4().makeRotationFromQuaternion(quaternion));
  matrix.multiply(new THREE.Matrix4().makeTranslation(-center.x, -center.y, -center.z));
  return matrix;
}

function rotateSelectedFaceDown(placeOnGround = false) {
  if (!model || !transformFaceReference) {
    setStatus('Seleziona una faccia, poi apri Trasforma per usare questo comando.');
    return;
  }
  const target = currentTransformTarget();
  if (!target) return;
  const normal = transformFaceReference.normal.clone().normalize();
  if (normal.lengthSq() < 1e-8) {
    setStatus('La faccia selezionata non ha una normale valida.');
    return;
  }
  const center = target.box.getCenter(new THREE.Vector3());
  const quaternion = new THREE.Quaternion().setFromUnitVectors(normal, new THREE.Vector3(0, 0, -1));
  const rotationMatrix = transformRotationAround(center, quaternion);
  let matrix = rotationMatrix;
  const rotatedBox = transformedTargetBox(target, rotationMatrix);
  if (!rotatedBox) return;
  if (placeOnGround) {
    matrix = new THREE.Matrix4().makeTranslation(0, 0, -rotatedBox.min.z).multiply(rotationMatrix);
  } else {
    matrix = new THREE.Matrix4().makeTranslation(0, 0, target.box.min.z - rotatedBox.min.z).multiply(rotationMatrix);
  }
  applyMatrixToTransformTarget(
    matrix,
    'Trasformato corpo',
    placeOnGround ? t('faccia appoggiata al piano') : t('faccia ruotata in basso'),
    placeOnGround
      ? t('Faccia selezionata appoggiata al piano Z=0.')
      : t('Faccia selezionata ruotata verso il basso.'),
  );
  transformFaceReference = null;
  updateTransformQuickActions();
}

function centerTransformTargetOnOrigin() {
  const target = currentTransformTarget();
  if (!target) {
    setStatus('Apri un modello o seleziona un corpo prima di trasformare.');
    return;
  }
  const center = target.box.getCenter(new THREE.Vector3());
  const matrix = new THREE.Matrix4().makeTranslation(-center.x, -center.y, 0);
  applyMatrixToTransformTarget(
    matrix,
    'Trasformato corpo',
    t('centrato su origine'),
    t('Oggetto centrato su origine X/Y.'),
  );
}

function scaleTransformTargetToMax() {
  const target = currentTransformTarget();
  if (!target) {
    setStatus('Apri un modello o seleziona un corpo prima di trasformare.');
    return;
  }
  const axis = { x: 0, y: 1, z: 2 }[ui.scaleMaxAxis.value] ?? 2;
  const targetSize = parseDecimal(ui.scaleMaxValue.value, 0);
  const size = target.box.getSize(new THREE.Vector3());
  const currentSize = axisComponent(size, axis);
  if (!(targetSize > 0) || !(currentSize > 0)) {
    setStatus('Inserisci una dimensione massima valida.');
    return;
  }
  const scale = targetSize / currentSize;
  const center = target.box.getCenter(new THREE.Vector3());
  const matrix = new THREE.Matrix4()
    .multiply(new THREE.Matrix4().makeTranslation(center.x, center.y, center.z))
    .multiply(new THREE.Matrix4().makeScale(scale, scale, scale))
    .multiply(new THREE.Matrix4().makeTranslation(-center.x, -center.y, -center.z));
  applyMatrixToTransformTarget(
    matrix,
    'Trasformato corpo',
    `${t('scala')} ${formatDecimal(scale)}x, ${t('asse')} ${['X', 'Y', 'Z'][axis]} ${formatMillimeters(targetSize)}`,
    currentLanguage === 'en'
      ? `Scaled to ${formatMillimeters(targetSize)} on ${['X', 'Y', 'Z'][axis]}.`
      : `Scalato a ${formatMillimeters(targetSize)} su ${['X', 'Y', 'Z'][axis]}.`,
  );
}

function clearActiveDeleteTarget() {
  if (activeTool === 'measure' && (measurementStart || measurementEnd)) {
    clearMeasurement();
    setStatus('Misura cancellata.');
    return true;
  }
  if (activeTool === 'hole' && holeCreate) {
    clearHoleCreate();
    setStatus('Anteprima foro cancellata.');
    return true;
  }
  if (activeTool === 'movehole' && holeMove) {
    clearHoleMove();
    setStatus('Spostamento foro annullato.');
    return true;
  }
  if (activeTool === 'box' && boxPlacement) {
    clearBoxPlacement();
    setStatus('Parallelepipedo in anteprima cancellato.');
    return true;
  }
  if (activeTool === 'cylinder' && cylinderPlacement) {
    clearCylinderPlacement();
    setStatus('Cilindro in anteprima cancellato.');
    return true;
  }
  if (activeTool === 'cone' && conePlacement) {
    clearConePlacement();
    setStatus('Cono in anteprima cancellato.');
    return true;
  }
  if (activeTool === 'pyramid' && pyramidPlacement) {
    clearPyramidPlacement();
    setStatus('Piramide in anteprima cancellata.');
    return true;
  }
  if (activeTool === 'gear' && gearPlacement) {
    clearGearPlacement();
    setStatus('Ingranaggio in anteprima cancellato.');
    return true;
  }
  if (activeTool === 'plane' && planePlacement) {
    clearPlanePlacement();
    setStatus('Piano in anteprima cancellato.');
    return true;
  }
  if (activeTool === 'joint' && jointPlacement) {
    clearJointPlacement();
    setStatus('Incastro in anteprima cancellato.');
    return true;
  }
  if (activeTool === 'cut' && cutPlacement) {
    clearCutPlacement();
    setStatus('Figura di taglio cancellata.');
    return true;
  }
  if (activeTool === 'text' && textPlacement) {
    clearTextPlacement();
    setStatus('Testo in anteprima cancellato.');
    return true;
  }
  if (activeTool === 'line' && (sketchPoints.length || sketchEdges.length || sketchFaces.length)) {
    if (sketchPoints.length) {
      clearSketchCurrentLine();
      setStatus('Linea corrente cancellata. Le altre guide restano nella scena.');
    } else {
      clearSketch();
      setStatus('Guide cancellate.');
    }
    return true;
  }
  return false;
}

function handleDeleteKey(event) {
  if (event.key !== 'Delete') return false;
  event.preventDefault();
  if (clearActiveDeleteTarget()) return true;
  return deleteSelectedRegion();
}

function fitView(direction = new THREE.Vector3(1.15, -1.45, 1)) {
  if (!model) return;
  const box = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const radius = Math.max(size.length() * 0.5, 1);
  const verticalFov = THREE.MathUtils.degToRad(camera.fov);
  const horizontalFov = 2 * Math.atan(Math.tan(verticalFov / 2) * camera.aspect);
  const fittingFov = Math.min(verticalFov, horizontalFov);
  const distance = Math.max((radius / Math.sin(fittingFov / 2)) * 1.85, 70);
  camera.position.copy(center).add(direction.clone().normalize().multiplyScalar(distance));
  camera.near = Math.max(distance / 1000, 0.01);
  camera.far = Math.max(distance * 100, radius * 20);
  camera.updateProjectionMatrix();
  controls.target.copy(center);
  controls.update();
  requestRender();
}

function setView(view) {
  if (!model) return;
  if (view === 'top') fitView(new THREE.Vector3(0, 0, 1));
  if (view === 'front') fitView(new THREE.Vector3(0, -1, 0));
  if (view === 'iso') fitView();
}

function updateInspector() {
  const config = {
    select: {
      title: 'Seleziona',
      description: 'Clicca una superficie del modello per selezionarla.',
      hint: 'Clicca una superficie. Usa la rotellina premuta per orbitare.',
    },
    pushpull: {
      title: 'Spingi/Tira',
      description: 'Clicca una superficie piana, inserisci la distanza e applica.',
      hint: 'Spingi/Tira: clicca la faccia da allargare o restringere.',
    },
    hole: {
      title: 'Foro',
      description: 'Clicca una superficie per impostare il centro, poi regola diametro, profondita e offset.',
      hint: 'Foro: clicca il centro sulla superficie. Verde = anteprima del taglio.',
    },
    movehole: {
      title: 'Sposta foro',
      description: 'Clicca la parete interna del foro, poi scegli il nuovo centro sulla piastra.',
      hint: 'Sposta foro: prima clicca dentro il foro, poi clicca la nuova posizione.',
    },
    box: {
      title: 'Parallelepipedo',
      description: 'Clicca il punto di appoggio, regola le misure e scegli se sommare o sottrarre dal solido.',
      hint: 'Parallelepipedo: clicca sul piano o su una faccia. Anteprima arancione = nuovo solido.',
    },
    cylinder: {
      title: 'Cilindro',
      description: 'Clicca il centro di appoggio, scegli asse, diametro, altezza e operazione booleana.',
      hint: 'Cilindro: clicca dove appoggiare il centro. Puoi sommare o sottrarre.',
    },
    cone: {
      title: 'Cono',
      description: 'Clicca il centro della base, scegli asse, diametro, altezza e operazione booleana.',
      hint: 'Cono: clicca il centro base, poi regola diametro, altezza e asse.',
    },
    pyramid: {
      title: 'Piramide',
      description: 'Clicca il centro della base, regola base, altezza, asse e operazione booleana.',
      hint: 'Piramide: clicca il centro base, poi regola base X, base Y e altezza.',
    },
    gear: {
      title: 'Ingranaggio',
      description: 'Crea un ingranaggio cilindrico a denti dritti con foro centrale e mozzo opzionale.',
      hint: 'Ingranaggio: clicca il centro base, poi regola denti, modulo, spessore e foro.',
    },
    plane: {
      title: 'Piani',
      description: 'Crea rettangoli, quadrati o tondi piatti da usare come facce di partenza.',
      hint: 'Piani: clicca centro e forma. Poi usa Spingi/Tira per dare volume.',
    },
    joint: {
      title: 'Incastro',
      description: 'Crea profili meccanici piatti o estrusi per linguette, cave e incastri tra pezzi.',
      hint: 'Incastro: clicca il centro, scegli preset e operazione.',
    },
    cut: {
      title: 'Sottrai solido',
      description: 'Crea un box o un cilindro di taglio e sottrailo dal file STL caricato.',
      hint: 'Sottrai: clicca sull\'STL o sul piano, regola la figura arancione e applica.',
    },
    shorten: {
      title: 'Accorcia',
      description: 'Seleziona un oggetto, poi taglialo lungo X, Y o Z scegliendo lunghezza rimossa e centro del taglio.',
      hint: 'Accorcia: seleziona un oggetto con doppio click, poi scegli asse, lunghezza e centro taglio.',
    },
    split: {
      title: 'Taglia e separa',
      description: 'Taglia il modello con un piano, chiude le superfici tagliate ed esporta le due meta se serve.',
      hint: 'Separa: scegli asse e posizione del piano. Blu = taglio, arancione = separazione.',
    },
    hollow: {
      title: 'Svuota',
      description: 'Svuota il modello intero impostando lo spessore parete. Mantiene la superficie esterna e crea una superficie interna invertita.',
      hint: 'Svuota: inserisci lo spessore parete e applica al modello intero.',
    },
    text: {
      title: 'Testo 3D',
      description: 'Clicca il punto di partenza, scrivi il testo e regola font, profondita, larghezza ed effetti.',
      hint: 'Testo: clicca il punto basso sinistro, poi modifica il pannello a destra.',
    },
    line: {
      title: 'Linea',
      description: 'Traccia guide 3D indipendenti. Quando chiudono un contorno, nasce anche una faccia applicabile al modello.',
      hint: 'Linea: gli altri strumenti si agganciano a estremi, midpoint e segmenti delle guide.',
    },
    measure: {
      title: 'Misura',
      description: 'Clicca due punti sul modello. La distanza viene scomposta sugli assi X, Y e Z.',
      hint: 'Misura: clicca il primo punto, poi il secondo. Rosso X, verde Y, blu Z.',
    },
    transform: {
      title: 'Trasforma',
      description: 'Sposta, ruota o scala l\'oggetto selezionato applicando la trasformazione ai vertici STL.',
      hint: 'Trasforma: clicca una faccia come riferimento oppure doppio click sul corpo.',
    },
    orbit: {
      title: 'Orbita',
      description: 'Trascina con il tasto sinistro per ruotare la vista.',
      hint: 'Orbita: trascina per guardare il modello da ogni lato.',
    },
    pan: {
      title: 'Panoramica',
      description: 'Trascina con il tasto sinistro per spostare la vista.',
      hint: 'Panoramica: trascina per spostare il foglio di lavoro.',
    },
  };
  const current = config[activeTool] ?? config.select;
  ui.panelTitle.textContent = t(current.title);
  ui.panelDescription.textContent = activeTool === 'select'
    ? t('Click singolo seleziona una faccia. Doppio click seleziona il corpo cliccato.')
    : t(current.description);
  ui.hint.textContent = activeTool === 'select'
    ? t('Select: click singolo per una faccia, doppio click per il corpo.')
    : t(current.hint);
  ui.selectForm.hidden = activeTool !== 'select';
  ui.selectionMode.value = selectionMode;
  ui.pushPullForm.hidden = activeTool !== 'pushpull';
  if (ui.pushPullVisualHelp) {
    ui.pushPullVisualHelp.hidden = activeTool !== 'pushpull' || !pushPullVisualEnabled();
  }
  ui.holeForm.hidden = activeTool !== 'hole';
  ui.moveHoleForm.hidden = activeTool !== 'movehole';
  ui.boxForm.hidden = activeTool !== 'box';
  ui.cylinderForm.hidden = activeTool !== 'cylinder';
  ui.coneForm.hidden = activeTool !== 'cone';
  ui.pyramidForm.hidden = activeTool !== 'pyramid';
  ui.gearForm.hidden = activeTool !== 'gear';
  ui.planeForm.hidden = activeTool !== 'plane';
  ui.jointForm.hidden = activeTool !== 'joint';
  ui.cutForm.hidden = activeTool !== 'cut';
  ui.shortenForm.hidden = activeTool !== 'shorten';
  ui.splitForm.hidden = activeTool !== 'split';
  ui.hollowForm.hidden = activeTool !== 'hollow';
  ui.textForm.hidden = activeTool !== 'text';
  ui.sketchForm.hidden = activeTool !== 'line';
  ui.measurePanel.hidden = activeTool !== 'measure';
  ui.transformForm.hidden = activeTool !== 'transform';
  document.querySelector('#selection-info').hidden = ['hole', 'measure', 'movehole', 'box', 'cylinder', 'cone', 'pyramid', 'gear', 'plane', 'joint', 'cut', 'shorten', 'split', 'hollow', 'text', 'line', 'transform'].includes(activeTool);
  ui.inspector.classList.toggle(
    'open',
    ['select', 'pushpull', 'hole', 'movehole', 'box', 'cylinder', 'cone', 'pyramid', 'gear', 'plane', 'joint', 'cut', 'shorten', 'split', 'hollow', 'text', 'line', 'measure', 'transform'].includes(activeTool),
  );
  updateMeasureBoxMode();
}

function setTool(tool) {
  if (tool === 'zoomfit') {
    fitView();
    return;
  }
  if (activeTool === 'pushpull' && tool !== 'pushpull') clearPushPullHandle();
  if (activeTool === 'hole' && tool !== 'hole') clearHoleCreate();
  if (activeTool === 'movehole' && tool !== 'movehole') clearHoleMove();
  if (activeTool === 'box' && tool !== 'box') clearBoxPlacement();
  if (activeTool === 'cylinder' && tool !== 'cylinder') clearCylinderPlacement();
  if (activeTool === 'cone' && tool !== 'cone') clearConePlacement();
  if (activeTool === 'pyramid' && tool !== 'pyramid') clearPyramidPlacement();
  if (activeTool === 'gear' && tool !== 'gear') clearGearPlacement();
  if (activeTool === 'plane' && tool !== 'plane') clearPlanePlacement();
  if (activeTool === 'joint' && tool !== 'joint') clearJointPlacement();
  if (activeTool === 'cut' && tool !== 'cut') clearCutPlacement();
  if (activeTool === 'shorten' && tool !== 'shorten') clearShortenPlacement();
  if (activeTool === 'split' && tool !== 'split') clearSplitPlacement();
  if (activeTool === 'hollow' && tool !== 'hollow') clearHollowState();
  if (activeTool === 'text' && tool !== 'text') clearTextPlacement();
  if (activeTool === 'line' && tool !== 'line') clearSketchCurrentLine();
  if (activeTool === 'transform' && tool !== 'transform') {
    clearTransformPreview();
    transformFaceReference = null;
  }
  clearSnapIndicator();
  activeTool = tool;
  if (tool === 'measure') clearSelection();
  if (tool === 'transform') {
    if (selected?.type === 'face' && selected.region?.triangles?.length) {
      transformFaceReference = {
        normal: selected.normal.clone(),
        point: selected.point.clone(),
        seedTriangle: selected.region.triangles[0],
      };
      setSelectionMode('object', { clear: false, refresh: false });
      selectObjectComponent(selected.region.triangles[0], selected.point);
    } else {
      transformFaceReference = null;
      setSelectionMode('object', { clear: false, refresh: false });
    }
  }
  if (tool === 'hole') {
    clearSelection();
    clearHoleCreate();
  }
  if (tool === 'movehole') {
    clearSelection();
    clearHoleMove();
  }
  if (tool === 'box') {
    clearSelection();
    clearBoxPlacement();
  }
  if (tool === 'cylinder') {
    clearSelection();
    clearCylinderPlacement();
  }
  if (tool === 'cone') {
    clearSelection();
    clearConePlacement();
  }
  if (tool === 'pyramid') {
    clearSelection();
    clearPyramidPlacement();
  }
  if (tool === 'gear') {
    clearSelection();
    clearGearPlacement();
  }
  if (tool === 'plane') {
    clearSelection();
    clearPlanePlacement();
  }
  if (tool === 'joint') {
    clearSelection();
    clearJointPlacement();
  }
  if (tool === 'cut') {
    clearSelection();
    clearCutPlacement();
    updateCutFields();
  }
  if (tool === 'shorten') {
    if (selected?.type === 'face' && selected.region?.triangles?.length) {
      setSelectionMode('object', { clear: false, refresh: false });
      selectObjectComponent(selected.region.triangles[0], selected.point);
    } else {
      setSelectionMode('object', { clear: false, refresh: false });
    }
    resetShortenDefaults();
    drawShortenPreview();
  }
  if (tool === 'split') {
    clearSelection();
    resetSplitDefaults();
    drawSplitPreview();
  }
  if (tool === 'hollow') {
    clearSelection();
    clearHollowState();
    updateHollowState();
  }
  if (tool === 'text') {
    clearSelection();
    clearTextPlacement();
  }
  if (tool === 'line') {
    clearSelection();
    drawSketchPreview();
  }
  document.querySelectorAll('.tool').forEach((button) => {
    button.classList.toggle('active', button.dataset.tool === tool);
  });
  controls.mouseButtons.LEFT =
    tool === 'orbit'
      ? THREE.MOUSE.ROTATE
      : tool === 'pan'
        ? THREE.MOUSE.PAN
        : null;
  canvas.style.cursor =
    tool === 'orbit'
      ? 'grab'
        : tool === 'pan'
          ? 'move'
          : ['hole', 'measure', 'movehole', 'box', 'cylinder', 'cone', 'pyramid', 'gear', 'plane', 'joint', 'cut', 'shorten', 'split', 'hollow', 'text', 'line'].includes(tool)
            ? 'crosshair'
            : 'default';
  updateInspector();
  const statusByTool = {
    select: 'Select: click singolo per una faccia, doppio click per il corpo.',
    pushpull: 'Spingi/Tira: clicca una superficie piana.',
    hole: 'Foro: clicca il centro sulla superficie.',
    movehole: 'Sposta foro: clicca la parete interna del foro.',
    box: 'Parallelepipedo: clicca il punto di appoggio, poi regola misure e somma/sottrai.',
    cylinder: 'Cilindro: clicca il centro di appoggio, poi regola diametro, altezza e asse.',
    cone: 'Cono: clicca il centro base, poi regola diametro, altezza e asse.',
    pyramid: 'Piramide: clicca il centro base, poi regola base, altezza e asse.',
    gear: 'Ingranaggio: clicca il centro base, poi regola denti, modulo, spessore e foro.',
    plane: 'Piani: clicca il centro, scegli forma e dimensioni, poi applica la faccia piatta.',
    joint: 'Incastro: clicca il centro, scegli preset e operazione.',
    cut: 'Sottrai: scegli box o cilindro, clicca il punto e applica il taglio.',
    shorten: 'Accorcia: seleziona un oggetto con doppio click, poi regola asse, lunghezza e centro taglio.',
    split: 'Separa: scegli asse e posizione, poi applica o esporta i due lati.',
    hollow: 'Svuota: imposta lo spessore parete e applica al modello intero.',
    text: 'Testo: clicca il punto basso sinistro, poi scrivi e regola profondita e font.',
    line: 'Linea: crea guide indipendenti. Gli altri strumenti si agganciano a estremi, midpoint e segmenti.',
    measure: 'Misura: clicca il primo punto.',
    transform: 'Trasforma: clicca una faccia come riferimento, oppure doppio click sul corpo.',
    orbit: 'Orbita: trascina per ruotare la vista.',
    pan: 'Panoramica: trascina per spostare la vista.',
  };
  if (statusByTool[tool]) setStatus(t(statusByTool[tool]));
  if (tool === 'pushpull') refreshPushPullHandle();
  updateTransformQuickActions();
}

function raycastModel(clientX, clientY) {
  if (!model) return;
  setRayFromPointer(clientX, clientY);
  return raycaster.intersectObject(model, false)[0];
}

function setRayFromPointer(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
}

function snapTargetPoint(candidate) {
  return candidate?.isVector3 ? candidate : candidate?.point;
}

function findScreenSnapPoint(clientX, clientY, targets, maxPixelDistance = 14) {
  const rect = canvas.getBoundingClientRect();
  let best = null;
  let bestDistanceSq = maxPixelDistance * maxPixelDistance;
  const projected = new THREE.Vector3();
  const startScreen = new THREE.Vector2();
  const endScreen = new THREE.Vector2();

  const projectToScreen = (point, target) => {
    projected.copy(point).project(camera);
    if (projected.z < -1 || projected.z > 1) return false;
    target.set(
      rect.left + ((projected.x + 1) / 2) * rect.width,
      rect.top + ((1 - projected.y) / 2) * rect.height,
    );
    return true;
  };

  for (const candidate of targets) {
    const point = snapTargetPoint(candidate);
    let snapPointCandidate = point;
    let x = 0;
    let y = 0;

    if (candidate?.start?.isVector3 && candidate?.end?.isVector3) {
      if (!projectToScreen(candidate.start, startScreen) || !projectToScreen(candidate.end, endScreen)) continue;
      const segment = endScreen.clone().sub(startScreen);
      const lengthSq = segment.lengthSq();
      if (lengthSq < 1e-8) continue;
      const cursor = new THREE.Vector2(clientX, clientY);
      const t = THREE.MathUtils.clamp(cursor.clone().sub(startScreen).dot(segment) / lengthSq, 0, 1);
      const screenPoint = startScreen.clone().addScaledVector(segment, t);
      x = screenPoint.x;
      y = screenPoint.y;
      snapPointCandidate = candidate.start.clone().lerp(candidate.end, t);
    } else {
      if (!point || !projectToScreen(point, startScreen)) continue;
      x = startScreen.x;
      y = startScreen.y;
    }

    const dx = x - clientX;
    const dy = y - clientY;
    const distanceSq = dx * dx + dy * dy;
    if (distanceSq >= bestDistanceSq) continue;

    bestDistanceSq = distanceSq;
    best = {
      distance: Math.sqrt(distanceSq),
      kind: candidate.kind ?? 'vertice',
      point: snapPointCandidate.clone(),
    };
  }

  return best;
}

function pickWorkPoint(clientX, clientY, options = {}) {
  const {
    allowScreenSnap = null,
    axisStart = null,
    inferenceDirections = [],
    extraSnapPoints = [],
    includeConstructionSnaps = true,
    modelOnly = false,
    preferWorkPlane = false,
    projectSnapsToWorkPlane = true,
    screenSnapDistance = 14,
    screenSnapPoints = null,
    snapGrid = true,
    workPlane = null,
  } = options;
  setRayFromPointer(clientX, clientY);
  const constructionSnaps = includeConstructionSnaps ? constructionSnapTargets() : [];
  const availableSnapPoints = [...extraSnapPoints, ...constructionSnaps, ...snapPoints];
  const useScreenSnap = allowScreenSnap ?? !modelOnly;
  const screenSnap = useScreenSnap
    ? findScreenSnapPoint(clientX, clientY, screenSnapPoints ?? availableSnapPoints, screenSnapDistance)
    : null;
  if (screenSnap && !modelOnly) {
    const finalPoint = workPlane && preferWorkPlane && projectSnapsToWorkPlane
      ? workPlane.projectPoint(screenSnap.point, new THREE.Vector3())
      : screenSnap.point;
    return {
      axis: null,
      hit: null,
      normal: new THREE.Vector3(0, 0, 1),
      point: finalPoint,
      snapKind: screenSnap.kind,
      source: 'snap',
    };
  }

  const planePoint = workPlane && !modelOnly
    ? raycaster.ray.intersectPlane(workPlane, new THREE.Vector3())
    : null;
  const hit = preferWorkPlane && planePoint ? null : raycastModel(clientX, clientY);
  let point = null;
  let normal = new THREE.Vector3(0, 0, 1);
  let source = 'piano';

  if (preferWorkPlane && planePoint) {
    point = planePoint;
    normal = workPlane.normal.clone();
    source = 'piano';
  } else if (hit) {
    point = hit.point.clone();
    normal = hit.face.normal.clone().normalize();
    source = 'modello';
  } else if (!modelOnly) {
    point = planePoint ?? raycaster.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 0, 1), 0), new THREE.Vector3());
    if (workPlane) normal = workPlane.normal.clone();
  }
  if (!point) return null;

  let axis = null;
  if (axisStart) {
    const locked = snapPointToAxis(axisStart, point);
    point = locked.point;
    axis = locked.axis;
    if (axis === null && inferenceDirections.length) {
      const inferred = snapPointToDirections(axisStart, point, inferenceDirections);
      if (inferred.directionIndex !== null) {
        point = inferred.point;
        axis = 'parallel';
      }
    }
  }

  const snapped = snapPoint(point, {
    gridSize: 1,
    snapPoints: availableSnapPoints,
    snapDistance: 2.5,
  });
  const snappedPoint = !snapGrid && snapped.kind === 'griglia' ? point : snapped.point;
  const shouldProjectToWorkPlane = workPlane
    && preferWorkPlane
    && (projectSnapsToWorkPlane || snapped.kind === 'griglia');
  const finalPoint = shouldProjectToWorkPlane
    ? workPlane.projectPoint(snappedPoint, new THREE.Vector3())
    : snappedPoint;
  const snapKind = !snapGrid && snapped.kind === 'griglia' ? 'superficie' : snapped.kind;

  return {
    hit,
    point: finalPoint,
    normal,
    source,
    snapKind,
    axis,
  };
}

function snapColor(kind) {
  if (kind === 'centro faccia') return 0x28a45f;
  if (kind === 'punto medio') return 0xe46f2b;
  if (kind === 'linea guida') return 0x8e44ad;
  if (kind === 'griglia') return 0xf7cf52;
  return 0x1679b8;
}

function drawSnapIndicator(pick) {
  clearSnapIndicator();
  if (!pick || pick.snapKind === 'griglia' || pick.snapKind === 'superficie') return;
  const radius = Math.max(model?.geometry.boundingSphere?.radius ?? 50, 30) * 0.006;
  snapIndicator = createPointMarker(pick.point, snapColor(pick.snapKind), radius, { pixelSize: 14 });
  addTransientOverlay(snapIndicator, 'snap-indicator');
}

function updateSnapIndicator(clientX, clientY) {
  if (!['hole', 'measure', 'movehole', 'box', 'cylinder', 'cone', 'pyramid', 'gear', 'plane', 'joint', 'cut', 'shorten', 'split', 'hollow', 'text', 'line'].includes(activeTool)) {
    clearSnapIndicator();
    return;
  }
  if (activeTool === 'line') {
    const extraSnapPoints = sketchSnapTargets();
    const pick = pickWorkPoint(clientX, clientY, {
      allowScreenSnap: true,
      axisStart: sketchPoints.length ? sketchPoints[sketchPoints.length - 1] : null,
      extraSnapPoints,
      inferenceDirections: sketchInferenceDirections(),
      preferWorkPlane: sketchPoints.length > 0,
      projectSnapsToWorkPlane: !isAutoSketchPlane(),
      screenSnapPoints: [...extraSnapPoints, ...snapPoints],
      workPlane: sketchWorkPlane(),
    });
    drawSnapIndicator(pick);
    return;
  }
  const axisStart = activeTool === 'line' && sketchPoints.length
    ? sketchPoints[sketchPoints.length - 1]
    : null;
  const pick = pickWorkPoint(clientX, clientY, {
    allowScreenSnap: activeTool === 'measure',
    axisStart,
    inferenceDirections: activeTool === 'line' ? sketchInferenceDirections() : [],
    modelOnly: activeTool === 'measure' || activeTool === 'movehole',
    snapGrid: activeTool !== 'measure' && activeTool !== 'movehole',
  });
  drawSnapIndicator(pick);
}

function triangleAreaFromGeometry(geometry, triangleIndex) {
  const a = vertexFromGeometry(geometry, triangleIndex, 0);
  const b = vertexFromGeometry(geometry, triangleIndex, 1);
  const c = vertexFromGeometry(geometry, triangleIndex, 2);
  return b.sub(a).cross(c.sub(a)).length() * 0.5;
}

function vertexFromGeometry(geometry, triangleIndex, corner) {
  const point = new THREE.Vector3();
  const position = geometry.getAttribute('position');
  point.fromBufferAttribute(position, triangleIndex * 3 + corner);
  return point;
}

function selectionBoxFromTriangles(geometry, triangles) {
  const box = new THREE.Box3();
  for (const triangle of triangles) {
    for (let corner = 0; corner < 3; corner += 1) {
      box.expandByPoint(vertexFromGeometry(geometry, triangle, corner));
    }
  }
  return box.isEmpty() ? null : box;
}

function createSelectionBoxOverlay(box) {
  const group = new THREE.Group();
  const size = box.getSize(new THREE.Vector3());
  const lineGeometry = new THREE.BufferGeometry();
  const min = box.min;
  const max = box.max;
  const corners = [
    new THREE.Vector3(min.x, min.y, min.z),
    new THREE.Vector3(max.x, min.y, min.z),
    new THREE.Vector3(max.x, max.y, min.z),
    new THREE.Vector3(min.x, max.y, min.z),
    new THREE.Vector3(min.x, min.y, max.z),
    new THREE.Vector3(max.x, min.y, max.z),
    new THREE.Vector3(max.x, max.y, max.z),
    new THREE.Vector3(min.x, max.y, max.z),
  ];
  const edgeIndexes = [
    [0, 1], [1, 2], [2, 3], [3, 0],
    [4, 5], [5, 6], [6, 7], [7, 4],
    [0, 4], [1, 5], [2, 6], [3, 7],
  ];
  const positions = [];
  for (const [start, end] of edgeIndexes) {
    positions.push(
      corners[start].x, corners[start].y, corners[start].z,
      corners[end].x, corners[end].y, corners[end].z,
    );
  }
  lineGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  const lines = new THREE.LineSegments(lineGeometry, selectionLineMaterial);
  lines.renderOrder = 20;
  group.add(lines);

  const cornerRadius = Math.max(size.length() * 0.006, 0.45);
  const edgeRadius = Math.max(size.length() * 0.0025, 0.18);
  for (const [start, end] of edgeIndexes) {
    const from = corners[start];
    const to = corners[end];
    const direction = new THREE.Vector3().subVectors(to, from);
    const length = direction.length();
    if (length <= 1e-6) continue;
    const edge = new THREE.Mesh(
      new THREE.CylinderGeometry(edgeRadius, edgeRadius, length, 8),
      selectionCornerMaterial,
    );
    edge.position.copy(from).add(to).multiplyScalar(0.5);
    edge.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
    edge.renderOrder = 21;
    group.add(edge);
  }

  for (const corner of corners) {
    const marker = new THREE.Mesh(
      new THREE.SphereGeometry(cornerRadius, 12, 8),
      selectionCornerMaterial,
    );
    marker.position.copy(corner);
    marker.renderOrder = 22;
    group.add(marker);
  }

  return group;
}

function createFaceSelectionOverlay(geometry, triangles) {
  const group = new THREE.Group();
  const surface = new THREE.Mesh(createRegionGeometry(geometry, triangles, 0.055), highlightMaterial);
  surface.renderOrder = 20;
  group.add(surface);

  const wireSource = createRegionGeometry(geometry, triangles, 0.07);
  const wireGeometry = new THREE.WireframeGeometry(wireSource);
  wireSource.dispose();
  const wire = new THREE.LineSegments(wireGeometry, selectionLineMaterial);
  wire.renderOrder = 21;
  group.add(wire);
  return group;
}

function createTransformReferenceOverlay(geometry, faceTriangles, bodyBox) {
  const group = createFaceSelectionOverlay(geometry, faceTriangles);
  const bodyOverlay = createSelectionBoxOverlay(bodyBox);
  bodyOverlay.traverse((child) => {
    child.renderOrder = Math.max(child.renderOrder ?? 0, 18);
  });
  group.add(bodyOverlay);
  return group;
}

function regionArea(geometry, region) {
  return region.triangles.reduce((sum, triangle) => sum + triangleAreaFromGeometry(geometry, triangle), 0);
}

function pickSelectableRegion(clientX, clientY) {
  if (!model) return null;
  setRayFromPointer(clientX, clientY);
  const hits = raycaster.intersectObject(model, false);
  if (!hits.length) return null;
  const firstDistance = hits[0].distance;
  let best = null;

  for (const hit of hits) {
    if (Math.abs(hit.distance - firstDistance) > 0.02) break;
    const region = findCoplanarRegion(model.geometry, hit.faceIndex);
    const area = regionArea(model.geometry, region);
    if (!best || area < best.area) {
      best = {
        area,
        hit,
        region,
      };
    }
  }

  return best;
}

function setSelectedObjectFromTriangles(triangles, point, objectIndex = null) {
  if (!model) return false;
  const box = selectionBoxFromTriangles(model.geometry, triangles);
  if (!triangles.length || !box) {
    clearSelection();
    return false;
  }

  clearSelection();
  selected = {
    type: 'object',
    point: point?.clone?.() ?? box.getCenter(new THREE.Vector3()),
    triangles,
    objectIndex,
  };
  if (
    activeTool === 'transform'
    && transformFaceReference
    && !triangles.includes(transformFaceReference.seedTriangle)
  ) {
    transformFaceReference = null;
  }

  highlight = createSelectionBoxOverlay(box);
  highlight.renderOrder = 3;
  addTransientOverlay(highlight, 'selection');
  updateModelActions();
  renderObjectsDrawer();
  ui.selectionLabel.textContent = t('Oggetto selezionato');
  ui.selectionDetail.textContent = t('Corpo selezionato. Canc lo rimuove, Trasforma lo modifica.');
  ui.measureValue.value = `${triangles.length} ${t('facce')}`;
  ui.inspector.classList.add('open');
  setStatus(t('Oggetto selezionato'));
  if (activeTool === 'shorten') {
    resetShortenDefaults();
    drawShortenPreview();
  }
  if (activeTool === 'split') {
    resetSplitDefaults();
    drawSplitPreview();
  }
  updateTransformQuickActions();
  if (activeTool === 'transform') drawTransformPreview();
  return true;
}

function selectObjectComponent(seedTriangle, point) {
  if (!model) return false;
  const component = findConnectedComponent(model.geometry, seedTriangle);
  const objectIndex = objectIndexForTriangles(component.triangles);
  return setSelectedObjectFromTriangles(component.triangles, point, objectIndex >= 0 ? objectIndex : null);
}

function selectObjectByIndex(index) {
  const item = objectItems[index];
  if (!item) return false;
  setSelectionMode('object', { clear: false, refresh: false });
  return setSelectedObjectFromTriangles(item.triangles, null, index);
}

function selectObjectAt(clientX, clientY) {
  const hit = raycastModel(clientX, clientY);
  if (!hit) {
    clearSelection();
    return;
  }

  selectObjectComponent(hit.faceIndex, hit.point);
}

function selectFaceRegion(region, point, options = {}) {
  const {
    status = activeTool === 'hole' ? 'Punto del foro selezionato.' : 'Superficie selezionata.',
    detail = activeTool === 'hole'
      ? 'Il punto blu indica il centro del foro.'
      : 'La zona blu verra spostata lungo la sua normale.',
  } = options;
  clearSelection();
  const selectionPoint = point?.clone?.() ?? new THREE.Vector3();
  const selectionNormal = region.normal.clone();
  if (regionHasOpenBoundary(model.geometry, region)) {
    const viewDirection = camera.position.clone().sub(selectionPoint);
    if (viewDirection.lengthSq() > 1e-8 && selectionNormal.dot(viewDirection) < 0) {
      selectionNormal.negate();
    }
  }
  selected = {
    type: 'face',
    point: selectionPoint,
    normal: selectionNormal.clone(),
    region: {
      ...region,
      normal: selectionNormal,
    },
  };

  highlight = createFaceSelectionOverlay(model.geometry, region.triangles);
  addTransientOverlay(highlight, 'selection');
  ui.selectionLabel.textContent = currentLanguage === 'en'
    ? `Surface selected (${region.triangles.length} triangles)`
    : `Superficie selezionata (${region.triangles.length} triangoli)`;
  ui.selectionDetail.textContent = t(detail);
  ui.measureValue.value = `${region.triangles.length} ${t('facce')}`;
  ui.inspector.classList.add('open');
  updateModelActions();
  setStatus(t(status));
  refreshPushPullHandle();
  updateTransformQuickActions();
}

function selectAt(clientX, clientY, mode = selectionMode) {
  if (mode === 'object') {
    selectObjectAt(clientX, clientY);
    return;
  }

  const picked = pickSelectableRegion(clientX, clientY);
  if (!picked) {
    clearSelection();
    return;
  }

  const { hit, region } = picked;
  selectFaceRegion(region, hit.point);
}

function createMeasureLine(start, end, color, dashed = false) {
  const geometry = new THREE.BufferGeometry().setFromPoints([start, end]);
  const material = dashed
    ? new THREE.LineDashedMaterial({
        color,
        dashSize: 2.4,
        gapSize: 1.4,
        depthTest: false,
      })
    : new THREE.LineBasicMaterial({ color, depthTest: false });
  const line = new THREE.Line(geometry, material);
  if (dashed) line.computeLineDistances();
  line.renderOrder = 10;
  return line;
}

function createPointMarkerTexture() {
  if (pointMarkerTexture) return pointMarkerTexture;
  const markerCanvas = document.createElement('canvas');
  markerCanvas.width = 64;
  markerCanvas.height = 64;
  const context = markerCanvas.getContext('2d');
  context.clearRect(0, 0, 64, 64);
  context.beginPath();
  context.arc(32, 32, 23, 0, Math.PI * 2);
  context.fillStyle = '#ffffff';
  context.fill();
  context.lineWidth = 8;
  context.strokeStyle = '#172637';
  context.stroke();
  pointMarkerTexture = new THREE.CanvasTexture(markerCanvas);
  pointMarkerTexture.colorSpace = THREE.SRGBColorSpace;
  return pointMarkerTexture;
}

function screenMarkerScale(pixelSize) {
  const viewportHeight = Math.max(renderer.domElement.clientHeight || viewport.clientHeight || 1, 1);
  return (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) * 0.5) * pixelSize) / viewportHeight;
}

function createPointMarker(point, color, radius = 0.5, options = {}) {
  const pixelSize = options.pixelSize ?? THREE.MathUtils.clamp(radius * 24, 10, 13);
  const marker = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: createPointMarkerTexture(),
      color,
      depthTest: false,
      depthWrite: false,
      sizeAttenuation: false,
      transparent: true,
    }),
  );
  const scale = screenMarkerScale(pixelSize);
  marker.scale.set(scale, scale, 1);
  marker.position.copy(point);
  marker.renderOrder = 11;
  return marker;
}

function drawMeasurement(end, preview = false) {
  if (!measurementStart) return;
  if (measurementGroup) {
    scene.remove(measurementGroup);
    disposeObject(measurementGroup);
  }

  const start = measurementStart;
  const xPoint = new THREE.Vector3(end.x, start.y, start.z);
  const xyPoint = new THREE.Vector3(end.x, end.y, start.z);
  const modelSize = model.geometry.boundingSphere?.radius ?? 50;
  const markerRadius = Math.max(modelSize * 0.012, 0.35);
  measurementGroup = new THREE.Group();
  measurementGroup.add(createMeasureLine(start, end, measureColors.total, true));
  measurementGroup.add(createMeasureLine(start, xPoint, measureColors.x));
  measurementGroup.add(createMeasureLine(xPoint, xyPoint, measureColors.y));
  measurementGroup.add(createMeasureLine(xyPoint, end, measureColors.z));
  measurementGroup.add(createPointMarker(start, 0xffffff, markerRadius));
  measurementGroup.add(createPointMarker(end, preview ? 0xffcf47 : measureColors.total, markerRadius));
  addTransientOverlay(measurementGroup, 'measurement');

  const result = calculateMeasurement(start, end)
