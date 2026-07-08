import './style.css';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';
import { STLExporter } from 'three/addons/exporters/STLExporter.js';
import { FontLoader } from 'three/addons/loaders/FontLoader.js';
import { ADDITION, Brush, Evaluator, SUBTRACTION } from 'three-bvh-csg';
import helvetikerRegularUrl from 'three/examples/fonts/helvetiker_regular.typeface.json?url';
import helvetikerBoldUrl from 'three/examples/fonts/helvetiker_bold.typeface.json?url';
import optimerRegularUrl from 'three/examples/fonts/optimer_regular.typeface.json?url';
import optimerBoldUrl from 'three/examples/fonts/optimer_bold.typeface.json?url';
import gentilisRegularUrl from 'three/examples/fonts/gentilis_regular.typeface.json?url';
import gentilisBoldUrl from 'three/examples/fonts/gentilis_bold.typeface.json?url';
import droidSansRegularUrl from 'three/examples/fonts/droid/droid_sans_regular.typeface.json?url';
import droidSansBoldUrl from 'three/examples/fonts/droid/droid_sans_bold.typeface.json?url';
import droidSerifRegularUrl from 'three/examples/fonts/droid/droid_serif_regular.typeface.json?url';
import droidSerifBoldUrl from 'three/examples/fonts/droid/droid_serif_bold.typeface.json?url';
import droidMonoRegularUrl from 'three/examples/fonts/droid/droid_sans_mono_regular.typeface.json?url';
import {
  collectDisplaySnapPoints,
  combineGeometries,
  createDisplayEdgesGeometry,
  createRegionGeometry,
  deleteTrianglesFromGeometry,
  findCoplanarRegion,
  pushPullGeometry,
  repairMeshGeometry,
  triangleCount,
} from './geometry.js';
import { calculateMeasurement } from './measurement.js';
import { detectCylindricalHole } from './hole-detection.js';
import {
  snapPoint,
  snapPointToAxis,
  snapPointToDirections,
} from './snapping.js';
import {
  createBoxGeometryFromBase,
  createCylinderGeometryFromBase,
  createExtrudedPolygonGeometry,
  createPolygonFaceGeometry,
  createTextGeometryFromBase,
} from './primitives.js';
import { formatDecimal, parseDecimal } from './number-format.js';

const canvas = document.querySelector('#canvas');
const viewport = document.querySelector('#viewport');
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xdceaf3);

const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100000);
camera.up.set(0, 0, 1);
camera.position.set(120, -150, 110);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
renderer.shadowMap.enabled = false;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.screenSpacePanning = true;
controls.mouseButtons.LEFT = null;
controls.mouseButtons.MIDDLE = THREE.MOUSE.ROTATE;
controls.mouseButtons.RIGHT = THREE.MOUSE.PAN;
controls.target.set(0, 0, 15);
controls.addEventListener('change', requestRender);

const grid = new THREE.GridHelper(1000, 100, 0x8e9aa3, 0xb9c4ca);
grid.rotation.x = Math.PI / 2;
grid.material.opacity = 0.55;
grid.material.transparent = true;
scene.add(grid);

const hemisphere = new THREE.HemisphereLight(0xffffff, 0x65727b, 2.2);
scene.add(hemisphere);
const sun = new THREE.DirectionalLight(0xffffff, 3);
sun.position.set(-100, -120, 220);
scene.add(sun);

const modelMaterial = new THREE.MeshStandardMaterial({
  color: 0xf3eee5,
  roughness: 0.78,
  metalness: 0.02,
  side: THREE.DoubleSide,
  flatShading: true,
  polygonOffset: true,
  polygonOffsetFactor: 1,
  polygonOffsetUnits: 1,
});
const edgeMaterial = new THREE.LineBasicMaterial({ color: 0x36434a, opacity: 0.5, transparent: true });
const highlightMaterial = new THREE.MeshBasicMaterial({
  color: 0x2c92d5,
  transparent: true,
  opacity: 0.5,
  side: THREE.DoubleSide,
  depthWrite: false,
});
highlightMaterial.userData.shared = true;
const measureColors = {
  total: 0xe46f2b,
  x: 0xcc3737,
  y: 0x2e9a52,
  z: 0x2477bd,
};

