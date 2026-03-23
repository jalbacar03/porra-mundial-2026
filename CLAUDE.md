# CLAUDE.md — Porra Mundial 2026

## Qué es este proyecto
App web de predicciones para el Mundial de Fútbol 2026. Los participantes pagan una cuota (~25€), predicen resultados de partidos, y compiten en un leaderboard por premios (80% del bote). El organizador se lleva el 20% de comisión. ~100 participantes esperados.

## Tech Stack
- **Frontend:** React + Vite
- **Backend/DB:** Supabase (PostgreSQL con RLS habilitado en todas las tablas)
- **Hosting:** Vercel (auto-deploy desde GitHub en cada push)
- **Pagos:** Bizum (manual, con PaymentWall popup en la app)
- **Repo:** github.com/jalbacar03/porra-mundial-2026
- **URL:** porra-mundial-2026-omega.vercel.app
- **Local:** ~/Desktop/porra-mundial-2026

## Base de datos (Supabase)
### Tablas
- `teams` — 48 equipos (42 confirmados + 6 placeholders para playoffs)
- `matches` — partidos con `home_score`, `away_score` (NULL hasta que se jueguen)
- `predictions` — predicciones de usuarios: `predicted_home`, `predicted_away` (¡NO predicted_home_score!)
- `profiles` — campos clave: `full_name` (NO display_name), `has_paid` (boolean), `is_admin` (boolean)
- `special_challenges` — retos especiales del sistema de fichas
- `challenge_entries` — participaciones en retos

### RLS
- Todas las tablas tienen RLS habilitado
- Política especial: "Admins can update matches" permite a admins meter resultados

### Funciones y triggers
- `calculate_match_points(p_match_id BIGINT)` — calcula puntos automáticamente cuando se actualizan resultados
- Trigger `on_match_result_updated` en tabla `matches`
- Scoring: 3 pts resultado exacto, 1 pt signo 1X2 correcto

### Vista
- `leaderboard` — agrega puntos totales, aciertos exactos, aciertos de signo, fallos por usuario

## Admin
- ID del admin (Javier): `e2fc4937-cd8d-4cb1-8291-05fa8a66ce97`
- Panel admin accesible solo si `is_admin = true`
- Link admin oculto para usuarios normales

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
├── components/    # PaymentWall, etc.
├── hooks/         # useCountdown.js
├── pages/         # Dashboard, Predictions, Leaderboard, Stats, Admin
├── App.jsx
├── App.css
├── index.css
├── main.jsx
public/
├── manifest.json
├── sw.js
```

## Variables de entorno
- `VITE_SUPABASE_URL` — URL del proyecto Supabase
- `VITE_SUPABASE_ANON_KEY` — clave anónima de Supabase
- Deben estar configuradas tanto en `.env.local` (local) como en Vercel (Settings > Environment Variables)

## Estado actual — Fases completadas
- ✅ Fases 1-14: Setup, auth, DB, predictions, scoring, leaderboard, admin, diseño, pagos Bizum, countdowns, responsive móvil, PWA completa (iconos PNG, safe-area, nombre)
- ✅ PWA polish: iconos nuevos "PORRA MUNDIAL 26" desplegados
- ✅ Página Stats (Consenso de la porra): barras 1X2 por partido, pronóstico favorito, stats globales, tabs por grupo

## Pendientes próximos
1. **Panel admin profesional** — mejorar UX del panel de administración
2. **Configurar nº Bizum real** en PaymentWall
3. **Dashboard visual** — Recharts, perfil participante, mejoras visuales
4. **Ver apuestas de otros** — después del cierre de un partido, ver cómo apostó cada persona
5. **Apuestas especiales diarias** — retos especiales diarios durante el torneo
6. **Predicciones eliminatorias** — equipos que llegan a cada fase, campeón, máximo goleador, etc.
7. **Engagement** — tarjeta compartible, badges/logros, comparador H2H, feed actividad
8. **Automatización** — API-Football para resultados automáticos, emails con Resend
9. **Inteligencia** — Insights con Claude API

## Notas de la sesión 23/03/2026
- El problema de "barra descuadrada" en Inicio/Ranking en iPhone era por contenido corto (no llenaba la pantalla), NO por safe-area. Las páginas con más contenido (Predicciones, Admin) no tenían el problema.
- Vercel despliega automático con cada push a main
- El Service Worker puede cachear agresivamente — si el usuario no ve cambios, borrar PWA y reinstalar desde Safari

## Reglas importantes
- NUNCA cambiar nombres de columnas existentes (predicted_home, predicted_away, full_name, has_paid, is_admin)
- Supabase SQL Editor no soporta `auth.uid()` en queries manuales — usar UUID literal
- El usuario (Javier) tiene poca experiencia técnica — explicar cada paso de forma clara
- Prioridad: avanzar rápido e iterar, no sobre-ingenierar
