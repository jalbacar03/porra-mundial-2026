# CLAUDE.md — Porra Mundial 2026

## Qué es este proyecto
App web de predicciones para el Mundial de Fútbol 2026 entre amigos. Los participantes predicen resultados de partidos y compiten en un leaderboard. ~100 participantes esperados. **NO es plataforma de apuestas: la app no procesa pagos ni los muestra; el admin acepta o rechaza usuarios manualmente.**

## Tech Stack
- **Frontend:** React + Vite
- **Backend/DB:** Supabase (PostgreSQL con RLS habilitado en todas las tablas)
- **Hosting:** Vercel (auto-deploy desde GitHub en cada push)
- **APIs externas:** API-Football (resultados, stats), Google Gemini (crónica diaria), RSS (noticias)
- **Repo:** ver `git remote -v`
- **URL pública:** `https://porra-mundial-2026-omega.vercel.app` (NO `porra-mundial-2026.vercel.app` — ese subdominio sin `-omega` pertenece a otro proyecto, Vercel asignó `-omega` por colisión de nombres)
- **Local:** ver `pwd`

## Base de datos (Supabase)
### Tablas
- `teams` — 48 equipos (42 confirmados + 6 placeholders para playoffs). Columna `api_football_id` para mapeo con API externa
- `matches` — partidos con `home_score`, `away_score` (NULL hasta que se jueguen), `stage`, `group_name`, `status`
- `predictions` — predicciones de usuarios: `predicted_home`, `predicted_away` (¡NO predicted_home_score!)
- `profiles` — campos clave: `full_name` (NO display_name), `has_paid` (boolean), `is_admin` (boolean)
- `pre_tournament_bets` — catálogo de predicciones especiales (goleador, revelación, etc.)
- `pre_tournament_entries` — respuestas de usuarios a predicciones (answer, points_awarded, is_resolved)
- `bracket_picks` — predicciones del cuadro eliminatorio (match_number, round, predicted_winner_id)
- `players` — jugadores para selector autocomplete (~925 jugadores de 26+ equipos)
- `daily_insights` — crónicas diarias generadas por Gemini (date, content)

### Referencia casas de apuestas (antes "Bot365")
- Línea de referencia en el leaderboard basada en predicciones de favoritos/cuotas
- UUID: `b0365b03-65b0-365b-0365-b0365b036500`
- Tiene predicciones de partidos + predicciones pre-torneo
- No aparece como participante — solo como benchmark ("— casas de apuestas —")

### RLS
- Todas las tablas tienen RLS habilitado
- Política especial: "Admins can update matches" permite a admins meter resultados

### Funciones y triggers
- `calculate_match_points(p_match_id BIGINT)` — calcula puntos automáticamente cuando se actualizan resultados
- Trigger `on_match_result_updated` en tabla `matches`
- **IMPORTANTE**: solo calcula puntos cuando `status = 'finished'` (no durante partidos live)
- Scoring partidos: 3 pts resultado exacto, 1 pt signo 1X2 correcto

### Vista
- `leaderboard` — agrega puntos de 3 fuentes: partidos (predictions.points_earned) + pre-torneo (pre_tournament_entries) + bracket (bracket_picks)

## Sistema de puntuación

### Partidos (fase de grupos + eliminatorias)
- 3 pts: resultado exacto
- 1 pt: signo correcto (1X2)
- 0 pts: fallo

### Cuadro de eliminatorias (1-1-2-4-8) — actualizado 2026-06-07
Se puntúa por ACERTAR QUIÉN GANA cada cruce (= avanza de ronda). Estar en una ronda no puntúa; puntúa ganar el partido de esa ronda.
- Ganar en 16avos → octavos (R32, ×16): 1 pt (máx 16) — los 16avos se forman desde grupos; ganar el cruce sí puntúa
- Ganar en octavos → cuartos (R16, ×8): 1 pt (máx 8)
- Ganar en cuartos → semis (QF, ×4): 2 pts (máx 8)
- Ganar en semis → final (SF, ×2): 4 pts (máx 8)
- Ganar la final = campeón (×1): 8 pts (máx 8) — **sin bonus aparte**, ganar la final ya vale 8
- **Cadena del campeón = 16 pts** (1+1+2+4+8). Máximo del cuadro = 48 pts
- Código: `scoreBracketPicks` en `api/sync-results.js`, `ROUND_POINTS = { r32:1, r16:1, qf:2, sf:4, final:8 }`

