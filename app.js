
const PRESETS=[
 {name:"Özel gübre",n:0,p:0,k:0},{name:"Üre (46-0-0)",n:46,p:0,k:0},
 {name:"Amonyum nitrat (33-0-0)",n:33,p:0,k:0},{name:"CAN (26-0-0)",n:26,p:0,k:0},
 {name:"Amonyum sülfat (21-0-0)",n:21,p:0,k:0},{name:"DAP (18-46-0)",n:18,p:46,k:0},
 {name:"MAP (12-61-0)",n:12,p:61,k:0},{name:"TSP (0-46-0)",n:0,p:46,k:0},
 {name:"15-15-15",n:15,p:15,k:15},{name:"20-20-0",n:20,p:20,k:0},
 {name:"20-20-20",n:20,p:20,k:20},{name:"13-24-12",n:13,p:24,k:12},
 {name:"Potasyum sülfat (0-0-50)",n:0,p:0,k:50},{name:"Potasyum nitrat (13-0-46)",n:13,p:0,k:46}
];
const $=id=>document.getElementById(id);
const num=v=>{const n=parseFloat(String(v??"").replace(",", "."));return Number.isFinite(n)?n:0};
const fmt=v=>Number((Number(v)||0).toFixed(2)).toLocaleString("tr-TR",{maximumFractionDigits:2});
let fertId=0;
function addFert(preset=5,qty=100){
 const id=++fertId, el=document.createElement("div");el.className="fertrow";el.dataset.id=id;
 el.innerHTML=`<div class="fertname"><label>Gübre cinsi</label><select class="preset">${PRESETS.map((p,i)=>`<option value="${i}">${p.name}</option>`).join("")}</select></div>
 <div><label>N %</label><input class="n" type="text" inputmode="decimal" min="0" max="100" step="any"></div>
 <div><label>P₂O₅ %</label><input class="p" type="text" inputmode="decimal" min="0" max="100" step="any"></div>
 <div><label>K₂O %</label><input class="k" type="text" inputmode="decimal" min="0" max="100" step="any"></div>
 <div><label>Toplam kg</label><input class="q" type="text" inputmode="decimal" min="0" step="any" value="${qty}"></div>
 <button class="remove" type="button" aria-label="Gübreyi sil">×</button>`;
 $("fertlist").appendChild(el);
 const presetEl=el.querySelector(".preset");
 function setPreset(){const p=PRESETS[+presetEl.value];el.querySelector(".n").value=p.n;el.querySelector(".p").value=p.p;el.querySelector(".k").value=p.k;calc();}
 presetEl.value=preset;presetEl.addEventListener("change",setPreset);
 el.querySelectorAll("input").forEach(i=>i.addEventListener("input",calc));
 el.querySelector(".remove").addEventListener("click",()=>{el.remove();calc()});
 setPreset();
}
function calc(){
 const area=num($("area").value), rows=[];let N=0,P=0,K=0,total=0;
 document.querySelectorAll(".fertrow").forEach(el=>{
  const q=Math.max(0,num(el.querySelector(".q").value)), per=area>0?q/area:0;
  const n=per*num(el.querySelector(".n").value)/100,p=per*num(el.querySelector(".p").value)/100,k=per*num(el.querySelector(".k").value)/100;
  N+=n;P+=p;K+=k;total+=q;
  rows.push({name:PRESETS[+el.querySelector(".preset").value].name,q,per,n,p,k});
 });
 $("outN").textContent=fmt(N);$("outP").textContent=fmt(P);$("outK").textContent=fmt(K);
 $("resultArea").textContent=`${fmt(area)} da için hesaplanıyor`;
 $("totalFert").textContent=`${fmt(total)} kg`;
 $("elemental").textContent=`P: ${fmt(P*.436)} • K: ${fmt(K*.83)} kg/da`;
 $("resultRows").innerHTML=rows.map(r=>`<tr><td>${r.name}</td><td>${fmt(r.per)}</td><td>${fmt(r.n)}</td><td>${fmt(r.p)}</td><td>${fmt(r.k)}</td></tr>`).join("")+`<tr><td><b>TOPLAM</b></td><td><b>${fmt(rows.reduce((a,r)=>a+r.per,0))}</b></td><td><b>${fmt(N)}</b></td><td><b>${fmt(P)}</b></td><td><b>${fmt(K)}</b></td></tr>`;
 const d={plant:$("plant").value.trim()||"Belirtilmedi",area,rows,N,P,K,total,createdAt:new Date().toISOString()};updCostStat(d);return d;
}
function getSaves(){try{return JSON.parse(localStorage.getItem("tarla360_npk_saves")||"[]")}catch(e){return []}}
function setSaves(a){try{localStorage.setItem("tarla360_npk_saves",JSON.stringify(a));window.ekinvyaCloud?.queueSave();return true}catch(e){toast("Tarayıcı kaydı başarısız. Depolama alanını kontrol et.");return false}}
function toast(msg){$("toast").textContent=msg;$("toast").classList.add("show");clearTimeout(toast.timer);toast.timer=setTimeout(()=>$("toast").classList.remove("show"),2800)}
function saveCalc(){const d=calc();if(!(d.area>0)){toast("Lütfen geçerli bir arazi alanı gir.");return}const saves=getSaves();saves.unshift({...d,id:Date.now()});if(setSaves(saves)){renderSaves();toast("NPK hesabı kaydedildi.");}}
function renderSaves(){
 const a=getSaves();$("statCalcs").textContent=a.length;
 const recent=a.slice(0,4);
 $("recentCalcs").innerHTML=recent.length?recent.map(r=>`<div class="quickitem"><div class="quickicon">◉</div><div><strong>${escapeHtml(r.plant)} · ${fmt(r.area)} da</strong><small>${new Date(r.createdAt).toLocaleDateString("tr-TR")} · N ${fmt(r.N)} / P₂O₅ ${fmt(r.P)} / K₂O ${fmt(r.K)} kg/da</small></div><span class="arrow">›</span></div>`).join(""):`<div class="quickitem"><div class="quickicon">◉</div><div><strong>Henüz kayıt yok</strong><small>İlk hesabını yapıp kaydedebilirsin.</small></div></div>`;
 $("allCalcs").innerHTML=a.length?a.map(r=>`<div class="quickitem"><div class="quickicon">🌱</div><div><strong>${escapeHtml(r.plant)} · ${fmt(r.area)} da</strong><small>${new Date(r.createdAt).toLocaleString("tr-TR")} · N ${fmt(r.N)} / P₂O₅ ${fmt(r.P)} / K₂O ${fmt(r.K)} kg/da</small></div><button class="secondary" onclick="deleteSave(${r.id})">Sil</button></div>`).join(""):`<div class="quickitem"><div><strong>Henüz kayıt yok</strong><small>Kaydettiğin hesaplar burada görünecek.</small></div></div>`;
}
function deleteSave(id){setSaves(getSaves().filter(x=>x.id!==id));renderSaves();toast("Kayıt silindi.");}
function escapeHtml(s){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
function exportCsv(){
 const d=calc();const lines=[["Ekinvya NPK Raporu"],["Bitki",d.plant],["Arazi (da)",d.area],[],["Gübre","Toplam kg","kg/da","N kg/da","P2O5 kg/da","K2O kg/da"],...d.rows.map(r=>[r.name,r.q,r.per,r.n,r.p,r.k]),["TOPLAM",d.total,"",d.N,d.P,d.K]];
 const csv="\uFEFF"+lines.map(row=>row.map(x=>`"${String(x??"").replace(/"/g,'""')}"`).join(";")).join("\r\n");
 const blob=new Blob([csv],{type:"text/csv;charset=utf-8;"}),url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download="ekinvya-npk-raporu.csv";a.click();URL.revokeObjectURL(url);toast("CSV raporu indirildi.");
}
function showView(view){
 if((document.body.classList.contains("auth-pending")||document.body.classList.contains("auth-locked"))&&view!=="profile")return;
 document.querySelectorAll(".view").forEach(v=>v.classList.toggle("active",v.id==="view-"+view));
 document.querySelectorAll("[data-view]").forEach(b=>b.classList.toggle("active",b.dataset.view===view));
 const labels={dashboard:"Ana Sayfa",weather:"Hava Durumu",ai:"AI Asistan",profile:"Profil",npk:"NPK Hesap Makinesi",fields:"Parsellerim",ndvi:"Sentinel‑2 NDVI",season:"Sezon Takibi",soil:"Toprak Analizleri",costs:"Maliyet Tablosu",farmers:"Çiftçi CRM",reports:"Raporlar"};
 $("crumbTitle").textContent=labels[view]||"Genel Bakış";window.scrollTo({top:0,behavior:"smooth"});if(view==="fields")window.ekinvyaFieldMap?.refreshSelect();if(view==="reports")renderSaves();if(view==="weather"&&window.ekinvyaWeatherPosition)updateWindyFrames(window.ekinvyaWeatherPosition);if(view==="costs"){renderCost();window.ekinvyaRenderFarmCosts?.()}if(view==="season"){curField=null;renderSeason()}
}
document.querySelectorAll("[data-view]").forEach(b=>b.addEventListener("click",()=>showView(b.dataset.view)));
 const weatherStatusHome=$("weatherStatusHome"),weatherStatusPage=$("weatherStatusPage");
 function setWeatherStatusHome(message){if(weatherStatusHome)weatherStatusHome.textContent=message}
 function setWeatherStatusPage(message){if(weatherStatusPage)weatherStatusPage.textContent=message}
 function weatherCodeInfo(code,isDay=true){const c=Number(code);if(c===0)return{label:"Açık",icon:isDay?"☀":"☾"};if(c===1)return{label:"Çoğunlukla açık",icon:"🌤"};if(c===2)return{label:"Parçalı bulutlu",icon:"⛅"};if(c===3)return{label:"Kapalı",icon:"☁"};if([45,48].includes(c))return{label:"Sisli",icon:"🌫"};if([51,53,55,56,57].includes(c))return{label:"Çisenti",icon:"🌦"};if([61,63,65,66,67,80,81,82].includes(c))return{label:"Yağmurlu",icon:"🌧"};if([71,73,75,77,85,86].includes(c))return{label:"Karlı",icon:"🌨"};if([95,96,99].includes(c))return{label:"Gök gürültülü",icon:"⛈"};return{label:"Değişken hava",icon:"🌤"}}
 function compassDirection(degrees){const dirs=["K","KD","D","GD","G","GB","B","KB"];return dirs[Math.round((Number(degrees)||0)/45)%8]}
 function renderHomeWeather(data,lat,lon){const c=data.current,d=data.daily,box=$("homeWeatherData"),info=weatherCodeInfo(c.weather_code,Boolean(c.is_day)),fmt=(v,digits=0)=>Number.isFinite(Number(v))?Number(v).toFixed(digits):"—";const now=new Date(c.time||Date.now());const updated=new Intl.DateTimeFormat("tr-TR",{hour:"2-digit",minute:"2-digit",timeZone:data.timezone||undefined}).format(now);const dateLabel=(value,offset)=>{const date=new Date(`${value}T12:00:00`);return offset===0?"Bugün":offset===1?"Yarın":new Intl.DateTimeFormat("tr-TR",{weekday:"short"}).format(date)};const weatherIcon=info.icon;box.innerHTML=`<div class="home-weather-current"><div class="home-weather-temp"><span class="home-weather-icon" aria-hidden="true">${weatherIcon}</span><div><strong>${fmt(c.temperature_2m)}°</strong><span class="home-weather-condition">${info.label} · ${fmt(c.wind_speed_10m)} km/sa rüzgâr</span></div></div><div class="home-weather-grid"><div class="home-weather-metric"><span>Hissedilen</span><strong>${fmt(c.apparent_temperature)}°C</strong></div><div class="home-weather-metric"><span>Nem</span><strong>%${fmt(c.relative_humidity_2m)}</strong></div><div class="home-weather-metric"><span>Rüzgâr yönü</span><strong>${compassDirection(c.wind_direction_10m)} · ${fmt(c.wind_speed_10m)} km/sa</strong></div><div class="home-weather-metric"><span>Anlık yağış</span><strong>${fmt(c.precipitation,1)} mm</strong></div></div></div><div class="home-weather-days" aria-label="5 günlük hava tahmini">${d.time.slice(0,5).map((day,i)=>{const dayInfo=weatherCodeInfo(d.weather_code[i]);return `<div class="home-weather-day"><strong>${dateLabel(day,i)} <span aria-hidden="true">${dayInfo.icon}</span></strong><span class="day-temps">${fmt(d.temperature_2m_min[i])}° <i style="color:#a9c0b0;font-style:normal;font-weight:400">—</i> ${fmt(d.temperature_2m_max[i])}°</span><span class="day-rain">☂ Yağış ihtimali %${fmt(d.precipitation_probability_max[i])}</span></div>`}).join("")}</div>`;setWeatherStatusHome(`Yakın konum · ${lat.toFixed(3)}, ${lon.toFixed(3)} · ${updated} itibarıyla güncellendi.`)}
 function renderDetailedWeather(data,lat,lon){const c=data.current,h=data.hourly,d=data.daily,report=$("weatherReport");const val=(v,n=0)=>v===null||v===undefined||v===""?"—":Number.isFinite(Number(v))?Number(v).toFixed(n):"—";const info=weatherCodeInfo(c.weather_code,Boolean(c.is_day));const visibility=Number(c.visibility);const metrics=[["Hissedilen sıcaklık",`${val(c.apparent_temperature)} °C`],["Çiy noktası",`${val(c.dew_point_2m)} °C`],["Bağıl nem",`%${val(c.relative_humidity_2m)}`],["Deniz seviyesi basıncı",`${val(c.pressure_msl)} hPa`],["Yüzey basıncı",`${val(c.surface_pressure)} hPa`],["Bulutluluk",`%${val(c.cloud_cover)}`],["Görüş mesafesi",Number.isFinite(visibility)?`${(visibility/1000).toFixed(1)} km`:"—"],["Rüzgâr / hamle",`${val(c.wind_speed_10m)} / ${val(c.wind_gusts_10m)} km/sa`],["Rüzgâr yönü",`${compassDirection(c.wind_direction_10m)} · ${val(c.wind_direction_10m)}°`],["UV indeksi",val(c.uv_index,1)],["Yağış / yağmur",`${val(c.precipitation,1)} / ${val(c.rain,1)} mm`],["Gün doğumu / batımı",`${(d.sunrise?.[0]||"").split("T")[1]||"—"} / ${(d.sunset?.[0]||"").split("T")[1]||"—"}`]];const metricHtml=metrics.map(([label,value])=>`<div class="weather-report-metric"><span>${label}</span><strong>${value}</strong></div>`).join("");const start=Math.max(0,h.time.findIndex(t=>t>=c.time));const hourlyHtml=h.time.slice(start,start+24).map((time,i)=>{const ix=start+i,wi=weatherCodeInfo(h.weather_code[ix]);const hour=new Intl.DateTimeFormat("tr-TR",{hour:"2-digit",timeZone:data.timezone||undefined}).format(new Date(time));return `<div class="weather-hour"><time datetime="${time}">${hour}</time><span class="hour-icon" aria-hidden="true">${wi.icon}</span><strong>${val(h.temperature_2m[ix])}°C</strong><small>${wi.label}<br>Yağış %${val(h.precipitation_probability[ix])}<br>Rüzgâr ${val(h.wind_speed_10m[ix])} km/sa · Hamle ${val(h.wind_gusts_10m[ix])}</small></div>`}).join("");const weekHtml=d.time.map((day,i)=>{const date=new Date(`${day}T12:00:00`),label=i===0?"Bugün":new Intl.DateTimeFormat("tr-TR",{weekday:"long"}).format(date),wi=weatherCodeInfo(d.weather_code[i]);return `<div class="weather-week-row"><strong>${label}</strong><span class="week-icon" aria-hidden="true">${wi.icon}</span><span class="week-temps">${val(d.temperature_2m_min[i])}° / ${val(d.temperature_2m_max[i])}°</span><small>Yağış %${val(d.precipitation_probability_max[i])}<br>${val(d.precipitation_sum[i],1)} mm</small><small class="week-extra">Rüzgâr ${val(d.wind_speed_10m_max[i])} km/sa · Hamle ${val(d.wind_gusts_10m_max[i])}<br>UV ${val(d.uv_index_max[i],1)}</small></div>`}).join("");report.innerHTML=`<div class="resultband weather-current-band"><div class="resulttitle"><strong>${info.icon} ${info.label} · ${val(c.temperature_2m)}°C</strong><span>${lat.toFixed(4)}, ${lon.toFixed(4)}</span></div><div class="resultfoot"><span>Rapor saati: ${c.time.replace("T"," ")} · Model alanı: ${data.latitude?.toFixed(2)}, ${data.longitude?.toFixed(2)}</span></div></div><div class="weather-report-subhead"><h3>Anlık ölçümler</h3><span>Konuma en yakın tahmin grid hücresi</span></div><div class="weather-report-grid">${metricHtml}</div><div class="weather-report-subhead"><h3>Önümüzdeki 24 saat</h3><span>Saatlik tahmin</span></div><div class="weather-hourly" aria-label="Önümüzdeki 24 saatin saatlik hava tahmini">${hourlyHtml||"Saatlik tahmin verisi bulunamadı."}</div><div class="weather-report-subhead"><h3>7 günlük görünüm</h3><span>Günlük tahmin ve toplam yağış</span></div><div class="weather-week" aria-label="Yedi günlük hava tahmini">${weekHtml}</div>`;$("weatherReportStatus").textContent=`Rapor konum için hazır · ${lat.toFixed(4)}, ${lon.toFixed(4)} · Open-Meteo model verisi.`}
 async function loadHomeWeather(pos){const lat=Number(pos.coords.latitude.toFixed(4)),lon=Number(pos.coords.longitude.toFixed(4));setWeatherStatusHome("Open-Meteo’dan güncel hava ve tahmin alınıyor…");$("weatherReportStatus").textContent="Konuma göre saatlik ve günlük tahminler alınıyor…";const params=new URLSearchParams({latitude:String(lat),longitude:String(lon),current:"temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,rain,weather_code,wind_speed_10m,wind_direction_10m,wind_gusts_10m,dew_point_2m,pressure_msl,surface_pressure,cloud_cover,visibility,uv_index",hourly:"temperature_2m,relative_humidity_2m,apparent_temperature,precipitation_probability,precipitation,weather_code,wind_speed_10m,wind_gusts_10m",daily:"weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum,wind_speed_10m_max,wind_gusts_10m_max,sunrise,sunset,uv_index_max",timezone:"auto",forecast_days:"7",forecast_hours:"24",temperature_unit:"celsius",wind_speed_unit:"kmh",precipitation_unit:"mm"});try{const response=await fetch(`https://api.open-meteo.com/v1/forecast?${params}`);if(!response.ok)throw new Error(`HTTP ${response.status}`);const data=await response.json();if(!data.current||!data.hourly||!data.daily)throw new Error("Eksik tahmin verisi");renderHomeWeather(data,lat,lon);renderDetailedWeather(data,lat,lon)}catch(error){setWeatherStatusHome("Hava verisi alınamadı. İnternet bağlantısını kontrol edip yeniden dene.");$("weatherReportStatus").textContent="Konum hava raporu alınamadı; bağlantını kontrol edip konumu yeniden iste.";console.error("Open-Meteo hava verisi alınamadı:",error)}} function updateWindyFrames(pos){
  const lat=Number(pos.coords.latitude.toFixed(3)),lon=Number(pos.coords.longitude.toFixed(3));window.ekinvyaWeatherPosition=pos;
  const windyUrl=new URL("https://embed.windy.com/embed2.html");const windyParams={lat,lon,detailLat:lat,detailLon:lon,width:900,height:620,zoom:8,level:"surface",overlay:"wind",product:"ecmwf",menu:"true",message:"true",marker:"true",forecast:12,calendar:"now",pressure:"true",type:"map",location:"coordinates",detail:"true",metricWind:"km/h",metricTemp:"°C",radarRange:-1};Object.entries(windyParams).forEach(([key,value])=>windyUrl.searchParams.set(key,String(value)));const mapUrl=windyUrl.toString();
  const frame=$("weatherMapPage"),empty=$("weatherEmptyPage");if(frame)frame.src=mapUrl;if(empty)empty.hidden=true;
  const coords=$("weatherCoords");if(coords)coords.textContent=`Harita merkezi · ${lat.toFixed(4)}, ${lon.toFixed(4)}`;const fullLink=$("openWindyFull");if(fullLink)fullLink.href=`https://www.windy.com/${lat}/${lon}?${lat},${lon},8`;
  setWeatherStatusPage(`Windy haritası konumunda · ${lat.toFixed(3)}, ${lon.toFixed(3)}`);loadHomeWeather(pos);
 }
 function requestWeatherLocation(){
  if(!navigator.geolocation){setWeatherStatusHome("Bu tarayıcı konum bilgisini desteklemiyor.");setWeatherStatusPage("Bu tarayıcı konum bilgisini desteklemiyor.");return}
  setWeatherStatusHome("Konum bekleniyor… Tarayıcı izin penceresini onayla.");setWeatherStatusPage("Konum bekleniyor… Tarayıcı izin penceresini onayla.");
  navigator.geolocation.getCurrentPosition(updateWindyFrames,error=>{const messages={1:"Konum izni verilmedi. Tarayıcı ayarlarından izin verip yeniden deneyebilirsin.",2:"Konum şu anda alınamadı. GPS veya ağ bağlantısını kontrol edip yeniden dene.",3:"Konum isteği zaman aşımına uğradı. Yeniden deneyebilirsin."};setWeatherStatusHome(messages[error.code]||"Konum alınamadı; yeniden deneyebilirsin.");setWeatherStatusPage(messages[error.code]||"Konum alınamadı; yeniden deneyebilirsin.")},{enableHighAccuracy:false,timeout:12000,maximumAge:300000});
 }
 document.querySelectorAll(".weather-locate").forEach(button=>button.addEventListener("click",requestWeatherLocation));
$("addFert").addEventListener("click",()=>addFert(0,0));
$("area").addEventListener("input",calc);$("plant").addEventListener("input",calc);
$("saveCalc").addEventListener("click",saveCalc);$("exportCsv").addEventListener("click",exportCsv);

const FIELD_KEY="tarla360_fields_v1";
function getFields(){try{return JSON.parse(localStorage.getItem(FIELD_KEY)||"[]")}catch(e){return []}}
window.ekinvyaGetFields=getFields;
function setFields(a){try{localStorage.setItem(FIELD_KEY,JSON.stringify(a));window.ekinvyaCloud?.queueSave();return true}catch(e){toast("Tarla kaydı yapılamadı. Tarayıcı depolamasını kontrol et.");return false}}
function fieldPreview(geometry){
 const polygons=geometry?.type==="Polygon"?[geometry.coordinates]:geometry?.type==="MultiPolygon"?geometry.coordinates:[];
 const points=polygons.flatMap(p=>Array.isArray(p?.[0])?p[0]:[]).filter(point=>Array.isArray(point)&&Number.isFinite(Number(point[0]))&&Number.isFinite(Number(point[1])));
 if(points.length<3)return '<div class="field-map-empty"><span aria-hidden="true">⌖</span><small>Sınır çizilmedi</small></div>';
 const xs=points.map(point=>Number(point[0])),ys=points.map(point=>Number(point[1])),minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys),dx=maxX-minX||1,dy=maxY-minY||1;
 const paths=polygons.map(p=>{const ring=p?.[0];if(!Array.isArray(ring)||ring.length<3)return "";return ring.map((point,index)=>`${index?"L":"M"}${12+(Number(point[0])-minX)/dx*176} ${88-(Number(point[1])-minY)/dy*68}`).join(" ")+" Z"}).filter(Boolean).join(" ");
 return `<svg class="field-map-preview" viewBox="0 0 200 100" role="img" aria-label="Kayıtlı parsel sınırı"><path d="${paths}" fill="#87b96866" stroke="#d9efaa" stroke-width="2" vector-effect="non-scaling-stroke"/></svg>`;
}
function renderFields(){
 const fields=getFields();
 $("statFields").textContent=fields.length;
 $("statArea").innerHTML=`${fmt(fields.reduce((s,f)=>s+num(f.area),0))} <small>da</small>`;
 $("fieldCountTag").textContent=fields.length;
 $("fieldCountStatus").textContent=`${fields.filter(field=>Boolean(field.crop)).length} ürünlü · ${fields.filter(field=>!field.crop).length} plan bekliyor`;
 $("sidebarParcelBadge").textContent=fields.length;
 $("fieldAreaTotal").textContent=`${fmt(fields.reduce((sum,field)=>sum+num(field.area),0))} da`;
 $("fieldHectareTotal").textContent=`${fmt(fields.reduce((sum,field)=>sum+num(field.area),0)/10,1)} ha toplam`;
 $("fieldBoundaryCount").textContent=`${fields.filter(field=>field.geometry).length} / ${fields.length}`;
 const query=$("fieldSearchInput").value.trim().toLocaleLowerCase("tr-TR"),crop=$("fieldCropFilter").value,season=$("fieldSeasonFilter").value;
 const seasonValues=[...new Set(fields.map(field=>field.season).filter(Boolean))].sort((a,b)=>String(b).localeCompare(String(a),"tr-TR")),seasonFilter=$("fieldSeasonFilter"),oldSeason=seasonFilter.value;
 seasonFilter.innerHTML='<option value="ALL">Tüm sezonlar</option>'+seasonValues.map(value=>`<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`).join("");seasonFilter.value=seasonValues.includes(oldSeason)?oldSeason:"ALL";
 const focusSeason=seasonValues.includes(season)?season:seasonValues[0];$("fieldSeasonChip").textContent=focusSeason?`${focusSeason} · ${fields.filter(field=>field.season===focusSeason).length} parsel`:`${fields.length} kayıtlı parsel`;
 const visible=fields.filter(field=>{
   const matchesCrop=crop==="ALL"||field.crop===crop;
   const matchesSeason=seasonFilter.value==="ALL"||field.season===seasonFilter.value;
   const searchable=[field.name,field.location,field.crop,field.ada,field.parsel,field.season].filter(Boolean).join(" ").toLocaleLowerCase("tr-TR");
   return matchesCrop&&matchesSeason&&(!query||searchable.includes(query));
 });
 const card=field=>{
   const latest=field.ndviHistory?.[0],observations=latest?.observations||[],ndvi=observations.length?Number(observations[observations.length-1].mean):null;
   const cropIcon={"Buğday":"🌾","Arpa":"🌿","Kanola":"🌼","Ayçiçeği":"🌻","Mısır":"🌽"}[field.crop]||"🌱";
   const fieldId=escapeHtml(field.id),location=field.location?escapeHtml(field.location):"Konum eklenmedi",parcelRef=field.ada||field.parsel?`Ada ${escapeHtml(field.ada||"—")} · Parsel ${escapeHtml(field.parsel||"—")}`:"Ada / parsel bilgisi yok";
   return `<article class="field-card"><div class="field-card-body"><div class="field-card-head"><button class="field-card-map" type="button" data-field-action="focus" data-field-id="${fieldId}" aria-label="${escapeHtml(field.name)} sınırını haritada göster">${fieldPreview(field.geometry)}</button><div class="field-card-titlewrap"><button class="field-card-title" type="button" data-field-action="detail" data-field-id="${fieldId}">${escapeHtml(field.name)}</button><small>${location}</small><div class="field-card-badges"><span class="field-state-pill ${field.crop?"is-active":"is-pending"}">${field.crop?"Ürün kayıtlı":"Ürün seçilmedi"}</span><span class="field-state-pill ${field.geometry?"is-ready":"is-pending"}">${field.geometry?"Sınır kayıtlı":"Sınır bekliyor"}</span></div></div><span class="field-card-chevron" aria-hidden="true">›</span></div><div class="field-card-facts"><div><span>ÜRETİM ALANI</span><strong>${fmt(field.area)} da</strong><small>${fmt(num(field.area)/10,2)} ha</small></div><div><span>EKİLİ ÜRÜN</span><strong>${cropIcon} ${escapeHtml(field.crop||"Ürün seçilmedi")}</strong><small>${ndvi!==null&&Number.isFinite(ndvi)?`Gerçek son NDVI: ${ndvi.toFixed(3)}`:"NDVI analizi yapılmadı"}</small></div></div><div class="field-card-meta"><span>⌖ ${location}</span><span>${parcelRef}</span><span>${field.season?`Sezon: ${escapeHtml(field.season)}`:"Sezon belirtilmedi"}</span></div>${field.notes?`<p class="field-card-note">${escapeHtml(field.notes)}</p>`:""}<div class="field-card-actions">${field.geometry?`<button class="secondary" type="button" data-field-action="ndvi" data-field-id="${fieldId}">NDVI analizi</button>`:`<button class="secondary" type="button" data-field-action="draw" data-field-id="${fieldId}">Sınır ekle</button>`}<button class="secondary" type="button" data-field-action="detail" data-field-id="${fieldId}">Parsel detayları</button><button class="secondary" type="button" data-field-action="cost" data-field-id="${fieldId}">Gider ekle</button><button class="secondary" type="button" data-field-action="npk" data-field-id="${fieldId}">NPK</button><button class="field-delete" type="button" data-field-action="delete" data-field-id="${fieldId}" aria-label="${escapeHtml(field.name)} tarlasını sil">Sil</button></div></div></article>`;
 };
 $("dashboardFields").innerHTML=fields.length?fields.slice(0,4).map(field=>`<div class="quickitem"><div class="quickicon" aria-hidden="true">${{"Buğday":"🌾","Arpa":"🌿","Kanola":"🌼","Ayçiçeği":"🌻","Mısır":"🌽"}[field.crop]||"🌱"}</div><div class="field-summary"><button class="field-focus" type="button" data-dashboard-field="${escapeHtml(field.id)}">${escapeHtml(field.name)} · ${fmt(field.area)} da</button><small>${[field.crop,field.location].filter(Boolean).map(escapeHtml).join(" · ")||"Ürün ve konum bilgisi eklenmemiş"}${field.geometry?" · Sınır kayıtlı":""}</small></div></div>`).join(""):`<div class="quickitem"><div class="quickicon">▧</div><div><strong>Henüz tarla eklenmedi</strong><small>“Tarla ekle” ile ilk parselini kaydet.</small></div></div>`;
 $("fieldsList").innerHTML=visible.length?visible.map(card).join(""):fields.length?`<div class="field-empty"><strong>Aramana uygun parsel yok</strong><span>Arama metnini veya ürün filtresini değiştirebilirsin.</span></div>`:`<div class="field-empty"><span class="field-empty-icon" aria-hidden="true">▧</span><strong>Henüz parsel eklenmemiş</strong><span>İlk tarlanı kaydettiğinde uydu sınırlarını ve analizlerini burada takip edebilirsin.</span><button class="primary" type="button" onclick="openFieldDialog()">＋ İlk parselini ekle</button></div>`;
}
$("fieldSearchInput").addEventListener("input",renderFields);
$("fieldCropFilter").addEventListener("change",renderFields);
$("fieldSeasonFilter").addEventListener("change",renderFields);
let fieldDialogOpener=null;
function openFieldDialog(fieldId="new"){
 const dialog=$("fieldDialog"),selector=$("boundaryFieldSelect"),form=$("fieldForm"),isNew=String(fieldId)==="new";
 fieldDialogOpener=document.activeElement;
 dialog.hidden=false;document.body.classList.add("field-dialog-open");
 if(isNew){form.reset();window.ekinvyaFieldMap?.clearDraft();$("fieldDialogTitle").textContent="Yeni parsel ekle"}
 window.ekinvyaFieldMap?.init();window.ekinvyaFieldMap?.refreshSelect();
 if(selector)selector.value=isNew?"new":String(fieldId);
 window.ekinvyaFieldMap?.selectField(isNew?"new":String(fieldId));
 $("fieldFormPanel").hidden=!isNew;
 if(!isNew){const field=getFields().find(row=>String(row.id)===String(fieldId));$("fieldDialogTitle").textContent=field?`${field.name} · sınır düzenleme`:"Parsel sınırını düzenle";$("boundaryStatus").textContent=field?.geometry?`${field.name} sınırı açık. Düzenlemeler bulut kaydına aktarılır.`:`${field?.name||"Parsel"} için sınırı haritada çiz.`}
 window.setTimeout(()=>{window.ekinvyaFieldMap?.resize();(isNew?$("fieldName"):$("closeFieldDialog")).focus()},90);
}
window.openFieldDialog=openFieldDialog;
function closeFieldDialog(){
 window.ekinvyaFieldMap?.stopCapture?.();
 $("fieldDialog").hidden=true;document.body.classList.remove("field-dialog-open");
 if(fieldDialogOpener?.isConnected)fieldDialogOpener.focus();fieldDialogOpener=null;
}
$("openFieldDialog").addEventListener("click",()=>openFieldDialog());
$("closeFieldDialog").addEventListener("click",closeFieldDialog);
$("fieldDialog").addEventListener("click",event=>{if(event.target===$("fieldDialog"))closeFieldDialog()});
$("fieldDialog").querySelector(".field-dialog").addEventListener("keydown",event=>{
 if(event.key==="Escape"){event.preventDefault();closeFieldDialog();return}
 if(event.key!=="Tab")return;
 const items=[...$("fieldDialog").querySelectorAll('button:not([disabled]),input:not([disabled]),select:not([disabled])')].filter(item=>!item.closest("[hidden]"));
 if(!items.length)return;const first=items[0],last=items.at(-1);
 if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus()}
 else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus()}
});
$("boundaryFieldSelect").addEventListener("change",()=>{
 const isNew=$("boundaryFieldSelect").value==="new";$("fieldFormPanel").hidden=!isNew;
 const field=getFields().find(row=>String(row.id)===$("boundaryFieldSelect").value);
 $("fieldDialogTitle").textContent=isNew?"Yeni parsel ekle":`${field?.name||"Parsel"} · sınır düzenleme`;
});
$("fieldForm").addEventListener("reset",()=>window.setTimeout(()=>window.ekinvyaFieldMap?.clearDraft(),0));
$("fieldsList").addEventListener("click",event=>{
 const button=event.target.closest("[data-field-action]");if(!button)return;
 const id=button.dataset.fieldId,action=button.dataset.fieldAction;
 if(action==="focus")focusField(id);else if(action==="detail"){openField(Number(id));showView("season")}else if(action==="draw")drawFieldBoundary(id);else if(action==="ndvi")showNdvi(id);else if(action==="npk")useFieldForNpk(id);else if(action==="cost")window.ekinvyaOpenFarmCostDialog?.(id);else if(action==="delete")deleteField(id);
});
$("dashboardFields").addEventListener("click",event=>{const button=event.target.closest("[data-dashboard-field]");if(button)focusField(button.dataset.dashboardField)});
$("fieldForm").addEventListener("submit",async e=>{
 e.preventDefault();
 const name=$("fieldName").value.trim(),area=num($("fieldArea").value);
 if(!name||area<=0){toast("Tarla adı ve geçerli alan zorunludur.");return}
 const boundary=window.ekinvyaFieldMap?.getDraftGeometry()||null;const previous=getFields();const a=previous.slice();a.unshift({id:Date.now(),name,area,ada:$("fieldAda").value.trim(),parsel:$("fieldParsel").value.trim(),crop:$("fieldCrop").value,location:$("fieldLocation").value.trim(),season:$("fieldSeason").value,notes:$("fieldNotes").value.trim(),geometry:boundary,ndviHistory:[],createdAt:new Date().toISOString()});
 const button=$("saveFieldButton");button.disabled=true;button.textContent="Kaydediliyor…";
 try {
   const cloud=window.ekinvyaCloud,client=window.ekinvyaSupabaseClient;
   if(!cloud||!client)throw new Error("Bulut kayıt bağlantısı bulunamadı. Sayfayı yenileyip yeniden giriş yap.");
   const {data:{user},error}=await client.auth.getUser();
   if(error||!user)throw new Error("Tarla kaydetmek için oturumunu yenile.");
   if(!cloud.isReadyFor(user.id))throw new Error("Hesap verileri bulutla eşitleniyor. Birkaç saniye sonra tekrar dene.");
   if(!setFields(a))throw new Error("Tarla yerel kayda yazılamadı.");
   renderFields();renderSeason();
   await cloud.flush();
   $("fieldForm").reset();window.ekinvyaFieldMap?.clearDraft();window.ekinvyaFieldMap?.refreshSelect();renderFields();renderSeason();closeFieldDialog();toast(boundary?"Tarla ve GeoJSON sınırı Supabase hesabına kaydedildi.":"Tarla Supabase hesabına kaydedildi.");
 } catch(error) {
   setFields(previous);renderFields();toast(error.message||"Tarla buluta kaydedilemedi. Yeniden deneyin.");
 } finally { button.disabled=false;button.textContent="＋ Tarlayı kaydet"; }
});
function focusField(id){showView("fields");openFieldDialog(String(id))}
window.focusField=focusField;
function drawFieldBoundary(id){showView("fields");openFieldDialog(String(id));$("boundaryStatus").textContent="Seçili tarlanın sınırını çiz veya düzenle; değişiklik otomatik kaydedilir."}
function setFieldGeometry(id,geometry,area){const rows=getFields(),field=rows.find(item=>String(item.id)===String(id));if(!field)return;field.geometry=geometry;if(geometry&&Number.isFinite(area)&&area>0)field.area=Number(area.toFixed(2));if(setFields(rows)){renderFields();renderSeason();toast("Tarla sınırı ve alanı bulut kaydına eklendi.")}}
window.ekinvyaSetFieldGeometry=setFieldGeometry;
function showNdvi(id){const field=getFields().find(item=>String(item.id)===String(id));if(!field?.geometry){toast("Önce tarlanın sınırını haritada çiz.");return}window.ekinvyaNdviFieldId=field.id;$("ndviFieldTitle").textContent=`${field.name} · ${fmt(field.area)} da · Sentinel‑2 L2A`;const localDate=d=>new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,10),now=new Date(),to=localDate(now),fromDate=new Date(now);fromDate.setDate(fromDate.getDate()-90);const from=localDate(fromDate);$("ndviFrom").value=from;$("ndviTo").value=to;$("ndviResults").innerHTML="";$("ndviStatus").textContent=field.ndviHistory?.length?`Son analiz: ${new Date(field.ndviHistory[0].queriedAt).toLocaleString("tr-TR")}. Yeni tarih aralığı için analiz başlat.`:"Uydu analizi için bir tarih aralığı seçip başlat.";showView("ndvi")}
$("ndviForm").addEventListener("submit",async event=>{event.preventDefault();const field=getFields().find(item=>String(item.id)===String(window.ekinvyaNdviFieldId));if(!field?.geometry){toast("Analiz için tarla sınırı bulunamadı.");return}const from=$("ndviFrom").value,to=$("ndviTo").value,button=$("ndviRun"),status=$("ndviStatus");if(!from||!to||from>to){status.textContent="Tarih aralığını kontrol et.";return}button.disabled=true;status.textContent="Copernicus Sentinel‑2 verisi aranıyor. Bu işlem biraz sürebilir…";$("ndviResults").innerHTML="";try{const client=window.ekinvyaSupabaseClient;if(!client)throw new Error("Supabase oturumu bulunamadı. Yeniden giriş yap.");const {data:{session}}=await client.auth.getSession();if(!session?.access_token)throw new Error("Oturum süresi dolmuş. Yeniden giriş yap.");const response=await fetch("/api/ndvi",{method:"POST",headers:{"Content-Type":"application/json","Authorization":`Bearer ${session.access_token}`},body:JSON.stringify({geometry:field.geometry,from,to})});const result=await response.json().catch(()=>({}));if(!response.ok)throw new Error(result.error||"Sentinel‑2 verisi alınamadı.");const observations=Array.isArray(result.observations)?result.observations:[];if(!observations.length){status.textContent="Bu tarih aralığında bulutsuz geçerli Sentinel‑2 ölçümü bulunamadı. Tarih aralığını genişletip yeniden dene.";return}const current=getFields(),target=current.find(item=>String(item.id)===String(field.id));if(target){target.ndviHistory=[{queriedAt:new Date().toISOString(),from,to,source:"Sentinel-2 L2A",observations},...(target.ndviHistory||[])].slice(0,20);setFields(current);renderFields()}const latest=observations[observations.length-1];status.textContent=`${observations.length} geçerli 10 günlük gözlem bulundu · En son dönem ortalaması NDVI ${latest.mean.toFixed(3)}.`;$("ndviResults").innerHTML=`<div class="ndvi-summary"><div><span>Son gözlem ortalaması</span><strong>${latest.mean.toFixed(3)}</strong></div><div><span>Dönem minimumu</span><strong>${latest.min.toFixed(3)}</strong></div><div><span>Dönem maksimumu</span><strong>${latest.max.toFixed(3)}</strong></div><div><span>Geçerli piksel</span><strong>${latest.sampleCount.toLocaleString("tr-TR")}</strong></div></div><div class="ndvi-table-wrap"><table class="ndvi-table"><thead><tr><th>Gözlem dönemi</th><th>Ortalama NDVI</th><th>Min / Maks</th><th>Geçerli piksel</th><th>Bulut dışı veri</th></tr></thead><tbody>${observations.slice().reverse().map(item=>`<tr><td>${new Date(item.from).toLocaleDateString("tr-TR")} – ${new Date(item.to).toLocaleDateString("tr-TR")}</td><td><strong>${item.mean.toFixed(3)}</strong><div class="ndvi-bar"><i style="width:${Math.max(2,Math.min(100,(item.mean+1)*50))}%"></i></div></td><td>${item.min.toFixed(3)} / ${item.max.toFixed(3)}</td><td>${item.sampleCount.toLocaleString("tr-TR")}</td><td>${item.noDataCount.toLocaleString("tr-TR")}</td></tr>`).join("")}</tbody></table></div>`}catch(error){status.textContent=error.message;console.error("Sentinel‑2 NDVI analizi başarısız:",error)}finally{button.disabled=false}});
function deleteField(id){if(deleteField.p!==id){deleteField.p=id;toast("Silmek için Sil düğmesine tekrar bas.");return}deleteField.p=null;setFields(getFields().filter(f=>f.id!==id));setCosts(getCosts().filter(c=>c.fieldId!==id));renderFields();renderSeason();toast("Tarla kaydı silindi.");}
function useFieldForNpk(id){const f=getFields().find(x=>x.id===id);if(!f)return;$("plant").value=f.crop||"";$("area").value=f.area;calc();showView("npk");toast(`${f.name} için NPK hesabı hazırlandı.`);}

