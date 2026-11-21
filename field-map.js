(() => {
  const $ = id => document.getElementById(id);
  const selector = $("boundaryFieldSelect");
  const areaInput = $("fieldArea");
  const status = $("boundaryStatus");
  let map = null;
  let boundaries = null;
  let draftGeometry = null;
  let selectedId = "new";
  let lastPlaceSearchAt = 0;

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

  function renderGeometry(geometry) {
    boundaries.clearLayers();
    if (!geometry) return;
    const layer = window.L.geoJSON({ type: "Feature", properties: {}, geometry }, {
      style: { color: "#1b6847", weight: 3, fillColor: "#83bd79", fillOpacity: 0.26 }
    });
    layer.eachLayer(item => boundaries.addLayer(item));
    try { map.fitBounds(boundaries.getBounds(), { padding: [28, 28], maxZoom: 16 }); } catch { /* Invalid/empty geometry remains cleared. */ }
  }

  function currentGeometry() {
    let feature = null;
    boundaries.eachLayer(layer => { feature = layer.toGeoJSON(); });
    return feature?.geometry || null;
  }

  function changed() {
    const geometry = currentGeometry();
    const area = geometry ? geometryAreaDecares(geometry) : 0;
    if (geometry && areaInput) areaInput.value = area.toFixed(2);
    if (selectedId === "new") {
      draftGeometry = geometry;
      status.textContent = geometry
        ? "Sınır yeni tarla formuna bağlandı; hesaplanan alan dekardır. Formu kaydetmeyi unutma."
        : "Yeni tarla formuna bağlanacak sınırı haritada çiz.";
      return;
    }
    const field = window.ekinvyaGetFields?.().find(item => String(item.id) === selectedId);
    if (field) {
      window.ekinvyaSetFieldGeometry?.(field.id, geometry, geometry ? area : null);
      if (geometry) {
        status.textContent = `Sınır ${field.name} parseline kaydedildi · yaklaşık ${area.toLocaleString("tr-TR", { maximumFractionDigits: 2 })} da.`;
      } else {
        status.textContent = `Sınır ${field.name} parselinden kaldırıldı.`;
      }
    }
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
    selector.addEventListener("change", () => selectField(selector.value));
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
      } catch (error) {
        status.textContent = error.message || "Yer aranamadı. Bağlantını kontrol edip yeniden dene.";
      }
    });
  }

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
    if (map) renderGeometry(selectedId === "new" ? draftGeometry : field?.geometry);
    status.textContent = selectedId === "new"
      ? "Yeni tarla için sınır çiz; kayıt sırasında forma eklenir."
      : field?.geometry ? `${field.name} sınırı yüklendi. Düzenlemeler otomatik kaydedilir.` : `${field?.name || "Seçili tarla"} için sınır çiz.`;
  }

  window.ekinvyaFieldMap = {
    init,
    resize() { if (map) window.setTimeout(() => map.invalidateSize(), 80); },
    refreshSelect,
    selectField,
    getDraftGeometry: () => draftGeometry,
    clearDraft() { draftGeometry = null; selectedId = "new"; if (selector) selector.value = "new"; if (map) renderGeometry(null); }
  };
})();
