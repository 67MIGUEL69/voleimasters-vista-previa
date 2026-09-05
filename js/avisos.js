/* =========================================================
   AVISOS AL MÒBIL
   =========================================================
   No cal tenir compte: qui ve a mirar el marcador del seu
   equip ha de poder rebre avisos sense registrar-se.

   El permís NO es demana en entrar. Es demana quan l'usuari
   diu que vol avisos, que és quan té sentit: si es rebutja
   una vegada, recuperar-lo després és un embolic.
   ========================================================= */

const Avisos = {
  /* Estat que retorna el servidor: preferències i equips seguits. */
  estat: null,
  subscripcio: null,      // PushSubscription del navegador

  /** El navegador pot fer avisos? */
  esPossible() {
    return 'serviceWorker' in navigator
      && 'PushManager' in window
      && 'Notification' in window;
  },

  /** 'default' (no s'ha demanat) · 'granted' · 'denied' */
  permis() {
    return this.esPossible() ? Notification.permission : 'denied';
  },

  /*
    navigator.serviceWorker.ready és una promesa que NO es resol mai si
    no hi ha cap service worker actiu: no falla, es queda esperant. I
    passa més del que sembla —a http:// que no sigui localhost el
    navegador no en deixa registrar cap, i a la còpia de mostra ni tan
    sols s'hi registra.

    Esperant-la sense límit, obrir el perfil deixava la pantalla en
    «carregant» per sempre; només es desencallava canviant de tema,
    perquè allò repinta sense passar per aquí. Amb el límit, el pitjor
    que passa és que els avisos surtin com a no configurats.
  */
  async registreLlest(segons = 3) {
    if (!this.esPossible()) return null;
    return Promise.race([
      navigator.serviceWorker.ready,
      new Promise(resol => setTimeout(() => resol(null), segons * 1000)),
    ]);
  },

  /** Mira si aquest dispositiu ja està subscrit, sense demanar res. */
  async carregar() {
    if (!this.esPossible() || this.permis() !== 'granted') return null;

    const registre = await this.registreLlest();
    if (registre === null) return null;

    this.subscripcio = await registre.pushManager.getSubscription();
    if (!this.subscripcio) return null;

    try {
      this.estat = await Api.get(
        '/push/estat?endpoint=' + encodeURIComponent(this.subscripcio.endpoint)
      );
      // El servidor no la coneix (base de dades refeta): la tornem a donar d'alta.
      if (!this.estat.subscrit) await this.registrarAlServidor();
    } catch (_) {
      this.estat = null;
    }
    return this.estat;
  },

  /**
   * Demana permís i subscriu. Retorna l'estat, o llança amb un missatge
   * que es pugui ensenyar tal qual.
   */
  async activar() {
    if (!this.esPossible()) {
      throw new Error('Aquest navegador no pot rebre avisos.');
    }
    if (!estaInstalada() && esIphone()) {
      throw new Error("A l'iPhone cal afegir-la a la pantalla d'inici abans d'activar els avisos.");
    }

    const permis = await Notification.requestPermission();
    if (permis !== 'granted') {
      throw new Error(permis === 'denied'
        ? 'Has bloquejat els avisos. Per tornar-los a permetre cal canviar-ho als ajustos del navegador.'
        : 'No has donat permís per als avisos.');
    }

    const { clau } = await Api.get('/push/clau');
    const registre = await this.registreLlest();
    if (registre === null) {
      throw new Error("Aquest navegador no ha pogut preparar els avisos. "
        + "Prova-ho des de l'app instal·lada.");
    }

    this.subscripcio = await registre.pushManager.subscribe({
      // Sense això Chrome no deixa subscriure's: obliga a que tota
      // notificació sigui visible per a l'usuari, i em sembla bé.
      userVisibleOnly: true,
      applicationServerKey: base64ABytes(clau),
    });

    return this.registrarAlServidor();
  },

  async registrarAlServidor() {
    const s = this.subscripcio.toJSON();
    this.estat = await Api.post('/push/subscriure', {
      endpoint: s.endpoint,
      p256dh: s.keys.p256dh,
      auth: s.keys.auth,
    });
    return this.estat;
  },

  async desactivar() {
    if (!this.subscripcio) return;
    const endpoint = this.subscripcio.endpoint;
    try { await Api.post('/push/baixa', { endpoint }); } catch (_) { /* igualment */ }
    try { await this.subscripcio.unsubscribe(); } catch (_) { /* igualment */ }
    this.subscripcio = null;
    this.estat = null;
  },

  async canviarPreferencia(tipus, valor) {
    this.estat = await Api.patch('/push/preferencies', {
      endpoint: this.subscripcio.endpoint,
      [tipus]: valor,
    });
    return this.estat;
  },

  /* ---------- Equips seguits ---------- */

  segueix(equipId) {
    return !!this.estat?.seguint?.some(e => e.id === Number(equipId));
  },

  async seguir(equipId) {
    if (!this.subscripcio) await this.activar();
    this.estat = await Api.post('/push/seguir', {
      endpoint: this.subscripcio.endpoint,
      equip_id: Number(equipId),
    });
    return this.estat;
  },

  async deixar(equipId) {
    this.estat = await Api.post('/push/deixar', {
      endpoint: this.subscripcio.endpoint,
      equip_id: Number(equipId),
    });
    return this.estat;
  },

  /** Envia un avís de prova, perquè es vegi que arriben de debò. */
  prova() {
    return Api.post('/push/prova', { endpoint: this.subscripcio.endpoint });
  },
};

/**
 * La clau pública ve en base64 «url segura» i pushManager.subscribe la vol
 * en bytes.
 */
function base64ABytes(text) {
  const net = (text + '='.repeat((4 - text.length % 4) % 4))
    .replace(/-/g, '+').replace(/_/g, '/');
  const cru = atob(net);
  return Uint8Array.from(cru, c => c.charCodeAt(0));
}
