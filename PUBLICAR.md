# Publicar el sitio en internet

Guía paso a paso, escrita asumiendo que nunca usaste Git. Todo es gratis y
permanente. Al terminar vas a tener una dirección pública que cualquier persona
del mundo puede abrir, y el PDF del CV descargable desde ahí.

**Por qué hoy no funciona.** Cuando abrís `dist/index.html` haciendo doble clic,
el navegador lo lee desde tu disco (`file:///C:/...`). Ese archivo solo existe en
tu computadora. Y cuando corrés `python serve.py`, el servidor escucha en
`localhost`, que significa literalmente "esta máquina". Para que el sitio exista
en internet, los archivos tienen que estar en un servidor con dirección pública.
Eso es lo que resuelve GitHub Pages.

---

## Resumen de lo que vas a hacer

0. **Mover el proyecto a una carpeta con ruta corta.** Obligatorio, ver abajo.
1. Crear una cuenta de GitHub.
2. Instalar Git en la computadora.
3. Crear un repositorio con un nombre específico.
4. Subir el proyecto.
5. Activar GitHub Pages.

Tiempo estimado la primera vez: **20 a 30 minutos**. Después, publicar una
actualización son tres comandos y 40 segundos.

---

## Paso 0 — Mover el proyecto a una ruta corta

**Este paso es obligatorio y va primero.** Si lo salteás, `git init` falla con
`Filename too long` y no vas a poder subir nada.

### Por qué

El proyecto se generó dentro de la carpeta de sesión de la app de Claude, y esa
ruta tiene alrededor de 247 caracteres. Windows tiene un límite histórico de 260
caracteres por ruta completa. Git necesita crear archivos internos como:

```
.git\objects\pack\pack-a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0.idx
```

Sumados a la ruta base, eso da más de 300 caracteres. Windows lo rechaza y Git
no puede ni crear el repositorio.

Hay una **segunda razón, más importante**: esa carpeta vive en
`AppData\Local\Packages`, que es la caché de la aplicación. Se puede vaciar sola
en cualquier momento y te llevarías el proyecto. Un proyecto con historial de Git
no debe vivir ahí.

### Cómo

Desde la PowerShell que ya tenés abierta en la carpeta `portfolio`:

```powershell
robocopy . C:\dev\portfolio /E /XD .venv dist
cd C:\dev\portfolio
ls
```

Tenés que ver `build.py`, `serve.py`, `data`, `templates`, `static`.

`robocopy` se usa en lugar de `Copy-Item` porque maneja rutas largas sin
problemas. Las exclusiones son a propósito:

| Excluido | Por qué |
|---|---|
| `.venv` | Guarda rutas absolutas adentro. Copiado a otra carpeta queda roto. Se recrea en un comando. |
| `dist` | Es salida generada. Se rehace con `python build.py`. |

Ahora recreá el entorno de Python en la ubicación nueva:

```powershell
py -3 -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python build.py
```

Si el build termina con el tilde verde, seguí al Paso 1.

> **De acá en adelante, tu proyecto vive en `C:\dev\portfolio`.** Esa es la
> carpeta que abrís en VS Code y donde corrés todos los comandos. La carpeta
> original de la sesión de Claude ya no se usa.

---

## Paso 1 — Cuenta de GitHub

Entrá a <https://github.com/signup> y creá la cuenta.

**El nombre de usuario importa**, porque va a ser tu dirección web. Elegí algo
profesional que puedas poner en el CV y en LinkedIn:

- `tomassoto` → el sitio queda en `tomassoto.github.io`
- `tsoto-noc`, `soto-networks`, `tbsoto` → alternativas si el primero está tomado

Evitá números al azar o guiones bajos. Esta dirección va a estar en tu CV
durante años.

---

## Paso 2 — Instalar Git

Descargá **Git for Windows** desde <https://git-scm.com/download/win>. Instalá
con todas las opciones por defecto: siguiente, siguiente, siguiente.

Para verificar, abrí PowerShell y escribí:

```powershell
git --version
```

