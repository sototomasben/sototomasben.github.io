#!/usr/bin/env python3
"""
Generador del sitio estático.

Lee los YAML de data/, los pasa por las plantillas de templates/ y escribe
HTML plano en dist/. No hay backend, no hay build de JavaScript, no hay
dependencias de front-end: el resultado se puede servir desde cualquier
lugar que devuelva archivos.

Uso:
    python build.py              genera el sitio
    python build.py --clean      borra dist/ y genera de cero
    python build.py --check      valida los datos y sale sin escribir nada

Estructura de salida:
    dist/
      index.html
      trayectoria.html
      herramientas.html
      casos.html
      herramientas/<slug>.html
      casos/<slug>.html
      static/...
"""

from __future__ import annotations

import argparse
import shutil
import sys
import time
from pathlib import Path

import yaml
from jinja2 import Environment, FileSystemLoader, StrictUndefined

RAIZ = Path(__file__).parent.resolve()
DATA = RAIZ / "data"
TEMPLATES = RAIZ / "templates"
STATIC = RAIZ / "static"
DIST = RAIZ / "dist"

# Archivos que se copian tal cual a la raíz de dist/ si existen.
#
# IMPORTANTE: acá van SOLO nombres de archivo, nunca rutas completas.
# El build los busca en la raíz del proyecto (al lado de build.py) y los
# copia a dist/. Una ruta tipo  C:\Users\...  hace dos cosas malas:
#   1. Python la interpreta como escapes (\U, \L) y el archivo no compila.
#   2. Aunque compilara, el proyecto deja de ser portable.
# El PDF del CV NO va acá: su nombre se define en data/site.yaml (cv.archivo)
# y el build lo agrega a esta lista en tiempo de ejecución. Una sola fuente
# de verdad evita que el botón de descarga apunte a un archivo inexistente.
ADJUNTOS = ["robots.txt", "favicon.ico", "CNAME"]

VERDE = "\033[32m"
AMARILLO = "\033[33m"
ROJO = "\033[31m"
GRIS = "\033[90m"
FIN = "\033[0m"


# ---------------------------------------------------------------- datos


def cargar_datos() -> dict:
    """Carga todos los .yaml de data/ en un dict indexado por nombre de archivo."""
    if not DATA.is_dir():
        raise SystemExit(f"{ROJO}No existe el directorio data/{FIN}")

    datos: dict = {}
    for archivo in sorted(DATA.glob("*.yaml")):
        with archivo.open(encoding="utf-8") as fh:
            contenido = yaml.safe_load(fh) or {}
        datos[archivo.stem] = contenido
    return datos


def validar(d: dict) -> list[str]:
    """Chequeos mínimos de integridad. Mejor fallar en el build que en producción."""
    errores: list[str] = []

    requeridos = ["site", "perfil", "experiencia", "educacion", "tecnologias", "casos", "herramientas"]
    for r in requeridos:
        if r not in d:
            errores.append(f"Falta data/{r}.yaml")
    if errores:
        return errores

    if not d["site"].get("nombre"):
        errores.append("site.yaml: falta 'nombre'")
    if not d["site"].get("nav"):
        errores.append("site.yaml: falta 'nav'")

    # slugs únicos y utilizables como nombre de archivo
    for clave, lista in (("casos", d["casos"].get("casos", [])),
                         ("herramientas", d["herramientas"].get("herramientas", []))):
        vistos = set()
        for item in lista:
            slug = item.get("slug", "")
            if not slug:
                errores.append(f"{clave}.yaml: hay un item sin 'slug'")
            elif slug in vistos:
                errores.append(f"{clave}.yaml: slug duplicado '{slug}'")
            elif not all(c.isalnum() or c == "-" for c in slug):
                errores.append(f"{clave}.yaml: slug inválido '{slug}' (solo alfanuméricos y guiones)")
            vistos.add(slug)

    # cada herramienta necesita su plantilla
    for h in d["herramientas"].get("herramientas", []):
        plantilla = TEMPLATES / f"tool_{h.get('slug', '')}.html"
        if not plantilla.exists():
            errores.append(f"Falta la plantilla templates/tool_{h.get('slug')}.html")

    # bullets de experiencia no vacíos
    for p in d["experiencia"].get("puestos", []):
        if not p.get("bullets"):
            errores.append(f"experiencia.yaml: el puesto '{p.get('rol')}' no tiene bullets")

    # el PDF del CV declarado en site.yaml tiene que existir en la raíz
    cv = (d["site"].get("cv") or {}).get("archivo", "")
    if not cv:
        errores.append("site.yaml: falta 'cv.archivo'")
    elif not (RAIZ / cv).exists():
        errores.append(f"Falta el archivo '{cv}' en la raíz del proyecto "
                       f"(declarado en site.yaml como cv.archivo). "
                       f"Sin él el botón de descarga queda roto.")

    # las métricas de casos deben ser lista (vacía si no hay datos medidos)
    for c in d["casos"].get("casos", []):
        if not isinstance(c.get("metricas", []), list):
            errores.append(f"casos.yaml: '{c.get('slug')}' — 'metricas' tiene que ser una lista")

    return errores


