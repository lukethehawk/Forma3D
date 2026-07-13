# Development Diary - Forma3D

Last updated: 2026-07-10

This document is the technical memory of Forma3D. Read it together with
`README.md` before making changes, especially when touching mesh logic, tool
state, selection, booleans, snapping or export.

> Italian version / historical notes continue below after the English primary
> section.

## Current Operating Notes - 2026-07-10

Recent work consolidated Forma3D as an STL mesh editor with separate face and
connected-body workflows:

- English is the primary UI and documentation language; Italian remains
  selectable in the app and documented below.
- `Options` contains language selection, `Repair mesh`, project open/save, STL
  export, OBJ export and selection export; the adjacent `Help` button opens the
  detailed command popup.
- `Select` uses single click for planar face selection and double click for the
  clicked connected body.
- Object selection no longer selects the whole STL mesh. It uses
  `findConnectedComponent()` from the clicked triangle and selects only that
  connected island.
- `Delete` on an object removes only that body, not the whole model.
- `Transform` automatically switches to Object mode and edits only the selected
  body. If a face was selected, it is converted to the connected body first.
  Transform also exposes quick print-prep actions: place selected face on bed,
  rotate selected face downward, center on X/Y origin and scale to max X/Y/Z.
- Newly applied 2D planes are immediately selected as faces, so Push/Pull can be
  used right away.
- Selection overlays are deliberately strong: selected faces use saturated blue
  fill and wireframe; selected objects use a highlighted bounding box, thick
  edges and corner markers.
- `fitView()` uses camera FOV and a safety margin, so the first created object is
  centered without being excessively zoomed.
- Gear creation was made browser-safe: gears no longer use heavy booleans, are
  appended as separate bodies, are capped at 80 teeth, and use debounced preview.
- Forma3D now has a local project format: `.forma3d.json` stores metadata,
  camera, connected-body metadata, construction guides and triangle geometry.
- Export paths now include sanitized file names, full-model STL, full-model OBJ
  and STL export for the selected face/body.
- The left toolbar ends with an `Objects` button. It opens a compact,
  scrollable drawer with connected bodies, rename, select, pattern, export and
  delete. Pattern opens a side drawer for linear/circular duplication.
- The file name in the topbar now opens a model-info popover with file size,
  triangles, vertices and complexity class. Very large meshes defer automatic
  connected-body analysis to keep import responsive.

Working rule agreed with the user: after a complete change, if checks pass,
commit and push to GitHub unless explicitly told not to.

## Project Goal

Forma3D is a local and web STL editor for users who know SketchUp-like
workflows and want practical edits to 3D-printing models without uploading files
to external services.

The project does not try to rebuild a full parametric CAD model from STL. STL is
a triangle mesh, so the app focuses on practical mesh operations:

- STL import/export.
- `.forma3d.json` project save/open for local state.
- 3D view with orbit, pan, zoom and quick views.
- Planar face selection as connected coplanar regions.
- Connected body selection by double click.
- Compact `Objects` drawer for connected bodies.
- Push/Pull on planar regions and 2D planes.
- Cylindrical holes with preview and numeric offsets.
- Simple cylindrical hole recognition and relocation.
- Solid primitives: box, cylinder, cone, pyramid, gear and 3D text.
- Boolean operations: subtract, hole, move hole and text engraving.
- `Shorten`: direct X/Y/Z plane cut for reducing STL length/depth without
  scaling, with side cut or middle-section removal and gap closing.
- `Split`: whole-model plane cut for printer-bed preparation, with cap option,
  optional separation gap and negative/positive side export.
- 2D planes: rectangle, square and circle, ready for Push/Pull.
- Line guides for construction and closed faces.
- Measurements with signed X/Y/Z components.
- Undo/redo.
- Remove current model.
- `Delete` for previews, guides, selected faces and selected bodies.
- STL/OBJ full export and STL selection export.

## Technical Stack

- Runtime: Node.js.
- Bundler/dev server: Vite.
- Desktop shell: Electron.
- 3D rendering: Three.js.
- Camera controls: Three.js `OrbitControls`.
- STL/OBJ: `STLLoader`, `STLExporter` and `OBJExporter`.
- Mesh booleans: `three-bvh-csg`.
- Tests: `node --test`.
- Web deploy: GitHub Actions + GitHub Pages, publishing `dist`.

Important commands:

```bash
npm install
npm test
npm run build
npm run dev
npm start
```

On PowerShell, use `npm.cmd` if Windows execution policy blocks `npm.ps1`.

## Repository Structure

- `index.html`: UI markup for topbar, toolbar, viewport, inspector and status.
- `src/style.css`: compact desktop-style application UI.
- `src/main.parts/*.js`: real main controller source split into manageable
  parts.
- `src/main.js`: generated by `scripts/assemble-main.cjs`; do not edit by hand.
- `src/geometry.js`: mesh operations, connected components, repair, display
  edges, Push/Pull, plane cuts and selection helpers.
- `src/primitives.js`: box, cylinder, cone, pyramid, gear, 2D planes, polygon
  extrusion and 3D text geometry.
- `src/hole-detection.js`: simple cylindrical hole detection.
- `src/snapping.js`: grid, point, axis and direction snapping.
- `src/measurement.js`: distance and axis components.
- `src/number-format.js`: comma/dot decimal parsing and formatting.
- `test/*.test.js`: unit tests for pure logic.
- `electron/main.cjs`: Electron desktop window.
- `Avvia Forma3D.bat`: Windows launcher.

## Important Rule: `src/main.js`

`src/main.js` is generated. Any main-controller change must be made in
`src/main.parts/main.partXX.js`. The commands `npm run dev`, `npm run build` and
`npm start` assemble `src/main.js` first.

If a build error points to `src/main.js`, find the matching block in
`src/main.parts/` and edit the part file.

## UI Navigation

The vertical toolbar is grouped:

- direct tools: `Select`, `Push/Pull`, `Measure`, `Transform`, view navigation;
- `Solids`: `Box`, `Cylinder`, `Cone`, `Pyramid`, `Gear`, `3D Text`;
- `Booleans`: `Subtract`, `Shorten`, `Split`, `Hollow`, `Hole`, `Move hole`;
- `2D`: `Line`, `Planes`, `Joint`.
- bottom drawer button: `Objects`.

Submenus open to the right with hover/focus. Tool buttons keep `data-tool`, so
`setTool(tool)` and keyboard shortcuts remain independent from the visual menu
layout.

`Objects` is not a modeling tool and does not use `data-tool`. It opens a slim
left drawer inside the viewport. The list is scrollable and each connected body
row supports rename, select, pattern, STL export and delete. Pattern opens a
second side drawer next to Objects instead of occupying the main inspector.

The topbar keeps `Open STL` and `Remove model` as primary actions. The
dedicated `Help` button opens a command popup with icon cards for selection,
navigation, editing, Push/Pull, Objects and Shorten. `Options` contains:

- language selection;
- `Repair mesh`;
- `Open project`;
- `Save project`;
- `Export STL`;
- `Export OBJ`;
- `Export selection`.

Language is stored in `localStorage` as `forma3d-language`. Static labels are
translated through `staticTranslations`; topbar/tool names come from
`languageText`. Any new UI text should be added to translations immediately to
avoid mixed-language screens.

## Runtime Model

Core controller state:

- `model`: main Three.js mesh.
- `edges`: display edges from `createDisplayEdgesGeometry()`.
- `highlight`: current blue selection overlay.
- `selected`: either `{ type: 'face', point, normal, region }` or
  `{ type: 'object', point, triangles }`.
- `selectionMode`: internal `face`/`object` state used by tools such as
  Transform; the Select inspector shows instructions, not a visible mode
  dropdown.
- `activeTool`: current tool.
- `currentFileName`: export base name.
- `sourceStlName`: original STL/project source name stored in project files.
- `objectItems`: connected-body metadata rebuilt from geometry components.
- `objectNames`: body names restored from project files where possible.
- `undoStack` / `redoStack`: cloned `BufferGeometry` snapshots.
- `snapPoints`: structural vertices, midpoints and face centers.
- temporary tool states: hole, move hole, primitives, cut, text, sketch and
  measurement.

Automatic selection transitions:

- single click in `Select`: force face selection;
- double click: force object selection;
- entering `Transform`: switch to object mode;
- after applying a 2D plane: switch to face mode and select the new plane face.

## Rendering and Camera

The scene uses Z-up (`camera.up.set(0, 0, 1)`). The grid is rotated to represent
the XY plane. Rendering is on demand through `requestRender()`, not a continuous
loop, to reduce CPU/GPU load.

`fitView()` calculates distance using the model bounding box, vertical FOV,
horizontal FOV and a safety margin. This prevents the first object from filling
the entire screen while keeping it centered.

Display edges are generated only under `MAX_EDGE_TRIANGLES`. Coplanar
triangulation diagonals are hidden while real creases and useful open contours
remain visible.

## STL Import, Project Format and Export

`openStl(file)` parses STL, centers the mesh in X/Y, moves minimum Z to zero,
clears history, calls `setModelGeometry()` and fits the view.

`modelComplexityInfo(file, geometry)` classifies the current model:

- Light: under 50k triangles.
- Medium: 50k to 250k triangles.
- Large: 250k to 1M triangles.
- Very large: above 1M triangles.

Forma3D does not impose a fixed upload/import limit because STL files are
handled locally. Performance depends on RAM, GPU and triangle count. The topbar
file-name popover shows size, triangles, vertices and class. For meshes above
1M triangles, `refreshObjectItems()` defers `collectConnectedComponents()` so
opening the file does not immediately run a costly component analysis.

Project files are local JSON documents with extension `.forma3d.json`. Version
1 stores:

- `version`, `name`, `units`, `sourceStlName`, `currentFileName`, `savedAt`;
- camera position, target and up vector;
- connected-body names and triangle counts;
- construction guide edges/faces;
- geometry as a flat triangle position array.

The project format is intentionally simple and local-first. It is not a
parametric CAD history; it restores the current mesh/editor state.

`exportStl()` writes binary STL as `<sanitized-name>-modified.stl`.
`exportObj()` writes OBJ as `<sanitized-name>-modified.obj`.
`exportSelection()` extracts the selected face/body triangles and writes a
selection STL. The `Objects` drawer can also export a single connected body as
STL.

