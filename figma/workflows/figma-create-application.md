---
description: >
  Recorre un archivo Figma completo, lo mapea contra el PRD del proyecto,
  construye el esqueleto completo de la aplicación (rutas, UI kit, tokens,
  assets), maqueta todas las pantallas y lanza la app para revisión final.
---

# figma-create-application

<!-- ================================================================
  WORKFLOW VARIABLES
  Si alguna variable está en (?), el agente pregunta al usuario y
  actualiza este archivo automáticamente antes de continuar.
================================================================ -->

```yaml
# workflow.config
figma_script:      ?          # comando para invocar el script Figma por CLI (ej. node .agents/skills/figma-mcp/figma-api.js)
figma_file_key:    ?          # clave del archivo Figma (extraída de la URL)
prd_file:          PRD.md     # ruta al PRD del proyecto
framework:         react      # react | vue | svelte | astro
language:          typescript # typescript | javascript
styling:           tailwind   # tailwind | css-modules | styled-components | scss
components_dir:    src/components
pages_dir:         src/pages  # Next.js app router → src/app
public_dir:        public
styles_file:       src/styles/tokens.css
router:            react-router  # nextjs-app | nextjs-pages | react-router | nuxt | sveltekit
package_manager:   npm        # npm | yarn | pnpm | bun
dev_command:       npm run dev
```

---

## 0. Bootstrap (ejecutar una sola vez)

Lee el bloque `workflow.config`. Por cada variable aún en `?`:

1. Pregunta al usuario la pregunta correspondiente (tabla abajo).
2. Edita este archivo y reemplaza `?` con la respuesta.
3. No volver a preguntar en ejecuciones futuras.

| Variable | Pregunta |
|---|---|
| `figma_script` | ¿Qué comando ejecuta el script de Figma? (ej. `node .agents/skills/figma-mcp/figma-api.js`) |
| `figma_file_key` | ¿Cuál es la URL o file key del archivo Figma? |
| `prd_file` | ¿Dónde está el PRD del proyecto? (ruta relativa) |
| `framework` | ¿Qué framework usas? (`react` / `vue` / `svelte` / `astro`) |
| `language` | ¿TypeScript o JavaScript? |
| `styling` | ¿Cómo se manejan los estilos? (`tailwind` / `css-modules` / `styled-components` / `scss`) |
| `components_dir` | ¿Dónde viven los componentes? (ej. `src/components`) |
| `pages_dir` | ¿Dónde viven las páginas/rutas? (ej. `src/pages`, `src/app`) |
| `public_dir` | ¿Dónde se sirven los assets estáticos? (ej. `public`) |
| `styles_file` | ¿Dónde va el archivo de variables CSS globales? |
| `router` | ¿Qué router usas? (`nextjs-app` / `nextjs-pages` / `react-router` / `nuxt` / `sveltekit`) |
| `package_manager` | ¿Qué gestor de paquetes usas? (`npm` / `yarn` / `pnpm` / `bun`) |
| `dev_command` | ¿Cuál es el comando para arrancar en desarrollo? |

Una vez todas las variables estén configuradas, continúa a la Fase 1.

---

## FASE 1 — Exploración y mapeo

> **Objetivo:** Entender la aplicación completa antes de escribir una sola línea de código.

### 1.1 Leer el PRD

Lee `{{prd_file}}` en su totalidad. Extrae y documenta:

- **Objetivo del producto** — qué problema resuelve y para quién.
- **Funcionalidades principales** — lista priorizada de features.
- **Flujos de usuario** — cada journey descrito en el PRD.
- **Entidades de datos** — modelos que aparecen (usuario, pedido, producto…).
- **Integraciones externas** — APIs, pagos, auth, analytics… (estas se mockearán).
- **Restricciones técnicas** — rendimiento, accesibilidad, i18n, etc.

### 1.2 Explorar el archivo Figma

Haz una primera pasada de orientación para entender la estructura global.

