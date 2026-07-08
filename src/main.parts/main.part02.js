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
  ui.boxInfo.textContent = 'Clicca dove vuoi appoggiare il parallelepipedo.';
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
  ui.cylinderInfo.textContent = 'Clicca dove vuoi appoggiare il cilindro.';
  ui.cylinderOffsetInputs.forEach((input) => {
    input.value = '0';
  });
  ui.applyCylinder.disabled = true;
}

function clearCutPlacement() {
  cutPlacement = null;
  if (cutPreview) {
    scene.remove(cutPreview);
    disposeObject(cutPreview);
    cutPreview = null;
    requestRender();
  }
  ui.cutInfo.textContent = 'Scegli forma e clicca dove vuoi togliere materiale.';
  ui.cutOffsetInputs.forEach((input) => {
    input.value = '0';
  });
  ui.applyCut.disabled = true;
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
  ui.textInfo.textContent = 'Clicca dove vuoi appoggiare il testo.';
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
  ui.sketchInfo.textContent = 'Clicca punti, vertici o punti medi. Le linee restano finche premi Ricomincia.';
  updateMeasureBoxMode();
  ui.applySketch.textContent = 'Applica facce';
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
  ui.sketchInfo.textContent = `${sketchEdges.length} linee e ${sketchFaces.length} facce in bozza. Clicca un punto per iniziare un'altra linea.`;
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
  ui.repairModelButton.disabled = !hasModel;
  ui.removeModelButton.disabled = !hasModel;
  ui.emptyState.hidden = hasModel;
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
  clearCutPlacement();
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
  updateEdges();
  updateModelActions();
  if (preserveSketch && (sketchEdges.length || sketchFaces.length || sketchPoints.length)) {
    updateSketchApplyState();
    drawSketchPreview();
  }
  requestRender();
}

function snapshot() {
  undoStack.push(model.geometry.clone());
  if (undoStack.length > 30) undoStack.shift().dispose();
  for (const geometry of redoStack) geometry.dispose();
  redoStack.length = 0;
  updateHistoryButtons();
}

function restoreFrom(source, destination) {
  if (!source.length) return;
  if (model) destination.push(model.geometry.clone());
  const geometry = source.pop();
  setModelGeometry(geometry, false, { preserveSketch: true });
  updateHistoryButtons();
  setStatus('Modifica ripristinata.');
}

function updateHistoryButtons() {
  ui.undo.disabled = undoStack.length === 0;
  ui.redo.disabled = redoStack.length === 0;
}

function clearCurrentModel(message = 'Modello rimosso. Apri un STL o crea una nuova figura.') {
  clearTransientOverlays();
  clearSelection();
  clearMeasurement();
  clearHoleCreate();
  clearHoleMove();
  clearBoxPlacement();
  clearCylinderPlacement();
  clearCutPlacement();
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
  ui.fileName.textContent = 'Nessun modello';
  updateModelActions();
  updateHistoryButtons();
  setTool('select');
  setStatus(message);
}

function removeCurrentModel() {
  if (!model) {
    setStatus('Non c e nessun modello da rimuovere.');
    return;
  }
  for (const geometry of undoStack) geometry.dispose();
  for (const geometry of redoStack) geometry.dispose();
  undoStack.length = 0;
  redoStack.length = 0;
  clearCurrentModel('Figura rimossa. Apri un STL o crea una nuova geometria.');
}

function deleteSelectedRegion() {
  if (!selected || !model) {
    setStatus('Seleziona una superficie da cancellare, oppure usa Rimuovi modello per togliere tutto.');
    return false;
  }

  const triangleCount = selected.region.triangles.length;
  const geometry = deleteTrianglesFromGeometry(model.geometry, selected.region.triangles);
  snapshot();
  if (!geometry) {
    clearCurrentModel('Tutte le superfici sono state cancellate. Usa Annulla per ripristinare.');
  } else {
    setModelGeometry(geometry, false, { preserveSketch: true });
    updateHistoryButtons();
    setStatus(`Superficie cancellata: ${triangleCount} triangoli rimossi. Usa Ctrl+Z per annullare.`);
  }
  return true;
}

