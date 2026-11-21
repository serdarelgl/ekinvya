const TOKEN_URL = "https://identity.dataspace.copernicus.eu/auth/realms/CDSE/protocol/openid-connect/token";
const STATISTICS_URL = "https://sh.dataspace.copernicus.eu/api/v1/statistics";
const CRS84 = "http://www.opengis.net/def/crs/OGC/1.3/CRS84";

let cachedToken = "";
let tokenExpiresAt = 0;

function respond(res, status, payload) {
  res.setHeader("Cache-Control", "no-store");
  res.status(status).json(payload);
}

function validPolygon(geometry) {
  if (!geometry || geometry.type !== "Polygon" || !Array.isArray(geometry.coordinates)) return false;
  const ring = geometry.coordinates[0];
  if (!Array.isArray(ring) || ring.length < 4 || ring.length > 2000) return false;
  if (!ring.every(point => Array.isArray(point) && point.length >= 2
    && Number.isFinite(point[0]) && Number.isFinite(point[1])
    && point[0] >= -180 && point[0] <= 180 && point[1] >= -90 && point[1] <= 90)) return false;
  const first = ring[0], last = ring[ring.length - 1];
  if (first[0] !== last[0] || first[1] !== last[1]) return false;
  const radius = 6378137;
  let area = 0;
  for (let index = 0; index < ring.length - 1; index += 1) {
    const [lon1, lat1] = ring[index];
    const [lon2, lat2] = ring[index + 1];
    area += (lon2 - lon1) * Math.PI / 180
      * (2 + Math.sin(lat1 * Math.PI / 180) + Math.sin(lat2 * Math.PI / 180));
  }
  return Math.abs(area * radius * radius / 2) <= 50_000_000;
}

async function getAccessToken() {
  if (cachedToken && tokenExpiresAt > Date.now() + 60_000) return cachedToken;
  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: process.env.COPERNICUS_CLIENT_ID,
    client_secret: process.env.COPERNICUS_CLIENT_SECRET
  });
  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    signal: AbortSignal.timeout(10_000)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.access_token) throw new Error("Copernicus kimlik doğrulaması başarısız oldu.");
  cachedToken = data.access_token;
  tokenExpiresAt = Date.now() + Math.max(60, Number(data.expires_in) || 300) * 1000;
  return cachedToken;
}

const evalscript = `//VERSION=3
function setup() {
  return {
    input: [{ bands: ["B04", "B08", "SCL", "dataMask"] }],
    output: [
      { id: "ndvi", bands: 1, sampleType: "FLOAT32" },
      { id: "dataMask", bands: 1 }
    ]
  };
}
function evaluatePixel(sample) {
  const denominator = sample.B08 + sample.B04;
  const ndvi = denominator === 0 ? 0 : (sample.B08 - sample.B04) / denominator;
  const cloudOrInvalid = [0, 3, 8, 9, 10, 11].includes(sample.SCL);
  const valid = sample.dataMask === 1 && !cloudOrInvalid && Number.isFinite(ndvi);
  return { ndvi: [valid ? ndvi : 0], dataMask: [valid ? 1 : 0] };
}`;

export default async function handler(req, res) {
  if (req.method !== "POST") return respond(res, 405, { error: "Yalnızca POST isteği kabul edilir." });

  const supabaseUrl = process.env.EKINVYA_SUPABASE_URL;
  const publishableKey = process.env.EKINVYA_SUPABASE_PUBLISHABLE_KEY;
  const clientId = process.env.COPERNICUS_CLIENT_ID;
  const clientSecret = process.env.COPERNICUS_CLIENT_SECRET;
  if (!supabaseUrl || !publishableKey || !clientId || !clientSecret) {
    return respond(res, 503, { error: "Uydu servisi henüz yapılandırılmadı. Copernicus ve Vercel ayarları tamamlanmalı." });
  }

  const authorization = req.headers.authorization || "";
  if (!/^Bearer\s+\S+$/i.test(authorization)) return respond(res, 401, { error: "NDVI analizi için Ekinvya hesabına giriş yap." });
  try {
    const userResponse = await fetch(`${supabaseUrl.replace(/\/$/, "")}/auth/v1/user`, {
      headers: { apikey: publishableKey, Authorization: authorization },
      signal: AbortSignal.timeout(10_000)
    });
    if (!userResponse.ok) return respond(res, 401, { error: "Oturum doğrulanamadı. Yeniden giriş yap." });
  } catch {
    return respond(res, 503, { error: "Ekinvya oturumu doğrulanamadı. Biraz sonra yeniden dene." });
  }

  const { geometry, from, to } = req.body || {};
  if (!validPolygon(geometry)) return respond(res, 400, { error: "Geçerli, kapalı ve 5.000 hektardan küçük bir parsel poligonu gönder." });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from || "") || !/^\d{4}-\d{2}-\d{2}$/.test(to || "")) {
    return respond(res, 400, { error: "Başlangıç ve bitiş tarihlerini kontrol et." });
  }
  const start = Date.parse(`${from}T00:00:00Z`);
  const end = Date.parse(`${to}T23:59:59Z`);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start || end > Date.now() + 86_400_000 || end - start > 366 * 86_400_000) {
    return respond(res, 400, { error: "Tarih aralığı geçersiz; en fazla 366 günlük ve bugünü aşmayan aralık seç." });
  }

  try {
    const accessToken = await getAccessToken();
    const request = {
      input: {
        bounds: { geometry, properties: { crs: CRS84 } },
        data: [{ type: "sentinel-2-l2a", dataFilter: { maxCloudCoverage: 80, mosaickingOrder: "leastCC" } }]
      },
      aggregation: {
        timeRange: { from: `${from}T00:00:00Z`, to: `${to}T23:59:59Z` },
        aggregationInterval: { of: "P10D" },
        evalscript,
        resx: 10,
        resy: 10
      }
    };
    const response = await fetch(STATISTICS_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(request),
      signal: AbortSignal.timeout(40_000)
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || (data.status && data.status !== "OK")) throw new Error("Sentinel Hub analiz isteği tamamlanamadı.");
    const observations = (data.data || []).flatMap(item => {
      const stats = item.outputs?.ndvi?.bands?.B0?.stats;
      if (!stats || !Number.isFinite(stats.mean) || !stats.sampleCount) return [];
      return [{
        from: item.interval?.from,
        to: item.interval?.to,
        mean: stats.mean,
        min: stats.min,
        max: stats.max,
        standardDeviation: stats.stDev,
        sampleCount: stats.sampleCount,
        noDataCount: stats.noDataCount || 0
      }];
    });
    return respond(res, 200, { source: "Sentinel-2 L2A", resolutionMeters: 10, interval: "10 gün", observations });
  } catch (error) {
    console.error("Copernicus Sentinel-2 NDVI request failed:", error);
    return respond(res, 502, { error: "Sentinel‑2 servisi şu anda yanıt vermedi. Biraz sonra yeniden dene." });
  }
}