> **¿Por qué `depth=2` aquí?** Con depth=2 se obtienen las páginas del archivo y los frames de primer nivel (las pantallas) sin descargar el árbol completo de nodos, que puede ser enorme. Es el equivalente a abrir el panel de capas en Figma y ver la estructura antes de hacer clic en nada. Desde aquí se decide qué frames son relevantes antes de gastar llamadas en profundidad.

Si el proyecto usa el **MCP de Figma** (herramientas nativas del agente):
```
figma_read_file(file_key={{figma_file_key}}, depth=2)
```

Si el proyecto usa el **script CLI** (`{{figma_script}}`):
```bash
{{figma_script}} read_file {{figma_file_key}} --depth 2
```

Identifica:
- Número de **páginas** y su propósito (ej. "Flows", "Components", "Tokens").
- **Frames de nivel superior** en cada página → son las pantallas de la app.
- Convenciones de nomenclatura usadas por el equipo de diseño.

A continuación profundiza en cada frame relevante (depth 3–4 para ver sub-componentes y capas de layout):

MCP:
```
figma_read_nodes(file_key={{figma_file_key}}, node_ids=[<frame_ids>])
```
CLI:
```bash
{{figma_script}} read_nodes {{figma_file_key}} <frame_ids>
```

Para cada frame, lee el campo `description` del nodo y de sus hijos directos.
Las anotaciones del diseñador son **fuente de verdad** sobre comportamiento e intenciones — tienen precedencia sobre cualquier inferencia visual.

### 1.3 Mapear Figma → PRD

Construye una tabla de correspondencia explícita:

| Pantalla Figma | Frame ID | Feature PRD | Ruta propuesta | Notas del diseñador |
|---|---|---|---|---|
| Login | 12:34 | Auth — iniciar sesión | `/login` | "Mostrar error inline, no toast" |
| Dashboard | 56:78 | Overview métricas | `/` | "Skeleton loader en primera carga" |
| … | … | … | … | … |

Señala:
- ❌ **Features en el PRD sin pantalla en Figma** — confirmar con el usuario si se omiten o se construyen sin diseño.
- ❌ **Pantallas en Figma sin feature en el PRD** — confirmar si forman parte del scope.

### 1.4 Inventariar el UI kit

Busca todos los componentes reutilizables del sistema de diseño:

MCP:
```
figma_search_components(file_key={{figma_file_key}})
```
CLI:
```bash
{{figma_script}} search_components {{figma_file_key}}
```

Para cada componente encontrado, lista:
- Nombre, variantes (props), estados interactivos (hover, focus, disabled, loading, error).
- Descripción del diseñador si existe.
- Equivalente de código propuesto (ej. `Button`, `Input`, `Card`…).

### 1.5 Presentar el mapa al usuario y confirmar antes de continuar

Presenta un resumen estructurado:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  MAPA DE LA APLICACIÓN
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Páginas identificadas: N
  Rutas propuestas: [lista]

  UI Kit — componentes a crear: [lista]

  Gaps detectados:
  · Features en PRD sin diseño: [lista]
  · Pantallas sin feature PRD: [lista]

  Integraciones a mockear: [lista]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**Esperar confirmación del usuario antes de continuar.**

---

## FASE 2 — Esqueleto de la aplicación

> **Objetivo:** Estructura de archivos, tokens de diseño, UI kit y assets — sin contenido visual todavía.

### 2.1 Extraer tokens de diseño

MCP:
```
figma_extract_styles(file_key={{figma_file_key}}, types=["FILL","TEXT","EFFECT","GRID"])
```
CLI:
```bash
{{figma_script}} extract_styles {{figma_file_key}} FILL,TEXT,EFFECT,GRID
```

Genera `{{styles_file}}` con todas las variables CSS. Estructura recomendada:

```css
/* {{styles_file}} — GENERADO AUTOMÁTICAMENTE — no editar manualmente */
:root {

  /* ── Colores ── */
  --color-primary-500:   #3B5BDB;
  --color-primary-400:   #4C6EF5;
  --color-neutral-900:   #0F172A;
  /* ... todos los colores del sistema */

  /* ── Tipografía ── */
  --font-family-sans:    'Inter', sans-serif;
  --font-family-mono:    'JetBrains Mono', monospace;

  --text-xs:   0.75rem;   /* 12px */
  --text-sm:   0.875rem;  /* 14px */
  --text-base: 1rem;      /* 16px */
  --text-lg:   1.125rem;  /* 18px */
  --text-xl:   1.25rem;   /* 20px */
  --text-2xl:  1.5rem;    /* 24px */
  --text-3xl:  1.875rem;  /* 30px */
  --text-4xl:  2.25rem;   /* 36px */

  --font-regular:   400;
  --font-medium:    500;
  --font-semibold:  600;
  --font-bold:      700;

  --leading-tight:  1.25;
  --leading-normal: 1.5;
  --leading-loose:  1.75;

  /* ── Espaciado ── */
  --space-1:  0.25rem;  /* 4px */
  --space-2:  0.5rem;   /* 8px */
  --space-3:  0.75rem;  /* 12px */
  --space-4:  1rem;     /* 16px */
  --space-6:  1.5rem;   /* 24px */
  --space-8:  2rem;     /* 32px */
  --space-12: 3rem;     /* 48px */
  --space-16: 4rem;     /* 64px */

  /* ── Radios ── */
  --radius-sm:   4px;
  --radius-md:   8px;
  --radius-lg:   12px;
  --radius-xl:   16px;
  --radius-full: 9999px;

  /* ── Sombras ── */
  --shadow-sm:  0 1px 2px rgba(0,0,0,.06);
  --shadow-md:  0 4px 12px rgba(0,0,0,.10);
  --shadow-lg:  0 8px 24px rgba(0,0,0,.14);

  /* ── Breakpoints (referencia — usar en @media) ── */
  /* --bp-sm: 640px | --bp-md: 768px | --bp-lg: 1024px | --bp-xl: 1280px */
}
```

Regla: **nunca sobreescribir** tokens existentes si el archivo ya existe — solo añadir los que falten.

### 2.2 Clases de utilidad de tipografía

Además de las variables, genera clases de texto semánticas para uso directo en componentes:

```css
/* Clases de texto — usar en lugar de valores hardcodeados */
.text-heading-xl  { font-size: var(--text-4xl); font-weight: var(--font-bold);    line-height: var(--leading-tight); }
.text-heading-lg  { font-size: var(--text-3xl); font-weight: var(--font-bold);    line-height: var(--leading-tight); }
.text-heading-md  { font-size: var(--text-2xl); font-weight: var(--font-semibold);line-height: var(--leading-tight); }
.text-heading-sm  { font-size: var(--text-xl);  font-weight: var(--font-semibold);line-height: var(--leading-normal); }
.text-body-lg     { font-size: var(--text-lg);  font-weight: var(--font-regular); line-height: var(--leading-normal); }
.text-body-md     { font-size: var(--text-base);font-weight: var(--font-regular); line-height: var(--leading-normal); }
.text-body-sm     { font-size: var(--text-sm);  font-weight: var(--font-regular); line-height: var(--leading-normal); }
.text-caption     { font-size: var(--text-xs);  font-weight: var(--font-regular); line-height: var(--leading-normal); }
.text-label       { font-size: var(--text-sm);  font-weight: var(--font-medium);  line-height: var(--leading-tight); }
.text-overline    { font-size: var(--text-xs);  font-weight: var(--font-semibold);letter-spacing: .08em; text-transform: uppercase; }
```

### 2.3 Descargar todos los assets

Escanea cada frame de la aplicación buscando nodos de tipo IMAGE o SVG:

MCP:
```
figma_export_images(file_key={{figma_file_key}}, node_ids=[<svg_ids>],   format="svg")
figma_export_images(file_key={{figma_file_key}}, node_ids=[<image_ids>], format="png", scale=2)
```
CLI:
```bash
{{figma_script}} export_images {{figma_file_key}} <svg_ids>   svg
{{figma_script}} export_images {{figma_file_key}} <image_ids> png 2
```

> ⚠️ Las URLs expiran en ~30 minutos. Descargar inmediatamente.

Guardar en:
```
{{public_dir}}/
  icons/      ← SVGs de iconos
  images/     ← imágenes rasterizadas @2x
  logos/      ← logotipos e isotipo
  fonts/      ← fuentes locales si las hay
```

### 2.4 Crear la estructura de archivos

Crea todos los directorios y archivos vacíos (o con stubs) de la app:

```
src/
  components/
    ui/               ← UI kit base (Button, Input, Card…)
    layout/           ← Shell, Sidebar, Navbar, Footer
    <Feature>/        ← componentes específicos de cada feature
  pages/ (o app/)     ← una carpeta por ruta
  hooks/              ← custom hooks
  context/            ← React context / stores
  services/           ← capa de mock data y servicios futuros
  types/              ← TypeScript interfaces
  styles/
    tokens.css        ← generado en 2.1
    global.css        ← reset + clases base
  lib/                ← helpers y utilidades
  mocks/              ← datos mock para desarrollo
```

### 2.5 Construir el UI kit

Para cada componente del inventario (Fase 1.4), crear:

`{{components_dir}}/ui/<ComponentName>/<ComponentName>.{{ext}}`

Estructura obligatoria por componente:

1. **Interfaz de props** — una prop por variante y estado.
2. **Todas las variantes renderizadas** — clases condicionales, nunca JSX duplicado.
3. **Todos los estados interactivos** — hover/focus vía CSS; `isLoading` con spinner; `isDisabled` bloquea interacción.
4. **100% autocontenido** — sin llamadas a API ni estado externo.
5. **Solo variables CSS** — cero valores hardcodeados de color o tipografía.
6. **Anotaciones del diseñador aplicadas** — si hay `description` en Figma, respetarla.

Al final del archivo, incluir un bloque de uso:

```tsx
// Uso
<Button label="Guardar" intent="primary" size="md" />
<Button label="Eliminar" intent="danger" isLoading />
<Button label="Cancelar" intent="secondary" isDisabled />
```

### 2.6 Configurar el router

Crea el árbol de rutas basado en el mapa de la Fase 1.3. Cada ruta apunta a un componente de página vacío (stub) que renderiza solo el nombre de la ruta. Las rutas protegidas incluyen un wrapper `<PrivateRoute>` que en esta fase siempre concede acceso.

### 2.7 Checkpoint de esqueleto

Antes de pasar a la Fase 3, verificar:

- [ ] `{{styles_file}}` generado con todos los tokens (colores, tipografía, espaciado, radios, sombras)
- [ ] Clases de texto semánticas creadas
- [ ] Todos los assets descargados en `{{public_dir}}`
- [ ] Estructura de directorios creada
- [ ] Todos los componentes del UI kit implementados con sus variantes y estados
- [ ] Router configurado con todas las rutas como stubs
- [ ] La app arranca sin errores: `{{dev_command}}`

---

## FASE 3 — Maquetación completa

> **Objetivo:** Implementar todas las pantallas respetando el Figma al píxel, mockeando solo lo que necesita backend.

### 3.1 Reglas de maquetación

Aplicar en **cada pantalla**:

| Regla | Detalle |
|---|---|
| **Fidelidad visual** | Respetar el Figma al píxel en el breakpoint primario |
| **Anotaciones** | Leer `description` de cada nodo — si contradice lo visual, seguir la anotación |
| **Solo tokens** | Ningún valor de color, fuente o tamaño hardcodeado |
| **Interactividad real** | Clics, hovers, formularios, toggles, acordeones — todo funciona |
| **Datos mock** | Definir en `src/mocks/<feature>.mock.ts` con contenido realista, sin Lorem ipsum |
| **Estados de carga** | Implementar skeleton loaders o spinners según el diseño |
| **Estados vacíos** | Implementar empty states si aparecen en Figma |
| **Estados de error** | Implementar error states inline (mensajes de validación, banners) |
| **Responsive** | Si hay variantes mobile/tablet en Figma, implementarlas en los breakpoints correctos |
| **Animaciones** | Si hay animaciones en Figma, dejar un `// TODO: animate — descripción` y estado estático |

