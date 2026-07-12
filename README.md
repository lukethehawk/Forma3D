<div align="center">

# Forma3D

**A local and web STL editor inspired by SketchUp workflows.**

[![App](https://img.shields.io/badge/Open-Web_App-1f83bd?style=for-the-badge)](https://lukethehawk.github.io/Forma3D/)
[![Wiki](https://img.shields.io/badge/Open-Wiki-2e9a52?style=for-the-badge)](https://github.com/lukethehawk/Forma3D/wiki)
[![Docs](https://img.shields.io/badge/Read-Development_Diary-e46f2b?style=for-the-badge)](docs/DIARIO_SVILUPPO.md)
[![License](https://img.shields.io/badge/License-MIT-172637?style=for-the-badge)](LICENSE)

![Three.js](https://img.shields.io/badge/Three.js-3D-black?logo=three.js)
![Vite](https://img.shields.io/badge/Vite-build-646cff?logo=vite&logoColor=white)
![Electron](https://img.shields.io/badge/Electron-desktop-47848f?logo=electron&logoColor=white)
![STL](https://img.shields.io/badge/STL-mesh_editor-6f7a80)

### Language

[![English](https://img.shields.io/badge/%F0%9F%87%AC%F0%9F%87%A7-English-1f83bd?style=flat-square)](#english)
[![Italiano](https://img.shields.io/badge/%F0%9F%87%AE%F0%9F%87%B9-Italiano-e46f2b?style=flat-square)](#italiano)

</div>

---

<a id="english"></a>

## English

Forma3D is an STL editor for small 3D-printing model edits. It runs locally as
an Electron app and also as a GitHub Pages web app. Files are handled in the
browser/app: the workflow is designed around direct mesh editing, not uploading
models to external services.

> Before changing code, read the [development diary](docs/DIARIO_SVILUPPO.md).
> It documents architecture, mesh logic, known limits and design decisions.

### Try It

- Web app: https://lukethehawk.github.io/Forma3D/
- Wiki: https://github.com/lukethehawk/Forma3D/wiki

### Local Start

Windows shortcut:

```text
Avvia Forma3D.bat
```

From a cloned repository:

```bash
npm install
npm start
```

Web development:

```bash
npm run dev
```

Validation:

```bash
npm test
npm run build
```

### License

Forma3D is released under the [MIT License](LICENSE). Third-party licenses and
referenced project notices are tracked in
[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

### Core Workflow

| Action | Use |
| --- | --- |
| Single click in `Select` | Select a planar face |
| Double click in `Select` or `Transform` | Select the clicked connected body |
| `Push/Pull` | Extrude or recess selected planar faces |
| `Transform` | Move, rotate or scale only the selected body |
| `Objects` drawer | Open a compact body list from the bottom of the left toolbar |
| `Pattern` from Objects | Duplicate a selected body in linear or circular series |
| `Save project` / `Open project` | Store and restore `.forma3d.json` project state |
| `Repair mesh` | Weld vertices, remove bad triangles and planarize near-flat areas |
| `Shorten` | Cut an STL along X/Y/Z without scaling and cap the cut where possible |
| `Split` | Cut the full model with a plane, optionally separate both halves and export each side |
| `Hollow` | Keep the outer surface and create an inward shell with a wall thickness |
| `Export STL` / `Export OBJ` | Download the edited mesh |
| `Export selection` | Download only the selected face or body as STL |

### Shortcuts

| Key | Tool |
| --- | --- |
| `Space` | Select |
| `P` | Push/Pull |
| `B` | Box |
| `C` | Cylinder |
| `V` | Cone |
| `I` | Pyramid |
| `K` | Gear |
| `A` | 3D Text |
| `T` | Subtract |
| `X` | Shorten / cut |
| `U` | Hollow model |
| `H` | Hole |
| `F` | Move hole |
| `L` | Line guides |
| `N` | 2D Planes |
| `J` | Joint profiles |
| `M` | Measure |
| `G` | Transform |
| `O` | Orbit |
| `Delete` | Delete active preview, guide, face or selected body |
| `Ctrl+Z` / `Ctrl+Y` | Undo / redo |

Navigation:

- Middle mouse drag: orbit.
- Mouse wheel: zoom.
- Right mouse drag: pan.

### Tools

<details open>
<summary><strong>Select, Push/Pull and Transform</strong></summary>

- `Select`: single click selects a face; double click selects the clicked body.
- `Push/Pull`: works on selected planar faces. New 2D planes are automatically
  selected as faces so they can be pushed/pulled immediately. The optional
  visual sphere control lets you drag along the face normal, previews the
  extrusion/recess before release, snaps to 1 mm with `Shift`, and cancels the
  drag with `Esc`. On large meshes the preview is simplified, while the numeric
  input remains available.
- `Transform`: automatically switches to Object mode and edits only the selected
  connected body. Quick actions can place a selected face on the print bed,
  rotate that face downward, center the target on the X/Y origin, or scale it to
  a maximum X/Y/Z size.
- `Objects`: opens a collapsible drawer with connected bodies. Rows support
  rename, select, pattern, export and delete without occupying the viewport
  permanently. `Pattern` opens a side drawer for linear copies by X/Y/Z distance
  or circular copies by count, radius and axis.
- `History`: opens a compact drawer below Objects with the last mesh snapshots.
  It is not a parametric CAD timeline: `Ctrl+Z`/`Ctrl+Y` remain the main undo
  mechanism, and clicking a previous entry jumps back through the same undo/redo
  stacks.
</details>

<details>
<summary><strong>Solids</strong></summary>

The `Solids` menu contains:

- Box
- Cylinder
- Cone
- Pyramid
- Gear
- 3D Text

Gears are added as separate STL bodies without heavy booleans, with an 80-tooth
limit to keep the browser responsive.

</details>

<details>
<summary><strong>Booleans</strong></summary>

The `Booleans` menu contains:

- Subtract
- Shorten
- Split
- Hollow
- Hole
- Move hole

Boolean operations work best on closed and reasonably clean meshes.
`Shorten` works on the selected body by default, not the whole scene bounding
box. Select a body first, then choose the cut axis, the length to remove and the
cut center coordinate. Enable `Apply to whole file` when you intentionally want
the older whole-mesh workflow, for example after a cut has split one functional
part into separate connected components. If the orange cut volume stays inside
the target, Forma3D removes the middle section and closes the gap. If it touches
an edge, Forma3D automatically turns it into a side cut and keeps the opposite
side. Very dirty, non-manifold or hollow cross-sections can still need
slicer/mesh repair checks.

`Split` is a whole-model plane cut for print preparation. It previews the cut
plane, can cap cut surfaces, can add a small separation gap between the two
halves, and can export the negative or positive side without applying the split
to the current scene.

`Hollow` is also mesh-first. It keeps the original outside triangles, creates an
inner surface offset along averaged vertex normals, reverses the inner winding,
and closes open boundaries with side walls when possible. It is not a
parametric CAD offset: dirty STL files, non-manifold areas, details smaller than
the wall thickness and tight fillets can still create self-intersections or
surfaces that need slicer validation. Drain holes and hollowing only the
selected body are documented future steps.

</details>

<details>
<summary><strong>Repair Mesh</strong></summary>

`Repair mesh` is a conservative STL repair pass. It can weld nearby vertices,
remove degenerate or duplicate triangles, orient triangles more consistently,
planarize vertices close to dominant flat areas, detect boundary loops, close
small planar holes, and report disconnected components.

It is intentionally not a universal mesh fixer. It does not solve complex
self-intersections, severe non-manifold topology, global remeshing or CAD
reconstruction. MeshFix, MeshLab, MeshLabJS, ADMesh and CGAL were reviewed only
as conceptual references for terminology and workflow; Forma3D does not copy or
derive GPL/AGPL code from them.

</details>

<details>
<summary><strong>2D and construction</strong></summary>

The `2D` menu contains:

- Line guides
- Flat planes: rectangle, square and circle
- Joint profiles: arc, dovetail and T-slot presets for tabs, slots and keyed
  fits. They can be applied as a flat face for Push/Pull, or extruded directly
  as add/subtract geometry.

Line guides persist as construction geometry and can create closed faces.

</details>

### Repository Map

| Path | Purpose |
| --- | --- |
| `index.html` | UI markup |
| `src/style.css` | Layout and visual design |
| `src/main.parts/*.js` | Main controller source |
| `src/main.js` | Generated file, do not edit manually |
| `src/geometry.js` | Mesh selection, repair, push/pull, plane cut and geometry helpers |
| `src/primitives.js` | Solid primitives, text, planes and gears |
| `src/snapping.js` | Grid, point, axis and inference snapping |
| `src/measurement.js` | Measurement logic |
| `src/hole-detection.js` | Cylindrical hole detection |
| `test/*.test.js` | Unit tests |
| `docs/DIARIO_SVILUPPO.md` | Technical development diary |

### Project Files and Export

Forma3D keeps STL as the main interchange format, but `Save project` writes a
local `.forma3d.json` file with project metadata: app version, model name,
units, source STL name, camera, connected-body metadata, construction guides and
triangle geometry. `Open project` restores that state without uploading
anything.

Exports include the full model as STL, the full model as OBJ, and the current
selection as STL. File names are sanitized from the current model/project name.

### Large STL and Performance Mode

Forma3D does not impose a fixed upload limit because files are opened locally in
the browser or desktop app. After import, the file name in the topbar shows a
small complexity badge; clicking it opens model details with file size,
triangles, vertices and class:

- Light: under 50k triangles.
- Medium: 50k to 250k triangles.
- Large: 250k to 1M triangles.
- Very large: above 1M triangles.

Large files remain openable, but performance depends on RAM, GPU and triangle
count. For very large meshes, automatic connected-body analysis is deferred so
the view can stay responsive; edges, booleans and some analyses may be
simplified or limited.

### GitHub Pages

GitHub Pages must serve the Vite build output, not the repository root. The
workflow in `.github/workflows/pages.yml` runs tests, builds the app and
publishes `dist`.

If the public page appears unstyled or without the 3D scene, check that GitHub
Pages is configured to deploy from **GitHub Actions**.

### Current Limits

Forma3D edits STL meshes. STL has no CAD history, constraints or parametric
features. Some operations create separate bodies inside the same STL; slicers
usually handle them, but this is not always the same as a perfect CSG union.

---

<a id="italiano"></a>

## Italiano

Forma3D e' un editor STL per piccole modifiche a modelli destinati alla stampa
3D. Funziona come app desktop Electron e anche come app web su GitHub Pages. I
file vengono gestiti localmente nel browser/app: il flusso e' pensato per
modifiche dirette su mesh, non per caricare modelli su servizi esterni.

> Prima di modificare codice, leggere il
> [diario di sviluppo](docs/DIARIO_SVILUPPO.md). Contiene architettura, logiche
> mesh, limiti noti e decisioni tecniche.

### Prova l'app

- App web: https://lukethehawk.github.io/Forma3D/
- Wiki: https://github.com/lukethehawk/Forma3D/wiki

### Avvio locale

Scorciatoia Windows:

```text
Avvia Forma3D.bat
```

Da repository clonato:

```bash
npm install
npm start
```

Sviluppo web:

```bash
npm run dev
```

Verifiche:

```bash
npm test
npm run build
```

### Licenza

Forma3D e' rilasciato con [licenza MIT](LICENSE). Le licenze dei progetti terzi
e le note sui pattern di riferimento sono in
[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

### Flusso principale

| Azione | Uso |
| --- | --- |
| Click singolo in `Select` | Seleziona una faccia piana |
| Doppio click in `Select` o `Transform` | Seleziona il corpo connesso cliccato |
| `Push/Pull` | Estrude o incide facce piane selezionate |
| `Transform` | Sposta, ruota o scala solo il corpo selezionato |
| Drawer `Objects` | Apre una lista compatta dei corpi dalla toolbar sinistra |
| `Pattern` da Objects | Duplica un corpo selezionato in serie lineare o circolare |
| `Save project` / `Open project` | Salva e riapre lo stato `.forma3d.json` |
| `Repair mesh` | Salda vertici, rimuove triangoli difettosi e planarizza aree quasi piatte |
| `Shorten` | Taglia un STL lungo X/Y/Z senza scalarlo e richiude dove possibile |
| `Split` | Taglia il modello intero con un piano, separa le meta ed esporta i lati |
| `Hollow` | Mantiene la superficie esterna e crea un guscio interno con spessore parete |
| `Export STL` / `Export OBJ` | Scarica la mesh modificata |
| `Export selection` | Scarica solo la faccia o il corpo selezionato come STL |

### Scorciatoie

| Tasto | Strumento |
| --- | --- |
| `Spazio` | Select |
| `P` | Push/Pull |
| `B` | Box |
| `C` | Cilindro |
| `V` | Cono |
| `I` | Piramide |
| `K` | Ingranaggio |
| `A` | Testo 3D |
| `T` | Sottrai |
| `X` | Accorcia / taglia |
| `U` | Svuota modello |
| `H` | Foro |
| `F` | Sposta foro |
| `L` | Linee guida |
| `N` | Piani 2D |
| `J` | Profili incastro |
| `M` | Misura |
| `G` | Trasforma |
| `O` | Orbita |
| `Canc` | Cancella anteprima, guida, faccia o corpo selezionato |
| `Ctrl+Z` / `Ctrl+Y` | Annulla / ripristina |

Navigazione:

- Rotellina premuta: orbita.
- Rotellina: zoom.
- Tasto destro: panoramica.

### Strumenti

<details open>
<summary><strong>Select, Push/Pull e Transform</strong></summary>

- `Select`: click singolo seleziona una faccia; doppio click seleziona il corpo
  cliccato.
- `Push/Pull`: lavora su facce piane selezionate. I nuovi piani 2D vengono
  selezionati automaticamente come facce. Il controllo visuale opzionale con
  sfera permette di trascinare lungo la normale della faccia, vedere una
  preview prima del rilascio, agganciare a 1 mm con `Shift` e annullare il drag
  con `Esc`. Su mesh grandi la preview viene semplificata, mentre l'input
  numerico resta disponibile.
- `Transform`: passa automaticamente a Object mode e modifica solo il corpo
  connesso selezionato. Le azioni rapide possono appoggiare una faccia
  selezionata sul piano di stampa, ruotarla verso il basso, centrare il target
  sull'origine X/Y o scalarlo a una dimensione massima X/Y/Z.
- `History`: apre un drawer compatto sotto Oggetti con gli ultimi snapshot mesh.
  Non e' una timeline CAD parametrica: `Ctrl+Z`/`Ctrl+Y` restano il meccanismo
  principale, e cliccare una voce precedente torna indietro usando gli stessi
  stack undo/redo.
- `Objects`: apre un drawer richiudibile con i corpi connessi. Le righe
  permettono rinomina, selezione, pattern, export ed eliminazione senza occupare
  il viewport in modo permanente. `Pattern` apre un drawer laterale per copie
  lineari tramite distanza X/Y/Z o copie circolari tramite numero, raggio e asse.
</details>

<details>
<summary><strong>Solids</strong></summary>

Il menu `Solids` contiene:

- Box
- Cilindro
- Cono
- Piramide
- Ingranaggio
- Testo 3D

Gli ingranaggi vengono aggiunti come corpi STL separati senza booleane pesanti,
con limite a 80 denti per mantenere il browser reattivo.

</details>

<details>
<summary><strong>Booleans</strong></summary>

Il menu `Booleans` contiene:

- Sottrai
- Accorcia
- Separa
- Svuota
- Foro
- Sposta foro

Le booleane funzionano meglio su mesh chiuse e abbastanza pulite.
`Accorcia` lavora di default sul corpo selezionato, non sul bounding box di
tutta la scena. Seleziona prima un corpo, poi scegli asse di taglio, lunghezza da
rimuovere e coordinata del centro taglio. Attiva `Applica a tutto il file` quando
vuoi intenzionalmente il vecchio flusso sull'intera mesh, per esempio dopo un
taglio che ha diviso un pezzo funzionale in piu componenti connesse. Se il
volume arancione resta dentro al target, Forma3D rimuove la sezione mediana e
richiude il vuoto. Se tocca un bordo, Forma3D lo trasforma automaticamente in un
taglio laterale e mantiene il lato opposto. Sezioni cave molto sporche o
non-manifold possono richiedere comunque controlli in slicer o riparazione mesh.

`Split/Separa` e' un taglio piano sull'intero modello per preparare pezzi da
stampare. Mostra la preview del piano, puo chiudere le superfici tagliate,
aggiungere un piccolo distacco fra le due meta ed esportare lato negativo o
positivo senza applicare il taglio alla scena corrente.

`Svuota` e' mesh-first. Mantiene i triangoli esterni originali, crea una
superficie interna spostata lungo le normali medie dei vertici, inverte il
winding interno e chiude i bordi aperti con pareti laterali quando possibile.
Non e' un offset CAD parametrico: STL sporchi, aree non-manifold, dettagli piu
piccoli dello spessore parete e raccordi stretti possono creare
auto-intersezioni o superfici da verificare nello slicer. Fori di drenaggio e
svuotamento del solo corpo selezionato restano passi futuri.

</details>

<details>
<summary><strong>Repair Mesh</strong></summary>

`Repair mesh` e' una riparazione STL conservativa. Puo saldare vertici vicini,
rimuovere triangoli degeneri o duplicati, rendere piu coerente l'orientamento
dei triangoli, planarizzare vertici vicini a grandi superfici piatte, rilevare
loop di bordo, chiudere piccoli buchi planari e segnalare componenti scollegate.

Non e' un riparatore universale. Non risolve self-intersection complesse,
topologie non-manifold gravi, remeshing globale o ricostruzione CAD. MeshFix,
MeshLab, MeshLabJS, ADMesh e CGAL sono stati consultati solo come riferimenti
concettuali per terminologia e workflow; Forma3D non copia e non deriva codice
GPL/AGPL da questi progetti.

</details>

<details>
<summary><strong>2D e costruzione</strong></summary>

Il menu `2D` contiene:

- Linee guida
- Piani piatti: rettangolo, quadrato e cerchio
- Profili incastro: preset arco, coda di rondine e T-slot per linguette, cave e
  accoppiamenti. Possono essere applicati come faccia piatta per Spingi/Tira,
  oppure estrusi direttamente in aggiunta/sottrazione.

Le linee restano come guide di costruzione e possono creare facce chiuse.

</details>

### Mappa repository

| Percorso | Scopo |
| --- | --- |
| `index.html` | Markup UI |
| `src/style.css` | Layout e stile |
| `src/main.parts/*.js` | Sorgente del controller principale |
| `src/main.js` | File generato, non modificare a mano |
| `src/geometry.js` | Selezione mesh, riparazione, push/pull e helper geometrici |
| `src/primitives.js` | Primitive solide, testo, piani e ingranaggi |
| `src/snapping.js` | Snap a griglia, punti, assi e inferenze |
| `src/measurement.js` | Logica misure |
| `src/hole-detection.js` | Riconoscimento fori cilindrici |
| `test/*.test.js` | Test unitari |
| `docs/DIARIO_SVILUPPO.md` | Diario tecnico di sviluppo |

### File progetto ed export

Forma3D mantiene STL come formato principale di scambio, ma `Save project`
scrive un file locale `.forma3d.json` con metadati di progetto: versione app,
nome modello, unita, STL sorgente, camera, metadati dei corpi connessi, guide di
costruzione e geometria triangolare. `Open project` ripristina quello stato
senza caricare nulla online.

Gli export includono il modello completo come STL, il modello completo come OBJ
e la selezione corrente come STL. I nomi file vengono ripuliti a partire dal
nome modello/progetto corrente.

### STL grandi e modalita performance

Forma3D non impone un limite fisso di upload perche i file vengono aperti
localmente nel browser o nell'app desktop. Dopo l'import, il nome file nella
topbar mostra un piccolo badge di complessita; cliccandolo si apre un dettaglio
con dimensione file, triangoli, vertici e classe:

- Leggero: sotto 50k triangoli.
- Medio: da 50k a 250k triangoli.
- Grande: da 250k a 1M triangoli.
- Molto grande: sopra 1M triangoli.

I file grandi restano apribili, ma le prestazioni dipendono da RAM, GPU e
numero di triangoli. Sulle mesh molto grandi l'analisi automatica dei corpi
connessi viene rimandata per mantenere la vista reattiva; bordi, booleane e
alcune analisi possono essere semplificate o limitate.

### GitHub Pages

GitHub Pages deve servire il build Vite, non la root del repository. Il workflow
in `.github/workflows/pages.yml` esegue test, build e pubblica `dist`.

Se la pagina pubblica appare senza stile o senza scena 3D, controllare che
GitHub Pages usi **GitHub Actions** come sorgente di deploy.

### Limiti attuali

Forma3D modifica mesh STL. STL non contiene cronologia CAD, vincoli o feature
parametriche. Alcune operazioni creano corpi separati nello stesso STL; molti
slicer li gestiscono correttamente, ma non sempre equivalgono a una unione CSG
perfetta.
