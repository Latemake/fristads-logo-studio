import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  ArrowUpRight,
  Check,
  ChevronDown,
  ChevronRight,
  Copy,
  ImagePlus,
  Layers,
  Link,
  LoaderCircle,
  Minus,
  MousePointer2,
  Plus,
  Redo2,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Trash2,
  Undo2,
  X,
  Maximize2,
  FileText,
  WandSparkles,
  AlignHorizontalJustifyCenter,
  ArrowUp,
  ArrowDown,
  FolderOpen,
  RotateCcw,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import {
  imageSrc,
  clamp,
  loadImage,
  rasterize,
  drawScene,
  logoBounds,
  garmentBackground,
  hitLogo,
  hitHandle,
  constrainLogo,
  download,
  persist,
  restore,
  validateDesign,
  validateProducts,
  freshDesign,
  allLogos,
  MAX_LOGOS,
  MAX_TOTAL_LOGOS,
  removeWhiteBackground,
  renderScene,
  filename,
} from "./lib";
import { useDesign } from "./useDesign";
import { Modal } from "./Modal";
import { CATEGORY_ORDER, garmentPlacement } from "./garments";
import { STATIC_SITE, BASE_URL } from "./runtime";
import "./style.css";

const NONE = [];
function App() {
  const history = useDesign(),
    { design, current, change, begin, finish } = history;
  const [catalog, setCatalog] = useState([]),
    [ready, setReady] = useState(false),
    [selected, setSelected] = useState(null);
  const [query, setQuery] = useState(""),
    [category, setCategory] = useState("Kaikki"),
    [toast, setToast] = useState(null);
  const [dialog, setDialog] = useState(null),
    [url, setUrl] = useState(""),
    [busy, setBusy] = useState(""),
    [error, setError] = useState("");
  const [saved, setSaved] = useState(""),
    [zoom, setZoom] = useState(100),
    [assets, setAssets] = useState({}),
    [garment, setGarment] = useState(null);
  const [imageError, setImageError] = useState(false),
    [retry, setRetry] = useState(0),
    [snap, setSnap] = useState(false),
    [dragOver, setDragOver] = useState(false);
  const canvas = useRef(),
    upload = useRef(),
    openFile = useRef(),
    drag = useRef(),
    saveQueue = useRef(Promise.resolve()),
    savedRevision = useRef(0),
    mounted = useRef(true);
  const products = useMemo(
    () => [
      ...new Map(
        (STATIC_SITE
          ? [...(design.products || []), ...catalog]
          : [...catalog, ...(design.products || [])]
        ).map((p) => [p.id, p]),
      ).values(),
    ],
    [catalog, design.products],
  );
  const product = products.find((p) => p.id === design.productId),
    view = design.view,
    key = product ? product.id + ":" + view : "";
  const logos = design.placements[key] || NONE,
    active = logos.find((l) => l.id === selected);
  const placement = garmentPlacement(product?.category);
  const categories = CATEGORY_ORDER.filter((c) =>
    products.some((p) => p.category === c),
  );
  const usedViews = Object.values(design.placements).filter(
    (a) => a.length,
  ).length;
  const matchingLayout =
    product && !logos.length
      ? Object.entries(design.placements).find(
          ([k, l]) =>
            k !== key &&
            k.startsWith(product.id.slice(0, 6)) &&
            k.endsWith(":" + view) &&
            l.length,
        )
      : null;
  const library = useMemo(
    () => [...new Map(allLogos(design).map((l) => [l.src, l])).values()],
    [design.placements],
  );
  const notify = (message, type = "success") => setToast({ message, type });
  function editLogos(updater, targetKey = key) {
    change((d) => ({
      ...d,
      placements: {
        ...d.placements,
        [targetKey]:
          typeof updater === "function"
            ? updater(d.placements[targetKey] || [])
            : updater,
      },
    }));
  }
  function editLogo(patch, id = selected, targetKey = key) {
    editLogos(
      (items) =>
        items.map((l) => (l.id === id ? constrainLogo({ ...l, ...patch }) : l)),
      targetKey,
    );
  }
  function removeLogo(id) {
    if (busy) return;
    finish();
    editLogos((items) => items.filter((l) => l.id !== id));
    if (selected === id) setSelected(null);
    setToast({
      message: "Logo poistettu.",
      type: "success",
      undoAfter: current.current,
      restoreSelection: id,
    });
  }
  function removeAllLogos() {
    if (busy || !logos.length) return;
    finish();
    editLogos([]);
    setSelected(null);
    setToast({
      message: "Tämän kuvakulman logot poistettu.",
      type: "success",
      undoAfter: current.current,
    });
  }
  function copyLogo() {
    if (!active || busy) return;
    try {
      checkCapacity(1);
      const copy = constrainLogo({
        ...active,
        id: crypto.randomUUID(),
        x: active.x + 25,
        y: active.y + 25,
      });
      editLogos((items) => [...items, copy]);
      setSelected(copy.id);
    } catch (e) {
      fail(e);
    }
  }
  function chooseProduct(p) {
    finish();
    change((d) => ({ ...d, productId: p.id, view: 0 }));
    setSelected(null);
    setZoom(100);
  }
  function chooseView(index) {
    finish();
    change((d) => ({ ...d, view: index }));
    setSelected(null);
  }
  function fail(e) {
    notify(
      e instanceof SyntaxError
        ? "Tiedostoa ei voitu lukea. Valitse Logo Studiosta tallennettu suunnitelma."
        : e.message,
      "error",
    );
  }

  useEffect(() => {
    mounted.current = true;
    async function start() {
      try {
        const [response, stored] = await Promise.all([
          fetch(STATIC_SITE ? BASE_URL + "catalog.json" : "/api/products"),
          restore().catch(() => null),
        ]);
        if (!response.ok)
          throw Error(
            "Tuotevalikoimaa ei voitu ladata. Tarkista yhteys ja yritä uudelleen.",
          );
        const list = validateProducts(await response.json());
        if (!list.length)
          throw Error("Valikoima on tyhjä. Tarkista palvelimen tuotetiedot.");
        let restored = freshDesign();
        if (stored) {
          try {
            restored = validateDesign(stored);
          } catch {
            notify(
              "Tallennettua suunnitelmaa ei voitu avata. Alkuperäistä tallennusta ei korvattu.",
              "error",
            );
            setError(
              "Selaimeen tallennettu suunnitelma on virheellinen. Avaa suunnitelmatiedosto tai aloita uusi suunnitelma.",
            );
            setCatalog(list);
            return;
          }
        }
        const merged = [...(restored.products || []), ...list];
        if (!merged.some((p) => p.id === restored.productId)) {
          notify(
            "Aiempi vaate puuttuu valikoimasta. Sen logot säilytettiin.",
            "error",
          );
          restored.productId = list[0].id;
          restored.view = 0;
        }
        const restoredProduct = merged.find((p) => p.id === restored.productId);
        if (!restoredProduct.images[restored.view]) restored.view = 0;
        if (!mounted.current) return;
        setCatalog(list);
        history.initialize(restored);
        setReady(true);
        setError("");
      } catch (e) {
        if (mounted.current) setError(e.message);
      }
    }
    start();
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    if (!ready) return;
    const revision = ++savedRevision.current;
    setSaved("Tallennetaan…");
    // Queue immediately, so navigation/reload does not discard a debounce timer.
    saveQueue.current = saveQueue.current
      .catch(() => {})
      .then(() => persist(design))
      .then(() => {
        if (revision === savedRevision.current && mounted.current)
          setSaved("Tallennettu selaimeen");
      })
      .catch(() => {
        if (mounted.current)
          setSaved("Tallennus epäonnistui – lataa suunnitelma");
      });
  }, [design, ready]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(
      () => setToast(null),
      toast.type === "error" ? 8000 : 4000,
    );
    return () => clearTimeout(timer);
  }, [toast]);
  const garmentSource = product?.images[view];
  useEffect(() => {
    let cancelled = false;
    setGarment(null);
    setImageError(false);
    if (garmentSource)
      loadImage(imageSrc(garmentSource))
        .then((image) => {
          if (!cancelled) setGarment(image);
        })
        .catch(() => {
          if (!cancelled) setImageError(true);
        });
    return () => {
      cancelled = true;
    };
  }, [garmentSource, retry]);
  useEffect(() => {
    let cancelled = false;
    Promise.all(
      logos
        .filter((l) => !assets[l.src])
        .map(async (l) => [l.src, await loadImage(l.src)]),
    )
      .then((entries) => {
        if (!cancelled && entries.length)
          setAssets((a) => ({ ...a, ...Object.fromEntries(entries) }));
      })
      .catch(fail);
    return () => {
      cancelled = true;
    };
  }, [logos]);
  useEffect(() => {
    if (canvas.current)
      drawScene(
        canvas.current.getContext("2d"),
        garment,
        logos,
        assets,
        selected,
        true,
      );
  }, [garment, logos, assets, selected, ready]);
  useEffect(() => {
    const release = () => {
      drag.current = null;
      setSnap(false);
      finish();
    };
    window.addEventListener("pointerup", release);
    window.addEventListener("pointercancel", release);
    window.addEventListener("blur", release);
    return () => {
      window.removeEventListener("pointerup", release);
      window.removeEventListener("pointercancel", release);
      window.removeEventListener("blur", release);
    };
  });
  useEffect(() => {
    const handler = (e) => {
      if (
        /INPUT|TEXTAREA|SELECT/.test(e.target.tagName) ||
        e.target.isContentEditable ||
        dialog ||
        !ready
      )
        return;
      if (
        (e.ctrlKey || e.metaKey) &&
        ["z", "y"].includes(e.key.toLowerCase())
      ) {
        e.preventDefault();
        if (e.key.toLowerCase() === "y" || e.shiftKey) history.redo();
        else history.undo();
      }
      if (
        active &&
        ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)
      ) {
        e.preventDefault();
        const n = e.shiftKey ? 10 : 2;
        editLogo({
          x:
            active.x +
            (e.key === "ArrowRight" ? n : e.key === "ArrowLeft" ? -n : 0),
          y:
            active.y +
            (e.key === "ArrowDown" ? n : e.key === "ArrowUp" ? -n : 0),
        });
      }
      if (active && ["Delete", "Backspace"].includes(e.key)) {
        e.preventDefault();
        removeLogo(selected);
      }
      if (e.key === "Escape") setSelected(null);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  });
  function checkCapacity(amount, targetKey = key) {
    if (
      (current.current.placements[targetKey] || []).length + amount >
      MAX_LOGOS
    )
      throw Error("Yhdessä kuvakulmassa voi olla enintään 20 logoa.");
    if (allLogos(current.current).length + amount > MAX_TOTAL_LOGOS)
      throw Error(
        "Suunnitelmassa voi olla enintään 200 logoa. Aloita uusi suunnitelma.",
      );
  }
  async function addFiles(files) {
    if (!product || !ready || busy) return;
    const targetKey = key;
    setBusy("upload");
    try {
      if (!files.length) return;
      if (files.length > 10) throw Error("Lataa enintään 10 logoa kerrallaan.");
      checkCapacity(files.length, targetKey);
      const added = [];
      for (const file of [...files])
        added.push(
          constrainLogo({
            ...(await rasterize(file)),
            id: crypto.randomUUID(),
            name: file.name.slice(0, 250),
            x: placement.x + added.length * 12,
            y: placement.y + added.length * 12,
            w: placement.w,
            rotation: 0,
            opacity: 1,
            printed: true,
          }),
        );
      // Retain the captured destination even if the user switches garment during decoding.
      checkCapacity(added.length, targetKey);
      editLogos((items) => [...items, ...added], targetKey);
      setSelected(added.at(-1).id);
      notify("Logo lisätty. Siirrä vetämällä, muuta kokoa kulmasta.");
    } catch (e) {
      fail(e);
    } finally {
      setBusy("");
      if (upload.current) upload.current.value = "";
    }
  }
  function addExisting(logo) {
    try {
      checkCapacity(1);
      const added = constrainLogo({
        ...logo,
        id: crypto.randomUUID(),
        x: placement.x,
        y: placement.y,
        w: placement.w,
        rotation: 0,
        opacity: 1,
      });
      editLogos((items) => [...items, added]);
      setSelected(added.id);
      notify("Logo lisätty tähän kuvakulmaan.");
    } catch (e) {
      fail(e);
    }
  }
  function point(e) {
    const rect = canvas.current.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) * 800) / rect.width,
      y: ((e.clientY - rect.top) * 800) / rect.height,
    };
  }
  function pointerDown(e) {
    if (e.button !== 0 || !garment) return;
    const p = point(e),
      resizing = active && hitHandle(active, p.x, p.y),
      hit = resizing
        ? active
        : [...logos].reverse().find((l) => hitLogo(l, p.x, p.y));
    setSelected(hit?.id || null);
    canvas.current.focus({ preventScroll: true });
    if (hit) {
      e.currentTarget.setPointerCapture(e.pointerId);
      begin();
      drag.current = {
        start: p,
        logo: hit,
        key,
        resizing,
        distance: Math.hypot(p.x - hit.x, p.y - hit.y),
      };
    }
  }
  function pointerMove(e) {
    const p = point(e),
      d = drag.current;
    if (!d) {
      e.currentTarget.style.cursor =
        active && hitHandle(active, p.x, p.y)
          ? "nwse-resize"
          : logos.some((l) => hitLogo(l, p.x, p.y))
            ? "grab"
            : "default";
      return;
    }
    if (d.resizing)
      editLogo(
        {
          w:
            (d.logo.w * Math.hypot(p.x - d.logo.x, p.y - d.logo.y)) /
            Math.max(1, d.distance),
        },
        d.logo.id,
        d.key,
      );
    else {
      let x = d.logo.x + p.x - d.start.x,
        y = d.logo.y + p.y - d.start.y;
      const centered = !e.altKey && Math.abs(x - 400) < 7;
      if (centered) x = 400;
      setSnap(centered);
      editLogo({ x, y }, d.logo.id, d.key);
    }
  }
  function pointerUp() {
    drag.current = null;
    setSnap(false);
    finish();
  }
  async function exportPng() {
    if (!product || !garment || busy) return;
    setBusy("png");
    try {
      const output = await renderScene(product, view, logos, 2000);
      const blob = await new Promise((resolve) =>
        output.toBlob(resolve, "image/png"),
      );
      if (!blob) throw Error("Kuvan tallennus epäonnistui.");
      download(blob, `fristads-${product.id}-kuva-${view + 1}.png`);
      notify("Esikatselu ladattu.");
    } catch (e) {
      fail(e);
    } finally {
      setBusy("");
    }
  }
  async function exportSummary() {
    if (busy) return;
    setBusy("pdf");
    try {
      const { exportPdf } = await import("./exportPdf");
      await exportPdf(current.current, products);
      notify("PDF-yhteenveto ladattu.");
    } catch (e) {
      fail(e);
    } finally {
      setBusy("");
    }
  }
  function saveDesign() {
    const ids = new Set([
      design.productId,
      ...Object.keys(design.placements)
        .filter((k) => design.placements[k].length)
        .map((k) => k.split(":")[0]),
    ]);
    const document = {
      ...design,
      products: products.filter((p) => ids.has(p.id)),
    };
    download(
      new Blob([JSON.stringify(document)], { type: "application/json" }),
      filename(design.title) + ".json",
    );
    notify("Muokattava suunnitelma ladattu.");
  }
  async function importProduct(e, productUrl = url) {
    e?.preventDefault();
    setBusy("import");
    setError("");
    try {
      const response = await fetch("/api/products/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: productUrl }),
        signal: AbortSignal.timeout(45000),
      });
      const body = await response.json();
      if (!response.ok) throw Error(body.error || "Tuotetta ei voitu hakea.");
      const [p] = validateProducts([body]);
      setCatalog((items) => [...items.filter((x) => x.id !== p.id), p]);
      change((d) => ({
        ...d,
        productId: p.id,
        view: 0,
        products: [...(d.products || []).filter((x) => x.id !== p.id), p],
      }));
      setSelected(null);
      setQuery("");
      setCategory("Kaikki");
      setDialog(null);
      setUrl("");
      notify("Vaate lisätty valikoimaan.");
    } catch (e) {
      if (dialog?.type !== "import") {
        fail(e);
        return;
      }
      setError(
        e.name === "TimeoutError"
          ? "Tuotteen haku kesti liian kauan. Yritä uudelleen."
          : e.message,
      );
    } finally {
      setBusy("");
    }
  }
  async function openDesign(file) {
    if (!file) return;
    setBusy("open");
    try {
      if (file.size > 80_000_000)
        throw Error("Suunnitelmatiedosto on liian suuri (enintään 80 Mt).");
      const d = validateDesign(JSON.parse(await file.text())),
        merged = [...products, ...(d.products || [])];
      for (const k of [
        d.productId + ":" + d.view,
        ...Object.keys(d.placements).filter((k) => d.placements[k].length),
      ]) {
        const [id, v] = k.split(":"),
          p = merged.find((p) => p.id === id);
        if (!p || !p.images[Number(v)])
          throw Error(
            "Suunnitelmasta puuttuu tuotteen " +
              id +
              " kuvakulma. Lisää tuote ensin tuotelinkillä.",
          );
      }
      // Decode images before accepting the document, so malformed PNG payloads cannot poison autosave.
      await Promise.all(
        [...new Set(allLogos(d).map((l) => l.src))].map(loadImage),
      );
      finish();
      change(d);
      setSelected(null);
      setReady(true);
      setError("");
      notify(
        "Suunnitelma avattu. Edellisen työn voit palauttaa Kumoa-painikkeella.",
      );
    } catch (e) {
      fail(e);
    } finally {
      setBusy("");
      openFile.current.value = "";
    }
  }
  async function clearBackground() {
    if (!active || busy) return;
    const targetKey = key,
      id = active.id;
    setBusy("background");
    try {
      const processed = await removeWhiteBackground(active.src);
      editLogo(processed, id, targetKey);
      notify(
        "Valkoinen reunatausta poistettu. Voit palauttaa sen Kumoa-painikkeella.",
      );
    } catch (e) {
      fail(e);
    } finally {
      setBusy("");
    }
  }
  function reorder(direction) {
    editLogos((items) => {
      const next = [...items],
        index = next.findIndex((l) => l.id === selected),
        target = clamp(index + direction, 0, next.length - 1);
      if (index < 0 || index === target) return items;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }
  async function showPresentation() {
    if (!product || !garment) return;
    const returnFocus = document.activeElement;
    setBusy("presentation");
    try {
      const image = await renderScene(product, view, logos, 1600);
      setDialog({
        type: "presentation",
        src: image.toDataURL("image/png"),
        returnFocus,
      });
    } catch (e) {
      fail(e);
    } finally {
      setBusy("");
    }
  }
  const filtered = products.filter(
    (p) =>
      (category === "Kaikki" || p.category === category) &&
      `${p.name} ${p.id} ${p.color}`
        .toLocaleLowerCase("fi")
        .includes(query.toLocaleLowerCase("fi")),
  );
  const rangeEvents = {
    onPointerDown: begin,
    onPointerUp: finish,
    onPointerCancel: finish,
    onBlur: finish,
    onKeyDown: (e) => {
      if (e.key.startsWith("Arrow")) begin();
    },
    onKeyUp: finish,
  };
  const closing = () => {
    setDialog(null);
    setError("");
  };
  return (
    <>
      <header className="topbar">
        <a className="brand" href={BASE_URL} aria-label="Fristads Logo Studio">
          <img src={BASE_URL + "fristads.png"} alt="FRISTADS" />
        </a>
        <span className="brand-divider" />
        <span className="studio-name">LOGO STUDIO</span>
        <nav>
          <button
            className="text-btn"
            onClick={() => setDialog({ type: "help" })}
          >
            Ohjeet <ArrowUpRight size={15} />
          </button>
        </nav>
      </header>
      <main>
        <div className="page-title">
          <div>
            <h1>
              Työvaate. <span>Omalla ilmeellä.</span>
            </h1>
          </div>
          <div className="project-actions">
            <button
              className="btn"
              onClick={() => openFile.current.click()}
              disabled={!!busy}
            >
              <FolderOpen size={16} /> Avaa suunnitelma
            </button>
            <button
              className="btn"
              disabled={!ready || !!busy}
              onClick={saveDesign}
            >
              <ArrowDownToLine size={16} /> Tallenna suunnitelma
            </button>
          </div>
        </div>
        <div className="project-strip">
          <div className="project-name">
            <span className="project-symbol">
              <Layers size={17} />
            </span>
            <label>
              <span>SUUNNITELMAN NIMI</span>
              <input
                aria-label="Suunnitelman nimi"
                value={design.title || ""}
                maxLength={80}
                placeholder="Oma työvaatemallisto"
                disabled={!ready}
                onFocus={begin}
                onBlur={finish}
                onChange={(e) =>
                  change((d) => ({ ...d, title: e.target.value }))
                }
              />
            </label>
          </div>
          <span className="save-status">
            <CheckCircle2 size={14} />
            {saved || "Ladataan työtilaa…"}
          </span>
          <button
            className="text-btn new-project"
            disabled={!!busy}
            onClick={() => setDialog({ type: "new" })}
          >
            <Plus size={15} /> Uusi suunnitelma
          </button>
        </div>
        {!ready && error ? (
          <div className="load-error" role="alert">
            <AlertCircle size={24} />
            <h2>Työtilaa ei voitu avata</h2>
            <p>{error}</p>
            <button className="btn" onClick={() => window.location.reload()}>
              Yritä uudelleen
            </button>
          </div>
        ) : (
          <div className="workspace" aria-busy={!ready}>
            <aside className="catalog panel" aria-label="Vaatevalikoima">
              <div className="panel-heading">
                <span className="step">01</span>
                <h2>Valitse vaate</h2>
                <span className="count">{products.length}</span>
              </div>
              <div className="catalog-tools">
                <label className="search">
                  <Search size={17} />
                  <input
                    aria-label="Etsi vaatetta"
                    placeholder="Nimi tai tuotenumero"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                  {query && (
                    <button
                      aria-label="Tyhjennä haku"
                      onClick={() => setQuery("")}
                    >
                      <X size={14} />
                    </button>
                  )}
                </label>
                <div className="filter">
                  <SlidersHorizontal size={15} />
                  <select
                    aria-label="Tuoteryhmä"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                  >
                    {["Kaikki", ...categories].map((c) => (
                      <option key={c} value={c}>
                        {c} (
                        {c === "Kaikki"
                          ? products.length
                          : products.filter((p) => p.category === c).length}
                        )
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={14} />
                </div>
              </div>
              <div className="product-grid">
                {filtered.map((p) => (
                  <button
                    key={p.id}
                    className={
                      "product-card " + (product?.id === p.id ? "chosen" : "")
                    }
                    aria-pressed={product?.id === p.id}
                    onClick={() => chooseProduct(p)}
                  >
                    <div className="product-photo">
                      <img
                        src={imageSrc(p.images[0])}
                        alt={p.name}
                        loading="lazy"
                      />
                      {product?.id === p.id && (
                        <span className="product-check">
                          <Check size={12} />
                        </span>
                      )}
                    </div>
                    <span className="product-category">{p.category}</span>
                    <strong>{p.name}</strong>
                    <span className="product-color">{p.color || p.id}</span>
                    {Object.entries(design.placements).some(
                      ([k, l]) => k.startsWith(p.id + ":") && l.length,
                    ) && <span className="designed-tag">Logo lisätty</span>}
                  </button>
                ))}
                {!filtered.length && (
                  <div className="empty-results">
                    <Search size={23} />
                    <p>
                      {ready
                        ? "Hakua vastaavia vaatteita ei löytynyt."
                        : "Ladataan vaatteita…"}
                    </p>
                    {ready && (
                      <button
                        className="text-btn"
                        onClick={() => {
                          setQuery("");
                          setCategory("Kaikki");
                        }}
                      >
                        Näytä kaikki vaatteet
                      </button>
                    )}
                  </div>
                )}
              </div>
              {!STATIC_SITE && (
                <div className="catalog-bottom">
                  <button
                    className="btn full"
                    disabled={!ready || !!busy}
                    onClick={() => {
                      setError("");
                      setDialog({ type: "import" });
                    }}
                  >
                    <Link size={15} /> Lisää tuotelinkillä <Plus size={15} />
                  </button>
                </div>
              )}
            </aside>
            <section className="preview panel" aria-label="Esikatselutyötila">
              <div className="preview-toolbar">
                <div>
                  <span className="live-dot" /> OMA ILMEESI
                </div>
                <div className="toolbar-actions">
                  <button
                    title="Kumoa (Ctrl+Z)"
                    aria-label="Kumoa"
                    disabled={!history.canUndo || !!busy}
                    onClick={history.undo}
                  >
                    <Undo2 size={17} />
                  </button>
                  <button
                    title="Toista (Ctrl+Shift+Z)"
                    aria-label="Toista"
                    disabled={!history.canRedo || !!busy}
                    onClick={history.redo}
                  >
                    <Redo2 size={17} />
                  </button>
                  <span />
                  <button
                    aria-label="Pienennä näkymää"
                    disabled={zoom <= 75}
                    onClick={() => setZoom((z) => z - 25)}
                  >
                    <Minus size={16} />
                  </button>
                  <button
                    className="zoom-label"
                    title="Palauta näkymä"
                    aria-label="Palauta näkymä"
                    onClick={() => setZoom(100)}
                  >
                    {zoom}%
                  </button>
                  <button
                    aria-label="Suurenna näkymää"
                    disabled={zoom >= 175}
                    onClick={() => setZoom((z) => z + 25)}
                  >
                    <Plus size={16} />
                  </button>
                  <span />
                  <button
                    title="Esitysnäkymä"
                    aria-label="Esitysnäkymä"
                    disabled={!garment || !!busy}
                    onClick={showPresentation}
                  >
                    <Maximize2 size={17} />
                  </button>
                </div>
              </div>
              <div
                className={"canvas-viewport " + (dragOver ? "drop-active" : "")}
                style={{ background: garmentBackground(garment) }}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={(e) => {
                  if (!e.currentTarget.contains(e.relatedTarget))
                    setDragOver(false);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOver(false);
                  addFiles(e.dataTransfer.files);
                }}
              >
                <div
                  className="canvas-wrap"
                  style={{ width: `calc(min(100cqw, 100cqh) * ${zoom / 100})` }}
                >
                  <canvas
                    ref={canvas}
                    width="800"
                    height="800"
                    aria-label="Vaatteen esikatselu. Siirrä valittua logoa nuolinäppäimillä tai vetämällä."
                    tabIndex={0}
                    onPointerDown={pointerDown}
                    onPointerMove={pointerMove}
                    onPointerUp={pointerUp}
                    onPointerCancel={pointerUp}
                  />
                  {snap && <span className="snap-guide" />}
                  {active && garment && (
                    <div
                      className="canvas-logo-tools"
                      role="toolbar"
                      aria-label="Valitun logon pikatoiminnot"
                      style={{
                        left: `clamp(7.1rem, ${active.x / 8}%, calc(100% - 7.1rem))`,
                        top: `max(3.4rem, ${(active.y - logoBounds(active).y - 20) / 8}%)`,
                      }}
                    >
                      <button
                        aria-label="Pienennä logoa"
                        title="Pienennä logoa"
                        disabled={!!busy || active.w <= 24}
                        onClick={() => editLogo({ w: active.w - 15 })}
                      >
                        <Minus size={16} />
                      </button>
                      <button
                        aria-label="Suurenna logoa"
                        title="Suurenna logoa"
                        disabled={
                          !!busy ||
                          active.w >= Math.min(500, 600 * active.ratio)
                        }
                        onClick={() => editLogo({ w: active.w + 15 })}
                      >
                        <Plus size={16} />
                      </button>
                      <button
                        aria-label="Kopioi logo"
                        title="Kopioi logo"
                        disabled={!!busy}
                        onClick={copyLogo}
                      >
                        <Copy size={15} />
                      </button>
                      <button
                        className="quick-delete"
                        aria-label="Poista"
                        title="Poista logo (Delete)"
                        disabled={!!busy}
                        onClick={() => removeLogo(active.id)}
                      >
                        <Trash2 size={15} />
                        <span>Poista</span>
                      </button>
                    </div>
                  )}
                </div>
                {!garment && (
                  <div className="canvas-status">
                    {imageError ? (
                      <>
                        <AlertCircle size={24} />
                        <p>Tuotekuva ei latautunut.</p>
                        <button
                          className="btn"
                          onClick={() => setRetry((n) => n + 1)}
                        >
                          <RotateCcw size={15} /> Yritä uudelleen
                        </button>
                      </>
                    ) : (
                      <>
                        <LoaderCircle className="spin" size={24} />
                        <p>Ladataan vaatetta…</p>
                      </>
                    )}
                  </div>
                )}
                {dragOver && (
                  <div className="drop-overlay">
                    <ImagePlus size={28} /> Pudota logo tähän
                  </div>
                )}
              </div>
              <div className="preview-bottom">
                <div className="views" aria-label="Tuotteen kuvakulmat">
                  {product?.images.map((src, i) => (
                    <button
                      key={src + i}
                      className={view === i ? "active" : ""}
                      aria-pressed={view === i}
                      onClick={() => chooseView(i)}
                      aria-label={`Kuvakulma ${i + 1}`}
                    >
                      <img src={imageSrc(src)} alt="" />
                      <span>Kuva {i + 1}</span>
                      {!!design.placements[product.id + ":" + i]?.length && (
                        <i title="Logo lisätty" />
                      )}
                    </button>
                  ))}
                </div>
                <div className="preview-caption">
                  <MousePointer2 size={14} />
                  <span>
                    {logos.length
                      ? "Siirrä vetämällä · muuta kokoa kulmasta"
                      : "Lisää oma logo oikealta tai pudota se vaatteen päälle"}
                  </span>
                </div>
              </div>
              <div className="product-info">
                <div>
                  <span className="eyebrow">VALITTU VAATE</span>
                  <h2>{product?.name || "Fristads-työvaate"}</h2>
                  <p>
                    {product?.id}
                    <span>·</span>
                    {product?.color || "Fristads"}
                  </p>
                  {!!product?.variants?.length && (
                    <div
                      className="color-swatches"
                      aria-label="Värivaihtoehdot"
                    >
                      {product.variants
                        .filter(
                          (v) =>
                            !STATIC_SITE || products.some((p) => p.id === v.id),
                        )
                        .map((v) => (
                          <button
                            key={v.id}
                            aria-label={`Väri: ${v.name}`}
                            title={v.name}
                            aria-pressed={v.id === product.id}
                            disabled={!!busy}
                            className={v.id === product.id ? "active" : ""}
                            style={{
                              "--swatch":
                                v.colors.length === 2
                                  ? `linear-gradient(135deg,${v.colors[0]} 50%,${v.colors[1]} 50%)`
                                  : v.colors[0],
                            }}
                            onClick={() => {
                              const existing = products.find(
                                (p) => p.id === v.id,
                              );
                              if (existing) chooseProduct(existing);
                              else importProduct(null, v.url);
                            }}
                          >
                            <span />
                          </button>
                        ))}
                      {busy === "import" && (
                        <LoaderCircle className="spin" size={15} />
                      )}
                    </div>
                  )}
                </div>
                {product && (
                  <a
                    href={product.url}
                    target="_blank"
                    rel="noreferrer"
                    aria-label="Avaa tuote Fristadsin sivuilla"
                  >
                    <ArrowUpRight size={20} />
                  </a>
                )}
              </div>
            </section>
            <aside className="editor panel" aria-label="Logon muokkaus">
              <div className="panel-heading">
                <span className="step">02</span>
                <h2>Lisää oma ilme</h2>
              </div>
              <div className="editor-body">
                <button
                  className={"upload-zone " + (logos.length ? "compact" : "")}
                  disabled={!ready || !!busy}
                  onClick={() => upload.current.click()}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    addFiles(e.dataTransfer.files);
                  }}
                >
                  <span className="upload-icon">
                    {busy === "upload" ? (
                      <LoaderCircle className="spin" size={23} />
                    ) : (
                      <ImagePlus size={23} />
                    )}
                  </span>
                  <strong>
                    {busy === "upload"
                      ? "Käsitellään logoa…"
                      : "Lataa oma logo"}
                  </strong>
                  <span>Valitse tiedosto tai pudota tähän</span>
                  <small>PNG, SVG, JPG tai WebP · enintään 10 Mt</small>
                </button>
                {!logos.length && (
                  <p className="upload-hint">
                    Läpinäkyvä PNG tai SVG toimii parhaiten.
                  </p>
                )}
                {matchingLayout && (
                  <button
                    className="btn full copy-layout"
                    disabled={!!busy}
                    onClick={() => {
                      try {
                        checkCapacity(matchingLayout[1].length);
                        const copies = matchingLayout[1].map((l) => ({
                          ...l,
                          id: crypto.randomUUID(),
                        }));
                        editLogos(copies);
                        setSelected(copies[0].id);
                        notify(
                          "Sommittelu kopioitu. Tarkista sijoittelu uudessa värissä.",
                        );
                      } catch (e) {
                        fail(e);
                      }
                    }}
                  >
                    <Copy size={15} /> Kopioi saman mallin logot
                  </button>
                )}
                {!!library.length && (
                  <details className="logo-library">
                    <summary>
                      Käytä jo ladattua logoa <span>{library.length}</span>
                      <ChevronDown size={14} />
                    </summary>
                    <div>
                      {library.map((l) => (
                        <button
                          key={l.src}
                          disabled={!!busy}
                          title={l.name}
                          aria-label={`Lisää logo ${l.name}`}
                          onClick={() => addExisting(l)}
                        >
                          <img src={l.src} alt={l.name} />
                          <Plus size={12} />
                        </button>
                      ))}
                    </div>
                  </details>
                )}
                <div className="section-label">
                  <Layers size={15} />
                  <h3>Logot tässä kuvassa</h3>
                  <span>{logos.length}</span>
                  {logos.length > 1 && (
                    <button
                      className="text-btn clear-logos"
                      aria-label="Poista tämän kuvan logot"
                      disabled={!!busy}
                      onClick={removeAllLogos}
                    >
                      Tyhjennä
                    </button>
                  )}
                </div>
                {logos.length ? (
                  <div className="logo-list">
                    {logos.map((l) => (
                      <div
                        className={
                          "logo-row " + (selected === l.id ? "active" : "")
                        }
                        key={l.id}
                      >
                        <button
                          className="logo-select"
                          aria-label={`Muokkaa logoa ${l.name}`}
                          aria-pressed={selected === l.id}
                          onClick={() => setSelected(l.id)}
                        >
                          <img src={l.src} alt="" />
                          <span>{l.name}</span>
                        </button>
                        <button
                          className="remove-logo"
                          aria-label={`Poista logo ${l.name}`}
                          title="Poista logo"
                          disabled={!!busy}
                          onClick={() => removeLogo(l.id)}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="editor-tip">
                    <div className="tip-illustration">
                      <ImagePlus size={27} />
                      <span>
                        <Plus size={12} />
                      </span>
                    </div>
                    <p>Lisää logo ja siirrä se paikalleen.</p>
                  </div>
                )}
                {active && (
                  <div className="controls">
                    <div className="section-label">
                      <h3>Muokkaa logoa</h3>
                      <button
                        className="text-btn"
                        title="Keskitä vaakasuunnassa"
                        onClick={() => editLogo({ x: 400 })}
                      >
                        <AlignHorizontalJustifyCenter size={14} /> Keskitä
                      </button>
                    </div>
                    <div className="presets">
                      {placement.presets.map(([label, x, y]) => (
                        <button key={label} onClick={() => editLogo({ x, y })}>
                          {label}
                        </button>
                      ))}
                    </div>
                    <label className="range-label">
                      Koko{" "}
                      <output>
                        {Math.round(active.w / 8)} % kuvan leveydestä
                      </output>
                      <input
                        aria-label="Logon koko"
                        type="range"
                        min="24"
                        max={Math.min(500, 600 * active.ratio)}
                        step="1"
                        value={active.w}
                        {...rangeEvents}
                        onChange={(e) => editLogo({ w: +e.target.value })}
                      />
                    </label>
                    <div className="print-option">
                      <span>
                        <strong>Logon pinta</strong>
                        <small>
                          Painettu ilme seuraa kankaan pintaa ja poimuja.
                        </small>
                      </span>
                      <div
                        className="finish-options"
                        role="group"
                        aria-label="Logon pinta"
                      >
                        <button
                          type="button"
                          aria-pressed={active.printed !== false}
                          onClick={() => editLogo({ printed: true })}
                        >
                          Painettu ilme
                        </button>
                        <button
                          type="button"
                          aria-pressed={active.printed === false}
                          onClick={() => editLogo({ printed: false })}
                        >
                          Flat 2D
                        </button>
                      </div>
                    </div>
                    <details className="advanced-controls">
                      <summary>
                        Lisäsäädöt <span>Kierto ja peittävyys</span>
                        <ChevronDown size={14} />
                      </summary>
                      <label className="range-label">
                        Kierto <output>{Math.round(active.rotation)}°</output>
                        <input
                          aria-label="Logon kierto"
                          type="range"
                          min="-180"
                          max="180"
                          value={active.rotation}
                          {...rangeEvents}
                          onChange={(e) =>
                            editLogo({ rotation: +e.target.value })
                          }
                        />
                      </label>
                      <label className="range-label">
                        Peittävyys{" "}
                        <output>{Math.round(active.opacity * 100)} %</output>
                        <input
                          aria-label="Logon peittävyys"
                          type="range"
                          min="0"
                          max="100"
                          value={active.opacity * 100}
                          {...rangeEvents}
                          onChange={(e) =>
                            editLogo({ opacity: +e.target.value / 100 })
                          }
                        />
                      </label>
                    </details>
                    <button
                      className="btn background-button full"
                      disabled={!!busy}
                      onClick={clearBackground}
                    >
                      {busy === "background" ? (
                        <LoaderCircle className="spin" size={15} />
                      ) : (
                        <WandSparkles size={15} />
                      )}{" "}
                      Poista valkoinen tausta
                    </button>
                    <div className="logo-actions">
                      <button
                        className="btn"
                        disabled={!!busy}
                        onClick={() => {
                          try {
                            checkCapacity(1);
                            const copy = constrainLogo({
                              ...active,
                              id: crypto.randomUUID(),
                              x: active.x + 25,
                              y: active.y + 25,
                            });
                            editLogos((items) => [...items, copy]);
                            setSelected(copy.id);
                          } catch (e) {
                            fail(e);
                          }
                        }}
                      >
                        <Copy size={14} /> Kopioi
                      </button>
                      <button
                        className="btn delete"
                        aria-label="Poista valittu logo"
                        disabled={!!busy}
                        onClick={() => removeLogo(selected)}
                      >
                        <Trash2 size={14} /> Poista
                      </button>
                      <button
                        className="icon-button"
                        aria-label="Siirrä logoa taaksepäin"
                        title="Siirrä taaksepäin"
                        disabled={logos[0]?.id === selected}
                        onClick={() => reorder(-1)}
                      >
                        <ArrowDown size={15} />
                      </button>
                      <button
                        className="icon-button"
                        aria-label="Siirrä logoa eteenpäin"
                        title="Siirrä eteenpäin"
                        disabled={logos.at(-1)?.id === selected}
                        onClick={() => reorder(1)}
                      >
                        <ArrowUp size={15} />
                      </button>
                    </div>
                  </div>
                )}
                {!!logos.length && !active && (
                  <p className="select-hint">
                    Valitse logo kuvasta tai listasta muokataksesi sitä.
                  </p>
                )}
              </div>
              <div className="export-area">
                <button
                  className="btn primary full"
                  disabled={!garment || !!busy}
                  onClick={exportPng}
                >
                  {busy === "png" ? (
                    <LoaderCircle className="spin" size={17} />
                  ) : (
                    <ArrowDownToLine size={17} />
                  )}{" "}
                  Lataa esikatselu <span>PNG</span>
                </button>
                <button
                  className="btn full pdf-button"
                  disabled={!usedViews || !!busy}
                  onClick={exportSummary}
                >
                  {busy === "pdf" ? (
                    <LoaderCircle className="spin" size={16} />
                  ) : (
                    <FileText size={16} />
                  )}{" "}
                  Lataa yhteenveto <span>PDF</span>
                </button>
                <p>
                  {usedViews
                    ? `PDF sisältää kaikki ${usedViews} suunniteltua kuvakulmaa`
                    : "Lisää logo, niin voit ladata PDF-yhteenvedon"}
                </p>
              </div>
            </aside>
          </div>
        )}
        <footer>
          <span>
            <ShieldCheck size={14} /> Logot säilyvät selaimessasi
          </span>
          <p>Esikatselu. Painatusmitat vahvistetaan erikseen.</p>
        </footer>
      </main>
      <input
        ref={upload}
        className="hidden"
        type="file"
        accept="image/png,image/jpeg,image/webp,image/svg+xml"
        multiple
        onChange={(e) => addFiles(e.target.files)}
      />
      <input
        ref={openFile}
        className="hidden"
        type="file"
        accept="application/json,.json"
        onChange={(e) => openDesign(e.target.files[0])}
      />
      {toast && (
        <div
          className={"toast " + toast.type}
          role={toast.type === "error" ? "alert" : "status"}
        >
          {toast.type === "error" ? (
            <AlertCircle size={18} />
          ) : (
            <Check size={18} />
          )}
          <span>{toast.message}</span>
          {toast.undoAfter === design && (
            <button
              className="toast-undo"
              aria-label="Kumoa poisto"
              onClick={() => {
                history.undo();
                setSelected(toast.restoreSelection || null);
                setToast(null);
              }}
            >
              <Undo2 size={14} /> Kumoa
            </button>
          )}
          <button aria-label="Sulje ilmoitus" onClick={() => setToast(null)}>
            <X size={16} />
          </button>
        </div>
      )}
      {dialog?.type === "import" && (
        <Modal
          title="Löydä juuri oikea vaate."
          busy={busy === "import"}
          onClose={closing}
        >
          <p>
            Avaa haluamasi vaate ja väri Fristadsin sivuilla. Kopioi tuotteen
            osoite tähän.
          </p>
          <form onSubmit={importProduct}>
            <label>
              Tuotteen osoite
              <input
                data-autofocus
                type="url"
                required
                placeholder="https://www.fristads.com/fi-fi/tuotteet/…"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
              />
            </label>
            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}
            <button className="btn primary full" disabled={!!busy}>
              {busy === "import" ? (
                <>
                  <LoaderCircle className="spin" size={17} /> Haetaan tuotetta…
                </>
              ) : (
                <>
                  <Plus size={17} /> Lisää vaate
                </>
              )}
            </button>
          </form>
          <a
            className="modal-link"
            href="https://www.fristads.com/fi-fi/tuotteet"
            target="_blank"
            rel="noreferrer"
          >
            Selaa Fristadsin vaatteita <ArrowUpRight size={15} />
          </a>
        </Modal>
      )}
      {dialog?.type === "help" && (
        <Modal title="Oma ilme, muutamassa vaiheessa." onClose={closing}>
          <ol className="help-list">
            <li>
              <strong>Valitse vaate.</strong> Selaa valikoimaa tai lisää
              haluamasi tuote ja väri Fristads-tuotelinkillä.
            </li>
            <li>
              <strong>Lataa logo.</strong> PNG, SVG, JPG ja WebP sopivat.
              Tarvittaessa voit poistaa valkoisen reunataustan. Sisäpuolelle
              rajatut valkoiset yksityiskohdat säilyvät.
            </li>
            <li>
              <strong>Sovita paikoilleen.</strong> Vedä logoa, muuta kokoa
              kulmakahvoista ja hienosäädä nuolinäppäimillä. Shift nopeuttaa
              siirtoa, Alt ohittaa keskikohdan kohdistuksen.
            </li>
            <li>
              <strong>Kokeile eri kuvakulmia.</strong> Jokaisella kuvalla on oma
              sommittelunsa. Voit käyttää jo ladattua logoa uudelleen.
            </li>
            <li>
              <strong>Tallenna ja esittele.</strong> PNG tallentaa nykyisen
              näkymän. PDF kokoaa kaikki sommittelut. Suunnitelmatiedoston voi
              avata myöhemmin muokattavaksi.
            </li>
          </ol>
          <div className="help-note">
            <ShieldCheck size={20} />
            <p>
              Logot pysyvät omassa selaimessasi. Työ tallentuu automaattisesti,
              mutta suunnitelmatiedosto on siirrettävä varmuuskopiosi.
            </p>
          </div>
          <button className="btn primary full" onClick={closing}>
            Jatka suunnittelua
          </button>
        </Modal>
      )}
      {dialog?.type === "new" && (
        <Modal title="Aloitetaanko uusi suunnitelma?" onClose={closing}>
          <p>
            Nykyinen työ korvataan tyhjällä suunnitelmalla. Lataa se ensin
            talteen, jos haluat jatkaa sitä myöhemmin.
          </p>
          <button className="btn full" disabled={!!busy} onClick={saveDesign}>
            <ArrowDownToLine size={16} /> Tallenna nykyinen suunnitelma
          </button>
          <div className="dialog-actions">
            <button className="btn" onClick={closing}>
              Peruuta
            </button>
            <button
              className="btn primary"
              onClick={() => {
                finish();
                change(freshDesign());
                setSelected(null);
                setReady(true);
                setError("");
                setQuery("");
                setCategory("Kaikki");
                setDialog(null);
                notify(
                  "Uusi suunnitelma aloitettu. Kumoa palauttaa edellisen työn.",
                );
              }}
            >
              Aloita uusi
            </button>
          </div>
        </Modal>
      )}
      {dialog?.type === "presentation" && (
        <Modal
          title={design.title || "Oma työvaatemallisto"}
          wide
          returnFocus={dialog.returnFocus}
          onClose={closing}
        >
          <div className="presentation-meta">
            <span>{product?.name}</span>
            <span>
              {product?.id} · Kuva {view + 1}
            </span>
          </div>
          <img
            className="presentation-image"
            src={dialog.src}
            alt={`${product?.name} omalla logolla`}
          />
          <div className="presentation-footer">
            <span>FRISTADS / LOGO STUDIO</span>
            <button
              className="btn primary"
              disabled={!!busy}
              onClick={exportPng}
            >
              <ArrowDownToLine size={16} /> Lataa esikatselu
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
createRoot(document.getElementById("root")).render(<App />);
