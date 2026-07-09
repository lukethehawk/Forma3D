# Diario di sviluppo - Forma 3D

Ultimo aggiornamento: 2026-07-07

Questo file e' la memoria tecnica del progetto. Prima di fare nuove modifiche
conviene leggerlo insieme a `README.md`, per ricordare perche certe scelte sono
state fatte e dove intervenire senza rompere il flusso esistente.

## Obiettivo del progetto

Forma 3D e' un editor STL locale pensato per chi conosce SketchUp e vuole fare
modifiche semplici a modelli da stampa 3D senza caricare file online.

Il progetto non prova a ricostruire un CAD parametrico completo da STL. Tratta
il file come mesh triangolare e offre strumenti pratici:

- importazione ed esportazione STL;
- vista 3D con orbita, pan, zoom e viste rapide;
- selezione di superfici piane riconosciute come regioni complanari;
- Spingi/Tira su regioni piane;
- foro cilindrico con anteprima e offset numerici;
- riconoscimento e spostamento di fori cilindrici semplici;
- primitive booleane: box, cilindro, sottrazione;
- strumento Linea per sagome chiuse estrudibili;
- strumento Testo 3D con font, profondita, larghezza lettere ed effetti;
- misura tra punti con componenti X, Y, Z;
- annulla/ripristina;
- rimozione del modello corrente;
- cancellazione con `Canc` di superfici selezionate o anteprime attive.

## Stack tecnico

- Runtime: Node.js.
- Bundler/dev server: Vite.
- Shell desktop: Electron.
- Rendering 3D: Three.js.
- Controlli camera: `OrbitControls` di Three.js.
- STL: `STLLoader` e `STLExporter`.
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
- `src/geometry.js`: funzioni geometriche sulle mesh triangolari.
- `src/primitives.js`: creazione di box, cilindri, coni, piramidi, sagome
  estruse e testo 3D.
- `src/hole-detection.js`: riconoscimento euristico dei fori cilindrici.
- `src/snapping.js`: raccolta vertici e snap a griglia, punti e assi.
- `src/measurement.js`: calcolo distanza e componenti assiali.
- `src/number-format.js`: parsing e formattazione numeri con virgola/punto.
- `test/*.test.js`: test unitari delle parti pure.
- `electron/main.cjs`: finestra desktop Electron.
- `Avvia Forma 3D.bat`: avvio rapido su Windows.

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
- menu `Booleane`: `Sottrai`, `Foro`, `Sposta foro`.
- menu `2D`: `Linea`, `Piani`.

I sottomenu sono elementi HTML leggeri che si aprono verso destra con hover o
focus. I pulsanti reali mantengono `data-tool`, quindi il controller continua a
passare da `setTool(tool)` e le scorciatoie restano indipendenti dal layout.
Le voci dei sottomenu usano piccole icone SVG inline per distinguere solidi,
booleane e strumenti 2D senza allungare la toolbar.

La topbar mantiene `Apri STL` e `Rimuovi modello` come azioni primarie. Il menu
`Opzioni`, ultimo tasto a destra, contiene:

- selezione lingua `Italiano` / `English`;
- `Ripara mesh`;
- `Esporta STL`.

La lingua viene salvata in `localStorage` (`forma3d-language`). La funzione
`applyLanguage(language)` aggiorna i testi statici principali tramite una
tabella estendibile (`staticTranslations`) e i nomi tool/topbar tramite
`languageText`. I messaggi dinamici profondi restano in gran parte in italiano:
la struttura e' predisposta per portarli progressivamente nella stessa tabella.

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
relativi e funzionano sotto `https://lukethehawk.github.io/3Deditor/`.

Se dopo il push la pagina resta senza stile, controllare nelle impostazioni del
repository GitHub che Pages usi **GitHub Actions** come sorgente e non
`main / root`.

## Modello dati runtime

Il controller principale usa variabili di stato semplici:

- `model`: mesh Three.js principale caricata o creata.
- `edges`: bordi visuali calcolati da `createDisplayEdgesGeometry()`.
- `highlight`: overlay blu della superficie selezionata.
- `selected`: regione complanare selezionata, con normale e triangoli.
- `activeTool`: strumento attivo.
- `currentFileName`: nome usato per esportare.
- `undoStack` / `redoStack`: cloni di geometrie per annulla/ripristina.
- `snapPoints`: vertici raccolti dalla geometria corrente.
- stati temporanei degli strumenti: `holeCreate`, `holeMove`, `boxPlacement`,
  `cylinderPlacement`, `conePlacement`, `pyramidPlacement`, `planePlacement`,
  `gearPlacement`, `cutPlacement`, `textPlacement`, `sketchPoints`,
  `measurementStart`.

La scena contiene oggetti permanenti (griglia, luci, modello, edges) e overlay
temporanei. Gli overlay vengono marcati con `userData.transientOverlay` e
rimossi da `clearTransientOverlays()`.

## Flusso rendering e camera

La scena ha asse Z verso l'alto (`camera.up.set(0, 0, 1)`). La griglia Three.js
viene ruotata per rappresentare il piano XY. La camera usa `PerspectiveCamera`
con FOV 38 e viene riposizionata da `fitView()`.

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
geometria extra delle linee. `createDisplayEdgesGeometry()` usa `MODEL_EDGE_ANGLE`
e filtra anche edge lunghi, orizzontali e interni alle facce piane: dopo una CSG
le superfici incise possono contenere triangoli tecnici non condivisi, e non
devono apparire come bordi reali.

## Import STL

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

## Esportazione STL

`exportStl()` usa `STLExporter` in formato binario e scarica
`<nome>-modificato.stl`. Se non c'e' modello, il pulsante Esporta viene
disabilitato da `updateModelActions()`.

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
- restituisce un report con triangoli prima/dopo, vertici saldati, triangoli
  rimossi, vertici planarizzati, componenti, bordi aperti e spigoli
  non-manifold.

Questa riparazione e' conservativa: non chiude automaticamente buchi e non
inventa superfici mancanti. Se il report indica bordi aperti o spigoli
non-manifold, la mesh resta problematica per alcune booleane. La chiusura buchi
dovra' essere una funzione separata, idealmente con anteprima o conferma, per
non tappare aperture volutamente presenti nel pezzo.
La planarizzazione usa una tolleranza piccola e corregge solo vertici gia'
molto vicini a un piano dominante: non deve trasformare smussi, superfici curve
o inclinazioni volute in facce piatte.

La UI mostra un overlay modale durante il calcolo, applica la mesh riparata con
undo disponibile, aggiorna snap point, bordi visibili e normali tramite
`setModelGeometry()`.

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

## Annulla e ripristina

La storia conserva cloni di `BufferGeometry`.

- `snapshot()` salva la geometria corrente in `undoStack`, massimo 30 stati, e
  svuota `redoStack`.
- `restoreFrom(source, destination)` sposta la geometria corrente nello stack di
  destinazione, poi ripristina l'ultima geometria dello stack sorgente.

Le operazioni booleane e Spingi/Tira chiamano `snapshot()` prima di modificare.

Nota: la storia salva geometria, non metadati completi come nome file o tool
attivo. Se in futuro serve un undo piu completo, introdurre un oggetto stato con
`geometry`, `fileName`, `selection`, ecc.

## Selezione superfici

`selectAt(clientX, clientY)` fa raycast sulla mesh. Se colpisce:

1. prende `faceIndex`;
2. chiama `findCoplanarRegion(model.geometry, hit.faceIndex)`;
3. crea un overlay blu con `createRegionGeometry()`;
4. salva `selected = { point, normal, region }`;
5. aggiorna inspector e status.

`findCoplanarRegion()`:

- calcola normale e piano dal triangolo seed;
- cerca triangoli con normale quasi uguale e distanza dal piano entro tolleranza;
- costruisce adiacenze per vertici quantizzati;
- fa una visita a grafo per ottenere solo la regione connessa.

