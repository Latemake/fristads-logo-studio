# Fristads Logo Studio

## Julkinen sivusto

### Koko Suomen verkkokaupan valikoima

Tuotteet haetaan Fristadsin Suomen verkkokaupan julkisesta valikoimasta. Mukana ovat myös verkkokaupan muut tuotemerkit. Malli ja väri muodostavat yhden vaihtoehdon; vaatekoot eivät monista kortteja. `data/catalog-report.json` sisältää viimeisimmän päivitysajan, määrät ja tuoteryhmäkohtaisen kattavuuden.

Valikoima ja optimoidut WebP-tuotekuvat julkaistaan GitHub Pagesissa. Selaaminen, logon muokkaus ja vienti toimivat ilman Renderiä. Tuoteryhmät, nimihaku ja 48 tuotteen sivutus pitävät näkymän kevyenä myös puhelimella. Värin nimi näytetään, kun se tunnetaan; muuten käytetään valmistajan värikoodia. Uusien tuotteiden kuvakulmat tulevat luettelossa saatavilla olevista kuvista, joten kaikilla tuotteilla ei ole neljää kuvakulmaa. Aiemman valikoiman kuvakulmat säilyvät.

Päivitä valikoima ja julkaisu:

```sh
npm run catalog:sync -- --refresh
npm run stage:pages
node scripts/check-pages.mjs
```

Commitoi ja pushaa tarkistettu `data/`, `public/garments/` ja `docs/` sekä mahdolliset koodimuutokset. Valikoima on päivityshetken tilanne, ei reaaliaikainen varastoluettelo. Haku käyttää Fristadsin ilmoittamaa 10 sekunnin hakuväliä ja pienempiä suodatettuja luetteloita. Julkaistavaa katalogia ei korvata, jos tulosmäärä ei vastaa verkkokaupan ilmoittamaa kokonaismäärää tai jokin kuva puuttuu. Ilman `--refresh`-valitsinta komento jatkaa välimuistista esimerkiksi keskeytyneen kuvalatauksen jälkeen.

Vanha `data/products.json` on pieni regressiotestien aineisto. Paikallinen sovellus käyttää samaa täyttä `data/pages-products.json`-valikoimaa kuin julkinen sivu.

### Tuotelinkkien tuonti GitHub Pagesissa

