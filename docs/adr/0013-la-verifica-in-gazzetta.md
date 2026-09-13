# 0013 — Come si verifica in Gazzetta Ufficiale, e quando una mancata attuazione si può pubblicare

- **Stato:** Accettata
- **Data:** 2026-09-13
- **Modifica:** nessuna. Completa una promessa che il repository faceva da tempo.

## Contesto

Il contatore nazionale dice una cifra grande e una frase piccola. La cifra sono
i giorni trascorsi dalla scadenza dei termini che le leggi si sono date per i
propri provvedimenti attuativi. La frase piccola dice che quella cifra **misura
termini scaduti, non attuazioni mancate**: sappiamo che una data è passata, non
sappiamo se il decreto sia poi arrivato.

Era una frase onesta e un lavoro non fatto. Il controllo `attuazione-mancante`
esisteva già completo — estrae il mandato dal comma, calcola la scadenza,
compone la segnalazione — e aveva davanti un cancello chiuso: `implementationCoverage`,
alimentato da una funzione che leggeva il gold standard e restituiva un insieme
vuoto. Zero segnalazioni, da sempre, per una ragione buona:

> «Non ho trovato il decreto» e «il decreto non esiste» sono due affermazioni
> diverse, e su un corpus parziale la prima non autorizza la seconda.

Per autorizzarla bisogna andare a guardare in Gazzetta Ufficiale, mandato per
mandato. Questa ADR registra come lo facciamo e a quali condizioni quel cancello
si apre.

## La fonte

**La Gazzetta Ufficiale della Repubblica Italiana, Serie Generale**, interrogata
con il suo modulo di ricerca per atto.

Non è la prima scelta che abbiamo valutato, ed è giusto dire perché è la scelta
rimasta.

- Il **monitoraggio dell'attuazione normativa** dell'Ufficio per il programma di
  governo sarebbe la fonte migliore: è esattamente questo dato, tenuto da chi ha
  il dovere di tenerlo. Da qui `programmagoverno.gov.it` non risponde e
  `monitoraggio.programmagoverno.gov.it` non si raggiunge affatto. Resta la
  fonte da preferire il giorno in cui torna interrogabile, e il modulo è
  costruito perché sostituirla significhi scrivere un altro client, non
  riscrivere la verifica.
- Gli **open data della Camera** descrivono l'iter parlamentare, non la
  pubblicazione dei decreti ministeriali: rispondono a un'altra domanda.
- **Normattiva**, che già usiamo, contiene gli atti normativi ma non i decreti
  ministeriali di attuazione, che sono la maggioranza di quello che cerchiamo.

Della Gazzetta non esiste un'API documentata né un dataset aperto: c'è un modulo
di ricerca che risponde in HTML, e lo interroghiamo come lo interrogherebbe una
persona. Una richiesta alla volta, almeno un secondo e mezzo di pausa in mezzo,
uno `user-agent` che dichiara il nome del progetto e l'indirizzo del repository.
La verifica dell'intero corpus dura settimane di notti. Va bene: quel servizio
lo pagano tutti.

## La decisione

**Tre esiti, mai due insieme, e il terzo non è un fallimento.**

### `adottato`

Esiste un provvedimento che attua quel comma, e ne abbiamo la prova letterale.

Si cerca la citazione del comma — «articolo 1, comma 1028, della legge 30
dicembre 2018, n. 145», e la variante con «art.» — fra i risultati si tengono
solo quelli del **tipo previsto dal mandato** (un mandato che dice «con decreto
del Presidente del Consiglio dei ministri» non è attuato da una legge), e poi si
legge il provvedimento: o il suo titolo dichiara il mandato che attua, o una
clausola del suo preambolo lo cita. Senza quella riga non si afferma niente.

Il controllo sul testo non è un di più. Il motore della Gazzetta è più largo di
quanto sembri: interrogato con «articolo 2 del decreto legge 29 dicembre 2010,
n. 225» risponde anche a chi scrive «Visto il comma 37, dell'articolo 2, del
decreto-legge 29 dicembre 2010, n. 225» — stessa citazione, altro ordine — e con
la stessa disinvoltura a chi nomina quell'articolo e quella legge senza che
l'uno riguardi l'altra. Fidarsi del risultato di ricerca vorrebbe dire
pubblicare corrispondenze inventate.

### `non-adottato`

Nessun provvedimento attuativo di quell'atto è stato pubblicato, e questa è
l'unica affermazione che apre il cancello.

Non poggia sulla citazione del comma. I preamboli la scrivono in dieci modi —
«art. 1, co. 5, della l. 81/2017» è italiano corrente — e non trovarla non prova
niente. Poggia sulla citazione dell'atto ridotta all'osso, data e numero: «22
maggio 2017, n. 81». Quella stringa è dentro ogni forma di richiamo, per esteso
o abbreviata. Se **non compare in nessun atto della Serie Generale**
nell'intervallo fra l'entrata in vigore e oggi, allora nessun provvedimento
attuativo di quella legge è stato pubblicato in Gazzetta, e la frase regge.

È una regola severa, e la conseguenza si vede subito: **le leggi molto citate
non producono quasi mai un `non-adottato`**. La legge di bilancio è richiamata
da centinaia di atti, e su di essa la domanda larga non conclude. Resteremo con
una copertura bassa per molto tempo.

