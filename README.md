# Tetris

Implementación del clásico **Tetris** en JavaScript vanilla, usando HTML5 Canvas y CSS. Sin dependencias externas, sin frameworks, sin proceso de build: solo abrir y jugar.

![Tech](https://img.shields.io/badge/HTML5-Canvas-orange)
![Tech](https://img.shields.io/badge/CSS3-blueviolet)
![Tech](https://img.shields.io/badge/JavaScript-Vanilla-yellow)

---

## Tabla de contenidos

- [Tetris](#tetris)
  - [Tabla de contenidos](#tabla-de-contenidos)
  - [Qué hace el proyecto](#qué-hace-el-proyecto)
  - [Cómo ejecutar el juego](#cómo-ejecutar-el-juego)
    - [Opción 1: abrir el archivo directamente](#opción-1-abrir-el-archivo-directamente)
    - [Opción 2: servidor local (recomendado)](#opción-2-servidor-local-recomendado)
  - [Controles](#controles)
  - [Power-ups](#power-ups)
  - [Combo y multiplicadores](#combo-y-multiplicadores)
  - [Modo desafío](#modo-desafío)
  - [Cómo funciona](#cómo-funciona)
    - [1. `index.html`](#1-indexhtml)
    - [2. `style.css`](#2-stylecss)
    - [3. `game.js`](#3-gamejs)
    - [Flujo del juego](#flujo-del-juego)
  - [Tecnologías](#tecnologías)
  - [Estructura del proyecto](#estructura-del-proyecto)
  - [Personalización](#personalización)
  - [Licencia](#licencia)

---

## Qué hace el proyecto

Es una versión jugable del Tetris clásico con todas las mecánicas que esperarías:

- Tablero de **10 × 20** celdas.
- Las **7 piezas estándar** (I, O, T, S, Z, J, L) con colores diferenciados.
- Pieza reto **tuerca** (N): 3×3 con hueco vacío en el centro, más difícil de encajar.
- **Rotación** con _wall kicks_ básicos (pequeños desplazamientos para que la pieza pueda rotar pegada a la pared).
- **Soft drop** (bajada acelerada) y **hard drop** (caída instantánea).
- **Pieza fantasma** (_ghost piece_): muestra dónde aterrizará la pieza actual.
- **Vista previa** de la siguiente pieza.
- **Sistema de puntuación** clásico de Tetris (100 / 300 / 500 / 800 multiplicado por nivel).
- **Niveles** que aumentan cada 10 líneas y aceleran la caída.
- **Pausa** y **Game Over** con opción de reinicio.
- **Power-ups aleatorios**: cada 5 líneas eliminadas aparece una pieza especial de 1 celda con un efecto (ver [Power-ups](#power-ups)).
- **Modo combo y multiplicadores**: encadenar líneas, T-spins, Back-to-Back y Perfect Clear multiplican la puntuación, con aviso visual y sonoro (ver [Combo y multiplicadores](#combo-y-multiplicadores)).
- **Modo desafío**: al iniciar se elige entre partida normal o uno de 5 objetivos especiales (ver [Modo desafío](#modo-desafío)).

---

## Cómo ejecutar el juego

No hay nada que instalar ni compilar. Tienes dos opciones:

### Opción 1: abrir el archivo directamente

```bash
open index.html        # macOS
xdg-open index.html    # Linux
start index.html       # Windows
```

### Opción 2: servidor local (recomendado)

Cualquier servidor estático funciona. Algunos ejemplos:

```bash
# Con Python 3
python3 -m http.server 8000

# Con Node.js (npx)
npx serve .

# Con PHP
php -S localhost:8000
```

Después abre `http://localhost:8000` en el navegador.

---

## Controles

| Tecla     | Acción                            |
| --------- | --------------------------------- |
| `←` / `→` | Mover la pieza horizontalmente    |
| `↑` o `X` | Rotar la pieza en sentido horario |
| `↓`       | Soft drop (bajar más rápido)      |
| `Espacio` | Hard drop (caída instantánea)     |
| `P`       | Pausar / reanudar                 |

---

## Power-ups

Cada **5 líneas** eliminadas (`POWERUP_EVERY`), la siguiente pieza en `NEXT` es reemplazada por una pieza especial de una sola celda. Se controla como cualquier pieza (mover con `←`/`→`, bajar con `↓`/`Espacio`) y su efecto se aplica al fijarse en el tablero, centrado en la celda donde aterriza:

| Icono | Power-up   | Efecto                                                                 |
| ----- | ---------- | ----------------------------------------------------------------------- |
| 💣    | Bomba      | Destruye el área 3×3 alrededor del punto de aterrizaje.                |
| ⚡    | Rayo       | Limpia la fila completa. Pulsa `↑`/`X` antes de soltarla para cambiar a modo vertical y limpiar la columna en su lugar. |
| 🎨    | Tinte      | Convierte todos los bloques del color debajo del punto de aterrizaje en **comodines**: cuentan para completar líneas pero las piezas pueden atravesarlos. |
| 🌀    | Gravedad   | Compacta el tablero: cada columna cae hasta eliminar los huecos.        |
| ❄     | Congelar   | Detiene la caída automática durante 5 segundos (el jugador sigue pudiendo mover/rotar/bajar). |

El panel lateral (`POWER-UP`) muestra cuántas líneas faltan para el próximo power-up, o el tiempo restante de Congelar mientras está activo.

---

## Combo y multiplicadores

Fijar piezas que limpian líneas en turnos consecutivos (sin fallar ninguna en el medio) hace crecer un contador de **combo**: la 2ª limpieza consecutiva multiplica la puntuación de esa jugada por `×2`, la 3ª por `×3`, y así sucesivamente. El panel (`COMBO`) muestra el multiplicador activo; una jugada que no limpia ninguna línea reinicia el combo a cero.

Además de la puntuación base (`LINE_SCORES`), se suman estos bonus:

| Bonus                | Cuándo se activa                                                                 | Puntos base (× nivel)     |
| --------------------- | --------------------------------------------------------------------------------- | -------------------------- |
| **T-spin**             | La última pieza fue una **T**, la última acción fue rotarla (no moverla) y al menos 3 de las 4 esquinas de su caja 3×3 están ocupadas al fijarse (regla de las 3 esquinas). | 400 sin líneas / 800 single / 1200 double / 1600 triple |
| **Back-to-Back (B2B)** | Un Tetris (4 líneas) o T-spin con líneas justo después de otro Tetris/T-spin, sin una limpieza "normal" en el medio. | ×1.5 sobre la puntuación de esa jugada |
| **Perfect Clear**      | La limpieza de líneas deja el tablero completamente vacío.                        | 800 / 1200 / 1800 / 2000 según líneas limpiadas |

Cada bonus dispara un texto flotante sobre el tablero (`COMBO x3!`, `T-SPIN!`, `BACK-TO-BACK!`, `PERFECT CLEAR!`) y un tono generado con la Web Audio API (sin archivos de audio externos).

---

## Modo desafío

Al abrir el juego aparece un menú para elegir modo. Además del **modo normal**, hay 5 desafíos con objetivo propio (panel lateral `DESAFÍO`) y su propia condición de victoria/derrota:

| Desafío              | Objetivo                                                                                          |
| --------------------- | --------------------------------------------------------------------------------------------------- |
| **Contrarreloj**       | Limpiar 40 líneas antes de que se acabe un cronómetro de 2 minutos.                                 |
| **Basura ascendente**  | Sobrevivir 90 segundos mientras cada 10s sube una fila de "basura" desde abajo (con un hueco).      |
| **Bloques fijos**      | Partida normal pero el tablero empieza con las 6 filas inferiores parcialmente rellenas.             |
| **Piezas invisibles**  | La pieza actual (y su fantasma) se vuelve invisible en el instante en que ya no puede bajar más.    |
| **Rotación inversa**   | A partir del nivel 3, `↑`/`X` rota en sentido antihorario en lugar de horario.                       |

Al terminar un desafío el overlay muestra **¡DESAFÍO SUPERADO!** o **DESAFÍO FALLIDO** en vez de "GAME OVER". El botón **Cambiar modo** (en el overlay de pausa/fin de partida) vuelve al menú de selección.

---

## Cómo funciona

El juego se compone de tres archivos que cooperan:

### 1. `index.html`

Define la estructura visual:

- Un `<canvas id="board">` de **300 × 600** píxeles donde se renderiza el tablero.
- Un panel lateral con `SCORE`, `LINES`, `LEVEL`, vista de la siguiente pieza y la lista de controles.
- Un overlay para los estados **PAUSA** y **GAME OVER**.

### 2. `style.css`

Aporta el aspecto visual con estética _dark / retro arcade_: fondo oscuro, tipografía monoespaciada para los marcadores y _backdrop blur_ en los overlays.

### 3. `game.js`

Contiene toda la lógica del juego. A grandes rasgos:

- **Modelo del tablero**: una matriz `ROWS × COLS` donde cada celda guarda `0` (vacía) o un índice de color (1–8) que identifica la pieza.
- **Piezas**: definidas como matrices cuadradas. Para rotar se calcula la transposición + reverso de filas (`rotateCW`).
- **Detección de colisiones** (`collide`): comprueba que ninguna celda de la pieza salga del tablero ni se solape con bloques ya fijados.
- **Wall kicks** (`tryRotate`): si la rotación choca, intenta desplazar la pieza ±1 y ±2 columnas antes de descartar el giro.
- **Game loop** (`loop`): basado en `requestAnimationFrame`, acumula el tiempo transcurrido y baja la pieza una fila cuando se supera `dropInterval`.
- **Limpieza de líneas** (`clearLines`): recorre el tablero de abajo hacia arriba; cada fila completa se elimina y se inserta una vacía en la cima.
- **Puntuación**: usa la tabla clásica `[0, 100, 300, 500, 800]` multiplicada por el nivel actual; el hard drop suma 2 puntos por celda recorrida y el soft drop 1 punto por fila.
- **Nivel y velocidad**: el nivel sube cada 10 líneas; la velocidad de caída se calcula como `max(100, 1000 − (level − 1) × 90)` milisegundos.
- **Ghost piece** (`ghostY`): proyecta la posición final de la pieza actual hacia abajo y la dibuja con `globalAlpha = 0.2`.

### Flujo del juego

```
init()
  ├─ createBoard()                  → matriz vacía
  ├─ next = randomPiece()
  ├─ spawn()                        → mueve next a current y genera nueva next
  └─ requestAnimationFrame(loop)
        ↓
   loop(timestamp)
     ├─ acumula dt
     ├─ si dt ≥ dropInterval → baja la pieza o llama a lockPiece()
     ├─ draw()  (grid + tablero + ghost + pieza actual)
     └─ requestAnimationFrame(loop)

   keydown → mover / rotar / soft-drop / hard-drop / pausa
```

Cuando una pieza recién generada ya colisiona al aparecer (`spawn`), se dispara `endGame()` y se muestra el overlay de **Game Over**.

---

## Tecnologías

- **HTML5** — marcado y dos elementos `<canvas>` (tablero y vista previa).
- **CSS3** — _flexbox_, variables de color, `backdrop-filter` y `box-shadow`.
- **JavaScript (ES6+) vanilla** — `const`/`let`, _arrow functions_, _spread operator_, `Array.from`, _template literals_…
- **Canvas 2D API** — para todo el renderizado del juego.
- **`requestAnimationFrame`** — para el bucle de juego sincronizado con el navegador.

**Sin dependencias.** No hay `package.json`, ni bundler, ni transpilador.

---

## Estructura del proyecto

```
03-tetris/
├── index.html      # Estructura del DOM y canvas
├── style.css       # Estilos del juego (dark theme)
├── game.js         # Toda la lógica del Tetris (~300 líneas)
└── README.md
```

---

## Personalización

Algunos parámetros fáciles de tunear en `game.js`:

| Constante      | Significado                              | Por defecto           |
| -------------- | ---------------------------------------- | --------------------- |
| `COLS`         | Columnas del tablero                     | `10`                  |
| `ROWS`         | Filas del tablero                        | `20`                  |
| `BLOCK`        | Tamaño en píxeles de cada celda          | `30`                  |
| `COLORS`       | Paleta de colores por tipo de pieza      | 8 colores             |
| `LINE_SCORES`  | Puntos por 1, 2, 3 o 4 líneas eliminadas | `[0,100,300,500,800]` |
| `dropInterval` | Velocidad inicial de caída en ms         | `1000`                |

> Si cambias `COLS`, `ROWS` o `BLOCK`, recuerda ajustar también `width` y `height` del `<canvas id="board">` en `index.html` para que coincida (`COLS × BLOCK` × `ROWS × BLOCK`).

---

## Licencia

Proyecto de uso libre con fines educativos y de práctica.
