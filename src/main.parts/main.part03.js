;
  updateMeasurementPanel(result, preview);
}

function updateMeasurementPanel(result, preview = false) {
  measurementResult = result;
  ui.measureTotal.textContent = formatMillimeters(result.total);
  ui.measureX.textContent = formatMillimeters(result.dx, true);
  ui.measureY.textContent = formatMillimeters(result.dy, true);
  ui.measureZ.textContent = formatMillimeters(result.dz, true);
  const axis = result.dominantAxis.toUpperCase();
  ui.measureAxisSummary.textContent = result.isAxisAligned
    ? `Misura allineata con l'asse ${axis}.`
    : `Misura 3D. Componente principale sull'asse ${axis}.`;
  ui.measureValue.value = formatMillimeters(result.total);
  if (preview) ui.measureAxisSummary.textContent += ' Clicca per confermare.';
}

function measureAt(clientX, clientY) {
  const hit = raycastModel(clientX, clientY);
  if (!hit) {
    setStatus('Clicca un punto sulla superficie del modello.');
    return;
  }

  if (!measurementStart || measurementEnd) {
    clearMeasurement();
    measurementStart = hit.point.clone();
    drawMeasurement(measurementStart, true);
    ui.measureAxisSummary.textContent = 'Primo punto fissato. Clicca il secondo punto.';
    setStatus('Primo punto fissato. Ora clicca il secondo punto.');
    return;
  }

  measurementEnd = hit.point.clone();
  drawMeasurement(measurementEnd);
  setStatus(`Distanza misurata: ${formatMillimeters(measurementResult.total)}.`);
}

function previewMeasurement(clientX, clientY) {
  if (activeTool !== 'measure' || !measurementStart || measurementEnd) return;
  const hit = raycastModel(clientX, clientY);
  if (hit) drawMeasurement(hit.point, true);
}

function axisVector(axis) {
  return new THREE.Vector3(
    axis === 0 ? 1 : 0,
    axis === 1 ? 1 : 0,
    axis === 2 ? 1 : 0,
  );
}

function dominantAxis(vector) {
  const values = [Math.abs(vector.x), Math.abs(vector.y), Math.abs(vector.z)];
  return values.indexOf(Math.max(...values));
}

function createPreviewCylinder(center, radius, depth, direction, material, segments = 48) {
  const geometry = new THREE.CylinderGeometry(radius, radius, depth, segments, 1, true);
  const cylinder = new THREE.Mesh(geometry, material);
  cylinder.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.clone().normalize());
  cylinder.position.copy(center);
  cylinder.renderOrder = 12;
  return cylinder;
}

function createPreviewMaterial(color) {
  return new THREE.MeshBasicMaterial({
    color,
    wireframe: true,
    transparent: true,
    opacity: 0.95,
    depthTest: false,
  });
}

function inputVector(inputs) {
  return new THREE.Vector3(
    parseDecimal(inputs[0].value, 0),
    parseDecimal(inputs[1].value, 0),
    parseDecimal(inputs[2].value, 0),
  );
}

function operationColor(operation) {
  return operation === 'subtract' ? 0xe46f2b : 0x28a45f;
}

function waitForNextFrame() {
  return new Promise((resolve) => {
    requestAnimationFrame(resolve);
  });
}

function setPreviewMesh(previous, geometry, materialColor, kind) {
  if (previous) {
    scene.remove(previous);
    disposeObject(previous);
  }
  const mesh = new THREE.Mesh(geometry, createPreviewMaterial(materialColor));
  mesh.renderOrder = 12;
  addTransientOverlay(mesh, kind);
  return mesh;
}

function booleanGeometry(sourceGeometry, toolGeometry, operation) {
  const source = new Brush(sourceGeometry.clone(), modelMaterial);
  source.geometry.clearGroups();
  source.updateMatrixWorld(true);
  const tool = new Brush(toolGeometry.clone(), modelMaterial);
  tool.geometry.clearGroups();
  tool.updateMatrixWorld(true);
  const result = evaluator.evaluate(
    source,
    tool,
    operation === 'subtract' ? SUBTRACTION : ADDITION,
  );
  const geometry = result.geometry.clone();
  geometry.clearGroups();
  geometry.computeVertexNormals();
  return geometry;
}