const PRICE_KEY="tarla360_prices_v1",SCEN_KEY="tarla360_scen_v1";
function getPrices(){try{return JSON.parse(localStorage.getItem(PRICE_KEY)||"{}")}catch(e){return{}}}
function setPrices(o){try{localStorage.setItem(PRICE_KEY,JSON.stringify(o));window.ekinvyaCloud?.queueSave();return true}catch(e){toast("Fiyat kaydedilemedi.");return false}}
function getScen(){try{return JSON.parse(localStorage.getItem(SCEN_KEY)||"[]")}catch(e){return[]}}
function setScen(a){try{localStorage.setItem(SCEN_KEY,JSON.stringify(a));window.ekinvyaCloud?.queueSave();return true}catch(e){toast("Senaryo kaydedilemedi.");return false}}
function unitKg(p){if(!p||!(p.v>0))return null;return p.u==="ton"?p.v/1000:p.u==="bag"?p.v/50:p.v}
function costOf(d){const pr=getPrices();let tot=0;const miss=[];d.rows.forEach(r=>{if(!(r.q>0))return;const k=unitKg(pr[r.name]);if(k==null){if(!miss.includes(r.name))miss.push(r.name)}else tot+=k*r.q});const ok=!miss.length&&d.area>0,per=ok?tot/d.area:null,nut=d.N+d.P+d.K;return{tot:ok?tot:null,per,perNut:ok&&nut>0?per/nut:null,miss}}
function updCostStat(d){}
function renderPrices(){const pr=getPrices();$("priceBody").innerHTML=PRESETS.map((x,i)=>{const p=pr[x.name]||{v:"",u:"kg"},k=unitKg(p);return `<tr data-i="${i}"><td>${x.name}</td><td><input class="pv" inputmode="decimal" style="width:90px;text-align:right;padding:7px;border:1px solid #dfe7de;border-radius:8px" value="${p.v||""}"></td><td><select class="pu" style="padding:7px;border:1px solid #dfe7de;border-radius:8px"><option value="kg">₺/kg</option><option value="bag"${p.u==="bag"?" selected":""}>₺/çuval (50 kg)</option><option value="ton"${p.u==="ton"?" selected":""}>₺/ton</option></select></td><td class="pk">${k==null?"—":fmt(k)}</td></tr>`}).join("")}
function renderCost(){if(!$("priceBody").children.length)renderPrices();renderCostResults()}
function renderCostResults(){
 const d=calc(),c=costOf(d);
 $("cTotal").textContent=c.tot==null?"—":`${fmt(c.tot)} ₺`;$("cPer").textContent=c.per==null?"—":fmt(c.per);$("cNut").textContent=c.perNut==null?"—":fmt(c.perNut);
 $("cInfo").textContent=`${d.plant} · ${fmt(d.area)} da · N ${fmt(d.N)} / P₂O₅ ${fmt(d.P)} / K₂O ${fmt(d.K)} kg/da`+(c.miss.length?` · Fiyatı girilmemiş: ${c.miss.join(", ")}`:"");
 const sc=getScen().map(s=>({s,c:costOf(s)})),vals=sc.map(x=>x.c.per).filter(v=>v!=null),min=vals.length?Math.min(...vals):null;
 $("scenBody").innerHTML=sc.length?sc.map(({s,c})=>`<tr><td>${escapeHtml(s.name)}<br><small style="color:var(--muted)">${escapeHtml(s.plant)} · ${fmt(s.area)} da${c.miss.length?" · fiyat eksik":""}</small></td><td>${fmt(s.N)}/${fmt(s.P)}/${fmt(s.K)}</td><td>${fmt(s.area>0?s.total/s.area:0)}</td><td>${c.per==null?"—":fmt(c.per)}</td><td>${c.tot==null?"—":fmt(c.tot)}</td><td>${c.perNut==null?"—":fmt(c.perNut)}</td><td>${c.per==null||min==null?"—":(c.per===min?`<span class="pill">En ucuz</span>`:`+${fmt(c.per-min)}`)}</td><td><button class="secondary" onclick="delScen(${s.id})">Sil</button></td></tr>`).join(""):`<tr><td colspan="8" class="emptyhint">Henüz senaryo yok. NPK hesabını yapıp “Senaryo olarak kaydet” ile ekle.</td></tr>`;
}
function delScen(id){setScen(getScen().filter(s=>s.id!==id));renderCostResults()}
$("priceBody").addEventListener("input",e=>{const tr=e.target.closest("tr");if(!tr)return;const name=PRESETS[+tr.dataset.i].name,pr=getPrices();pr[name]={v:num(tr.querySelector(".pv").value),u:tr.querySelector(".pu").value};setPrices(pr);const k=unitKg(pr[name]);tr.querySelector(".pk").textContent=k==null?"—":fmt(k);renderCostResults()});
$("saveScen").addEventListener("click",()=>{const d=calc();if(!(d.area>0)||!d.rows.length){toast("Önce NPK hesabını yap.");return}const a=getScen();a.push({id:Date.now(),name:$("scenName").value.trim()||`Senaryo ${a.length+1}`,plant:d.plant,area:d.area,rows:d.rows,N:d.N,P:d.P,K:d.K,total:d.total});if(setScen(a)){$("scenName").value="";renderCostResults();toast("Senaryo kaydedildi.")}});
const COST_KEY="tarla360_costs_v1",CATS=["Taban gübresi","Üst gübre","Yaprak gübresi","İlaç (genel)","Herbisit","Fungisit","İnsektisit","Tohum","Mazot / Yakıt","İşçilik","Sulama","Kira","Makine / Hizmet","Nakliye","Diğer"];
function getCosts(){try{return JSON.parse(localStorage.getItem(COST_KEY)||"[]")}catch(e){return[]}}
function setCosts(a){try{localStorage.setItem(COST_KEY,JSON.stringify(a));window.ekinvyaCloud?.queueSave();return true}catch(e){toast("Maliyet kaydedilemedi. Tarayıcı depolamasını kontrol et.");return false}}
let curField=null,selYear=new Date().getFullYear();
const yearOf=d=>parseInt(String(d).slice(0,4))||0;
const money=v=>`${fmt(v)} ₺`;
const todayStr=()=>new Date(Date.now()-new Date().getTimezoneOffset()*6e4).toISOString().slice(0,10);
const fieldLabel=f=>[(f.ada||f.parsel)?`Ada ${f.ada||"-"} / Parsel ${f.parsel||"-"}`:"",f.crop].filter(Boolean).map(escapeHtml).join(" · ");
function openField(id){curField=id;selYear=new Date().getFullYear();renderSeason();window.scrollTo({top:0})}
$("selectedFieldOverview").addEventListener("click",event=>{const button=event.target.closest("[data-selected-field-action]");if(!button||!curField)return;const action=button.dataset.selectedFieldAction;if(action==="boundary")drawFieldBoundary(curField);else if(action==="ndvi")showNdvi(curField);else if(action==="cost")window.ekinvyaOpenFarmCostDialog?.(curField);else if(action==="costs")showView("costs")});
function closeField(){curField=null;renderSeason()}
function pickYear(y){selYear=y;$("siYear").value=String(y);renderSeason()}
function delCost(id){setCosts(getCosts().filter(c=>c.id!==id));renderSeason()}
function renderSeason(){
 const fields=getFields(),costs=getCosts(),now=new Date().getFullYear();
 $("statCost").textContent=money(costs.filter(c=>yearOf(c.date)===now).reduce((s,c)=>s+c.amount,0));
 if(curField&&!fields.some(f=>f.id===curField))curField=null;
 $("seasonList").hidden=!!curField;$("seasonDetail").hidden=!curField;
 if(!curField){
  $("seasonFields").innerHTML=fields.length?fields.map(f=>{const t=costs.filter(c=>c.fieldId===f.id&&yearOf(c.date)===now).reduce((s,c)=>s+c.amount,0);return `<div class="quickitem" style="cursor:pointer" onclick="openField(${f.id})"><div class="quickicon">🌾</div><div><strong>${escapeHtml(f.name)} · ${fmt(f.area)} da</strong><small>${fieldLabel(f)||"Ada / parsel girilmedi"} · ${now} maliyeti: ${money(t)}</small></div><span class="arrow">›</span></div>`}).join(""):`<div class="emptyhint">Henüz tarla yok. Yukarıdan ilk tarlanı ekle.</div>`;
  return}
 const f=fields.find(x=>x.id===curField),mine=costs.filter(c=>c.fieldId===f.id);
 const opYears=getOperations().filter(o=>o.fieldId===curField).map(o=>yearOf(o.date));const years=[...new Set([...mine.map(c=>yearOf(c.date)),...opYears,now,selYear])].sort((a,b)=>b-a);
 const ym=y=>mine.filter(c=>yearOf(c.date)===y),tot=ym(selYear).reduce((s,c)=>s+c.amount,0);
 $("sdTitle").textContent=f.name;$("sdSub").innerHTML=`${fieldLabel(f)||"Ada / parsel girilmedi"} · ${fmt(f.area)} da`;
 const latest=f.ndviHistory?.[0],latestObservation=latest?.observations?.at(-1),cropIcon={"Buğday":"🌾","Arpa":"🌿","Kanola":"🌼","Ayçiçeği":"🌻","Mısır":"🌽"}[f.crop]||"🌱";
 $("selectedFieldOverview").innerHTML=`<div class="selected-field-map-wrap"><button type="button" class="selected-field-map" data-selected-field-action="boundary" aria-label="${escapeHtml(f.name)} sınırını düzenle">${fieldPreview(f.geometry)}</button><span class="field-state-pill ${f.geometry?"is-ready":"is-pending"}">${f.geometry?"GeoJSON sınırı kayıtlı":"Sınır henüz çizilmedi"}</span></div><div class="selected-field-info"><div class="eyebrow">PARSEL ÖZETİ · ${escapeHtml(f.season||"SEZON BELİRTİLMEDİ")}</div><h2>${escapeHtml(f.name)}</h2><p>${escapeHtml(f.location||"Konum eklenmedi")} · ${escapeHtml(fieldLabel(f)||"Ada / parsel bilgisi yok")}</p><div class="selected-field-facts"><div><span>ÜRETİM ALANI</span><strong>${fmt(f.area)} da</strong><small>${fmt(num(f.area)/10,2)} ha</small></div><div><span>ÜRÜN</span><strong>${cropIcon} ${escapeHtml(f.crop||"Ürün seçilmedi")}</strong><small>${escapeHtml(f.season||"Sezon belirtilmedi")}</small></div><div><span>SENTINEL‑2 NDVI</span><strong>${latestObservation&&Number.isFinite(Number(latestObservation.mean))?Number(latestObservation.mean).toFixed(3):"—"}</strong><small>${latest?`Son sorgu ${new Date(latest.queriedAt).toLocaleDateString("tr-TR")}`:"Gerçek analiz henüz yok"}</small></div></div>${f.notes?`<p class="selected-field-notes">${escapeHtml(f.notes)}</p>`:""}<div class="selected-field-actions"><button class="primary" type="button" data-selected-field-action="boundary">${f.geometry?"Sınırı düzenle":"Haritada sınır çiz"}</button><button class="secondary" type="button" data-selected-field-action="ndvi"${f.geometry?"":" disabled"}>NDVI analizi</button><button class="secondary" type="button" data-selected-field-action="cost">Bu parsele gider ekle</button><button class="secondary" type="button" data-selected-field-action="costs">Maliyet tablosu</button></div></div>`;
 $("sdYearTag").textContent=`${selYear} SEZONU`;
 $("sdTotal").textContent=money(tot);$("sdPer").textContent=f.area>0?fmt(tot/f.area):"—";$("sdCount").textContent=ym(selYear).length;
 $("sdYears").innerHTML=years.map(y=>{const t=ym(y).reduce((s,c)=>s+c.amount,0);return `<tr${y===selYear?` style="background:#f2f8f3"`:""}><td>${y}</td><td>${fmt(t)}</td><td>${f.area>0?fmt(t/f.area):"—"}</td><td><button class="secondary" onclick="pickYear(${y})">Göster</button></td></tr>`}).join("");
 $("sdLedgerTitle").textContent=`${selYear} maliyet kayıtları`;
 const rows=ym(selYear).sort((a,b)=>String(b.date).localeCompare(String(a.date)));
 $("sdRows").innerHTML=rows.length?rows.map(c=>`<tr><td>${new Date(c.date).toLocaleDateString("tr-TR")}</td><td>${escapeHtml(c.cat)}</td><td style="text-align:left">${escapeHtml(c.desc||"")}</td><td>${fmt(c.amount)}</td><td><button class="secondary" onclick="delCost(${c.id})">Sil</button></td></tr>`).join(""):`<tr><td colspan="5" class="emptyhint">Bu yıl için kayıt yok.</td></tr>`;
 const by={};ym(selYear).forEach(c=>by[c.cat]=(by[c.cat]||0)+c.amount);
 $("sdCats").innerHTML=tot>0?Object.entries(by).sort((a,b)=>b[1]-a[1]).map(([k,v])=>`<div style="margin:10px 0"><div style="display:flex;justify-content:space-between;font-size:12px"><span>${escapeHtml(k)}</span><span>${money(v)} · ${fmt(f.area>0?v/f.area:0)} ₺/da · %${fmt(v/tot*100)}</span></div><div style="height:6px;border-radius:4px;background:var(--mint);margin-top:5px"><div style="height:6px;border-radius:4px;background:var(--green2);width:${v/tot*100}%"></div></div></div>`).join(""):"";
 // Keep the existing cost ledger aligned with the selected season.
 $("siYear").value=String(selYear);
 loadSeasonInfo();
 renderOperations();
 renderProfitability();
}
$("cCat").innerHTML=CATS.map(c=>`<option>${c}</option>`).join("");$("cDate").value=todayStr();
$("opDate").value=todayStr();