### Predicciones especiales (rediseño 2026-05-17: 3 bloques, 14 apuestas, 29 pts máx)
**Bloque Jugadores (4):**
- MVP del torneo: 5 pts — manual (admin) post-final
- Bota de Oro (máximo goleador): 3 pts — auto via `/players/topscorers`
- Máximo Asistente: 3 pts — auto via `/players/topassists`
- Guante de Oro (mejor portero): 3 pts — manual (admin) post-final

**Bloque Selecciones (4):**
- Revelación: 3 pts (llega a cuartos)
- Decepción: 3 pts (cae en grupos)
- Más goleadora en grupos: 2 pts
- Menos goleada en grupos: 2 pts

**Bloque ¿Sí o No? (5, 1 pt cada):**
- ¿Hat-trick en el torneo? — auto via `/fixtures/events`
- ¿Goleada por 5+ goles de **diferencia**? (antes era total ≥5)
- ¿Final decidida en penaltis? — status='PEN' del partido final
- ¿Campeón europeo? — UEFA_NATIONS lookup vs winner
- ¿Ambas rojas en un mismo partido? — `/fixtures/events` red+second-yellow

## Automatización (API-Football + Vercel Cron)
- **`/api/sync-results.js`** — Serverless function que sincroniza resultados desde API-Football
- **Vercel Cron**: se ejecuta 1 vez al día (9 AM UTC) — Hobby plan limit
- **Admin backup**: botón manual en pestaña "⚡ Sync API" del panel admin (CRUCIAL durante partidos en vivo)
- **Flujo**: API-Football → actualiza `matches` → trigger calcula puntos (solo status=finished) → leaderboard se actualiza
- **Sync de partidos en vivo**: actualiza scores intermedios con status='live' (no dispara cálculo de puntos)
- **Transición live→finished**: corregido — busca `status !== 'finished'` (no `home_score === null`)
- **Resolución automática**: bota oro, max asistente, revelación (QF), decepción (grupos), hat-trick, goleada diff 5+, más goleadora, menos goleada, final en penaltis, campeón europeo, ambas rojas
- **Resolución manual** (Admin → Pre-torneo): MVP, Guante de Oro (FIFA los anuncia, API-Football no los expone)
- **Hat-trick optimizado**: solo busca eventos en partidos donde un equipo metió 3+ goles (ahorra API calls)
- **Error handling**: apiFetch y supaFetch logean errores y devuelven arrays vacíos (no crashean)
- API-Football: plan Free (100 req/día, 0€). Key: configurada en Vercel env vars

## Crónica del día (Gemini AI)
- **`/api/generate-insight.js`** — Genera crónica diaria con Gemini 2.0 Flash Lite
- Se cachea en tabla `daily_insights` (1 por día)
- Widget 📰 en Dashboard con la crónica
- Coste: ~céntimos para todo el torneo (free tier de Gemini)

## Noticias del Mundial (RSS)
- Feed de noticias en pestaña dedicada
- Fuentes: Marca, AS, BBC Sport vía rss2json.com (100% gratis)
- Botón de actualizar (🔄)

## Admin
- ID del admin: `e2fc4937-cd8d-4cb1-8291-05fa8a66ce97`
- Panel admin con 3 tabs: **Resultados** (meter scores manual) | **Admisiones** (aceptar/rechazar acceso) | **⚡ Sync API** (sincronizar con API-Football)
- Link admin oculto para usuarios normales

## Navegación y páginas

### Bottom nav (móvil) / Top nav (desktop)
- Inicio (Dashboard)
- Predicciones
- Clasificación
- Stats
- Noticias
- Foro
- Normas

