/* =========================================================
   ACCÉS I ALTA DE COMPTE
   ========================================================= */

function viewLogin() {
  renderTopbar({ titol: 'Accés', enrere: '#/perfil', accions: false });
  renderTabbar(null);

  App.accions = {
    async entrar(boto) {
      const identificador = $('#c-usuari').value.trim();
      const contrasenya = $('#c-contrasenya').value;
      if (!identificador || !contrasenya) {
        toast('Omple el correu i la contrasenya');
        return;
      }

      boto.disabled = true;
      boto.textContent = 'Entrant…';
      try {
        const u = await Store.entrar(identificador, contrasenya);
        toast('Hola, ' + u.nom);
        anar(pantallaDInici());
      } catch (e) {
        toast(e.message);
        boto.disabled = false;
        boto.textContent = 'Entrar';
      }
    },
  };

  return `
    <div class="login-hero">
      <div class="marca-gran" role="img" aria-label="Voleimasters"></div>
      <h2 class="page-title">Iniciar sessió</h2>
      <p class="page-sub">Àrbitres, equips i jugadors de la lliga.</p>
    </div>

    <div class="card card-pad caixa-estreta">
      <div class="field">
        <label for="c-usuari">Correu o telèfon</label>
        <div class="input-wrap">
          ${icon('mail')}
          <input id="c-usuari" type="text" inputmode="email" autocomplete="username"
                 autocapitalize="off" placeholder="nom@exemple.cat" />
        </div>
      </div>
      <div class="field">
        <label for="c-contrasenya">Contrasenya</label>
        <div class="input-wrap">
          ${icon('lock')}
          <input id="c-contrasenya" type="password" autocomplete="current-password" placeholder="••••••••" />
        </div>
      </div>
      <button class="btn btn-primary btn-block" data-accio="entrar">Entrar</button>
      <button class="btn btn-ghost btn-block" data-anar="#/registre" style="margin-top:8px">
        No tinc compte
      </button>
    </div>

    <div class="note caixa-estreta" style="margin-top:16px">
      ${icon('info', 'icon icon-sm')}
      <span>Si ets àrbitre suplent d'un partit concret, entra amb el teu compte
      i demana el codi al responsable de l'equip local.</span>
    </div>`;
}

function viewRegistre() {
  renderTopbar({ titol: 'Crear compte', enrere: '#/login', accions: false });
  renderTabbar(null);

  App.accions = {
    async registrar(boto) {
      const dades = {
        nom: $('#r-nom').value.trim(),
        cognoms: $('#r-cognoms').value.trim(),
        email: $('#r-email').value.trim(),
        contrasenya: $('#r-contrasenya').value,
      };
      const repeticio = $('#r-contrasenya2').value;

      if (!dades.nom || !dades.email || !dades.contrasenya) {
        toast('Omple el nom, el correu i la contrasenya');
        return;
      }
      if (dades.contrasenya !== repeticio) {
        toast('Les contrasenyes no coincideixen');
        return;
      }

      boto.disabled = true;
      boto.textContent = 'Creant…';
      try {
        const u = await Store.registrar(dades);
        toast('Benvingut, ' + u.nom);
        anar('#/inici');
      } catch (e) {
        toast(e.message);
        boto.disabled = false;
        boto.textContent = 'Crear el compte';
      }
    },
  };

  return `
    <div class="login-hero">
      <div class="marca-gran" role="img" aria-label="Voleimasters"></div>
      <h2 class="page-title">Crear un compte</h2>
      <p class="page-sub">Per seguir la lliga i, si et toca, gestionar el teu equip.</p>
    </div>

    <div class="card card-pad caixa-estreta">
      <div class="fila-camps">
        <div class="field">
          <label for="r-nom">Nom</label>
          <input id="r-nom" type="text" autocomplete="given-name" placeholder="Laia" />
        </div>
        <div class="field">
          <label for="r-cognoms">Cognoms</label>
          <input id="r-cognoms" type="text" autocomplete="family-name" placeholder="Serra Roca" />
        </div>
      </div>

      <div class="field">
        <label for="r-email">Correu electrònic</label>
        <div class="input-wrap">
          ${icon('mail')}
          <input id="r-email" type="email" inputmode="email" autocomplete="email"
                 autocapitalize="off" placeholder="nom@exemple.cat" />
        </div>
      </div>

      <div class="field">
        <label for="r-contrasenya">Contrasenya</label>
        <div class="input-wrap">
          ${icon('lock')}
          <input id="r-contrasenya" type="password" autocomplete="new-password"
                 placeholder="8 caràcters com a mínim" />
        </div>
      </div>

      <div class="field">
        <label for="r-contrasenya2">Repeteix la contrasenya</label>
        <div class="input-wrap">
          ${icon('lock')}
          <input id="r-contrasenya2" type="password" autocomplete="new-password" placeholder="••••••••" />
        </div>
      </div>

      <button class="btn btn-primary btn-block" data-accio="registrar">Crear el compte</button>
    </div>

    <div class="note caixa-estreta" style="margin-top:16px">
      ${icon('info', 'icon icon-sm')}
      <span>El compte es crea per mirar. Els permisos de coordinació, entrenador,
      capità o àrbitre els dona la coordinació de la lliga.</span>
    </div>`;
}