let model = null;
let edges = null;
let highlight = null;
let selected = null;
let activeTool = 'select';
let currentFileName = 'modello-esempio.stl';
let pointerDown = null;
let measurementStart = null;
let measurementEnd = null;
let measurementGroup = null;
let measurementResult = null;
let holeCreate = null;
let holeCreatePreview = null;
let holeMove = null;
let holeMovePreview = null;
let boxPlacement = null;
let boxPreview = null;
let cylinderPlacement = null;
let cylinderPreview = null;
let cutPlacement = null;
let cutPreview = null;
let textPlacement = null;
let textPreview = null;
let transformPreview = null;
let sketchPoints = [];
let sketchEdges = [];
let sketchFaces = [];
let sketchPreview = null;
let sketchClosed = false;
let sketchPreviewPoint = null;
let sketchPreviewAxis = null;
let sketchLengthInput = '';
let snapIndicator = null;
let snapPoints = [];
const undoStack = [];
const redoStack = [];
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const evaluator = new Evaluator();
evaluator.useGroups = false;
evaluator.attributes = ['position', 'normal'];
const fontLoader = new FontLoader();
const textFontSources = {
  helvetiker: {
    label: 'Helvetiker',
    regular: helvetikerRegularUrl,
    bold: helvetikerBoldUrl,
  },
  optimer: {
    label: 'Optimer',
    regular: optimerRegularUrl,
    bold: optimerBoldUrl,
  },
  gentilis: {
    label: 'Gentilis',
    regular: gentilisRegularUrl,
    bold: gentilisBoldUrl,
  },
  droidSans: {
    label: 'Droid Sans',
    regular: droidSansRegularUrl,
    bold: droidSansBoldUrl,
  },
  droidSerif: {
    label: 'Droid Serif',
    regular: droidSerifRegularUrl,
    bold: droidSerifBoldUrl,
  },
  droidMono: {
    label: 'Droid Sans Mono',
    regular: droidMonoRegularUrl,
    bold: droidMonoRegularUrl,
  },
};
const textFontCache = new Map();
let textPreviewRequest = 0;
let textApplyInProgress = false;
const MAX_TEXT_BOOLEAN_TRIANGLES = 12000;
const MAX_TEXT_BOOLEAN_TOTAL_TRIANGLES = 70000;
const TEXT_ENGRAVE_SURFACE_OVERLAP = 0.25;
const MAX_EDGE_TRIANGLES = 50000;
const MODEL_EDGE_ANGLE = 80;
let appBusy = false;
let renderRequested = false;

