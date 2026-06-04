/**
 * Vercel Serverless Function — Preview del email digest
 *
 * GET /api/preview-digest → HTML directo (no envía email).
 * GET /api/preview-digest?mock=true → datos simulados de un día Mundial.
 *
 * Pensado para que el admin pueda ver cómo queda el digest antes de
 * enviarlo a los participantes.
 */

import { buildEmailHTML } from './_digest-template.js'

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY
const APP_URL = process.env.APP_URL || 'https://porramundial2026.app'
const BOT365_ID = 'b0365b03-65b0-365b-0365-b0365b036500'

export default async function handler(req, res) {
  const mock = req.query?.mock === 'true' || req.url?.includes('mock=true')
  // Permite ?mode=friendly o ?mode=mundial para previsualizar cada uno.
  const mode = req.query?.mode || (req.url?.match(/[?&]mode=(\w+)/)?.[1]) || 'mundial'

  let data
  if (mock || !SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    data = mockData(mode)
  } else {
    try {
      data = await realData(req)
      if (!data) data = mockData(mode)
    } catch (e) {
      console.error('preview-digest fallback to mock:', e)
      data = mockData(mode)
    }
  }

  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')
  return res.status(200).send(buildEmailHTML(data))
}

// ─── Mock data: jornada tipo del Mundial (3 partidos) ────────────────

function mockData(mode = 'mundial') {
  return {
    mode,
    userName: 'Javi Albácar',
    rankLabel: '8',
    totalParticipants: 100,
    points: 24,
    exactHits: 5,
    delta: 4,
    posDelta: 3, // subió 3 posiciones
    yourMatches: [
      {
        home: 'España', away: 'Croacia',
        homeScore: 2, awayScore: 1,
        predHome: 2, predAway: 1,
        pts: 3, status: 'exact',
      },
      {
        home: 'Brasil', away: 'Marruecos',
        homeScore: 1, awayScore: 1,
        predHome: 2, predAway: 0,
        pts: 0, status: 'miss',
      },
      {
        home: 'Argentina', away: 'México',
        homeScore: 2, awayScore: 0,
        predHome: 3, predAway: 1,
        pts: 1, status: 'sign',
      },
    ],
    movements: {
      up: [
        { name: 'Ignacio Blasi',   posDelta:  8, fromRank: 13, toRank:  5 },
        { name: 'Pau Bertran',     posDelta:  5, fromRank: 22, toRank: 17 },
        { name: 'Marta Rodríguez', posDelta:  4, fromRank: 31, toRank: 27 },
      ],
      down: [
        { name: 'Alex Miró',       posDelta: -6, fromRank:  4, toRank: 10 },
        { name: 'Pau Dubé',        posDelta: -4, fromRank: 15, toRank: 19 },
        { name: 'Pepe Piera',      posDelta: -3, fromRank: 25, toRank: 28 },
      ],
    },
    yMatches: [
      {
        home_team: { name: 'España',   flag_url: 'https://media.api-sports.io/flags/es.svg' },
        away_team: { name: 'Croacia',  flag_url: 'https://media.api-sports.io/flags/hr.svg' },
        home_score: 2, away_score: 1,
        consensus: { totalPreds: 86, signCorrect: 56, exactCorrect: 10, signPct: 65, exactPct: 12 },
      },
      {
        home_team: { name: 'Brasil',    flag_url: 'https://media.api-sports.io/flags/br.svg' },
        away_team: { name: 'Marruecos', flag_url: 'https://media.api-sports.io/flags/ma.svg' },
        home_score: 1, away_score: 1,
        consensus: { totalPreds: 86, signCorrect: 16, exactCorrect: 1, signPct: 18, exactPct: 1 },
      },
      {
        home_team: { name: 'Argentina', flag_url: 'https://media.api-sports.io/flags/ar.svg' },
        away_team: { name: 'México',    flag_url: 'https://media.api-sports.io/flags/mx.svg' },
        home_score: 2, away_score: 0,
        consensus: { totalPreds: 86, signCorrect: 64, exactCorrect: 18, signPct: 74, exactPct: 21 },
      },
    ],
    top10: [
      { user_id: 'u1',  full_name: 'Pedro J. Albácar', total_points: 41, exact_hits: 8 },
      { user_id: 'u2',  full_name: 'Ignacio Blasi',    total_points: 38, exact_hits: 7 },
      { user_id: 'u3',  full_name: 'Marta Rodríguez',  total_points: 36, exact_hits: 6 },
      { user_id: 'u4',  full_name: 'Pau Bertran',      total_points: 32, exact_hits: 5 },
      { user_id: 'u5',  full_name: 'Javi Casanovas',   total_points: 30, exact_hits: 4 },
      { user_id: 'u6',  full_name: 'Alex Miró',        total_points: 28, exact_hits: 5 },
      { user_id: 'u7',  full_name: 'Pepe Piera',       total_points: 26, exact_hits: 4 },
      { user_id: 'u8',  full_name: 'Javi Albácar',     total_points: 24, exact_hits: 5 },
      { user_id: 'u9',  full_name: 'Pau Dubé',         total_points: 22, exact_hits: 3 },
      { user_id: 'u10', full_name: 'Fernando Albácar', total_points: 21, exact_hits: 4 },
    ],
    rankInfo: {
      u1: { rank: 1,  label: '1'  },
      u2: { rank: 2,  label: '2'  },
      u3: { rank: 3,  label: '3'  },
      u4: { rank: 4,  label: '4'  },
      u5: { rank: 5,  label: '5'  },
      u6: { rank: 6,  label: '6'  },
      u7: { rank: 7,  label: '7'  },
      u8: { rank: 8,  label: '8'  },
      u9: { rank: 9,  label: '9'  },
      u10:{ rank: 10, label: '10' },
    },
    insightText:
      'Jornada de cuartos con un Brasil tropezando ante un Marruecos sólido (1-1) que confirma su estatus de revelación. España resolvió ante Croacia con eficiencia (2-1) y Argentina se impuso a México sin sobresaltos. La sorpresa del día: solo el 18% del grupo vio el empate brasileño.',
    appUrl: APP_URL,
  }
}

async function realData(req) {
  // Para futuras versiones: si quieres preview con tu propia data real,
  // se podría implementar aquí. Por ahora, solo mock — más útil para
  // validar el diseño.
  return null
}
