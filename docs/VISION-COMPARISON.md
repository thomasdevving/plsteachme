# Computer vision: plsteach.me en vision-demos

Vergelijking van 6 november 2026. Externe bron: [jeremyipark/vision-demos](https://github.com/jeremyipark/vision-demos), vastgezet op commit [`c06cfb7`](https://github.com/jeremyipark/vision-demos/tree/c06cfb78ccd8e2c63629222695aac710fe4c199c). Dit is een broncodeanalyse. Hun modellen zijn hier niet uitgevoerd; er is geen gemeten vergelijking van nauwkeurigheid, snelheid of kosten. Er is geen externe implementatie of model overgenomen.

## Wat past bij ons?

De sterkste les is **per vaardigheid bepalen wat je wilt meten, met welke cameraopstelling en over welke tijdsperiode**. Een das herkennen, een knoop controleren en een volledige squat beoordelen zijn verschillende taken. Een generieke tracker of één goed beeld lost ze niet alle drie op.

plsteach.me moet de lichte, lokale live begeleiding behouden. Voor toekomstige bewegingslessen kunnen we de aanpak met lichaamsverhoudingen, kalibratie en bewegingsfasen gebruiken. De volledige videopipeline van vision-demos is vooral interessant voor een afzonderlijke analyse van opgenomen oefeningen.

## Technische vergelijking

| Onderdeel | plsteach.me na deze wijziging | vision-demos | Betekenis voor ons |
| --- | --- | --- | --- |
| Interactie | Live browsercamera met lokale overlays en periodieke beeldchecks | Vooral geüploade en bijgesneden videoclips in Python/Gradio | Hun batchanalyse is geen kant-en-klare vervanging voor onze live UI. |
| Objecten | Bij das/scheermes eerst twee complete beelden naar OpenAI voor herkenning; daarna lokale appearance-tracking als locatiehint | SAM 3.1-segmentatie bij onder andere klimmen, deadlift en basketbal; taakgerichte pipelines | Segmentatie kan helpen bij occlusie of precieze contouren, maar is niet voor elke les nodig. |
| Lichaam | MediaPipe pose met 33 landmarks, plus handlandmarks, lokaal in de browser | ViTPose-plus-large via VLM Run Gateway; onder meer COCO-17-punten | Vergelijk modelkwaliteit op dezelfde opnamen; jointindices vereisen een expliciete vertaling. |
| Beoordeling | OpenAI-stillbeelden per visueel checkpoint; lokale getrainde modellen zijn een aparte, beperkte bron | Geometrische signalen over tijd; bij deadlift ook Gemma-frameclassificatie | Tijdreeksen toevoegen waar de volledige beweging bepalend is. |
| Voortgang | Een outline-/posematch is geen voltooid lescheckpoint | Herhalingen tellen en volledige bewegingsuitslag beoordelen zijn aparte stappen | Houd zichtbaarheid, uitvoering en voltooiing apart. |
| Data | Lokale live video; consented complete stillbeelden door de server; geen opgeslagen camerabeelden | De poseclient verstuurt clipbytes naar een externe gateway; afgeleide resultaten worden op schijf gecachet | Videoupload of langdurige poseopslag vraagt een apart ontwerp en aangepaste privacy-informatie. |
| Rekenkosten | Browserinferentie plus incidentele API-checks | Externe video-/modelverwerking met meerdere modellen per taak | Geen betrouwbare kostenvergelijking zonder gelijke clips, instellingen en gebruiksduur. |

Bron voor modelkeuze en appstructuur: [README](https://github.com/jeremyipark/vision-demos/blob/c06cfb78ccd8e2c63629222695aac710fe4c199c/README.md). Bron voor clipupload en caching: [chin_ups/src/pose.py](https://github.com/jeremyipark/vision-demos/blob/c06cfb78ccd8e2c63629222695aac710fe4c199c/chin_ups/src/pose.py).

## 1. Bewegingsfasen in plaats van losse goede frames

Bij chin-ups gebruiken ze een relatief signaal tussen handen en romp. Dat onderdrukt cameraverschuivingen beter dan een absolute pixelhoogte. Een toestandsmachine met verschillende drempels voor omhoog en omlaag voorkomt dat ruis meerdere herhalingen oplevert. Zie [rep-counting-explained.md](https://github.com/jeremyipark/vision-demos/blob/c06cfb78ccd8e2c63629222695aac710fe4c199c/chin_ups/rep-counting-explained.md).

Voor een toekomstige squatles zou onze laag bijvoorbeeld `start → zakken → onderin → omhoog → rechtop` volgen. Alleen betrouwbare gewrichten mogen een faseovergang veroorzaken. Bij verlies van zicht pauzeert de beoordeling; het systeem verzint geen beweging. Drempels en benodigde gewrichten horen bij de specifieke oefening en camerahoek.

Hun gecentreerde smoothing gebruikt ook toekomstige frames. Dat kun je niet rechtstreeks in een live coach kopiëren: daar is causale smoothing of expliciete vertraging nodig. Er is in deze wijziging geen generieke sportbeoordelaar of herhalingsteller toegevoegd.

## 2. Kalibreer op persoon en camerahoek

De pull-updemo kalibreert een referentieset: een gestrekte arm hoeft vanuit de camera bijvoorbeeld geen gemeten hoek van 180 graden op te leveren. Verhoudingen worden ten opzichte van het lichaam gemeten. Zie [pull_ups/how-it-works.md](https://github.com/jeremyipark/vision-demos/blob/c06cfb78ccd8e2c63629222695aac710fe4c199c/pull_ups/how-it-works.md) en [calibrate.py](https://github.com/jeremyipark/vision-demos/blob/c06cfb78ccd8e2c63629222695aac710fe4c199c/pull_ups/src/calibrate.py).

Voor plsteach.me: laat een bewegingsles eerst de benodigde camerahoek en startpositie controleren. Gebruik lichaamsverhoudingen en zichtbaarheid in plaats van één universele pixeldrempel. Bewaar bij eventuele kalibratie de versie en herkomst; leg concrete grenswaarden pas vast na gelabelde praktijktests. Een referentieset kan zelf onvolledige bewegingen bevatten en is geen medische of sporttechnische norm.

De push-updemo kiest de best zichtbare lichaamszijde en normaliseert aan armlengte. Dat is beter dan zwaar vertrouwen op de door het model geschatte, afgedekte arm. Zie [push_ups/how-it-works.md](https://github.com/jeremyipark/vision-demos/blob/c06cfb78ccd8e2c63629222695aac710fe4c199c/push_ups/how-it-works.md).

## 3. Maak zichtbaar wat de beoordeling daadwerkelijk betekent

De pull-updemo onderscheidt een getelde poging van een volledige bewegingsuitslag. De dansdemo onderscheidt houding en timing. Die scheiding moeten wij ook maken:

- **Object zichtbaar:** een echte das/scheermes herkend; dit zegt niets over een correcte knoop of scheerbeweging.
- **Gewrichten zichtbaar:** genoeg lokale posepunten om lijnen te tekenen; dit zegt niets over een correct uitgevoerde oefening.
- **Checkpoint bevestigd:** specifieke visuele lescriteria beoordeeld met voldoende bewijs.
- **Volledige beweging beoordeeld:** vereist waarnemingen over tijd en regels voor die oefening; dit bestaat nog niet voor generieke sportlessen.

In de dansdemo worden lichaamssegmenthoeken gebruikt om lichaamsgrootte minder belangrijk te maken, en ontbrekende poses worden uitgesloten. De relatieve scores per clip zijn geen universele correctheidspercentages. Neem dus de meetmethode over als inspiratie, niet hun scores als een betrouwbaarheidskans voor onze UI. Zie [similarity-metric-explained.md](https://github.com/jeremyipark/vision-demos/blob/c06cfb78ccd8e2c63629222695aac710fe4c199c/dance_sync/similarity-metric-explained.md).

## 4. Beperk modelvragen en leg fouten vast

De deadliftclassifier gebruikt een beperkte set antwoordkeuzes en legt onder andere timing, kansen, gebruik en fouten gestructureerd vast. Het aantal gelijktijdige aanvragen is begrensd. Dat is bruikbaar voor consistente faseclassificatie en kostencontrole. Zie [deadlift/src/classify.py](https://github.com/jeremyipark/vision-demos/blob/c06cfb78ccd8e2c63629222695aac710fe4c199c/deadlift/src/classify.py).

Onze objectherkenning heeft nu eveneens een strikt schema: verwacht object, confidencecategorie, bounding box en korte aanwijzing. Alleen een duidelijke match van het servergekozen object in beide beelden opent de positioneringsstap. JSON-validatie maakt het antwoord verwerkbaar; ze bewijst niet dat het model het juiste object zag. De werkelijke foutkans moet apart worden gemeten.

We behouden het **hele camerabeeld**. De outline en tracker zijn hints, geen vervanging van context. Een eventuele aanvullende detailuitsnede mag de volledige context niet verdringen.

## 5. Meet kwaliteit voordat we modellen vervangen

Maak met toestemming een gelabelde evaluatieset voor elke ondersteunde taak. Houd die testdata los van gewone gebruikerssessies:

| Taak | Benodigde voorbeelden | Belangrijkste metingen |
| --- | --- | --- |
| Das/scheermes positioneren | Diverse echte objecten, beweging, licht, huid/shirt/achtergrond in dezelfde kleur, verkeerd object, occlusie | False accepts, false rejects, tijd tot herkenning, aanvragen per geslaagde start |
| Lokaal volgen | Rotatie, handen ervoor, uit beeld en terug, meerdere gelijkende objecten | Verkeerde matches, herstelduur, verloren frames |
| Lichaamsoverlay | Camerahoeken, lichaamsbouw, kleding, één/meerdere personen, afgedekte gewrichten | Zichtbaarheid, jitter, bruikbare frames, FPS en batterijeffect op echte telefoons |
| Bewegingsles | Volledige/onvolledige herhalingen, pauzes en afgebroken pogingen met tijdlabels | Fasefouten, dubbele tellingen, gemiste pogingen, feedbackvertraging |

Dezelfde cameraopnamen, apparaten en annotaties zijn nodig om MediaPipe, ViTPose, een objectdetector of een segmentatiemodel eerlijk te vergelijken. De externe repo toont toepassingen; dat bewijst op zichzelf geen hogere productienauwkeurigheid dan onze stack.

## Wat is nu verwerkt?

- Expliciete modulekeuze: scene, das, scheermes of lichaamsbeweging. Bestaande documenten zonder keuze houden de sceneweergave.
- Das en scheren krijgen een objectoutline. Stilhouden triggert een herkenningspoging; een timer, kleurmatch of skipknop kan de herkenning niet vervangen.
- Na herkenning blijft de bestaande lokale tracker een verplaatsbare locatiehint. Het verdwijnen van de tracker sluit de les niet opnieuw af; coaching ziet het volledige beeld.
- De bodyoptie toont echte, voldoende zichtbare MediaPipe-gewrichten, met correcte spiegeling en zonder objectscan. Er worden geen punten getekend wanneer de persoonselectie ambigu is. Docenten kunnen dit instellen op een passende gepubliceerde of organisatiemodule; er is geen bestaande sportles verzonnen.
- De bodyoverlay en het bestaande lokale model delen inferentie voor dezelfde video. De overlay valideert geen volledige oefening.
- Dezelfde servercontrole, versiecontrole, accountrechten en AI-budgetten blijven gelden voor ingebouwde, gepubliceerde en organisatielessen. Objectherkenning slaat geen checkpoint of lesvoortgang op.

## Aanbevolen volgorde

1. Test de nieuwe positionering met echte dassen, scheermessen en telefoons; verzamel fouten en timing zonder gewone camerabeelden stilzwijgend op te slaan.
2. Kies één bewegingsles met duidelijke camerahoek en criteria. Bouw daarvoor kalibratie, causale smoothing en een fase-/herhalingstoestandsmachine bovenop lokale landmarks.
3. Evalueer een lokale objectdetector als de cloudherkenning te traag, kostbaar of onnauwkeurig blijkt. Een model moet daadwerkelijk de gewenste objectklassen ondersteunen; een algemene detector herkent niet automatisch elk scheermes.
4. Onderzoek segmentatie of serveranalyse van opgenomen clips pas als een concrete les dat nodig heeft. Dat vraagt ook afzonderlijke toestemming, bewaartermijnen en een kosten-/infrastructuurkeuze.

De broncode van vision-demos heeft een [Apache-2.0-licentie](https://github.com/jeremyipark/vision-demos/blob/c06cfb78ccd8e2c63629222695aac710fe4c199c/LICENSE). Voor eventuele latere overname gelden ook attributieverplichtingen en afzonderlijke voorwaarden van modellen, weights en gateways.