`sanitizeFileBase()` removes accents, spaces and unsafe characters so downloads
are predictable across browsers and operating systems.

STL has no unit metadata; Forma3D treats units as millimeters.

## Mesh Repair

`repairCurrentMesh()` runs `repairMeshGeometry()` on the whole model:

- weld nearby coincident vertices;
- remove degenerate triangles;
- remove duplicate triangles;
- propagate triangle orientation along shared edges;
- orient closed components outward when possible;
- conservatively planarize vertices near large almost-flat faces;
- detect boundary loops and distinguish closed loops from open/branched chains;
- conservatively close only small planar boundary loops;
- report remaining open boundaries, non-manifold edges, connected components and
  warnings.

Repair is conservative. It can close a simple missing planar face, such as a
small hole in an otherwise coherent STL, but it skips large, non-planar,
branched, ambiguous or open-sheet boundaries. It does not attempt complex
self-intersection repair, global remeshing, voxelization, severe non-manifold
repair or CAD reconstruction.

The implementation is original JavaScript/Three.js code under Forma3D's MIT
license. ADMesh, MeshFix, MeshLab, MeshLabJS and CGAL are useful conceptual
references for terminology and expected workflows, but their GPL/AGPL/LGPL code
is not copied, translated, ported or derived here.

After `Repair mesh`, the UI keeps the existing busy overlay during processing
and opens a compact report dialog with triangles/vertices before and after,
welded vertices, removed triangles, filled holes, added triangles, remaining
boundary loops, non-manifold edges, components and warnings. The status bar
shows the short version of the same report.

## Face and Object Selection

Face selection:

1. raycast the mesh;
2. take `faceIndex`;
3. call `findCoplanarRegion()`;
4. create a strong blue face overlay;
5. save `selected.type = 'face'`.

Object selection:

1. raycast the mesh;
2. take the clicked triangle;
3. call `findConnectedComponent()`;
4. compute a bounding box for that triangle island;
5. create a strong blue object overlay;
6. save `selected.type = 'object'`.

This matters because appended primitive bodies, gears and other separate shells
can live inside the same STL mesh.

## Connected Body Metadata

`refreshObjectItems()` calls `collectConnectedComponents(model.geometry)` and
stores every connected triangle island in `objectItems`. This metadata layer is
used by project save/open, selection export and the compact `Objects` drawer.
For very large meshes, `currentModelInfo.skipConnectedComponents` prevents this
automatic scan during import; the drawer shows that object analysis was
deferred.

Since STL has no persistent object IDs, names are index-based and may shift
after destructive topology changes. Future iterations should replace
index-based names with stable body IDs.

## Push/Pull

`applyPushPull(distance)` requires a face selection.

- Normal STL planar faces and isolated 2D planes use direct mesh Push/Pull.
- 2D profiles sitting on an existing coplanar STL face can create a local boolean
  cutter/addition volume.
- The optional visual sphere control is stored in `localStorage` as
  `forma3d-pushpull-visual-handle`. It only appears while `activeTool ===
  'pushpull'`, the toggle is enabled and `selected.type === 'face'`.

For open 2D faces, `pushPullGeometry()` creates the missing side walls so a flat
face becomes a prism.

Visual Push/Pull does not modify the real mesh during drag. It displays a
separate draggable sphere along `selected.normal`, converts pointer movement into a
signed distance, updates the numeric distance field and previews with
`createPushPullRegionGeometry()`. `Shift` snaps the distance to 1 mm and `Esc`
cancels the drag. On large models over 250k triangles, or selected regions over
20k triangles, the preview is simplified to sphere + distance/status so the app
does not block. On pointer release it calls the existing `applyPushPull()` once,
so undo remains a single snapshot and the numeric workflow stays unchanged.

## Delete

`Delete` behavior:

1. clear active preview/tool state if present;
2. delete selected face triangles;
3. delete selected connected body triangles;
4. otherwise show a status message.

Deleting faces may leave open holes. That is intentional for direct mesh editing.

## Primitives and Booleans

Primitive generation lives in `src/primitives.js`.

Most solids can use add/subtract operations. Gear is the exception: it is added
as a separate body for browser stability.

Gear details:

- simplified spur gear profile, not a full industrial involute;
- 6-80 teeth;
- module, width, center bore, optional hub, backlash and quality;
- debounced preview;
- triangle-count guard before applying.

2D planes are real flat STL faces. After applying a plane, the new face is
selected immediately for Push/Pull.

The `Joint` tool also lives in `2D`. It creates mechanical fit profiles from
presets (`arc`, `dovetail`, `t-slot`) through `createJointProfileGeometry()` in
`src/primitives.js`. It can output:

- a flat 2D face, selected immediately for Push/Pull;
- an extruded add body;
- an extruded subtract cutter.

The `rotationDeg` option rotates the local 2D profile before it is mapped to
the picked plane, so preview and final geometry keep the same orientation on
horizontal, vertical and face-aligned placements.

This is deliberately preset-based for now. It does not replace a freeform arc
sketcher; it covers common tabs, slots and keyed interfaces with predictable
parameters.

### Shorten / Plane Cut

`Shorten` targets functional STLs that need to become shorter without scaling.
It lives in the `Booleans` menu but does not use CSG: it calls
`cutPlaneGeometry()` in `src/geometry.js`.

The default UI expects a selected connected body. Shorten extracts that body with
`extractTrianglesFromGeometry()`, computes its bounding box, applies the cut to
that isolated geometry, then recombines it with the untouched remainder via
`combineGeometries()`. The `Apply to whole file` checkbox intentionally restores
the older whole-mesh workflow: `shortenUsesWholeModel()` switches the target box
to `model.geometry.boundingBox` and applies the cut directly to the full current
mesh. This is useful after a previous cut has split one functional part into
multiple connected components. The cut window is computed as
`[center - length / 2, center + length / 2]` on the selected axis. If that window
stays inside the target bounding box, Shorten uses the middle-section workflow
and closes the gap. If the window touches or crosses an edge, Shorten
automatically turns it into a side cut and keeps the opposite side.

`cutPlaneGeometry()` classifies each triangle against the axis-aligned cut
plane, keeps triangles on the chosen side, removes triangles on the discarded
side, clips intersecting triangles, collects intersection segments, rebuilds
cut loops and triangulates each loop as a cap when enabled.

`removeMiddleSectionGeometry()` supports the automatically detected internal cut
mode. It performs two capless plane cuts, removes the section between them,
translates the positive side back by the removed gap, combines the two remaining
sections and lets the repair pass weld coincident vertices. This is the workflow
for preserving both functional ends of a part while shortening a mostly regular
middle span.

The preview is deliberately lightweight: blue plane plus orange removed volume
from the bounding box. The mesh is not continuously cut while editing inputs,
which keeps large STL interaction more responsive.

Known limits:

- caps are generated per closed loop, so complex hollow/non-manifold sections
  can still need slicer validation or mesh repair;
- the tool is currently axis-aligned, not arbitrary-plane;
- middle-section fusion works best when the two cut cross-sections are similar;
- open chains are tracked internally but not exposed in the UI yet.

### Split / Cut and Separate

`Split` lives in the `Booleans` menu but, like `Shorten`, it does not use CSG.
It is a print-preparation tool for parts that exceed the printer bed. The UI
chooses axis and plane coordinate, shows a lightweight blue plane preview,
optionally caps the cut surfaces and optionally separates the two halves.

Implementation notes:

- both halves are produced with `cutPlaneGeometry()` by keeping the negative and
  positive side of the same plane;
- `Cap cut surfaces` maps to the `cap` option in `cutPlaneGeometry()`;
- `Separate into two bodies` translates the positive half by a small axis gap
  before recombining, because Forma3D still stores one STL mesh rather than a
  true multi-body scene graph;
- `Export negative side` and `Export positive side` generate temporary half
  geometries and download them without changing the current scene;
- the operation is whole-model by design, while `Shorten` remains the targeted
  body workflow.

### Hollow / Mesh Shell

`Hollow` lives in the `Booleans` menu as a whole-model operation. It is not CSG
and it does not introduce a CAD kernel. The controller reads a wall thickness in
millimeters, calls `snapshot()` once, then applies `hollowGeometry()` and
replaces the current STL through `setModelGeometry(result.geometry, false,
{ preserveSketch: true })`.

`hollowGeometry(geometry, thickness, options)` is a pure mesh helper:

- validates `thickness > 0`;
- works from a non-indexed copy of the geometry;
- keeps the original outer triangles unchanged;
- groups coincident vertices with the standard tolerance;
- computes adjacent face planes for each unique vertex;
- creates an inner surface by intersecting the offset planes when possible,
  preserving exact wall thickness on box-like planar solids;
- falls back to averaged vertex normals only when the adjacent planes are
  degenerate or under-constrained;
- writes the inner surface with inverted winding so normals face the cavity;
- detects open boundary edges and bridges outer/inner edges with side walls;
- returns `{ geometry, openBoundaryCount, warnings, report }`.

Known limits:

- this is an averaged-normal shell, not an exact robust offset surface;
- dirty STL files, non-manifold topology and inverted triangle winding can
  produce imperfect inward directions;
- features smaller than the wall thickness, tight fillets and narrow slots can
  self-intersect;
- no drain holes yet;
- no `hollow selected body` mode yet.

Important interaction with `Shorten`: the middle-section workflow uses
`repairMeshGeometry(..., { preserveWinding: true })`. The default repair pass
orients every connected component toward positive volume, which is useful for
ordinary solids but wrong for hollow meshes because the inner shell must keep
inverted winding to remain a cavity. Preserving winding lets median shortening
weld and clean the mesh without turning the hollow interior into a second
positive solid.

Side `Shorten` cuts also preserve winding and use ring caps when they cut a
hollow mesh. If the cut plane finds one loop inside another, the cap is
triangulated as a wall ring between outer and inner loops instead of a filled
face across the cavity.

## 3D Text

Text uses Three.js `TextGeometry` and font assets loaded by URL only when needed.

Options include font, bold, simulated italic, letter height, depth, letter
width, bevel, Z rotation and offsets.