GitHub Pages tarvitsee tuotehakua varten erillisen API-palvelun. Käyttöönotto on valmisteltu [Render-asennuslinkillä](https://render.com/deploy?repo=https://github.com/Latemake/fristads-logo-studio). Kirjaudu Renderiin, tarkista ilmainen Free-palvelutaso ja luo palvelu. `render.yaml` määrittää palvelun asetukset; kirjautumistietoja tai API-avaimia ei tallenneta tähän projektiin. Automaattiset palvelinpäivitykset ovat pois käytöstä: julkaise myöhemmät palvelinmuutokset Renderin Manual Deploy -toiminnolla.

Kun palvelu näyttää Live ja sen julkinen HTTPS-osoite on tiedossa:

```sh
node scripts/connect-api.mjs https://OMA-PALVELU.onrender.com
npm run stage:pages
```

Yhdistämisskripti tarkistaa palvelun toiminnan ja GitHub Pagesin sallitun alkuperän ennen asetuksen tallentamista `data/deployment.json`-tiedostoon. Julkaise tämän jälkeen asetustiedosto ja `docs/` GitHubiin. Tuontipainike tulee näkyviin vasta, kun API on määritetty. Tyhjä `apiUrl` säilyttää aiemman pelkästään staattisen version. Julkiseen versioon ei ole vielä määritetty API-osoitetta.

Palvelu hakee vain Fristads-tuotetietoja ja sallittuja tuotekuvia. Logot ja käyttäjän suunnitelma pysyvät selaimessa. Tuodut tuotetiedot tallentuvat suunnitelmaan; Renderin väliaikainen levy toimii vain uudelleen haettavien kuvien välimuistina. `ALLOWED_ORIGINS` rajaa selaimesta tehtävät API-pyynnöt nykyiseen GitHub Pages -alkuperään.

`node scripts/check-remote-api.mjs` testaa erillisen palvelimen kanssa oikean Fristads-tuotteen tuonnin, kuvavälityksen, PNG-viennin, tallennuksen ja CORS-rajoituksen. Testi rakentaa oman version `test-results/`-hakemistoon. Alla mainittu `check-pages.mjs` tarkistaa staattisen version ilman määritettyä API:a.

[Avaa Logo Studio](https://latemake.github.io/fristads-logo-studio/)

Käyttöliittymässä on kolme kieltä: English (oletus), Suomi ja Svenska. Valinta tallentuu selaimeen. Kielenvaihto ei muuta suunnitelmaa, tuotetunnuksia tai käyttäjän kirjoittamaa nimeä. Käännökset ovat tiedostoissa `src/translations.js` ja `src/product-translations.js`; PDF-yhteenvedot käyttävät valittua kieltä.

Puhelimella **Valitse kuvista** avaa käyttöjärjestelmän kuvavalitsimen (`accept="image/*"`, ilman kameraan pakottavaa `capture`-asetusta). **Tiedosto** säilyy vaihtoehtona. Kuvavalitsimen tarkka sisältö riippuu selaimesta ja käyttöjärjestelmästä. HEIC/HEIF-kuvat avataan, jos selain osaa purkaa ne; muuten käyttäjä saa ohjeen valita JPG- tai PNG-kuvan. Kuvia ei lähetetä palvelimelle. Mobiilin kosketuskohteita on suurennettu, lomakekentät käyttävät 16 px:n kirjasinkokoa ja esikatselusta pääsee suoraan muokkaussäätimiin.

GitHub Pages julkaisee `main`-haaran `docs/`-kansion. Päivitä julkaisu komennolla `npm run stage:pages`, testaa `node scripts/check-pages.mjs` ja commitoi sekä pushaa muutokset. Julkinen versio toimii kokonaan selaimessa: logojen muokkaus, automaattitallennus ja PNG-, PDF- sekä JSON-viennit eivät tarvitse palvelinta.

Pages-valikoima on `data/pages-products.json`. `node scripts/prepare-pages.mjs` lisää siihen paikallisesti tuodut tuotteet; koko valikoiman päivitykseen käytetään yllä kuvattua `catalog:sync`-komentoa. Linkkituonti toimii paikallisessa Express-versiossa ja erikseen yhdistetyllä API-palvelulla. Selaimeen tallennetut suunnitelmat ovat sivustokohtaisia: siirrä paikallinen työ julkiselle sivulle JSON-tiedostolla.

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

- Laaja Fristadsin Suomen verkkokaupan valikoima paikallisine tuotekuvineen. Tuoteryhmät kattavat vaatteet, alusasut, päähineet, jalkineet ja asusteet. Mukana ovat myös naisten, talvi- ja huomiovaatteet. Haku, tuoteryhmäkohtaiset määrät ja sivutus.
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

Tuotelinkin tuonti ja valikoiman päivitys perustuvat julkisten sivujen rakenteeseen, eivät sovittuun Fristads-rajapintaan. Sivuston muutokset voivat vaatia jäsentimen päivityksen. Linkkituonti tuo yhden tuotteen ja värin; erillinen `catalog:sync` päivittää Suomen verkkokaupan valikoiman. Jatkuva synkronointi kannattaa toteuttaa Fristadsin tuotetietosyötteellä. Tuotetietojen hakua on rajattu Fristadsin verkkotunnuksiin, uudelleenohjaukset estetään ja ladattavien tietojen kokoa rajoitetaan.

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

Viimeisimmässä tarkistuksessa 13 yksikkötestiä ja 27 selain-/API-testiä läpäistiin. Pages-tarkistus avaa myös jokaisen valikoiman kuvatiedoston, testaa tuoteryhmät ja sivutuksen sekä uuden WebP-tuotteen PNG-, PDF- ja JSON-viennin, suunnitelman uudelleen avaamisen ja mobiilinäkymän. Tietoja tuotantopalvelimesta saa paikallisesta `/api/health`-reitistä.
