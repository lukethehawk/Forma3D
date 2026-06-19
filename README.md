# Forma 3D

Editor STL locale con un flusso di lavoro ispirato a SketchUp.

## Avvio

Fare doppio clic su `Avvia Forma 3D.bat`. L'app si apre in una finestra desktop
e lavora localmente: i file STL non vengono caricati su servizi esterni.

## Comandi principali

- `Spazio`: selezione
- `P`: Spingi/Tira
- `H`: foro con anteprima, offset assi e diametro/profondita
- `F`: sposta un foro esistente
- `M`: misura tra due punti
- `O`: orbita
- rotellina premuta: orbita
- rotellina: zoom
- tasto destro: panoramica
- `Ctrl+Z` / `Ctrl+Y`: annulla / ripristina

La misura mostra la distanza diretta e le componenti firmate sui tre assi:
rosso X, verde Y e blu Z.

Per spostare un foro, cliccare prima la parete cilindrica interna e poi il
nuovo centro. Il pannello permette di correggere numericamente gli spostamenti
sugli assi prima di applicare l'operazione.

Per creare un foro, cliccare il centro sulla superficie. L'anteprima verde
mostra il taglio; il pannello permette di modificare diametro, profondita e
spostamenti sugli assi prima di confermare.

## Limiti del prototipo

Spingi/Tira funziona sulle superfici piane collegate riconosciute nella mesh.
Il foro richiede una mesh chiusa e priva di gravi errori. Gli STL vengono
interpretati in millimetri.