const SEASON_DATA_KEY="tarla360_season_data_v1";
const OPERATION_KEY="tarla360_operations_v1";
function getSeasonData(){try{return JSON.parse(localStorage.getItem(SEASON_DATA_KEY)||"{}")}catch(e){return{}}}
function setSeasonData(o){try{localStorage.setItem(SEASON_DATA_KEY,JSON.stringify(o));window.ekinvyaCloud?.queueSave();return true}catch(e){toast("Sezon bilgileri kaydedilemedi.");return false}}
function getOperations(){try{return JSON.parse(localStorage.getItem(OPERATION_KEY)||"[]")}catch(e){return[]}}
function setOperations(a){try{localStorage.setItem(OPERATION_KEY,JSON.stringify(a));window.ekinvyaCloud?.queueSave();return true}catch(e){toast("İşlem kaydedilemedi.");return false}}
function seasonKey(fieldId,year){return `${fieldId}_${year}`}
function selectedSeasonYear(){return parseInt($("siYear").value,10)||selYear||new Date().getFullYear()}
function seasonDataFor(fieldId,year){return getSeasonData()[seasonKey(fieldId,year)]||{}}
function saveSeasonData(fieldId,year,data){const all=getSeasonData();all[seasonKey(fieldId,year)]={...(all[seasonKey(fieldId,year)]||{}),...data};return setSeasonData(all)}
function focusDiary(){showView("season");if(curField){setTimeout(()=>{const el=$("operationPanel");if(el)el.scrollIntoView({behavior:"smooth",block:"start"})},80)}else{toast("Önce Sezon Takibi bölümünden bir tarla seç.")}}
function focusProfit(){showView("season");if(curField){setTimeout(()=>{const el=$("profitPanel");if(el)el.scrollIntoView({behavior:"smooth",block:"start"})},80)}else{toast("Önce Sezon Takibi bölümünden bir tarla seç.")}}
function focusSeasonHistory(){showView("season");if(curField){setTimeout(()=>{const el=$("seasonHistoryPanel");if(el)el.scrollIntoView({behavior:"smooth",block:"start"})},80)}else{toast("Önce Sezon Takibi bölümünden bir tarla seç.")}}
function loadSeasonInfo(){
 if(!curField)return;
 const year=selectedSeasonYear(),d=seasonDataFor(curField,year),f=getFields().find(x=>x.id===curField);
 if(f&&f.crop&&[...$("siCrop").options].some(o=>o.value===f.crop))$("siCrop").value=f.crop;
 $("siYear").value=String(year);
 $("siYield").value=d.yieldKgDa??"";
 $("siPrice").value=d.pricePerKg??"";
 $("siSupport").value=d.support??"";
 $("siRevenueOther").value=d.otherRevenue??"";
}
function renderOperations(){
 if(!curField)return;
 const year=selectedSeasonYear();
 const ops=getOperations().filter(o=>o.fieldId===curField&&yearOf(o.date)===year).sort((a,b)=>String(b.date).localeCompare(String(a.date)));
 $("operationRows").innerHTML=ops.length?ops.map(o=>`<tr><td>${new Date(o.date).toLocaleDateString("tr-TR")}</td><td><span class="pill">${escapeHtml(o.type)}</span></td><td style="text-align:left;white-space:normal;min-width:150px">${escapeHtml(o.desc)}</td><td>${o.qty==null||o.qty===""?"—":`${fmt(o.qty)} ${escapeHtml(o.unit||"")}`}</td><td>${o.cost>0?money(o.cost):"—"}</td><td><button class="secondary" onclick="deleteOperation(${o.id})">Sil</button></td></tr>`).join(""):`<tr><td colspan="6" class="emptyhint">Bu sezonda henüz işlem kaydı yok.</td></tr>`;
}
function deleteOperation(id){
 const op=getOperations().find(o=>o.id===id);
 setOperations(getOperations().filter(o=>o.id!==id));
 if(op&&op.cost>0&&op.costId){setCosts(getCosts().filter(c=>c.id!==op.costId))}
 renderSeason();toast("İşlem kaydı silindi.");
}
function renderProfitability(){
 if(!curField)return;
 const f=getFields().find(x=>x.id===curField);if(!f)return;
 const year=selectedSeasonYear(),d=seasonDataFor(curField,year);
 const costs=getCosts().filter(c=>c.fieldId===curField&&yearOf(c.date)===year).reduce((s,c)=>s+(Number(c.amount)||0),0);
 const y=num(d.yieldKgDa),p=num(d.pricePerKg),support=num(d.support),other=num(d.otherRevenue);
 const revenue=(y>0&&p>=0?y*f.area*p:0)+support+other;
 const hasYield=y>0&&p>0;
 const net=revenue-costs;
 const be=y>0?Math.max(0,(costs-support-other)/(f.area*y)):null;
 $("profitCost").textContent=money(costs);
 $("profitRevenue").textContent=hasYield||support>0||other>0?money(revenue):"—";
 $("profitNet").textContent=hasYield||support>0||other>0?money(net):"—";
 $("profitNetLabel").textContent=hasYield||support>0||other>0?(net>=0?"Net kâr":"Net zarar"):"Gelir bilgisi bekleniyor";
 $("profitBreakEven").textContent=be==null?"—":fmt(be);
 $("profitPerDa").textContent=`Dekara maliyet: ${f.area>0?fmt(costs/f.area):"—"} ₺/da`;
 $("profitYieldNote").textContent=hasYield?`Verim ${fmt(y)} kg/da · satış ${fmt(p)} ₺/kg`:"Verim ve satış fiyatı girildiğinde ürün geliri hesaplanır.";
}