# ---------------------------------------------------------------- render


def entorno() -> Environment:
    env = Environment(
        loader=FileSystemLoader(str(TEMPLATES)),
        autoescape=True,               # escapado por defecto: es un sitio público
        undefined=StrictUndefined,     # una variable mal escrita rompe el build, no pasa silenciosa
        trim_blocks=True,
        lstrip_blocks=True,
        keep_trailing_newline=True,
    )
    env.filters["nl2br"] = lambda s: str(s).replace("\n", "<br>")
    return env


def escribir(destino: Path, html: str) -> None:
    destino.parent.mkdir(parents=True, exist_ok=True)
    destino.write_text(html, encoding="utf-8")


def construir(d: dict, env: Environment) -> list[str]:
    """Renderiza todas las páginas. Devuelve la lista de rutas escritas."""
    site = d["site"]
    base_url = (site.get("base_url") or "").rstrip("/")
    base = f"{base_url}/" if base_url else ""

    # contexto compartido por todas las plantillas
    comun = {
        "site": site,
        "perfil": d["perfil"],
        "experiencia": d["experiencia"],
        "educacion": d["educacion"],
        "tecnologias": d["tecnologias"],
        "casos": d["casos"]["casos"],
        "herramientas": d["herramientas"]["herramientas"],
        "base": base,
        "titulo": None,
        "descripcion": None,
        "pagina": "index.html",
    }

    escritas: list[str] = []

    # --- páginas de primer nivel ---
    for plantilla, salida, titulo in [
        ("index.html", "index.html", None),
        ("trayectoria.html", "trayectoria.html", "Trayectoria"),
        ("herramientas.html", "herramientas.html", "Herramientas"),
        ("casos.html", "casos.html", "Casos de estudio"),
    ]:
        ctx = {**comun, "pagina": salida, "titulo": titulo}
        escribir(DIST / salida, env.get_template(plantilla).render(**ctx))
        escritas.append(salida)

    # --- una página por herramienta ---
    # Las rutas anidadas necesitan subir un nivel para alcanzar static/.
    base_sub = base if base else "../"
    for h in comun["herramientas"]:
        ctx = {**comun, "base": base_sub, "herramienta": h}
        salida = f"herramientas/{h['slug']}.html"
        escribir(DIST / salida, env.get_template(f"tool_{h['slug']}.html").render(**ctx))
        escritas.append(salida)

    # --- una página por caso ---
    for c in comun["casos"]:
        ctx = {**comun, "base": base_sub, "caso": c}
        salida = f"casos/{c['slug']}.html"
        escribir(DIST / salida, env.get_template("caso.html").render(**ctx))
        escritas.append(salida)

    # --- limpieza de huérfanos ---
    # Si borrás un caso o una herramienta del YAML, su HTML quedaba en dist/
    # y seguía siendo accesible por URL directa aunque ya no figurara en el
    # menú. En un build limpio de CI no pasa, pero en local sí, y es la clase
    # de página que uno cree eliminada y sigue publicada.
    for carpeta, vigentes in (("casos", {c["slug"] for c in comun["casos"]}),
                              ("herramientas", {h["slug"] for h in comun["herramientas"]})):
        d = DIST / carpeta
        if not d.is_dir():
            continue
        for archivo in d.glob("*.html"):
            if archivo.stem not in vigentes:
                try:
                    archivo.unlink()
                    print(f"{AMARILLO}·{FIN} huérfano eliminado: {carpeta}/{archivo.name}")
                except OSError as exc:
                    print(f"{AMARILLO}·{FIN} no se pudo eliminar {carpeta}/{archivo.name}: {exc.strerror}")

    # --- estáticos ---
    # dirs_exist_ok sobrescribe en el lugar en vez de borrar y recrear:
    # así el build no depende de tener permiso de unlink, que es justo lo
    # que falta en montajes de red, WSL sobre /mnt y carpetas de OneDrive.
    # copyfile copia solo contenido, sin permisos ni metadatos (copy2 y copy
    # intentan chmod y fallan en esos mismos montajes).
    destino_static = DIST / "static"
    shutil.copytree(STATIC, destino_static, dirs_exist_ok=True,
                    copy_function=shutil.copyfile)
    escritas.append("static/")

    # --- adjuntos ---
    # El PDF del CV sale de site.yaml; el resto son extras opcionales.
    cv_pdf = (site.get("cv") or {}).get("archivo", "")
    for nombre in ([cv_pdf] if cv_pdf else []) + ADJUNTOS:
        origen = RAIZ / nombre
        if origen.exists():
            shutil.copyfile(origen, DIST / nombre)
            escritas.append(nombre)

    # --- sitemap y robots ---
    canonical = site.get("canonical", "").rstrip("/")
    if canonical:
        urls = [u for u in escritas if u.endswith(".html")]
        cuerpo = "\n".join(
            f"  <url><loc>{canonical}/{u}</loc></url>" for u in sorted(urls)
        )
        escribir(
            DIST / "sitemap.xml",
            '<?xml version="1.0" encoding="UTF-8"?>\n'
            '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
            f"{cuerpo}\n</urlset>\n",
        )
        escritas.append("sitemap.xml")

        # Se regenera siempre, salvo que exista un robots.txt propio en la raíz
        # del proyecto (en ese caso lo copia ADJUNTOS y respetamos el del autor).
        # Antes se chequeaba dist/robots.txt, que es la salida: quedaba pegado con
        # el dominio viejo para siempre.
        if not (RAIZ / "robots.txt").exists():
            escribir(DIST / "robots.txt",
                     f"User-agent: *\nAllow: /\nSitemap: {canonical}/sitemap.xml\n")
            escritas.append("robots.txt")

    # GitHub Pages: evita que Jekyll procese el output
    escribir(DIST / ".nojekyll", "")

    return escritas


