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

## Aanvulling: tweede analyse (zelfde commit)

Upstream staat nog steeds op `c06cfb7`. Deze tweede ronde kijkt naar de demo's die hierboven weinig aandacht kregen (running, push-ups, basketball, rock climbing) en legt ze naast onze huidige code. Er is niets gemeten of uitgevoerd; de punten hieronder zijn code-observaties met een voorgestelde volgorde.

### A. Landmarks mengen eenheden (opgelost)

**Status:** verwerkt als featureversie 2. `LandmarkFrame` draagt nu de beeldverhouding; features en de stilstandschecks van `/coach` rekenen in fracties van de langste beeldzijde. Oude clips en modellen worden in het lab als ouder formaat gemarkeerd en niet gebruikt of geactiveerd; ze moeten opnieuw worden opgenomen. Tests leggen vast dat dezelfde scène in 4:3, 3:4 en 1:1 dezelfde features geeft. Nog niet aangepast: de uitsnede in `lib/vision/roi.ts` gebruikt de schouderbreedte (x) ook voor de hoogte (y). Dat raakt alleen de beelduitsnede van `/coach` en vraagt nieuwe afstemming van de marges, dus dat is apart gelaten.

MediaPipe normaliseert x op de beeldbreedte en y op de beeldhoogte. `lib/vision/features.ts` deelt beide door één schaal (handgrootte of schouderbreedte) en `isStill` in `lib/vision/prechecks.ts` gebruikt `Math.hypot` op dezelfde gemengde coördinaten. De runningdemo benoemt precies dit probleem en schaalt x eerst met de beeldverhouding: een schuin scheenbeen leek daar 45% langer dan een rechtopstaand, na correctie binnen 2%. Zie [running/cadence-explained.md](https://github.com/jeremyipark/vision-demos/blob/c06cfb78ccd8e2c63629222695aac710fe4c199c/running/cadence-explained.md).

Gevolg voor ons: dezelfde handhouding geeft andere features in een liggend 4:3-beeld (de vision lab vraagt 960×720) dan in een staand 3:4-telefoonbeeld. Een vinger die horizontaal wijst, krijgt in portret een x-waarde die 1,78× zo groot is als in landschap. Een in het lab getraind model ziet bij leerlingen op een telefoon dus systematisch vervormde invoer. De spiegel-augmentatie vangt dit niet op.

Voorstel: geef de beeldverhouding mee in `LandmarkFrame`, vermenigvuldig x met `videoWidth / videoHeight` voordat afstanden en features worden berekend, verhoog `FEATURE_VERSION` naar 2 en train modellen op v1-clips niet meer zonder conversie. Sla de beeldverhouding per clip op, zodat oude clips omgerekend kunnen worden. Leg het vast in een test: dezelfde fysieke hand in 4:3 en 3:4 moet (binnen afronding) dezelfde features geven.

### B. Controleer op het juiste moment, niet elke zes seconden

De demo's beoordelen op een gebeurtenis: lockout van een herhaling, een voetlanding of de bal op randhoogte. De lescamera (`components/camera-coach.tsx`) stuurt na objectherkenning elke 6 seconden twee beelden, tot maximaal 12 keer, ook als er niets veranderd is of de leerling midden in een beweging zit. De `/coach`-ervaring (`live-coach.tsx`) wacht wél op stilstand na beweging via `isStill`.

Voorstel: gebruik in de lescamera dezelfde lokale signalen die er al zijn: handstilstand uit de landmarkloop, of `scanMotion` over het object- of focusvak. Check alleen wanneer de beweging tot rust komt en het beeld merkbaar verschilt van het laatst gecontroleerde beeld. De vaste timer blijft dan alleen als bovengrens. Dat geeft snellere feedback zodra de leerling klaar is en minder overbodige aanvragen. Meet het effect met de aanvragen per voltooid checkpoint uit de evaluatietabel hierboven.

### C. Eén zelfgerapporteerde "high" is een dunne basis voor automatisch doorgaan

De deadliftdemo leest per frame de kansen voor een vaste set labels en beslist pas per herhaling, over meerdere frames. Bij ons start één `looks_right` met door het model zelf gerapporteerde `confidence: 'high'` het aftellen naar de volgende stap. Die zelfrapportage is niet gekalibreerd.

Voorstel, op volgorde van moeite: (1) vraag twee opeenvolgende `looks_right`-uitslagen voordat er automatisch wordt doorgegaan, of één uitslag plus instemming van het actieve on-device model; (2) gebruik de bestaande foutmeldingen (`ReportFeedback`) en schaduwdata om te meten hoe vaak een `high` onterecht was; (3) onderzoek pas daarna of een model met tokenkansen (logprobs) voor een gesloten ja/nee-checkpointvraag haalbaar is. Redeneermodellen leveren die kansen doorgaans niet; dat moet per model worden geverifieerd.

### D. Een detailuitsnede helpt alleen met meer pixels

De deadliftdemo snijdt bij aan het persoonsvak plus marge, omdat elk beeld een vast budget krijgt. Wij vragen de camera om 640×480, schalen naar maximaal 640 px en de server schaalt opnieuw naar 640 px. Een knoop of knoopsgat is dan enkele tientallen pixels groot. Een extra uitsnede van het getrackte objectvak (naast het volledige beeld, zie punt 4 hierboven) voegt pas detail toe als de camera met een hogere resolutie draait, bijvoorbeeld 1280×720, en de uitsnede uit dat bronbeeld komt. Weeg dit af tegen beeldgrootte en lokale rekentijd; de tracker en MediaPipe kunnen op hun eigen verkleinde kopie blijven werken.

### E. Kleinere lessen

- **Hysterese ook op labels.** Onze on-device smoother is een EMA zonder minimale duur. De demo's gebruiken een mediaan over 5 frames en een minimale contacttijd zodat één ruisframe geen nieuwe gebeurtenis maakt. Toon een nieuw label pas als het een korte periode boven de drempel blijft.
- **Kies de best zichtbare kant.** De push-updemo meet aan de zijde met de hoogste gemiddelde zichtbaarheid over de clip en tekent de verborgen kant niet. Dat past bij toekomstige zijaanzicht-bewegingslessen.
- **Toets aannames met een meting.** De klimdemo bewijst met een parallaxtest dat een homografie volstaat voor een handgehouden camera, in plaats van het aan te nemen. Voor ons: de objecttracker gaat uit van een vrijwel stilstaande camera. Neem een bewegende telefoon op in de trackingtestset uit punt 5.
- **Modelvariant.** We draaien `pose_landmarker_lite`. Voor lessen waar het hele lichaam telt, is de `full`-variant een kandidaat. Vergelijk die op dezelfde opnamen en telefoons op nauwkeurigheid, FPS en batterij.

### Bijgewerkte volgorde

1. A: beeldverhouding corrigeren en de featureversie verhogen, vóór er meer labdata wordt verzameld.
2. B: checks laten starten op stilstand of verandering in de lescamera.
3. C: een strengere voorwaarde voor automatisch doorgaan, en meten hoe vaak `high` onterecht is.
4. Daarna de bestaande stappen 1–4 hierboven, met D zodra objectstatus (knoop, knoopsgat) beoordeeld moet worden.

De broncode van vision-demos heeft een [Apache-2.0-licentie](https://github.com/jeremyipark/vision-demos/blob/c06cfb78ccd8e2c63629222695aac710fe4c199c/LICENSE). Voor eventuele latere overname gelden ook attributieverplichtingen en afzonderlijke voorwaarden van modellen, weights en gateways.
