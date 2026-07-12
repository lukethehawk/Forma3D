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
  const pick = pickWorkPoint(clientX, clientY, { allowScreenSnap: true, modelOnly: true, snapGrid: false });
  if (!pick) {
    setStatus('Clicca un punto sulla superficie del modello.');
    return;
  }

  if (!measurementStart || measurementEnd) {
    clearMeasurement();
    measurementStart = pick.point.clone();
    drawMeasurement(measurementStart, true);
    ui.measureAxisSummary.textContent = 'Primo punto fissato. Clicca il secondo punto.';
    setStatus('Primo punto fissato. Ora clicca il secondo punto.');
    return;
  }

  measurementEnd = pick.point.clone();
  drawMeasurement(measurementEnd);
  setStatus(`Distanza misurata: ${formatMillimeters(measurementResult.total)}.`);
}

function previewMeasurement(clientX, clientY) {
  if (activeTool !== 'measure' || !measurementStart || measurementEnd) return;
  const pick = pickWorkPoint(clientX, clientY, { allowScreenSnap: true, modelOnly: true, snapGrid: false });
  if (pick) drawMeasurement(pick.point, true);
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

function applyPrimitiveGeometry(geometry, operation, successMessage, historyAction = null) {
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
  snapshot(historyAction ?? {
    title: operation === 'subtract' ? t('Sottrazione') : t('Modifica'),
    detail: successMessage,
  });
  try {
    const resultGeometry = booleanGeometry(model.geometry, geometry, operation);
    setModelGeometry(resultGeometry, false, { preserveSketch: true });
    updateHistoryButtons();
    setStatus(successMessage);
  } catch (error) {
    console.error(`Errore booleana: ${error?.stack ?? error}`);
    const previous = popUndoSnapshotForRollback();
    if (previous) setModelGeometry(previous, false, { preserveSketch: true });
    updateHistoryButtons();
    setStatus('Operazione booleana non riuscita: prova con un solido chiuso o una posizione leggermente diversa.');
  } finally {
    geometry.dispose();
  }
}

function appendGeometryToModel(geometry, successMessage, pendingMessage = 'Applicazione geometria in corso...', historyAction = null) {
  if (!model) {
    setModelGeometry(geometry, false);
    fitView();
    setStatus(successMessage);
    return true;
  }

  setStatus(pendingMessage);
  snapshot(historyAction ?? {
    title: t('Modifica'),
    detail: successMessage,
  });
  try {
    const resultGeometry = combineGeometries([model.geometry, geometry]);
    if (!resultGeometry) throw new Error('Nessuna geometria da combinare.');
    setModelGeometry(resultGeometry, false, { preserveSketch: true });
    updateHistoryButtons();
    setStatus(successMessage);
    return true;
  } catch (error) {
    console.error(`Errore unione testo: ${error?.stack ?? error}`);
    const previous = popUndoSnapshotForRollback();
    if (previous) setModelGeometry(previous, false, { preserveSketch: true });
    updateHistoryButtons();
    setStatus('Non riesco ad applicare il testo: prova a ridurre profondita o lunghezza.');
    return false;
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
    {
      title: ui.boxOperation.value === 'subtract' ? t('Sottrazione') : t('Creata Box'),
      detail: `${formatMillimeters(parseDecimal(ui.boxWidth.value, 0))} x ${formatMillimeters(parseDecimal(ui.boxDepth.value, 0))} x ${formatMillimeters(parseDecimal(ui.boxHeight.value, 0))}`,
    },
  );
}

function axisDirectionFromPlacement(placement, axisValue, operation = 'add') {
  if (axisValue === 'x') return new THREE.Vector3(1, 0, 0);
  if (axisValue === 'y') return new THREE.Vector3(0, 1, 0);
  if (axisValue === 'z') return new THREE.Vector3(0, 0, 1);
  const normal = placement?.normal?.clone().normalize() ?? new THREE.Vector3(0, 0, 1);
  return operation === 'subtract' ? normal.negate() : normal;
}

function cylinderDirectionFromState() {
  if (!cylinderPlacement) return new THREE.Vector3(0, 0, 1);
  return axisDirectionFromPlacement(cylinderPlacement, ui.cylinderAxis.value, ui.cylinderOperation.value);
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
    {
      title: ui.cylinderOperation.value === 'subtract' ? t('Sottrazione') : t('Creato Cilindro'),
      detail: `${t('diametro')} ${formatMillimeters(parseDecimal(ui.cylinderDiameter.value, 0))}, ${t('altezza')} ${formatMillimeters(parseDecimal(ui.cylinderHeight.value, 0))}, ${t('asse')} ${ui.cylinderAxis.value.toUpperCase()}`,
    },
  );
}

function coneDirectionFromState() {
  if (!conePlacement) return new THREE.Vector3(0, 0, 1);
  return axisDirectionFromPlacement(conePlacement, ui.coneAxis.value, ui.coneOperation.value);
}

function coneGeometryFromState() {
  if (!conePlacement) return null;
  const diameter = parseDecimal(ui.coneDiameter.value, 0);
  const height = parseDecimal(ui.coneHeight.value, 0);
  if (!(diameter > 0) || !(height > 0)) return null;
  const base = conePlacement.basePoint.clone().add(inputVector(ui.coneOffsetInputs));
  return createConeGeometryFromBase(base, diameter / 2, height, coneDirectionFromState(), 64);
}

function drawConePreview() {
  if (!conePlacement || activeTool !== 'cone') return;
  const geometry = coneGeometryFromState();
  if (!geometry) {
    ui.applyCone.disabled = true;
    return;
  }
  conePreview = setPreviewMesh(
    conePreview,
    geometry,
    operationColor(ui.coneOperation.value),
    'cone-preview',
  );
  ui.applyCone.disabled = false;
}

function setConePoint(pick) {
  conePlacement = {
    basePoint: pick.point.clone(),
    normal: pick.normal.clone(),
  };
  ui.coneInfo.textContent = `Centro base X ${pick.point.x.toFixed(2)}, Y ${pick.point.y.toFixed(2)}, Z ${pick.point.z.toFixed(2)} mm - snap ${pick.snapKind}.`;
  ui.coneOffsetInputs.forEach((input) => {
    input.value = '0';
  });
  drawConePreview();
  setStatus('Cono impostato. Regola diametro, altezza, asse e operazione.');
}