const ui = {
  exportButton: document.querySelector('#export-file'),
  repairModelButton: document.querySelector('#repair-model'),
  removeModelButton: document.querySelector('#remove-model'),
  fileInput: document.querySelector('#file-input'),
  fileName: document.querySelector('#file-name'),
  status: document.querySelector('#status'),
  hint: document.querySelector('#hint'),
  busyOverlay: document.querySelector('#busy-overlay'),
  busyTitle: document.querySelector('#busy-title'),
  busyMessage: document.querySelector('#busy-message'),
  emptyState: document.querySelector('#empty-state'),
  inspector: document.querySelector('#inspector'),
  panelTitle: document.querySelector('#panel-title'),
  panelDescription: document.querySelector('#panel-description'),
  pushPullForm: document.querySelector('#pushpull-form'),
  holeForm: document.querySelector('#hole-form'),
  holeCreateInfo: document.querySelector('#hole-create-info'),
  holeCreateAxis: document.querySelector('#hole-create-axis'),
  holeCreateHelp: document.querySelector('#hole-create-help'),
  holeDiameter: document.querySelector('#hole-diameter'),
  holeDepth: document.querySelector('#hole-depth'),
  holeOffsetInputs: [
    document.querySelector('#hole-offset-x'),
    document.querySelector('#hole-offset-y'),
    document.querySelector('#hole-offset-z'),
  ],
  applyHole: document.querySelector('#apply-hole'),
  moveHoleForm: document.querySelector('#move-hole-form'),
  moveHoleInfo: document.querySelector('#move-hole-info'),
  moveHoleAxis: document.querySelector('#move-hole-axis'),
  moveHoleHelp: document.querySelector('#move-hole-help'),
  moveHoleInputs: [
    document.querySelector('#move-hole-x'),
    document.querySelector('#move-hole-y'),
    document.querySelector('#move-hole-z'),
  ],
  applyMoveHole: document.querySelector('#apply-move-hole'),
  boxForm: document.querySelector('#box-form'),
  boxInfo: document.querySelector('#box-info'),
  boxWidth: document.querySelector('#box-width'),
  boxDepth: document.querySelector('#box-depth'),
  boxHeight: document.querySelector('#box-height'),
  boxOperation: document.querySelector('#box-operation'),
  boxOffsetInputs: [
    document.querySelector('#box-offset-x'),
    document.querySelector('#box-offset-y'),
    document.querySelector('#box-offset-z'),
  ],
  applyBox: document.querySelector('#apply-box'),
  cylinderForm: document.querySelector('#cylinder-form'),
  cylinderInfo: document.querySelector('#cylinder-info'),
  cylinderDiameter: document.querySelector('#cylinder-diameter'),
  cylinderHeight: document.querySelector('#cylinder-height'),
  cylinderAxis: document.querySelector('#cylinder-axis'),
  cylinderOperation: document.querySelector('#cylinder-operation'),
  cylinderOffsetInputs: [
    document.querySelector('#cylinder-offset-x'),
    document.querySelector('#cylinder-offset-y'),
    document.querySelector('#cylinder-offset-z'),
  ],
  applyCylinder: document.querySelector('#apply-cylinder'),
  cutForm: document.querySelector('#cut-form'),
  cutInfo: document.querySelector('#cut-info'),
  cutShape: document.querySelector('#cut-shape'),
  cutBoxFields: document.querySelector('#cut-box-fields'),
  cutCylinderFields: document.querySelector('#cut-cylinder-fields'),
  cutWidth: document.querySelector('#cut-width'),
  cutDepth: document.querySelector('#cut-depth'),
  cutHeight: document.querySelector('#cut-height'),
  cutDiameter: document.querySelector('#cut-diameter'),
  cutCylinderHeight: document.querySelector('#cut-cylinder-height'),
  cutAxis: document.querySelector('#cut-axis'),
  cutOffsetInputs: [
    document.querySelector('#cut-offset-x'),
    document.querySelector('#cut-offset-y'),
    document.querySelector('#cut-offset-z'),
  ],
  applyCut: document.querySelector('#apply-cut'),
  textForm: document.querySelector('#text-form'),
  textInfo: document.querySelector('#text-info'),
  textContent: document.querySelector('#text-content'),
  textFont: document.querySelector('#text-font'),
  textOperation: document.querySelector('#text-operation'),
  textSize: document.querySelector('#text-size'),
  textDepth: document.querySelector('#text-depth'),
  textWidth: document.querySelector('#text-width'),
  textBevel: document.querySelector('#text-bevel'),
  textRotation: document.querySelector('#text-rotation'),
  textBold: document.querySelector('#text-bold'),
  textItalic: document.querySelector('#text-italic'),
  textOffsetInputs: [
    document.querySelector('#text-offset-x'),
    document.querySelector('#text-offset-y'),
    document.querySelector('#text-offset-z'),
  ],
  applyText: document.querySelector('#apply-text'),
  sketchForm: document.querySelector('#sketch-form'),
  sketchInfo: document.querySelector('#sketch-info'),
  sketchPlane: document.querySelector('#sketch-plane'),
  sketchInference: document.querySelector('#sketch-inference'),
  applySketch: document.querySelector('#apply-sketch'),
  newSketchLine: document.querySelector('#new-sketch-line'),
  transformForm: document.querySelector('#transform-form'),
  transformTranslateInputs: [
    document.querySelector('#transform-x'),
    document.querySelector('#transform-y'),
    document.querySelector('#transform-z'),
  ],
  transformRotateInputs: [
    document.querySelector('#transform-rotate-x'),
    document.querySelector('#transform-rotate-y'),
    document.querySelector('#transform-rotate-z'),
  ],
  transformScale: document.querySelector('#transform-scale'),
  applyTransform: document.querySelector('#apply-transform'),
  measurePanel: document.querySelector('#measure-panel'),
  measureTotal: document.querySelector('#measure-total'),
  measureX: document.querySelector('#measure-x'),
  measureY: document.querySelector('#measure-y'),
  measureZ: document.querySelector('#measure-z'),
  measureAxisSummary: document.querySelector('#measure-axis-summary'),
  selectionLabel: document.querySelector('#selection-label'),
  selectionDetail: document.querySelector('#selection-detail'),
  measureLabel: document.querySelector('label[for="measure-value"]'),
  measureValue: document.querySelector('#measure-value'),
  undo: document.querySelector('#undo'),
  redo: document.querySelector('#redo'),
};