### Predicciones — 3 sub-tabs
1. **⚽ Grupos** — Predicciones de partidos + mini clasificación debajo de cada grupo
2. **🏆 Cuadro** — Bracket interactivo (Dieciseisavos → Octavos → Cuartos → Semis → Final)
   - R32 se auto-rellena desde predicciones de grupo (top 2 + 8 mejores terceros)
   - Usuario elige ganador de cada partido, cascadea al siguiente round
3. **🎯 Especiales** — 3 categorías:
   - Jugadores (goleador, asistencias, 3+ goles, 5+ goles, primer gol, portero)
   - Selecciones (revelación, decepción, más goleadora, menos goleada)
   - ¿Sí o No? (hat-trick, goleada 5+)

### Dashboard
- Widget unificado: posición en clasificación + puntos + exactos
- Widget "Informe de jornada" (post-match report automático de la última jornada)
- Widget "Crónica del día" (Gemini)
- Card de acceso a Match Day Live (no en nav, solo desde Dashboard)
- Botones: Mis predicciones + Clasificación
- Top 5 leaderboard con barras visuales
- PointsChart: timeline de puntos acumulados
- Prompt de notificaciones push

### Clasificación
- Tabs: 🏆 General + 🔥 Últimos 3 días
- Solo muestra nombre y puntos (limpio)

### Stats — 6 tabs premium
- **Resumen**: 1X2 global, resultados más predichos, goles por grupo
- **Tú** (Personal): posición, aciertos, distribución, rendimiento por grupo, tú vs la media, **simulador "¿Qué necesitas?"** (gap al rival, partidos clave con divergencias, mejor/peor caso)
- **Partidos**: consensus 1X2 por grupo con OddsBar bet365-style
- **Predicciones**: stats de predicciones especiales (blurred hasta cierre plazo)
- **H2H**: comparador entre 2 participantes (partidos + predicciones)
- **Otros**: ver predicciones de cualquier participante

### Foro
- Chat en tiempo real con Supabase Realtime
- Tabla `forum_messages` (user_id, message, created_at)
- Scroll automático, mensajes con nombre y hora
- Pestaña dedicada en bottom/top nav

### Normas
- Página completa con todas las reglas del torneo

## Diseño visual
Estilo inspirado en Bet365 (dark theme):
- **Fondo principal:** `#1a1d26`
- **Fondo secundario:** `#22252f`
- **Verde acción:** `#007a45` (hover: `#009051`)
- **Dorado highlights:** `#ffcc00`
- **Navbar:** sticky, "PORRA MUNDIAL 26" con el "26" en dorado
- **Countdowns:** rojo en navbar (inicio Mundial 11 jun 2026), dorado en Predictions (deadline 48h)
- Hook reutilizable: `src/hooks/useCountdown.js`

## PWA
- `manifest.json` y `sw.js` configurados, `display: standalone`
- Iconos PNG actualizados (512x512 y 192x192) — diseño "PORRA MUNDIAL 26" con campo de fútbol
- Safe-area configurado para iPhone (top + bottom)
- Nombre PWA: "Porra Mundial 26"

## Responsive
- Desktop: navbar superior
- Móvil: bottom navigation bar
- CSS en `App.css` (importado en `App.jsx`)

## Estructura de archivos clave
```
src/
├── components/
│   ├── PaymentWall.jsx
│   ├── bets/           # BetCard, TeamSelector, PlayerInput, GroupSelector, RangeSelector, YesNoSelector, BetProgress
│   └── bracket/        # BracketView, BracketRound, BracketMatchCard
├── hooks/
│   └── useCountdown.js
├── utils/
│   ├── groupStandings.js      # Calcula clasificación de grupo desde predicciones
│   ├── bracketStructure.js    # Estructura oficial del bracket FIFA 2026 (R32→Final)
│   └── thirdPlaceAssignment.js # Asignación de mejores terceros a partidos R32
├── pages/
│   ├── Dashboard.jsx
│   ├── MatchDayLive.jsx   # Partidos en vivo, predicción vs realidad, leaderboard del día
│   ├── Leaderboard.jsx
│   ├── Stats.jsx
│   ├── Admin.jsx
│   ├── Rules.jsx
│   ├── News.jsx
│   ├── Forum.jsx
│   └── Predictions/
│       ├── PredictionsPage.jsx
│       ├── BeforeWorldCup/
│       │   ├── GroupMatchPredictions.jsx  # Partidos + mini clasificación
│       │   └── PreTournamentBets.jsx     # Predicciones especiales
│       └── DuringWorldCup/
│           └── DuringPlaceholder.jsx
├── App.jsx
├── App.css
├── index.css
├── main.jsx
api/
├── generate-insight.js    # Vercel serverless: crónica diaria con Gemini
├── sync-results.js        # Vercel serverless: sync API-Football → Supabase
scripts/
├── seed-players.js        # Seed jugadores desde API-Football
├── seed-bot365.js         # Predicciones de Bot365
public/
├── manifest.json
├── sw.js
vercel.json               # Cron config (sync diario 9AM UTC)
```

