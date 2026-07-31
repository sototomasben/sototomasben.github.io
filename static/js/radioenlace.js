/* ==========================================================================
   Calculadora de radioenlace punto a punto
   Sin dependencias. Todo el cálculo corre en el navegador.

   Fórmulas (todas de referencia estándar de ingeniería de radio):

   1) Pérdida en espacio libre — Free Space Path Loss
        FSPL(dB) = 32,44 + 20·log10(f_MHz) + 20·log10(d_km)

   2) Presupuesto de potencia — link budget
        EIRP(dBm) = Ptx + Gtx − Ltx
        Prx(dBm)  = Ptx + Gtx + Grx − FSPL − Ltx − Lrx − Lmisc

   3) Margen de desvanecimiento — fade margin
        FM(dB) = Prx − Sensibilidad_rx

   4) Radio de la n-ésima zona de Fresnel, en un punto de la trayectoria
        r_n(m) = 17,32 · √( n · d1 · d2 / (f_GHz · D) )      [d en km]

   5) Curvatura terrestre — earth bulge, con factor de refracción K
        h(m) = d1 · d2 / (12,74 · K)                        [d en km]

   Criterio de despeje: se exige el 60 % de la primera zona de Fresnel
   libre de obstáculos, por encima del bulto terrestre. Es la práctica
   habitual en enlaces terrestres.
   ========================================================================== */