function coneAt(clientX, clientY) {
  const pick = pickWorkPoint(clientX, clientY);
  if (!pick) {
    setStatus('Clicca sul piano di lavoro o su un solido.');
    return;
  }
  setConePoint(pick);
}

function applyCone() {
  const geometry = coneGeometryFromState();
  if (!geometry) {
    setStatus('Imposta prima centro, diametro e altezza del cono.');
    return;
  }
  applyPrimitiveGeometry(
    geometry,
    ui.coneOperation.value,
    ui.coneOperation.value === 'subtract' ? 'Cono sottratto dal solido.' : 'Cono unito al solido.',
    {
      title: ui.coneOperation.value === 'subtract' ? t('Sottrazione') : t('Creato Cono'),
      detail: `${t('diametro')} ${formatMillimeters(parseDecimal(ui.coneDiameter.value, 0))}, ${t('altezza')} ${formatMillimeters(parseDecimal(ui.coneHeight.value, 0))}, ${t('asse')} ${ui.coneAxis.value.toUpperCase()}`,
    },
  );
}

function pyramidDirectionFromState() {
  if (!pyramidPlacement) return new THREE.Vector3(0, 0, 1);
  return axisDirectionFromPlacement(pyramidPlacement, ui.pyramidAxis.value, ui.pyramidOperation.value);
}

function pyramidGeometryFromState() {
  if (!pyramidPlacement) return null;
  const size = new THREE.Vector2(
    parseDecimal(ui.pyramidWidth.value, 0),
    parseDecimal(ui.pyramidDepth.value, 0),
  );
  const height = parseDecimal(ui.pyramidHeight.value, 0);
  if (!(size.x > 0) || !(size.y > 0) || !(height > 0)) return null;
  const base = pyramidPlacement.basePoint.clone().add(inputVector(ui.pyramidOffsetInputs));
  return createPyramidGeometryFromBase(base, size, height, pyramidDirectionFromState());
}

function drawPyramidPreview() {
  if (!pyramidPlacement || activeTool !== 'pyramid') return;
  const geometry = pyramidGeometryFromState();
  if (!geometry) {
    ui.applyPyramid.disabled = true;
    return;
  }
  pyramidPreview = setPreviewMesh(
    pyramidPreview,
    geometry,
    operationColor(ui.pyramidOperation.value),
    'pyramid-preview',
  );
  ui.applyPyramid.disabled = false;
}

function setPyramidPoint(pick) {
  pyramidPlacement = {
    basePoint: pick.point.clone(),
    normal: pick.normal.clone(),
  };
  ui.pyramidInfo.textContent = `Centro base X ${pick.point.x.toFixed(2)}, Y ${pick.point.y.toFixed(2)}, Z ${pick.point.z.toFixed(2)} mm - snap ${pick.snapKind}.`;
  ui.pyramidOffsetInputs.forEach((input) => {
    input.value = '0';
  });
  drawPyramidPreview();
  setStatus('Piramide impostata. Regola base, altezza, asse e operazione.');
}

function pyramidAt(clientX, clientY) {
  const pick = pickWorkPoint(clientX, clientY);
  if (!pick) {
    setStatus('Clicca sul piano di lavoro o su un solido.');
    return;
  }
  setPyramidPoint(pick);
}

function applyPyramid() {
  const geometry = pyramidGeometryFromState();
  if (!geometry) {
    setStatus('Imposta prima centro, base e altezza della piramide.');
    return;
  }
  applyPrimitiveGeometry(
    geometry,
    ui.pyramidOperation.value,
    ui.pyramidOperation.value === 'subtract' ? 'Piramide sottratta dal solido.' : 'Piramide unita al solido.',
    {
      title: ui.pyramidOperation.value === 'subtract' ? t('Sottrazione') : t('Creata Piramide'),
      detail: `${t('base')} ${formatMillimeters(parseDecimal(ui.pyramidWidth.value, 0))} x ${formatMillimeters(parseDecimal(ui.pyramidDepth.value, 0))}, ${t('altezza')} ${formatMillimeters(parseDecimal(ui.pyramidHeight.value, 0))}, ${t('asse')} ${ui.pyramidAxis.value.toUpperCase()}`,
    },
  );
}

function gearDirectionFromState() {
  if (!gearPlacement) return new THREE.Vector3(0, 0, 1);
  return axisDirectionFromPlacement(gearPlacement, ui.gearAxis.value, ui.gearOperation.value);
}

function gearOptionsFromInputs() {
  const teeth = Math.round(parseDecimal(ui.gearTeeth.value, 24));
  const module = parseDecimal(ui.gearModule.value, 2);
  const width = parseDecimal(ui.gearWidth.value, 8);
  const boreDiameter = parseDecimal(ui.gearBore.value, 0);
  const hubDiameter = parseDecimal(ui.gearHubDiameter.value, 0);
  const hubWidth = parseDecimal(ui.gearHubWidth.value, width);
  const backlash = parseDecimal(ui.gearBacklash.value, 0);

  if (teeth < 6 || teeth > MAX_GEAR_TEETH) {
    return { error: 'Il numero denti deve essere tra 6 e 80.' };
  }
  if (!(module >= 0.2)) {
    return { error: 'Il modulo deve essere almeno 0,2 mm.' };
  }
  if (!(width >= 0.5)) {
    return { error: 'Lo spessore deve essere almeno 0,5 mm.' };
  }
  if (boreDiameter < 0 || hubDiameter < 0 || hubWidth < 0 || backlash < 0) {
    return { error: 'Foro, mozzo e gioco non possono essere negativi.' };
  }
  if (hubDiameter > 0 && hubDiameter <= boreDiameter) {
    return { error: 'Il diametro mozzo deve essere maggiore del foro centrale.' };
  }

  return {
    options: {
      backlash,
      boreDiameter,
      hubDiameter,
      hubWidth: hubDiameter > 0 ? Math.max(hubWidth, width) : width,
      module,
      quality: ui.gearQuality.value,
      teeth,
      width,
    },
  };
}

function gearGeometryFromState() {
  if (!gearPlacement) return null;
  const parsed = gearOptionsFromInputs();
  if (parsed.error) {
    setStatus(parsed.error);
    return null;
  }
  const base = gearPlacement.basePoint.clone().add(inputVector(ui.gearOffsetInputs));
  const geometry = createGearGeometryFromBase(base, parsed.options, gearDirectionFromState());
  if (triangleCount(geometry) > MAX_GEAR_TRIANGLES) {
    geometry.dispose();
    setStatus("L'ingranaggio e troppo dettagliato per il browser: riduci denti o qualita.");
    return null;
  }
  return geometry;
}