## Variables de entorno
### Frontend (.env.local + Vercel)
- `VITE_SUPABASE_URL` — URL del proyecto Supabase
- `VITE_SUPABASE_ANON_KEY` — clave anónima de Supabase

### Solo Vercel (serverless functions)
- `SUPABASE_URL` — URL del proyecto Supabase (sin VITE_)
- `SUPABASE_SERVICE_KEY` — clave service_role de Supabase
- `GEMINI_API_KEY` — API key de Google Gemini (free tier)
- `API_FOOTBALL_KEY` — API key de API-Football (free tier, 100 req/día)

## Estado actual — Fases completadas
- ✅ Fases 1-14: Setup, auth, DB, predictions, scoring, leaderboard, admin, diseño, admisión de usuarios, countdowns, responsive móvil, PWA completa
- ✅ Dashboard visual: widget unificado posición+puntos, crónica del día, órdagos (blurred)
- ✅ Clasificación: tabs General + Últimos 3 días, diseño limpio
- ✅ Stats: tabs partidos + predicciones, todo blurred con candado hasta cierre
- ✅ Normas: página completa con reglas
- ✅ Noticias: feed RSS en tiempo real (Marca, AS, BBC)
- ✅ Predicciones reestructuradas: Grupos / Cuadro / Especiales
- ✅ Mini clasificaciones debajo de cada grupo (PJ, G, E, P, DG, Pts)
- ✅ Bracket interactivo: Dieciseisavos→Octavos→Cuartos→Semis→Final
- ✅ Auto-relleno R32 desde predicciones de grupo (top 2 + 8 mejores 3º)
- ✅ Cascade bracket: campeón acumula 20 pts (1+2+4+5+8)
- ✅ Predicciones especiales: jugadores, selecciones (revelación 4pts, decepción 4pts), sí/no
- ✅ Player selector autocomplete (~925 jugadores)
- ✅ Bot365: participante ficticio con predicciones basadas en favoritos
- ✅ Crónica del día: Gemini AI genera resumen diario (cacheado)
- ✅ Sync automático: API-Football → Supabase (Vercel Cron diario + manual en Admin)
- ✅ Resolución automática de TODAS las predicciones especiales
- ✅ Admin pro: tabs Resultados / Pagos / Sync API
- ✅ Foro: chat en tiempo real con Supabase Realtime (reacciones, replies, admin moderation)
- ✅ Vercel deploy fix: cron cambiado de cada 2h a diario (Hobby plan limit)
- ✅ Countdown movido junto al logo (evita solape con menú desktop)
- ✅ Seed jugadores completo: 925 jugadores de 26+ equipos
- ✅ Órdagos: 6 órdagos con cascade unlock, coste/recompensa, deadlines
- ✅ Durante el Mundial: Cuadro Real (bracket en vivo) + Órdagos
- ✅ Ver predicciones de otros: tab en Stats con predicciones de cada participante
- ✅ H2H comparador: modal + tab dedicado en Stats
- ✅ Bracket scoring automático (actualizado 2026-06-07): R32=1, R16=1, QF=2, SF=4, Final=8 (sin bonus aparte). Cadena campeón=16, máx cuadro=48
- ✅ Leaderboard incluye: partidos + pre-torneo + órdagos + bracket
- ✅ Stats premium: hero cards, OddsBar bet365-style, gradient-text, animaciones
- ✅ Tabs pill (borderRadius 20px) unificados en toda la app
- ✅ Leaderboard filtra por has_paid (usuarios no admitidos no aparecen)
- ✅ Normas accesibles en móvil (footer link en todas las páginas)
- ✅ PointsChart: timeline de puntos acumulados por fecha
- ✅ Match Day Live: partidos en vivo, predicción vs realidad, consensus 1X2, leaderboard del día (acceso desde Dashboard)
- ✅ Informe de jornada: widget automático en Dashboard (exactos/signos/fallos + mejor predicción)
- ✅ Simulador "¿Qué necesitas?": gap al rival, partidos clave con divergencias, mejor/peor caso (en Stats > Tú)
- ✅ Sync live matches: API-Football sincroniza scores intermedios con status='live'
- ✅ Trigger protegido: calculate_match_points solo ejecuta cuando status='finished'
- ✅ Fix crítico: transición live→finished corregida (status !== 'finished' en vez de home_score === null)
- ✅ Hat-trick optimizado: solo fetch eventos en partidos con 3+ goles de un equipo
- ✅ Error handling robusto: apiFetch/supaFetch logean errores sin crashear
- ✅ Auditoría completa pre-Mundial: scoring, triggers, sync, leaderboard verificados
- ✅ **Eliminados órdagos (2026-05-17)** — feature retirada. Tag `pre-ordagos-removal-2026-05-17` + rama `archive/ordagos-feature` para rollback. Tablas `ordagos`/`ordago_entries` se mantienen en DB pero sin uso. Vista leaderboard reescrita sin `ordago_points`.
- ✅ **Rediseño especiales (2026-05-17)** — 14 apuestas en 3 bloques (Jugadores 5/3/3/3 · Selecciones 3/3/2/2 · Sí-No 1×5). Total 29 pts. MVP y Guante de Oro manuales (admin), resto auto vía API-Football.
- ✅ **Registro con identificación obligatoria (2026-05-17)** — signup exige nombre+apellido reales (≥2 palabras). Nickname opcional. Cláusula en Rules.
- ✅ **Reset usuarios (2026-05-17)** — borradas todas las predictions/bracket_picks/pre_tournament_entries de humanos. Bot365 conserva sus 72 predicciones de partidos y 31 bracket_picks como línea de referencia.

