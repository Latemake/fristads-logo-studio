# Fristads Logo Studio

## Julkinen sivusto

GitHub Pages julkaisee `main`-haaran `docs/`-kansion. Päivitä julkaisu komennolla `npm run stage:pages`, testaa `node scripts/check-pages.mjs` ja commitoi sekä pushaa muutokset. Julkinen versio toimii kokonaan selaimessa: logojen muokkaus, automaattitallennus ja PNG-, PDF- sekä JSON-viennit eivät tarvitse palvelinta.

Pages-valikoima on `data/pages-products.json`. `node scripts/prepare-pages.mjs` päivittää sen paikallisesta valikoimasta ja lataa puuttuvat tuotekuvat. Julkisessa versiossa näkyvät vain valmiiksi mukana olevat värivaihtoehdot. Tuotelinkillä tuonti säilyy paikallisessa Express-versiossa, koska GitHub Pages ei suorita palvelinkoodia. Selaimeen tallennetut suunnitelmat ovat sivustokohtaisia: siirrä paikallinen työ julkiselle sivulle JSON-tiedostolla.

Toimiva suomenkielinen työvaatteiden logotyökalu. React + Vite, pieni Express-palvelin. Ei kirjautumista eikä ulkoista tietokantaa.

## Käynnistys

Tarvitset Node.js 22:n tai uudemman.

```sh
npm install
npm run dev
```

Avaa http://localhost:3000. Windowsissa helpoin tapa on kaksoisnapsauttaa `kaynnista.cmd`: se rakentaa tuotantoversion, käynnistää palvelimen taustalle ja avaa selaimen vasta palvelimen vastatessa. Jos Logo Studio on jo käynnissä, se avaa olemassa olevan työtilan.

Tuotantokoonti: `npm run build`, sitten `npm start`. Palvelin kuuntelee oletuksena vain paikallisesti osoitteessa 127.0.0.1. Julkinen käyttö vaatii oman palvelinympäristön ja HTTPS-välityksen. PORT-ympäristömuuttuja vaihtaa portin.

## Ominaisuudet

- 24 oikeaa Fristads-vaatevaihtoehtoa ja 87 paikallista tuotekuvaa. Mukana T-paitoja, pikeepaita, viidet housut, neljä takkia, fleece, liivejä, shortseja, huppareita, college ja haalarit. Myös naisten, talvi- ja huomiovaatteita. Haku ja tuoteryhmäkohtaiset määrät.
- Muiden tuotteiden ja värien tuonti yksittäisellä Fristads-tuotelinkillä.
- Tuotesivulta haetut oikeat värivaihtoehdot. Väripainike avaa tutun värin heti tai hakee uuden Fristadsilta. Saman mallin logot voi kopioida toiseen väriin ilman alkuperäisen sommittelun muuttamista.
- PNG-, JPG-, WebP- ja SVG-logot, raahaaminen, toimivat koonmuutoskahvat, kierto, peittävyys, kopiointi, poisto ja tasojärjestys.
- Oletuksena käytettävä **Painettu ilme** sovittaa logon tuotekuvan valaistukseen ja kankaan pintatekstuuriin sekä taivuttaa sitä hienovaraisesti kuvasta arvioitujen poimujen mukaan. **Flat 2D** näyttää alkuperäisen tasaisen logon. Valinta säilyy suunnitelmassa ja näkyy PNG- ja PDF-viennissä. Efekti arvioi pinnan muodon valokuvasta eikä muodosta 3D-mallia.
- Läpinäkyvien marginaalien automaattinen rajaus sekä valkoisen reunataustan poisto. Valkoiset, muilla väreillä suljetut sisäosat säilyvät. Poiston voi kumota.
- Ladatun logon uudelleenkäyttö toisessa kuvakulmassa tai vaatteessa. Automaattinen keskikohdan kohdistus siirrettäessä; Alt ohittaa kohdistuksen.
- Jokaisella tuotteella ja kuvakulmalla on erillinen sommittelu. Kuvasarjan kuvat on nimetty neutraalisti, sillä Fristads ei takaa kuvakulmien järjestystä.
- Nuolinäppäimet siirtävät valittua logoa; Shift nopeuttaa. Ctrl+Z kumoaa, Ctrl+Shift+Z toistaa, Delete poistaa.
- Yksi liukusäätimen veto tai koonmuutos on yksi kumottava toimenpide.
- Logon vieressä olevat pikatoiminnot: pienennys, suurennus, kopiointi ja poisto. Jokaisella logorivillä on oma poistopainike. Myös kuvakulman kaikkien logojen tyhjennys ja välitön **Kumoa poisto** ovat käytössä.
- Vaatetyyppikohtainen logon oletuspaikka ja pikapaikat: housuissa reidet ja lahkeet, haalareissa rinta ja reisi. Paikat ovat suuntaa antavia ja niitä voi muokata vapaasti.
- PNG-vienti 2000 × 2000 px. Suuri esitysnäkymä ilman editorin säätimiä.
- Nimetty suunnitelma ja monisivuinen PDF-yhteenveto: oma sivu jokaiselle sommitellulle kuvakulmalle, tuotenumero ja tuotelinkki. PNG ja PDF eivät sisällä valintakehyksiä.
- JSON-suunnitelman vienti ja avaaminen säilyttää kaikkien tuotteiden sommittelut ja tuotetiedot. Aiemman version tiedostot toimivat edelleen.
- Automaattitallennus IndexedDB:hen samassa selaimessa. Logot rasteroidaan ja käsitellään selaimessa; niitä ei lähetetä palvelimelle.
- Fontit ja mukana tulevien vaatteiden kuvat ovat paikallisia. Uusien tuotteiden kuvavälitys tallentaa kuvat levylle myöhempää käyttöä varten.