function setStatus(message) {
  ui.status.textContent = message;
}

function requestRender() {
  if (renderRequested) return;
  renderRequested = true;
  requestAnimationFrame(renderFrame);
}

function renderFrame() {
  renderRequested = false;
  const cameraChanged = controls.update();
  renderer.render(scene, camera);
  if (cameraChanged) requestRender();
}

function showBusy(title, message) {
  appBusy = true;
  ui.busyTitle.textContent = title;
  ui.busyMessage.textContent = message;
  ui.busyOverlay.hidden = false;
  document.body.classList.add('is-busy');
  setStatus(title);
  requestRender();
}

function hideBusy() {
  if (!appBusy) return;
  appBusy = false;
  ui.busyOverlay.hidden = true;
  document.body.classList.remove('is-busy');
  requestRender();
}

function formatMillimeters(value, signed = false) {
  const rounded = Math.abs(value) < 0.0005 ? 0 : value;
  const prefix = signed && rounded > 0 ? '+' : '';
  return `${prefix}${rounded.toFixed(2)} mm`;
}

function parseLengthInput(value) {
  const normalized = String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s*mm$/, '')
    .replace(',', '.');
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed <= 0) return Number.NaN;
  return Math.round(parsed * 100) / 100;
}

function setupDecimalSteppers() {
  document.querySelectorAll('.field-with-unit input[inputmode="decimal"]').forEach((input) => {
    if (input.dataset.steppersReady) return;
    input.dataset.steppersReady = 'true';

    const controls = document.createElement('div');
    controls.className = 'decimal-steppers';
    const increment = document.createElement('button');
    increment.type = 'button';
    increment.className = 'decimal-stepper';
    increment.setAttribute('aria-label', 'Aumenta valore');
    increment.textContent = '+';
    const decrement = document.createElement('button');
    decrement.type = 'button';
    decrement.className = 'decimal-stepper';
    decrement.setAttribute('aria-label', 'Diminuisci valore');
    decrement.textContent = '-';
    controls.append(increment, decrement);
    input.parentElement?.classList.add('has-decimal-steppers');
    input.after(controls);

    const changeBy = (direction) => {
      const step = parseDecimal(input.getAttribute('step'), 1);
      const min = parseDecimal(input.getAttribute('min'), Number.NEGATIVE_INFINITY);
      const current = parseDecimal(input.value, 0);
      const next = Math.max(min, current + direction * step);
      input.value = formatDecimal(next);
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
      input.focus();
    };

    increment.addEventListener('click', () => changeBy(1));
    decrement.addEventListener('click', () => changeBy(-1));
  });
}

setupDecimalSteppers();

function createExample() {
  const geometry = new THREE.BoxGeometry(80, 55, 25).toNonIndexed();
  geometry.translate(0, 0, 12.5);
  setModelGeometry(geometry, false);
  ui.fileName.textContent = currentFileName;
  fitView();
  setStatus('Blocco di esempio pronto. Prova Spingi/Tira o Foro.');
}

function clearSelection() {
  selected = null;
  if (highlight) {
    scene.remove(highlight);
    highlight.geometry.dispose();
    highlight = null;
    requestRender();
  }
  ui.selectionLabel.textContent = 'Nessuna superficie';
  ui.selectionDetail.textContent = 'Clicca una superficie del modello.';
  ui.measureValue.value = '-- mm';
}