Si responde algo como `git version 2.47.0`, está listo. Si dice que no reconoce
el comando, cerrá PowerShell, abrilo de nuevo y probá otra vez (Windows necesita
reabrir la terminal para ver el programa nuevo).

Ahora configurá tu identidad, una sola vez en la vida:

```powershell
git config --global user.name "Tomás Soto"
git config --global user.email "tomassoto01@gmail.com"
```

Usá el mismo correo con el que creaste la cuenta de GitHub.

---

## Paso 3 — Crear el repositorio

En GitHub, botón **+** arriba a la derecha → **New repository**.

Completá así:

| Campo | Valor |
|---|---|
| **Repository name** | `TU-USUARIO.github.io` — por ejemplo `tomassoto.github.io` |
| **Description** | Portafolio profesional · Analista NOC IT |
| **Public / Private** | **Public** (Pages gratuito requiere público) |
| Add a README | **desmarcado** |
| Add .gitignore | **None** |
| Choose a license | **None** |

**Por qué ese nombre exacto.** Un repositorio llamado `usuario.github.io` se
publica en la raíz del dominio: `https://tomassoto.github.io`. Cualquier otro
nombre se publica en un subdirectorio (`usuario.github.io/portfolio`) y hay que
tocar una configuración extra. Con este nombre no tenés que configurar nada y la
dirección queda más limpia.

Al crearlo, GitHub te muestra una página con comandos. No la cierres todavía.

---

## Paso 4 — Subir el proyecto

Abrí PowerShell **dentro de la carpeta del proyecto**. La forma más simple:
abrí la carpeta `portfolio` en el Explorador de Windows, hacé clic en la barra de
direcciones, escribí `powershell` y presioná Enter.

Verificá que estás en el lugar correcto:

```powershell
ls
```

Tenés que ver `build.py`, `serve.py`, `data`, `templates`, `static`.

### Importante: pegá un comando por vez

**No copies el bloque completo de una sola vez.** PowerShell suele comerse el
salto de línea entre los dos últimos comandos y los pega en uno solo. El error se
ve así:

```
python build.pygit init
can't open file 'C:\dev\portfolio\build.pygit'
```

Ahí `git init` nunca se ejecutó, y todos los comandos siguientes van a fallar con
`not a git repository`. Pegá uno, esperá que termine, pegá el siguiente.

### Los comandos

```powershell
git init
```

```powershell
git add .
```

```powershell
git commit -m "Portafolio inicial"
```

```powershell
git branch -M main
```

Esta línea **hay que editarla antes de pegarla**: reemplazá las dos apariciones
de `TU-USUARIO` por tu usuario real de GitHub.

```powershell
git remote add origin https://github.com/TU-USUARIO/TU-USUARIO.github.io.git
```

```powershell
git push -u origin main
```

### Cómo verificar que `git init` funcionó

```powershell
git status
```

Si responde `On branch master` o `No commits yet`, está bien. Si dice
`not a git repository`, el comando no llegó a ejecutarse: corré `git init` solo,
sin nada más pegado detrás.

Si te equivocaste y quedó la URL con `TU-USUARIO`, se corrige sin rehacer nada:

```powershell
git remote set-url origin https://github.com/TU-USUARIO-REAL/TU-USUARIO-REAL.github.io.git
```

En el `git push` se abre una ventana pidiendo autorización. Elegí
**Sign in with your browser**, autorizá, y volvé a PowerShell. Eso pasa una sola
vez: después queda recordado.

### Qué hace cada comando

| Comando | Qué hace |
|---|---|
| `git init` | Convierte la carpeta en un repositorio |
| `git add .` | Marca todos los archivos para subir |
| `git commit -m "..."` | Guarda una versión con una descripción |
| `git branch -M main` | Nombra la rama principal `main` |
| `git remote add origin ...` | Conecta tu carpeta con el repositorio de GitHub |
| `git push` | Sube todo |

---

## Paso 5 — Activar GitHub Pages

En tu repositorio: **Settings** (arriba) → **Pages** (menú izquierdo).

En **Build and deployment → Source**, elegí **GitHub Actions**.

No hace falta elegir un workflow: el proyecto ya trae
`.github/workflows/deploy.yml` y GitHub lo detecta solo.