$("siYear").innerHTML=[...new Set([new Date().getFullYear()-1,new Date().getFullYear(),new Date().getFullYear()+1,new Date().getFullYear()+2])].sort((a,b)=>a-b).map(y=>`<option value="${y}">${y}/${String(y+1).slice(-2)}</option>`).join("");
$("siYear").value=String(new Date().getFullYear());
$("seasonInfoForm").addEventListener("submit",e=>{
 e.preventDefault();if(!curField){toast("Önce bir tarla seç.");return}
 const year=selectedSeasonYear(),crop=$("siCrop").value;
 const data={crop,yieldKgDa:num($("siYield").value),pricePerKg:num($("siPrice").value),support:num($("siSupport").value),otherRevenue:num($("siRevenueOther").value)};
 if(saveSeasonData(curField,year,data)){
   const fields=getFields(),i=fields.findIndex(f=>f.id===curField);
   if(i>=0){fields[i].crop=crop;fields[i].season=$("siYear").selectedOptions[0]?.textContent||String(year);setFields(fields);renderFields()}
   selYear=year;renderSeason();toast("Sezon bilgileri kaydedildi.");
 }
});
$("siYear").addEventListener("change",()=>{if(!curField)return;selYear=selectedSeasonYear();renderSeason()});
$("operationForm").addEventListener("submit",e=>{
 e.preventDefault();if(!curField){toast("Önce bir tarla seç.");return}
 const date=$("opDate").value,desc=$("opDesc").value.trim(),cost=num($("opCost").value);
 if(!date||!desc){toast("İşlem tarihi ve açıklaması zorunludur.");return}
 const ops=getOperations(),id=Date.now(),costId=cost>0?id+1:null;
 const op={id,fieldId:curField,date,type:$("opType").value,desc,qty:$("opAmount").value===""?null:num($("opAmount").value),unit:$("opUnit").value,cost,costId};
 if(cost>0){const costs=getCosts();costs.push({id:costId,fieldId:curField,date,cat:op.type==="Gübreleme"?"Üst gübre":op.type==="İlaçlama"?"İlaç (genel)":op.type==="Biçerdöver / Hasat"?"Makine / Hizmet":op.type==="İşçilik"?"İşçilik":op.type==="Sulama"?"Sulama":"Diğer",desc:`İşlem defteri: ${desc}`,amount:cost});if(!setCosts(costs))return}
 ops.push(op);
 if(setOperations(ops)){selYear=yearOf(date);$("siYear").value=String(selYear);$("opDesc").value="";$("opAmount").value="";$("opCost").value="";renderSeason();toast(cost>0?"İşlem ve maliyeti kaydedildi.":"İşlem defterine kaydedildi.")};
});
$("seasonFieldForm").addEventListener("submit",e=>{e.preventDefault();const name=$("sfName").value.trim(),area=num($("sfArea").value);if(!name||!(area>0)){toast("Tarla adı ve dekar zorunludur.");return}const a=getFields(),id=Date.now();a.unshift({id,name,area,ada:$("sfAda").value.trim(),parsel:$("sfParsel").value.trim(),crop:"",location:"",season:"",notes:"",createdAt:new Date().toISOString()});if(setFields(a)){$("seasonFieldForm").reset();renderFields();openField(id);toast("Tarla kaydedildi. Şimdi maliyetleri girebilirsin.")}});
$("costForm").addEventListener("submit",e=>{e.preventDefault();const amount=num($("cAmt").value),date=$("cDate").value;if(!(amount>0)||!date){toast("Tarih ve geçerli bir tutar gir.");return}const a=getCosts();a.push({id:Date.now(),fieldId:curField,date,cat:$("cCat").value,desc:$("cDesc").value.trim(),amount});if(setCosts(a)){selYear=yearOf(date);$("cAmt").value="";$("cDesc").value="";renderSeason();toast("Maliyet eklendi.")}});
$("npkCostBtn").addEventListener("click",()=>{const f=getFields().find(x=>x.id===curField),c=costOf(calc());if(!f||c.per==null){toast("Önce NPK hesabı yap ve Maliyet & fiyatlar bölümünde gübre fiyatlarını gir.");return}const a=getCosts(),date=$("cDate").value||todayStr();a.push({id:Date.now(),fieldId:f.id,date,cat:"Gübre",desc:`NPK hesabı (${fmt(c.per)} ₺/da)`,amount:c.per*f.area});if(setCosts(a)){selYear=yearOf(date);renderSeason();toast("Gübre maliyeti eklendi.")}});
window.ekinvyaRefreshData = function(){renderSaves();renderFields();renderCost();renderSeason()};
addFert(5,100);window.ekinvyaRefreshData();

// Installable offline shell. Location and weather APIs still need an internet connection.
if ("serviceWorker" in navigator && /^https?:$/.test(location.protocol)) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./service-worker.js").catch(error => {
      console.info("Ekinvya çevrimdışı önbelleği etkinleştirilemedi:", error);
    });
  });
}