function updateMeasureBoxMode() {
  const isSketchLengthMode = activeTool === 'line';
  const canEditSketchLength = isSketchLengthMode && sketchPoints.length > 0 && !sketchClosed;
  ui.measureLabel.textContent = isSketchLengthMode ? 'Lunghezza' : 'Misure';
  ui.measureValue.readOnly = !canEditSketchLength;
  ui.measureValue.placeholder = isSketchLengthMode ? 'digita mm' : '';
  ui.measureValue.classList.toggle('length-entry', isSketchLengthMode);
  ui.measureValue.classList.toggle('length-entry-active', canEditSketchLength);
  if (isSketchLengthMode && !sketchPoints.length) {
    ui.measureValue.value = '-- mm';
  }
}

function disposeObject(object) {
  object.traverse((child) => {
    child.geometry?.dispose();
    if (Array.isArray(child.material)) {
      child.material.forEach((material) => {
        if (!material.userData.shared) material.dispose();
      });
    } else if (child.material && !child.material.userData.shared) {
      child.material.dispose();
    }
  });
}

function addTransientOverlay(object, kind) {
  object.userData.transientOverlay = kind;
  object.traverse((child) => {
    child.userData.transientOverlay = kind;
  });
  scene.add(object);
  requestRender();
}

function clearSnapIndicator() {
  if (!snapIndicator) return;
  scene.remove(snapIndicator);
  disposeObject(snapIndicator);
  snapIndicator = null;
  requestRender();
}

function clearTransientOverlays() {
  const overlays = [];
  scene.traverse((object) => {
    if (object.userData.transientOverlay && object.parent === scene) overlays.push(object);
  });
  for (const overlay of overlays) {
    scene.remove(overlay);
    disposeObject(overlay);
  }
  if (overlays.length) requestRender();
  highlight = null;
  measurementGroup = null;
  holeCreatePreview = null;
  holeMovePreview = null;
  boxPreview = null;
  cylinderPreview = null;
  cutPreview = null;
  textPreview = null;
  transformPreview = null;
  sketchPreview = null;
  snapIndicator = null;
}

function clearMeasurement(resetPanel = true) {
  measurementStart = null;
  measurementEnd = null;
  measurementResult = null;
  if (measurementGroup) {
    scene.remove(measurementGroup);
    disposeObject(measurementGroup);
    measurementGroup = null;
    requestRender();
  }
  if (resetPanel) {
    ui.measureTotal.textContent = '-- mm';
    ui.measureX.textContent = '-- mm';
    ui.measureY.textContent = '-- mm';
    ui.measureZ.textContent = '-- mm';
    ui.measureAxisSummary.textContent = 'Clicca il primo punto.';
    ui.measureValue.value = '-- mm';
  }
}

function clearHoleCreate() {
  holeCreate = null;
  if (holeCreatePreview) {
    scene.remove(holeCreatePreview);
    disposeObject(holeCreatePreview);
    holeCreatePreview = null;
    requestRender();
  }
  ui.holeCreateInfo.textContent = 'Nessun punto selezionato';
  ui.holeCreateAxis.textContent = 'Clicca una superficie per impostare centro e direzione.';
  ui.holeCreateHelp.textContent = 'Il foro parte dal punto scelto e procede dentro il pezzo.';
  ui.holeOffsetInputs.forEach((input) => {
    input.value = '0';
    input.disabled = true;
  });
  ui.applyHole.disabled = true;
}

function clearHoleMove() {
  holeMove = null;
  if (holeMovePreview) {
    scene.remove(holeMovePreview);
    disposeObject(holeMovePreview);
    holeMovePreview = null;
    requestRender();
  }
  ui.moveHoleInfo.textContent = 'Nessun foro selezionato';
  ui.moveHoleAxis.textContent = 'Clicca la parete interna del foro.';
  ui.moveHoleHelp.textContent = 'Dopo aver scelto il foro, clicca il nuovo centro sulla piastra.';
  ui.moveHoleInputs.forEach((input) => {
