(() => {
  const $ = id => document.getElementById(id);
  const config = window.EKINVYA_SUPABASE_CONFIG || {};
  const configReady = /^https:\/\/[^\s/]+\/?$/i.test(config.url || "")
    && /^(sb_publishable_[\w-]+|eyJ[\w.-]+)$/.test(config.publishableKey || "");
  const sdk = window.supabase;
  const client = window.ekinvyaSupabaseClient || (configReady && sdk?.createClient
    ? sdk.createClient(config.url.replace(/\/$/, ""), config.publishableKey, {
      auth: { autoRefreshToken: true, persistSession: true, detectSessionInUrl: true }
    })
    : null);

  const notice = $("authConfigNotice");
  const guestPanel = $("authGuestPanel");
  const accountPanel = $("authAccountPanel");
  const authForm = $("authForm");
  const recoveryForm = $("authRecoveryForm");
  const authTabs = $("authTabs");
  let mode = "login";

  function lockApp() {
    document.body.classList.remove("auth-pending");
    document.body.classList.add("auth-locked");
    window.showView?.("profile");
  }

  function unlockApp() {
    const wasLocked = document.body.classList.contains("auth-pending")
      || document.body.classList.contains("auth-locked");
    document.body.classList.remove("auth-pending", "auth-locked");
    if (wasLocked) window.showView?.("dashboard");
  }

  let sessionCheckResolved = false;
  let sessionCheckTimeout = null;

  function finishSessionCheck() {
    sessionCheckResolved = true;
    if (sessionCheckTimeout !== null) {
      window.clearTimeout(sessionCheckTimeout);
      sessionCheckTimeout = null;
    }
  }

  function setFeedback(message, state = "") {
    const target = $("authFeedback");
    target.textContent = message;
    target.dataset.state = state;
  }

  function setRecoveryFeedback(message, state = "") {
    const target = $("authRecoveryFeedback");
    target.textContent = message;
    target.dataset.state = state;
  }

  function friendlyError(error) {
    const message = String(error?.message || "");
    if (/invalid login credentials/i.test(message)) return "E-posta veya şifre hatalı. Bilgilerini kontrol edip yeniden dene.";
    if (/already registered|user already exists/i.test(message)) return "Bu e-posta ile daha önce üyelik açılmış. Giriş yapmayı deneyebilirsin.";
    if (/password.*(characters|length|short)/i.test(message)) return "Şifren en az 8 karakter olmalı.";
    if (/email.*(invalid|valid)/i.test(message)) return "Geçerli bir e-posta adresi yaz.";
    if (/rate limit|too many requests/i.test(message)) return "Çok fazla deneme yapıldı. Biraz bekleyip yeniden dene.";
    if (/fetch|network|failed to/i.test(message)) return "Hesap servisine ulaşılamadı. İnternet bağlantını kontrol et.";
    return "İşlem tamamlanamadı. Bilgilerini kontrol edip yeniden dene.";
  }

  function setMode(nextMode) {
    mode = nextMode;
    const signup = mode === "signup";
    $("authNameField").hidden = !signup;
    $("authConfirmField").hidden = !signup;
    $("authNoticeField").hidden = !signup;
    $("authNoticeAck").required = signup;
    $("authForgotButton").hidden = signup;
    $("authName").required = signup;
    $("authPasswordConfirm").required = signup;
    $("authPassword").autocomplete = signup ? "new-password" : "current-password";
    $("authSubmit").textContent = signup ? "Üyelik oluştur" : "Giriş yap";
    $("authLoginTab").classList.toggle("active", !signup);
    $("authSignupTab").classList.toggle("active", signup);
    $("authLoginTab").setAttribute("aria-pressed", String(!signup));
    $("authSignupTab").setAttribute("aria-pressed", String(signup));
    setFeedback("");
  }

  function showConfigurationState() {
    notice.hidden = false;
    if (!sdk?.createClient) {
      notice.textContent = "Supabase Auth kütüphanesi yüklenemedi. İnternet bağlantısını kontrol edip sayfayı yenile.";
      return;
    }
    if (!configReady) {
      notice.innerHTML = 'Kayıt ve giriş henüz etkinleştirilmedi. Supabase proje URL’si ile <strong>publishable</strong> anahtarını <code>supabase-config.js</code> dosyasına eklemek gerekiyor. Gizli veya service_role anahtarını tarayıcı dosyalarına koyma.';
      $("authSubmit").disabled = true;
      $("authForgotButton").disabled = true;
      return;
    }
    notice.hidden = true;
  }

  let accountTransition = 0;

  function presentAccount(user) {
    unlockApp();
    const name = user.user_metadata?.full_name || user.user_metadata?.name || "Ekinvya üyesi";
    $("authAccountName").textContent = name;
    $("authAccountEmail").textContent = user.email || "";
    guestPanel.hidden = true;
    accountPanel.hidden = false;
    notice.hidden = true;
  }

  function showAccount(user) {
    const transition = ++accountTransition;
    const cloud = window.ekinvyaCloud;
    if (!cloud?.loadForUser || cloud.isReadyFor(user.id)) {
      presentAccount(user);
      return;
    }
    cloud.setStatus("Bulut kayıtları yükleniyor…", "syncing");
    cloud.loadForUser(user.id).then(() => {
      if (transition === accountTransition) presentAccount(user);
    }).catch(error => {
      if (transition !== accountTransition) return;
      cloud.reportError(error);
      presentAccount(user);
    });
  }

  function showGuest() {
    accountTransition++;
    window.ekinvyaCloud?.setSignedOut();
    lockApp();
    guestPanel.hidden = false;
    accountPanel.hidden = true;
    showConfigurationState();
  }

  function showRecovery() {
    accountTransition++;
    guestPanel.hidden = false;
    accountPanel.hidden = true;
    authForm.hidden = true;
    authTabs.hidden = true;
    recoveryForm.hidden = false;
    notice.hidden = true;
    lockApp();
    $("authNewPassword").focus();
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (!client) {
      showConfigurationState();
      return;
    }
    if (!authForm.reportValidity()) return;
    const email = $("authEmail").value.trim().toLowerCase();
    const password = $("authPassword").value;
    const submit = $("authSubmit");
    if (mode === "signup" && password !== $("authPasswordConfirm").value) {
      setFeedback("Şifre alanları aynı olmalı.", "error");
      $("authPasswordConfirm").focus();
      return;
    }

    submit.disabled = true;
    submit.textContent = mode === "signup" ? "Üyelik oluşturuluyor…" : "Giriş yapılıyor…";
    setFeedback("");
    try {
      const result = mode === "signup"
        ? await client.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: $("authName").value.trim(),
              privacy_notice_version: "2026-11-20",
              privacy_notice_acknowledged_at: new Date().toISOString()
            },
            emailRedirectTo: `${location.origin}${location.pathname}`
          }
        })
        : await client.auth.signInWithPassword({ email, password });
      if (result.error) throw result.error;

      if (mode === "signup" && !result.data.session) {
        setFeedback("Üyelik isteğin alındı. Giriş yapmadan önce e-posta adresindeki doğrulama bağlantısına tıkla.", "success");
      } else if (result.data.user) {
        setFeedback(mode === "signup" ? "Üyeliğin oluşturuldu." : "Giriş başarılı.", "success");
        showAccount(result.data.user);
      }
    } catch (error) {
      setFeedback(friendlyError(error), "error");
      console.error("Ekinvya auth işlemi başarısız:", error);
    } finally {
      submit.disabled = false;
      submit.textContent = mode === "signup" ? "Üyelik oluştur" : "Giriş yap";
    }
  }

  async function sendPasswordReset() {
    if (!client) return showConfigurationState();
    if (!$("authEmail").reportValidity()) return;
    const button = $("authForgotButton");
    button.disabled = true;
    setFeedback("Şifre yenileme isteği gönderiliyor…");
    try {
      const { error } = await client.auth.resetPasswordForEmail(
        $("authEmail").value.trim().toLowerCase(),
        { redirectTo: `${location.origin}${location.pathname}` }
      );
      if (error) throw error;
      setFeedback("Bu e-posta kayıtlıysa şifre yenileme bağlantısı gönderildi. Gelen kutunu kontrol et.", "success");
    } catch (error) {
      setFeedback(friendlyError(error), "error");
    } finally {
      button.disabled = false;
    }
  }

  async function updatePassword(event) {
    event.preventDefault();
    if (!client || !recoveryForm.reportValidity()) return;
    const password = $("authNewPassword").value;
    if (password !== $("authNewPasswordConfirm").value) {
      setRecoveryFeedback("Şifre alanları aynı olmalı.", "error");
      return;
    }
    const submit = recoveryForm.querySelector("button[type=submit]");
    submit.disabled = true;
    setRecoveryFeedback("Şifre güncelleniyor…");
    try {
      const { data, error } = await client.auth.updateUser({ password });
      if (error) throw error;
      recoveryForm.hidden = true;
      authForm.hidden = false;
      authTabs.hidden = false;
      setFeedback("Şifren güncellendi. Hesabına giriş yapabilirsin.", "success");
      if (data.user) showAccount(data.user);
    } catch (error) {
      setRecoveryFeedback(friendlyError(error), "error");
    } finally {
      submit.disabled = false;
    }
  }

  async function signOut() {
    if (!client) return;
    const button = $("authSignOutButton");
    button.disabled = true;
    try {
      try { await window.ekinvyaCloud?.flush(); } catch (syncError) { console.warn("Çıkış öncesi bulut eşitlemesi tamamlanamadı:", syncError); }
      const { error } = await client.auth.signOut({ scope: "local" });
      if (error) throw error;
      $("authAccountFeedback").textContent = "Güvenli çıkış yapıldı.";
    } catch (error) {
      $("authAccountFeedback").textContent = friendlyError(error);
    } finally {
      button.disabled = false;
    }
  }

  document.querySelectorAll("[data-auth-mode]").forEach(button => {
    button.addEventListener("click", () => {
      setMode(button.dataset.authMode);
      if (button.hasAttribute("data-auth-scroll")) {
        $("authSection").scrollIntoView({ behavior: "smooth", block: "center" });
      }
    });
  });
  authForm.addEventListener("submit", handleSubmit);
  recoveryForm.addEventListener("submit", updatePassword);
  $("authForgotButton").addEventListener("click", sendPasswordReset);
  $("authSignOutButton").addEventListener("click", signOut);

  if (!client) {
    showGuest();
  } else {
    notice.hidden = true;
    sessionCheckTimeout = window.setTimeout(() => {
      if (sessionCheckResolved) return;
      finishSessionCheck();
      showGuest();
      setFeedback("Oturum kontrolü yanıt vermedi. Giriş yapmayı deneyebilir veya sayfayı yenileyebilirsin.", "error");
    }, 8000);
    client.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY") {
        finishSessionCheck();
        showRecovery();
      } else if (session?.user) {
        finishSessionCheck();
        showAccount(session.user);
      } else if (event === "SIGNED_OUT" || event === "INITIAL_SESSION") {
        finishSessionCheck();
        showGuest();
      }
    });
    client.auth.getSession().then(({ data, error }) => {
      finishSessionCheck();
      if (error) throw error;
      if (data.session?.user) showAccount(data.session.user);
      else showGuest();
    }).catch(error => {
      finishSessionCheck();
      showGuest();
      console.warn("Ekinvya oturumu okunamadı:", error);
    });
  }
})();