Andá a la pestaña **Actions**. Vas a ver el proceso corriendo. Tarda entre 40
segundos y 2 minutos. Cuando el círculo se ponga verde, tu sitio está online en:

```
https://TU-USUARIO.github.io
```

Abrilo desde el celular con los datos móviles (no con el WiFi de tu casa) para
comprobar que realmente está en internet y no en tu red local.

---

## Actualizar el sitio de acá en adelante

Cada vez que cambies algo — un bullet en un YAML, el PDF del CV, un caso nuevo:

```powershell
git add .
git commit -m "Actualizo la experiencia en COMTEC"
git push
```

Y listo. GitHub genera el sitio y lo publica solo en menos de dos minutos.

No necesitás correr `python build.py` antes de subir: el workflow lo hace en el
servidor. Corré el build local únicamente para ver los cambios antes de
publicarlos, con `python serve.py`.

---

## Qué hace el workflow por vos

El archivo `.github/workflows/deploy.yml` ejecuta, en cada push:

1. Instala Python y las dependencias.
2. Corre `python build.py --check`. **Si un YAML está mal escrito, el deploy se
   detiene y el sitio anterior queda intacto.** Nunca vas a publicar un sitio roto.
3. Genera el sitio.
4. Verifica que `CV_Tomas_Soto_Analista_NOC.pdf` esté en la salida. Si falta,
   falla a propósito, porque un botón de descarga roto es peor que no tenerlo.
5. Publica.

Si algo falla, GitHub te manda un correo y en la pestaña **Actions** ves el error
exacto en rojo.

---

## Verificación después de publicar

- [ ] Abrir el sitio desde el celular **con datos móviles**, no con WiFi.
- [ ] Probar el botón **Descargar CV**: tiene que bajar el PDF.
- [ ] Abrir las dos calculadoras y verificar que muestran resultados.
- [ ] Probar el selector de tema claro/oscuro.
- [ ] Abrir el menú en pantalla de celular.
- [ ] Buscar tu nombre en Google después de una semana (la indexación tarda).

---

## Dominio propio (opcional, más adelante)

Un dominio tipo `tomassoto.com.ar` cuesta poco por año y se ve más profesional
que `github.io`. Si algún día lo comprás:

1. Creá un archivo llamado `CNAME` (sin extensión) en la raíz del proyecto, con
   el dominio adentro y nada más:
   ```
   tomassoto.com.ar
   ```
2. En `data/site.yaml`, cambiá `canonical` a `https://tomassoto.com.ar`.
3. En el panel de tu proveedor de dominio, apuntá los registros DNS a GitHub
   Pages. GitHub te muestra las direcciones exactas en **Settings → Pages**.
4. `git add . && git commit -m "Dominio propio" && git push`

El build ya está preparado: copia el `CNAME` a la salida automáticamente.

---

## Limpiar el historial de Git

Git guarda todo. Si en algún commit subiste algo que no debía publicarse — el
código de un documento interno, el modelo de un equipo, una captura con datos de
cliente — corregirlo en la versión actual **no lo saca del historial**: los
commits anteriores siguen siendo consultables en GitHub.

### Paso 1 — Medí antes de actuar

No reescribas historial a ciegas. Primero averiguá qué llegó realmente:

```powershell
git log --oneline
```

```powershell
git log --all -S "TEXTO-QUE-BUSCAS" --oneline
```

`-S` recorre todo el historial y te dice en qué commits aparece esa cadena. Si no
devuelve nada, ese contenido nunca se publicó y no hay nada que limpiar.

### Paso 2 — Elegí el camino

#### Camino A: borrar el repositorio y crearlo de nuevo (garantizado)

Es el único método que elimina con certeza los objetos, los artefactos de Actions
y los deployments de Pages.

1. GitHub → repo → **Settings** → **Danger Zone** → **Delete this repository**.
2. Creá uno nuevo con el mismo nombre, público, sin README.
3. Rehacé el historial desde cero:

```powershell
Remove-Item -Recurse -Force .git
```

```powershell
git init
```

```powershell
git add .
```

```powershell
git commit -m "Portafolio profesional"
```

