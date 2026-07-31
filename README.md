# Portafolio — Tomás Benjamín Soto

Sitio estático generado con Python. Los datos viven en YAML, las plantillas en
Jinja2 y el front-end es HTML, CSS y JavaScript sin una sola dependencia.

**La idea central:** el sitio no es una copia del CV. Un reclutador ya tiene el PDF.
Lo que el sitio hace y el PDF no puede es **demostrar en lugar de declarar**: dos
calculadoras de ingeniería de red funcionando, con las fórmulas documentadas para
que cualquiera pueda verificar el resultado.

---

## Arranque rápido

### Windows (PowerShell, desde VS Code)

```powershell
py -3 -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python serve.py
```

Si PowerShell bloquea la activación del entorno:

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
```

### Linux / macOS

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python serve.py
```

`serve.py` genera el sitio, lo sirve en <http://localhost:8000>, abre el navegador
y **regenera automáticamente** cada vez que guardás un archivo de `data/`,
`templates/` o `static/`. La página se recarga sola.

### Desde VS Code sin tocar la terminal

`Ctrl+Shift+P` → **Tasks: Run Task**:

| Tarea | Qué hace |
|---|---|
| **Build** | Genera `dist/` una vez. Es la tarea por defecto: `Ctrl+Shift+B` |
| **Dev (build + watch + servidor)** | Modo desarrollo con recarga |
| **Limpiar dist** | Borra `dist/` y regenera de cero |

Las extensiones recomendadas están en `.vscode/extensions.json`; VS Code te las
va a ofrecer al abrir el proyecto. La importante es **Jinja HTML**, que da
resaltado de sintaxis a las plantillas.

---

## Estructura

```
portfolio/
├─ data/                    ← ÚNICA FUENTE DE VERDAD. Editá acá.
│  ├─ site.yaml             metadatos, navegación, contacto, SEO
│  ├─ perfil.yaml           perfil, señales, especialidades, competencias, idiomas
│  ├─ experiencia.yaml      puestos y bullets
│  ├─ educacion.yaml        títulos y certificaciones
│  ├─ tecnologias.yaml      stack agrupado
│  ├─ casos.yaml            casos de estudio
│  └─ herramientas.yaml     catálogo de herramientas
│
├─ templates/               ← plantillas Jinja2
│  ├─ base.html             layout, nav, pie, SEO, datos estructurados
│  ├─ _macros.html          componentes reutilizables
│  ├─ index.html            home
│  ├─ trayectoria.html      experiencia, certificaciones, educación
│  ├─ herramientas.html     índice de herramientas
│  ├─ casos.html            índice de casos
│  ├─ caso.html             plantilla de cada caso (una página por slug)
│  ├─ tool_radioenlace.html
│  └─ tool_subneteo.html
│
├─ static/
│  ├─ css/tokens.css        design system: colores, tipografía, espaciado
│  ├─ css/base.css          reset, tipografía, layout, nav, pie, impresión
│  ├─ css/components.css    componentes
│  ├─ js/nav.js             menú móvil y selector de tema
│  ├─ js/radioenlace.js     calculadora de radioenlace
│  └─ js/subneteo.js        calculadora de subneteo y VLSM
│
├─ build.py                 generador
├─ serve.py                 servidor de desarrollo con recarga
└─ dist/                    ← SALIDA. No la edites: se sobrescribe.
```

**Regla de oro:** nunca edites `dist/`. Se regenera y perdés el trabajo.
Editás `data/` o `templates/`, corrés el build.

---

## Cómo actualizar contenido

### Cambiar un bullet de experiencia

Abrí `data/experiencia.yaml`, editá el texto, guardá. Si `serve.py` está
corriendo, el navegador se actualiza solo.

### Agregar una certificación

En `data/educacion.yaml`, dentro de `certificaciones`:

```yaml
  - sigla: CCNA 200-301
    nombre: Cisco Certified Network Associate
    emisor: Cisco
    destacada: true      # true la resalta en color de acento
```

### Agregar un caso de estudio

En `data/casos.yaml` agregás un item con un `slug` nuevo. El generador crea
`dist/casos/<slug>.html` automáticamente, sin tocar plantillas.

La estructura es obligatoria: **contexto → problema → método → resultado**. Es el
formato en el que un evaluador técnico puede seguir el razonamiento.

### Agregar una herramienta nueva

1. Agregá el item en `data/herramientas.yaml` con su `slug`.
2. Creá `templates/tool_<slug>.html`.
3. Creá `static/js/<slug>.js`.

El build **falla a propósito** si declarás una herramienta sin su plantilla. Es
mejor que un enlace roto en producción.

---

## Sobre las métricas

El campo `metricas` de cada caso está **vacío a propósito**.

Un número inventado en un portafolio técnico se cae en la primera entrevista y
se lleva puesta la credibilidad de todo lo demás. Cuando tengas datos medidos,
completalos así:

```yaml
    metricas:
      - { valor: "−40 %", etiqueta: "Tiempo medio de diagnóstico" }
      - { valor: "180", etiqueta: "Sitios bajo monitoreo" }
```

La plantilla los renderiza automáticamente y reemplaza la nota metodológica que
aparece cuando la lista está vacía.

**Qué conviene medir**, en orden de retorno:

1. Tiempo medio de diagnóstico antes y después de documentar los procedimientos.
   Es el único dato que convierte una mejora de proceso en un resultado medible,
   y es exactamente lo que un hiring manager de NOC quiere escuchar.
2. Cantidad de sitios, nodos y clientes bajo monitoreo.
3. Tickets gestionados por mes.
4. Cantidad de enlaces calculados y puestos en servicio.
5. Tasa de resolución en primer contacto, si el sistema de tickets la registra.

Anotá esto durante 60 días y tenés material propio y defendible.

---

## Las herramientas

### Calculadora de radioenlace

Calcula pérdida en espacio libre, presupuesto de potencia, margen de
desvanecimiento, primera zona de Fresnel, curvatura terrestre y despeje real
sobre el obstáculo dominante. Dibuja un perfil esquemático en SVG generado en
tiempo real.

Fórmulas implementadas:

| Magnitud | Expresión |
|---|---|
| Pérdida en espacio libre | `FSPL = 32,44 + 20·log10(f_MHz) + 20·log10(d_km)` |
| EIRP | `Ptx + Gtx − Ltx` |
| Potencia recibida | `Ptx + Gtx + Grx − FSPL − Ltx − Lrx − Lvarios` |
| Margen de desvanecimiento | `Prx − Sensibilidad` |
| Zona de Fresnel n | `r_n = 17,32·√(n·d1·d2 / (f_GHz·D))`, distancias en km, resultado en metros |
| Curvatura terrestre | `h = d1·d2 / (12,74·K)`, con K = 4/3 por defecto |

Umbrales del veredicto: margen de desvanecimiento ≥ 20 dB recomendado, 10–20 dB
al límite, < 10 dB no recomendable. Despeje: 60 % de la primera zona de Fresnel
libre por encima del obstáculo y del bulto terrestre.

**Lo que la herramienta no hace**, y está dicho en la propia página: no reemplaza
un relevamiento de campo ni un perfil topográfico real, modela un único obstáculo
dominante, y no incorpora atenuación por lluvia según ITU-R P.838 ni
desvanecimiento multitrayecto. Declarar los límites de una herramienta es parte
de presentarla con seriedad.

### Calculadora de subneteo y VLSM

Analiza un bloque IPv4 y genera un plan de direccionamiento a partir de una lista
de segmentos con su requerimiento de hosts. Exporta el plan a CSV.

Criterios:

- Hosts utilizables: `2^(32−prefijo) − 2`.
- `/31` según RFC 3021 y `/32` como host único.
- En la asignación VLSM, el uso de `/31` para enlaces punto a punto es **una
  casilla en la interfaz, desactivada por defecto**. Sin activar, los segmentos
  de 2 hosts reciben `/30`, que es lo universalmente compatible. Activada sigue
  RFC 3021: correcto en equipamiento moderno, puede romper en stacks antiguos.
  La decisión es del operador, no de la herramienta.
- Asignación de mayor a menor, con cada subred alineada a un múltiplo de su
  propio tamaño. Eso es lo que evita fragmentar el espacio.
- Ámbito según RFC 1918, RFC 6598 (CGNAT) y RFC 3927 (link-local).

---

## Design system

Tema oscuro técnico, derivado del sistema **Petrol Grid** del CV impreso. El CV
es blanco por obligación de impresión; la web no tiene esa restricción, así que
el registro acá es de consola de operaciones.

Todo está en `static/css/tokens.css`. Cambiás una variable y el sitio entero se
actualiza.

| Grupo | Variables |
|---|---|
| Superficies | `--bg-900` `--bg-800` `--bg-700` `--bg-600` |
| Líneas | `--line` `--line-2` |
| Tinta | `--ink` `--ink-2` `--ink-3` |
| Acento (único) | `--acc` `--acc-soft` `--acc-glow` |
| Semánticos | `--ok` `--warn` `--err` — **solo para resultados de cálculo** |
| Tipografía | Inter para interfaz, JetBrains Mono para datos |
| Espaciado | `--s-1` a `--s-10`, grilla base 8 px |
| Radio | `--r-sm: 3px` `--r-md: 6px` `--r-lg: 10px` |

Hay un **tema claro** incluido, coherente con el CV impreso. Se activa con el
botón `◐` del encabezado y se guarda en `localStorage`.

### Reglas del sistema

1. Un único color de acento. Nada compite con él.
2. Los colores semánticos se usan solo para resultados de cálculo, nunca como
   decoración.
