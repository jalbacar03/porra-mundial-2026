/**
 * FIFA 2026 World Cup — Third-place team assignment to R32 slots.
 *
 * With 12 groups, 8 of the 12 third-place teams qualify.
 * Which third-place teams qualify determines which R32 match slots they fill.
 *
 * The FIFA system has a lookup table with C(12,8) = 495 possible combinations.
 * For our prediction app, we use a simplified deterministic assignment:
 * once we know which 8 groups produce qualifying third-place teams,
 * we assign them to their designated R32 slots.
 *
 * R32 matches that involve a third-place team:
 * Match 74: 1E vs 3rd from {A,B,C,D,F}
 * Match 77: 1I vs 3rd from {C,D,F,G,H}
 * Match 79: 1A vs 3rd from {C,E,F,H,I}
 * Match 80: 1L vs 3rd from {E,H,I,J,K}
 * Match 81: 1D vs 3rd from {B,E,F,I,J}
 * Match 82: 1G vs 3rd from {A,E,H,I,J}
 * Match 85: 1B vs 3rd from {E,F,G,I,J}
 * Match 87: 1K vs 3rd from {D,E,I,J,L}
 *
 * Each match has a pool of eligible groups. We assign the qualifying
 * third-place teams to matches by picking the first eligible group.
 */

// Match slots that need a third-place team, with their eligible group pools
const THIRD_PLACE_SLOTS = [
  { matchNumber: 74, eligibleGroups: ['A', 'B', 'C', 'D', 'F'] },
  { matchNumber: 77, eligibleGroups: ['C', 'D', 'F', 'G', 'H'] },
  { matchNumber: 79, eligibleGroups: ['C', 'E', 'F', 'H', 'I'] },
  { matchNumber: 80, eligibleGroups: ['E', 'H', 'I', 'J', 'K'] },
  { matchNumber: 81, eligibleGroups: ['B', 'E', 'F', 'I', 'J'] },
  { matchNumber: 82, eligibleGroups: ['A', 'E', 'H', 'I', 'J'] },
  { matchNumber: 85, eligibleGroups: ['E', 'F', 'G', 'I', 'J'] },
  { matchNumber: 87, eligibleGroups: ['D', 'E', 'I', 'J', 'L'] }
]

/**
 * Assign qualifying third-place teams to R32 match slots.
 *
 * Uses backtracking to find a complete valid assignment respecting eligibility.
 * Plain greedy fails on ~12% of inputs: e.g. if slot 79 (eligible {C,E,F,H,I})
 * grabs the only F-group third before slot 81 (eligible {B,E,F,I,J}) gets a
 * chance, slot 81 may end up unfilled even when a valid assignment exists.
 *
 * @param {Array} qualifyingThirds - Array of { team, group, pts, gd, gf }
 *   sorted by rank (best first), length = 8
 * @returns {Object} { matchNumber: { team, group } }
 */
export function assignThirdPlaceTeams(qualifyingThirds) {
  if (!qualifyingThirds || qualifyingThirds.length === 0) return {}

  const qualifyingGroups = new Set(qualifyingThirds.map(t => t.group))

  // Backtracking: try each slot in order; for each slot try every eligible
  // third (in rank order so the best available goes to the earliest slot we
  // can place it, matching the greedy bias). If a branch dead-ends, undo and
  // try the next candidate.
  function backtrack(slotIdx, used, partial) {
    if (slotIdx === THIRD_PLACE_SLOTS.length) return partial
    const slot = THIRD_PLACE_SLOTS[slotIdx]
    for (const t of qualifyingThirds) {
      if (used.has(t.group)) continue
      if (!slot.eligibleGroups.includes(t.group)) continue
      if (!qualifyingGroups.has(t.group)) continue
      used.add(t.group)
      partial[slot.matchNumber] = { team: t.team, group: t.group }
      const r = backtrack(slotIdx + 1, used, partial)
      if (r) return r
      used.delete(t.group)
      delete partial[slot.matchNumber]
    }
    return null
  }

  const complete = backtrack(0, new Set(), {})
  if (complete) return complete

  // No perfect matching exists (rare — would mean the qualifying set is
  // structurally incompatible with the slot eligibility pools). Fall back to
  // best-effort greedy so the bracket still shows what it can.
  const partial = {}
  const used = new Set()
  for (const slot of THIRD_PLACE_SLOTS) {
    const e = qualifyingThirds.find(t =>
      slot.eligibleGroups.includes(t.group) && !used.has(t.group) && qualifyingGroups.has(t.group)
    )
    if (e) { partial[slot.matchNumber] = { team: e.team, group: e.group }; used.add(e.group) }
  }
  return partial
}

export { THIRD_PLACE_SLOTS }