(function () {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const num = (id) => parseFloat($(id).value);

  /* ---------------- núcleo de cálculo ---------------- */

  function fspl(fMHz, dKm) {
    return 32.44 + 20 * Math.log10(fMHz) + 20 * Math.log10(dKm);
  }

  function fresnel(n, d1, d2, fGHz, D) {
    return 17.32 * Math.sqrt((n * d1 * d2) / (fGHz * D));
  }

  function earthBulge(d1, d2, K) {
    return (d1 * d2) / (12.74 * K);
  }

  function calcular(i) {
    const D = i.dist;
    const fGHz = i.freq / 1000;

    const L = fspl(i.freq, D);
    const eirp = i.ptx + i.gtx - i.ltx;
    const prx = i.ptx + i.gtx + i.grx - L - i.ltx - i.lrx - i.lmisc;
    const fm = prx - i.sens;

    // geometría en el punto del obstáculo
    const d1 = Math.min(Math.max(i.dObs, 0.001), D - 0.001);
    const d2 = D - d1;
    const f1 = fresnel(1, d1, d2, fGHz, D);
    const bulge = earthBulge(d1, d2, i.k);

    // altura de la línea de vista sobre el obstáculo (interpolación lineal)
    const hA = i.hSitioA + i.hMastilA;
    const hB = i.hSitioB + i.hMastilB;
    const hLos = hA + (hB - hA) * (d1 / D);

    const requerido = i.hObs + bulge + 0.6 * f1;
    const despeje = hLos - requerido;

    // margen de Fresnel disponible expresado en % de F1
    const libre = hLos - i.hObs - bulge;
    const pctF1 = f1 > 0 ? (libre / f1) * 100 : 0;

    return { L, eirp, prx, fm, d1, d2, f1, bulge, hA, hB, hLos, requerido, despeje, pctF1, D, fGHz };
  }

  /* ---------------- veredicto ---------------- */

  function veredicto(r) {
    // El caso más restrictivo manda.
    const fmEstado = r.fm >= 20 ? "ok" : r.fm >= 10 ? "warn" : "err";
    const clEstado = r.pctF1 >= 60 ? "ok" : r.pctF1 >= 30 ? "warn" : "err";
    const rank = { ok: 0, warn: 1, err: 2 };
    const peor = rank[fmEstado] >= rank[clEstado] ? fmEstado : clEstado;

    let t, d;
    if (peor === "ok") {
      t = "Enlace viable";
      d = "Margen de desvanecimiento y despeje de Fresnel dentro de los valores recomendados para un enlace terrestre estable.";
    } else if (peor === "warn") {
      t = "Enlace al límite";
      d = "Funcionaría en condiciones normales, pero sin reserva suficiente ante lluvia, viento o desalineación. Revisar antes de comprometer un SLA.";
    } else {
      t = "Enlace no recomendable";
      d = "Los valores no dan reserva operativa. Corresponde revisar altura de mástil, ganancia de antena, frecuencia o trazado.";
    }
    return { estado: peor, t, d, fmEstado, clEstado };
  }

  /* ---------------- render ---------------- */

  const f = (v, dec = 2) => (Number.isFinite(v) ? v.toFixed(dec) : "—");

  function kpi(k, v, u, cls) {
    return `<div class="kpi ${cls ? "kpi--" + cls : ""}">
      <div class="kpi__k">${k}</div>
      <div class="kpi__v">${v}<span class="u">${u || ""}</span></div>
    </div>`;
  }

  function perfilSVG(r) {
    // Corte longitudinal esquemático de la trayectoria.
    const W = 700, H = 220, padX = 46, padY = 26;
    const alturas = [r.hA, r.hB, r.hObs + r.bulge + r.f1, r.hLos];
    const maxY = Math.max(...alturas) * 1.12 || 1;
    const minY = Math.min(r.hA, r.hB, r.hObs) * 0.82;
    const span = maxY - minY || 1;

    const X = (km) => padX + (km / r.D) * (W - padX * 2);
    const Y = (m) => H - padY - ((m - minY) / span) * (H - padY * 2);

    const xo = X(r.d1);
    const topObs = r.hObs + r.bulge;

    return `<svg viewBox="0 0 ${W} ${H}" role="img"
      aria-label="Perfil esquemático de la trayectoria del enlace, con obstáculo y zona de Fresnel">
      <defs>
        <linearGradient id="fz" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="var(--acc)" stop-opacity="0.20"/>
          <stop offset="100%" stop-color="var(--acc)" stop-opacity="0.02"/>
        </linearGradient>
      </defs>

      <!-- suelo -->
      <line x1="${padX}" y1="${H - padY}" x2="${W - padX}" y2="${H - padY}"
            stroke="var(--line-2)" stroke-width="1"/>

      <!-- elipse de la primera zona de Fresnel (aproximación visual) -->
      <ellipse cx="${(X(0) + X(r.D)) / 2}" cy="${(Y(r.hA) + Y(r.hB)) / 2}"
        rx="${(X(r.D) - X(0)) / 2}" ry="${Math.max(2, (r.f1 / span) * (H - padY * 2) / 2)}"
        fill="url(#fz)" stroke="var(--acc-soft)" stroke-width="1" stroke-dasharray="3 3"/>

      <!-- línea de vista -->
      <line x1="${X(0)}" y1="${Y(r.hA)}" x2="${X(r.D)}" y2="${Y(r.hB)}"
            stroke="var(--acc)" stroke-width="1.5"/>

      <!-- obstáculo + bulto terrestre -->
      <rect x="${xo - 9}" y="${Y(topObs)}" width="18" height="${Math.max(0, H - padY - Y(topObs))}"
            fill="var(--bg-600)" stroke="var(--line-2)" stroke-width="1"/>

      <!-- mástiles -->
      <line x1="${X(0)}" y1="${Y(r.hA)}" x2="${X(0)}" y2="${H - padY}" stroke="var(--ink-3)" stroke-width="1"/>
      <line x1="${X(r.D)}" y1="${Y(r.hB)}" x2="${X(r.D)}" y2="${H - padY}" stroke="var(--ink-3)" stroke-width="1"/>
      <circle cx="${X(0)}" cy="${Y(r.hA)}" r="3.5" fill="var(--acc)"/>
      <circle cx="${X(r.D)}" cy="${Y(r.hB)}" r="3.5" fill="var(--acc)"/>

      <!-- etiquetas -->
      <text x="${X(0)}" y="${H - 8}" fill="var(--ink-3)" font-size="10"
            font-family="var(--mono)" text-anchor="middle">A · 0 km</text>
      <text x="${X(r.D)}" y="${H - 8}" fill="var(--ink-3)" font-size="10"
            font-family="var(--mono)" text-anchor="middle">B · ${f(r.D, 1)} km</text>
      <text x="${xo}" y="${H - 8}" fill="var(--ink-3)" font-size="10"
            font-family="var(--mono)" text-anchor="middle">${f(r.d1, 1)} km</text>
      <text x="${X(0)}" y="${Y(r.hA) - 9}" fill="var(--ink-2)" font-size="10"
            font-family="var(--mono)" text-anchor="middle">${f(r.hA, 0)} m</text>
      <text x="${X(r.D)}" y="${Y(r.hB) - 9}" fill="var(--ink-2)" font-size="10"
            font-family="var(--mono)" text-anchor="middle">${f(r.hB, 0)} m</text>
    </svg>`;
  }

  function render(r, v, i) {
    $("verdict").dataset.estado = v.estado;
    $("verdict-t").textContent = v.t;
    $("verdict-d").textContent = v.d;

    $("kpis").innerHTML =
      kpi("FSPL", f(r.L, 1), " dB") +
      kpi("EIRP", f(r.eirp, 1), " dBm") +
      kpi("Potencia RX", f(r.prx, 1), " dBm") +
      kpi("Margen desv.", f(r.fm, 1), " dB", v.fmEstado);

    $("kpis2").innerHTML =
      kpi("1ª zona Fresnel", f(r.f1, 2), " m") +
      kpi("Despeje 60 %", f(r.despeje, 2), " m", v.clEstado) +
      kpi("Fresnel libre", f(r.pctF1, 0), " %", v.clEstado) +
      kpi("Bulto terrestre", f(r.bulge, 2), " m");

    $("detalle").innerHTML = `
      <tr><td>Distancia total del enlace</td><td class="em">${f(r.D, 3)} km</td></tr>
      <tr><td>Frecuencia</td><td class="em">${f(i.freq, 0)} MHz · ${f(r.fGHz, 3)} GHz</td></tr>
      <tr><td>Altura de antena — sitio A (msnm)</td><td class="em">${f(r.hA, 1)} m</td></tr>
      <tr><td>Altura de antena — sitio B (msnm)</td><td class="em">${f(r.hB, 1)} m</td></tr>
      <tr><td>Línea de vista sobre el obstáculo</td><td class="em">${f(r.hLos, 2)} m</td></tr>
      <tr><td>Cota requerida (obstáculo + bulto + 0,6·F1)</td><td class="em">${f(r.requerido, 2)} m</td></tr>
      <tr><td>Distancia al obstáculo (d1 / d2)</td><td class="em">${f(r.d1, 2)} / ${f(r.d2, 2)} km</td></tr>
      <tr><td>Pérdidas totales de línea y varios</td><td class="em">${f(i.ltx + i.lrx + i.lmisc, 2)} dB</td></tr>
      <tr><td>Sensibilidad del receptor</td><td class="em">${f(i.sens, 1)} dBm</td></tr>
      <tr><td>Factor de refracción K</td><td class="em">${f(i.k, 3)}</td></tr>`;

    $("perfil").innerHTML = perfilSVG(r);
  }

  /* ---------------- entrada y validación ---------------- */

  const CAMPOS = ["freq", "dist", "ptx", "gtx", "grx", "ltx", "lrx", "lmisc",
                  "sens", "k", "dObs", "hObs", "hSitioA", "hMastilA", "hSitioB", "hMastilB"];

  function leer() {
    const i = {};
    let ok = true;
    for (const c of CAMPOS) {
      const v = num(c);
      const malo = !Number.isFinite(v);
      $(c).setAttribute("aria-invalid", malo ? "true" : "false");
      if (malo) ok = false;
      i[c] = v;
    }
    // restricciones físicas
    if (i.freq <= 0 || i.dist <= 0 || i.k <= 0) ok = false;
    if (i.dObs <= 0 || i.dObs >= i.dist) {
      $("dObs").setAttribute("aria-invalid", "true");
      ok = false;
    }
    return ok ? i : null;
  }

  function actualizar() {
    const i = leer();
    if (!i) {
      $("verdict").dataset.estado = "err";
      $("verdict-t").textContent = "Datos incompletos o inconsistentes";
      $("verdict-d").textContent =
        "Revisá los campos marcados. La distancia al obstáculo tiene que ser mayor que 0 y menor que la distancia total del enlace.";
      return;
    }
    const r = calcular(i);
    render(r, veredicto(r), i);
  }

  /* ---------------- escenarios de ejemplo ---------------- */

  const PRESETS = {
    "5ghz-10km": { freq: 5800, dist: 10, ptx: 25, gtx: 24, grx: 24, ltx: 0.5, lrx: 0.5,
                   lmisc: 2, sens: -83, k: 1.333, dObs: 5, hObs: 1200,
                   hSitioA: 1180, hMastilA: 30, hSitioB: 1190, hMastilB: 30 },
    "5ghz-cerro": { freq: 5500, dist: 24, ptx: 27, gtx: 30, grx: 30, ltx: 0.6, lrx: 0.6,
                    lmisc: 3, sens: -87, k: 1.333, dObs: 11, hObs: 1465,
                    hSitioA: 1400, hMastilA: 40, hSitioB: 1520, hMastilB: 24 },
    "60ghz-corto": { freq: 60000, dist: 0.6, ptx: 10, gtx: 38, grx: 38, ltx: 0.2, lrx: 0.2,
                     lmisc: 1, sens: -62, k: 1.333, dObs: 0.3, hObs: 1201.8,
                     hSitioA: 1190, hMastilA: 12, hSitioB: 1191, hMastilB: 12 },
    "critico": { freq: 5800, dist: 18, ptx: 20, gtx: 16, grx: 16, ltx: 1.5, lrx: 1.5,
                 lmisc: 3, sens: -74, k: 1.333, dObs: 9, hObs: 1215,
                 hSitioA: 1200, hMastilA: 15, hSitioB: 1205, hMastilB: 15 }
  };

  function aplicar(nombre) {
    const p = PRESETS[nombre];
    if (!p) return;
    for (const [k, v] of Object.entries(p)) if ($(k)) $(k).value = v;
    actualizar();
  }

  /* ---------------- arranque ---------------- */

  document.addEventListener("DOMContentLoaded", function () {
    if (!$("freq")) return;   // no estamos en la página de la herramienta

    CAMPOS.forEach((c) => {
      const el = $(c);
      if (el) { el.addEventListener("input", actualizar); el.addEventListener("change", actualizar); }
    });

    document.querySelectorAll("[data-preset]").forEach((b) =>
      b.addEventListener("click", () => aplicar(b.dataset.preset))
    );

    const copiar = $("copiar");
    if (copiar) {
      copiar.addEventListener("click", async () => {
        const i = leer();
        if (!i) return;
        const r = calcular(i);
        const txt = [
          "CALCULO DE RADIOENLACE",
          `Frecuencia            ${f(i.freq, 0)} MHz`,
          `Distancia             ${f(r.D, 3)} km`,
          `FSPL                  ${f(r.L, 2)} dB`,
          `EIRP                  ${f(r.eirp, 2)} dBm`,
          `Potencia recibida     ${f(r.prx, 2)} dBm`,
          `Sensibilidad RX       ${f(i.sens, 1)} dBm`,
          `Margen desvanecim.    ${f(r.fm, 2)} dB`,
          `1a zona de Fresnel    ${f(r.f1, 2)} m  (en d1 = ${f(r.d1, 2)} km)`,
          `Bulto terrestre (K=${f(i.k, 3)})  ${f(r.bulge, 2)} m`,
          `Despeje sobre 60% F1  ${f(r.despeje, 2)} m`,
          `Fresnel libre         ${f(r.pctF1, 0)} %`,
          "",
          "Formulas: FSPL = 32,44 + 20log10(f_MHz) + 20log10(d_km)",
          "          F1   = 17,32 * raiz(d1*d2/(f_GHz*D))",
          "          bulto = d1*d2/(12,74*K)"
        ].join("\n");
        try {
          await navigator.clipboard.writeText(txt);
          copiar.textContent = "Copiado";
          setTimeout(() => (copiar.textContent = "Copiar resultado"), 1600);
        } catch (e) {
          copiar.textContent = "No se pudo copiar";
          setTimeout(() => (copiar.textContent = "Copiar resultado"), 1600);
        }
      });
    }

    aplicar("5ghz-10km");
  });
})();