# ---------------------------------------------------------------- cli


def main() -> int:
    ap = argparse.ArgumentParser(description="Genera el sitio estático del portafolio.")
    ap.add_argument("--clean", action="store_true", help="borra dist/ antes de generar")
    ap.add_argument("--check", action="store_true", help="solo valida los datos, no escribe")
    args = ap.parse_args()

    t0 = time.perf_counter()

    datos = cargar_datos()
    errores = validar(datos)
    if errores:
        print(f"{ROJO}Validación fallida:{FIN}")
        for e in errores:
            print(f"  · {e}")
        return 1

    print(f"{VERDE}✓{FIN} datos válidos "
          f"{GRIS}({len(datos)} archivos YAML){FIN}")

    if args.check:
        return 0

    if args.clean and DIST.exists():
        try:
            shutil.rmtree(DIST)
            print(f"{AMARILLO}·{FIN} dist/ eliminado")
        except PermissionError as exc:
            # No abortamos: el build sobrescribe igual. Solo avisamos.
            print(f"{AMARILLO}·{FIN} no se pudo vaciar dist/ ({exc.strerror}); "
                  f"se sobrescribe en el lugar")

    escritas = construir(datos, entorno())
    ms = (time.perf_counter() - t0) * 1000

    print(f"{VERDE}✓{FIN} sitio generado en {GRIS}dist/{FIN} "
          f"— {len([e for e in escritas if e.endswith('.html')])} páginas "
          f"{GRIS}({ms:.0f} ms){FIN}")
    for e in escritas:
        print(f"  {GRIS}{e}{FIN}")
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception as exc:  # noqa: BLE001
        print(f"{ROJO}Error: {exc}{FIN}", file=sys.stderr)
        sys.exit(1)
