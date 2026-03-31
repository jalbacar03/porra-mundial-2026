# CLAUDE.md — Porra Mundial 2026

## Qué es este proyecto
App web de predicciones para el Mundial de Fútbol 2026. Los participantes pagan una cuota (~25€), predicen resultados de partidos, y compiten en un leaderboard por premios (80% del bote). El organizador se lleva el 20% de comisión. ~100 participantes esperados.

## Tech Stack
- **Frontend:** React + Vite
- **Backend/DB:** Supabase (PostgreSQL con RLS habilitado en todas las tablas)
- **Hosting:** Vercel (auto-deploy desde GitHub en cada push)
- **APIs externas:** API-Football (resultados, stats), Google Gemini (crónica diaria), RSS (noticias)
- **Pagos:** Bizum (manual, con PaymentWall popup en la app)
- **Repo:** github.com/jalbacar03/porra-mundial-2026
- **URL:** porra-mundial-2026-omega.vercel.app
- **Local:** ~/Desktop/porra-mundial-2026

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
- `resolve_ordago(p_ordago_id INT)` — RPC para resolver órdagos cuando su partido termina

### Vista
- `leaderboard` — agrega puntos de 4 fuentes: partidos (predictions.points_earned) + pre-torneo (pre_tournament_entries) + órdagos (ordago_entries) + bracket (bracket_picks)

## Sistema de puntuación

### Partidos (fase de grupos + eliminatorias)
- 3 pts: resultado exacto
- 1 pt: signo correcto (1X2)
- 0 pts: fallo

### Cuadro de eliminatorias (1-2-4-5-8)
- Dieciseisavos (R32): 0 pts (auto-rellenado desde predicciones de grupo)
- Octavos: 1 pt por acierto (máx 16 pts)
- Cuartos: 2 pts por acierto (máx 16 pts)
- Semifinales: 4 pts por acierto (máx 16 pts)
- Final: 5 pts por acierto (máx 10 pts)
- Campeón: 8 pts
- **Acertar toda la cadena del campeón = 20 pts** (1+2+4+5+8)

### Predicciones especiales
- Revelación: 4 pts (aciertas si tu selección llega a cuartos)
- Decepción: 4 pts (aciertas si tu selección cae en grupos)
- Goleador, asistencias, portero, primer gol: puntos según config
- Más goleadora en grupos, menos goleada en grupos: 3 pts cada una
- Hat-trick, goleada 5+: sí/no

## Automatización (API-Football + Vercel Cron)
- **`/api/sync-results.js`** — Serverless function que sincroniza resultados desde API-Football
- **Vercel Cron**: se ejecuta 1 vez al día (9 AM UTC) — Hobby plan limit
- **Admin backup**: botón manual en pestaña "⚡ Sync API" del panel admin (CRUCIAL durante partidos en vivo)
- **Flujo**: API-Football → actualiza `matches` → trigger calcula puntos (solo status=finished) → leaderboard se actualiza
- **Sync de partidos en vivo**: actualiza scores intermedios con status='live' (no dispara cálculo de puntos)
- **Transición live→finished**: corregido — busca `status !== 'finished'` (no `home_score === null`)
- **Resolución automática de TODAS las predicciones**: goleador, asistencias, revelación (llega a QF), decepción (cae en grupos), hat-trick, goleada 5+, más goleadora, menos goleada, primer gol
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
- ID del admin (Javier): `e2fc4937-cd8d-4cb1-8291-05fa8a66ce97`
- Panel admin con 3 tabs: **Resultados** (meter scores manual) | **Pagos** (marcar Bizum) | **⚡ Sync API** (sincronizar con API-Football)
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
- Widget órdagos con preview del órdago activo
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
- **H2H**: comparador entre 2 participantes (partidos + predicciones + órdagos)
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
- ✅ Fases 1-14: Setup, auth, DB, predictions, scoring, leaderboard, admin, diseño, pagos Bizum, countdowns, responsive móvil, PWA completa
- ✅ Dashboard visual: widget unificado posición+bote, crónica del día, órdagos (blurred)
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
- ✅ Bracket scoring automático: R16=1, QF=2, SF=4, Final=5, Campeón=+8 bonus
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

## Pendientes próximos
1. **Emails** — newsletter diaria con Resend (crónica + leaderboard)

## Notas importantes
- NUNCA cambiar nombres de columnas existentes (predicted_home, predicted_away, full_name, has_paid, is_admin)
- Supabase SQL Editor no soporta `auth.uid()` en queries manuales — usar UUID literal
- El Service Worker puede cachear agresivamente — si el usuario no ve cambios, borrar PWA y reinstalar desde Safari
- Vercel despliega automático con cada push a main
- API-Football free tier: 100 req/día (sobra para 3-4 partidos/día durante el Mundial)
- Gemini free tier: 15 RPM, prácticamente gratis
- Revelación = llega a cuartos de final. Decepción = cae eliminada en fase de grupos.
- Prioridad: avanzar rápido e iterar, no sobre-ingenierar
