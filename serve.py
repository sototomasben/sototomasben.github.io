#!/usr/bin/env python3
"""
Servidor de desarrollo con recarga automática.

Genera el sitio, lo sirve en http://localhost:8000 y vuelve a generar cada
vez que cambia un archivo de data/, templates/ o static/. Las páginas se
recargan solas: se inyecta un script mínimo que consulta un endpoint de
versión.

Uso:
    python serve.py
    python serve.py --puerto 3000 --sin-recarga

Cortá con Ctrl+C.
"""

from __future__ import annotations

import argparse
import http.server
import socketserver
import threading
import time
import webbrowser
from functools import partial
from pathlib import Path

from watchfiles import watch

import build

RAIZ = Path(__file__).parent.resolve()
DIST = RAIZ / "dist"
OBSERVAR = [RAIZ / "data", RAIZ / "templates", RAIZ / "static"]

VERDE = "\033[32m"
CIAN = "\033[36m"
ROJO = "\033[31m"
GRIS = "\033[90m"
FIN = "\033[0m"

# Se incrementa en cada rebuild. El navegador lo consulta para saber si recargar.
VERSION = {"n": 0}

SNIPPET = """
<script>
/* recarga automática — solo en desarrollo, no se incluye en el build de producción */
(function () {
  var actual = null;
  setInterval(function () {
    fetch("/__version", { cache: "no-store" })
      .then(function (r) { return r.text(); })
      .then(function (v) {
        if (actual === null) { actual = v; return; }
        if (v !== actual) location.reload();
      })
      .catch(function () {});
  }, 700);
})();
</script>
"""


class Handler(http.server.SimpleHTTPRequestHandler):
    """Sirve dist/, inyecta el snippet de recarga y expone /__version."""

    def __init__(self, *a, recarga: bool = True, **kw):
        self.recarga = recarga
        super().__init__(*a, directory=str(DIST), **kw)

    def log_message(self, fmt, *args):  # silencio, salvo errores
        if not str(args[1] if len(args) > 1 else "").startswith(("2", "3")):
            print(f"{GRIS}  {self.path} → {args[1] if len(args) > 1 else '?'}{FIN}")

    def do_GET(self):  # noqa: N802
        if self.path == "/__version":
            cuerpo = str(VERSION["n"]).encode()
            self.send_response(200)
            self.send_header("Content-Type", "text/plain")
            self.send_header("Content-Length", str(len(cuerpo)))
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            self.wfile.write(cuerpo)
            return

        # inyección del snippet en las páginas HTML
        if self.recarga and (self.path.endswith(".html") or self.path.endswith("/")):
            rel = self.path.lstrip("/") or "index.html"
            if rel.endswith("/"):
                rel += "index.html"
            archivo = DIST / rel
            if archivo.is_file():
                html = archivo.read_text(encoding="utf-8")
                html = html.replace("</body>", SNIPPET + "</body>")
                cuerpo = html.encode("utf-8")
                self.send_response(200)
                self.send_header("Content-Type", "text/html; charset=utf-8")
                self.send_header("Content-Length", str(len(cuerpo)))
                self.send_header("Cache-Control", "no-store")
                self.end_headers()
                self.wfile.write(cuerpo)
                return

        super().do_GET()


class Servidor(socketserver.ThreadingTCPServer):
    allow_reuse_address = True
    daemon_threads = True


def regenerar() -> bool:
    try:
        datos = build.cargar_datos()
        errores = build.validar(datos)
        if errores:
            print(f"{ROJO}✗ validación:{FIN}")
            for e in errores:
                print(f"  · {e}")
            return False
        build.construir(datos, build.entorno())
        VERSION["n"] += 1
        print(f"{VERDE}✓{FIN} regenerado {GRIS}#{VERSION['n']} · {time.strftime('%H:%M:%S')}{FIN}")
        return True
    except Exception as exc:  # noqa: BLE001
        print(f"{ROJO}✗ {type(exc).__name__}: {exc}{FIN}")
        return False


def vigilar():
    rutas = [str(p) for p in OBSERVAR if p.exists()]
    for _ in watch(*rutas, debounce=200, step=80):
        regenerar()


def main() -> int:
    ap = argparse.ArgumentParser(description="Servidor de desarrollo con recarga.")
    ap.add_argument("--puerto", type=int, default=8000)
    ap.add_argument("--sin-recarga", action="store_true", help="no inyectar el script de recarga")
    ap.add_argument("--sin-navegador", action="store_true", help="no abrir el navegador")
    args = ap.parse_args()

    print(f"{CIAN}Build inicial…{FIN}")
    if not regenerar():
        print(f"{ROJO}Corregí los errores y volvé a intentar.{FIN}")
        return 1

    threading.Thread(target=vigilar, daemon=True).start()

    handler = partial(Handler, recarga=not args.sin_recarga)
    url = f"http://localhost:{args.puerto}"

    with Servidor(("", args.puerto), handler) as srv:
        print(f"\n  {CIAN}▸{FIN} {url}")
        print(f"  {GRIS}vigilando data/ templates/ static/ · Ctrl+C para salir{FIN}\n")
        if not args.sin_navegador:
            threading.Timer(0.6, lambda: webbrowser.open(url)).start()
        try:
            srv.serve_forever()
        except KeyboardInterrupt:
            print(f"\n{GRIS}Servidor detenido.{FIN}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