function drawGearPreview() {
  gearPreviewTimer = null;
  if (!gearPlacement || activeTool !== 'gear') return;
  const geometry = gearGeometryFromState();
  if (!geometry) {
    if (gearPreview) {
      scene.remove(gearPreview);
      disposeObject(gearPreview);
      gearPreview = null;
      requestRender();
    }
    ui.applyGear.disabled = true;
    return;
  }
  gearPreview = setPreviewMesh(
    gearPreview,
    geometry,
    operationColor(ui.gearOperation.value),
    'gear-preview',
  );
  ui.applyGear.disabled = false;
}

function scheduleGearPreview() {
  if (!gearPlacement || activeTool !== 'gear') return;
  if (gearPreviewTimer) clearTimeout(gearPreviewTimer);
  gearPreviewTimer = setTimeout(drawGearPreview, 120);
}

function setGearPoint(pick) {
  gearPlacement = {
    basePoint: pick.point.clone(),
    normal: pick.normal.clone(),
  };
  ui.gearInfo.textContent = `Centro base X ${pick.point.x.toFixed(2)}, Y ${pick.point.y.toFixed(2)}, Z ${pick.point.z.toFixed(2)} mm - snap ${pick.snapKind}.`;
  ui.gearOffsetInputs.forEach((input) => {
    input.value = '0';
  });
  drawGearPreview();
  setStatus('Ingranaggio impostato. Regola denti, modulo, foro e mozzo; verra aggiunto senza booleane.');
}

function gearAt(clientX, clientY) {
  const pick = pickWorkPoint(clientX, clientY);
  if (!pick) {
    setStatus('Clicca sul piano di lavoro o su un solido.');
    return;
  }
  setGearPoint(pick);
}

function applyGear() {
  const geometry = gearGeometryFromState();
  if (!geometry) {
    setStatus('Imposta prima centro e parametri validi dell\'ingranaggio.');
    return;
  }
  setStatus('Creazione ingranaggio in corso...');
  appendGeometryToModel(
    geometry,
    'Ingranaggio aggiunto come corpo separato.',
    'Creazione ingranaggio in corso...',
    {
      title: t('Creato Ingranaggio'),
      detail: `${t('denti')} ${Math.round(parseDecimal(ui.gearTeeth.value, 24))}, ${t('modulo')} ${formatMillimeters(parseDecimal(ui.gearModule.value, 2))}, ${t('spessore')} ${formatMillimeters(parseDecimal(ui.gearWidth.value, 8))}`,
    },
  );
}

function planeDirectionFromState() {
  if (!planePlacement) return new THREE.Vector3(0, 0, 1);
  return axisDirectionFromPlacement(planePlacement, ui.planeAxis.value, 'add');
}

function planeGeometryFromState() {
  if (!planePlacement) return null;
  const width = parseDecimal(ui.planeWidth.value, 0);
  const depth = parseDecimal(ui.planeDepth.value, 0);
  if (!(width > 0) || !(depth > 0)) return null;
  const base = planePlacement.basePoint.clone().add(inputVector(ui.planeOffsetInputs));
  return createPlaneGeometryFromBase(
    base,
    ui.planeShape.value,
    new THREE.Vector2(width, depth),
    planeDirectionFromState(),
    64,
  );
}

function drawPlanePreview() {
  if (!planePlacement || activeTool !== 'plane') return;
  const geometry = planeGeometryFromState();
  if (!geometry) {
    ui.applyPlane.disabled = true;
    return;
  }
  planePreview = setPreviewMesh(planePreview, geometry, 0x1679b8, 'plane-preview');
  ui.applyPlane.disabled = false;
}

function setPlanePoint(pick) {
  planePlacement = {
    basePoint: pick.point.clone(),
    normal: pick.normal.clone(),
  };
  ui.planeInfo.textContent = `Centro piano X ${pick.point.x.toFixed(2)}, Y ${pick.point.y.toFixed(2)}, Z ${pick.point.z.toFixed(2)} mm - snap ${pick.snapKind}.`;
  ui.planeOffsetInputs.forEach((input) => {
    input.value = '0';
  });
  drawPlanePreview();
  setStatus('Piano impostato. Scegli forma, dimensioni e asse, poi applica.');
}

function planeAt(clientX, clientY) {
  const pick = pickWorkPoint(clientX, clientY);
  if (!pick) {
    setStatus('Clicca sul piano di lavoro o su un solido.');
    return;
  }
  setPlanePoint(pick);
}

function applyPlane() {
  const geometry = planeGeometryFromState();
  if (!geometry) {
    setStatus('Imposta prima centro, forma e dimensioni del piano.');
    return;
  }
  const firstPlaneTriangle = model ? triangleCount(model.geometry) : 0;
  const selectedPoint = planePlacement?.basePoint?.clone?.() ?? new THREE.Vector3();
  const applied = appendGeometryToModel(
    geometry,
    'Piano applicato al modello.',
    'Applicazione piano in corso...',
    {
      title: t('Creato Piano'),
      detail: `${ui.planeShape.value}, ${formatMillimeters(parseDecimal(ui.planeWidth.value, 0))} x ${formatMillimeters(parseDecimal(ui.planeDepth.value, 0))}, ${t('asse')} ${ui.planeAxis.value.toUpperCase()}`,
    },
  );
  if (applied) {
    setSelectionMode('face', { clear: false, refresh: false });
    setTool('select');
    try {
      const region = findCoplanarRegion(model.geometry, firstPlaneTriangle);
      selectFaceRegion(region, selectedPoint, {
        status: 'Piano applicato e selezionato. Usa Spingi/Tira per dargli volume.',
        detail: 'Faccia piana selezionata. Puoi usare subito Spingi/Tira.',
      });
    } catch (error) {
      console.error(`Errore selezione piano: ${error?.stack ?? error}`);
      setStatus('Piano applicato al modello.');
    }
  }
}

function jointDirectionFromState() {
  if (!jointPlacement) return new THREE.Vector3(0, 0, 1);
  return axisDirectionFromPlacement(jointPlacement, ui.jointAxis.value, ui.jointOperation.value);
}