function applyPrimitiveGeometry(geometry, operation, successMessage) {
  if (operation === 'subtract' && !model) {
    setStatus('Per sottrarre serve prima un solido di partenza.');
    geometry.dispose();
    return;
  }

  if (!model) {
    setModelGeometry(geometry, false);
    fitView();
    setStatus(successMessage);
    return;
  }

  setStatus(operation === 'subtract' ? 'Sottrazione in corso...' : 'Unione in corso...');
  snapshot();
  try {
    const resultGeometry = booleanGeometry(model.geometry, geometry, operation);
    setModelGeometry(resultGeometry, false);
    updateHistoryButtons();
    setStatus(successMessage);
  } catch (error) {
    console.error(`Errore booleana: ${error?.stack ?? error}`);
    const previous = undoStack.pop();
    if (previous) setModelGeometry(previous, false);
    updateHistoryButtons();
    setStatus('Operazione booleana non riuscita: prova con un solido chiuso o una posizione leggermente diversa.');
  } finally {
    geometry.dispose();
  }
}

function appendGeometryToModel(geometry, successMessage) {
  if (!model) {
    setModelGeometry(geometry, false);
    fitView();
    setStatus(successMessage);
    return;
  }

  setStatus('Applicazione testo in corso...');
  snapshot();
  try {
    const resultGeometry = combineGeometries([model.geometry, geometry]);
    if (!resultGeometry) throw new Error('Nessuna geometria da combinare.');
    setModelGeometry(resultGeometry, false);
    updateHistoryButtons();
    setStatus(successMessage);
  } catch (error) {
    console.error(`Errore unione testo: ${error?.stack ?? error}`);
    const previous = undoStack.pop();
    if (previous) previous.dispose();
    updateHistoryButtons();
    setStatus('Non riesco ad applicare il testo: prova a ridurre profondita o lunghezza.');
  } finally {
    geometry.dispose();
  }
}

function boxGeometryFromState() {
  if (!boxPlacement) return null;
  const base = boxPlacement.basePoint.clone().add(inputVector(ui.boxOffsetInputs));
  const size = new THREE.Vector3(
    parseDecimal(ui.boxWidth.value, 0),
    parseDecimal(ui.boxDepth.value, 0),
    parseDecimal(ui.boxHeight.value, 0),
  );
  if (!(size.x > 0) || !(size.y > 0) || !(size.z > 0)) return null;
  return createBoxGeometryFromBase(base, size);
}

function drawBoxPreview() {
  if (!boxPlacement || activeTool !== 'box') return;
  const geometry = boxGeometryFromState();
  if (!geometry) {
    ui.applyBox.disabled = true;
    return;
  }
  boxPreview = setPreviewMesh(
    boxPreview,
    geometry,
    operationColor(ui.boxOperation.value),
    'box-preview',
  );
  ui.applyBox.disabled = false;
}

function setBoxPoint(pick) {
  boxPlacement = { basePoint: pick.point.clone() };
  ui.boxInfo.textContent = `Base X ${pick.point.x.toFixed(2)}, Y ${pick.point.y.toFixed(2)}, Z ${pick.point.z.toFixed(2)} mm - snap ${pick.snapKind}.`;
  ui.boxOffsetInputs.forEach((input) => {
    input.value = '0';
  });
  drawBoxPreview();
  setStatus('Parallelepipedo impostato. Regola misure, spostamenti e operazione.');
}

function boxAt(clientX, clientY) {
  const pick = pickWorkPoint(clientX, clientY);
  if (!pick) {
    setStatus('Clicca sul piano di lavoro o su un solido.');
    return;
  }
  setBoxPoint(pick);
}

function applyBox() {
  const geometry = boxGeometryFromState();
  if (!geometry) {
    setStatus('Imposta prima punto e misure del parallelepipedo.');
    return;
  }
  applyPrimitiveGeometry(
    geometry,
    ui.boxOperation.value,
    ui.boxOperation.value === 'subtract' ? 'Parallelepipedo sottratto dal solido.' : 'Parallelepipedo unito al solido.',
  );
}

function cylinderDirectionFromState() {
  if (!cylinderPlacement) return new THREE.Vector3(0, 0, 1);
  const axis = ui.cylinderAxis.value;
  if (axis === 'x') return new THREE.Vector3(1, 0, 0);
  if (axis === 'y') return new THREE.Vector3(0, 1, 0);
  if (axis === 'z') return new THREE.Vector3(0, 0, 1);
  const normal = cylinderPlacement.normal.clone().normalize();
  return ui.cylinderOperation.value === 'subtract' ? normal.negate() : normal;
}

function cylinderGeometryFromState() {
  if (!cylinderPlacement) return null;
  const diameter = parseDecimal(ui.cylinderDiameter.value, 0);
  const height = parseDecimal(ui.cylinderHeight.value, 0);
  if (!(diameter > 0) || !(height > 0)) return null;
  const base = cylinderPlacement.basePoint.clone().add(inputVector(ui.cylinderOffsetInputs));
  return createCylinderGeometryFromBase(base, diameter / 2, height, cylinderDirectionFromState(), 64);
}