Questa logica serve a far percepire come unica faccia una superficie STL fatta
da molti triangoli.

## Spingi/Tira

`applyPushPull(distance)` richiede una selezione. Usa
`pushPullGeometry(model.geometry, selected.region, distance)`.

`pushPullGeometry()` muove tutti i vertici appartenenti alla regione selezionata
lungo la normale della regione. E' una modifica mesh diretta, non una booleana
CAD. Funziona bene su facce piane semplici; puo' creare geometrie non manifold
se usato su mesh complesse o facce con topologia difficile.

## Cancellazione con Canc

`handleDeleteKey(event)` intercetta `Delete` fuori dagli input.

Ordine di comportamento:

1. se c'e' uno strumento con anteprima/stato temporaneo, lo cancella;
2. altrimenti, se c'e' una superficie selezionata, elimina quei triangoli;
3. se non c'e' nulla da cancellare, mostra un messaggio di stato.

Le superfici si cancellano con `deleteSelectedRegion()`, che chiama
`deleteTrianglesFromGeometry()`.

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
applicazione tramite `applyPrimitiveGeometry()`.

Parametri:

- operazione: somma o sottrazione;
- asse: normale della faccia, X, Y, Z;
- numero denti: 6-200, default 24;
- modulo in millimetri, default 2;
- spessore, default 8 mm;
- foro centrale passante, default 5 mm, 0 per ingranaggio pieno;
- diametro mozzo e altezza mozzo;
- gioco/backlash semplificato;
- qualita: bassa, media, alta.

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
Per supportare questo caso, `pushPullGeometry()` riconosce i bordi aperti della
regione selezionata: sui solidi chiusi continua a spostare i vertici condivisi,
mentre su una faccia isolata duplica la faccia di partenza e crea le pareti
laterali lungo il movimento. In questo modo una faccia piatta puo' diventare un
prisma senza passare da una booleana.

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

Lo strumento `Trasforma` (`G`) agisce sul modello intero con input numerici:

- spostamento X/Y/Z in millimetri;
- rotazione X/Y/Z in gradi;
- scala uniforme.

La trasformazione viene applicata direttamente ai vertici della `BufferGeometry`
attorno al centro del modello, poi `setModelGeometry()` ricostruisce snap point,
bordi e bounding volume. Questo evita di lasciare una trasformazione sulla mesh
Three.js che potrebbe confondere booleane, raycast o export STL successivi.

Gli input di Trasforma sono trasformazioni incrementali: una preview wireframe
blu viene aggiornata in tempo reale tramite la stessa matrice usata da
`transformCurrentModel()`. Dopo l'applicazione i valori vengono riportati a
spostamento/rotazione `0` e scala `1`, cosi' la stessa trasformazione non viene
riapplicata per errore. L'applicazione non chiama `fitView()`, altrimenti uno
spostamento puro sarebbe visivamente nascosto dal ricentramento automatico della
camera.

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
- `G`: trasforma modello;
- `O`: orbita;
- `Canc`: cancella anteprima o superficie selezionata;
- `Ctrl+Z` / `Ctrl+Y`: annulla / ripristina.

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
- `src/main.parts` contiene molta logica in un controller grande: nel tempo
  conviene estrarre moduli.

## Possibili miglioramenti futuri

- Modalita oggetto con selezione dell'intero solido oltre alla selezione faccia.
- Riempimento buchi dopo cancellazione superficie.
- Chiusura buchi con anteprima/conferma e scelta della strategia di riempimento.
- Import/export STEP usando un motore CAD dedicato, se il progetto passa da
  editor mesh a ricostruzione solida.
- Pannello livelli/oggetti se si decide di supportare piu solidi separati.
- Gizmo 3D trascinabile con frecce/anelli se il pannello numerico non basta.
- Snap avanzati successivi: endpoint di bordi ricostruiti, perpendicolari,
  intersezioni e vincoli piu persistenti.
- Persistenza progetto in formato JSON interno, oltre a STL.
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
8. Aggiornare questo diario quando cambiano logiche o decisioni importanti.
