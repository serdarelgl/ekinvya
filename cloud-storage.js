(() => {
  const TABLE = "ekinvya_user_data";
  const OWNER_KEY = "ekinvya_cloud_owner_v1";
  const PENDING_KEY = "ekinvya_cloud_pending_v1";
  const BACKUP_PREFIX = "ekinvya_cloud_backup_v1_";
  const DATA_KEYS = [
    "tarla360_npk_saves",
    "tarla360_fields_v1",
    "tarla360_prices_v1",
    "tarla360_scen_v1",
    "tarla360_costs_v1",
    "tarla360_season_data_v1",
    "tarla360_operations_v1"
  ];
  const DEFAULTS = {
    tarla360_npk_saves: [],
    tarla360_fields_v1: [],
    tarla360_prices_v1: {},
    tarla360_scen_v1: [],
    tarla360_costs_v1: [],
    tarla360_season_data_v1: {},
    tarla360_operations_v1: []
  };
  const clone = value => JSON.parse(JSON.stringify(value));
  const config = window.EKINVYA_SUPABASE_CONFIG || {};
  const sdk = window.supabase;
  const configReady = /^https:\/\/[^\s/]+\/?$/i.test(config.url || "")
    && /^(sb_publishable_[\w-]+|eyJ[\w.-]+)$/.test(config.publishableKey || "");
  const client = configReady && sdk?.createClient
    ? sdk.createClient(config.url.replace(/\/$/, ""), config.publishableKey, {
      auth: { autoRefreshToken: true, persistSession: true, detectSessionInUrl: true }
    })
    : null;

  window.ekinvyaSupabaseClient = client;
  let activeUserId = null;
  let readyUserId = null;
  let saveTimer = null;
  let inFlightSave = null;
  let pendingSave = false;
  const loadPromises = new Map();

  function setStatus(message, state = "pending") {
    const status = document.getElementById("cloudStatus");
    const label = document.getElementById("cloudStatusText");
    if (label) label.textContent = message;
    if (status) {
      status.dataset.state = state;
      status.title = message;
    }
  }

  function emptyPayload() {
    return Object.fromEntries(DATA_KEYS.map(key => [key, clone(DEFAULTS[key])]));
  }

  function normalizePayload(value) {
    const result = emptyPayload();
    if (!value || typeof value !== "object" || Array.isArray(value)) return result;
    for (const key of DATA_KEYS) {
      if (!Object.hasOwn(value, key)) continue;
      const expectedArray = Array.isArray(DEFAULTS[key]);
      const item = value[key];
      if (expectedArray ? Array.isArray(item) : item && typeof item === "object" && !Array.isArray(item)) {
        result[key] = item;
      }
    }
    return result;
  }

  function readLocalPayload() {
    const result = emptyPayload();
    for (const key of DATA_KEYS) {
      const raw = localStorage.getItem(key);
      if (raw === null) continue;
      try {
        const parsed = JSON.parse(raw);
        const normalized = normalizePayload({ [key]: parsed });
        result[key] = normalized[key];
      } catch (error) {
        console.warn(`Ekinvya yerel kayıt okunamadı (${key}).`, error);
      }
    }
    return result;
  }

  function clearLocalPayload() {
    for (const key of DATA_KEYS) localStorage.removeItem(key);
    localStorage.removeItem(OWNER_KEY);
    localStorage.removeItem(PENDING_KEY);
  }

  function backupKey(userId) {
    return `${BACKUP_PREFIX}${encodeURIComponent(userId)}`;
  }

  function preserveLocalForOwner(userId) {
    if (!userId) return;
    const backup = {
      payload: readLocalPayload(),
      pending: localStorage.getItem(PENDING_KEY) === "1"
    };
    localStorage.setItem(backupKey(userId), JSON.stringify(backup));
  }

  function readBackup(userId) {
    try {
      const value = JSON.parse(localStorage.getItem(backupKey(userId)) || "null");
      if (!value || typeof value !== "object") return null;
      return { payload: normalizePayload(value.payload), pending: value.pending === true };
    } catch (error) {
      console.warn("Ekinvya hesap yedeği okunamadı.", error);
      return null;
    }
  }

  function writeLocalPayload(payload, userId) {
    const normalized = normalizePayload(payload);
    for (const key of DATA_KEYS) localStorage.setItem(key, JSON.stringify(normalized[key]));
    localStorage.setItem(OWNER_KEY, userId);
    localStorage.removeItem(PENDING_KEY);
  }

  function mergeArray(remote, local) {
    const rows = Array.isArray(remote) ? remote.slice() : [];
    const indices = new Map();
    rows.forEach((item, index) => {
      if (item && item.id !== undefined && item.id !== null) indices.set(String(item.id), index);
    });
    for (const item of Array.isArray(local) ? local : []) {
      const key = item && item.id !== undefined && item.id !== null ? String(item.id) : null;
      if (key !== null && indices.has(key)) {
        rows[indices.get(key)] = item;
      } else if (!rows.some(existing => JSON.stringify(existing) === JSON.stringify(item))) {
        if (key !== null) indices.set(key, rows.length);
        rows.push(item);
      }
    }
    if (rows.every(item => Number.isFinite(Number(item?.id)))) rows.sort((a, b) => Number(b.id) - Number(a.id));
    return rows;
  }

  function mergePayload(remoteValue, localValue) {
    const remote = normalizePayload(remoteValue);
    const local = normalizePayload(localValue);
    const merged = {};
    for (const key of DATA_KEYS) {
      if (Array.isArray(DEFAULTS[key])) merged[key] = mergeArray(remote[key], local[key]);
      else merged[key] = { ...remote[key], ...local[key] };
    }
    return merged;
  }

  function reportError(error) {
    const message = String(error?.message || error?.details || error || "");
    const missingTable = /ekinvya_user_data|schema cache|does not exist/i.test(message) || error?.code === "PGRST205";
    setStatus(missingTable ? "Bulut tablosu kurulumu gerekiyor" : "Bulut eşitlemesi başarısız", "error");
    console.error("Ekinvya bulut eşitlemesi başarısız:", error);
  }

  async function writeCloudPayload(userId, payload) {
    const { error } = await client
      .from(TABLE)
      .upsert({ user_id: userId, payload: normalizePayload(payload), updated_at: new Date().toISOString() }, { onConflict: "user_id" });
    if (error) throw error;
  }

  async function loadForUser(userId) {
    if (!client) throw new Error("Supabase bağlantı ayarları eksik.");
    if (readyUserId === userId) return;
    if (loadPromises.has(userId)) return loadPromises.get(userId);

    activeUserId = userId;
    readyUserId = null;
    setStatus("Bulut kayıtları yükleniyor…", "syncing");
    const task = (async () => {
      const localOwner = localStorage.getItem(OWNER_KEY);
      if (localOwner && localOwner !== userId) {
        preserveLocalForOwner(localOwner);
        clearLocalPayload();
        window.ekinvyaRefreshData?.();
      }
      const targetBackup = readBackup(userId);
      const localPayload = localOwner === userId || !localOwner ? readLocalPayload() : emptyPayload();
      const localPending = localOwner === userId && localStorage.getItem(PENDING_KEY) === "1";
      const { data, error } = await client
        .from(TABLE)
        .select("payload")
        .eq("user_id", userId)
        .maybeSingle();
      if (error) throw error;
      if (activeUserId !== userId) return;

      let payload;
      const migrationData = targetBackup?.pending ? targetBackup.payload : localPayload;
      if (data && (localPending || targetBackup?.pending || !localOwner)) {
        payload = mergePayload(data.payload, migrationData);
      } else if (data) {
        payload = normalizePayload(data.payload);
      } else if (targetBackup) {
        payload = targetBackup.payload;
      } else {
        payload = localPayload;
      }

      writeLocalPayload(payload, userId);
      readyUserId = userId;
      window.ekinvyaRefreshData?.();
      if (!data || JSON.stringify(normalizePayload(data.payload)) !== JSON.stringify(payload)) {
        await writeCloudPayload(userId, payload);
      }
      localStorage.removeItem(backupKey(userId));
      setStatus("Bulutla eşitlendi", "success");
      if (pendingSave) scheduleSave();
    })();
    loadPromises.set(userId, task);
    try {
      await task;
    } finally {
      loadPromises.delete(userId);
    }
  }

  async function flush() {
    if (!activeUserId || readyUserId !== activeUserId) return;
    if (inFlightSave) {
      pendingSave = true;
      return inFlightSave;
    }
    const userId = activeUserId;
    inFlightSave = (async () => {
      do {
        pendingSave = false;
        await writeCloudPayload(userId, readLocalPayload());
      } while (pendingSave && activeUserId === userId && readyUserId === userId);
      if (activeUserId === userId) {
        localStorage.removeItem(PENDING_KEY);
        localStorage.removeItem(backupKey(userId));
        setStatus("Bulutla eşitlendi", "success");
      }
    })();
    try {
      await inFlightSave;
    } catch (error) {
      reportError(error);
      throw error;
    } finally {
      inFlightSave = null;
    }
  }

  function scheduleSave() {
    if (!activeUserId) return;
    pendingSave = true;
    localStorage.setItem(PENDING_KEY, "1");
    if (readyUserId !== activeUserId) return;
    setStatus("Buluta kaydediliyor…", "syncing");
    window.clearTimeout(saveTimer);
    saveTimer = window.setTimeout(() => flush().catch(() => {}), 500);
  }

  function setSignedOut() {
    activeUserId = null;
    readyUserId = null;
    pendingSave = false;
    window.clearTimeout(saveTimer);
    setStatus("Oturum bekleniyor", "pending");
  }

  window.ekinvyaCloud = {
    client,
    loadForUser,
    queueSave: scheduleSave,
    flush,
    setSignedOut,
    reportError,
    setStatus,
    isReadyFor: userId => readyUserId === userId
  };
  window.addEventListener("online", () => {
    if (activeUserId && localStorage.getItem(PENDING_KEY) === "1" && readyUserId === activeUserId) scheduleSave();
  });
})();