function drawCylinderPreview() {
  if (!cylinderPlacement || activeTool !== 'cylinder') return;
  const geometry = cylinderGeometryFromState();
  if (!geometry) {
    ui.applyCylinder.disabled = true;
    return;
  }
  cylinderPreview = setPreviewMesh(
    cylinderPreview,
    geometry,
    operationColor(ui.cylinderOperation.value),
    'cylinder-preview',
  );
  ui.applyCylinder.disabled = false;
}

function setCylinderPoint(pick) {
  cylinderPlacement = {
    basePoint: pick.point.clone(),
    normal: pick.normal.clone(),
  };
  ui.cylinderInfo.textContent = `Centro base X ${pick.point.x.toFixed(2)}, Y ${pick.point.y.toFixed(2)}, Z ${pick.point.z.toFixed(2)} mm - snap ${pick.snapKind}.`;
  ui.cylinderOffsetInputs.forEach((input) => {
    input.value = '0';
  });
  drawCylinderPreview();
  setStatus('Cilindro impostato. Regola diametro, altezza, asse e operazione.');
}

function cylinderAt(clientX, clientY) {
  const pick = pickWorkPoint(clientX, clientY);
  if (!pick) {
    setStatus('Clicca sul piano di lavoro o su un solido.');
    return;
  }
  setCylinderPoint(pick);
}

function applyCylinder() {
  const geometry = cylinderGeometryFromState();
  if (!geometry) {
    setStatus('Imposta prima centro, diametro e altezza del cilindro.');
    return;
  }
  applyPrimitiveGeometry(
    geometry,
    ui.cylinderOperation.value,
    ui.cylinderOperation.value === 'subtract' ? 'Cilindro sottratto dal solido.' : 'Cilindro unito al solido.',
  );
}

function updateCutFields() {
  const isCylinder = ui.cutShape.value === 'cylinder';
  ui.cutBoxFields.hidden = isCylinder;
  ui.cutCylinderFields.hidden = !isCylinder;
  drawCutPreview();
}

function cutDirectionFromState() {
  if (!cutPlacement) return new THREE.Vector3(0, 0, 1);
  const axis = ui.cutAxis.value;
  if (axis === 'x') return new THREE.Vector3(1, 0, 0);
  if (axis === 'y') return new THREE.Vector3(0, 1, 0);
  if (axis === 'z') return new THREE.Vector3(0, 0, 1);
  return cutPlacement.normal.clone().normalize().negate();
}

function cutGeometryFromState() {
  if (!cutPlacement) return null;
  const base = cutPlacement.basePoint.clone().add(inputVector(ui.cutOffsetInputs));

  if (ui.cutShape.value === 'box') {
    const size = new THREE.Vector3(
      parseDecimal(ui.cutWidth.value, 0),
      parseDecimal(ui.cutDepth.value, 0),
      parseDecimal(ui.cutHeight.value, 0),
    );
    if (!(size.x > 0) || !(size.y > 0) || !(size.z > 0)) return null;
    return createBoxGeometryFromBase(base, size);
  }

  const diameter = parseDecimal(ui.cutDiameter.value, 0);
  const height = parseDecimal(ui.cutCylinderHeight.value, 0);
  if (!(diameter > 0) || !(height > 0)) return null;
  return createCylinderGeometryFromBase(base, diameter / 2, height, cutDirectionFromState(), 64);
}

function drawCutPreview() {
  if (!cutPlacement || activeTool !== 'cut') return;
  const geometry = cutGeometryFromState();
  if (!geometry) {
    ui.applyCut.disabled = true;
    return;
  }
  cutPreview = setPreviewMesh(cutPreview, geometry, operationColor('subtract'), 'cut-preview');
  ui.applyCut.disabled = false;
}

function setCutPoint(pick) {
  cutPlacement = {
    basePoint: pick.point.clone(),
    normal: pick.normal.clone(),
  };
  ui.cutInfo.textContent = `Taglio X ${pick.point.x.toFixed(2)}, Y ${pick.point.y.toFixed(2)}, Z ${pick.point.z.toFixed(2)} mm - snap ${pick.snapKind}.`;
  ui.cutOffsetInputs.forEach((input) => {
    input.value = '0';
  });
  drawCutPreview();
  setStatus('Figura di sottrazione impostata. Regola dimensioni e spostamenti, poi applica.');
}

