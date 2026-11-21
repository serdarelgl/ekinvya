(() => {
  const $ = id => document.getElementById(id);
  const selector = $("boundaryFieldSelect");
  const areaInput = $("fieldArea");
  const status = $("boundaryStatus");
  let map = null;
  let boundaries = null;
  let preview = null;
  let draftGeometry = null;
  let selectedId = "new";
  let activeMode = "draw";
  let lastPlaceSearchAt = 0;
  let crosshairPoints = [];
  let boxFirstCorner = null;
  let gpsWatchId = null;
  let gpsPoints = [];
  let lastGpsPoint = null;

  function geometryAreaDecares(geometry) {
    if (!geometry) return 0;
    const radius = 6378137;
    const ringArea = ring => {
      if (!Array.isArray(ring) || ring.length < 4) return 0;
      let sum = 0;
      for (let i = 0; i < ring.length - 1; i += 1) {
        const [lon1, lat1] = ring[i];
        const [lon2, lat2] = ring[i + 1];
        sum += (lon2 - lon1) * Math.PI / 180
          * (2 + Math.sin(lat1 * Math.PI / 180) + Math.sin(lat2 * Math.PI / 180));
      }
      return Math.abs(sum * radius * radius / 2);
    };
    const polygonArea = polygon => {
      if (!Array.isArray(polygon) || !polygon.length) return 0;
      return Math.max(0, ringArea(polygon[0]) - polygon.slice(1).reduce((holes, ring) => holes + ringArea(ring), 0));
    };
    if (geometry.type === "Polygon") return polygonArea(geometry.coordinates) / 1000;
    if (geometry.type === "MultiPolygon" && Array.isArray(geometry.coordinates)) {
      return geometry.coordinates.reduce((total, polygon) => total + polygonArea(polygon), 0) / 1000;
    }
    return 0;
  }

  function closeRing(ring) {
    if (!Array.isArray(ring)) return [];
    const points = ring.filter(point => Array.isArray(point) && point.length >= 2
      && Number.isFinite(Number(point[0])) && Number.isFinite(Number(point[1])))
      .map(point => [Number(point[0]), Number(point[1])]);
    if (points.length < 3) return [];
    const first = points[0], last = points[points.length - 1];
    if (first[0] !== last[0] || first[1] !== last[1]) points.push([...first]);
    return points.length >= 4 ? points : [];
  }

  function normalizeGeometry(value) {
    if (!value || !["Polygon", "MultiPolygon"].includes(value.type)) throw new Error("Dosyada Polygon veya MultiPolygon sınırı bulunamadı.");
    const polygons = value.type === "Polygon" ? [value.coordinates] : value.coordinates;
    if (!Array.isArray(polygons) || !polygons.length) throw new Error("Parsel geometrisi boş görünüyor.");
    const normalized = polygons.map(rings => {
      if (!Array.isArray(rings) || !rings.length) return [];
      return rings.map(closeRing);
    });
    if (normalized.some(polygon => !polygon.length || polygon.some(ring => ring.length < 4))) {
      throw new Error("Dosyada geçerli en az üç köşeli bir parsel sınırı bulunamadı.");
    }
    const flat = normalized.flat(2);
    if (flat.some(([lon, lat]) => Math.abs(lon) > 180 || Math.abs(lat) > 90)) throw new Error("Koordinatlar geçerli enlem/boylam aralığında değil.");
    return normalized.length === 1 ? { type: "Polygon", coordinates: normalized[0] } : { type: "MultiPolygon", coordinates: normalized };
  }

  function getFeatureGeometry(value) {
    if (value?.type === "Feature") return value.geometry;
    if (value?.type === "FeatureCollection") {
      const geometries = (value.features || []).map(feature => feature?.geometry).filter(Boolean);
      const polygons = geometries.flatMap(geometry => geometry.type === "Polygon" ? [geometry.coordinates]
        : geometry.type === "MultiPolygon" ? geometry.coordinates : []);
      if (!polygons.length) return null;
      return polygons.length === 1 ? { type: "Polygon", coordinates: polygons[0] } : { type: "MultiPolygon", coordinates: polygons };
    }
    return value;
  }

  function parseKml(text) {
    const xml = new DOMParser().parseFromString(text, "application/xml");
    if (xml.getElementsByTagName("parsererror").length) throw new Error("KML dosyası okunamadı.");
    const local = (node, name) => [...node.getElementsByTagName("*")].filter(item => item.localName?.toLowerCase() === name.toLowerCase());
    const coordinateRing = container => {
      const coordinateNode = local(container, "coordinates")[0];
      if (!coordinateNode) return [];
      return coordinateNode.textContent.trim().split(/\s+/).map(value => value.split(",").slice(0, 2).map(Number));
    };
    const polygons = local(xml, "Polygon").map(polygon => {
      const rings = [];
      const outer = local(polygon, "outerBoundaryIs")[0];
      if (outer) rings.push(coordinateRing(outer));
      local(polygon, "innerBoundaryIs").forEach(inner => rings.push(coordinateRing(inner)));
      return rings;
    }).filter(rings => rings.length);
    if (!polygons.length) {
      const coordinateNodes = local(xml, "coordinates");
      if (!coordinateNodes.length) throw new Error("KML içinde parsel Polygon sınırı bulunamadı.");
      polygons.push([coordinateRing(coordinateNodes[0])]);
    }
    const value = polygons.length === 1 ? { type: "Polygon", coordinates: polygons[0] } : { type: "MultiPolygon", coordinates: polygons };
    const geometry = normalizeGeometry(value);
    const metadata = {};
    const pairs = [];
    local(xml, "SimpleData").concat(local(xml, "Data")).forEach(node => {
      const key = node.getAttribute("name"), valueNode = local(node, "value")[0];
      const value = (valueNode?.textContent || node.textContent || "").trim();
      if (key && value) pairs.push([key, value]);
    });
    const description = local(xml, "description")[0]?.textContent || "";
    if (description) {
      const html = new DOMParser().parseFromString(description, "text/html");
      html.querySelectorAll("tr").forEach(row => {
        const cells = [...row.querySelectorAll("th,td")].map(cell => cell.textContent.trim());
        if (cells.length > 1 && cells[0] && cells[1]) pairs.push([cells[0], cells.slice(1).join(" ")]);
      });
    }
    local(xml, "name").slice(0, 1).forEach(node => { if (node.textContent.trim()) metadata.name = node.textContent.trim(); });
    const normalizedKey = key => key.toLocaleLowerCase("tr-TR").replace(/[\s_./-]/g, "");
    const find = (...keys) => pairs.find(([key, value]) => keys.includes(normalizedKey(key)) && value)?.[1] || "";
    metadata.ada = find("ada", "adano");
    metadata.parsel = find("parsel", "parselno", "parselnumarasi");
    metadata.location = [find("mahalle", "mahallead", "mahallekoy", "koy"), find("ilce", "ilcead")].filter(Boolean).join(" / ");
    metadata.place = find("mevkii", "mevki");
    metadata.titleAreaSqM = parseTurkishAreaSqM(find("alan", "parselalani", "yuzolcumu", "alanim2"));
    metadata.notes = [find("nitelik", "aciklama"), metadata.titleAreaSqM ? `TKGM KML alanı: ${metadata.titleAreaSqM.toLocaleString("tr-TR")} m²` : ""].filter(Boolean).join(" · ");
    return { geometry, metadata };
  }

  function parseTurkishAreaSqM(value) {
    if (!value) return 0;
    const text = String(value).replace(/\s/g, "").replace(/m²|m2|metrekare/gi, "");
    const number = Number(text.includes(",") ? text.replace(/\./g, "").replace(",", ".") : text);
    return Number.isFinite(number) && number > 0 ? number : 0;
  }

  function applyImportMetadata(metadata, geometryArea) {
    if (!metadata) return;
    const $set = (id, value) => { const node = $(id); if (node && value && !node.value.trim()) node.value = value; };
    $set("fieldAda", metadata.ada);
    $set("fieldParsel", metadata.parsel);
    $set("fieldLocation", metadata.location);
    $set("fieldName", metadata.place || metadata.name || [metadata.location, metadata.ada && `Ada ${metadata.ada}`, metadata.parsel && `Parsel ${metadata.parsel}`].filter(Boolean).join(" · "));
    $set("fieldNotes", metadata.notes);
    if (metadata.titleAreaSqM) {
      const titleDa = metadata.titleAreaSqM / 1000;
      const variance = Math.abs(titleDa - geometryArea), pct = titleDa ? variance / titleDa * 100 : 0;
      const summary = $("boundaryImportSummary");
      if (summary) summary.textContent = `KML kadastro alanı ${titleDa.toLocaleString("tr-TR", { maximumFractionDigits: 2 })} da · harita geometrisi ${geometryArea.toLocaleString("tr-TR", { maximumFractionDigits: 2 })} da · fark ${pct.toLocaleString("tr-TR", { maximumFractionDigits: 1 })}%. Alan otomatik olarak geometri ölçüsüne yazıldı; resmi kayıt için TKGM verisini kontrol et.`;
      if (!$("fieldNotes").value.trim()) $("fieldNotes").value = `TKGM alanı ${titleDa.toLocaleString("tr-TR", { maximumFractionDigits: 2 })} da; geometri alanı ${geometryArea.toLocaleString("tr-TR", { maximumFractionDigits: 2 })} da.`;
    }
  }

  function currentGeometry() {
    const polygons = [];
    boundaries?.eachLayer(layer => {
      const geometry = layer.toGeoJSON?.().geometry;
      if (geometry?.type === "Polygon") polygons.push(geometry.coordinates);
      else if (geometry?.type === "MultiPolygon") polygons.push(...geometry.coordinates);
    });
    if (!polygons.length) return null;
    return polygons.length === 1 ? { type: "Polygon", coordinates: polygons[0] } : { type: "MultiPolygon", coordinates: polygons };
  }

  function changed() {
    const geometry = currentGeometry();
    const area = geometry ? geometryAreaDecares(geometry) : 0;
    if (areaInput) areaInput.value = geometry ? area.toFixed(2) : "";
    if (selectedId === "new") {
      draftGeometry = geometry;
      status.textContent = geometry
        ? `Sınır yeni tarla formuna bağlandı · yaklaşık ${area.toLocaleString("tr-TR", { maximumFractionDigits: 2 })} da. Formu kaydetmeyi unutma.`
        : "Yeni tarla formuna bağlanacak sınırı haritada çiz.";
      return;
    }
    const field = window.ekinvyaGetFields?.().find(item => String(item.id) === selectedId);
    if (field) {
      window.ekinvyaSetFieldGeometry?.(field.id, geometry, geometry ? area : null);
      status.textContent = geometry
        ? `Sınır ${field.name} parseline kaydedildi · yaklaşık ${area.toLocaleString("tr-TR", { maximumFractionDigits: 2 })} da.`
        : `Sınır ${field.name} parselinden kaldırıldı.`;
    }
  }

  function fitBoundary() {
    try { if (boundaries?.getLayers().length) map.fitBounds(boundaries.getBounds(), { padding: [28, 28], maxZoom: 16 }); } catch { /* Boş sınırda görünüm değişmez. */ }
  }

  function applyGeometry(geometry, message) {
    const normalized = normalizeGeometry(geometry);
    boundaries.clearLayers();
    preview.clearLayers();
    const layer = window.L.geoJSON({ type: "Feature", properties: {}, geometry: normalized }, {
      style: { color: "#1b6847", weight: 3, fillColor: "#83bd79", fillOpacity: 0.26 }
    });
    layer.eachLayer(item => boundaries.addLayer(item));
    changed();
    fitBoundary();
    if (message) status.textContent = message;
    return normalized;
  }

  function renderGeometry(geometry) {
    boundaries.clearLayers();
    preview.clearLayers();
    if (!geometry) return;
    const layer = window.L.geoJSON({ type: "Feature", properties: {}, geometry }, {
      style: { color: "#1b6847", weight: 3, fillColor: "#83bd79", fillOpacity: 0.26 }
    });
    layer.eachLayer(item => boundaries.addLayer(item));
    fitBoundary();
  }

  function clearPreview() { if (preview) preview.clearLayers(); }

  function showModePanel(mode) {
    const panelIds = { import: "boundaryImportPanel", crosshair: "boundaryCrosshairPanel", box: "boundaryBoxPanel", gpswalk: "boundaryGpsPanel" };
    Object.entries(panelIds).forEach(([key, id]) => { $(id).hidden = key !== mode; });
    $("mapCenterCrosshairOverlay").hidden = mode !== "crosshair";
    document.querySelectorAll("[data-boundary-mode]").forEach(button => {
      const active = button.dataset.boundaryMode === mode;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", String(active));
    });
  }

  function stopGpsWalk(finish) {
    if (gpsWatchId !== null) navigator.geolocation?.clearWatch(gpsWatchId);
    gpsWatchId = null;
    $("boundaryGpsStart").disabled = false;
    $("boundaryGpsFinish").disabled = true;
    if (finish) {
      if (gpsPoints.length < 3) {
        status.textContent = "Kapalı sınır için GPS kaydında en az üç farklı köşe gerekir.";
      } else {
        const coords = gpsPoints.map(point => [point.lng, point.lat]);
        applyGeometry({ type: "Polygon", coordinates: [closeRing(coords)] }, "GPS ile çevre kaydı tamamlandı; alanı kontrol edip tarla formunu kaydet.");
      }
    } else if (gpsPoints.length) {
      status.textContent = "GPS kaydı durduruldu; sınırı kullanmak için ‘Kaydı bitir’ düğmesine bas.";
    }
    setText("boundaryGpsCount", gpsPoints.length ? `${gpsPoints.length} konum noktası` : "GPS kaydı kapalı");
  }

  function setMode(mode) {
    if (gpsWatchId !== null) stopGpsWalk(false);
    activeMode = mode;
    boxFirstCorner = null;
    crosshairPoints = [];
    clearPreview();
    showModePanel(mode);
    setText("boundaryCrosshairCount", "0 nokta");
    if (mode !== "import") setText("boundaryImportSummary", "Alan, haritada çizilen sınırdan yaklaşık hesaplanır. Kadastro alanı farklı olabilir; resmi kayıt için TKGM verisini esas al.");
    if (mode === "draw") status.textContent = "Harita araç çubuğundan çokgen çiz veya mevcut sınırı düzenle.";
    if (mode === "import") status.textContent = "KML ya da GeoJSON dosyası seçerek parsel sınırını yükle.";
    if (mode === "crosshair") status.textContent = "Haritayı her köşeye taşı; ortadaki hedefi sırayla noktaya getir.";
    if (mode === "box") status.textContent = "Haritada dikdörtgenin karşılıklı iki köşesine dokun.";
    if (mode === "gpswalk") status.textContent = "GPS çevre kaydını başlatmak için düğmeye bas.";
  }

  function setDefaultMode(isNew = true) {
    if (isNew) setMode(window.matchMedia?.("(max-width: 767px), (pointer: coarse)").matches ? "crosshair" : "draw");
  }

  function previewCrosshair() {
    clearPreview();
    if (crosshairPoints.length >= 3) {
      window.L.polygon(crosshairPoints, { color: "#16a05a", weight: 3, dashArray: "6 5", fillColor: "#83bd79", fillOpacity: 0.16 }).addTo(preview);
    } else if (crosshairPoints.length >= 2) {
      window.L.polyline(crosshairPoints, { color: "#16a05a", weight: 3, dashArray: "6 5" }).addTo(preview);
    }
    setText("boundaryCrosshairCount", `${crosshairPoints.length} nokta${crosshairPoints.length >= 3 ? " · alan hazır" : ""}`);
  }

  function init() {
    if (map || !window.L || !window.L.Control?.Draw) return;
    const target = $("fieldBoundaryMap");
    if (!target) return;
    map = window.L.map(target, { zoomControl: true, scrollWheelZoom: false }).setView([40.98, 27.51], 10);
    const imagery = window.L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
      maxZoom: 19,
      attribution: 'Tiles &copy; Esri — Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community'
    });
    const streets = window.L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a>'
    });
    imagery.addTo(map);
    window.L.control.layers({ "Uydu · Esri": imagery, "OpenStreetMap": streets }, null, { position: "topright", collapsed: true }).addTo(map);
    boundaries = new window.L.FeatureGroup().addTo(map);
    preview = new window.L.LayerGroup().addTo(map);
    map.addControl(new window.L.Control.Draw({
      position: "topright",
      draw: {
        polygon: { allowIntersection: false, showArea: true, shapeOptions: { color: "#1b6847", fillColor: "#83bd79", fillOpacity: 0.26 } },
        rectangle: false, circle: false, circlemarker: false, marker: false, polyline: false
      },
      edit: { featureGroup: boundaries, remove: true }
    }));
    map.on(window.L.Draw.Event.CREATED, event => {
      boundaries.clearLayers();
      boundaries.addLayer(event.layer);
      changed();
    });
    map.on(window.L.Draw.Event.EDITED, changed);
    map.on(window.L.Draw.Event.DELETED, changed);
    map.on("click", event => {
      if (activeMode !== "box") return;
      if (!boxFirstCorner) {
        boxFirstCorner = event.latlng;
        clearPreview();
        window.L.circleMarker(boxFirstCorner, { radius: 6, color: "#fff", weight: 2, fillColor: "#16834a", fillOpacity: 1 }).addTo(preview);
        status.textContent = "İlk köşe alındı; karşı köşeye dokun.";
        return;
      }
      const bounds = window.L.latLngBounds(boxFirstCorner, event.latlng);
      const sw = bounds.getSouthWest(), ne = bounds.getNorthEast();
      applyGeometry({ type: "Polygon", coordinates: [[[sw.lng, sw.lat], [ne.lng, sw.lat], [ne.lng, ne.lat], [sw.lng, ne.lat], [sw.lng, sw.lat]]] }, "Hızlı dikdörtgen sınırı oluşturuldu; köşeleri düzenleyebilirsin.");
      boxFirstCorner = null;
    });

    selector.addEventListener("change", () => selectField(selector.value));
    document.querySelectorAll("[data-boundary-mode]").forEach(button => button.addEventListener("click", () => setMode(button.dataset.boundaryMode)));
    setDefaultMode();

    $("boundaryFileInput").addEventListener("change", async event => {
      const file = event.target.files?.[0];
      if (!file) return;
      if (file.size > 10 * 1024 * 1024) { status.textContent = "Dosya en fazla 10 MB olabilir."; event.target.value = ""; return; }
      status.textContent = `${file.name} okunuyor…`;
      setText("boundaryImportSummary", "Dosya içindeki varsa kadastro alanı, yüklenen sınırın hesaplanan alanıyla karşılaştırılacak.");
      try {
        const text = await file.text();
        let geometry, metadata = null;
        if (/\.kml$/i.test(file.name) || /<kml[\s>]/i.test(text)) ({ geometry, metadata } = parseKml(text));
        else {
          const parsed = JSON.parse(text);
          geometry = normalizeGeometry(getFeatureGeometry(parsed));
          const properties = parsed?.type === "Feature" ? parsed.properties : parsed?.features?.[0]?.properties;
          if (properties && typeof properties === "object") {
            const values = Object.fromEntries(Object.entries(properties).map(([key, value]) => [key.toLocaleLowerCase("tr-TR").replace(/[\s_./-]/g, ""), String(value ?? "").trim()]));
            const get = (...keys) => keys.map(key => values[key]).find(Boolean) || "";
            metadata = { name: get("name", "ad", "parseladi"), ada: get("ada", "adano"), parsel: get("parsel", "parselno"), location: get("mahalle", "mahallead", "koy") };
          }
        }
        const area = geometryAreaDecares(geometry);
        if (!area) throw new Error("Dosyadan geçerli alan hesaplanamadı.");
        applyGeometry(geometry, `${file.name} sınırı yüklendi · yaklaşık ${area.toLocaleString("tr-TR", { maximumFractionDigits: 2 })} da. Formu kaydetmeyi unutma.`);
        applyImportMetadata(metadata, area);
      } catch (error) {
        status.textContent = error.message || "Dosya okunamadı. KML veya Polygon GeoJSON kullan.";
      } finally { event.target.value = ""; }
    });

    $("boundaryCrosshairAdd").addEventListener("click", () => {
      if (activeMode !== "crosshair") return;
      crosshairPoints.push(map.getCenter());
      previewCrosshair();
    });
    $("boundaryCrosshairUndo").addEventListener("click", () => { crosshairPoints.pop(); previewCrosshair(); });
    $("boundaryCrosshairClear").addEventListener("click", () => { crosshairPoints = []; previewCrosshair(); status.textContent = "Hedef imleci noktaları temizlendi."; });
    $("boundaryCrosshairFinish").addEventListener("click", () => {
      if (crosshairPoints.length < 3) { status.textContent = "Sınırı tamamlamak için en az üç köşe noktası ekle."; return; }
      const ring = closeRing(crosshairPoints.map(point => [point.lng, point.lat]));
      applyGeometry({ type: "Polygon", coordinates: [ring] }, "Hedef imleciyle sınır tamamlandı; alanı kontrol edip tarla formunu kaydet.");
    });

    $("boundaryGpsStart").addEventListener("click", () => {
      if (!navigator.geolocation) { status.textContent = "Bu tarayıcı konum hizmetini desteklemiyor."; return; }
      gpsPoints = []; lastGpsPoint = null; clearPreview();
      $("boundaryGpsStart").disabled = true; $("boundaryGpsFinish").disabled = false;
      status.textContent = "GPS izni bekleniyor; tarla çevresinde yürüyebilirsin.";
      gpsWatchId = navigator.geolocation.watchPosition(position => {
        const point = window.L.latLng(position.coords.latitude, position.coords.longitude);
        if (position.coords.accuracy > 60) { setText("boundaryGpsCount", `GPS doğruluğu ±${Math.round(position.coords.accuracy)} m · daha iyi sinyal bekleniyor`); return; }
        const distance = lastGpsPoint ? map.distance(lastGpsPoint, point) : Infinity;
        if (distance < 5) return;
        gpsPoints.push(point); lastGpsPoint = point;
        clearPreview();
        if (gpsPoints.length >= 3) window.L.polygon(gpsPoints, { color: "#16834a", weight: 3, dashArray: "6 5", fillColor: "#83bd79", fillOpacity: 0.14 }).addTo(preview);
        else if (gpsPoints.length >= 2) window.L.polyline(gpsPoints, { color: "#16834a", weight: 3, dashArray: "6 5" }).addTo(preview);
        setText("boundaryGpsCount", `${gpsPoints.length} konum noktası`);
        map.panTo(point, { animate: false });
      }, error => {
        stopGpsWalk(false);
        status.textContent = error.code === 1 ? "Konum izni verilmedi. Tarayıcı ayarlarından izin verip yeniden dene." : "GPS konumu alınamadı; konum/GPS ayarlarını kontrol et.";
      }, { enableHighAccuracy: true, maximumAge: 1000, timeout: 15000 });
    });
    $("boundaryGpsFinish").addEventListener("click", () => stopGpsWalk(true));

    $("mapLocate")?.addEventListener("click", () => {
      if (!navigator.geolocation) { status.textContent = "Bu cihaz konum bilgisini desteklemiyor."; return; }
      status.textContent = "Cihaz konumu alınıyor…";
      navigator.geolocation.getCurrentPosition(position => {
        map.setView([position.coords.latitude, position.coords.longitude], 16);
        status.textContent = "Harita mevcut konumuna odaklandı.";
      }, error => {
        status.textContent = error.code === 1 ? "Konum izni verilmedi. Tarayıcı ayarlarından izin verip yeniden deneyin." : "Konum alınamadı. GPS/konum ayarlarını kontrol edip yeniden deneyin.";
      }, { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 });
    });
    $("mapPlaceSearch")?.addEventListener("submit", async event => {
      event.preventDefault();
      const query = $("mapPlaceQuery")?.value.trim();
      if (!query) { status.textContent = "Haritada aramak için mahalle veya köy adı yazın."; return; }
      if (Date.now() - lastPlaceSearchAt < 1000) { status.textContent = "Yeni arama için bir saniye bekleyin."; return; }
      lastPlaceSearchAt = Date.now();
      status.textContent = "Yer aranıyor…";
      const params = new URLSearchParams({ format: "jsonv2", limit: "1", countrycodes: "tr", q: query });
      try {
        const response = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, { headers: { Accept: "application/json" } });
        if (!response.ok) throw new Error("Arama servisine şu anda ulaşılamıyor.");
        const results = await response.json();
        if (!results.length) { status.textContent = `“${query}” için Türkiye'de yer bulunamadı.`; return; }
        const place = results[0];
        map.setView([Number(place.lat), Number(place.lon)], Math.max(map.getZoom(), 14));
        status.textContent = `Harita şu konuma odaklandı: ${place.display_name}`;
      } catch (error) { status.textContent = error.message || "Yer aranamadı. Bağlantını kontrol edip yeniden dene."; }
    });
  }

  function setText(id, value) { const node = $(id); if (node) node.textContent = value; }

  function refreshSelect() {
    if (!selector) return;
    const fields = window.ekinvyaGetFields?.() || [];
    const current = fields.some(item => String(item.id) === selectedId) ? selectedId : "new";
    selector.innerHTML = '<option value="new">Yeni tarla formuna bağla</option>'
      + fields.map(item => `<option value="${String(item.id).replace(/[&"<>']/g, "")}">${String(item.name).replace(/[&<>]/g, "")}</option>`).join("");
    selectedId = current;
    selector.value = current;
    if (map) renderGeometry(current === "new" ? draftGeometry : fields.find(item => String(item.id) === current)?.geometry);
  }

  function selectField(id) {
    selectedId = id === "new" ? "new" : String(id);
    if (selector) selector.value = selectedId;
    const field = (window.ekinvyaGetFields?.() || []).find(item => String(item.id) === selectedId);
    const geometry = selectedId === "new" ? draftGeometry : field?.geometry;
    if (map) renderGeometry(geometry);
    if (geometry && areaInput) areaInput.value = geometryAreaDecares(geometry).toFixed(2);
    status.textContent = selectedId === "new"
      ? "Yeni tarla için sınır çiz; kayıt sırasında forma eklenir."
      : field?.geometry ? `${field.name} sınırı yüklendi. Düzenlemeler bulut kaydına aktarılır.` : `${field?.name || "Seçili tarla"} için sınır çiz.`;
  }

  window.ekinvyaFieldMap = {
    init,
    resize() { if (map) window.setTimeout(() => map.invalidateSize(), 80); },
    refreshSelect,
    selectField,
    setDefaultMode,
    stopCapture() { if (gpsWatchId !== null) stopGpsWalk(false); },
    getDraftGeometry: () => draftGeometry,
    clearDraft() {
      if (gpsWatchId !== null) stopGpsWalk(false);
      draftGeometry = null; selectedId = "new"; crosshairPoints = []; boxFirstCorner = null;
      if (selector) selector.value = "new";
      if (map) renderGeometry(null);
      setDefaultMode();
    }
  };
})();
