(() => {
  const $ = id => document.getElementById(id);
  const selector = $("boundaryFieldSelect");
  const areaInput = $("fieldArea");
  const status = $("boundaryStatus");
  let map = null;
  let boundaries = null;
  let draftGeometry = null;
  let selectedId = "new";

  function geometryAreaDecares(geometry) {
    const ring = geometry?.coordinates?.[0];
    if (!Array.isArray(ring) || ring.length < 4) return 0;
    const radius = 6378137;
    let sum = 0;
    for (let i = 0; i < ring.length - 1; i += 1) {
      const [lon1, lat1] = ring[i];
      const [lon2, lat2] = ring[i + 1];
      sum += (lon2 - lon1) * Math.PI / 180
        * (2 + Math.sin(lat1 * Math.PI / 180) + Math.sin(lat2 * Math.PI / 180));
    }
    return Math.abs(sum * radius * radius / 2) / 1000;
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
    if (selectedId === "new") {
      draftGeometry = geometry;
      if (geometry && areaInput) areaInput.value = geometryAreaDecares(geometry).toFixed(2);
      status.textContent = geometry
        ? "Sınır yeni tarla formuna bağlandı; hesaplanan alan dekardır. Formu kaydetmeyi unutma."
        : "Yeni tarla formuna bağlanacak sınırı haritada çiz.";
      return;
    }
    const field = window.ekinvyaGetFields?.().find(item => String(item.id) === selectedId);
    if (field) {
      window.ekinvyaSetFieldGeometry?.(field.id, geometry, geometry ? geometryAreaDecares(geometry) : null);
      if (geometry) {
        const area = geometryAreaDecares(geometry);
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
    window.L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a>'
    }).addTo(map);
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
