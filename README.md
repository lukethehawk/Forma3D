# Forma 3D

Editor STL locale con un flusso di lavoro ispirato a SketchUp.

## Avvio

Fare doppio clic su `Avvia Forma 3D.bat`. L'app si apre in una finestra desktop
e lavora localmente: i file STL non vengono caricati su servizi esterni.

Prima di fare nuove modifiche al codice, leggere anche
[`docs/DIARIO_SVILUPPO.md`](docs/DIARIO_SVILUPPO.md): contiene architettura,
logiche geometriche, limiti noti e possibili evoluzioni.

Da una cartella clonata da GitHub:

```bash
npm install
npm start
```

## Versione web su GitHub Pages

La pagina pubblica deve servire il build Vite, non i file sorgenti della root.
Il workflow `.github/workflows/pages.yml` esegue `npm ci`, `npm test`,
`npm run build` e pubblica la cartella `dist` su GitHub Pages.

Se GitHub Pages mostra HTML senza stile o senza scena 3D, nelle impostazioni del
repository verificare che Pages usi **GitHub Actions** come sorgente di deploy.

## Comandi principali

- `Spazio`: selezione
- `P`: Spingi/Tira
- `H`: foro con anteprima, offset assi e diametro/profondita
- `F`: sposta un foro esistente
- `B`: crea parallelepipedo
- `C`: crea cilindro
- `V`: crea cono
- `I`: crea piramide
- `K`: crea ingranaggio
- `N`: crea piani 2D piatti
- `T`: sottrai una figura di taglio da un solido/STL
- `L`: traccia linee e crea sagome chiuse estrudibili
- `A`: crea testo 3D con font, profondita, larghezza ed effetti
- `M`: misura tra due punti
- `O`: orbita
- rotellina premuta: orbita
- rotellina: zoom
- tasto destro: panoramica
- `Ctrl+Z` / `Ctrl+Y`: annulla / ripristina
- `Canc`: cancella l'anteprima attiva o la superficie selezionata

La misura mostra la distanza diretta e le componenti firmate sui tre assi:
rosso X, verde Y e blu Z.

Per spostare un foro, cliccare prima la parete cilindrica interna e poi il
nuovo centro. Il pannello permette di correggere numericamente gli spostamenti
sugli assi prima di applicare l'operazione.

Per creare un foro, cliccare il centro sulla superficie. L'anteprima verde
mostra il taglio; il pannello permette di modificare diametro, profondita e
spostamenti sugli assi prima di confermare.

Parallelepipedo, cilindro, cono, piramide, ingranaggio e sottrai usano
un'anteprima agganciabile al modello:
cliccare una superficie o un punto utile, correggere posizione e dimensioni dal
pannello, quindi applicare. Le operazioni possono sommare o sottrarre geometrie
per esportare un unico STL modificato.

Lo strumento ingranaggio crea una primitiva cilindrica a denti dritti con numero
denti, modulo, spessore, foro centrale, mozzo opzionale, gioco semplificato e
qualita del profilo. Il profilo e' un'approssimazione stampabile, non una
involuta industriale parametrica.

Lo strumento linea aiuta a disegnare sagome agganciandosi ai punti del modello e
agli assi principali quando il puntatore si avvicina alla direzione X, Y o Z.

Lo strumento testo posiziona l'angolo basso sinistro con un clic, poi aggiorna
l'anteprima in tempo reale mentre si scrive o si regolano font, bold, corsivo,
altezza, profondita, larghezza lettere, smusso, rotazione e offset. Il testo puo'
essere sommato al solido oppure sottratto per creare incisioni.

## Limiti del prototipo

Spingi/Tira funziona sulle superfici piane collegate riconosciute nella mesh.
Fori e operazioni booleane richiedono una mesh chiusa e priva di gravi errori.
Gli STL vengono interpretati in millimetri.