Raised text is appended quickly. Engraved text uses boolean subtraction and a
busy overlay because it can be heavier.

## Line Guides

Line creates persistent construction guides:

- grid/model/guide snapping;
- endpoint, midpoint and face-center snapping;
- axis and parallel inference;
- manual `XY`, `XZ`, `YZ` or `Auto 3D` planes;
- length input from the measurement box;
- closed faces that can be applied to the mesh.

Guides remain available as snap targets for other tools.

## Measure

`calculateMeasurement(start, end)` returns total distance, signed X/Y/Z deltas,
dominant axis and alignment flags.

## Transform

`Transform` edits the selected connected body only:

- translation X/Y/Z;
- rotation X/Y/Z;
- uniform scale.
- quick print-prep actions: place selected face on Z=0, rotate selected face
  downward, center target on the X/Y origin and scale uniformly to a maximum
  X/Y/Z size.

The transform is applied directly to the selected triangles with
`transformTrianglesInGeometry()`. Unselected triangles are copied unchanged.
Rotation and scale use the selected body bounding box as center. Values reset
after apply.

For face-based quick actions, `setTool('transform')` stores the previously
selected face normal in `transformFaceReference` before converting the selection
to its connected body. This keeps the Transform tool object-first while still
allowing the print-prep commands to orient the object from a picked face.

## Pattern / Duplicate Series

Pattern is launched from a row in the `Objects` drawer. It is deliberately tied
to connected bodies rather than faces. The drawer opens beside Objects and keeps
the main inspector free.

- Linear pattern creates additional copies using progressive X/Y/Z offsets.
- Circular pattern creates additional copies around the selected body center
  using count, radius and axis.
- The original body remains in place; the requested copy count means additional
  copies.
- Copies are triangle clones appended through `combineGeometries()`, then
  `setModelGeometry()` refreshes connected components.

This is not a parametric pattern feature yet. Once applied, copies become normal
STL mesh bodies and are edited/exported like any other connected component.

## Snapping

`pickWorkPoint()` is the shared picking pipeline for placement tools. It tries
screen-space snaps, raycast hits, work-plane intersections, axis locks, grid
snap and construction targets.

`collectDisplaySnapPoints()` derives targets from structural display edges and
coplanar face centers, avoiding noisy STL triangulation diagonals.

## Known Limits

- STL is a triangle mesh, not parametric CAD.
- Booleans need reasonably clean closed meshes.
- Delete can leave open boundaries.
- 3D text becomes mesh after applying.
- Hole recognition is heuristic.
- Undo/redo stores geometry, not the full UI state.
- Gear is appended as a separate body, not CSG-unioned.
- The main controller is still large; future refactoring should extract modules.

## Future Improvements

- Hole filling with preview and strategy choice.
- Stable object IDs and a richer scene model beyond connected-component indexes.
- 3D transform gizmo.
- More advanced snaps: perpendiculars, intersections and persistent constraints.
- Richer project format with history, thumbnails and per-body metadata.
- Browser/Electron end-to-end tests.
- Main-controller refactor into `model-state`, `tools`, `overlays`,
  `history`, `ui-bindings`.

## Checklist Before Changes

1. Read this diary and `README.md`.
2. Check `git status --short --branch`.
3. Edit source files, not `src/main.js`.
4. Add tests for pure logic when possible.
5. Run `npm test`.
6. Run `npm run build`.
7. If UI/canvas changed, test with `npm run dev` or `npm start` when possible.
8. Update README, diary and wiki when logic or user-facing behavior changes.
9. Commit and push after checks pass, unless the user says not to.

---

<details>
<summary><strong>Italiano - diario tecnico storico</strong></summary>

# Diario di sviluppo - Forma3D

Ultimo aggiornamento: 2026-07-10

Questo file e' la memoria tecnica del progetto. Prima di fare nuove modifiche
conviene leggerlo insieme a `README.md`, per ricordare perche certe scelte sono
state fatte e dove intervenire senza rompere il flusso esistente.

## Aggiornamento operativo 2026-07-10

Le ultime sessioni hanno consolidato l'app come editor STL con strumenti
separati per facce e corpi connessi. I punti piu importanti da ricordare prima
di intervenire ancora:

- la lingua primaria e' inglese, con italiano selezionabile dal menu `Options`;
- il menu `Options` contiene lingua, `Repair mesh`, apertura/salvataggio
  progetto, esportazione STL, esportazione OBJ ed export della selezione; la
  guida rapida vive nel pulsante dedicato `Help`;
- `Select` usa click singolo per selezionare una faccia e doppio click per
  selezionare il corpo connesso cliccato;
- la selezione oggetto non prende piu' tutta la mesh STL: usa
  `findConnectedComponent()` sul triangolo cliccato e seleziona solo l'isola di
  triangoli collegata;
- `Delete` su un oggetto rimuove solo quel corpo, non tutto il modello;
- `Transform` passa automaticamente a modalita oggetto e agisce solo sul corpo
  selezionato. Se prima era selezionata una faccia, la selezione viene convertita
  nel corpo connesso. Include anche comandi rapidi per appoggiare la faccia
  selezionata sul piano, ruotarla verso il basso, centrare su origine X/Y e
  scalare a dimensione massima X/Y/Z;
- i piani 2D appena applicati vengono selezionati subito come facce, per
  favorire `Push/Pull`;
- le selezioni sono piu visibili: facce con overlay blu piu saturo e wireframe,
  oggetti con box evidenziato, spigoli spessi e marker sugli angoli;
- `fitView()` usa il FOV della camera e un margine piu ampio, cosi il primo
  oggetto creato resta centrato e non troppo zoomato;
- l'ingranaggio e' stato reso sicuro per il browser: non usa piu booleane
  pesanti, viene aggiunto come corpo separato, ha limite a 80 denti e anteprima
  debounced;
- il formato `.forma3d.json` salva stato locale del progetto: metadati, camera,
  metadati dei corpi connessi, guide e geometria triangolare;
- l'export ora include nomi file ripuliti, STL completo, OBJ completo e STL
  della selezione.
- la toolbar sinistra termina con `Objects`, che apre un drawer compatto e
  scrollabile con corpi connessi, rinomina, selezione, pattern, export ed
  eliminazione. Pattern apre un drawer laterale per copie lineari/circolari.
- il nome file nella topbar apre un popover con dimensione, triangoli, vertici e
  classe di complessita. Le mesh molto grandi rimandano l'analisi automatica dei
  corpi connessi per mantenere reattivo l'import.

Regola di lavoro concordata: dopo una modifica completa, se `npm test` e
`npm run build` passano, fare commit e push su GitHub salvo richiesta contraria.

## Obiettivo del progetto

Forma3D e' un editor STL locale pensato per chi conosce SketchUp e vuole fare
modifiche semplici a modelli da stampa 3D senza caricare file online.

Il progetto non prova a ricostruire un CAD parametrico completo da STL. Tratta
il file come mesh triangolare e offre strumenti pratici:

- importazione/esportazione STL e OBJ;
- salvataggio/apertura progetto locale `.forma3d.json`;
- vista 3D con orbita, pan, zoom e viste rapide;
- selezione di superfici piane riconosciute come regioni complanari;
- selezione di corpi connessi tramite doppio click;
- drawer compatto `Objects` per i corpi connessi;
- Spingi/Tira su regioni piane;
- foro cilindrico con anteprima e offset numerici;
- riconoscimento e spostamento di fori cilindrici semplici;
- primitive solide: box, cilindro, cono, piramide, ingranaggio e testo 3D;
- operazioni booleane: foro, sposta foro, sottrazione e incisione testo;
- `Accorcia`: taglio piano X/Y/Z per ridurre lunghezza/profondita senza
  scalare, con taglio laterale oppure rimozione della sezione mediana e
  chiusura del vuoto;
- `Separa`: taglio piano sull'intero modello per preparazione alla stampa, con
  chiusura opzionale, piccolo distacco fra meta ed export lato negativo/positivo;
- piani 2D rettangolari, quadrati o tondi, estrudibili con Spingi/Tira;
- strumento Linea per sagome chiuse estrudibili;
- strumento Testo 3D con font, profondita, larghezza lettere ed effetti;
- misura tra punti con componenti X, Y, Z;
- annulla/rifai;
- rimozione del modello corrente;
- cancellazione con `Canc` di superfici, corpi selezionati o anteprime attive.
- export completo STL/OBJ ed export STL della selezione.

## Stack tecnico

- Runtime: Node.js.
- Bundler/dev server: Vite.
- Shell desktop: Electron.
- Rendering 3D: Three.js.
- Controlli camera: `OrbitControls` di Three.js.
- STL/OBJ: `STLLoader`, `STLExporter` e `OBJExporter`.
- Booleane mesh: `three-bvh-csg`.
- Test: `node --test`.
- Deploy web: GitHub Actions + GitHub Pages, pubblicando `dist`.

Comandi importanti:

```bash
npm install
npm test
npm run build
npm run dev
npm start
```

Su PowerShell puo' essere necessario usare `npm.cmd` se l'esecuzione di
`npm.ps1` e' bloccata dalla policy di Windows.

## Struttura del repository

- `index.html`: markup dell'interfaccia. Contiene topbar, toolbar verticale con
  menu espandibili, viewport, inspector laterale e statusbar.
- `src/style.css`: stile dell'app. Mantiene una UI compatta e tecnica, ispirata
  agli strumenti desktop di modellazione.
- `src/main.parts/*.js`: sorgente reale del controller principale, diviso in
  parti per renderlo gestibile.
- `src/main.js`: file generato da `scripts/assemble-main.cjs`; non va editato a
  mano.
- `scripts/assemble-main.cjs`: concatena le parti `main.partXX.js` in
  `src/main.js`.
- `src/geometry.js`: funzioni geometriche sulle mesh triangolari, inclusi
  selezione, riparazione, Spingi/Tira e taglio piano.
- `src/primitives.js`: creazione di box, cilindri, coni, piramidi, sagome
  estruse e testo 3D.