## Estado actual — Sesión más reciente (mayo 2026)

### Lo nuevo desplegado en esta tanda
- ✅ **5 pantallas redesigned** (Dashboard, Leaderboard, Predictions, Bracket, Órdagos) + Stats sub-tabs polish + Admin polish
- ✅ **Forum redesign**: WhatsApp-style bubbles, fixed bottom layout, visualViewport para teclado iOS, tap-to-show actions
- ✅ **MatchDetail page nueva**: ruta `/match/:id` con score selector botones 0-5+, summary de potencial
- ✅ **Bracket "Cuadro ciego"**: 4 columnas (Octavos/Cuartos/Semi/Final), badges puntos por ronda, R32 colapsable
- ✅ **Avatar = solo iniciales** (sin foto, sin picker — política producto). `<Avatar name=… />` deriva de full_name
- ✅ **Widget "Tu progreso"** en Dashboard (Grupos / Especiales / Cuadro), solo pre-deadline
- ✅ **PWA install banner** discreto con guía iOS (Compartir → Añadir a pantalla de inicio)
- ✅ **Web Push background** completo: VAPID keys, tabla `push_subscriptions`, `useNotifications.subscribePush()`, fan-out desde sync-results.js post-finished
- ✅ **Realtime push** (Supabase Realtime) en Leaderboard / Dashboard / MatchDayLive — refrescan <1s al cambiar `matches`
- ✅ **Crónica de 2 niveles**: short (45-55 palabras, dashboard) + long (280-360 palabras estilo Economist, modal "Leer más"). 2 llamadas Gemini en paralelo
- ✅ **Onboarding state en DB** (`onboarding_seen_at`), no localStorage
- ✅ **PaymentWall mejorado**: copy "Solicitar acceso" + persiste `access_requested_at` (admin lo ve en su panel)
- ✅ **Bug crítico arreglado**: 27 partidos knockout faltaban en DB → INSERT placeholders, sync los rellena con dates reales
- ✅ **RLS deadline enforcement** en predictions / pre_tournament_entries / bracket_picks (defensa en profundidad — admin bypass incluido)
- ✅ **Bracket assignment**: greedy → backtracking (algunos casos de 3rd-place dejaban slot 87 vacío)
- ✅ **CRON_SECRET dual auth**: opt-in. Si lo pones en env, sync-results acepta cron secret O JWT admin
- ✅ **Bundle split**: react / supabase / sentry en chunks separados → app code 126KB → 24KB gzipped
- ✅ **FootballSpinner**: SVG balón animado reemplaza "Cargando..." en 11 sitios
- ✅ **Smoke test end-to-end pasado**: signup → trigger handle_new_user → admision → predicción → trigger calculate_match_points → leaderboard refleja puntos
- ✅ **Landing page**: `/info.html` con og: meta tags