function jointOptionsFromInputs(forceFlat = false) {
  const width = parseDecimal(ui.jointWidth.value, 0);
  const height = parseDecimal(ui.jointHeight.value, 0);
  const neckWidth = parseDecimal(ui.jointNeck.value, 0);
  const arcBulge = parseDecimal(ui.jointArc.value, 0);
  const rotation = parseDecimal(ui.jointRotation.value, 0);
  const depth = forceFlat ? 0 : parseDecimal(ui.jointDepth.value, 0);
  if (!(width > 0) || !(height > 0) || !(neckWidth > 0) || arcBulge < 0 || !Number.isFinite(rotation)) return null;
  if (!forceFlat && !(depth > 0)) return null;
  return {
    arcBulge,
    depth,
    height,
    neckWidth,
    rotationDeg: rotation,
    width,
  };
}

function jointGeometryFromState(forceFlat = false) {
  if (!jointPlacement) return null;
  const options = jointOptionsFromInputs(forceFlat);
  if (!options) return null;
  const base = jointPlacement.basePoint.clone().add(inputVector(ui.jointOffsetInputs));
  return createJointProfileGeometry(
    base,
    ui.jointType.value,
    options,
    jointDirectionFromState(),
  );
}

function drawJointPreview() {
  if (!jointPlacement || activeTool !== 'joint') return;
  const operation = ui.jointOperation.value;
  const geometry = jointGeometryFromState(operation === 'face');
  if (!geometry) {
    ui.applyJoint.disabled = true;
    return;
  }
  const color = operation === 'face' ? 0x1679b8 : operationColor(operation);
  jointPreview = setPreviewMesh(jointPreview, geometry, color, 'joint-preview');
  ui.applyJoint.disabled = false;
}

function setJointPoint(pick) {
  jointPlacement = {
    basePoint: pick.point.clone(),
    normal: pick.normal.clone(),
  };
  ui.jointInfo.textContent = `Centro incastro X ${pick.point.x.toFixed(2)}, Y ${pick.point.y.toFixed(2)}, Z ${pick.point.z.toFixed(2)} mm - snap ${pick.snapKind}.`;
  ui.jointOffsetInputs.forEach((input) => {
    input.value = '0';
  });
  drawJointPreview();
  setStatus('Incastro impostato. Scegli preset, dimensioni e operazione.');
}

function jointAt(clientX, clientY) {
  const pick = pickWorkPoint(clientX, clientY);
  if (!pick) {
    setStatus('Clicca sul piano di lavoro o su un solido.');
    return;
  }
  setJointPoint(pick);
}