### 3.2 Qué se mockea (y cómo)

Las siguientes integraciones **nunca** se conectan a servicios reales en esta fase:

| Integración | Mock |
|---|---|
| **Auth** | `useAuth()` hook devuelve siempre usuario logado; login redirige sin validar |
| **API REST / GraphQL** | Funciones en `src/services/` devuelven datos de `src/mocks/` con un `await delay(400)` para simular latencia |
| **Pagos** (Stripe, etc.) | Formulario visible, submit hace `console.log(payload)` + muestra estado de éxito |
| **Mapas** (Google Maps, Mapbox) | `<div>` negro con `aria-label="Mapa placeholder"` + `// TODO: integrar mapa` |
| **Gráficas** complejas | Placeholder con dimensiones correctas + `// TODO: integrar <ChartLib />` |
| **Uploads de ficheros** | Input visible, onChange en `console.log` |
| **Emails / SMS** | Submit en `console.log` + toast de confirmación |
| **Terceros** (analytics, CRM…) | Stub vacío `trackEvent = () => {}` |

Formato estándar del placeholder para piezas no implementables:

```tsx
{/* TODO: reemplazar con <ComponentReal /> una vez integrado [nombre-integración] */}
<div
  style={{ background: 'var(--color-neutral-100)', width: '100%', height: 320,
           display: 'flex', alignItems: 'center', justifyContent: 'center',
           borderRadius: 'var(--radius-md)', border: '2px dashed var(--color-neutral-300)' }}
  aria-label="[Nombre] — pendiente de integración"
>
  <span style={{ color: 'var(--color-neutral-500)', fontSize: 'var(--text-sm)' }}>
    [Nombre] — pendiente de integración
  </span>
</div>
```

### 3.3 Orden de maquetación

Implementar pantallas en este orden de prioridad:

1. **Shell / Layout global** — navbar, sidebar, footer, grid principal.
2. **Pantallas del happy path** — el flujo principal del usuario de extremo a extremo.
3. **Pantallas secundarias** — configuración, perfil, ayuda, etc.
4. **Estados alternativos** — vacío, error, loading, confirmación.

Para cada pantalla:

1. Leer el frame en Figma:
   - MCP: `figma_read_nodes(file_key={{figma_file_key}}, node_ids=[frame_id])`
   - CLI: `{{figma_script}} read_nodes {{figma_file_key}} <frame_id>`
2. Leer las anotaciones del diseñador en los nodos hijos.
3. Componer los sub-componentes del UI kit.
4. Conectar los datos mock.
5. Verificar visualmente contra el Figma antes de marcar como hecho.

### 3.4 Navegación completa

Al terminar todas las pantallas, recorrer manualmente el flujo principal:

- Todos los CTAs navegan a la pantalla correcta.
- Los breadcrumbs y botones "atrás" funcionan.
- Las rutas protegidas redirigen al login si el mock de auth devuelve no autenticado.
- Los estados de error tienen ruta de recuperación (retry, volver a inicio).

---

## FASE 4 — Lanzamiento y revisión

> **Objetivo:** Arrancar la aplicación, detectar errores y dejar un informe de pendientes claro.

### 4.1 Instalar dependencias y arrancar

```bash
{{package_manager}} install
{{dev_command}}
```

Si hay errores de compilación:
1. Leerlos en orden.
2. Corregir uno a uno (nunca suprimir con `@ts-ignore` sin comentar el motivo).
3. Re-arrancar.

