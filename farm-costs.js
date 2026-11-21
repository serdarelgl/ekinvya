(() => {
  const categories = ["Taban gübresi", "Üst gübre", "Yaprak gübresi", "İlaç (genel)", "Herbisit", "Fungisit", "İnsektisit", "Tohum", "Mazot / Yakıt", "İşçilik", "Sulama", "Kira", "Makine / Hizmet", "Nakliye", "Diğer"];
  const $ = id => document.getElementById(id);
  const safe = value => String(value ?? "").replace(/[&<>"']/g, ch => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
  const fieldTitle = field => `${field.name || "Parsel"}${field.crop ? ` · ${field.crop}` : ""}`;
  let pendingDelete = null;
  let opener = null;
  const amount = value => Number(value) || 0;

  function refreshSelectors(fields, costs) {
    const select = $("farmCostFieldFilter"), prior = select.value;
    select.innerHTML = '<option value="ALL">Tüm parseller</option>' + fields.map(field => `<option value="${safe(field.id)}">${safe(fieldTitle(field))}</option>`).join("");
    select.value = fields.some(field => String(field.id) === prior) ? prior : "ALL";
    const formField = $("farmCostFormField"), formPrior = formField.value;
    formField.innerHTML = '<option value="ALL">Tüm parsellere alanına göre dağıt</option>' + fields.map(field => `<option value="${safe(field.id)}">${safe(fieldTitle(field))} · ${safe(field.area)} da</option>`).join("");
    if (fields.some(field => String(field.id) === formPrior)) formField.value = formPrior;
    const years = [...new Set(costs.map(cost => String(cost.date || "").slice(0, 4)).filter(year => /^\d{4}$/.test(year)))].sort().reverse();
    const yearSelect = $("farmCostYear"), prevYear = yearSelect.value;
    yearSelect.innerHTML = '<option value="ALL">Tüm yıllar</option>' + years.map(year => `<option value="${year}">${year}</option>`).join("");
    yearSelect.value = years.includes(prevYear) ? prevYear : "ALL";
  }

  function render() {
    const fields = getFields(), costs = getCosts();
    refreshSelectors(fields, costs);
    const fieldFilter = $("farmCostFieldFilter").value, yearFilter = $("farmCostYear").value, catFilter = $("farmCostCategoryFilter").value;
    const scopedFields = fields.filter(field => fieldFilter === "ALL" || String(field.id) === fieldFilter);
    const scopedIds = new Set(scopedFields.map(field => String(field.id)));
    const scopedCosts = costs.filter(cost => scopedIds.has(String(cost.fieldId)) && (yearFilter === "ALL" || String(cost.date || "").startsWith(yearFilter)));
    const displayed = scopedCosts.filter(cost => catFilter === "ALL" || cost.cat === catFilter);
    const total = scopedCosts.reduce((sum, cost) => sum + amount(cost.amount), 0);
    const area = scopedFields.reduce((sum, field) => sum + amount(field.area), 0);
    const perDa = area ? total / area : 0;

    const categorySelect = $("farmCostCategoryFilter"), categoryPrior = categorySelect.value;
    const usedCategories = [...new Set(costs.map(cost => cost.cat).filter(Boolean))];
    const allCategories = [...new Set([...categories, ...usedCategories])];
    categorySelect.innerHTML = '<option value="ALL">Tüm kategoriler</option>' + allCategories.map(category => `<option value="${safe(category)}">${safe(category)}</option>`).join("");
    categorySelect.value = allCategories.includes(categoryPrior) ? categoryPrior : "ALL";
    $("farmCostFormCategory").innerHTML = categories.map(category => `<option>${safe(category)}</option>`).join("");

    $("farmCostTotal").textContent = `${fmt(total)} ₺`;
    $("farmCostPeriod").textContent = `${yearFilter === "ALL" ? "Tüm yıllar" : yearFilter} · ${scopedFields.length} parsel`;
    $("farmCostPerDa").textContent = area ? `${fmt(perDa)} ₺/da` : "—";

    const yieldKgDa = amount($("farmCostYield").value), pricePerKg = amount($("farmCostPrice").value);
    const hasRevenueInputs = yieldKgDa > 0 && pricePerKg > 0 && area > 0;
    const gross = hasRevenueInputs ? yieldKgDa * pricePerKg * area : 0;
    const net = gross - total;
    $("farmGrossRevenue").textContent = hasRevenueInputs ? `${fmt(gross)} ₺` : "—";
    $("farmGrossNote").textContent = hasRevenueInputs ? `${fmt(yieldKgDa)} kg/da × ${fmt(pricePerKg)} ₺/kg · ${fmt(area)} da` : "Verim ve fiyat varsayımı gir";
    $("farmNetLabel").textContent = hasRevenueInputs ? (net < 0 ? "TAHMİNİ NET ZARAR" : "TAHMİNİ NET KÂR") : "TAHMİNİ NET SONUÇ";
    $("farmNetResult").textContent = hasRevenueInputs ? `${fmt(net)} ₺` : "—";
    const breakEvenYield = area && pricePerKg ? (total / area) / pricePerKg : 0;
    $("farmBreakEven").textContent = area && pricePerKg ? `Başabaş verimi yaklaşık ${fmt(breakEvenYield)} kg/da` : "Başabaş verimi için satış fiyatı gir";

    const byCategory = new Map();
    scopedCosts.forEach(cost => byCategory.set(cost.cat || "Diğer", (byCategory.get(cost.cat || "Diğer") || 0) + amount(cost.amount)));
    const categoryRows = [...byCategory].sort((a, b) => b[1] - a[1]);
    $("farmCostCategoryCount").textContent = `${categoryRows.length} kategori`;
    $("farmCostCategoryBars").innerHTML = categoryRows.length ? categoryRows.map(([category, sum]) => {
      const percent = total ? sum / total * 100 : 0;
      return `<div class="farm-cost-category-row"><div><strong>${safe(category)}</strong><span>${fmt(sum)} ₺ · %${fmt(percent)}</span></div><div class="farm-cost-track" role="img" aria-label="${safe(category)} gider payı yüzde ${fmt(percent)}"><i style="width:${Math.max(0, Math.min(100, percent))}%"></i></div></div>`;
    }).join("") : '<p class="emptyhint">Bu filtrelerde gider kaydı bulunmuyor.</p>';

    $("farmCostRowsSummary").textContent = `${displayed.length} gider kaydı · ${fmt(area)} da kapsam alanı · toplam ${fmt(total)} ₺`;
    $("farmCostRows").innerHTML = displayed.length ? displayed.slice().sort((a, b) => String(b.date).localeCompare(String(a.date))).map(cost => {
      const field = fields.find(row => String(row.id) === String(cost.fieldId));
      const confirmed = pendingDelete === cost.id;
      const perDaCost = field?.area ? amount(cost.amount) / amount(field.area) : 0;
      return `<tr><td>${safe(cost.date ? new Date(`${cost.date}T12:00:00`).toLocaleDateString("tr-TR") : "—")}</td><td>${safe(field?.name || "Parsel silinmiş")}</td><td><span class="pill">${safe(cost.cat || "Diğer")}</span></td><td class="farm-cost-description-cell">${safe(cost.desc || "—")}</td><td>${field?.area ? `${fmt(perDaCost)} ₺` : "—"}</td><td><strong>${fmt(amount(cost.amount))} ₺</strong></td><td><button class="farm-cost-delete" type="button" data-cost-delete="${safe(cost.id)}" aria-label="${safe(field?.name || "Parsel")} gider kaydını sil">${confirmed ? "Tekrar bas: sil" : "Sil"}</button></td></tr>`;
    }).join("") : '<tr><td colspan="7" class="emptyhint">Henüz gider kaydı yok. “Yeni gider ekle” düğmesiyle başlayabilirsin.</td></tr>';
  }

  function setRevenueDefaults() {
    const selected = $("farmCostFieldFilter").value, fields = getFields().filter(field => selected === "ALL" || String(field.id) === selected);
    const year = $("farmCostYear").value === "ALL" ? new Date().getFullYear() : Number($("farmCostYear").value);
    const seasonal = fields.map(field => getSeasonData()[`${field.id}_${year}`] || {}).filter(data => amount(data.yieldKgDa) > 0 && amount(data.pricePerKg) > 0);
    if (seasonal.length) {
      $("farmCostYield").value = Math.round(seasonal.reduce((sum, data) => sum + amount(data.yieldKgDa), 0) / seasonal.length);
      $("farmCostPrice").value = (seasonal.reduce((sum, data) => sum + amount(data.pricePerKg), 0) / seasonal.length).toFixed(2);
    } else {
      $("farmCostYield").value = "450";
      $("farmCostPrice").value = "0";
    }
    render();
  }

  function openDialog(fieldId) {
    const fields = getFields();
    if (!fields.length) { toast("Önce Parsellerim bölümünden bir parsel ekle."); return; }
    refreshSelectors(fields, getCosts());
    opener = document.activeElement;
    const dialog = $("farmCostDialog");
    dialog.hidden = false;
    document.body.classList.add("field-dialog-open");
    $("farmCostForm").reset();
    $("farmCostFormDate").value = todayStr();
    $("farmCostFormField").value = "ALL";
    if (fieldId && fields.some(field => String(field.id) === String(fieldId))) $("farmCostFormField").value = String(fieldId);
    else if ($("farmCostFieldFilter").value !== "ALL") $("farmCostFormField").value = $("farmCostFieldFilter").value;
    $("farmCostFormField").focus();
    updateAmountPreview();
  }

  function updateAmountPreview() {
    const scope = $("farmCostFormField").value, fields = getFields().filter(field => scope === "ALL" || String(field.id) === scope);
    const raw = amount($("farmCostFormAmount").value), unitMode = $("farmCostEntryMode").value === "unit";
    const area = fields.reduce((sum, field) => sum + amount(field.area), 0);
    const label = $("farmCostFormAmountLabel");
    label.textContent = unitMode ? "Dekar başına tutar (₺/da) *" : "Toplam tutar (₺) *";
    $("farmCostFormAmount").placeholder = unitMode ? "Örn. 850" : "Örn. 12500";
    const total = unitMode ? raw * area : raw;
    const preview = $("farmCostAmountPreview");
    if (!raw || !area) preview.textContent = scope === "ALL" ? "Parsellerin kayıtlı alanına göre paylaştırılır; kayıtlar her parsele ayrı gider olarak eklenir." : "Tutar girdiğinde parsel alanına göre toplam hesaplanır.";
    else preview.textContent = unitMode
      ? `${fmt(raw)} ₺/da × ${fmt(area)} da = ${fmt(total)} ₺ toplam${fields.length > 1 ? ` · ${fields.length} parsele alan payına göre dağıtılır` : ""}.`
      : `${fmt(total)} ₺ toplam${fields.length > 1 ? ` · ${fields.length} parsele alan payına göre dağıtılır` : ""}${area ? ` · ortalama ${fmt(total / area)} ₺/da` : ""}.`;
  }

  function closeDialog() {
    $("farmCostDialog").hidden = true;
    document.body.classList.remove("field-dialog-open");
    if (opener?.isConnected) opener.focus();
    opener = null;
  }

  $("farmCostFieldFilter").addEventListener("change", setRevenueDefaults);
  $("farmCostYear").addEventListener("change", setRevenueDefaults);
  $("farmCostYield").addEventListener("input", render);
  $("farmCostPrice").addEventListener("input", render);
  $("farmCostCategoryFilter").addEventListener("change", render);
  $("openFarmCostForm").addEventListener("click", () => openDialog());
  $("closeFarmCostForm").addEventListener("click", closeDialog);
  $("cancelFarmCostForm").addEventListener("click", closeDialog);
  $("farmCostDialog").addEventListener("click", event => { if (event.target === $("farmCostDialog")) closeDialog(); });
  $("farmCostDialog").querySelector(".field-dialog").addEventListener("keydown", event => {
    if (event.key === "Escape") { event.preventDefault(); closeDialog(); }
    if (event.key !== "Tab") return;
    const items = [...$("farmCostDialog").querySelectorAll('button:not([disabled]),input:not([disabled]),select:not([disabled])')].filter(item => !item.closest("[hidden]"));
    if (event.shiftKey && document.activeElement === items[0]) { event.preventDefault(); items.at(-1).focus(); }
    else if (!event.shiftKey && document.activeElement === items.at(-1)) { event.preventDefault(); items[0].focus(); }
  });
  $("farmCostForm").addEventListener("submit", async event => {
    event.preventDefault();
    const scope = $("farmCostFormField").value, date = $("farmCostFormDate").value, entered = amount($("farmCostFormAmount").value);
    const selectedFields = getFields().filter(field => scope === "ALL" || String(field.id) === scope);
    const fields = selectedFields.filter(field => Number.isFinite(amount(field.area)) && amount(field.area) > 0), area = fields.reduce((sum, field) => sum + amount(field.area), 0);
    if (!fields.length || !date || !Number.isFinite(entered) || !(entered > 0) || !Number.isFinite(area) || !(area > 0) || selectedFields.length !== fields.length) { toast("Parsel alanı, tarih ve geçerli tutar gerekli. Alanı sıfır olan parseller toplu dağıtıma katılamaz."); return; }
    const previous = getCosts(), costs = previous.slice();
    const unitMode = $("farmCostEntryMode").value === "unit";
    const rawTotal = unitMode ? entered * area : entered;
    if (!Number.isFinite(rawTotal) || !Number.isFinite(Math.round(rawTotal * 100))) { toast("Toplam gider tutarı geçerli sayı sınırını aşıyor."); return; }
    const totalCents = Math.round(rawTotal * 100);
    const baseId = Date.now(), desc = $("farmCostFormDescription").value.trim(), allocations = fields.map(field => {
      const exact = totalCents * amount(field.area) / area;
      return { field, cents:Math.floor(exact), remainder:exact - Math.floor(exact) };
    });
    let centsLeft = totalCents - allocations.reduce((sum, row) => sum + row.cents, 0);
    allocations.slice().sort((a, b) => b.remainder - a.remainder).slice(0, centsLeft).forEach(row => { row.cents += 1; });
    allocations.forEach(({field, cents}) => {
      const totalAmount = cents / 100, unitAmount = unitMode ? entered : totalAmount / amount(field.area);
      costs.push({ id: baseId + costs.length, fieldId: Number(field.id), date, cat:$("farmCostFormCategory").value, desc:fields.length > 1 ? `${desc || "Toplu gider"} · alan payı` : desc, amount:totalAmount, unitAmount:Number(unitAmount.toFixed(6)) });
    });
    const saveButton = $("saveFarmCostButton"); saveButton.disabled = true; saveButton.textContent = "Buluta kaydediliyor…";
    try {
      const cloud = window.ekinvyaCloud, client = window.ekinvyaSupabaseClient;
      if (!cloud || !client) throw new Error("Bulut bağlantısı bulunamadı. Yeniden giriş yapıp tekrar dene.");
      const { data: { user }, error } = await client.auth.getUser();
      if (error || !user || !cloud.isReadyFor(user.id)) throw new Error("Hesap verileri bulutla eşitleniyor. Birkaç saniye sonra tekrar dene.");
      if (!setCosts(costs)) throw new Error("Gider yerel kayda yazılamadı.");
      await cloud.flush();
      render();
      closeDialog();
      if (typeof renderSeason === "function") renderSeason();
      if (typeof renderFields === "function") renderFields();
      toast(fields.length > 1 ? `Gider ${fields.length} parsele alanına göre paylaştırıldı ve bulut eşitlemesine alındı.` : "Gider kaydedildi ve bulut eşitlemesine alındı.");
    } catch (error) {
      setCosts(previous); render();
      toast(error.message || "Gider buluta kaydedilemedi. Formdaki bilgiler korunuyor.");
    } finally { saveButton.disabled = false; saveButton.textContent = "＋ Gideri kaydet"; }
  });
  $("farmCostFormField").addEventListener("change", updateAmountPreview);
  $("farmCostEntryMode").addEventListener("change", updateAmountPreview);
  $("farmCostFormAmount").addEventListener("input", updateAmountPreview);
  $("farmCostExport").addEventListener("click", () => {
    const fields = getFields(), fieldFilter = $("farmCostFieldFilter").value, yearFilter = $("farmCostYear").value, catFilter = $("farmCostCategoryFilter").value;
    const names = new Map(fields.map(field => [String(field.id), field]));
    const rows = getCosts().filter(cost => (fieldFilter === "ALL" || String(cost.fieldId) === fieldFilter)
      && (yearFilter === "ALL" || String(cost.date || "").startsWith(yearFilter)) && (catFilter === "ALL" || cost.cat === catFilter));
    const cell = value => {
      let text = String(value ?? "");
      if (/^[\s]*[=+@-]/.test(text)) text = `'${text}`;
      return `"${text.replace(/"/g, '""')}"`;
    };
    const csv = [["Tarih","Parsel","Alan (da)","Kategori","Açıklama","Maliyet (₺/da)","Toplam (₺)"], ...rows.map(cost => {
      const field = names.get(String(cost.fieldId)), total = amount(cost.amount), area = amount(field?.area);
      return [cost.date || "", field?.name || "Parsel silinmiş", area || "", cost.cat || "Diğer", cost.desc || "", area ? total / area : "", total];
    })].map(row => row.map(cell).join(";")).join("\r\n");
    const blob = new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" }), url = URL.createObjectURL(blob), link = document.createElement("a");
    link.href = url; link.download = `ekinvya-giderler-${yearFilter === "ALL" ? "tum-yillar" : yearFilter}.csv`; link.click(); URL.revokeObjectURL(url);
  });
  $("farmCostRows").addEventListener("click", event => {
    const button = event.target.closest("[data-cost-delete]");
    if (!button) return;
    const id = Number(button.dataset.costDelete);
    if (pendingDelete !== id) { pendingDelete = id; render(); toast("Silmek için aynı düğmeye yeniden bas."); return; }
    pendingDelete = null;
    if (setCosts(getCosts().filter(cost => Number(cost.id) !== id))) {
      render();
      if (typeof renderSeason === "function") renderSeason();
      if (typeof renderFields === "function") renderFields();
      toast("Gider kaydı silindi.");
    }
  });

  window.ekinvyaRenderFarmCosts = render;
  window.ekinvyaOpenFarmCostDialog = openDialog;
  render();
})();
