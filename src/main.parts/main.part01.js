import './style.css';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';
import { STLExporter } from 'three/addons/exporters/STLExporter.js';
import { OBJExporter } from 'three/addons/exporters/OBJExporter.js';
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
  collectConnectedComponents,
  collectDisplaySnapPoints,
  combineGeometries,
  cutPlaneGeometry,
  createDisplayEdgesGeometry,
  createPushPullRegionGeometry,
  createRegionGeometry,
  deleteTrianglesFromGeometry,
  extractTrianglesFromGeometry,
  findConnectedComponent,
  findCoplanarRegion,
  hollowGeometry,
  modelComplexityInfo,
  pushPullGeometry,
  regionHasCoplanarSupport,
  regionHasOpenBoundary,
  repairMeshGeometry,
  removeMiddleSectionGeometry,
  transformTrianglesInGeometry,
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
  createConeGeometryFromBase,
  createCylinderGeometryFromBase,
  createExtrudedPolygonGeometry,
  createGearGeometryFromBase,
  createPlaneGeometryFromBase,
  createPyramidGeometryFromBase,
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
  color: 0x008cff,
  transparent: true,
  opacity: 0.72,
  side: THREE.DoubleSide,
  depthWrite: false,
  depthTest: false,
});
highlightMaterial.userData.shared = true;
const selectionLineMaterial = new THREE.LineBasicMaterial({
  color: 0x006dff,
  transparent: true,
  opacity: 1,
  depthTest: false,
  depthWrite: false,
});
selectionLineMaterial.userData.shared = true;
const selectionCornerMaterial = new THREE.MeshBasicMaterial({
  color: 0x006dff,
  depthTest: false,
  depthWrite: false,
});
selectionCornerMaterial.userData.shared = true;
const measureColors = {
  total: 0xe46f2b,
  x: 0xcc3737,
  y: 0x2e9a52,
  z: 0x2477bd,
};
let pointMarkerTexture = null;

let model = null;
let edges = null;
let highlight = null;
let selected = null;
let transformFaceReference = null;
let activeTool = 'select';
let selectionMode = localStorage.getItem('forma3d-selection-mode') ?? 'face';
let currentLanguage = 'en';
let currentFileName = 'modello-esempio.stl';
let sourceStlName = 'modello-esempio.stl';
let currentModelInfo = null;
let objectItems = [];
let objectNames = [];
let objectItemsDeferred = false;
let objectsDrawerOpen = false;
let historyDrawerOpen = false;
let patternDrawerOpen = false;
let patternObjectIndex = null;
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
let conePlacement = null;
let conePreview = null;
let pyramidPlacement = null;
let pyramidPreview = null;
let gearPlacement = null;
let gearPreview = null;
let gearPreviewTimer = null;
let planePlacement = null;
let planePreview = null;
let cutPlacement = null;
let cutPreview = null;
let shortenPreview = null;
let splitPreview = null;
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
let pushPullHandle = null;
let pushPullHandleDrag = null;
let pushPullHandlePreview = null;
let pushPullHandleFrameRequest = 0;
let pushPullHandlePendingDistance = 0;
const undoStack = [];
const redoStack = [];
const undoHistory = [];
const redoHistory = [];
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
const MAX_GEAR_TEETH = 80;
const MAX_GEAR_TRIANGLES = 12000;
const MODEL_EDGE_ANGLE = 80;
const PUSH_PULL_VISUAL_STORAGE_KEY = 'forma3d-pushpull-visual-handle';
const PUSH_PULL_VISUAL_MODEL_TRIANGLE_LIMIT = 250000;
const PUSH_PULL_VISUAL_REGION_TRIANGLE_LIMIT = 20000;
let appBusy = false;
let renderRequested = false;

const ui = {
  exportButton: document.querySelector('#export-file'),
  exportObjButton: document.querySelector('#export-obj'),
  exportSelectionButton: document.querySelector('#export-selection'),
  openProjectButton: document.querySelector('#open-project'),
  saveProjectButton: document.querySelector('#save-project'),
  repairModelButton: document.querySelector('#repair-model'),
  removeModelButton: document.querySelector('#remove-model'),
  optionsMenuButton: document.querySelector('#options-menu-button'),
  optionsMenu: document.querySelector('#options-menu'),
  helpButton: document.querySelector('#help-button'),
  helpPopover: document.querySelector('#help-popover'),
  helpClose: document.querySelector('#help-close'),
  languageSelect: document.querySelector('#language-select'),
  fileInput: document.querySelector('#file-input'),
  projectInput: document.querySelector('#project-input'),
  fileInfoButton: document.querySelector('#file-info-button'),
  fileComplexityBadge: document.querySelector('#file-complexity-badge'),
  fileInfoPopover: document.querySelector('#file-info-popover'),
  fileInfoTitle: document.querySelector('#file-info-title'),
  fileInfoDetails: document.querySelector('#file-info-details'),
  fileInfoMessage: document.querySelector('#file-info-message'),
  fileName: document.querySelector('#file-name'),
  status: document.querySelector('#status'),
  hint: document.querySelector('#hint'),
  busyOverlay: document.querySelector('#busy-overlay'),
  busyTitle: document.querySelector('#busy-title'),
  busyMessage: document.querySelector('#busy-message'),
  repairReportOverlay: document.querySelector('#repair-report-overlay'),
  repairReportClose: document.querySelector('#repair-report-close'),
  repairReportTitle: document.querySelector('#repair-report-title'),
  repairReportSummary: document.querySelector('#repair-report-summary'),
  repairReportMetrics: document.querySelector('#repair-report-metrics'),
  repairReportWarningBox: document.querySelector('#repair-report-warning-box'),
  repairReportWarningTitle: document.querySelector('#repair-report-warning-title'),
  repairReportWarnings: document.querySelector('#repair-report-warnings'),
  emptyState: document.querySelector('#empty-state'),
  inspector: document.querySelector('#inspector'),
  panelTitle: document.querySelector('#panel-title'),
  panelDescription: document.querySelector('#panel-description'),
  selectForm: document.querySelector('#select-form'),
  selectionMode: document.querySelector('#selection-mode'),
  pushPullForm: document.querySelector('#pushpull-form'),
  pushPullDistance: document.querySelector('#pushpull-distance'),
  pushPullVisualHandle: document.querySelector('#pushpull-visual-handle'),
  pushPullVisualHelp: document.querySelector('#pushpull-visual-help'),
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
  coneForm: document.querySelector('#cone-form'),
  coneInfo: document.querySelector('#cone-info'),
  coneDiameter: document.querySelector('#cone-diameter'),
  coneHeight: document.querySelector('#cone-height'),
  coneAxis: document.querySelector('#cone-axis'),
  coneOperation: document.querySelector('#cone-operation'),
  coneOffsetInputs: [
    document.querySelector('#cone-offset-x'),
    document.querySelector('#cone-offset-y'),
    document.querySelector('#cone-offset-z'),
  ],
  applyCone: document.querySelector('#apply-cone'),
  pyramidForm: document.querySelector('#pyramid-form'),
  pyramidInfo: document.querySelector('#pyramid-info'),
  pyramidWidth: document.querySelector('#pyramid-width'),
  pyramidDepth: document.querySelector('#pyramid-depth'),
  pyramidHeight: document.querySelector('#pyramid-height'),
  pyramidAxis: document.querySelector('#pyramid-axis'),
  pyramidOperation: document.querySelector('#pyramid-operation'),
  pyramidOffsetInputs: [
    document.querySelector('#pyramid-offset-x'),
    document.querySelector('#pyramid-offset-y'),
    document.querySelector('#pyramid-offset-z'),
  ],
  applyPyramid: document.querySelector('#apply-pyramid'),
  gearForm: document.querySelector('#gear-form'),
  gearInfo: document.querySelector('#gear-info'),
  gearTeeth: document.querySelector('#gear-teeth'),
  gearModule: document.querySelector('#gear-module'),
  gearWidth: document.querySelector('#gear-width'),
  gearBore: document.querySelector('#gear-bore'),
  gearHubDiameter: document.querySelector('#gear-hub-diameter'),
  gearHubWidth: document.querySelector('#gear-hub-width'),
  gearBacklash: document.querySelector('#gear-backlash'),
  gearQuality: document.querySelector('#gear-quality'),
  gearAxis: document.querySelector('#gear-axis'),
  gearOperation: document.querySelector('#gear-operation'),
  gearOffsetInputs: [
    document.querySelector('#gear-offset-x'),
    document.querySelector('#gear-offset-y'),
    document.querySelector('#gear-offset-z'),
  ],
  applyGear: document.querySelector('#apply-gear'),
  planeForm: document.querySelector('#plane-form'),
  planeInfo: document.querySelector('#plane-info'),
  planeShape: document.querySelector('#plane-shape'),
  planeAxis: document.querySelector('#plane-axis'),
  planeWidth: document.querySelector('#plane-width'),
  planeDepth: document.querySelector('#plane-depth'),
  planeOffsetInputs: [
    document.querySelector('#plane-offset-x'),
    document.querySelector('#plane-offset-y'),
    document.querySelector('#plane-offset-z'),
  ],
  applyPlane: document.querySelector('#apply-plane'),
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
  shortenForm: document.querySelector('#shorten-form'),
  shortenInfo: document.querySelector('#shorten-info'),
  shortenAxis: document.querySelector('#shorten-axis'),
  shortenLength: document.querySelector('#shorten-length'),
  shortenCenter: document.querySelector('#shorten-center'),
  shortenWholeModel: document.querySelector('#shorten-whole-model'),
  shortenReadout: document.querySelector('#shorten-readout'),
  applyShorten: document.querySelector('#apply-shorten'),
  splitForm: document.querySelector('#split-form'),
  splitInfo: document.querySelector('#split-info'),
  splitAxis: document.querySelector('#split-axis'),
  splitPosition: document.querySelector('#split-position'),
  splitCap: document.querySelector('#split-cap'),
  splitSeparate: document.querySelector('#split-separate'),
  splitReadout: document.querySelector('#split-readout'),
  applySplit: document.querySelector('#apply-split'),
  exportSplitNegative: document.querySelector('#export-split-negative'),
  exportSplitPositive: document.querySelector('#export-split-positive'),
  hollowForm: document.querySelector('#hollow-form'),
  hollowInfo: document.querySelector('#hollow-info'),
  hollowThickness: document.querySelector('#hollow-thickness'),
  hollowReadout: document.querySelector('#hollow-readout'),
  applyHollow: document.querySelector('#apply-hollow'),
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
  alignFaceGround: document.querySelector('#align-face-ground'),
  rotateFaceDown: document.querySelector('#rotate-face-down'),
  centerOrigin: document.querySelector('#center-origin'),
  scaleMaxAxis: document.querySelector('#scale-max-axis'),
  scaleMaxValue: document.querySelector('#scale-max-value'),
  scaleToMax: document.querySelector('#scale-to-max'),
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
  objectsToggle: document.querySelector('#objects-toggle'),
  objectsDrawer: document.querySelector('#objects-drawer'),
  objectsClose: document.querySelector('#objects-close'),
  objectsList: document.querySelector('#objects-list'),
  objectsCount: document.querySelector('#objects-count'),
  patternDrawer: document.querySelector('#pattern-drawer'),
  patternClose: document.querySelector('#pattern-close'),
  patternTarget: document.querySelector('#pattern-target'),
  patternType: document.querySelector('#pattern-type'),
  patternCount: document.querySelector('#pattern-count'),
  patternLinearFields: document.querySelector('#pattern-linear-fields'),
  patternCircularFields: document.querySelector('#pattern-circular-fields'),
  patternOffsetInputs: [
    document.querySelector('#pattern-x'),
    document.querySelector('#pattern-y'),
    document.querySelector('#pattern-z'),
  ],
  patternRadius: document.querySelector('#pattern-radius'),
  patternAxis: document.querySelector('#pattern-axis'),
  patternReadout: document.querySelector('#pattern-readout'),
  applyPattern: document.querySelector('#apply-pattern'),
  historyToggle: document.querySelector('#history-toggle'),
  historyDrawer: document.querySelector('#history-drawer'),
  historyClose: document.querySelector('#history-close'),
  historyList: document.querySelector('#history-list'),
  historyCount: document.querySelector('#history-count'),
};