function cutAt(clientX, clientY) {
  const pick = pickWorkPoint(clientX, clientY);
  if (!pick) {
    setStatus('Clicca sull\'STL o sul piano di lavoro per posizionare la figura da sottrarre.');
    return;
  }
  setCutPoint(pick);
}

function applyCut() {
  const geometry = cutGeometryFromState();
  if (!geometry) {
    setStatus('Imposta prima forma, punto e dimensioni della sottrazione.');
    return;
  }
  applyPrimitiveGeometry(geometry, 'subtract', 'Figura sottratta dal file STL.');
}

async function selectedTextFont() {
  const family = textFontSources[ui.textFont.value] ?? textFontSources.helvetiker;
  const url = ui.textBold.checked ? family.bold : family.regular;
  if (!textFontCache.has(url)) {
    textFontCache.set(url, fontLoader.loadAsync(url));
  }
  return textFontCache.get(url);
}

async function textGeometryFromState() {
  if (!textPlacement) return null;
  const base = textPlacement.basePoint.clone().add(inputVector(ui.textOffsetInputs));
  return createTextGeometryFromBase(base, ui.textContent.value, await selectedTextFont(), {
    size: parseDecimal(ui.textSize.value, 12),
    depth: parseDecimal(ui.textDepth.value, 3),
    widthScale: parseDecimal(ui.textWidth.value, 1),
    bevelSize: parseDecimal(ui.textBevel.value, 0),
    rotationZ: parseDecimal(ui.textRotation.value, 0),
    italic: ui.textItalic.checked,
    direction: textSurfaceNormalFromState(),
    depthDirection: ui.textOperation.value === 'subtract' ? -1 : 1,
  });
}

function textSurfaceNormalFromState() {
  if (!textPlacement?.normal) return new THREE.Vector3(0, 0, 1);
  const normal = textPlacement.normal.clone();
  if (normal.lengthSq() < 1e-8) normal.set(0, 0, 1);
  normal.normalize();
  return normal;
}

function textBooleanIsSafe(geometry) {
  const textTriangles = triangleCount(geometry);
  const modelTriangles = model ? triangleCount(model.geometry) : 0;
  if (textTriangles > MAX_TEXT_BOOLEAN_TRIANGLES) {
    setStatus(`Testo troppo complesso per incidere (${Math.round(textTriangles)} triangoli). Riduci testo, smusso o font.`);
    return false;
  }
  if (modelTriangles + textTriangles > MAX_TEXT_BOOLEAN_TOTAL_TRIANGLES) {
    setStatus(`Incisione troppo pesante per il browser (${Math.round(modelTriangles + textTriangles)} triangoli). Riduci il modello o il testo.`);
    return false;
  }
  return true;
}

async function drawTextPreview() {
  if (!textPlacement || activeTool !== 'text') return;
  const request = (textPreviewRequest += 1);
  try {
    ui.applyText.disabled = true;
    const geometry = await textGeometryFromState();
    if (request !== textPreviewRequest) {
      geometry?.dispose();
      return;
    }
    if (!geometry) {
      ui.applyText.disabled = true;
      return;
    }
    textPreview = setPreviewMesh(
      textPreview,
      geometry,
      operationColor(ui.textOperation.value),
      'text-preview',
    );
    ui.applyText.disabled = false;
    setStatus('Anteprima testo aggiornata. Regola font, effetti e profondita oppure applica.');
  } catch (error) {
    if (textPreview) {
      scene.remove(textPreview);
      disposeObject(textPreview);
      textPreview = null;
      requestRender();
    }
    ui.applyText.disabled = true;
    setStatus(error instanceof Error ? error.message : 'Non riesco a creare questo testo.');
  }
}

function setTextPoint(pick) {
  textPlacement = {
    basePoint: pick.point.clone(),
    normal: pick.normal.clone(),
  };
  ui.textInfo.textContent = `Inizio testo X ${pick.point.x.toFixed(2)}, Y ${pick.point.y.toFixed(2)}, Z ${pick.point.z.toFixed(2)} mm - snap ${pick.snapKind}.`;
  ui.textOffsetInputs.forEach((input) => {
    input.value = '0';
  });
  drawTextPreview();
  setStatus('Punto testo impostato. Scrivi e regola font, profondita e larghezza.');
}

function textAt(clientX, clientY) {
  const pick = pickWorkPoint(clientX, clientY);
  if (!pick) {
    setStatus('Clicca sul piano di lavoro o su un solido per appoggiare il testo.');
    return;
  }
  setTextPoint(pick);
}