## Rakenne ja jatkokehitys

- `src/main.jsx`: sovellus ja editorin tila.
- `src/lib.js`: kuvankäsittely, vienti, tallennus ja tiedoston tarkistus.
- `src/useDesign.js`: suunnitelman tila ja kokonaisina toimintoina kumottava muokkaushistoria.
- `src/garments.js`: yhteinen vaateluokittelu ja vaatetyyppikohtaiset sijoittelut.
- `src/Modal.jsx`: näppäimistöllä käytettävät dialogit ja fokuksen palautus.
- `src/exportPdf.js`: PDF-vienti, joka ladataan vasta tarvittaessa.
- `src/style.css`: responsiivinen ulkoasu.
- `server/catalog.js`: Fristads-tuotesivun jäsennys ja rajattu verkkohaku.
- `server/index.js`: API, tuonnin tallennus ja kuvavälitys selaimen PNG-vientiä varten.
- `data/products.json`: mukana tuleva valikoima ja alkuperäiset lähdeosoitteet.
- `data/imported.json`: palvelimella tuodut tuotteet (syntyy käytössä).
- `data/image-cache`: tuontikuvien paikallinen välimuisti. Tuotekatalogin tallennus tehdään väliaikaistiedoston kautta atomisesti.
- `public/garments`: valmiin valikoiman kuvat.
- `scripts/seed.mjs`: päivittää mukana tulevan valikoiman Fristadsin tuotesivuilta.

Tuotelinkin tuonti perustuu julkisen tuotesivun rakenteeseen, ei sovittuun Fristads-rajapintaan. Sivuston muutokset voivat vaatia jäsentimen päivityksen. Se tuo yhden tuotteen ja värin kerrallaan; koko Fristads-valikoima ei ole valmiiksi synkronoitu. Pysyvä katalogi-integraatio kannattaa toteuttaa Fristadsin tuotetietosyötteellä. Tuotetietojen hakua on rajattu Fristadsin verkkotunnuksiin, uudelleenohjaukset estetään ja ladattavien tietojen kokoa rajoitetaan.

Esikatselu on kaksiulotteinen, ei 3D eikä painovalmis tuotantotiedosto. Koko on suhteessa esikatselukuvaan. Varmennetut painatusalueet ja fyysiset mitat vaativat Fristadsin tuotekohtaiset tiedot. Myös sertifioitujen vaatteiden soveltuvat merkintäalueet on sovittava valmistajan kanssa. Käyttöliittymä mukailee Fristadsin brändiä; virallista graafista ohjeistoa ei ole toimitettu. Tuotekuvat ja Fristads-logo ovat Fristadsin aineistoa. Sovi aineiston käyttö ja brändihyväksyntä Fristadsin kanssa ennen julkista julkaisua.

Uudet suunnitelmatiedostot sisältävät käytettyjen tuotteiden tiedot, joten erillistä katalogiin tuontia ei normaalisti tarvita toisessa Logo Studio -asennuksessa. Tuotujen vaatteiden kuvat tarvitsevat verkkoyhteyden, kun niitä ei vielä ole kyseisen palvelimen välimuistissa. Vanhoissa tiedostoissa ei ole tuotetietoja: puuttuva vaate on tuotava ennen avaamista. Selainmuistin tyhjentäminen poistaa paikallisen automaattitallennuksen; JSON-vienti on siirrettävä varmuuskopio. Logorajat ovat 20 / kuvakulma ja 200 / suunnitelma, tiedoston avaamisen enimmäiskoko 80 Mt.

## Tarkistukset

```sh
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

Selaintestit rakentavat ja testaavat oikeaa tuotantoversiota portissa 3100. Testipalvelimen tuonnit ja kuvavälimuisti tallentuvat erilliseen väliaikaishakemistoon: testit eivät muokkaa käyttäjän `data/imported.json`-tiedostoa tai selaimen tallennuksia. Osa testeistä hakee oikean Fristads-tuotesivun ja CDN-kuvan, joten niiden ajaminen vaatii verkon. Käytössä on Chromium sekä työpöytä- ja mobiilikoot. Axe-tarkistukset kattavat tyhjän editorin, muokatun suunnitelman ja ohjeikkunan WCAG A/AA -säännöt; ne eivät korvaa kaikkien apuvälineiden manuaalista testausta.

Viimeisimmässä tarkistuksessa 13 yksikkötestiä ja 21 selain-/API-testiä läpäistiin. PDF-viennistä tarkistetaan oikea PDF-tiedosto ja kahden sommittelun sivumäärä. Tietoja tuotantopalvelimesta saa paikallisesta `/api/health`-reitistä.
