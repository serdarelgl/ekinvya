document.addEventListener('DOMContentLoaded', () => {
  const one = (selector) => document.querySelector(selector);
  const many = (selector) => [...document.querySelectorAll(selector)];
  const setText = (id, text) => { const node = document.getElementById(id); if (node) node.textContent = text; };
  const fields = () => window.ekinvyaParcels?.() || [];

  function renderDashboard() {
    const parcels = fields();
    const area = parcels.reduce((sum, parcel) => sum + Number(parcel.areaDecare || 0), 0);
    setText('homeParcelCount', String(parcels.length));
    setText('homeAreaTotal', `${area.toLocaleString('tr-TR', { maximumFractionDigits: 1 })} da`);
    setText('homeHectareTotal', `${(area / 10).toLocaleString('tr-TR', { maximumFractionDigits: 2 })} ha toplam`);
    const crops = [...new Set(parcels.map((parcel) => parcel.crop).filter(Boolean))];
    setText('homeCropSummary', crops.join(' · ') || 'Ürün bilgisi yok');
  }
  window.ekinvyaRenderDashboard = renderDashboard;
  renderDashboard();

  many('[data-go]').forEach((button) => button.addEventListener('click', () => window.ekinvyaNavigate?.(button.dataset.go)));

  const weatherLabel = (code) => {
    const labels = { 0: 'Açık', 1: 'Çoğunlukla açık', 2: 'Parçalı bulutlu', 3: 'Kapalı', 45: 'Sisli', 48: 'Sisli', 51: 'Çisenti', 53: 'Çisenti', 55: 'Çisenti', 56: 'Donan çisenti', 57: 'Donan çisenti', 61: 'Hafif yağmur', 63: 'Yağmur', 65: 'Kuvvetli yağmur', 71: 'Hafif kar', 73: 'Kar', 75: 'Kuvvetli kar', 80: 'Sağanak', 81: 'Sağanak', 82: 'Kuvvetli sağanak', 95: 'Gök gürültülü', 96: 'Dolu ihtimali', 99: 'Kuvvetli fırtına' };
    return labels[code] || 'Değişken hava';
  };
  const weatherIcon = (code) => Number(code) === 0 ? '☀' : [1, 2].includes(Number(code)) ? '⛅' : Number(code) === 3 ? '☁' : [45, 48].includes(Number(code)) ? '🌫' : [71, 73, 75, 77, 85, 86].includes(Number(code)) ? '🌨' : [95, 96, 99].includes(Number(code)) ? '⛈' : '🌧';
  const fmt = (value, digits = 0) => value === null || value === undefined || !Number.isFinite(Number(value)) ? '—' : Number(value).toFixed(digits);

  function renderWeather(data, latitude, longitude) {
    const current = data.current;
    const daily = data.daily;
    const hourly = data.hourly;
    const now = new Intl.DateTimeFormat('tr-TR', { hour: '2-digit', minute: '2-digit' }).format(new Date());
    setText('homeWeatherTemp', `${fmt(current.temperature_2m)}°`);
    setText('homeWeatherCondition', `${weatherIcon(current.weather_code)} ${weatherLabel(current.weather_code)}`);
    setText('homeWeatherWind', `${fmt(current.wind_speed_10m)} km/sa · %${fmt(current.relative_humidity_2m)} nem`);
    const dateTitle = (date, index) => index === 0 ? 'Bugün' : index === 1 ? 'Yarın' : new Intl.DateTimeFormat('tr-TR', { weekday: 'short' }).format(new Date(`${date}T12:00:00`));
    one('#homeForecast').innerHTML = daily.time.slice(0, 5).map((date, index) => `<article class="rounded-xl bg-white/10 border border-white/10 p-3"><div class="text-xs font-semibold">${dateTitle(date, index)} ${weatherIcon(daily.weather_code[index])}</div><div class="text-sm font-bold mt-2">${fmt(daily.temperature_2m_min[index])}° / ${fmt(daily.temperature_2m_max[index])}°</div><div class="text-[10px] text-emerald-100 mt-1">Yağış %${fmt(daily.precipitation_probability_max[index])}</div></article>`).join('');
    const updated = `Konum ${latitude.toFixed(4)}, ${longitude.toFixed(4)} · ${now} itibarıyla güncellendi.`;
    setText('homeWeatherStatus', updated);
    setText('weatherStatusPage', updated);

    const metrics = [
      ['Sıcaklık', `${fmt(current.temperature_2m)} °C`], ['Hissedilen', `${fmt(current.apparent_temperature)} °C`],
      ['Hava durumu', `${weatherIcon(current.weather_code)} ${weatherLabel(current.weather_code)}`], ['Bağıl nem', `%${fmt(current.relative_humidity_2m)}`],
      ['Rüzgâr / hamle', `${fmt(current.wind_speed_10m)} / ${fmt(current.wind_gusts_10m)} km/sa`], ['Rüzgâr yönü', `${fmt(current.wind_direction_10m)}°`],
      ['Basınç', `${fmt(current.pressure_msl)} hPa`], ['Bulutluluk', `%${fmt(current.cloud_cover)}`],
      ['Çiy noktası', `${fmt(current.dew_point_2m)} °C`], ['Yağış', `${fmt(current.precipitation, 1)} mm`],
      ['UV indeksi', fmt(current.uv_index, 1)], ['Görüş', `${fmt(Number(current.visibility) / 1000, 1)} km`]
    ];
    one('#weatherDetail').innerHTML = metrics.map(([label, value]) => `<div class="rounded-xl bg-slate-50 p-3"><div class="text-[10px] font-bold uppercase tracking-wide text-slate-400">${label}</div><strong class="block mt-1 text-sm text-slate-900">${value}</strong></div>`).join('');
    one('#weatherForecast').innerHTML = daily.time.map((date, index) => `<article class="rounded-xl border border-slate-200 bg-white p-3 text-center"><div class="text-xs font-bold">${dateTitle(date, index)}</div><div class="text-lg mt-1" aria-hidden="true">${weatherIcon(daily.weather_code[index])}</div><div class="text-xs font-semibold mt-1">${fmt(daily.temperature_2m_min[index])}° / ${fmt(daily.temperature_2m_max[index])}°</div><div class="text-[10px] text-sky-700 mt-1">${fmt(daily.precipitation_sum[index], 1)} mm · %${fmt(daily.precipitation_probability_max[index])}</div><div class="text-[10px] text-slate-500 mt-1">Rüzgâr ${fmt(daily.wind_speed_10m_max[index])} km/sa</div></article>`).join('');
    const hourStart = Math.max(0, hourly.time.findIndex((time) => time >= current.time));
    one('#weatherHourly').innerHTML = hourly.time.slice(hourStart, hourStart + 24).map((time, offset) => {
      const index = hourStart + offset;
      const hour = new Intl.DateTimeFormat('tr-TR', { hour: '2-digit', minute: '2-digit' }).format(new Date(time));
      return `<article class="min-w-[108px] rounded-xl bg-slate-50 p-3 text-center"><time class="text-xs font-bold text-slate-600">${hour}</time><div class="text-lg mt-1" aria-hidden="true">${weatherIcon(hourly.weather_code[index])}</div><strong class="text-sm">${fmt(hourly.temperature_2m[index])}°</strong><div class="text-[10px] text-slate-500 mt-1">Yağış %${fmt(hourly.precipitation_probability[index])}<br>Rüzgâr ${fmt(hourly.wind_speed_10m[index])} km/sa</div></article>`;
    }).join('');

    const windy = new URL('https://embed.windy.com/embed2.html');
    Object.entries({ lat: latitude, lon: longitude, detailLat: latitude, detailLon: longitude, width: 900, height: 620, zoom: 8, level: 'surface', overlay: 'wind', product: 'ecmwf', menu: true, message: true, marker: true, forecast: 12, calendar: 'now', pressure: true, type: 'map', location: 'coordinates', detail: true, metricWind: 'km/h', metricTemp: '°C' }).forEach(([key, value]) => windy.searchParams.set(key, String(value)));
    one('#windyMap').src = windy.toString();
    one('#windyPlaceholder').classList.add('hidden');
    one('#windyFullLink').href = `https://www.windy.com/${latitude}/${longitude}?${latitude},${longitude},8`;
  }

  async function loadWeather(position) {
    const latitude = Number(position.coords.latitude.toFixed(4));
    const longitude = Number(position.coords.longitude.toFixed(4));
    setText('homeWeatherStatus', 'Konum alındı, hava raporu yükleniyor…');
    setText('weatherStatusPage', 'Open-Meteo verisi yükleniyor…');
    const params = new URLSearchParams({
      latitude: String(latitude), longitude: String(longitude),
      current: 'temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,wind_speed_10m,wind_direction_10m,wind_gusts_10m,dew_point_2m,pressure_msl,cloud_cover,visibility,uv_index',
      hourly: 'temperature_2m,precipitation_probability,weather_code,wind_speed_10m',
      daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum,wind_speed_10m_max,sunrise,sunset,uv_index_max',
      timezone: 'auto', forecast_days: '7', wind_speed_unit: 'kmh', precipitation_unit: 'mm'
    });
    try {
      const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      if (!data.current || !data.hourly || !data.daily) throw new Error('Eksik tahmin verisi');
      renderWeather(data, latitude, longitude);
    } catch (error) {
      setText('homeWeatherStatus', 'Hava raporu alınamadı. Bağlantıyı kontrol edip yeniden dene.');
      setText('weatherStatusPage', 'Hava raporu alınamadı. Konumu yeniden isteyebilirsin.');
      console.error('Hava raporu alınamadı:', error);
    }
  }

  many('[data-weather-locate]').forEach((button) => button.addEventListener('click', () => {
    if (!navigator.geolocation) {
      setText('homeWeatherStatus', 'Tarayıcı konum hizmetini desteklemiyor.');
      setText('weatherStatusPage', 'Tarayıcı konum hizmetini desteklemiyor.');
      return;
    }
    setText('homeWeatherStatus', 'Konum izni bekleniyor…');
    setText('weatherStatusPage', 'Konum izni bekleniyor…');
    navigator.geolocation.getCurrentPosition(loadWeather, (error) => {
      const message = error.code === 1 ? 'Konum izni verilmedi. Tarayıcı ayarlarından izin verip yeniden deneyebilirsin.' : 'Konum alınamadı. GPS bağlantısını kontrol edip yeniden dene.';
      setText('homeWeatherStatus', message);
      setText('weatherStatusPage', message);
    }, { enableHighAccuracy: false, timeout: 12000, maximumAge: 300000 });
  }));

  function makeAssistantAnswer(topic, question = '') {
    const parcels = fields();
    const crops = [...new Set(parcels.map((parcel) => parcel.crop).filter(Boolean))];
    let message;
    if (topic === 'weather' || /hava|yağış|ilaç|rüzgâr|ruzgar/i.test(question)) {
      message = 'Konuma göre güncel yağış, rüzgâr ve tahmini Hava Durumu bölümünden kontrol et. İlaçlama öncesinde ürün etiketi, rüzgâr sınırı, yağış aralığı ve tarla koşullarını doğrula; yalnızca tahmine dayanarak uygulama yapma.';
    } else if (topic === 'field' || /parsel|tarla|alan/i.test(question)) {
      const area = parcels.reduce((sum, parcel) => sum + Number(parcel.areaDecare || 0), 0);
      message = `Kayıtlarda ${parcels.length} parsel ve toplam ${area.toLocaleString('tr-TR', { maximumFractionDigits: 1 })} da alan var. Ürünler: ${crops.join(', ') || 'ürün bilgisi girilmemiş'}. Örnek kayıtlar varsa önce Parsellerim bölümünden doğrula.`;
    } else {
      message = `Kayıtlı ürünler: ${crops.join(', ') || 'henüz ürün yok'}. Ürün gelişimini değerlendirirken çeşit, ekim tarihi, toprak analizi ve tarladaki gözlemleri birlikte kullan. Kesin doz kararı için analiz ve ürün etiketi esas alınmalıdır.`;
    }
    const answer = one('#assistantAnswer');
    answer.textContent = `${message}${question ? ` Soru: “${question}”` : ''}`;
    answer.classList.remove('hidden');
  }
  many('[data-advice]').forEach((button) => button.addEventListener('click', () => makeAssistantAnswer(button.dataset.advice)));
  one('#assistantQuestionForm').addEventListener('submit', (event) => {
    event.preventDefault();
    const question = one('#assistantQuestion').value.trim();
    if (question) makeAssistantAnswer('question', question);
  });
});