function setStatus(message) {
  ui.status.textContent = t(message);
}

function localizedNumber(value) {
  return Number(value).toLocaleString(currentLanguage === 'en' ? 'en-US' : 'it-IT');
}

function localizedDecimal(value, digits = 1) {
  return Number(value).toLocaleString(currentLanguage === 'en' ? 'en-US' : 'it-IT', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function complexityLabel(level) {
  const labels = currentLanguage === 'en'
    ? { light: 'Light', medium: 'Medium', large: 'Large', 'very-large': 'Very large' }
    : { light: 'Leggero', medium: 'Medio', large: 'Grande', 'very-large': 'Molto grande' };
  return labels[level] ?? labels.light;
}

function largeModelMessage(info = currentModelInfo) {
  if (!info?.isLarge) {
    return currentLanguage === 'en'
      ? 'Local model. Performance depends on RAM, GPU and triangle count.'
      : 'Modello locale. Le prestazioni dipendono da RAM, GPU e numero di triangoli.';
  }
  return currentLanguage === 'en'
    ? 'Large file loaded locally. The view stays available, but edges, booleans and some analyses may be simplified to keep the app responsive.'
    : "File grande caricato localmente. La vista resta disponibile, ma bordi, booleane e alcune analisi possono essere semplificate per mantenere l'app reattiva.";
}

function loadedModelStatus(name, info = currentModelInfo) {
  const summary = currentLanguage === 'en'
    ? `${name} opened. Interpreted units: millimeters. ${complexityLabel(info?.level)}: ${localizedNumber(info?.triangles ?? 0)} triangles.`
    : `${name} aperto. Unita interpretata: millimetri. ${complexityLabel(info?.level)}: ${localizedNumber(info?.triangles ?? 0)} triangoli.`;
  return info?.isLarge ? `${summary} ${largeModelMessage(info)}` : summary;
}

function renderFileInfo() {
  if (!ui.fileInfoButton || !ui.fileComplexityBadge || !ui.fileInfoDetails) return;
  const info = currentModelInfo;
  ui.fileInfoButton.disabled = !info;
  ui.fileComplexityBadge.hidden = !info;
  ui.fileInfoPopover.hidden = ui.fileInfoPopover.hidden || !info;

  if (!info) {
    ui.fileComplexityBadge.textContent = '';
    ui.fileInfoDetails.replaceChildren();
    ui.fileInfoMessage.textContent = '';
    ui.fileInfoButton.setAttribute('aria-expanded', 'false');
    return;
  }

  ui.fileComplexityBadge.className = `file-complexity-badge complexity-${info.level}`;
  ui.fileComplexityBadge.textContent = complexityLabel(info.level);
  ui.fileInfoTitle.textContent = currentLanguage === 'en' ? 'Model information' : 'Informazioni modello';

  const sizeText = info.fileSizeBytes > 0
    ? `${localizedDecimal(info.fileSizeMb, info.fileSizeMb >= 10 ? 0 : 1)} MB`
    : currentLanguage === 'en' ? 'Not available' : 'Non disponibile';
  const rows = [
    [currentLanguage === 'en' ? 'Class' : 'Classe', complexityLabel(info.level)],
    [currentLanguage === 'en' ? 'Size' : 'Dimensione', sizeText],
    [currentLanguage === 'en' ? 'Triangles' : 'Triangoli', localizedNumber(info.triangles)],
    [currentLanguage === 'en' ? 'Vertices' : 'Vertici', localizedNumber(info.vertices)],
  ];
  const details = document.createElement('dl');
  for (const [label, value] of rows) {
    const term = document.createElement('dt');
    term.textContent = label;
    const description = document.createElement('dd');
    description.textContent = value;
    details.append(term, description);
  }
  ui.fileInfoDetails.replaceChildren(details);
  ui.fileInfoMessage.textContent = largeModelMessage(info);
}

const languageText = {
  it: {
    title: 'Forma3D - Editor STL',
    open: 'Apri STL',
    remove: 'Rimuovi modello',
    options: 'Opzioni',
    help: 'Help',
    language: 'Lingua',
    repair: 'Ripara mesh',
    openProject: 'Apri progetto',
    saveProject: 'Salva progetto',
    export: 'Esporta STL',
    exportObj: 'Esporta OBJ',
    exportSelection: 'Esporta selezione',
    select: 'Seleziona',
    pushpull: 'Spingi/Tira',
    solids: 'Solidi',
    booleans: 'Booleane',
    twoD: '2D',
    box: 'Box',
    cylinder: 'Cilindro',
    cone: 'Cono',
    pyramid: 'Piramide',
    gear: 'Ingranaggio',
    text: 'Testo 3D',
    cut: 'Sottrai',
    shorten: 'Accorcia',
    split: 'Separa',
    hollow: 'Svuota',
    hole: 'Foro',
    movehole: 'Sposta foro',
    line: 'Linea',
    plane: 'Piani',
    measure: 'Misura',
    transform: 'Trasforma',
    orbit: 'Orbita',
    pan: 'Panoramica',
    zoomfit: 'Inquadra',
    objects: 'Oggetti',
    history: 'Storia',
  },
  en: {
    title: 'Forma3D - STL Editor',
    open: 'Open STL',
    remove: 'Remove model',
    options: 'Options',
    help: 'Help',
    language: 'Language',
    repair: 'Repair mesh',
    openProject: 'Open project',
    saveProject: 'Save project',
    export: 'Export STL',
    exportObj: 'Export OBJ',
    exportSelection: 'Export selection',
    select: 'Select',
    pushpull: 'Push/Pull',
    solids: 'Solids',
    booleans: 'Booleans',
    twoD: '2D',
    box: 'Box',
    cylinder: 'Cylinder',
    cone: 'Cone',
    pyramid: 'Pyramid',
    gear: 'Gear',
    text: '3D Text',
    cut: 'Subtract',
    shorten: 'Shorten',
    split: 'Split',
    hollow: 'Hollow',
    hole: 'Hole',
    movehole: 'Move hole',
    line: 'Line',
    plane: 'Planes',
    measure: 'Measure',
    transform: 'Transform',
    orbit: 'Orbit',
    pan: 'Pan',
    zoomfit: 'Zoom fit',
    objects: 'Objects',
    history: 'History',
  },
};

const staticTranslations = {
  en: {
    'Modello senza titolo': 'Untitled model',
    'Nessun modello': 'No model',
    Strumenti: 'Tools',
    'Seleziona (Spazio)': 'Select (Space)',
    'Spingi/Tira (P)': 'Push/Pull (P)',
    Solidi: 'Solids',
    'Cilindro (C)': 'Cylinder (C)',
    'Cono (V)': 'Cone (V)',
    'Piramide (I)': 'Pyramid (I)',
    'Ingranaggio (K)': 'Gear (K)',
    'Testo 3D (A)': '3D Text (A)',
    'Operazioni booleane': 'Boolean operations',
    'Sottrai solido (T)': 'Subtract solid (T)',
    'Accorcia / taglia (X)': 'Shorten / cut (X)',
    'Taglia e separa': 'Cut and split',
    'Svuota modello (U)': 'Hollow model (U)',
    'Foro (H)': 'Hole (H)',
    'Sposta foro (F)': 'Move hole (F)',
    'Strumenti 2D': '2D tools',
    'Linea (L)': 'Line (L)',
    'Piani (N)': 'Planes (N)',
    'Misura (M)': 'Measure (M)',
    'Trasforma (G)': 'Transform (G)',
    'Orbita (O)': 'Orbit (O)',
    Panoramica: 'Pan',
    'Inquadra tutto': 'Zoom to fit',
    Oggetti: 'Objects',
    Storia: 'History',
    'Pannello oggetti': 'Objects panel',
    'Pannello storia': 'History panel',
    'Pattern object': 'Pattern object',
    MODEL: 'MODEL',
    HISTORY: 'HISTORY',
    PATTERN: 'PATTERN',
    Objects: 'Objects',
    History: 'History',
    Duplicate: 'Duplicate',
    'connected bodies': 'connected bodies',
    actions: 'actions',
    'No bodies': 'No bodies',
    'No changes': 'No changes',
    'Nessun corpo': 'No bodies',
    'Nessuna modifica': 'No changes',
    'Nome oggetto': 'Object name',
    'Select an object from Objects.': 'Select an object from Objects.',
    'Tipo copia': 'Copy type',
    Lineare: 'Linear',
    Circolare: 'Circular',
    'Numero copie': 'Number of copies',
    'Distanza X': 'Distance X',
    'Distanza Y': 'Distance Y',
    'Distanza Z': 'Distance Z',
    Raggio: 'Radius',
    'Crea copie leggere del corpo selezionato e le aggiunge al modello.': 'Creates lightweight copies of the selected body and adds them to the model.',
    'Crea pattern': 'Create pattern',
    'Seleziona un oggetto da Oggetti.': 'Select an object from Objects.',
    'Scegli un oggetto dal pannello Oggetti prima di creare un pattern.': 'Choose an object from the Objects panel before creating a pattern.',
    "Opzioni Duplica aperte per l'oggetto selezionato.": 'Duplicate options opened for the selected object.',
    'Non riesco a leggere il corpo selezionato.': 'I cannot read the selected body.',
    'Inserisci un raggio valido per il pattern circolare.': 'Enter a valid radius for the circular pattern.',
    'Inserisci almeno una distanza X/Y/Z diversa da zero.': 'Enter at least one X/Y/Z distance different from zero.',
    'Il pattern non ha prodotto geometria valida.': 'The pattern did not produce valid geometry.',
    Select: 'Select',
    Pattern: 'Pattern',
    Export: 'Export',
    Delete: 'Delete',
    'Area di modellazione 3D': '3D modeling area',
    'Viste modello': 'Model views',
    Chiudi: 'Close',
    'Annulla (Ctrl+Z)': 'Undo (Ctrl+Z)',
    'Ripristina (Ctrl+Y)': 'Redo (Ctrl+Y)',
    'Modifica': 'Change',
    'Snapshot mesh': 'Mesh snapshot',
    'Stato corrente': 'Current state',
    'Sottrazione': 'Subtraction',
    'Creata Box': 'Box created',
    'Creato Cilindro': 'Cylinder created',
    'Creato Cono': 'Cone created',
    'Creata Piramide': 'Pyramid created',
    'Creato Ingranaggio': 'Gear created',
    'Creato Piano': 'Plane created',
    'Creato foro': 'Hole created',
    'Spostato foro': 'Hole moved',
    'Spingi/Tira': 'Push/Pull',
    'Accorciato modello': 'Model shortened',
    'Tagliato modello': 'Model split',
    'Creato pattern': 'Pattern created',
    'Svuotato modello': 'Model hollowed',
    'Riparata mesh': 'Mesh repaired',
    'Trasformato corpo': 'Body transformed',
    'Cancellato oggetto': 'Object deleted',
    'Cancellata superficie': 'Surface deleted',
    'Aggiunto testo': 'Text added',
    'Inciso testo': 'Text engraved',
    diametro: 'diameter',
    altezza: 'height',
    asse: 'axis',
    base: 'base',
    denti: 'teeth',
    modulo: 'module',
    spessore: 'thickness',
    cilindro: 'cylinder',
    profondita: 'depth',
    delta: 'delta',
    rimosso: 'removed',
    centro: 'center',
    copie: 'copies',
    scala: 'scale',
    'Aumenta valore': 'Increase value',
    'Diminuisci valore': 'Decrease value',
    'Apri un file STL': 'Open an STL file',
    'oppure prova subito sul blocco di esempio': 'or start with the example block',
    'Clic sinistro: seleziona · Rotellina premuta: orbita · Rotellina: zoom · Tasto destro: panoramica': 'Left click: select · Middle drag: orbit · Wheel: zoom · Right button: pan',
    'Guida rapida': 'Quick guide',
    'Comandi base': 'Basic commands',
    HELP: 'HELP',
    'Comandi rapidi': 'Quick commands',
    'I comandi principali restano sempre locali nel browser. Usa mouse e scorciatoie per modellare piu velocemente.': 'Core commands stay local in the browser. Use mouse controls and shortcuts to model faster.',
    Selezione: 'Selection',
    'Click singolo seleziona una faccia. Doppio click seleziona il corpo intero.': 'Single click selects a face. Double-click selects the whole body.',
    Navigazione: 'Navigation',
    'Rotellina premuta orbita, rotellina zooma, tasto destro fa panoramica.': 'Middle drag orbits, the wheel zooms, right button pans.',
    'Modifica rapida': 'Quick edit',
    'Canc elimina selezione o anteprima. Ctrl+Z annulla, Ctrl+Y ripristina.': 'Delete removes the selection or preview. Ctrl+Z undoes, Ctrl+Y redoes.',
    'Seleziona una faccia, inserisci una distanza oppure trascina la sfera visuale.': 'Select a face, enter a distance or drag the visual sphere.',
    'Il pannello Oggetti permette selezione, rinomina, esportazione e cancellazione dei corpi.': 'The Objects panel lets you select, rename, export and delete bodies.',
    "Lavora sul corpo selezionato. Attiva Applica a tutto il file per tagliare l'intera mesh.": 'Works on the selected body. Enable Apply to whole file to cut the full mesh.',
    'Click: seleziona una faccia.': 'Click: select a face.',
    'Doppio click: seleziona il corpo.': 'Double-click: select the body.',
    'Canc: elimina la selezione.': 'Delete: removes the selection.',
    'Rotellina premuta: orbita. Tasto destro: panoramica.': 'Middle drag: orbit. Right button: pan.',
    ALTO: 'TOP',
    FRONTE: 'FRONT',
    STRUMENTO: 'TOOL',
    Seleziona: 'Select',
    SELEZIONE: 'SELECTION',
    'Modalita selezione': 'Selection mode',
    Faccia: 'Face',
    Oggetto: 'Object',
    'Click singolo': 'Single click',
    'Doppio click': 'Double click',
    'Seleziona una faccia del modello.': 'Select a model face.',
    "Seleziona l'intero corpo cliccato.": 'Select the clicked whole body.',
    "Faccia seleziona una superficie. Oggetto seleziona l'intero solido.": 'Face selects one surface. Object selects the clicked body.',
    'Faccia seleziona una superficie. Oggetto seleziona il corpo cliccato.': 'Face selects one surface. Object selects the clicked body.',
    'Clicca una superficie del modello per selezionarla.': 'Click a model surface to select it.',
    'Clicca una superficie. Usa la rotellina premuta per orbitare.': 'Click a surface. Hold the wheel button to orbit.',
    'Click singolo seleziona una faccia. Doppio click seleziona il corpo cliccato.': 'Single click selects a face. Double-click selects the clicked body.',
    'Select: click singolo per una faccia, doppio click per il corpo.': 'Select: single click for a face, double-click for the body.',
    'Seleziona una faccia singola o passa a Oggetto per prendere tutto il solido.': 'Select a single face, or switch to Object to pick the clicked body.',
    'Seleziona una faccia singola o passa a Oggetto per prendere il corpo cliccato.': 'Select a single face, or switch to Object to pick the clicked body.',
    'Modalita faccia: clicca una superficie del modello.': 'Face mode: click a model surface.',
    "Modalita oggetto: clicca il solido per selezionarlo tutto.": 'Object mode: click a body to select it.',
    'Modalita oggetto: clicca un corpo per selezionarlo.': 'Object mode: click a body to select it.',
    'Nessuna superficie': 'No surface',
    'Nessun oggetto': 'No object',
    'Clicca una superficie del modello.': 'Click a model surface.',
    "Clicca il solido per selezionarlo tutto.": 'Click a body to select it.',
    'Clicca un corpo per selezionarlo.': 'Click a body to select it.',
    'Oggetto selezionato': 'Object selected',
    'Intero solido selezionato. Canc lo rimuove, Trasforma lo modifica.': 'Selected body. Delete removes it; Transform edits it.',
    'Corpo selezionato. Canc lo rimuove, Trasforma lo modifica.': 'Selected body. Delete removes it; Transform edits it.',
    facce: 'faces',
    'Il punto blu indica il centro del foro.': 'The blue point marks the hole center.',
    'La zona blu verra spostata lungo la sua normale.': 'The blue region will move along its normal.',
    'Punto del foro selezionato.': 'Hole point selected.',
    'Superficie selezionata.': 'Surface selected.',
    'Seleziona una superficie da cancellare, oppure passa a Oggetto per togliere tutto.': 'Select a surface to delete, or switch to Object to remove the clicked body.',
    'Seleziona una superficie da cancellare, oppure passa a Oggetto per togliere un corpo.': 'Select a surface to delete, or switch to Object to remove a body.',
    "Seleziona l'oggetto da cancellare.": 'Select the object to delete.',
    'Seleziona una superficie da cancellare, oppure usa Rimuovi modello per togliere tutto.': 'Select a surface to delete, or use Remove model to clear everything.',
    "Oggetto cancellato. Usa Ctrl+Z per ripristinarlo.": 'Object deleted. Use Ctrl+Z to restore it.',
    'Prima clicca una superficie piana.': 'Click a flat surface first.',
    'In modalita Oggetto puoi cancellare o trasformare il solido. Per Spingi/Tira passa a Faccia.': 'In Object mode you can delete or transform the solid. For Push/Pull, switch to Face.',
    'Blocco di esempio pronto. Prova Spingi/Tira o Foro.': 'Example block ready. Try Push/Pull or Hole.',
    'Modifica ripristinata.': 'Change restored.',
    Lunghezza: 'Length',
    'Clicca il primo punto.': 'Click the first point.',
    'Nessun punto selezionato': 'No point selected',
    'Clicca una superficie per impostare centro e direzione.': 'Click a surface to set center and direction.',
    'Il foro parte dal punto scelto e procede dentro il pezzo.': 'The hole starts from the picked point and goes into the part.',
    'Nessun foro selezionato': 'No hole selected',
    'Clicca la parete interna del foro.': 'Click the inner wall of the hole.',
    'Dopo aver scelto il foro, clicca il nuovo centro sulla piastra.': 'After choosing the hole, click the new center on the plate.',
    'Crea foro': 'Create hole',
    Distanza: 'Distance',
    'Valore positivo: tira. Valore negativo: spingi.': 'Positive value: pull. Negative value: push.',
    'Controllo visuale': 'Visual control',
    'Seleziona una faccia e trascina la sfera. Shift aggancia a 1 mm, Esc annulla.': 'Select a face and drag the sphere. Shift snaps to 1 mm, Esc cancels.',
    'Trascina la sfera: Shift aggancia a 1 mm, Esc annulla.': 'Drag the sphere: Shift snaps to 1 mm, Esc cancels.',
    'Anteprima Spingi/Tira:': 'Push/Pull preview:',
    'Spingi/Tira visuale annullato.': 'Visual Push/Pull canceled.',
    'Spingi/Tira visuale: distanza troppo piccola, nessuna modifica.': 'Visual Push/Pull: distance too small, no change.',
    'Preview semplificata per mesh grande: rilascio per applicare.': 'Simplified preview for large mesh: release to apply.',
    'Applica Spingi/Tira': 'Apply Push/Pull',
    'Spingi/Tira': 'Push/Pull',
    'Clicca una superficie piana, inserisci la distanza e applica.': 'Click a flat surface, enter the distance, and apply.',
    'Spingi/Tira: clicca la faccia da allargare o restringere.': 'Push/Pull: click the face to expand or shrink.',
    'Spingi/Tira: clicca una superficie piana.': 'Push/Pull: click a flat surface.',
    'Centro foro': 'Hole center',
    'Clicca una faccia: il foro entra lungo la normale della superficie.': 'Click a face: the hole follows the surface normal.',
    'Diametro foro': 'Hole diameter',
    'Profondita foro': 'Hole depth',
    'Asse bloccato': 'Locked axis',
    'Applica foro': 'Apply hole',
    Foro: 'Hole',
    'Clicca una superficie per impostare il centro, poi regola diametro, profondita e offset.': 'Click a surface to set the center, then adjust diameter, depth and offset.',
    'Foro: clicca il centro sulla superficie. Verde = anteprima del taglio.': 'Hole: click the center on the surface. Green = cut preview.',
    Ricomincia: 'Restart',
    'Foro da spostare': 'Hole to move',
    'Foro riconosciuto': 'Recognized hole',
    'Clicca la parete interna del foro da spostare.': 'Click the inner wall of the hole to move.',
    'Nuovo centro': 'New center',
    'Sposta foro': 'Move hole',
    'Sposta il foro': 'Move the hole',
    'Clicca la parete interna del foro, poi scegli il nuovo centro sulla piastra.': 'Click the inner wall of the hole, then choose the new center on the plate.',
    'Sposta foro: prima clicca dentro il foro, poi clicca la nuova posizione.': 'Move hole: first click inside the hole, then click the new position.',
    'Punto base': 'Base point',
    'Punto di appoggio': 'Base point',
    'Clicca dove vuoi appoggiare il parallelepipedo.': 'Click where you want to place the box.',
    'Si aggancia a vertici vicini o alla griglia da 1 mm.': 'Snaps to nearby vertices or the 1 mm grid.',
    "Il punto cliccato e' il centro della base. Arancione sottrae, verde somma.": 'The clicked point is the base center. Orange subtracts, green adds.',
    'Clicca dove vuoi appoggiare il cilindro.': 'Click where you want to place the cylinder.',
    'Clicca dove vuoi appoggiare il cono.': 'Click where you want to place the cone.',
    'Clicca dove vuoi appoggiare la piramide.': 'Click where you want to place the pyramid.',
    "Clicca dove vuoi appoggiare l'ingranaggio.": 'Click where you want to place the gear.',
    'Clicca dove vuoi creare il piano.': 'Click where you want to create the plane.',
    'Clicca dove vuoi appoggiare il testo.': 'Click where you want to place the text.',
    'Clicca punti, vertici o punti medi. Le guide restano finche premi Ricomincia.': 'Click points, vertices or midpoints. Guides stay until you press Restart.',
    "guide e": 'guides and',
    "facce in bozza. Clicca un punto per iniziare un'altra linea.": 'draft faces. Click a point to start another line.',
    Operazione: 'Operation',
    'Somma al solido': 'Add to solid',
    'Sottrai dal solido': 'Subtract from solid',
    'Larghezza X': 'Width X',
    'Profondita Y': 'Depth Y',
    'Altezza Z': 'Height Z',
    'Spostamento X': 'Offset X',
    'Spostamento Y': 'Offset Y',
    'Spostamento Z': 'Offset Z',
    'Applica box': 'Apply box',
    Parallelepipedo: 'Box',
    'Clicca il punto di appoggio, regola le misure e scegli se sommare o sottrarre dal solido.': 'Click the base point, adjust dimensions, and choose whether to add or subtract from the solid.',
    'Parallelepipedo: clicca sul piano o su una faccia. Anteprima arancione = nuovo solido.': 'Box: click the work plane or a face. Orange preview = new solid.',
    'Parallelepipedo: clicca il punto di appoggio, poi regola misure e somma/sottrai.': 'Box: click the base point, then adjust dimensions and add/subtract.',
    'Parallelepipedo impostato. Regola misure, spostamenti e operazione.': 'Box set. Adjust dimensions, offsets and operation.',
    'Clicca il punto di appoggio del parallelepipedo.': 'Click the box base point.',
    'Centro base': 'Base center',
    'Asse su faccia usa la normale della superficie cliccata.': 'Face axis uses the clicked surface normal.',
    Asse: 'Axis',
    'Asse della faccia': 'Face axis',
    'Asse Z': 'Z axis',
    'Asse X': 'X axis',
    'Asse Y': 'Y axis',
    Diametro: 'Diameter',
    'Diametro base': 'Base diameter',
    'Altezza / profondita': 'Height / depth',
    Altezza: 'Height',
    'Applica cilindro': 'Apply cylinder',
    'Clicca il centro di appoggio, scegli asse, diametro, altezza e operazione booleana.': 'Click the base center, choose axis, diameter, height and boolean operation.',
    'Cilindro: clicca dove appoggiare il centro. Puoi sommare o sottrarre.': 'Cylinder: click where to place the center. You can add or subtract.',
    'Cilindro: clicca il centro di appoggio, poi regola diametro, altezza e asse.': 'Cylinder: click the base center, then adjust diameter, height and axis.',
    'Cilindro impostato. Regola diametro, altezza, asse e operazione.': 'Cylinder set. Adjust diameter, height, axis and operation.',
    'Clicca il centro di appoggio del cilindro.': 'Click the cylinder base center.',
    'Applica cono': 'Apply cone',
    Cono: 'Cone',
    'Clicca il centro della base, scegli asse, diametro, altezza e operazione booleana.': 'Click the base center, choose axis, diameter, height and boolean operation.',
    'Cono: clicca il centro base, poi regola diametro, altezza e asse.': 'Cone: click the base center, then adjust diameter, height and axis.',
    'Cono impostato. Regola diametro, altezza, asse e operazione.': 'Cone set. Adjust diameter, height, axis and operation.',
    'Clicca il centro di appoggio del cono.': 'Click the cone base center.',
    'La base rettangolare resta centrata sul punto scelto.': 'The rectangular base stays centered on the picked point.',
    'Base X': 'Base X',
    'Base Y': 'Base Y',
    'Applica piramide': 'Apply pyramid',
    Piramide: 'Pyramid',
    'Clicca il centro della base, regola base, altezza, asse e operazione booleana.': 'Click the base center, then adjust base, height, axis and boolean operation.',
    'Piramide: clicca il centro base, poi regola base X, base Y e altezza.': 'Pyramid: click the base center, then adjust base X, base Y and height.',
    'Piramide impostata. Regola base, altezza, asse e operazione.': 'Pyramid set. Adjust base, height, axis and operation.',
    'Clicca il centro di appoggio della piramide.': 'Click the pyramid base center.',
    'Profilo a denti dritti semplificato, pensato per stampa 3D.': 'Simplified spur gear profile for 3D printing.',
    'Profilo semplificato e aggiunto senza booleane per evitare blocchi del browser.': 'Simplified profile added without booleans to avoid browser freezes.',
    Modalita: 'Mode',
    'Aggiungi come corpo separato': 'Add as separate body',
    'Numero denti': 'Teeth',
    Modulo: 'Module',
    Spessore: 'Width',
    'Foro centrale': 'Center bore',
    'Diametro mozzo': 'Hub diameter',
    'Altezza mozzo': 'Hub height',
    Gioco: 'Backlash',
    Qualita: 'Quality',
    Bassa: 'Low',
    Media: 'Medium',
    Alta: 'High',
    "Il gioco riduce l'ampiezza angolare dei denti: non e' un profilo involuta industriale.": 'Backlash narrows tooth angles: this is not an industrial involute profile.',
    "Il gioco riduce l'ampiezza angolare dei denti. Per stabilita, il massimo e' 80 denti.": 'Backlash narrows tooth angles. For stability, the maximum is 80 teeth.',
    'Applica ingranaggio': 'Apply gear',
    Ingranaggio: 'Gear',
    'Crea un ingranaggio cilindrico a denti dritti con foro centrale e mozzo opzionale.': 'Create a simplified spur gear with center bore and optional hub.',
    'Ingranaggio: clicca il centro base, poi regola denti, modulo, spessore e foro.': 'Gear: click the base center, then adjust teeth, module, width and bore.',
    'Ingranaggio impostato. Regola denti, modulo, foro, mozzo e operazione.': 'Gear set. Adjust teeth, module, bore, hub and operation.',
    'Ingranaggio impostato. Regola denti, modulo, foro e mozzo; verra aggiunto senza booleane.': 'Gear set. Adjust teeth, module, bore and hub; it will be added without booleans.',
    "Clicca il centro di appoggio dell'ingranaggio.": 'Click the gear base center.',
    'Il numero denti deve essere tra 6 e 80.': 'Teeth must be between 6 and 80.',
    "L'ingranaggio e troppo dettagliato per il browser: riduci denti o qualita.": 'This gear is too detailed for the browser: reduce teeth or quality.',
    'Creazione ingranaggio in corso...': 'Creating gear...',
    'Ingranaggio aggiunto come corpo separato.': 'Gear added as a separate body.',
    'Centro piano': 'Plane center',
    "Il piano e' una faccia piatta: usa Spingi/Tira per darle volume.": 'The plane is a flat face: use Push/Pull to give it volume.',
    'Forma piano': 'Plane shape',
    Rettangolo: 'Rectangle',
    Quadrato: 'Square',
    Tondo: 'Circle',
    'Piano della faccia': 'Face plane',
    'Piano XY': 'XY plane',
    'Piano YZ': 'YZ plane',
    'Piano XZ': 'XZ plane',
    'Larghezza / diametro': 'Width / diameter',
    'Applica piano': 'Apply plane',
    Piani: 'Planes',
    'Crea rettangoli, quadrati o tondi piatti da usare come facce di partenza.': 'Create flat rectangles, squares or circles to use as starting faces.',
    'Piani: clicca centro e forma. Poi usa Spingi/Tira per dare volume.': 'Planes: click center and shape. Then use Push/Pull to add volume.',
    'Piani: clicca il centro della faccia piatta.': 'Planes: click the center of the flat face.',
    'Piano impostato. Scegli forma, dimensioni e asse, poi applica.': 'Plane set. Choose shape, dimensions and axis, then apply.',
    'Imposta prima centro, forma e dimensioni del piano.': 'Set the plane center, shape and dimensions first.',
    'Applicazione piano in corso...': 'Applying plane...',
    'Piano applicato al modello.': 'Plane applied to the model.',
    'Piano applicato e selezionato. Usa Spingi/Tira per dargli volume.': 'Plane applied and selected. Use Push/Pull to give it volume.',
    'Faccia piana selezionata. Puoi usare subito Spingi/Tira.': 'Flat face selected. You can use Push/Pull immediately.',
    'Figura da sottrarre': 'Shape to subtract',
    'Scegli forma e clicca dove vuoi togliere materiale.': 'Choose a shape and click where you want to remove material.',
    'Anteprima arancione: volume che verra rimosso dallo STL.': 'Orange preview: volume that will be removed from the STL.',
    Forma: 'Shape',
    'Box / parallelepipedo': 'Box',
    Cilindro: 'Cylinder',
    'Asse cilindro': 'Cylinder axis',
    'Entra nella faccia cliccata': 'Enter the clicked face',
    'Profondita taglio': 'Cut depth',
    'Per scavare dentro una faccia, clicca la faccia e usa gli offset per centrare il taglio.': 'To carve into a face, click the face and use offsets to center the cut.',
    'Sottrai dallo STL': 'Subtract from STL',
    'Sottrai solido': 'Subtract solid',
    'Crea un box o un cilindro di taglio e sottrailo dal file STL caricato.': 'Create a box or cylinder cutting tool and subtract it from the loaded STL.',
    "Sottrai: clicca sull'STL o sul piano, regola la figura arancione e applica.": 'Subtract: click the STL or work plane, adjust the orange shape and apply.',
    'Sottrai: scegli box o cilindro, clicca il punto e applica il taglio.': 'Subtract: choose box or cylinder, click the point and apply the cut.',
    'Sottrai: clicca il punto in cui piazzare la figura di taglio.': 'Subtract: click where to place the cutting shape.',
    'Figura di sottrazione impostata. Regola dimensioni e spostamenti, poi applica.': 'Subtraction shape set. Adjust dimensions and offsets, then apply.',
    'Taglio modello': 'Model cut',
    'Accorcia il modello con un piano di taglio e richiudi la superficie.': 'Shorten the model with a cutting plane and cap the cut surface.',
    'Seleziona un oggetto, poi accorcialo con un piano di taglio e richiudi la superficie.': 'Select an object, then shorten it with a cutting plane and cap the cut surface.',
    'Accorcia tutto il file con un piano di taglio e richiudi la superficie.': 'Shorten the whole file with a cutting plane and cap the cut surface.',
    'Taglio oggetto': 'Object cut',
    'Applica a tutto il file': 'Apply to whole file',
    "Il taglio non scala l'oggetto: sposta il volume arancione e decide automaticamente se richiudere al centro o tagliare un lato.": 'The cut does not scale the object: move the orange volume and it automatically decides whether to close the middle or cut one side.',
    'Seleziona prima un oggetto con doppio click, poi usa Accorcia.': 'Select an object with double-click first, then use Shorten.',
    'Accorcia applicato a tutto il file.': 'Shorten applied to the whole file.',
    'tutto file': 'whole file',
    oggetto: 'object',
    'Il taglio non scala il modello: sposta il volume arancione e decide automaticamente se richiudere al centro o tagliare un lato.': 'The cut does not scale the model: move the orange volume and it automatically decides whether to close the middle or cut one side.',
    'Asse taglio': 'Cut axis',
    'Lunghezza da rimuovere': 'Length to remove',
    'Centro taglio': 'Cut center',
    'Il volume arancione indica la parte rimossa. Se tocca un bordo diventa un taglio laterale.': 'The orange volume marks the removed section. If it touches an edge, it becomes a side cut.',
    'Applica taglio': 'Apply cut',
    'Accorcia': 'Shorten',
    'Taglia lungo X, Y o Z scegliendo lunghezza rimossa e centro del taglio. Utile per ridurre profondita o lunghezza di STL funzionali.': 'Cut along X, Y or Z by choosing removed length and cut center. Useful for reducing depth or length of functional STLs.',
    'Seleziona un oggetto, poi taglialo lungo X, Y o Z scegliendo lunghezza rimossa e centro del taglio.': 'Select an object, then cut it along X, Y or Z by choosing removed length and cut center.',
    'Accorcia: scegli asse, lunghezza rimossa e centro taglio, poi applica.': 'Shorten: choose axis, removed length and cut center, then apply.',
    'Accorcia: seleziona un oggetto con doppio click, poi scegli asse, lunghezza e centro taglio.': 'Shorten: double-click an object, then choose axis, length and cut center.',
    'Accorcia: regola asse, lunghezza rimossa e centro taglio.': 'Shorten: adjust axis, removed length and cut center.',
    'Accorcia: seleziona un oggetto con doppio click, poi regola asse, lunghezza e centro taglio.': 'Shorten: double-click an object, then adjust axis, length and cut center.',
    'Accorcia: rimuove la sezione mediana, riavvicina le estremita e salda i vertici coincidenti.': 'Shorten: removes the middle section, closes the gap and welds coincident vertices.',
    'Accorcia: il taglio tocca un bordo, quindi mantiene il lato opposto e richiude la sezione.': 'Shorten: the cut touches an edge, so it keeps the opposite side and caps the section.',
    'Taglio applicato. La mesh e stata richiusa dove possibile.': 'Cut applied. The mesh was capped where possible.',
    'Sezione mediana rimossa. Le due parti sono state riavvicinate e saldate dove possibile.': 'Middle section removed. The two parts were closed together and welded where possible.',
    'Taglio laterale applicato. Il lato opposto e stato mantenuto.': 'Side cut applied. The opposite side was kept.',
    'Apri o crea un modello prima di usare Accorcia.': 'Open or create a model before using Shorten.',
    'Taglio in corso...': 'Cutting...',
    'Sto tagliando la mesh e richiudendo la superficie.': 'Cutting the mesh and capping the surface.',
    'Taglio non riuscito: prova un asse diverso o una lunghezza meno vicina al bordo.': 'Cut failed: try a different axis or a length less close to the edge.',
    'Imposta un taglio valido.': 'Set a valid cut.',
    Separa: 'Split',
    'Taglia il modello con un piano e opzionalmente separa le due meta.': 'Cut the model with a plane and optionally separate the two halves.',
    'Utile per dividere pezzi troppo grandi da stampare. Le due meta possono essere esportate separatamente.': 'Useful for splitting parts that are too large to print. The two halves can be exported separately.',
    'Asse piano': 'Plane axis',
    'Posizione taglio': 'Cut position',
    'Chiudi superfici tagliate': 'Cap cut surfaces',
    'Separa in due corpi': 'Separate into two bodies',
    'La linea blu indica il piano di taglio.': 'The blue line marks the cutting plane.',
    'Export lato negativo': 'Export negative side',
    'Export lato positivo': 'Export positive side',
    'Taglia il modello con un piano, chiude le superfici tagliate ed esporta le due meta se serve.': 'Cut the model with a plane, cap cut surfaces and export the two halves if needed.',
    'Separa: scegli asse e posizione del piano. Blu = taglio, arancione = separazione.': 'Split: choose axis and plane position. Blue = cut, orange = separation.',
    'Separa: scegli asse e posizione, poi applica o esporta i due lati.': 'Split: choose axis and position, then apply or export both sides.',
    'Apri o crea un modello prima di usare Separa.': 'Open or create a model before using Split.',
    'La posizione taglio deve essere una coordinata valida.': 'Cut position must be a valid coordinate.',
    'Le superfici tagliate saranno chiuse.': 'Cut surfaces will be capped.',
    'Le superfici tagliate restano aperte.': 'Cut surfaces stay open.',
    'Il taglio non ha prodotto una meta esportabile.': 'The cut did not produce an exportable half.',
    'Sto generando le due meta del modello.': 'Generating both model halves.',
    'Il taglio non ha prodotto due meta valide.': 'The cut did not produce two valid halves.',
    'Il taglio non ha prodotto geometria.': 'The cut did not produce geometry.',
    'Modello tagliato e separato in due corpi.': 'Model cut and separated into two bodies.',
    'Modello tagliato. Le due meta sono rimaste nella posizione originale.': 'Model cut. The two halves stayed in the original position.',
    'Taglio non riuscito: prova una posizione piu interna o abilita la chiusura superfici.': 'Cut failed: try a more internal position or enable surface capping.',
    'Guscio modello': 'Model shell',
    'Svuota il modello mantenendo la superficie esterna e creando una parete interna.': 'Hollow the model by keeping the outside surface and creating an inner wall.',
    'Funziona meglio su mesh chiuse e pulite. Dettagli piu piccoli dello spessore possono auto-intersecarsi.': 'Works best on closed, clean meshes. Details smaller than the wall thickness may self-intersect.',
    'Spessore parete': 'Wall thickness',
    'Crea un guscio mesh-first. Fori di drenaggio e svuota-corpo selezionato sono previsti per una fase successiva.': 'Creates a mesh-first shell. Drain holes and hollow selected body are planned for a later phase.',
    'Svuota modello': 'Hollow model',
    Svuota: 'Hollow',
    'Svuota il modello intero impostando lo spessore parete. Mantiene la superficie esterna e crea una superficie interna invertita.': 'Hollow the whole model by setting wall thickness. It keeps the outer surface and creates an inverted inner surface.',
    'Svuota: inserisci lo spessore parete e applica al modello intero.': 'Hollow: enter wall thickness and apply it to the whole model.',
    'Svuota: imposta lo spessore parete e applica al modello intero.': 'Hollow: set wall thickness and apply it to the whole model.',
    'Apri o crea un modello prima di usare Svuota.': 'Open or create a model before using Hollow.',
    'Lo spessore deve essere maggiore di 0 mm.': 'Wall thickness must be greater than 0 mm.',
    'Svuotamento in corso...': 'Hollowing...',
    'Sto creando la superficie interna e le pareti dei bordi aperti.': 'Creating the inner surface and walls for open boundaries.',
    'Mesh grande: lo svuotamento puo richiedere tempo e puo creare auto-intersezioni sui dettagli piccoli.': 'Large mesh: hollowing may take time and can create self-intersections on small details.',
    'Svuotamento completato': 'Hollow completed',
    'bordi aperti chiusi con pareti laterali': 'open edges closed with side walls',
    'Svuotamento non riuscito: prova uno spessore minore o ripara la mesh prima di riprovare.': 'Hollow failed: try a smaller thickness or repair the mesh before retrying.',
    'Lo svuotamento non ha prodotto geometria.': 'Hollow did not produce geometry.',
    'Apri o crea un modello prima di riparare la mesh.': 'Open or create a model before repairing the mesh.',
    'Riparazione mesh...': 'Repairing mesh...',
    'Analizzo bordi aperti, saldo vertici vicini, rimuovo triangoli difettosi e chiudo piccoli buchi planari.': 'Analyzing open edges, welding nearby vertices, removing bad triangles and closing small planar holes.',
    'La riparazione non ha prodotto una mesh valida. Usa Annulla o riapri il file originale.': 'Repair did not produce a valid mesh. Use Undo or reopen the original file.',
    'Non riesco a riparare questa mesh.': 'I cannot repair this mesh.',
    Guide: 'Guides',
    'Clicca punti, vertici e punti medi per creare linee guida e facce.': 'Click points, vertices and midpoints to create guides and faces.',
    'Le linee sono elementi di costruzione: gli altri strumenti possono agganciarsi a estremi, midpoint e segmenti.': 'Lines are construction elements: other tools can snap to endpoints, midpoints and segments.',
    'Piano disegno': 'Drawing plane',
    'Auto 3D': '3D auto',
    'XY orizzontale': 'Horizontal XY',
    'XZ verticale': 'Vertical XZ',
    'YZ verticale': 'Vertical YZ',
    'Aggancia assi e parallele': 'Snap axes and parallels',
    'Auto 3D aggancia i punti reali anche su piani diversi. Quando le guide chiudono un contorno, la faccia appare in verde.': '3D auto snaps real points across planes. When guides close an outline, the face appears in green.',
    'Applica facce': 'Apply faces',
    'Nuova linea': 'New line',
    Linea: 'Line',
    'Traccia guide 3D indipendenti. Quando chiudono un contorno, nasce anche una faccia applicabile al modello.': 'Draw independent 3D guides. When they close an outline, a face can also be applied to the model.',
    'Linea: gli altri strumenti si agganciano a estremi, midpoint e segmenti delle guide.': 'Line: other tools snap to endpoints, midpoints and guide segments.',
    'Linea: crea guide indipendenti. Gli altri strumenti si agganciano a estremi, midpoint e segmenti.': 'Line: create independent guides. Other tools snap to endpoints, midpoints and segments.',
    'Linea: clicca il primo punto della sagoma.': 'Line: click the first point of the outline.',
    'Punto inizio testo': 'Text start point',
    "Il punto cliccato e' l'angolo basso sinistro del testo.": 'The clicked point is the lower-left corner of the text.',
    Testo: 'Text',
    Font: 'Font',
    Bold: 'Bold',
    Corsivo: 'Italic',
    'Sottrai / incidi nel solido': 'Subtract / engrave into solid',
    "Scrivendo o cambiando valori l'anteprima si aggiorna in tempo reale.": 'The preview updates live while typing or changing values.',
    'Altezza lettere': 'Letter height',
    Profondita: 'Depth',
    'Larghezza lettere': 'Letter width',
    'Smusso bordo': 'Edge bevel',
    'Rotazione Z': 'Z rotation',
    'Applica testo 3D': 'Apply 3D text',
    'Testo 3D': '3D Text',
    'Clicca il punto di partenza, scrivi il testo e regola font, profondita, larghezza ed effetti.': 'Click the start point, type the text, and adjust font, depth, width and effects.',
    'Testo: clicca il punto basso sinistro, poi modifica il pannello a destra.': 'Text: click the lower-left point, then edit the right panel.',
    'Testo: clicca il punto basso sinistro, poi scrivi e regola profondita e font.': 'Text: click the lower-left point, then type and adjust depth and font.',
    'Testo: clicca il punto basso sinistro in cui appoggiarlo.': 'Text: click the lower-left point where it should rest.',
    'Modello intero': 'Whole model',
    'Trasforma la mesh corrente': 'Transform the current mesh',
    'Le modifiche vengono applicate ai vertici, quindi restano compatibili con STL e booleane successive.': 'Changes are applied to vertices, so they remain compatible with STL and later booleans.',
    'Corpo selezionato': 'Selected body',
    'Trasforma il corpo corrente': 'Transform the current body',
    'Doppio click su un corpo, poi sposta, ruota o scala solo quella parte.': 'Double-click a body, then move, rotate or scale only that part.',
    'Sposta X': 'Move X',
    'Sposta Y': 'Move Y',
    'Sposta Z': 'Move Z',
    'Ruota X': 'Rotate X',
    'Ruota Y': 'Rotate Y',
    'Ruota Z': 'Rotate Z',
    'Scala uniforme': 'Uniform scale',
    'Appoggia faccia selezionata': 'Place selected face on bed',
    'Ruota faccia in basso': 'Rotate face downward',
    'Centra su origine': 'Center on origin',
    'Scala max asse': 'Max scale axis',
    'Dimensione massima': 'Maximum size',
    'Scala alla dimensione': 'Scale to size',
    'Rotazione e scala avvengono attorno al centro del modello.': 'Rotation and scale happen around the model center.',
    'La preview wireframe si aggiorna in tempo reale. Dopo Applica i valori tornano a zero/scala 1.': 'The wireframe preview updates live. After Apply, values reset to zero/scale 1.',
    'Applica trasformazione': 'Apply transform',
    Trasforma: 'Transform',
    "Sposta, ruota o scala l'intero modello applicando la trasformazione ai vertici STL.": 'Move, rotate or scale the whole model by applying the transform to STL vertices.',
    'Trasforma: inserisci spostamento, rotazione o scala e applica.': 'Transform: enter translation, rotation or scale and apply.',
    'Trasforma: inserisci valori e applica al modello.': 'Transform: enter values and apply them to the model.',
    "Sposta, ruota o scala l'oggetto selezionato applicando la trasformazione ai vertici STL.": 'Move, rotate or scale the selected object by applying the transform to STL vertices.',
    'Trasforma: doppio click su un corpo, poi inserisci spostamento, rotazione o scala.': 'Transform: double-click a body, then enter translation, rotation or scale.',
    "Trasforma: seleziona un corpo e applica i valori all'oggetto.": 'Transform: select a body and apply the values to the object.',
    'Seleziona un oggetto con doppio click prima di trasformarlo.': 'Double-click an object before transforming it.',
    'Apri un modello o seleziona un corpo prima di trasformare.': 'Open a model or select a body before transforming.',
    'Seleziona una faccia, poi apri Trasforma per usare questo comando.': 'Select a face, then open Transform to use this command.',
    'La faccia selezionata non ha una normale valida.': 'The selected face has no valid normal.',
    'faccia appoggiata al piano': 'face placed on bed',
    'faccia ruotata in basso': 'face rotated downward',
    'Faccia selezionata appoggiata al piano Z=0.': 'Selected face placed on the Z=0 bed.',
    'Faccia selezionata ruotata verso il basso.': 'Selected face rotated downward.',
    'centrato su origine': 'centered on origin',
    'Oggetto centrato su origine X/Y.': 'Object centered on X/Y origin.',
    'Inserisci una dimensione massima valida.': 'Enter a valid maximum size.',
    'Misure': 'Measurements',
    'Distanza tra i punti': 'Distance between points',
    'Nuova misura': 'New measurement',
    'Asse X': 'X axis',
    'Asse Y': 'Y axis',
    'Asse Z': 'Z axis',
    Misura: 'Measure',
    'Misura: clicca il primo punto.': 'Measure: click the first point.',
    'Clicca due punti sul modello. La distanza viene scomposta sugli assi X, Y e Z.': 'Click two points on the model. The distance is split across X, Y and Z axes.',
    'Misura: clicca il primo punto, poi il secondo. Rosso X, verde Y, blu Z.': 'Measure: click the first point, then the second. Red X, green Y, blue Z.',
    Totale: 'Total',
    Orbita: 'Orbit',
    'Trascina con il tasto sinistro per ruotare la vista.': 'Drag with the left button to rotate the view.',
    'Orbita: trascina per guardare il modello da ogni lato.': 'Orbit: drag to view the model from every side.',
    Panoramica: 'Pan',
    'Trascina con il tasto sinistro per spostare la vista.': 'Drag with the left button to pan the view.',
    'Panoramica: trascina per spostare il foglio di lavoro.': 'Pan: drag to move the workspace.',
    'Panoramica: trascina per spostare la vista.': 'Pan: drag to move the view.',
    'Annulla': 'Cancel',
    'Ripristina': 'Redo',
    Pronto: 'Ready',
  },
};

function t(source) {
  const translations = staticTranslations[currentLanguage];
  return translations?.[source] ?? source;
}

function translateStaticText(language) {
  const translations = staticTranslations[language];
  const elements = document.querySelectorAll([
    '.tool-form label',
    '.tool-form button',
    '.tool-form option',
    '.tool-form small',
    '.tool-form strong',
    '.hole-readout span',
    '.hole-readout strong',
    '.hole-readout small',
    '#empty-state strong',
    '#empty-state span',
    '#hint',
    '.view-cube button',
    '.eyebrow',
    '.measure-total span',
    '.measure-total strong',
    '.axis-measure span',
    '#measure-axis-summary',
    '.measurement label',
    '.secondary-button',
    '.history-actions button',
    '#selection-info span',
    '#selection-info strong',
    '.help-popover h2',
    '.help-popover h3',
    '.help-popover p',
    '.objects-drawer-heading strong',
    '.objects-drawer-summary span',
    '.pattern-drawer .eyebrow',
    '.pattern-drawer strong',
    '.pattern-panel label',
    '.pattern-panel button',
    '.pattern-panel option',
    '.pattern-panel small',
    '.history-drawer-heading strong',
    '.history-drawer-summary span',
    '#status',
  ].join(','));
  elements.forEach((element) => {
    if (element.matches('label') && element.querySelector('input')) {
      let textNode = Array.from(element.childNodes).find((node) => (
        node.nodeType === Node.TEXT_NODE && node.textContent.trim()
      ));
      if (!textNode) {
        textNode = document.createTextNode('');
        element.append(textNode);
      }
      if (!element.dataset.i18nSource) element.dataset.i18nSource = textNode.textContent.trim();
      const source = element.dataset.i18nSource;
      textNode.textContent = ` ${translations?.[source] ?? source}`;
      return;
    }
    if (!element.dataset.i18nSource) element.dataset.i18nSource = element.textContent.trim();
    const source = element.dataset.i18nSource;
    element.textContent = translations?.[source] ?? source;
  });
}

function translateAttributes(language) {
  const translations = staticTranslations[language];
  document.querySelectorAll('[title], [aria-label]').forEach((element) => {
    if (element.hasAttribute('title')) {
      if (!element.dataset.i18nTitleSource) element.dataset.i18nTitleSource = element.getAttribute('title');
      const source = element.dataset.i18nTitleSource;
      element.setAttribute('title', translations?.[source] ?? source);
    }
    if (element.hasAttribute('aria-label')) {
      if (!element.dataset.i18nAriaLabelSource) element.dataset.i18nAriaLabelSource = element.getAttribute('aria-label');
      const source = element.dataset.i18nAriaLabelSource;
      element.setAttribute('aria-label', translations?.[source] ?? source);
    }
  });
}

function setText(selector, value) {
  const element = document.querySelector(selector);
  if (element) element.textContent = value;
}

function setToolText(tool, value) {
  document.querySelectorAll(`[data-tool="${tool}"]`).forEach((element) => {
    const label = element.querySelector('span');
    if (label) label.textContent = value;
    else element.textContent = value;
  });
}

function setButtonHtml(selector, icon, value, withCaret = false) {
  const element = document.querySelector(selector);
  if (!element) return;
  element.innerHTML = icon
    ? `<span class="button-icon">${icon}</span> ${value}`
    : `${value}${withCaret ? ' <span class="menu-caret" aria-hidden="true">›</span>' : ''}`;
}

function applyLanguage(language) {
  const dictionary = languageText[language] ?? languageText.it;
  currentLanguage = dictionary === languageText.en ? 'en' : 'it';
  document.documentElement.lang = language;
  document.title = dictionary.title;
  localStorage.setItem('forma3d-language', language);
  ui.languageSelect.value = language;
  ui.languageSelect.querySelector('option[value="en"]').textContent = '🇬🇧 English';
  ui.languageSelect.querySelector('option[value="it"]').textContent = '🇮🇹 Italiano';
  translateStaticText(language);
  translateAttributes(language);
  setButtonHtml('#open-file', 'O', dictionary.open);
  setButtonHtml('#remove-model', 'X', dictionary.remove);
  setButtonHtml('#options-menu-button', '', dictionary.options, true);
  setButtonHtml('#help-button', '?', dictionary.help);
  setText('label[for="language-select"]', dictionary.language);
  setButtonHtml('#repair-model', 'R', dictionary.repair);
  setButtonHtml('#open-project', 'P', dictionary.openProject);
  setButtonHtml('#save-project', 'S', dictionary.saveProject);
  setButtonHtml('#export-file', 'E', dictionary.export);
  setButtonHtml('#export-obj', 'O', dictionary.exportObj);
  setButtonHtml('#export-selection', 'X', dictionary.exportSelection);
  setText('[data-menu-label="solids"]', dictionary.solids);
  setText('[data-menu-label="booleans"]', dictionary.booleans);
  setText('[data-menu-label="twoD"]', dictionary.twoD);
  [
    'select',
    'pushpull',
    'box',
    'cylinder',
    'cone',
    'pyramid',
    'gear',
    'text',
    'cut',
    'shorten',
    'split',
    'hollow',
    'hole',
    'movehole',
    'line',
    'plane',
    'measure',
    'transform',
    'orbit',
    'pan',
    'zoomfit',
  ].forEach((tool) => setToolText(tool, dictionary[tool]));
  setText('#objects-toggle span', dictionary.objects);
  setText('#history-toggle span', dictionary.history);
  if (!model) ui.fileName.textContent = t('Nessun modello');
  renderFileInfo();
  renderObjectsDrawer();
  renderPatternDrawer();
  renderHistoryDrawer();
  updateInspector();
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
  ui.busyTitle.textContent = t(title);
  ui.busyMessage.textContent = t(message);
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

if (ui.pushPullVisualHandle) {
  ui.pushPullVisualHandle.checked = localStorage.getItem(PUSH_PULL_VISUAL_STORAGE_KEY) === 'true';
  ui.pushPullVisualHelp.hidden = !ui.pushPullVisualHandle.checked;
}

function createExample() {
  const geometry = new THREE.BoxGeometry(80, 55, 25).toNonIndexed();
  geometry.translate(0, 0, 12.5);
  setModelGeometry(geometry, false);
  ui.fileName.textContent = currentFileName;
  fitView();
  setStatus('Blocco di esempio pronto. Prova Spingi/Tira o Foro.');
}

function clearSelection() {
  clearPushPullHandle();
  selected = null;
  if (highlight) {
    scene.remove(highlight);
    disposeObject(highlight);
    highlight = null;
    requestRender();
  }
  ui.selectionLabel.textContent = selectionMode === 'object' ? t('Nessun oggetto') : t('Nessuna superficie');
  ui.selectionDetail.textContent = selectionMode === 'object'
    ? t('Clicca un corpo per selezionarlo.')
    : t('Clicca una superficie del modello.');
  ui.measureValue.value = '-- mm';
  updateModelActions();
  renderObjectsDrawer();
}

function updateMeasureBoxMode() {
  const isSketchLengthMode = activeTool === 'line';
  const canEditSketchLength = isSketchLengthMode && sketchPoints.length > 0 && !sketchClosed;
  ui.measureLabel.textContent = isSketchLengthMode ? t('Lunghezza') : t('Misure');
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
  conePreview = null;
  pyramidPreview = null;
  cutPreview = null;
  shortenPreview = null;
  textPreview = null;
  transformPreview = null;
  sketchPreview = null;
  snapIndicator = null;
  if (pushPullHandleFrameRequest) {
    cancelAnimationFrame(pushPullHandleFrameRequest);
    pushPullHandleFrameRequest = 0;
  }
  if (pushPullHandleDrag) controls.enabled = pushPullHandleDrag.controlsEnabled;
  pushPullHandle = null;
  pushPullHandlePreview = null;
  pushPullHandleDrag = null;
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
    ui.measureAxisSummary.textContent = t('Clicca il primo punto.');
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
  ui.holeCreateInfo.textContent = t('Nessun punto selezionato');
  ui.holeCreateAxis.textContent = t('Clicca una superficie per impostare centro e direzione.');
  ui.holeCreateHelp.textContent = t('Il foro parte dal punto scelto e procede dentro il pezzo.');
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
  ui.moveHoleInfo.textContent = t('Nessun foro selezionato');
  ui.moveHoleAxis.textContent = t('Clicca la parete interna del foro.');
  ui.moveHoleHelp.textContent = t('Dopo aver scelto il foro, clicca il nuovo centro sulla piastra.');
  ui.moveHoleInputs.forEach((input) => {