### DB schema actual (cambios recientes)
- `profiles`: añadidos `avatar_url` (deprecado, ignorado por frontend pero no borrado), `avatar_changes_count` (deprecado), `onboarding_seen_at`, `access_requested_at`
- `daily_insights`: añadido `content_long` (versión larga de la crónica)
- `push_subscriptions`: tabla nueva (id, user_id, endpoint, p256dh, auth, user_agent, last_used_at)
- `supabase_realtime` publication incluye: `matches`, `forum_messages`, `forum_reactions`
- `matches`: 103 filas totales (72 group + 16 R32 + 8 R16 + 4 QF + 2 SF + 1 Final). Knockout matches con teams=NULL hasta que sync los rellene con datos de API-Football

### Pendientes próximos (orden de prioridad)
1. **Seed jugadores día 2 jun** — ejecutar `scripts/seed-players.js` con plantillas oficiales cuando se publiquen
2. **Re-seed Bot365 pre-tournament** — Bot365 quedó sin pre_tournament_entries (set viejo). Hay que actualizar `scripts/seed-bot365.js` y re-ejecutar con los 14 nuevos slugs
3. **Activar Vercel Pro** cuando empiece el Mundial → cron `*/5` para resultados quasi-live (actualmente daily)
4. **API-Football Pro plan** si queremos sync más frecuente que diario (Free: 100 req/día = no llega para live)
5. **PDF normas** — regenerar con look&feel de la porra cuando el contenido esté finalizado (sustituye al .docx)
6. **Captar e invitar a los ~95 participantes restantes** — solo 4 paid + Bot365 en DB
7. **Opcional**: `CRON_SECRET=<random>` en Vercel → activa dual-auth montada

### Pendientes — código (no urgentes)
- **Newsletter Resend** — declinado por usuario
- Email digest, Sentry DSN real, métricas de uso

### Variables Vercel necesarias para que TODO funcione
Frontend (con prefijo VITE_):
- `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
- `VITE_VAPID_PUBLIC_KEY` (para push background)

Solo serverless (sin VITE_):
- `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`
- `GEMINI_API_KEY`, `API_FOOTBALL_KEY`
- `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (para push background)
- `CRON_SECRET` (opcional, opt-in hardening)

## Notas importantes
- NUNCA cambiar nombres de columnas existentes (predicted_home, predicted_away, full_name, has_paid, is_admin)
- Supabase SQL Editor no soporta `auth.uid()` en queries manuales — usar UUID literal
- El Service Worker puede cachear agresivamente — si el usuario no ve cambios, borrar PWA y reinstalar desde Safari
- Vercel despliega automático con cada push a main
- API-Football free tier: 100 req/día (sobra para 3-4 partidos/día durante el Mundial)
- Gemini free tier: 15 RPM, prácticamente gratis
- Revelación = llega a cuartos de final. Decepción = cae eliminada en fase de grupos.
- Prioridad: avanzar rápido e iterar, no sobre-ingenierar
