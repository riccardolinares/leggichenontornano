-- La tabella delle verifiche in Gazzetta Ufficiale (ADR 0012).
--
-- Il progetto crea lo schema con `prisma db push`, che è quello che fanno la
-- pipeline notturna e la CI: è la strada documentata e resta tale. Questa
-- migrazione esiste per i database già in esercizio, che devono acquisire la
-- tabella senza rigenerare il resto — e perché una tabella che entra nel
-- dataset pubblico abbia la sua riga di storia scritta da qualche parte.
--
-- È additiva e idempotente: non tocca nessuna tabella esistente e si può
-- applicare due volte senza danno.

CREATE TABLE IF NOT EXISTS "VerificaAttuazione" (
    "id" TEXT NOT NULL,
    "actUrn" TEXT NOT NULL,
    "articleNumber" TEXT,
    "provisionNumber" TEXT,
    "strumento" TEXT NOT NULL,
    "deadlineDays" INTEGER NOT NULL,
    "dueBy" TEXT,
    "mandato" TEXT NOT NULL,
    "esito" TEXT NOT NULL,
    "motivo" TEXT NOT NULL,
    "query" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "fonte" TEXT NOT NULL,
    "finestraDa" INTEGER NOT NULL,
    "finestraA" INTEGER NOT NULL,
    "risultati" INTEGER NOT NULL DEFAULT 0,
    "verificatoIl" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "provvedimentoTipo" TEXT,
    "provvedimentoTitolo" TEXT,
    "gazzetta" TEXT,
    "gazzettaData" TEXT,
    "codiceRedazionale" TEXT,
    "provvedimentoUrl" TEXT,
    "citazione" TEXT,

    CONSTRAINT "VerificaAttuazione_pkey" PRIMARY KEY ("id")
);

-- `esito` è il filtro del cancello di pubblicazione: si interroga a ogni giro
-- del motore per sapere quali mandati hanno l'assenza verificata.
CREATE INDEX IF NOT EXISTS "VerificaAttuazione_esito_idx" ON "VerificaAttuazione"("esito");

CREATE INDEX IF NOT EXISTS "VerificaAttuazione_actUrn_idx" ON "VerificaAttuazione"("actUrn");

-- `verificatoIl` serve alla ripresa: la campagna notturna salta i mandati
-- guardati di recente, e senza indice quella selezione scorre tutta la tabella.
CREATE INDEX IF NOT EXISTS "VerificaAttuazione_verificatoIl_idx" ON "VerificaAttuazione"("verificatoIl");