function formatRepairReport(report) {
  const cleanup = [
    `${report.weldedVertices} vertici saldati`,
    `${report.removedDegenerateTriangles} triangoli degeneri rimossi`,
    `${report.removedDuplicateTriangles} duplicati rimossi`,
    `${report.flippedTriangles} triangoli riorientati`,
  ].join(', ');
  const topology = [];
  if (report.boundaryEdges) topology.push(`${report.boundaryEdges} bordi aperti restano`);
  if (report.nonManifoldEdges) topology.push(`${report.nonManifoldEdges} spigoli non-manifold restano`);
  const warning = topology.length ? ` Attenzione: ${topology.join(', ')}.` : '';
  return `Mesh riparata: ${report.trianglesBefore} -> ${report.trianglesAfter} triangoli, ${cleanup}.${warning}`;
}

async function repairCurrentMesh() {
  if (!model) {
    setStatus('Apri o crea un modello prima di riparare la mesh.');
    return;
  }

  showBusy('Riparazione mesh...', 'Saldo vertici vicini, rimuovo triangoli difettosi e riallineo le normali.');
  await waitForNextFrame();
  await waitForNextFrame();

  try {
    const repaired = repairMeshGeometry(model.geometry);
    if (!repaired?.geometry) {
      setStatus('La riparazione non ha prodotto una mesh valida. Usa Annulla o riapri il file originale.');
      return;
    }
    snapshot();
    setModelGeometry(repaired.geometry, false, { preserveSketch: true });
    updateHistoryButtons();
    setStatus(formatRepairReport(repaired.report));
  } catch (error) {
    console.error(`Errore riparazione mesh: ${error?.stack ?? error}`);
    setStatus('Non riesco a riparare questa mesh.');
  } finally {
    hideBusy();
  }
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

function transformMatrixForGeometry(geometry, values) {
  geometry.computeBoundingBox();
  const center = geometry.boundingBox.getCenter(new THREE.Vector3());
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

  const geometry = model.geometry.clone();
  geometry.applyMatrix4(transformMatrixForGeometry(geometry, values));
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
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

  const transformed = transformedGeometryFromInputs();
  if (!transformed) {
    const scale = parseDecimal(ui.transformScale.value, 1);
    setStatus(scale > 0
      ? 'Inserisci almeno uno spostamento, una rotazione o una scala diversa da 1.'
      : 'La scala deve essere maggiore di zero.');
    return;
  }

  clearTransformPreview();
  snapshot();
  setModelGeometry(transformed.geometry, false, { preserveSketch: true });
  updateHistoryButtons();
  resetTransformInputs();
  requestRender();
  setStatus(
    `Trasformazione applicata: X ${formatMillimeters(transformed.values.translation.x, true)}, Y ${formatMillimeters(transformed.values.translation.y, true)}, Z ${formatMillimeters(transformed.values.translation.z, true)}, scala ${formatDecimal(transformed.values.scale)}x.`,
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
      setStatus('Linea corrente cancellata. Le altre linee restano in bozza.');
    } else {
      clearSketch();
      setStatus('Bozza linee cancellata.');
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
  const radius = Math.max(size.length() * 0.75, 20);
  camera.position.copy(center).add(direction.clone().normalize().multiplyScalar(radius));
  camera.near = Math.max(radius / 1000, 0.01);
  camera.far = radius * 100;
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
    cut: {
      title: 'Sottrai solido',
      description: 'Crea un box o un cilindro di taglio e sottrailo dal file STL caricato.',
      hint: 'Sottrai: clicca sull\'STL o sul piano, regola la figura arancione e applica.',
    },
    text: {
      title: 'Testo 3D',
      description: 'Clicca il punto di partenza, scrivi il testo e regola font, profondita, larghezza ed effetti.',
      hint: 'Testo: clicca il punto basso sinistro, poi modifica il pannello a destra.',
    },
    line: {
      title: 'Linea',
      description: 'Traccia una rete di spigoli 3D. Quando gli spigoli chiudono un contorno, nasce una faccia applicabile al modello.',
      hint: 'Linea: in Auto 3D aggancia vertici e punti medi reali. Usa Nuova linea per ripartire senza perdere gli spigoli gia tracciati.',
    },
    measure: {
      title: 'Misura',
      description: 'Clicca due punti sul modello. La distanza viene scomposta sugli assi X, Y e Z.',
      hint: 'Misura: clicca il primo punto, poi il secondo. Rosso X, verde Y, blu Z.',
    },
    transform: {
      title: 'Trasforma',
      description: 'Sposta, ruota o scala l\'intero modello applicando la trasformazione ai vertici STL.',
      hint: 'Trasforma: inserisci spostamento, rotazione o scala e applica.',
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
  ui.panelTitle.textContent = current.title;
  ui.panelDescription.textContent = current.description;
  ui.hint.textContent = current.hint;
  ui.pushPullForm.hidden = activeTool !== 'pushpull';
  ui.holeForm.hidden = activeTool !== 'hole';
  ui.moveHoleForm.hidden = activeTool !== 'movehole';
  ui.boxForm.hidden = activeTool !== 'box';
  ui.cylinderForm.hidden = activeTool !== 'cylinder';
  ui.cutForm.hidden = activeTool !== 'cut';
  ui.textForm.hidden = activeTool !== 'text';
  ui.sketchForm.hidden = activeTool !== 'line';
  ui.measurePanel.hidden = activeTool !== 'measure';
  ui.transformForm.hidden = activeTool !== 'transform';
  document.querySelector('#selection-info').hidden = ['hole', 'measure', 'movehole', 'box', 'cylinder', 'cut', 'text', 'line', 'transform'].includes(activeTool);
  ui.inspector.classList.toggle(
    'open',
    ['pushpull', 'hole', 'movehole', 'box', 'cylinder', 'cut', 'text', 'line', 'measure', 'transform'].includes(activeTool),
  );
  updateMeasureBoxMode();
}

function setTool(tool) {
  if (tool === 'zoomfit') {
    fitView();
    return;
  }
  if (activeTool === 'hole' && tool !== 'hole') clearHoleCreate();
  if (activeTool === 'movehole' && tool !== 'movehole') clearHoleMove();
  if (activeTool === 'box' && tool !== 'box') clearBoxPlacement();
  if (activeTool === 'cylinder' && tool !== 'cylinder') clearCylinderPlacement();
  if (activeTool === 'cut' && tool !== 'cut') clearCutPlacement();
  if (activeTool === 'text' && tool !== 'text') clearTextPlacement();
  if (activeTool === 'line' && tool !== 'line') clearSketch();
  if (activeTool === 'transform' && tool !== 'transform') clearTransformPreview();
  clearSnapIndicator();
  activeTool = tool;
  if (tool === 'measure') clearSelection();
  if (tool === 'transform') clearSelection();
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
  if (tool === 'cut') {
    clearSelection();
    clearCutPlacement();
    updateCutFields();
  }
  if (tool === 'text') {
    clearSelection();
    clearTextPlacement();
  }
  if (tool === 'line') {
    clearSelection();
    clearSketch();
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
          : ['hole', 'measure', 'movehole', 'box', 'cylinder', 'cut', 'text', 'line'].includes(tool)
            ? 'crosshair'
            : 'default';
  updateInspector();
  const statusByTool = {
    select: 'Selezione attiva. Clicca una superficie del modello.',
    pushpull: 'Spingi/Tira: clicca una superficie piana.',
    hole: 'Foro: clicca il centro sulla superficie.',
    movehole: 'Sposta foro: clicca la parete interna del foro.',
    box: 'Parallelepipedo: clicca il punto di appoggio, poi regola misure e somma/sottrai.',
    cylinder: 'Cilindro: clicca il centro di appoggio, poi regola diametro, altezza e asse.',
    cut: 'Sottrai: scegli box o cilindro, clicca il punto e applica il taglio.',
    text: 'Testo: clicca il punto basso sinistro, poi scrivi e regola profondita e font.',
    line: 'Linea: clicca punti magnetici e spigoli liberi. Auto 3D permette linee su piani diversi.',
    measure: 'Misura: clicca il primo punto.',
    transform: 'Trasforma: inserisci valori e applica al modello.',
    orbit: 'Orbita: trascina per ruotare la vista.',
    pan: 'Panoramica: trascina per spostare la vista.',
  };
  if (statusByTool[tool]) setStatus(statusByTool[tool]);
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

  for (const candidate of targets) {
    const point = snapTargetPoint(candidate);
    if (!point) continue;
    projected.copy(point).project(camera);
    if (projected.z < -1 || projected.z > 1) continue;

    const x = rect.left + ((projected.x + 1) / 2) * rect.width;
    const y = rect.top + ((1 - projected.y) / 2) * rect.height;
    const dx = x - clientX;
    const dy = y - clientY;
    const distanceSq = dx * dx + dy * dy;
    if (distanceSq >= bestDistanceSq) continue;

    bestDistanceSq = distanceSq;
    best = {
      distance: Math.sqrt(distanceSq),
      kind: candidate.kind ?? 'vertice',
      point: point.clone(),
    };
  }

  return best;
}

function pickWorkPoint(clientX, clientY, options = {}) {
  const {
    allowScreenSnap = false,
    axisStart = null,
    inferenceDirections = [],
    extraSnapPoints = [],
    modelOnly = false,
    preferWorkPlane = false,
    projectSnapsToWorkPlane = true,
    screenSnapDistance = 14,
    screenSnapPoints = null,
    snapGrid = true,
    workPlane = null,
  } = options;
  setRayFromPointer(clientX, clientY);
  const availableSnapPoints = [...snapPoints, ...extraSnapPoints];
  const screenSnap = allowScreenSnap
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
  if (kind === 'punto medio') return 0xe46f2b;
  if (kind === 'griglia') return 0xf7cf52;
  return 0x1679b8;
}

function drawSnapIndicator(pick) {
  clearSnapIndicator();
  if (!pick || pick.snapKind === 'griglia' || pick.snapKind === 'superficie') return;
  const radius = Math.max(model?.geometry.boundingSphere?.radius ?? 50, 30) * 0.006;
  snapIndicator = createPointMarker(pick.point, snapColor(pick.snapKind), radius);
  addTransientOverlay(snapIndicator, 'snap-indicator');
}

function updateSnapIndicator(clientX, clientY) {
  if (!['hole', 'measure', 'movehole', 'box', 'cylinder', 'cut', 'text', 'line'].includes(activeTool)) {
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
    axisStart,
    inferenceDirections: activeTool === 'line' ? sketchInferenceDirections() : [],
    modelOnly: activeTool === 'measure' || activeTool === 'movehole',
    snapGrid: activeTool !== 'measure' && activeTool !== 'movehole',
  });
  drawSnapIndicator(pick);
}

function selectAt(clientX, clientY) {
  const hit = raycastModel(clientX, clientY);
  if (!hit) {
    clearSelection();
    return;
  }

  const region = findCoplanarRegion(model.geometry, hit.faceIndex);
  clearSelection();
  selected = {
    point: hit.point.clone(),
    normal: region.normal.clone(),
    region,
  };

  highlight = new THREE.Mesh(
    createRegionGeometry(model.geometry, region.triangles),
    highlightMaterial,
  );
  highlight.renderOrder = 3;
  addTransientOverlay(highlight, 'selection');
  ui.selectionLabel.textContent = `Superficie selezionata (${region.triangles.length} triangoli)`;
  ui.selectionDetail.textContent =
    activeTool === 'hole'
      ? 'Il punto blu indica il centro del foro.'
      : 'La zona blu verra spostata lungo la sua normale.';
  ui.measureValue.value = `${region.triangles.length} facce`;
  ui.inspector.classList.add('open');
  setStatus(activeTool === 'hole' ? 'Punto del foro selezionato.' : 'Superficie selezionata.');
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

function createPointMarker(point, color, radius) {
  const marker = new THREE.Mesh(
    new THREE.SphereGeometry(radius, 18, 12),
    new THREE.MeshBasicMaterial({ color, depthTest: false }),
  );
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