async function applyText() {
  if (textApplyInProgress) return;
  textApplyInProgress = true;
  ui.applyText.disabled = true;

  let geometry = null;
  try {
    geometry = await textGeometryFromState();
  } catch (error) {
    setStatus(error instanceof Error ? error.message : 'Non riesco a creare questo testo.');
    textApplyInProgress = false;
    if (textPlacement && activeTool === 'text') ui.applyText.disabled = false;
    return;
  }
  if (!geometry) {
    setStatus('Clicca prima il punto di partenza del testo.');
    textApplyInProgress = false;
    if (textPlacement && activeTool === 'text') ui.applyText.disabled = false;
    return;
  }

  const operation = ui.textOperation.value;
  try {
    if (operation === 'subtract') {
      if (!model) {
        setStatus('Per incidere testo serve prima un solido di partenza.');
        geometry.dispose();
        return;
      }
      if (!textBooleanIsSafe(geometry)) {
        geometry.dispose();
        return;
      }
      setStatus('Incisione testo in corso...');
      showBusy('Incisione in corso...', 'Sto calcolando la sottrazione del testo. Interfaccia bloccata finche il solido non e pronto.');
      await waitForNextFrame();
      await waitForNextFrame();
      applyPrimitiveGeometry(geometry, 'subtract', 'Testo 3D inciso nel solido.');
      return;
    }

    setStatus('Applicazione testo in rilievo in corso...');
    await waitForNextFrame();
    appendGeometryToModel(geometry, 'Testo 3D applicato al solido.');
  } finally {
    hideBusy();
    textApplyInProgress = false;
    if (textPlacement && activeTool === 'text') ui.applyText.disabled = false;
  }
}

function drawSketchPreview(pointerPoint = null, axis = null) {
  if (sketchPreview) {
    scene.remove(sketchPreview);
    disposeObject(sketchPreview);
    sketchPreview = null;
    requestRender();
  }

  const points = [...sketchPoints];
  if (pointerPoint && !sketchClosed) points.push(pointerPoint);
  if (!points.length) return;

  const group = new THREE.Group();
  const material = new THREE.LineBasicMaterial({
    color: axis === 0 ? measureColors.x : axis === 1 ? measureColors.y : axis === 2 ? measureColors.z : 0xe46f2b,
    depthTest: false,
  });
  const linePoints = sketchClosed ? [...points, points[0]] : points;
  if (linePoints.length > 1) {
    const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(linePoints), material);
    line.renderOrder = 12;
    group.add(line);
  }
  const markerRadius = Math.max(model?.geometry.boundingSphere?.radius ?? 50, 30) * 0.008;
  for (const point of sketchPoints) {
    group.add(createPointMarker(point, 0xffffff, markerRadius));
  }
  if (sketchClosed) {
    const geometry = createExtrudedPolygonGeometry(sketchPoints, 0.05);
    const face = new THREE.Mesh(geometry, createPreviewMaterial(0x28a45f));
    face.renderOrder = 11;
    group.add(face);
  }
  addTransientOverlay(group, 'sketch-preview');
  sketchPreview = group;
}

function applySketchLengthConstraint(point) {
  if (!sketchPoints.length || !sketchLengthInput) return point;
  const length = parseLengthInput(sketchLengthInput);
  if (!Number.isFinite(length)) return point;
  const start = sketchPoints[sketchPoints.length - 1];
  const direction = point.clone().sub(start);
  direction.z = 0;
  if (direction.lengthSq() < 1e-8) return point;
  return start.clone().add(direction.normalize().multiplyScalar(length));
}

function updateSketchLengthReadout(point) {
  if (!sketchPoints.length || !point) {
    ui.measureValue.value = '-- mm';
    return;
  }
  const start = sketchPoints[sketchPoints.length - 1];
  const length = point.distanceTo(start);
  if (!sketchLengthInput && document.activeElement !== ui.measureValue) {
    ui.measureValue.value = formatMillimeters(length);
  }
  ui.measureValue.classList.toggle('length-entry-active', !sketchClosed);
}

function setSketchLengthInput(value) {
  sketchLengthInput = value.replace(/[^\d,.]/g, '');
  ui.measureValue.value = sketchLengthInput;
  if (!sketchLengthInput) {
    updateSketchLengthReadout(sketchPreviewPoint);
    if (sketchPreviewPoint) drawSketchPreview(sketchPreviewPoint, sketchPreviewAxis);
    setStatus('Muovi il mouse o digita una lunghezza in millimetri.');
    return;
  }
  const length = parseLengthInput(sketchLengthInput);
