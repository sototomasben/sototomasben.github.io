/* ==========================================================================
   Calculadora de subneteo IPv4 y asignación VLSM
   Sin dependencias. Aritmética de 32 bits con enteros sin signo.

   Notas de implementación:
   · Se usa >>> 0 en cada operación para forzar interpretación sin signo.
     En JavaScript los operadores bit a bit trabajan con enteros de 32 bits
     con signo, así que sin eso una red como 200.x.x.x devuelve negativos.
   · /31 se trata según RFC 3021 (2 direcciones utilizables en enlaces
     punto a punto) y /32 como host único.
   · En la asignación VLSM el uso de /31 es OPCIONAL y está expuesto como
     casilla en la interfaz. Por defecto está desactivado y los enlaces de
     2 hosts reciben /30, que es lo universalmente compatible. Activarlo
     sigue RFC 3021: correcto en equipamiento moderno, puede romper en
     stacks antiguos. La decisión es del operador, no de la herramienta.
   ========================================================================== */

(function () {
  "use strict";

  const $ = (id) => document.getElementById(id);

  /* ---------------- utilidades de 32 bits ---------------- */

  function ipToInt(s) {
    const p = s.trim().split(".");
    if (p.length !== 4) return null;
    let n = 0;
    for (const o of p) {
      if (!/^\d{1,3}$/.test(o)) return null;
      const v = parseInt(o, 10);
      if (v < 0 || v > 255) return null;
      n = (n << 8) | v;
    }
    return n >>> 0;
  }

  const intToIp = (n) =>
    [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join(".");

  const maskOf = (p) => (p === 0 ? 0 : (0xffffffff << (32 - p)) >>> 0);

  function prefixFromMask(s) {
    const n = ipToInt(s);
    if (n === null) return null;
    // una máscara válida es un bloque de unos seguido de ceros
    const inv = (~n) >>> 0;
    if (((inv + 1) & inv) !== 0) return null;
    let p = 0, x = n;
    while (x) { p += x & 1; x >>>= 1; }
    return p;
  }

  const toBin = (n) =>
    [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255]
      .map((o) => o.toString(2).padStart(8, "0"))
      .join(".");

  /* ---------------- clasificación ---------------- */

  function claseDe(n) {
    const a = (n >>> 24) & 255;
    if (a < 128) return "A";
    if (a < 192) return "B";
    if (a < 224) return "C";
    if (a < 240) return "D (multicast)";
    return "E (reservada)";
  }

  const RANGOS = [
    { cidr: "10.0.0.0/8",       tipo: "Privada (RFC 1918)" },
    { cidr: "172.16.0.0/12",    tipo: "Privada (RFC 1918)" },
    { cidr: "192.168.0.0/16",   tipo: "Privada (RFC 1918)" },
    { cidr: "100.64.0.0/10",    tipo: "CGNAT (RFC 6598)" },
    { cidr: "169.254.0.0/16",   tipo: "Link-local (RFC 3927)" },
    { cidr: "127.0.0.0/8",      tipo: "Loopback" },
    { cidr: "224.0.0.0/4",      tipo: "Multicast" },
    { cidr: "0.0.0.0/8",        tipo: "Reservada — esta red" }
  ];

  function ambitoDe(n) {
    for (const r of RANGOS) {
      const [ip, p] = r.cidr.split("/");
      const base = ipToInt(ip), pref = parseInt(p, 10);
      if ((n & maskOf(pref)) >>> 0 === base) return r.tipo;
    }
    return "Pública";
  }

  /* ---------------- cálculo de subred ---------------- */

  function subred(ipInt, prefijo) {
    const m = maskOf(prefijo);
    const net = (ipInt & m) >>> 0;
    const bc = (net | (~m >>> 0)) >>> 0;
    const total = Math.pow(2, 32 - prefijo);

    let first, last, usables;
    if (prefijo === 32) { first = last = net; usables = 1; }
    else if (prefijo === 31) { first = net; last = bc; usables = 2; }
    else { first = (net + 1) >>> 0; last = (bc - 1) >>> 0; usables = total - 2; }

    return {
      prefijo, mascara: m, red: net, broadcast: bc,
      primero: first, ultimo: last, total, usables,
      wildcard: (~m) >>> 0
    };
  }

  /* ---------------- VLSM ---------------- */

  function prefijoPara(hosts, permitir31) {
    // Menor prefijo cuyo bloque aloja los hosts pedidos.
    // Si no se permite /31, el mínimo es /30: es la opción universalmente
    // compatible para enlaces punto a punto. Con /31 activado se sigue
    // RFC 3021, que es lo correcto en equipamiento moderno pero rompe en
    // stacks antiguos.
    const desde = permitir31 ? 32 : 30;
    for (let p = desde; p >= 0; p--) {
      const s = subred(0, p);
      if (s.usables >= hosts) return p;
    }
    return null;
  }

  function vlsm(baseIp, basePref, pedidos, permitir31) {
    const base = subred(baseIp, basePref);
    // el orden descendente es lo que evita fragmentación
    const orden = pedidos
      .map((p, idx) => ({ ...p, idx }))
      .sort((a, b) => b.hosts - a.hosts);

    let cursor = base.red;
    const fin = base.broadcast;
    const out = [];
    let error = null;

    for (const p of orden) {
      const pref = prefijoPara(p.hosts, permitir31);
      if (pref === null) { error = `"${p.nombre}" pide más hosts que un /0.`; break; }

      const tam = Math.pow(2, 32 - pref);
      // alineación: toda subred arranca en un múltiplo de su tamaño
      const alineado = Math.ceil(cursor / tam) * tam;
      if (alineado + tam - 1 > fin) {
        error = `No queda espacio para "${p.nombre}" (/${pref}, ${tam} direcciones) dentro de ${intToIp(base.red)}/${basePref}.`;
        break;
      }
      const s = subred(alineado >>> 0, pref);
      out.push({ ...p, pref, s, desperdicio: s.usables - p.hosts });
      cursor = (alineado + tam) >>> 0;
    }

    const usadas = out.reduce((a, r) => a + r.s.total, 0);
    return { base, filas: out, error, usadas, libres: base.total - usadas };
  }

  /* ---------------- parseo de la entrada ---------------- */

  function leerBase() {
    const raw = $("cidr").value.trim();
    let ipTxt = raw, pref = null;

    if (raw.includes("/")) {
      const [a, b] = raw.split("/");
      ipTxt = a.trim();
      pref = /^\d{1,2}$/.test(b.trim()) ? parseInt(b.trim(), 10) : null;
    } else {
      pref = prefixFromMask($("mask").value);
    }

    const ip = ipToInt(ipTxt);
    const valido = ip !== null && pref !== null && pref >= 0 && pref <= 32;
    $("cidr").setAttribute("aria-invalid", valido ? "false" : "true");
    return valido ? { ip, pref } : null;
  }

  function leerPedidos() {
    const lineas = $("reqs").value.split("\n");
    const out = [];
    for (const l of lineas) {
      const t = l.trim();
      if (!t) continue;
      // formatos aceptados:  "Nombre: 50"   |   "Nombre 50"   |   "50"
      const m = t.match(/^(.*?)[\s:=]+(\d+)$/) || t.match(/^(\d+)$/);
      if (!m) continue;
      if (m.length === 2) out.push({ nombre: `Segmento ${out.length + 1}`, hosts: parseInt(m[1], 10) });
      else out.push({ nombre: m[1].trim() || `Segmento ${out.length + 1}`, hosts: parseInt(m[2], 10) });
    }
    return out.filter((p) => p.hosts > 0);
  }

  /* ---------------- render ---------------- */

  function kpi(k, v, cls) {
    return `<div class="kpi ${cls ? "kpi--" + cls : ""}">
      <div class="kpi__k">${k}</div><div class="kpi__v">${v}</div></div>`;
  }

  function render() {
    const b = leerBase();
    if (!b) {
      $("verdict").dataset.estado = "err";
      $("verdict-t").textContent = "Dirección o máscara inválida";
      $("verdict-d").textContent =
        "Escribí una dirección en notación CIDR (por ejemplo 192.168.10.0/24) o completá la máscara en formato decimal punteado.";
      $("kpis").innerHTML = "";
      $("detalle").innerHTML = "";
      $("vlsm-body").innerHTML = "";
      return;
    }

    const s = subred(b.ip, b.pref);
    const ambito = ambitoDe(s.red);

    $("verdict").dataset.estado = "ok";
    $("verdict-t").textContent = `${intToIp(s.red)}/${s.prefijo} · ${ambito}`;
    $("verdict-d").textContent =
      s.prefijo === 31
        ? "Prefijo /31: según RFC 3021 se usan las 2 direcciones para enlaces punto a punto, sin red ni broadcast."
        : s.prefijo === 32
          ? "Prefijo /32: host único, típico de loopbacks y rutas específicas."
          : `Bloque de ${s.total.toLocaleString("es-AR")} direcciones, ${s.usables.toLocaleString("es-AR")} utilizables para hosts.`;

    $("kpis").innerHTML =
      kpi("Red", intToIp(s.red)) +
      kpi("Máscara", intToIp(s.mascara)) +
      kpi("Broadcast", s.prefijo >= 31 ? "—" : intToIp(s.broadcast)) +
      kpi("Hosts útiles", s.usables.toLocaleString("es-AR"), "ok");

    $("detalle").innerHTML = `
      <tr><td>Notación CIDR</td><td class="em">${intToIp(s.red)}/${s.prefijo}</td></tr>
      <tr><td>Máscara de subred</td><td class="em">${intToIp(s.mascara)}</td></tr>
      <tr><td>Máscara wildcard</td><td class="em">${intToIp(s.wildcard)}</td></tr>
      <tr><td>Primer host utilizable</td><td class="em">${intToIp(s.primero)}</td></tr>
      <tr><td>Último host utilizable</td><td class="em">${intToIp(s.ultimo)}</td></tr>
      <tr><td>Direcciones totales</td><td class="em">${s.total.toLocaleString("es-AR")}</td></tr>
      <tr><td>Clase histórica</td><td class="em">${claseDe(s.red)}</td></tr>
      <tr><td>Ámbito</td><td class="em">${ambito}</td></tr>
      <tr><td>Red en binario</td><td class="em">${toBin(s.red)}</td></tr>
      <tr><td>Máscara en binario</td><td class="em">${toBin(s.mascara)}</td></tr>`;

    // ---- VLSM ----
    const pedidos = leerPedidos();
    if (!pedidos.length) {
      $("vlsm-body").innerHTML =
        `<tr><td colspan="7" style="white-space:normal;color:var(--ink-3)">
          Escribí los segmentos a la izquierda, uno por línea, con el formato <code>Nombre: cantidad de hosts</code>.
        </td></tr>`;
      $("vlsm-foot").textContent = "";
      return;
    }

    const v = vlsm(b.ip, b.pref, pedidos, $("p2p31").checked);
    $("vlsm-body").innerHTML = v.filas.map((r) => `
      <tr>
        <td class="em">${r.nombre}</td>
        <td>${r.hosts}</td>
        <td class="em">${intToIp(r.s.red)}/${r.pref}</td>
        <td>${intToIp(r.s.mascara)}</td>
        <td>${r.pref >= 31 ? intToIp(r.s.primero) : intToIp(r.s.primero)} – ${intToIp(r.s.ultimo)}</td>
        <td>${r.pref >= 31 ? "—" : intToIp(r.s.broadcast)}</td>
        <td>${r.desperdicio}</td>
      </tr>`).join("");

    const pct = v.base.total ? ((v.usadas / v.base.total) * 100).toFixed(1) : "0";
    $("vlsm-foot").innerHTML = v.error
      ? `<span style="color:var(--err)">${v.error}</span>`
      : `Asignadas ${v.usadas.toLocaleString("es-AR")} de ${v.base.total.toLocaleString("es-AR")} direcciones (${pct} %). Quedan ${v.libres.toLocaleString("es-AR")} libres. Las subredes se asignan de mayor a menor para evitar fragmentación. " +
        `Enlaces punto a punto: ${$("p2p31").checked ? "/31 según RFC 3021" : "/30 (máxima compatibilidad)"}.`;
  }

  /* ---------------- escenarios ---------------- */

  const PRESETS = {
    "campus": {
      cidr: "192.168.0.0/22", mask: "255.255.252.0",
      reqs: "Oficinas: 300\nWiFi corporativa: 200\nVoIP: 100\nCCTV: 60\nServidores: 25\nGestión de red: 12\nEnlace WAN: 2"
    },
    "isp": {
      cidr: "10.20.0.0/16", mask: "255.255.0.0",
      reqs: "Clientes zona norte: 4000\nClientes zona sur: 2000\nBackbone: 500\nGestión de OLT: 120\nNOC: 30\nLoopbacks: 2"
    },
    "sitio": {
      cidr: "172.16.8.0/24", mask: "255.255.255.0",
      reqs: "Datos: 100\nCCTV: 40\nSCADA: 20\nGestión: 10\nP2P al POP: 2"
    }
  };

  function aplicar(n) {
    const p = PRESETS[n];
    if (!p) return;
    $("cidr").value = p.cidr;
    $("mask").value = p.mask;
    $("reqs").value = p.reqs;
    render();
  }

  /* ---------------- arranque ---------------- */

  document.addEventListener("DOMContentLoaded", function () {
    if (!$("cidr")) return;

    ["cidr", "mask", "reqs", "p2p31"].forEach((id) => {
      const el = $(id);
      if (el) el.addEventListener(id === "p2p31" ? "change" : "input", render);
    });
    document.querySelectorAll("[data-preset]").forEach((b) =>
      b.addEventListener("click", () => aplicar(b.dataset.preset))
    );

    const exp = $("exportar");
    if (exp) {
      exp.addEventListener("click", () => {
        const b = leerBase();
        if (!b) return;
        const v = vlsm(b.ip, b.pref, leerPedidos(), $("p2p31").checked);
        const filas = [["segmento", "hosts_pedidos", "cidr", "mascara", "primer_host", "ultimo_host", "broadcast", "desperdicio"]];
        for (const r of v.filas) {
          filas.push([r.nombre, r.hosts, `${intToIp(r.s.red)}/${r.pref}`, intToIp(r.s.mascara),
                      intToIp(r.s.primero), intToIp(r.s.ultimo),
                      r.pref >= 31 ? "" : intToIp(r.s.broadcast), r.desperdicio]);
        }
        const csv = filas.map((f) => f.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\r\n");
        const url = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
        const a = document.createElement("a");
        a.href = url;
        a.download = `plan-direccionamiento-${intToIp(v.base.red).replace(/\./g, "-")}-${b.pref}.csv`;
        a.click();
        URL.revokeObjectURL(url);
      });
    }

    aplicar("campus");
  });
})();