3. Cero barras de progreso, cero estrellas, cero porcentajes de habilidad. Un
   porcentaje sin metodología es un dato inventado; en un perfil técnico es un
   pasivo.
4. Cero datos falsos. Sin dashboards de uptime simulado.
5. Cero animaciones de scroll. Se respeta `prefers-reduced-motion`.
6. Todo valor de espaciado es múltiplo de 4, y los estructurales de 8.

---

## Accesibilidad y rendimiento

Lo que ya está resuelto:

- HTML semántico, un solo `h1` por página, jerarquía de encabezados correcta.
- Enlace de salto al contenido para navegación por teclado.
- `aria-live` en los paneles de resultado: un lector de pantalla anuncia el
  recálculo.
- `aria-invalid` en los campos con error de validación.
- `aria-current="page"` en la navegación.
- Foco visible en todos los elementos interactivos.
- SVG con `role="img"` y `aria-label` descriptivo.
- `prefers-reduced-motion` respetado.
- Datos estructurados JSON-LD de tipo `Person`.
- `sitemap.xml` y `robots.txt` generados automáticamente.
- Cero dependencias de JavaScript. Todo el CSS y JS suma menos de 50 KB sin
  minificar.

Pendiente cuando publiques: verificar contraste con Lighthouse y agregar una
imagen `og:image` para las vistas previas al compartir el enlace.

---

## Publicar

**Ver `PUBLICAR.md`** — guía paso a paso desde cero, escrita asumiendo que nunca
usaste Git. Incluye la creación de la cuenta, la instalación de Git, el nombre
que conviene darle al repositorio, y qué hacer cuando algo falla.

El workflow `.github/workflows/deploy.yml` ya está configurado: en cada `push` a
`main` valida los datos, genera el sitio, verifica que el PDF del CV esté
presente y publica. Si un YAML está mal escrito el deploy se detiene y el sitio
anterior queda intacto.

Alternativa rápida sin Git: correr `python build.py` y arrastrar la carpeta
`dist` a <https://app.netlify.com/drop>. URL pública en 30 segundos.

---

## Poner el CV para descarga

El botón *Descargar CV* apunta a `data/site.yaml → cv.archivo`. Copiá el PDF a la
raíz del proyecto con ese mismo nombre:

```
portfolio/CV_Tomas_Soto_Analista_NOC.pdf
```

El build lo copia a `dist/` automáticamente. Si el archivo no está, el enlace
queda roto: es lo primero que conviene verificar antes de publicar.

---

## Próximos pasos sugeridos

En orden de impacto sobre lo que un evaluador técnico valora:

1. **Poner el PDF del CV** en la raíz. Es un enlace roto hasta que lo hagas.
2. **Completar `github`** en `data/site.yaml` cuando tengas repositorio público.
   Un portafolio de perfil técnico sin código visible pierde la mitad de su valor.
3. **Medir y completar las métricas** de los casos (ver arriba).
4. **Unificar la generación del CV en PDF** desde el mismo YAML, con WeasyPrint.
   Es el paso que convierte esto en un proyecto contable en entrevista:
   *"automaticé la generación de mi CV y mi sitio desde una única fuente de
   datos"*. Una sola verdad, dos salidas, cero versiones desincronizadas.
5. **Tercera herramienta**: un verificador de configuración de RouterOS, o una
   calculadora de presupuesto óptico para FTTx. Ambas apuntan directo a tu
   diferencial.
6. **Versión en inglés**. Las plantillas ya están preparadas para i18n: alcanza
   con duplicar los YAML en `data/en/` y agregar un bucle de idiomas en
   `build.py`.

---

## Verificaciones hechas

Las fórmulas de radioenlace fueron validadas contra valores de referencia:

| Caso | Calculado | Referencia |
|---|---|---|
| FSPL 5800 MHz, 10 km | 127,71 dB | ~127,7 dB |
| FSPL 2400 MHz, 1 km | 100,04 dB | ~100,0 dB |
| FSPL 900 MHz, 5 km | 105,50 dB | ~105,5 dB |
| F1 a 5,8 GHz sobre 10 km | 11,37 m | ~11,4 m |
| F1 a 2,4 GHz sobre 5 km | 12,50 m | ~12,5 m |
| Bulto terrestre 10 km, K=4/3 | 1,47 m | ~1,47 m |
| Bulto terrestre 50 km, K=4/3 | 36,79 m | ~36,8 m |

La calculadora de subneteo se probó con 30 aserciones que cubren: ida y vuelta de
parseo, aritmética sin signo sobre rangos `200.x` (donde el bit alto en 1 rompe
las implementaciones ingenuas), máscaras no contiguas, `/31` y `/32`, ámbitos
RFC, prefijo mínimo por cantidad de hosts, y tres planes VLSM completos
verificando que ninguna subred se solape, que todas queden alineadas a su tamaño
de bloque y que las direcciones cierren contra el total.
#   t o m a s s o t o . g i t h u b . i o  
 