function applyJoint() {
  const operation = ui.jointOperation.value;
  const geometry = jointGeometryFromState(operation === 'face');
  if (!geometry) {
    setStatus('Imposta prima centro, preset e dimensioni dell\'incastro.');
    return;
  }
  const firstJointTriangle = model ? triangleCount(model.geometry) : 0;
  const selectedPoint = jointPlacement?.basePoint?.clone?.() ?? new THREE.Vector3();
  const rotation = parseDecimal(ui.jointRotation.value, 0);
  const detail = `${ui.jointType.value}, ${formatMillimeters(parseDecimal(ui.jointWidth.value, 0))} x ${formatMillimeters(parseDecimal(ui.jointHeight.value, 0))}, ${t('Rotazione')} ${formatDecimal(rotation)} deg`;
  if (operation === 'face') {
    const applied = appendGeometryToModel(
      geometry,
      'Incastro applicato come faccia 2D.',
      'Applicazione incastro in corso...',
      {
        title: t('Creato Incastro'),
        detail,
      },
    );
    if (applied) {
      setSelectionMode('face', { clear: false, refresh: false });
      setTool('select');
      try {
        const region = findCoplanarRegion(model.geometry, firstJointTriangle);
        selectFaceRegion(region, selectedPoint, {
          status: 'Incastro applicato e selezionato. Usa Spingi/Tira per dargli volume.',
          detail: 'Faccia incastro selezionata. Puoi usare subito Spingi/Tira.',
        });
      } catch (error) {
        console.error(`Errore selezione incastro: ${error?.stack ?? error}`);
        setStatus('Incastro applicato come faccia 2D.');
      }
    }
    return;
  }

  applyPrimitiveGeometry(
    geometry,
    operation,
    operation === 'subtract' ? 'Incastro sottratto dal solido.' : 'Incastro aggiunto al solido.',
    {
      title: operation === 'subtract' ? t('Sottrazione') : t('Creato Incastro'),
      detail: `${detail}, ${t('Profondita')} ${formatMillimeters(parseDecimal(ui.jointDepth.value, 0))}`,
    },
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
  applyPrimitiveGeometry(geometry, 'subtract', 'Figura sottratta dal file STL.', {
    title: t('Sottrazione'),
    detail: ui.cutShape.value === 'box'
      ? `Box ${formatMillimeters(parseDecimal(ui.cutWidth.value, 0))} x ${formatMillimeters(parseDecimal(ui.cutDepth.value, 0))} x ${formatMillimeters(parseDecimal(ui.cutHeight.value, 0))}`
      : `${t('cilindro')} ${t('diametro')} ${formatMillimeters(parseDecimal(ui.cutDiameter.value, 0))}, ${t('altezza')} ${formatMillimeters(parseDecimal(ui.cutCylinderHeight.value, 0))}`,
  });
}

function shortenAxisIndex() {
  return { x: 0, y: 1, z: 2 }[ui.shortenAxis.value] ?? 1;
}

function shortenAxisLabel(axis = shortenAxisIndex()) {
  return ['X', 'Y', 'Z'][axis] ?? 'Y';
}

function axisComponent(vector, axis) {
  return axis === 0 ? vector.x : axis === 1 ? vector.y : vector.z;
}

function setAxisComponent(vector, axis, value) {
  if (axis === 0) vector.x = value;
  else if (axis === 1) vector.y = value;
  else vector.z = value;
}

function shortenUsesWholeModel() {
  return Boolean(ui.shortenWholeModel?.checked);
}

function shortenTargetTriangles() {
  return model && !shortenUsesWholeModel() && selected?.type === 'object' && selected.triangles?.length
    ? selected.triangles
    : null;
}

function shortenTargetGeometry() {
  if (shortenUsesWholeModel()) return model?.geometry ?? null;
  const triangles = shortenTargetTriangles();
  return triangles ? extractTrianglesFromGeometry(model.geometry, triangles) : null;
}

function shortenTargetBox() {
  if (shortenUsesWholeModel() && model) {
    model.geometry.computeBoundingBox();
    return model.geometry.boundingBox.clone();
  }
  const geometry = shortenTargetGeometry();
  if (!geometry) return null;
  geometry.computeBoundingBox();
  const box = geometry.boundingBox.clone();
  geometry.dispose();
  return box;
}

function resetShortenDefaults() {
  const box = shortenTargetBox();
  if (ui.shortenInfo) {
    ui.shortenInfo.textContent = shortenUsesWholeModel()
      ? t('Accorcia tutto il file con un piano di taglio e richiudi la superficie.')
      : t('Seleziona un oggetto, poi accorcialo con un piano di taglio e richiudi la superficie.');
  }
  if (!box) {
    ui.applyShorten.disabled = true;
    if (ui.shortenReadout) {
      ui.shortenReadout.textContent = model
        ? t('Seleziona prima un oggetto con doppio click, poi usa Accorcia.')
        : t('Apri o crea un modello prima di usare Accorcia.');
    }
    return;
  }
  const size = box.getSize(new THREE.Vector3());
  const axis = shortenAxisIndex();
  const removeLength = Math.max(axisComponent(size, axis) * 0.5, 0.1);
  const center = axisComponent(box.getCenter(new THREE.Vector3()), axis);
  ui.shortenLength.value = formatDecimal(removeLength);
  ui.shortenCenter.value = formatDecimal(center);
  ui.applyShorten.disabled = false;
}

function shortenStateFromInputs() {
  const wholeModel = shortenUsesWholeModel();
  const triangles = shortenTargetTriangles();
  const box = shortenTargetBox();
  if (!model) return null;
  if ((!wholeModel && !triangles) || !box) {
    return {
      error: t('Seleziona prima un oggetto con doppio click, poi usa Accorcia.'),
    };
  }
  const axis = shortenAxisIndex();
  const size = box.getSize(new THREE.Vector3());
  const currentLength = axisComponent(size, axis);
  const removeLength = parseDecimal(ui.shortenLength.value, 0);
  if (!(removeLength > 0) || !(removeLength < currentLength)) {
    return {
      error: currentLanguage === 'en'
        ? `Length to remove must be greater than 0 and less than ${formatMillimeters(currentLength)}.`
        : `La lunghezza da rimuovere deve essere maggiore di 0 e minore di ${formatMillimeters(currentLength)}.`,
    };
  }
  const cutCenter = parseDecimal(ui.shortenCenter.value, NaN);
  if (!Number.isFinite(cutCenter)) {
    return {
      error: currentLanguage === 'en'
        ? 'Cut center must be a valid coordinate.'
        : 'Il centro taglio deve essere una coordinata valida.',
    };
  }
  const min = axisComponent(box.min, axis);
  const max = axisComponent(box.max, axis);
  const tolerance = Math.max(currentLength * 1e-6, 1e-6);
  const rawStart = cutCenter - removeLength / 2;
  const rawEnd = cutCenter + removeLength / 2;
  if (rawEnd <= min + tolerance || rawStart >= max - tolerance) {
    return {
      error: currentLanguage === 'en'
        ? `Cut volume must overlap the model between ${formatMillimeters(min)} and ${formatMillimeters(max)}.`
        : `Il volume di taglio deve incrociare il modello tra ${formatMillimeters(min)} e ${formatMillimeters(max)}.`,
    };
  }

  let mode = 'middle';
  let keepSide = null;
  let planePosition = null;
  let cutStart = rawStart;
  let cutEnd = rawEnd;
  if (rawStart <= min + tolerance) {
    mode = 'side-positive';
    keepSide = 'positive';
    planePosition = THREE.MathUtils.clamp(rawEnd, min, max);
    cutStart = min;
    cutEnd = planePosition;
  } else if (rawEnd >= max - tolerance) {
    mode = 'side-negative';
    keepSide = 'negative';
    planePosition = THREE.MathUtils.clamp(rawStart, min, max);
    cutStart = planePosition;
    cutEnd = max;
  }

  const actualRemovedLength = cutEnd - cutStart;
  if (!(actualRemovedLength > tolerance)) {
    return {
      error: currentLanguage === 'en'
        ? 'Cut volume is too close to the model edge.'
        : 'Il volume di taglio e troppo vicino al bordo del modello.',
    };
  }
  const finalLength = currentLength - actualRemovedLength;
  return {
    actualRemovedLength,
    axis,
    axisKey: ['x', 'y', 'z'][axis],
    box,
    cutCenter,
    cutEnd,
    cutStart,
    currentLength,
    finalLength,
    keepSide,
    mode,
    rawEnd,
    rawStart,
    planePosition,
    removeLength,
    wholeModel,
  };
}

function makePreviewBox(box, color) {
  const size = box.getSize(new THREE.Vector3());
  if (size.x <= 0 || size.y <= 0 || size.z <= 0) return null;
  const geometry = new THREE.BoxGeometry(size.x, size.y, size.z);
  geometry.translate(...box.getCenter(new THREE.Vector3()).toArray());
  const mesh = new THREE.Mesh(geometry, createPreviewMaterial(color));
  mesh.renderOrder = 12;
  return mesh;
}

function drawShortenPreview() {
  if (shortenPreview) {
    scene.remove(shortenPreview);
    disposeObject(shortenPreview);
    shortenPreview = null;
  }
  if (activeTool !== 'shorten') return;

  const state = shortenStateFromInputs();
  if (!state || state.error) {
    ui.applyShorten.disabled = true;
    ui.shortenReadout.textContent = state?.error ?? t('Apri o crea un modello prima di usare Accorcia.');
    requestRender();
    return;
  }

  const group = new THREE.Group();
  const padding = Math.max(state.currentLength * 0.03, 1);
  const fullBox = state.box.clone().expandByScalar(padding);
  const removedBox = fullBox.clone();
  const planeThickness = Math.max(state.currentLength * 0.004, 0.15);

  setAxisComponent(removedBox.min, state.axis, state.cutStart);
  setAxisComponent(removedBox.max, state.axis, state.cutEnd);
  const removedMesh = makePreviewBox(removedBox, 0xe46f2b);
  if (removedMesh) group.add(removedMesh);

  const planePositions = state.mode === 'middle'
    ? [state.cutStart, state.cutEnd]
    : [state.planePosition];
  for (const position of planePositions) {
    const planeBox = fullBox.clone();
    setAxisComponent(planeBox.min, state.axis, position - planeThickness * 0.5);
    setAxisComponent(planeBox.max, state.axis, position + planeThickness * 0.5);
    const planeMesh = makePreviewBox(planeBox, 0x1679b8);
    if (planeMesh) group.add(planeMesh);
  }

  shortenPreview = group;
  addTransientOverlay(shortenPreview, 'shorten-preview');
  ui.applyShorten.disabled = false;
  ui.shortenReadout.textContent = state.mode === 'middle'
    ? currentLanguage === 'en'
      ? `${shortenAxisLabel(state.axis)} now ${formatMillimeters(state.currentLength)} -> ${formatMillimeters(state.finalLength)}. Removing section ${formatMillimeters(state.cutStart)} - ${formatMillimeters(state.cutEnd)} and closing the gap.`
      : `${shortenAxisLabel(state.axis)} ora ${formatMillimeters(state.currentLength)} -> ${formatMillimeters(state.finalLength)}. Rimuove sezione ${formatMillimeters(state.cutStart)} - ${formatMillimeters(state.cutEnd)} e richiude il vuoto.`
    : currentLanguage === 'en'
      ? `${shortenAxisLabel(state.axis)} now ${formatMillimeters(state.currentLength)} -> ${formatMillimeters(state.finalLength)}. Side cut at ${formatMillimeters(state.planePosition)}.`
      : `${shortenAxisLabel(state.axis)} ora ${formatMillimeters(state.currentLength)} -> ${formatMillimeters(state.finalLength)}. Taglio laterale a ${formatMillimeters(state.planePosition)}.`;
  ui.shortenInfo.textContent = state.mode === 'middle'
    ? t('Accorcia: rimuove la sezione mediana, riavvicina le estremita e salda i vertici coincidenti.')
    : t('Accorcia: il taglio tocca un bordo, quindi mantiene il lato opposto e richiude la sezione.');
}

async function applyShorten() {
  if (!model) {
    setStatus('Apri o crea un modello prima di usare Accorcia.');
    return;
  }
  const state = shortenStateFromInputs();
  if (!state || state.error) {
    setStatus(state?.error ?? 'Imposta un taglio valido.');
    return;
  }

  showBusy('Taglio in corso...', 'Sto tagliando la mesh e richiudendo la superficie.');
  await waitForNextFrame();
  const targetTriangles = state.wholeModel ? null : [...selected.triangles];
  const targetGeometry = state.wholeModel
    ? model.geometry
    : extractTrianglesFromGeometry(model.geometry, targetTriangles);
  const remainderGeometry = state.wholeModel
    ? null
    : deleteTrianglesFromGeometry(model.geometry, targetTriangles);
  if (!targetGeometry) {
    hideBusy();
    setStatus('Seleziona prima un oggetto con doppio click, poi usa Accorcia.');
    return;
  }
  snapshot({
    title: t('Accorciato modello'),
    detail: `${state.wholeModel ? t('tutto file') : t('oggetto')}, ${t('asse')} ${shortenAxisLabel(state.axis)}, ${t('rimosso')} ${formatMillimeters(state.removeLength)}, ${t('centro')} ${formatMillimeters(state.cutCenter)}`,
  });
  try {
    const result = state.mode === 'middle'
      ? removeMiddleSectionGeometry(targetGeometry, {
        axis: state.axisKey,
        end: state.cutEnd,
        start: state.cutStart,
      })
      : cutPlaneGeometry(targetGeometry, {
        axis: state.axisKey,
        cap: true,
        keepSide: state.keepSide,
        position: state.planePosition,
      });
    if (!result?.geometry) throw new Error('Il taglio non ha prodotto geometria.');
    const repaired = repairMeshGeometry(result.geometry, {
      planarize: false,
      preserveWinding: true,
    });
    const shortenedGeometry = repaired?.geometry ?? result.geometry;
    const finalGeometry = remainderGeometry
      ? combineGeometries([remainderGeometry, shortenedGeometry])
      : shortenedGeometry;
    if (!finalGeometry) throw new Error('Il taglio non ha prodotto geometria.');
    if (repaired?.geometry) result.geometry.dispose();
    if (finalGeometry !== shortenedGeometry) shortenedGeometry.dispose();
    setModelGeometry(finalGeometry, false, { preserveSketch: true });
    updateHistoryButtons();
    setStatus(state.mode === 'middle'
      ? (state.wholeModel
        ? t('Accorcia applicato a tutto il file.')
        : t('Sezione mediana rimossa. Le due parti sono state riavvicinate e saldate dove possibile.'))
      : t('Taglio laterale applicato. Il lato opposto e stato mantenuto.'));
  } catch (error) {
    console.error(`Errore Accorcia: ${error?.stack ?? error}`);
    const previous = popUndoSnapshotForRollback();
    if (previous) setModelGeometry(previous, false, { preserveSketch: true });
    updateHistoryButtons();
    setStatus('Taglio non riuscito: prova un asse diverso o una lunghezza meno vicina al bordo.');
  } finally {
    if (!state.wholeModel) targetGeometry.dispose();
    if (remainderGeometry) remainderGeometry.dispose();
    hideBusy();
  }
}

function splitAxisIndex() {
  return { x: 0, y: 1, z: 2 }[ui.splitAxis.value] ?? 1;
}

function splitAxisLabel(axis = splitAxisIndex()) {
  return ['X', 'Y', 'Z'][axis] ?? 'Y';
}

function splitStateFromInputs() {
  if (!model) return null;
  model.geometry.computeBoundingBox();
  const box = model.geometry.boundingBox.clone();
  const axis = splitAxisIndex();
  const position = parseDecimal(ui.splitPosition.value, NaN);
  const min = axisComponent(box.min, axis);
  const max = axisComponent(box.max, axis);
  const length = max - min;
  const tolerance = Math.max(length * 1e-6, 1e-6);
  if (!Number.isFinite(position)) {
    return { error: t('La posizione taglio deve essere una coordinata valida.') };
  }
  if (position <= min + tolerance || position >= max - tolerance) {
    return {
      error: currentLanguage === 'en'
        ? `Cut position must be inside the model between ${formatMillimeters(min)} and ${formatMillimeters(max)}.`
        : `La posizione taglio deve stare dentro il modello tra ${formatMillimeters(min)} e ${formatMillimeters(max)}.`,
    };
  }
  return {
    axis,
    axisKey: ['x', 'y', 'z'][axis],
    box,
    cap: Boolean(ui.splitCap.checked),
    length,
    min,
    max,
    position,
    separate: Boolean(ui.splitSeparate.checked),
  };
}

function resetSplitDefaults() {
  if (!model) {
    ui.applySplit.disabled = true;
    ui.exportSplitNegative.disabled = true;
    ui.exportSplitPositive.disabled = true;
    ui.splitReadout.textContent = t('Apri o crea un modello prima di usare Separa.');
    return;
  }
  model.geometry.computeBoundingBox();
  const axis = splitAxisIndex();
  const center = axisComponent(model.geometry.boundingBox.getCenter(new THREE.Vector3()), axis);
  ui.splitPosition.value = formatDecimal(center);
  ui.applySplit.disabled = false;
  ui.exportSplitNegative.disabled = false;
  ui.exportSplitPositive.disabled = false;
}

function drawSplitPreview() {
  if (splitPreview) {
    scene.remove(splitPreview);
    disposeObject(splitPreview);
    splitPreview = null;
  }
  if (activeTool !== 'split') return;
  const state = splitStateFromInputs();
  if (!state || state.error) {
    ui.applySplit.disabled = true;
    ui.exportSplitNegative.disabled = true;
    ui.exportSplitPositive.disabled = true;
    ui.splitReadout.textContent = state?.error ?? t('Apri o crea un modello prima di usare Separa.');
    requestRender();
    return;
  }
  const group = new THREE.Group();
  const padding = Math.max(state.length * 0.03, 1);
  const fullBox = state.box.clone().expandByScalar(padding);
  const planeThickness = Math.max(state.length * 0.004, 0.15);
  const planeBox = fullBox.clone();
  setAxisComponent(planeBox.min, state.axis, state.position - planeThickness * 0.5);
  setAxisComponent(planeBox.max, state.axis, state.position + planeThickness * 0.5);
  const planeMesh = makePreviewBox(planeBox, 0x1679b8);
  if (planeMesh) group.add(planeMesh);
  if (state.separate) {
    const positiveBox = fullBox.clone();
    setAxisComponent(positiveBox.min, state.axis, state.position);
    const positiveMesh = makePreviewBox(positiveBox, 0xe46f2b);
    if (positiveMesh) group.add(positiveMesh);
  }
  splitPreview = group;
  addTransientOverlay(splitPreview, 'split-preview');
  ui.applySplit.disabled = false;
  ui.exportSplitNegative.disabled = false;
  ui.exportSplitPositive.disabled = false;
  ui.splitInfo.textContent = t('Taglia il modello con un piano e opzionalmente separa le due meta.');
  ui.splitReadout.textContent = currentLanguage === 'en'
    ? `${splitAxisLabel(state.axis)} cut at ${formatMillimeters(state.position)}. ${state.cap ? 'Cut faces will be capped.' : 'Cut faces stay open.'}`
    : `Taglio ${splitAxisLabel(state.axis)} a ${formatMillimeters(state.position)}. ${state.cap ? 'Le superfici tagliate saranno chiuse.' : 'Le superfici tagliate restano aperte.'}`;
}

function splitHalfGeometry(side) {
  const state = splitStateFromInputs();
  if (!state || state.error) return null;
  const result = cutPlaneGeometry(model.geometry, {
    axis: state.axisKey,
    cap: state.cap,
    discardCoplanarFaces: true,
    keepSide: side,
    position: state.position,
  });
  return result?.geometry ?? null;
}

function exportSplitHalf(side) {
  if (!model) return;
  const state = splitStateFromInputs();
  if (!state || state.error) {
    setStatus(state?.error ?? 'Imposta un taglio valido.');
    return;
  }
  const geometry = splitHalfGeometry(side);
  if (!geometry) {
    setStatus('Il taglio non ha prodotto una meta esportabile.');
    return;
  }
  const label = side === 'negative' ? 'negative' : 'positive';
  exportGeometryAsStl(geometry, `${sanitizeFileBase(currentFileName)}-${splitAxisLabel(state.axis).toLowerCase()}-${label}.stl`);
  geometry.dispose();
}

async function applySplit() {
  if (!model) {
    setStatus('Apri o crea un modello prima di usare Separa.');
    return;
  }
  const state = splitStateFromInputs();
  if (!state || state.error) {
    setStatus(state?.error ?? 'Imposta un taglio valido.');
    return;
  }
  showBusy('Taglio in corso...', 'Sto generando le due meta del modello.');
  await waitForNextFrame();
  snapshot({
    title: t('Tagliato modello'),
    detail: `${t('asse')} ${splitAxisLabel(state.axis)}, ${t('centro')} ${formatMillimeters(state.position)}`,
  });
  try {
    const negative = cutPlaneGeometry(model.geometry, {
      axis: state.axisKey,
      cap: state.cap,
      discardCoplanarFaces: true,
      keepSide: 'negative',
      position: state.position,
    });
    const positive = cutPlaneGeometry(model.geometry, {
      axis: state.axisKey,
      cap: state.cap,
      discardCoplanarFaces: true,
      keepSide: 'positive',
      position: state.position,
    });
    if (!negative?.geometry || !positive?.geometry) throw new Error('Il taglio non ha prodotto due meta valide.');
    if (state.separate) {
      const gap = Math.max(state.length * 0.01, 0.5);
      const offset = new THREE.Vector3();
      setAxisComponent(offset, state.axis, gap);
      positive.geometry.translate(offset.x, offset.y, offset.z);
    }
    const finalGeometry = combineGeometries([negative.geometry, positive.geometry]);
    negative.geometry.dispose();
    positive.geometry.dispose();
    if (!finalGeometry) throw new Error('Il taglio non ha prodotto geometria.');
    setModelGeometry(finalGeometry, false, { preserveSketch: true });
    updateHistoryButtons();
    setStatus(state.separate
      ? t('Modello tagliato e separato in due corpi.')
      : t('Modello tagliato. Le due meta sono rimaste nella posizione originale.'));
  } catch (error) {
    console.error(`Errore Separa: ${error?.stack ?? error}`);
    const previous = popUndoSnapshotForRollback();
    if (previous) setModelGeometry(previous, false, { preserveSketch: true });
    updateHistoryButtons();
    setStatus('Taglio non riuscito: prova una posizione piu interna o abilita la chiusura superfici.');
  } finally {
    hideBusy();
  }
}

function hollowThicknessFromInput() {
  return parseDecimal(ui.hollowThickness.value, 0);
}

function updateHollowState() {
  if (!ui.hollowReadout || !ui.applyHollow) return;
  if (!model) {
    ui.applyHollow.disabled = true;
    ui.hollowReadout.textContent = t('Apri o crea un modello prima di usare Svuota.');
    return;
  }

  const thickness = hollowThicknessFromInput();
  if (!(thickness > 0)) {
    ui.applyHollow.disabled = true;
    ui.hollowReadout.textContent = t('Lo spessore deve essere maggiore di 0 mm.');
    return;
  }

  const info = currentModelInfo ?? modelComplexityInfo(null, model.geometry);
  ui.applyHollow.disabled = false;
  ui.hollowReadout.textContent = info.isLarge
    ? t('Mesh grande: lo svuotamento puo richiedere tempo e puo creare auto-intersezioni sui dettagli piccoli.')
    : currentLanguage === 'en'
      ? `Wall thickness: ${formatMillimeters(thickness)}. Works best on closed, clean meshes.`
      : `Spessore parete: ${formatMillimeters(thickness)}. Funziona meglio su mesh chiuse e pulite.`;
}

async function applyHollow() {
  if (!model) {
    setStatus('Apri o crea un modello prima di usare Svuota.');
    updateHollowState();
    return;
  }

  const thickness = hollowThicknessFromInput();
  if (!(thickness > 0)) {
    setStatus('Lo spessore deve essere maggiore di 0 mm.');
    updateHollowState();
    return;
  }

  const info = currentModelInfo ?? modelComplexityInfo(null, model.geometry);
  if (info.isLarge) {
    setStatus('Mesh grande: lo svuotamento puo richiedere tempo e puo creare auto-intersezioni sui dettagli piccoli.');
  }

  showBusy('Svuotamento in corso...', 'Sto creando la superficie interna e le pareti dei bordi aperti.');
  await waitForNextFrame();
  snapshot({
    title: t('Svuotato modello'),
    detail: `${t('spessore')} ${formatMillimeters(thickness)}, ${info.triangles} ${currentLanguage === 'en' ? 'triangles' : 'triangoli'}`,
  });
  try {
    const result = hollowGeometry(model.geometry, thickness);
    if (!result?.geometry) throw new Error(t('Lo svuotamento non ha prodotto geometria.'));
    setModelGeometry(result.geometry, false, { preserveSketch: true });
    updateHistoryButtons();
    const boundaryText = result.openBoundaryCount
      ? currentLanguage === 'en'
        ? `; ${result.openBoundaryCount} open edges closed with side walls`
        : `; ${result.openBoundaryCount} bordi aperti chiusi con pareti laterali`
      : '';
    setStatus(currentLanguage === 'en'
      ? `Hollow completed: ${formatMillimeters(thickness)} wall, ${result.report.outputTriangles} triangles${boundaryText}.`
      : `Svuotamento completato: parete ${formatMillimeters(thickness)}, ${result.report.outputTriangles} triangoli${boundaryText}.`);
  } catch (error) {
    console.error(`Errore Svuota: ${error?.stack ?? error}`);
    const previous = popUndoSnapshotForRollback();
    if (previous) setModelGeometry(previous, false, { preserveSketch: true });
    updateHistoryButtons();
    setStatus('Svuotamento non riuscito: prova uno spessore minore o ripara la mesh prima di riprovare.');
  } finally {
    hideBusy();
  }
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
  const operation = ui.textOperation.value;
  const normal = textSurfaceNormalFromState();
  const requestedDepth = parseDecimal(ui.textDepth.value, 3);
  const depth = requestedDepth + (operation === 'subtract' ? TEXT_ENGRAVE_SURFACE_OVERLAP : 0);
  const base = textPlacement.basePoint.clone().add(inputVector(ui.textOffsetInputs));
  if (operation === 'subtract') {
    base.addScaledVector(normal, -requestedDepth);
  }
  return createTextGeometryFromBase(base, ui.textContent.value, await selectedTextFont(), {
    size: parseDecimal(ui.textSize.value, 12),
    depth,
    widthScale: parseDecimal(ui.textWidth.value, 1),
    bevelSize: parseDecimal(ui.textBevel.value, 0),
    rotationZ: parseDecimal(ui.textRotation.value, 0),
    italic: ui.textItalic.checked,
    direction: normal,
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
      applyPrimitiveGeometry(geometry, 'subtract', 'Testo 3D inciso nel solido.', {
        title: t('Inciso testo'),
        detail: `"${ui.textContent.value}" - ${formatMillimeters(parseDecimal(ui.textSize.value, 12))}, ${t('profondita')} ${formatMillimeters(parseDecimal(ui.textDepth.value, 3))}`,
      });
      return;
    }

    setStatus('Applicazione testo in rilievo in corso...');
    await waitForNextFrame();
    appendGeometryToModel(geometry, 'Testo 3D applicato al solido.', 'Applicazione testo in corso...', {
      title: t('Aggiunto testo'),
      detail: `"${ui.textContent.value}" - ${formatMillimeters(parseDecimal(ui.textSize.value, 12))}, ${t('profondita')} ${formatMillimeters(parseDecimal(ui.textDepth.value, 3))}`,
    });
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

  if (!sketchEdges.length && !sketchFaces.length && !sketchPoints.length && !pointerPoint) return;

  const group = new THREE.Group();
  for (const face of sketchFaces) {
    const geometry = createPolygonFaceGeometry(face.points);
    const mesh = new THREE.Mesh(geometry, createPreviewMaterial(0x28a45f));
    mesh.renderOrder = 11;
    group.add(mesh);
  }
  for (const edge of sketchEdges) {
    const color = sketchSegmentColor(edge.start, edge.end, edge.axis);
    const line = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([edge.start, edge.end]),
      new THREE.LineBasicMaterial({ color, depthTest: false }),
    );
    line.renderOrder = 12;
    group.add(line);
  }
  if (pointerPoint && sketchPoints.length && !sketchClosed) {
    const start = sketchPoints[sketchPoints.length - 1];
    const color = sketchSegmentColor(start, pointerPoint, axis);
    const line = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([start, pointerPoint]),
      new THREE.LineBasicMaterial({ color, depthTest: false }),
    );
    line.renderOrder = 13;
    group.add(line);
  }
  const markerRadius = Math.max(model?.geometry.boundingSphere?.radius ?? 50, 30) * 0.008;
  for (const point of sketchDisplayPoints()) {
    group.add(createPointMarker(point, 0xffffff, markerRadius));
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