- `src/hole-detection.js`: riconoscimento euristico dei fori cilindrici.
- `src/snapping.js`: raccolta vertici e snap a griglia, punti e assi.
- `src/measurement.js`: calcolo distanza e componenti assiali.
- `src/number-format.js`: parsing e formattazione numeri con virgola/punto.
- `test/*.test.js`: test unitari delle parti pure.
- `electron/main.cjs`: finestra desktop Electron.
- `Avvia Forma3D.bat`: avvio rapido su Windows.

## Regola importante su `src/main.js`

`src/main.js` e' generato. Ogni modifica al controller principale deve essere
fatta in `src/main.parts/main.partXX.js`. I comandi `npm run dev`,
`npm run build` e `npm start` eseguono prima `scripts/assemble-main.cjs`.

Se la build segnala un errore in `src/main.js`, cercare lo stesso blocco nei
file `src/main.parts/`. In passato il file remoto conteneva una chiamata tronca:

```js
calculateMeasurement(start, end
```

La correzione reale e' stata fatta in `src/main.parts/main.part02.js`, non nel
file generato.

## Navigazione UI

La toolbar verticale non espone piu' tutte le azioni in una lista piatta:

- strumenti diretti: `Seleziona`, `Spingi/Tira`, `Misura`,
  `Trasforma`, navigazione vista;
- menu `Solidi`: `Box`, `Cilindro`, `Cono`, `Piramide`,
  `Ingranaggio`, `Testo 3D`;
- menu `Booleane`: `Sottrai`, `Accorcia`, `Separa`, `Svuota`, `Foro`,
  `Sposta foro`.
- menu `2D`: `Linea`, `Piani`, `Incastro`.
- tasto finale in basso: `Objects`.

I sottomenu sono elementi HTML leggeri che si aprono verso destra con hover o
focus. I pulsanti reali mantengono `data-tool`, quindi il controller continua a
passare da `setTool(tool)` e le scorciatoie restano indipendenti dal layout.
Le voci dei sottomenu usano piccole icone SVG inline per distinguere solidi,
booleane e strumenti 2D senza allungare la toolbar.

`Objects` non e' uno strumento di modellazione e non usa `data-tool`. Apre un
drawer sottile nel viewport, con lista scrollabile. Ogni corpo connesso ha
rinomina, selezione, pattern, export STL ed eliminazione. Pattern apre un
secondo drawer laterale accanto a Objects invece di occupare l'inspector.

La topbar mantiene `Apri STL` e `Rimuovi modello` come azioni primarie. Il
pulsante dedicato `Help` apre un popup con schede e icone per selezione,
navigazione, modifica, Spingi/Tira, Oggetti e Accorcia. Il menu `Opzioni`
contiene:

- selezione lingua `Italiano` / `English`;
- `Ripara mesh`;
- `Apri progetto`;
- `Salva progetto`;
- `Esporta STL`;
- `Esporta OBJ`;
- `Esporta selezione`.

La lingua primaria e' inglese. La lingua selezionata viene salvata in
`localStorage` (`forma3d-language`). La funzione `applyLanguage(language)`
aggiorna i testi statici principali tramite una tabella estendibile
(`staticTranslations`) e i nomi tool/topbar tramite `languageText`. I messaggi
dinamici introdotti di recente sono stati aggiunti alla tabella in inglese; se
si aggiungono nuove frasi UI, vanno registrate subito per evitare schermate
miste italiano/inglese.

## Pubblicazione web su GitHub Pages

La versione web deve essere pubblicata come build Vite. Non bisogna servire la
root del branch `main`, perche `index.html` di sviluppo punta a `/src/main.js`
e si aspetta Vite/dev server per risolvere import, CSS e dipendenze.

Sintomo della pubblicazione sbagliata: la pagina GitHub Pages mostra bottoni e
testi con stile browser predefinito, senza layout, senza canvas 3D e senza CSS.

Il workflow `.github/workflows/pages.yml` e' la fonte corretta di deploy:

1. checkout del repository;
2. setup Node 24;
3. `npm ci`;
4. `npm test`;
5. `npm run build`;
6. upload della cartella `dist`;
7. deploy su GitHub Pages.

`vite.config.js` usa `base: './'`, cosi gli asset generati in `dist` restano
relativi e funzionano sotto `https://lukethehawk.github.io/Forma3D/`.

Se dopo il push la pagina resta senza stile, controllare nelle impostazioni del
repository GitHub che Pages usi **GitHub Actions** come sorgente e non
`main / root`.

## Modello dati runtime

Il controller principale usa variabili di stato semplici:

- `model`: mesh Three.js principale caricata o creata.
- `edges`: bordi visuali calcolati da `createDisplayEdgesGeometry()`.
- `highlight`: overlay blu della faccia o del corpo selezionato.
- `selected`: selezione corrente. Puo' essere `{ type: 'face', point, normal,
  region }` per una regione complanare, oppure `{ type: 'object', point,
  triangles }` per un corpo connesso.
- `activeTool`: strumento attivo.
- `currentFileName`: nome usato per esportare.
- `undoStack` / `redoStack`: cloni di geometrie per annulla/rifai.
- `snapPoints`: vertici raccolti dalla geometria corrente.
- stati temporanei degli strumenti: `holeCreate`, `holeMove`, `boxPlacement`,
  `cylinderPlacement`, `conePlacement`, `pyramidPlacement`, `planePlacement`,
  `gearPlacement`, `cutPlacement`, `textPlacement`, `sketchPoints`,
  `measurementStart`.

La modalita selezione resta nello stato interno `selectionMode`, ma nel pannello
`Select` non c'e' piu un menu visibile: l'utente usa click singolo per la faccia
e doppio click per il corpo. Le transizioni automatiche sono importanti:

- click singolo nello strumento `Select` forza selezione faccia;
- doppio click forza selezione oggetto;
- entrando in `Transform`, la modalita passa a oggetto;
- dopo l'applicazione di un piano 2D, la modalita torna a faccia e seleziona la
  faccia appena creata.

La scena contiene oggetti permanenti (griglia, luci, modello, edges) e overlay
temporanei. Gli overlay vengono marcati con `userData.transientOverlay` e
rimossi da `clearTransientOverlays()`.

## Flusso rendering e camera

La scena ha asse Z verso l'alto (`camera.up.set(0, 0, 1)`). La griglia Three.js
viene ruotata per rappresentare il piano XY. La camera usa `PerspectiveCamera`
con FOV 38 e viene riposizionata da `fitView()`.

`fitView()` calcola la distanza dal modello usando bounding box, FOV verticale,
FOV orizzontale e un margine di sicurezza. Questo evita che il primo oggetto
creato venga inquadrato troppo da vicino: il modello resta centrato e leggibile
nel viewport, con una distanza minima di sicurezza anche per oggetti piccoli.

`OrbitControls` e' configurato cosi:

- rotellina premuta: orbita;
- rotellina: zoom;
- tasto destro: pan;
- tasto sinistro: lasciato libero agli strumenti, tranne quando lo strumento
  attivo e' Orbita o Panoramica.

La funzione `setTool()` cambia anche il cursore e i mouse button dei controlli.

Il rendering e' su richiesta, non a ciclo continuo: `requestRender()` pianifica
un frame quando cambiano camera, viewport, modello o overlay. `OrbitControls`
genera nuovi frame durante il movimento e lo smorzamento, poi la scena resta
ferma. Questo riduce il carico CPU/GPU a riposo, soprattutto dopo operazioni che
producono mesh pesanti.

Per non appesantire la vista, `updateEdges()` crea le linee dei bordi solo sotto
`MAX_EDGE_TRIANGLES`; sulle mesh molto dense il modello resta visibile senza la
geometria extra delle linee. `createDisplayEdgesGeometry()` usa
`MODEL_EDGE_ANGLE`: mostra crease reali e bordi aperti, ma nasconde le diagonali
di triangolazione coplanari. Questo e' importante per i piani 2D: un cerchio
applicato su una faccia STL deve mantenere il contorno esterno selezionabile,
senza mostrare tutti i raggi interni della triangolazione.

## Import STL, formato progetto ed export

`openStl(file)`:

1. legge il file via `arrayBuffer()`;
2. usa `STLLoader().parse(data)`;
3. calcola il bounding box;
4. centra il modello in X/Y;
5. porta il minimo Z a quota 0;
6. svuota undo/redo;
7. chiama `setModelGeometry(geometry, false)`;
8. aggiorna nome file e vista.

L'app interpreta le unita come millimetri. STL non contiene unita reali, quindi
questa e' una convenzione di lavoro.

`modelComplexityInfo(file, geometry)` classifica il modello corrente:

- Leggero: sotto 50k triangoli.
- Medio: da 50k a 250k triangoli.
- Grande: da 250k a 1M triangoli.
- Molto grande: sopra 1M triangoli.

Forma3D non impone un limite fisso di upload/import perche i file STL vengono
gestiti localmente. Le prestazioni dipendono da RAM, GPU e numero di triangoli.
Il popover sul nome file mostra dimensione, triangoli, vertici e classe. Sopra
1M triangoli, `refreshObjectItems()` rimanda `collectConnectedComponents()` per
evitare un'analisi componenti costosa subito dopo il parse.

Il formato progetto locale usa file `.forma3d.json`. La versione 1 salva:

- `version`, `name`, `units`, `sourceStlName`, `currentFileName`, `savedAt`;
- posizione camera, target e vettore up;
- nomi e numero triangoli dei corpi connessi;
- guide di costruzione e facce guida;
- geometria come array piatto di posizioni triangolari.

Non e' una cronologia CAD parametrica: serve a riaprire lo stato locale
dell'editor, incluse informazioni che STL non puo' contenere.

`exportStl()` usa `STLExporter` in formato binario e scarica
`<nome-ripulito>-modified.stl`. `exportObj()` usa `OBJExporter` e scarica
`<nome-ripulito>-modified.obj`. `exportSelection()` estrae i triangoli della
faccia/corpo selezionato e scarica uno STL della sola selezione. Il drawer
`Objects` puo' esportare anche un singolo corpo connesso come STL.

`sanitizeFileBase()` rimuove accenti, spazi e caratteri problematici dai nomi
file, cosi i download sono piu prevedibili tra browser e sistemi operativi.
Se non c'e' modello, i pulsanti di export e salvataggio vengono disabilitati da
`updateModelActions()`.

## Riparazione mesh

`repairCurrentMesh()` e' un'azione sul modello intero, disponibile nella topbar
con `Ripara mesh`.

La logica pura vive in `repairMeshGeometry()` dentro `src/geometry.js` e lavora
sulla triangolazione STL senza cercare di ricostruire un solido CAD:

- salda vertici coincidenti o quasi coincidenti con una tolleranza piccola;
- rimuove triangoli degeneri, cioe' collassati in linea o in punto;
- rimuove triangoli duplicati, anche se arrivano da vertici separati ma
  coincidenti;
- propaga l'orientamento dei triangoli lungo gli spigoli condivisi per rendere
  piu' coerenti le normali;
- prova a orientare verso l'esterno ogni componente chiusa usando il volume
  firmato;
- planarizza in modo conservativo i vertici molto vicini a superfici grandi e
  quasi piane (`planarizeNearlyCoplanarVertices()`), utile dopo booleane che
  lasciano micro-triangoli leggermente fuori piano;
- dopo la planarizzazione ripulisce di nuovo eventuali triangoli diventati
  degeneri o duplicati;
- rileva i boundary loop distinguendo loop chiusi, catene aperte e contorni
  ramificati;
- chiude in modo conservativo solo piccoli buchi planari;
- restituisce un report con triangoli prima/dopo, vertici saldati, triangoli
  rimossi, vertici planarizzati, buchi chiusi, triangoli aggiunti, componenti,
  bordi aperti, boundary loop, spigoli non-manifold e warning.

Questa riparazione e' conservativa: puo chiudere un piccolo buco planare, per
esempio una faccia mancante semplice, ma salta loop grandi, non planari,
ramificati, ambigui o superfici aperte isolate. Se il report indica bordi aperti
o spigoli non-manifold, la mesh resta problematica per alcune booleane e puo
servire lo slicer o uno strumento mesh dedicato.
La planarizzazione usa una tolleranza piccola e corregge solo vertici gia'
molto vicini a un piano dominante: non deve trasformare smussi, superfici curve
o inclinazioni volute in facce piatte.

La UI mostra un overlay modale durante il calcolo, applica la mesh riparata con
undo disponibile, aggiorna snap point, bordi visibili e normali tramite
`setModelGeometry()`, poi apre un popup compatto con dettagli e warning della
riparazione.

Forma3D resta MIT. ADMesh, MeshFix, MeshLab, MeshLabJS e CGAL sono riferimenti
concettuali utili per terminologia e workflow, ma il loro codice GPL/AGPL/LGPL
non viene copiato, tradotto, portato o derivato.

## Gestione modello corrente

`setModelGeometry(geometry, recordHistory)` e' il punto unico per sostituire la
mesh principale:

- salva snapshot se richiesto;
- pulisce overlay e strumenti;
- rimuove e dispone la vecchia geometria;
- converte la geometria a non indicizzata, normalizza attributi e bounding
  volume;
- crea la mesh con `modelMaterial`;
- ricalcola vertici per snap;
- aggiorna edges e pulsanti.

`modelMaterial` usa `flatShading`: sugli STL e sui risultati delle CSG e'
preferibile mostrare facce e cambi di piano netti. Le normali lisciate rendevano
incisioni e tagli visivamente piatti, perche pareti e superficie superiore
venivano illuminate come se fossero una superficie continua.

`removeCurrentModel()` rimuove l'intera figura corrente, pulisce storia e stato,
e lascia il piano vuoto. Serve per togliere la figura importata senza chiudere
l'app.

`clearCurrentModel()` e' la funzione interna usata anche quando la cancellazione
di superfici elimina tutti i triangoli.

## Annulla e rifai

La storia conserva cloni di `BufferGeometry` e metadati UI leggeri.

- `snapshot()` salva la geometria corrente in `undoStack`, massimo 30 stati, e
  svuota `redoStack`.
- `undoHistory` e `redoHistory` restano paralleli a `undoStack` e `redoStack`:
  ogni voce contiene solo `title`, `detail` e `createdAt`, senza duplicare
  geometrie.
- `restoreFrom(source, destination)` sposta la geometria corrente nello stack di
  destinazione, poi ripristina l'ultima geometria dello stack sorgente e muove
  anche la voce history corrispondente.
- Il drawer `History`, sotto `Objects`, mostra le ultime azioni annullabili. La
  voce corrente e' evidenziata; cliccare una voce precedente chiama ripetutamente
  `restoreFrom(undoStack, redoStack)` fino allo snapshot richiesto, quindi Redo
  continua a funzionare.

Le operazioni booleane e Spingi/Tira chiamano `snapshot()` prima di modificare.

Nota: la history e' un log operativo di snapshot mesh, non una timeline CAD
parametrica. Non salva parametri modificabili retroattivamente, vincoli o feature
tree. Se in futuro serve un undo piu completo, introdurre un oggetto stato con
`geometry`, `fileName`, `selection`, ecc.

## Selezione facce e oggetti

`selectAt(clientX, clientY, mode)` fa raycast sulla mesh. Lo strumento
`Select` usa click singolo per forzare `mode = 'face'`, mentre il doppio click
chiama direttamente `selectObjectAt()`.

Se la selezione e' una faccia:

1. prende `faceIndex`;
2. chiama `findCoplanarRegion(model.geometry, hit.faceIndex)`;
3. crea un overlay blu con `createFaceSelectionOverlay()`;
4. salva `selected = { type: 'face', point, normal, region }`;
5. aggiorna inspector e status.

`findCoplanarRegion()`:

- calcola normale e piano dal triangolo seed;
- cerca triangoli con normale quasi uguale e distanza dal piano entro tolleranza;
- costruisce adiacenze per vertici quantizzati;
- fa una visita a grafo per ottenere solo la regione connessa.

Questa logica serve a far percepire come unica faccia una superficie STL fatta
da molti triangoli.

Se la selezione e' un oggetto:

1. `selectObjectAt()` prende il triangolo cliccato;
2. `findConnectedComponent()` visita i triangoli collegati da spigoli condivisi;
3. `selectionBoxFromTriangles()` calcola il box del solo corpo connesso;
4. `createSelectionBoxOverlay()` crea un box blu visibile, con spigoli spessi e
   marker sugli angoli;
5. salva `selected = { type: 'object', point, triangles }`.

Questa logica e' fondamentale per oggetti aggiunti come corpi separati nello
stesso STL, per esempio ingranaggi o testo/primitive accodate senza booleana.
Prima la modalita oggetto selezionava tutto `model`; ora seleziona solo l'isola
di triangoli cliccata.

## Metadati dei corpi connessi

`refreshObjectItems()` usa `collectConnectedComponents(model.geometry)` e
salva ogni isola di triangoli connessi in `objectItems`. Questo strato viene
usato da salvataggio/apertura progetto, export selezione e drawer compatto
`Objects`.
Sulle mesh molto grandi, `currentModelInfo.skipConnectedComponents` evita questa
scansione automatica durante l'import; il drawer segnala che l'analisi oggetti e'
stata rimandata.

Poiche STL non ha ID persistenti, i nomi sono per ora legati all'indice del
componente e potrebbero spostarsi dopo modifiche topologiche distruttive. In
futuro conviene passare a ID corpo stabili.

## Spingi/Tira

`applyPushPull(distance)` richiede una selezione. Il flusso ha due casi:

- facce STL normali o piani 2D isolati: usa
  `pushPullGeometry(model.geometry, selected.region, distance)`;
- profili 2D appoggiati su una faccia STL coplanare: crea un volume cutter con
  `createPushPullRegionGeometry()` e applica una booleana locale.

`pushPullGeometry()` muove tutti i vertici appartenenti alla regione selezionata
lungo la normale della regione. E' una modifica mesh diretta, non una booleana
CAD. Funziona bene su facce piane semplici; puo' creare geometrie non manifold
se usato su mesh complesse o facce con topologia difficile.

Il controllo visuale opzionale con sfera e' salvato in `localStorage` come
`forma3d-pushpull-visual-handle`. La sfera appare solo quando lo strumento
attivo e' `pushpull`, il toggle e' acceso e la selezione corrente e' una faccia.
Durante il drag non modifica la mesh reale: mostra un overlay lungo
`selected.normal`, aggiorna il campo numerico e crea una preview separata con
`createPushPullRegionGeometry()`. `Shift` aggancia a 1 mm, `Esc` annulla. Sopra
250k triangoli totali o 20k triangoli nella regione selezionata, la preview si
semplifica a sfera + distanza/stato per non bloccare il browser. Al rilascio
chiama una sola volta `applyPushPull()`, quindi l'undo resta un singolo snapshot.

Quando la regione e' una faccia aperta, come un piano 2D appoggiato su uno STL,
`pushPullGeometry()` aggiunge una base e pareti laterali per trasformarla in
volume. In quel caso il numero di vertici cambia: l'attributo `normal` clonato
dalla geometria originale deve essere eliminato prima di `computeVertexNormals()`,
altrimenti WebGL riceve attributi `position` e `normal` di lunghezze diverse e
il modello puo' apparire come sola wireframe/contorni.

Per i profili disegnati sopra una faccia esistente, `regionHasCoplanarSupport()`
controlla se sotto il piano selezionato esiste una superficie STL complanare. In
quel caso `Spingi/Tira` elimina prima la faccia 2D di costruzione, poi usa:

- distanza positiva: booleana `ADDITION`, con un piccolo overlap dentro il
  solido per evitare facce complanari instabili;
- distanza negativa: booleana `SUBTRACTION`, con un piccolo overlap verso
  l'esterno per creare un taglio reale nel solido.

## Cancellazione con Canc

`handleDeleteKey(event)` intercetta `Delete` fuori dagli input.

Ordine di comportamento:

1. se c'e' uno strumento con anteprima/stato temporaneo, lo cancella;
2. altrimenti, se c'e' una superficie selezionata, elimina quei triangoli;
3. se c'e' un oggetto selezionato, elimina i triangoli del solo corpo connesso;
4. se non c'e' nulla da cancellare, mostra un messaggio di stato.

Facce e oggetti si cancellano con `deleteSelectedRegion()`, che chiama
`deleteTrianglesFromGeometry()`. Per `selected.type === 'object'` viene passata
la lista dei triangoli del componente connesso, non tutta la mesh.

`deleteTrianglesFromGeometry()`:

- accetta geometrie indicizzate e non indicizzate;
- copia in una nuova `BufferGeometry` tutti i triangoli non cancellati;
- ricomputa normali e bounding volume;
- ritorna `null` se non resta alcun triangolo.

La cancellazione di una superficie puo' aprire buchi nella mesh. E' intenzionale:
serve come operazione diretta tipo "togli questa parte". In futuro si puo'
aggiungere riempimento automatico o riparazione mesh.

## Foratura

Lo strumento Foro usa un workflow in due passi:

1. `holeAt()` prende il punto colpito e la normale della faccia.
2. `drawHoleCreatePreview()` mostra un cilindro wireframe verde.
3. `applyHole()` crea un cilindro di taglio e applica `SUBTRACTION`.

La direzione del foro e' la normale della faccia, invertita per entrare nel
pezzo. Gli offset X/Y/Z consentono di correggere numericamente il centro, ma
l'asse dominante della normale viene bloccato.

Problemi possibili:

- se la mesh non e' chiusa, la booleana puo' fallire;
- su normali incoerenti il foro puo' andare nella direzione inattesa;
- STL molto sporchi possono generare risultati non manifold.

## Spostamento foro

`detectCylindricalHole()` prova a riconoscere pareti cilindriche interne:

- parte dal triangolo cliccato;
- stima asse dominante;
- raccoglie facce compatibili;
- ricostruisce centro, raggio, profondita e segmenti.

`applyMoveHole()` chiude il foro vecchio con una booleana di addizione e apre il
foro nuovo con una sottrazione.

Limite: funziona su fori cilindrici semplici, preferibilmente allineati agli
assi principali. Non e' un riconoscitore CAD generale.

## Primitive e booleane

Le primitive sono create in `src/primitives.js`.

- `createBoxGeometryFromBase(base, size)`: box centrato sul punto base in X/Y e
  sviluppato in altezza.
- `createCylinderGeometryFromBase(base, radius, height, direction)`: cilindro
  orientato su direzione arbitraria.
- `createConeGeometryFromBase(base, radius, height, direction)`: cono con base
  centrata sul punto cliccato e apice lungo la direzione scelta.
- `createPyramidGeometryFromBase(base, size, height, direction)`: piramide a base
  rettangolare centrata sul punto cliccato, orientata lungo asse faccia/X/Y/Z.
- `createGearGeometryFromBase(base, options, direction)`: ingranaggio cilindrico
  a denti dritti semplificati, con foro centrale reale e mozzo opzionale.
- `createPlaneGeometryFromBase(base, shape, size, direction)`: crea facce 2D
  piatte rettangolari, quadrate o tonde, centrate sul punto cliccato e orientate
  sul piano della faccia o sugli assi principali.
- `createExtrudedPolygonGeometry(points, height)`: estrude una sagoma 2D chiusa.
- `createTextGeometryFromBase(base, text, font, options)`: genera testo 3D
  estruso usando `TextGeometry`, normalizza l'angolo basso sinistro sul punto
  cliccato, applica larghezza lettere, corsivo simulato, rotazione, profondita
  e direzione di estrusione arbitraria.

`applyPrimitiveGeometry(geometry, operation, successMessage)`:

- se non c'e' modello e l'operazione e' addizione, crea un nuovo modello;
- se l'operazione e' sottrazione senza modello, mostra errore;
- altrimenti chiama `booleanGeometry()`.

`booleanGeometry()` usa `three-bvh-csg` con `ADDITION` o `SUBTRACTION`.

### Accorcia / taglio piano

`Accorcia` nasce per STL funzionali da ridurre in lunghezza o profondita senza
scalare il pezzo. Vive nel menu `Booleans`, ma non usa CSG: chiama
`cutPlaneGeometry()` in `src/geometry.js`.

La UI di default richiede un corpo connesso selezionato. Accorcia estrae quel
corpo con `extractTrianglesFromGeometry()`, calcola il suo bounding box, applica
il taglio alla geometria isolata e poi la ricompone con il resto non toccato
tramite `combineGeometries()`. La spunta `Applica a tutto il file` ripristina
intenzionalmente il vecchio flusso sull'intera mesh: `shortenUsesWholeModel()`
sposta il target box su `model.geometry.boundingBox` e applica il taglio
direttamente alla mesh corrente completa. Serve quando un taglio precedente ha
diviso un pezzo funzionale in piu componenti connesse. La finestra di taglio
viene calcolata come `[centro - lunghezza / 2, centro + lunghezza / 2]`
sull'asse scelto. Se la finestra resta dentro al bounding box target, Accorcia
usa il flusso mediano e richiude il vuoto. Se la finestra tocca o supera un
bordo, Accorcia passa automaticamente al taglio laterale e mantiene il lato
opposto.

`cutPlaneGeometry()` classifica ogni triangolo rispetto al piano assiale,
mantiene i triangoli dal lato scelto, elimina quelli dal lato scartato, taglia i
triangoli intersecati, raccoglie i segmenti di intersezione, ricostruisce i loop
e triangola ogni loop come tappo quando l'opzione e' attiva.

`removeMiddleSectionGeometry()` supporta la modalita interna rilevata in
automatico. Esegue due tagli senza cap, rimuove la sezione tra i due piani,
trasla il lato positivo indietro della distanza rimossa, combina le due sezioni
rimaste e lascia alla riparazione leggera il weld dei vertici coincidenti.
Questo flusso serve quando si vogliono preservare entrambe le estremita
funzionali di un pezzo accorciando solo una zona centrale abbastanza regolare.

La preview e' volutamente leggera: piano blu e volume arancione rimosso dal
bounding box. La mesh non viene tagliata continuamente mentre si cambiano gli
input, cosi l'interazione resta piu reattiva anche su STL grandi.

Limiti noti:

- i cap vengono generati per loop chiuso; sezioni cave/non-manifold complesse
  possono richiedere comunque verifica nello slicer o riparazione mesh;
- il tool e' assiale X/Y/Z, non ancora un piano arbitrario;
- la fusione mediana funziona meglio quando le due sezioni tagliate hanno forme
  simili;
- le catene aperte sono tracciate internamente ma non ancora esposte nella UI.

### Separa / taglia e dividi

`Separa` vive nel menu `Booleans` ma, come `Accorcia`, non usa CSG. Serve per
preparare alla stampa pezzi troppo grandi per il piano della stampante. La UI
sceglie asse e coordinata del piano, mostra una preview blu leggera, puo
chiudere le superfici tagliate e puo separare le due meta.

Note implementative:

- entrambe le meta vengono generate con `cutPlaneGeometry()`, mantenendo lato
  negativo e positivo dello stesso piano;
- `Chiudi superfici tagliate` corrisponde all'opzione `cap`;
- `Separa in due corpi` trasla leggermente la meta positiva prima della
  ricombinazione, perche Forma3D conserva ancora una singola mesh STL e non un
  vero scene graph multi-corpo;
- `Export lato negativo` e `Export lato positivo` creano geometrie temporanee e
  le scaricano senza modificare la scena corrente;
- l'operazione lavora sull'intero modello, mentre `Accorcia` resta il flusso
  mirato sul corpo selezionato.

### Svuota / guscio mesh

`Svuota` vive nel menu `Booleans` come operazione sul modello intero. Non usa
CSG e non introduce un kernel CAD. Il controller legge lo spessore parete in
millimetri, chiama `snapshot()` una sola volta, poi applica `hollowGeometry()` e
sostituisce lo STL corrente con `setModelGeometry(result.geometry, false,
{ preserveSketch: true })`.

`hollowGeometry(geometry, thickness, options)` e' un helper mesh puro:

- valida `thickness > 0`;
- lavora su una copia non indicizzata della geometria;
- mantiene invariati i triangoli esterni originali;
- raggruppa i vertici coincidenti con la tolleranza standard;
- calcola i piani delle facce adiacenti per ogni vertice unico;
- crea una superficie interna intersecando i piani offset quando possibile,
  mantenendo lo spessore esatto sui solidi planari tipo box;
- torna alle normali medie solo quando i piani adiacenti sono degeneri o
  insufficienti;
- scrive la superficie interna con winding invertito, quindi le normali puntano
  verso la cavita;
- rileva i bordi aperti e collega bordo esterno/interno con pareti laterali;
- restituisce `{ geometry, openBoundaryCount, warnings, report }`.

Limiti noti:

- e' un guscio a normali medie, non un offset CAD robusto ed esatto;
- STL sporchi, topology non-manifold e triangoli invertiti possono produrre
  direzioni interne imperfette;
- dettagli piu piccoli dello spessore, raccordi stretti e cave sottili possono
  auto-intersecarsi;
- i fori di drenaggio sono TODO;
- lo svuotamento del solo corpo selezionato e' TODO.

Interazione importante con `Accorcia`: il flusso mediano rilevato automaticamente usa
`repairMeshGeometry(..., { preserveWinding: true })`. La riparazione standard
orienta ogni componente con volume positivo, cosa utile per solidi normali ma
sbagliata per mesh svuotate, perche il guscio interno deve mantenere winding
invertito per restare una cavita. Preservare il winding consente di saldare e
ripulire la mesh senza trasformare l'interno svuotato in un secondo solido
positivo.

Anche i tagli laterali di `Accorcia` preservano il winding e usano cap ad
anello quando tagliano una mesh cava. Se il piano di taglio trova un loop dentro
un altro, il tappo viene triangolato come cornice tra loop esterno e interno,
non come faccia piena che chiude la cavita.

Le primitive solide nel menu `Solidi` condividono la stessa logica UI:

- click di appoggio con `pickWorkPoint()`;
- anteprima tramite `setPreviewMesh()`;
- operazione `add` o `subtract`;
- offset X/Y/Z;
- asse `face`, `x`, `y`, `z` dove applicabile.

Scorciatoie correnti: `B` box, `C` cilindro, `V` cono, `I` piramide, `K`
ingranaggio, `A` testo 3D.

### Strumento Ingranaggio

`Ingranaggio` vive nel menu `Solidi` e segue il flusso delle altre primitive:
click del centro base, anteprima wireframe, parametri nel pannello, offset e
applicazione tramite `appendGeometryToModel()`.

Parametri:

- modalita: aggiunta come corpo separato;
- asse: normale della faccia, X, Y, Z;
- numero denti: 6-80, default 24;
- modulo in millimetri, default 2;
- spessore, default 8 mm;
- foro centrale passante, default 5 mm, 0 per ingranaggio pieno;
- diametro mozzo e altezza mozzo;
- gioco/backlash semplificato;
- qualita: bassa, media, alta.

Decisione importante: l'ingranaggio non passa piu da `three-bvh-csg` per somma
o sottrazione. Le booleane su profili dentati generavano blocchi del browser e
consumo CPU elevato. Ora la geometria viene accodata come shell/corpo separato
nello stesso STL. Questo e' molto piu stabile e adatto alla stampa/slicing, ma
non equivale a una vera unione CAD con rimozione delle facce interne.

La preview e' debounced (`scheduleGearPreview()`), il numero denti e' limitato a
80 e `gearGeometryFromState()` blocca geometrie sopra `MAX_GEAR_TRIANGLES`.

La geometria e' generata direttamente in `src/primitives.js` senza CSG interna.
Il profilo parte da:

- diametro primitivo `teeth * module`;
- addendum `module`;
- dedendum `1,25 * module`;
- raggio esterno `pitchRadius + module`;
- raggio radice corretto per non intersecare il foro.

Il profilo non e' una involuta CAD industriale: ogni dente e' composto da valle,
fianco, punta e fianco opposto. Il gioco riduce l'ampiezza angolare utile del
dente in modo conservativo. La qualita aumenta i punti di campionamento dei
fianchi e della punta, ma resta limitata per evitare mesh troppo pesanti nel
browser.

Il foro centrale e' una parete interna reale della mesh. Se il diametro richiesto
supera il raggio radice disponibile, viene limitato al massimo sicuro. Il mozzo e'
un rialzo centrale sopra il corpo dell'ingranaggio quando `hubWidth` supera lo
spessore principale; se il diametro mozzo non e' maggiore del foro, la UI segnala
errore prima di applicare. Il punto cliccato e' il centro della base, come per
cilindro, cono e piramide.

File coinvolti:

- `src/primitives.js`: generazione profilo e mesh;
- `src/main.parts/main.part01.js`: stato, riferimenti UI, traduzioni;
- `src/main.parts/main.part02.js`: reset, inspector, tool active/cursor;
- `src/main.parts/main.part03.js`: preview, validazione, apply;
- `src/main.parts/main.part05.js`: eventi e shortcut `K`;
- `index.html`: voce di menu e form;
- `test/primitives.test.js`: test geometria pura.

Lo strumento `Piani` vive nel menu `2D` e crea una faccia piatta, non un solido:

- forme disponibili: rettangolo, quadrato, tondo;
- asse `face`, `x`, `y`, `z`, esposto in UI come piano della faccia, XY, YZ,
  XZ;
- anteprima wireframe blu;
- applicazione tramite `combineGeometries()`.

Il piano resta una superficie STL vera. Per dargli volume si usa `Spingi/Tira`.
Quando il piano viene applicato, `applyPlane()` salva l'indice del primo
triangolo nuovo, torna a `Select`, forza `selectionMode = 'face'` e seleziona
subito la regione coplanare del piano appena creato. Questo rende il flusso
rettangolo/cerchio -> Spingi/Tira immediato.
Per supportare questo caso, `pushPullGeometry()` riconosce i bordi aperti della
regione selezionata: sui solidi chiusi continua a spostare i vertici condivisi,
mentre su una faccia isolata duplica la faccia di partenza e crea le pareti
laterali lungo il movimento. In questo modo una faccia piatta puo' diventare un
prisma senza passare da una booleana.
Quando il piano e' coplanare con una faccia STL gia' esistente, `selectAt()`
preferisce la regione con area minore tra gli hit alla stessa profondita: cosi'
un cerchio o rettangolo disegnato sopra una piastra viene selezionato al posto
dell'intera faccia grande. Il contorno resta visibile perche i bordi aperti sono
inclusi nella geometria display, mentre le diagonali/raggi interni coplanari
vengono nascosti.

Lo strumento `Incastro` vive nello stesso menu `2D` e usa
`createJointProfileGeometry()` in `src/primitives.js`.

- preset iniziali: `arc`, `dovetail`, `t-slot`;
- output `face`: crea una faccia 2D piatta e la seleziona subito per
  `Spingi/Tira`;
- output `add`: estrude il profilo e lo unisce al modello come solido;
- output `subtract`: estrude il profilo e lo usa come cutter booleano.

L'opzione `rotationDeg` ruota il profilo 2D locale prima della mappatura sul
piano scelto: anteprima e geometria finale mantengono quindi lo stesso
orientamento su piani orizzontali, verticali o allineati alla faccia cliccata.

La funzione e' volutamente parametrica/preset-based: copre linguette, cave e
accoppiamenti ricorrenti senza introdurre ancora un editor libero di archi. La
versione libera dovra' probabilmente estendere lo sketch 2D con archi e vincoli
di chiusura piu ricchi.

Per il testo in rilievo sul modello si usa invece `combineGeometries()`:
concatena i vertici del modello e della scritta senza booleana. E' molto piu'
rapido e riduce il rischio di blocchi del browser; il compromesso e' che resta
una mesh unificata ma non una vera unione CSG senza facce interne. Per incisione
testo si mantiene la sottrazione booleana per ottenere un taglio reale.

## Strumento Testo 3D

Lo strumento Testo usa `TextGeometry` di Three.js e font `typeface.json`
inclusi nel pacchetto `three`.

Workflow:

1. attivare `Testo` o premere `A`;
2. cliccare il punto di appoggio, interpretato come angolo basso sinistro del
   testo; viene salvata anche la normale della faccia cliccata;
3. modificare il pannello a destra;
4. l'anteprima wireframe si aggiorna in tempo reale;
5. applicare come somma al solido oppure sottrazione/incisione.

Parametri:

- contenuto testuale;
- font: Helvetiker, Optimer, Gentilis, Droid Sans, Droid Serif, Droid Sans Mono;
- bold, dove il font ha una variante bold;
- corsivo simulato con shear geometrico;
- altezza lettere in mm;
- profondita estrusione in mm;
- larghezza lettere come scala X;
- smusso bordo;
- rotazione Z;
- offset X/Y/Z.

Per non appesantire il bundle web, i font non vengono importati come JSON inline.
Il controller importa gli URL con `?url`, li pubblica come asset separati e li
carica con `FontLoader.loadAsync()` solo quando servono. I font caricati vengono
messi in `textFontCache`; `textPreviewRequest` invalida anteprime asincrone
vecchie quando l'utente cambia valori rapidamente o resetta lo strumento.

Orientamento:

- in modalita rilievo, il testo estrude lungo la normale della faccia cliccata;
- in modalita sottrai/incidi, il testo resta orientato sulla normale esterna
  della faccia, quindi rimane leggibile e non specchiato. Il punto base viene
  spostato verso l'interno del solido della profondita richiesta e la geometria
  del cutter aggiunge un piccolo overlap verso l'esterno (`0,25 mm`) per evitare
  facce complanari instabili durante la CSG. Non usa scala negativa o inversione
  separata della profondita, per evitare geometrie CSG instabili.

Prestazioni:

- le curve del testo usano segmenti moderati per non generare triangoli inutili;
- `textApplyInProgress` evita doppie applicazioni durante un click ripetuto;
- prima dell'incisione vengono controllati i triangoli del testo e del modello:
  se la CSG sarebbe troppo pesante, l'operazione viene bloccata con un messaggio
  invece di lasciare il browser fermo.
- durante l'incisione testo `showBusy()` mostra un overlay modale e blocca input
  e scorciatoie finche la booleana non termina.

Limiti attuali:

- il corsivo e' una trasformazione geometrica, non una vera variante italic del
  font;
- la larghezza lettere scala orizzontalmente tutto il testo, quindi modifica
  anche la spaziatura visiva;
- l'incisione usa una booleana mesh, quindi valgono gli stessi limiti delle
  altre operazioni su STL sporchi o non chiusi.

## Strumento Linea

Lo strumento Linea permette di costruire guide 3D indipendenti e, quando le
guide chiudono un contorno, anche piccole facce applicabili al modello:

- clic su punti nel piano o sulla mesh;
- snap a griglia, vertici e punti medi;
- blocco asse tramite `snapPointToAxis()`;
- inferenza parallela tramite `snapPointToDirections()`;
- scelta del piano di disegno `Auto 3D`, `XY`, `XZ` o `YZ`;
- toggle per disattivare aggancio assi/parallele quando serve una linea obliqua
  libera;
- gli spigoli guida restano in scena anche se non chiudono subito una forma,
  quindi una linea singola puo' essere usata come guida di misura o costruzione;
- `Nuova linea` azzera solo la linea corrente, mantenendo gli spigoli gia'
  disegnati;
- cambiare piano (`Auto 3D`, `XY`, `XZ`, `YZ`) o toggle agganci non cancella
  piu' le linee gia' tracciate;
- cambiare strumento non cancella piu' gli spigoli gia' confermati: viene
  pulita solo l'eventuale linea corrente non conclusa;
- box, cilindro, taglio, testo e misura possono agganciarsi a estremi, punti
  medi e punti lungo il segmento delle guide;
- quando gli spigoli chiudono un contorno triangolare o una linea ritorna al
  punto iniziale, viene creata una faccia verde in anteprima;
- `Applica facce` scrive le facce in bozza nella mesh STL tramite
  `appendGeometryToModel()`: dopo l'applicazione le facce verdi vengono tolte
  dalla bozza, mentre gli spigoli guida restano visibili.

In `Auto 3D` il picker usa prima uno snap in spazio-schermo: se il cursore e'
vicino a un vertice o a un punto medio visibile, viene preso quel punto 3D reale
senza proiettarlo sul piano corrente. Questo serve per forme come piramidi,
coni semplificati o fianchi inclinati, dove una sequenza di linee deve passare
da un piano all'altro. Quando non c'e' un punto magnetico vicino, dopo il primo
punto viene usato un piano di costruzione davanti alla camera e passante per
l'ultimo punto, cosi' si puo' tracciare uno spigolo libero nello spazio e usare
il blocco assi per far salire una linea in Z.

Le modalita' `XY`, `XZ` e `YZ` restano disponibili come vincoli manuali. In quel
caso i punti non magnetici vengono proiettati sul piano scelto, utile per
sagome perfettamente piatte o profili da chiudere. Per una piramide si puo'
tracciare una linea dal centro/base verso l'apice, poi usare `Nuova linea` o
cliccare un punto gia' esistente per collegare l'apice ai vertici della faccia
di base. Se il lato di base esiste gia' nella mesh, due spigoli verso l'apice
bastano per creare la faccia triangolare. I segmenti vengono colorati in base
all'asse dominante: X rosso, Y verde, Z blu; le inferenze parallele usano un
colore viola.

Il box in basso a destra diventa `Lunghezza` quando Linea e' attiva. Dopo il
primo punto si puo' scrivere direttamente una misura, per esempio `115,26`, e
premere Invio. La direzione resta quella suggerita dal mouse o dall'asse
agganciato, la lunghezza viene forzata. Le facce create sono superfici
triangolate piatte, non solidi con spessore: eventuale solidificazione o offset
resta una funzione futura.

Gli snap del modello non usano piu' tutti i vertici triangolati dello STL come
bersagli principali. `setModelGeometry()` ricalcola `snapPoints` con
`collectDisplaySnapPoints()`, cioe' dai soli spigoli visibili/strutturali usati
anche per il wireframe del modello, piu' i centri delle regioni coplanari
(`centro faccia`). Questo mantiene comodi gli agganci al centro di una faccia
senza riattivare gli snap sulle diagonali interne create da booleane, fori o
mesh STL riparate. Le guide Linea, invece, rimangono snap target espliciti
tramite `sketchSnapTargets()`.
`constructionSnapTargets()` espone questi target a `pickWorkPoint()` per tutti
gli strumenti di posizionamento, mentre `findScreenSnapPoint()` gestisce anche
il caso di un target segmento (`start`/`end`) calcolando il punto 3D piu' vicino
al cursore sulla linea proiettata a schermo.

## Misure

`calculateMeasurement(start, end)` ritorna:

- distanza totale;
- delta X, Y, Z firmati;
- asse dominante;
- flag di allineamento asse.

La UI mostra linea totale tratteggiata e componenti colorate:

- X rosso;
- Y verde;
- Z blu.

## Trasforma

Lo strumento `Trasforma` (`G`) agisce sul corpo selezionato, non piu' su tutto
il modello, con input numerici:

- spostamento X/Y/Z in millimetri;
- rotazione X/Y/Z in gradi;
- scala uniforme.
- comandi rapidi per preparazione stampa: appoggia faccia selezionata su Z=0,
  ruota faccia selezionata verso il basso, centra il target sull'origine X/Y e
  scala uniformemente a una dimensione massima X/Y/Z.

Entrando in `Transform`, `setTool('transform')` forza `selectionMode = 'object'`.
Se era selezionata una faccia, la selezione viene convertita nel componente
connesso partendo da un triangolo della regione selezionata. Se non c'e' un
oggetto selezionato, `transformCurrentModel()` chiede di fare doppio click su un
corpo prima di applicare valori.

La trasformazione viene applicata direttamente ai vertici del componente
selezionato tramite `transformTrianglesInGeometry()`, usando il bounding box del
corpo come centro di rotazione/scala. I triangoli non selezionati vengono copiati
senza modifiche. Dopo `setModelGeometry()` vengono ricostruiti snap point, bordi
e bounding volume; non resta alcuna trasformazione pendente sulla mesh Three.js
che potrebbe confondere booleane, raycast o export STL successivi.

Gli input di Trasforma sono trasformazioni incrementali: una preview wireframe
blu viene aggiornata in tempo reale tramite la stessa matrice usata da
`transformCurrentModel()`. Dopo l'applicazione i valori vengono riportati a
spostamento/rotazione `0` e scala `1`, cosi' la stessa trasformazione non viene
riapplicata per errore. L'applicazione non chiama `fitView()`, altrimenti uno
spostamento puro sarebbe visivamente nascosto dal ricentramento automatico della
camera.

Per i comandi rapidi basati su faccia, `setTool('transform')` salva la normale
della faccia selezionata in `transformFaceReference` prima di convertire la
selezione al corpo connesso. Cosi Transform resta object-first ma puo comunque
orientare il corpo in base a una faccia scelta.

## Pattern / duplica in serie

Pattern parte da una riga del drawer `Objects`. E' legato ai corpi connessi, non
alle facce. Il drawer si apre accanto a Objects e lascia libero l'inspector.

- Pattern lineare: crea copie aggiuntive con offset progressivo X/Y/Z.
- Pattern circolare: crea copie aggiuntive attorno al centro del corpo scelto
  usando numero, raggio e asse.
- Il corpo originale resta fermo; il numero copie indica copie aggiuntive.
- Le copie sono cloni triangolari aggiunti con `combineGeometries()`, poi
  `setModelGeometry()` ricalcola corpi connessi e snap.

Non e' ancora un pattern parametrico: dopo l'applicazione, le copie sono normali
corpi STL e si modificano/esportano come qualunque altro componente connesso.

## Snap

`pickWorkPoint()` e' il punto comune per strumenti che posizionano elementi.
Prima prova lo snap in spazio-schermo verso guide di costruzione e snap
strutturali del modello; poi prova il raycast sul modello; se non colpisce e
`modelOnly` e' falso, interseca il piano Z=0. Infine applica:

- blocco asse opzionale;
- snap a griglia 1 mm;
- snap a target raccolti dalla geometria corrente e dalle guide Linea.

`collectDisplaySnapPoints()` raccoglie endpoint, punti medi e centri faccia
dalle geometrie di bordo filtrate. `createDisplayEdgesGeometry()` mostra solo
crease reali, cioe' spigoli condivisi da facce con normali diverse. Non mostra
piu' boundary aperti o spezzati lasciati dalle booleane: la mesh STL resta
triangolata, ma la facciata viene presentata liscia e gli snap non si agganciano
a quei residui. Quando il mouse passa sopra un target agganciabile la scena
mostra un marker: blu per vertici, arancione per punti medi, verde per centri
faccia, viola per punti lungo una guida.
Lo strumento Linea prova anche una prima inferenza parallela ai segmenti gia'
disegnati nella stessa sagoma.

Questo rende box, cilindri, tagli e linee piu prevedibili.

## Parsing numerico

`parseDecimal()` accetta virgola o punto. `formatDecimal()` usa virgola e taglia
zeri superflui. La UI resta orientata all'uso italiano, ma internamente i numeri
sono sempre `Number` JavaScript.

## UX attuale

Il modello operativo e' "strumento attivo + pannello contestuale":

- toolbar verticale con shortcut simili a SketchUp;
- inspector laterale solo per strumenti che richiedono parametri;
- statusbar per feedback immediato;
- campo misure in basso a destra;
- topbar con Apri STL, Rimuovi modello, Esporta STL.

Shortcut principali:

- `Spazio`: selezione;
- `P`: Spingi/Tira;
- `H`: foro;
- `F`: sposta foro;
- `B`: box;
- `C`: cilindro;
- `V`: cono;
- `I`: piramide;
- `K`: ingranaggio;
- `T`: sottrai;
- `L`: linea;
- `N`: piani 2D;
- `A`: testo 3D;
- `M`: misura;
- `G`: trasforma corpo selezionato;
- `O`: orbita;
- click singolo in `Select`: seleziona faccia;
- doppio click in `Select` o `Transform`: seleziona corpo;
- `Canc`: cancella anteprima, faccia o corpo selezionato;
- `Ctrl+Z`: annulla.
- `Ctrl+Y` / `Ctrl+Shift+Z`: rifai.

## Problemi noti e limiti

- STL e' una mesh triangolare, non contiene quote, vincoli o cronologia CAD.
- Spingi/Tira non e' parametrico: sui piani isolati crea pareti laterali mesh,
  ma non conserva vincoli CAD modificabili.
- Le booleane richiedono mesh ragionevolmente chiuse e pulite.
- La cancellazione di superfici puo' lasciare buchi aperti.
- Il testo 3D e' una geometria mesh, non testo modificabile dopo l'applicazione.
- La rilevazione fori e' euristica.
- Le normali di STL sporchi possono rendere ambigue facce, fori e sottrazioni.
- Undo/redo salva solo geometrie, non stato UI completo.
- L'ingranaggio viene aggiunto come corpo separato: e' stabile e stampabile, ma
  non e' una vera unione/sottrazione CSG del profilo dentato.
- `src/main.parts` contiene molta logica in un controller grande: nel tempo
  conviene estrarre moduli.

## Possibili miglioramenti futuri

- Riempimento buchi dopo cancellazione superficie.
- Chiusura buchi con anteprima/conferma e scelta della strategia di riempimento.
- Import/export STEP usando un motore CAD dedicato, se il progetto passa da
  editor mesh a ricostruzione solida.
- ID oggetto stabili e modello scena piu ricco rispetto agli indici dei
  componenti connessi.
- Gizmo 3D trascinabile con frecce/anelli se il pannello numerico non basta.
- Snap avanzati successivi: endpoint di bordi ricostruiti, perpendicolari,
  intersezioni e vincoli piu persistenti.
- Formato progetto piu ricco con cronologia, miniature e metadati per corpo.
- Test end-to-end con browser/Electron per click reali su canvas.
- Refactor del controller principale in moduli: `model-state`, `tools`,
  `overlays`, `history`, `ui-bindings`.

## Checklist prima di modificare

1. Leggere questo diario e `README.md`.
2. Controllare `git status --short --branch`.
3. Modificare i file sorgenti, non `src/main.js`.
4. Aggiungere test per logiche pure quando possibile.
5. Eseguire `npm test`.
6. Eseguire `npm run build`.
7. Se si tocca UI/canvas, provare anche `npm run dev` o `npm start`.
8. Aggiornare README, diario e wiki quando cambiano logiche o comportamento.
9. Fare commit e push dopo le verifiche, salvo richiesta contraria.

</details>