```powershell
git branch -M main
```

```powershell
git remote add origin https://github.com/TU-USUARIO/TU-USUARIO.github.io.git
```

```powershell
git push -u origin main
```

4. **Settings → Pages → Source → GitHub Actions** de nuevo.

En un repositorio personal, reciente y sin colaboradores no perdés nada: el
historial no tiene valor que preservar.

#### Camino B: reescribir y forzar el push (rápido, con reserva)

Los mismos comandos, pero terminando en `git push --force -u origin main` y sin
borrar el repositorio.

**La reserva:** un `--force` deja los commits viejos *huérfanos*, no borrados.
GitHub los conserva y siguen accesibles para quien conozca el SHA, hasta que
corre su recolección de basura — sin fecha garantizada. Para eliminarlos con
certeza hay que pedírselo a GitHub Support.

### Cuándo usar `git filter-repo`

Es la herramienta indicada cuando **necesitás conservar el historial**: un
repositorio de años, con colaboradores, donde hay que borrar un archivo o una
cadena de todos los commits sin perder el resto. Se instala aparte y reescribe
cada commit según un patrón.

Para un proyecto personal de pocos commits es innecesariamente complejo: rehacer
el historial es más rápido y menos propenso a error.

### Lo que conviene no volver a subir

- Documentos internos: descripciones de puesto, procedimientos, planillas.
- Capturas de consolas de monitoreo, tickets o configuraciones reales.
- Direcciones IP, hostnames, modelos exactos de equipamiento de un cliente.
- Nombres de clientes y detalles de su arquitectura.
- Cualquier cosa que revele una debilidad de un sistema, incluso ya resuelta.

El `.gitignore` no puede adivinar esto. La revisión previa al primer `git add .`
es la única defensa real.

---

## Problemas frecuentes

**`git init` no hace nada, o dice `Filename too long`**
La ruta de la carpeta supera los 260 caracteres que admite Windows. Es
exactamente lo que resuelve el Paso 0: mové el proyecto a `C:\dev\portfolio`.
No intentes arreglarlo con `git config --system core.longpaths true`: aunque a
veces funciona, muchas herramientas de Windows siguen fallando con rutas largas
y vas a arrastrar el problema. Mover la carpeta lo elimina de raíz.

**"git no se reconoce como comando"**
Cerrá PowerShell y abrilo de nuevo. Windows necesita reabrir la terminal para
ver programas recién instalados.

**El push pide usuario y contraseña y la contraseña no funciona**
GitHub ya no acepta contraseñas por línea de comandos. Cuando aparezca la
ventana, elegí **Sign in with your browser**.

**El sitio muestra 404 después de activar Pages**
Esperá dos minutos y recargá con Ctrl+F5. La primera publicación tarda más.

**Los estilos no cargan y el sitio se ve como texto plano**
Pasa si el repositorio NO se llama `usuario.github.io`. En ese caso abrí
`data/site.yaml` y poné el nombre del repo en `base_url`, así:
```yaml
base_url: "/nombre-del-repo"
```
Después `git add . && git commit -m "Ajuste base_url" && git push`.

**Subí un archivo con datos que no quería publicar**
El repositorio es público: todo lo que subís queda visible, y borrarlo después
no lo saca del historial. Antes del primer `git push`, revisá que en la carpeta
no haya nada privado — capturas de configuraciones reales, direcciones IP de
clientes, credenciales. El `.gitignore` ya excluye `.venv/` y `dist/`, pero no
puede adivinar qué documento no querés compartir.

---

## Alternativa rápida sin Git

Si querés una dirección pública **hoy**, sin instalar nada:

1. Corré `python build.py`.
2. Entrá a <https://app.netlify.com/drop>.
3. Arrastrá la carpeta `dist` completa a la página.

En 30 segundos tenés una URL pública. Sirve perfecto para mandar el link en una
postulación esta misma tarde.

La contra: la dirección es un código al azar tipo
`amazing-pastry-4f2a1b.netlify.app`, y cada vez que actualices el sitio tenés que
volver a arrastrar la carpeta. Úsalo como puente mientras armás GitHub Pages, no
como solución definitiva.