### 4.2 Recorrido de revisión automática

Con la app corriendo, verificar cada punto de esta lista:

**Compilación y consola**
- [ ] Zero errores en consola (warnings de terceros son aceptables, anotar)
- [ ] Zero errores TypeScript (si aplica)

**Rutas**
- [ ] Todas las rutas del mapa (Fase 1.3) están accesibles
- [ ] Las rutas inexistentes redirigen a una página 404
- [ ] El router no lanza errores en back/forward del navegador

**UI Kit**
- [ ] Cada componente del UI kit renderiza correctamente en aislamiento
- [ ] Los estados hover y focus son visibles con teclado (outline de foco)

**Pantallas**
- [ ] Cada pantalla renderiza sin errores
- [ ] Los datos mock aparecen en pantalla (no pantallas en blanco)
- [ ] Los estados de carga (skeletons/spinners) se ven antes de que lleguen los datos mock

**Flujo principal**
- [ ] El happy path completo es navegable de inicio a fin
- [ ] Los formularios validan los campos requeridos
- [ ] Las acciones mockeadas muestran feedback (toast, banner, redirección)

**Responsive**
- [ ] Breakpoint móvil (375px) no rompe el layout
- [ ] Breakpoint tablet (768px) no rompe el layout

**Accesibilidad básica**
- [ ] Todos los `<img>` tienen `alt`
- [ ] Todos los placeholders tienen `aria-label`
- [ ] La app es navegable con Tab

### 4.3 Informe final

Genera un archivo `HANDOFF.md` en la raíz del proyecto:

```markdown
# Handoff — <nombre de la app>

Generado: <fecha>

## Estado del proyecto

### ✅ Implementado
- [lista de pantallas y componentes completados]

### 🔶 Mockeado — requiere integración
| Pieza | Archivo | Qué falta |
|---|---|---|
| Auth | src/services/auth.service.ts | Conectar con <proveedor> |
| Pagos | src/pages/checkout/Checkout.tsx | Integrar Stripe |
| … | … | … |

### ❌ Pendiente
- [features del PRD fuera de scope o sin diseño en Figma]

### ⚠️ Anotaciones del diseñador pendientes de implementar
- [animaciones marcadas con // TODO: animate]
- [comportamientos que requieren decisión de producto]

## Cómo arrancar

\`\`\`bash
{{package_manager}} install
{{dev_command}}
\`\`\`

## Estructura de mocks

Los datos mock están en `src/mocks/`. Para conectar una pantalla a datos reales:
1. Reemplazar la importación del mock por la llamada al servicio real en `src/services/`.
2. Eliminar el `await delay()` del servicio.
3. Manejar errores de red en el componente.
```

---

## Checklist global

### Fase 1 — Exploración
- [ ] PRD leído y features extraídas
- [ ] Figma explorado (todas las páginas, depth 3–4)
- [ ] Mapa Figma → PRD construido y confirmado por el usuario
- [ ] UI kit inventariado
- [ ] Gaps documentados y resueltos con el usuario

### Fase 2 — Esqueleto
- [ ] Tokens CSS generados (colores, tipografía, espaciado, radios, sombras)
- [ ] Clases de texto semánticas creadas
- [ ] Assets descargados y organizados
- [ ] Estructura de archivos creada
- [ ] UI kit completo con variantes y estados
- [ ] Router configurado
- [ ] App arranca sin errores

### Fase 3 — Maquetación
- [ ] Shell / layout global implementado
- [ ] Todas las pantallas del happy path implementadas
- [ ] Todas las pantallas secundarias implementadas
- [ ] Estados vacío, error y carga implementados
- [ ] Datos mock en `src/mocks/` con contenido realista
- [ ] Navegación completa y fluida
- [ ] Responsive en breakpoints del Figma

### Fase 4 — Lanzamiento
- [ ] Zero errores de compilación
- [ ] Zero errores en consola
- [ ] Recorrido de revisión completo
- [ ] `HANDOFF.md` generado