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

- `index.html`: markup dell'interfaccia. Contiene topbar, toolbar verticale,
  viewport, inspector laterale e statusbar.
- `src/style.css`: stile dell'app. Mantiene una UI compatta e tecnica, ispirata
  agli strumenti desktop di modellazione.
- `src/main.parts/*.js`: sorgente reale del controller principale, diviso in
  parti per renderlo gestibile.
- `src/main.js`: file generato da `scripts/assemble-main.cjs`; non va editato a
  mano.
- `scripts/assemble-main.cjs`: concatena le parti `main.partXX.js` in
  `src/main.js`.
- `src/geometry.js`: funzioni geometriche sulle mesh triangolari.
- `src/primitives.js`: creazione di box, cilindri e sagome estruse.
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
- `edges`: bordi visuali calcolati da `EdgesGeometry`.
- `highlight`: overlay blu della superficie selezionata.
- `selected`: regione complanare selezionata, con normale e triangoli.
- `activeTool`: strumento attivo.
- `currentFileName`: nome usato per esportare.
- `undoStack` / `redoStack`: cloni di geometrie per annulla/ripristina.
- `snapPoints`: vertici raccolti dalla geometria corrente.
- stati temporanei degli strumenti: `holeCreate`, `holeMove`, `boxPlacement`,
  `cylinderPlacement`, `cutPlacement`, `sketchPoints`, `measurementStart`.

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

## Gestione modello corrente

`setModelGeometry(geometry, recordHistory)` e' il punto unico per sostituire la
mesh principale:

- salva snapshot se richiesto;
- pulisce overlay e strumenti;
- rimuove e dispone la vecchia geometria;
- normalizza attributi e bounding volume;
- crea la mesh con `modelMaterial`;
- ricalcola vertici per snap;
- aggiorna edges e pulsanti.

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
- `createExtrudedPolygonGeometry(points, height)`: estrude una sagoma 2D chiusa.

`applyPrimitiveGeometry(geometry, operation, successMessage)`:

- se non c'e' modello e l'operazione e' addizione, crea un nuovo modello;
- se l'operazione e' sottrazione senza modello, mostra errore;
- altrimenti chiama `booleanGeometry()`.

`booleanGeometry()` usa `three-bvh-csg` con `ADDITION` o `SUBTRACTION`.

## Strumento Linea

Lo strumento Linea permette di costruire sagome chiuse:

- clic su punti nel piano o sulla mesh;
- snap a griglia o vertici;
- blocco asse tramite `snapPointToAxis()`;
- chiusura tornando vicino al primo punto;
- estrusione con addizione o sottrazione.

Il box in basso a destra diventa `Lunghezza` quando Linea e' attiva. Dopo il
primo punto si puo' scrivere direttamente una misura, per esempio `115,26`, e
premere Invio. La direzione resta quella del mouse, la lunghezza viene forzata.

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

## Snap

`pickWorkPoint()` e' il punto comune per strumenti che posizionano elementi.
Prima prova il raycast sul modello; se non colpisce e `modelOnly` e' falso,
interseca il piano Z=0. Poi applica:

- blocco asse opzionale;
- snap a griglia 1 mm;
- snap a vertici raccolti dalla geometria corrente.

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
- `T`: sottrai;
- `L`: linea;
- `M`: misura;
- `O`: orbita;
- `Canc`: cancella anteprima o superficie selezionata;
- `Ctrl+Z` / `Ctrl+Y`: annulla / ripristina.

## Problemi noti e limiti

- STL e' una mesh triangolare, non contiene quote, vincoli o cronologia CAD.
- Spingi/Tira sposta vertici selezionati; non ricostruisce superfici laterali
  parametriche.
- Le booleane richiedono mesh ragionevolmente chiuse e pulite.
- La cancellazione di superfici puo' lasciare buchi aperti.
- La rilevazione fori e' euristica.
- Le normali di STL sporchi possono rendere ambigue facce, fori e sottrazioni.
- Undo/redo salva solo geometrie, non stato UI completo.
- `src/main.parts` contiene molta logica in un controller grande: nel tempo
  conviene estrarre moduli.

## Possibili miglioramenti futuri

- Modalita oggetto con selezione dell'intero solido oltre alla selezione faccia.
- Riempimento buchi dopo cancellazione superficie.
- Riparazione mesh: weld vertici, rimozione triangoli degeneri, orientamento
  normali, chiusura buchi.
- Import/export STEP usando un motore CAD dedicato, se il progetto passa da
  editor mesh a ricostruzione solida.
- Pannello livelli/oggetti se si decide di supportare piu solidi separati.
- Gizmo di trasformazione per sposta/ruota/scala.
- Snap piu ricchi: midpoint, endpoint evidenziati, inferenze parallele.
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