È il verso giusto in cui sbagliare. Una copertura bassa costa segnalazioni che
non facciamo; una copertura gonfiata costerebbe un'affermazione falsa su una
legge, e quella non si recupera. Una sola affermazione falsa distrugge più di
quanto dieci corrette costruiscano.

### `non-verificabile`

Tutto il resto, e va detto invece che nascosto.

Ci finiscono: il mandato che dice «con decreto» senza nominare chi lo adotta
(non sappiamo in che forma cercarlo); il mandato non agganciato a un articolo o
a un comma (un provvedimento che richiama l'articolo intero può attuare un altro
dei suoi commi); l'atto che non ha estremi citabili in Gazzetta, comprese le
leggi regionali, che nella Serie Generale non ci sono; la ricerca che restituisce
più di quanto il portale mostri, o più provvedimenti dello stesso tipo, o
nessuno di cui si riesca a leggere il testo; il portale che risponde male; e la
pagina che risponde 200 ma non è quella dei risultati.

Quest'ultimo caso merita una riga. La sessione del portale vale per **una**
ricerca: consumata, la richiesta successiva riceve la pagina iniziale, con uno
stato 200 e la forma di una pagina normale. Letta come «nessun risultato»,
diventa il modo più facile che esista di affermare il falso su una legge. Il
client ricarica il modulo prima di ogni ricerca, e il parser rifiuta
esplicitamente una pagina che non riconosce.

## Il cancello

**Una segnalazione di `attuazione-mancante` nasce solo dove esiste una verifica
`non-adottato` per quel mandato.**

La granularità è il **mandato**, non l'atto, e la differenza non è accademica:
una legge può prevedere dieci decreti, nove arrivati e uno no. Un cancello per
atto pubblicherebbe dieci segnalazioni, nove delle quali false. La copertura per
atto resta ammessa per una sola via, il gold standard, perché è l'unica
granularità che una fonte giuridica esterna ci dà.

Restano intatti la soglia dell'85% di precisione (ADR 0002) e il meccanismo
delle revisioni: la verifica in Gazzetta è una condizione **in più**, non una
scorciatoia che salta le altre.

## La prova

Ogni verifica registra, sempre e non solo quando trova: il mandato, la query
esatta, l'URL interrogato, la data e l'ora, l'intervallo di anni coperto, quanti
atti ha restituito la ricerca, e il motivo dell'esito in lingua comune. Quando
il provvedimento c'è, anche i suoi estremi — tipo, data, numero di Gazzetta,
codice redazionale, link alla scheda — e la citazione letterale su cui si basa
la corrispondenza.

Senza la prova la verifica non si può contestare, e una verifica che non si può
contestare non vale niente. Le righe finiscono nel dataset pubblico
(`verifiche.jsonl`), **comprese quelle `non-verificabile`**: sapere dove la
verifica non arriva è un'informazione, e tenerla fuori farebbe sembrare la
copertura migliore di com'è.

## Il contatore

`snapshotCounter()` guadagna tre numeri: quanti mandati sono stati verificati,
per quanti il decreto è arrivato **dopo** la scadenza, per quanti non risulta
pubblicato. Il caveat li riporta.

Finché la copertura è zero il caveat resta quello di prima, parola per parola.
Un avvertimento che cambia forma senza che sia cambiato niente insegna al
lettore che quella riga è decorativa.

L'etichetta del contatore non cambia mai: continua a dire «giorni trascorsi
dalla scadenza dei termini». È la cosa che misuriamo su **tutti** i mandati, e
non diventa un'altra cosa perché di alcuni sappiamo di più.

## Dove sta il codice, e perché lì

In `packages/corpus/src/gazzetta/`, accanto a `consulta/`, e non in un pacchetto
suo. La ragione è la direzione delle dipendenze: lo schema Prisma e
l'esportazione del dataset vivono nel pacchetto del corpus, e una verifica che
scrive una tabella ed esce nello snapshot dovrebbe dipendere dal corpus mentre
il corpus dipende da lei. `consulta/` è lo stesso problema, già risolto nello
stesso modo: una fonte esterna, il suo client, la sua tabella, le sue righe nel
dataset.

## Conseguenze

- Positiva: il progetto può finalmente dire, su un singolo decreto e con le
  carte in mano, che non è mai arrivato. È l'affermazione che la gente si
  aspetta da un sito come questo, e fino a oggi non potevamo farla.
- Positiva: il contatore smette di essere un numero con una nota e diventa un
  numero con una misura della propria incertezza, che cresce ogni notte.
- Negativa: **la copertura sarà bassa a lungo**. Sul corpus di oggi molti
  mandati finiscono in `non-verificabile`, e le leggi più citate — che sono
  anche quelle che interessano di più — sono le più difficili da chiudere con un
  `non-adottato`. Il numero onesto è quello che pubblichiamo.
- Negativa: dipendiamo dal markup di un sito che può cambiare da un giorno
  all'altro. Quando cambierà, il parser non riconoscerà più la pagina e tutto
  diventerà `non-verificabile`: il guasto si vedrà come una copertura che smette
  di crescere, non come una serie di negazioni false.
- Negativa: un provvedimento attuativo non pubblicato in Gazzetta — ne esistono,
  pubblicati solo sul sito dell'amministrazione — per noi non esiste. La
  segnalazione dice «non risulta pubblicato in Gazzetta Ufficiale», che è
  letteralmente vero, e chi la riceve può correggerci con un link.
