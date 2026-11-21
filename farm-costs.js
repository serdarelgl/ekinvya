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
    formField.innerHTML = fields.map(field => `<option value="${safe(field.id)}">${safe(fieldTitle(field))} · ${safe(field.area)} da</option>`).join("");
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
    const breakEvenPrice = area && yieldKgDa ? total / (area * yieldKgDa) : 0;
    $("farmBreakEven").textContent = hasRevenueInputs ? `Başabaş fiyatı yaklaşık ${fmt(breakEvenPrice)} ₺/kg` : "Gelir varsayımlarını girerek başabaş fiyatını gör";

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
      return `<tr><td>${safe(cost.date ? new Date(`${cost.date}T12:00:00`).toLocaleDateString("tr-TR") : "—")}</td><td>${safe(field?.name || "Parsel silinmiş")}</td><td><span class="pill">${safe(cost.cat || "Diğer")}</span></td><td class="farm-cost-description-cell">${safe(cost.desc || "—")}</td><td><strong>${fmt(amount(cost.amount))} ₺</strong></td><td><button class="farm-cost-delete" type="button" data-cost-delete="${safe(cost.id)}" aria-label="${safe(field?.name || "Parsel")} gider kaydını sil">${confirmed ? "Tekrar bas: sil" : "Sil"}</button></td></tr>`;
    }).join("") : '<tr><td colspan="6" class="emptyhint">Henüz gider kaydı yok. “Yeni gider ekle” düğmesiyle başlayabilirsin.</td></tr>';
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
    if (fieldId && fields.some(field => String(field.id) === String(fieldId))) $("farmCostFormField").value = String(fieldId);
    else if ($("farmCostFieldFilter").value !== "ALL") $("farmCostFormField").value = $("farmCostFieldFilter").value;
    $("farmCostFormField").focus();
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
  $("farmCostForm").addEventListener("submit", event => {
    event.preventDefault();
    const fieldId = $("farmCostFormField").value, date = $("farmCostFormDate").value, amountTry = amount($("farmCostFormAmount").value);
    if (!fieldId || !date || !(amountTry > 0)) { toast("Parsel, tarih ve geçerli tutar gerekli."); return; }
    const costs = getCosts();
    costs.push({id:Date.now(), fieldId:Number(fieldId), date, cat:$("farmCostFormCategory").value, desc:$("farmCostFormDescription").value.trim(), amount:amountTry});
    if (setCosts(costs)) {
      render();
      closeDialog();
      if (typeof renderSeason === "function") renderSeason();
      if (typeof renderFields === "function") renderFields();
      toast("Gider kaydedildi ve bulut eşitlemesine alındı.");
    }
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
