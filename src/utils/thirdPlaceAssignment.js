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
 * @param {Array} qualifyingThirds - Array of { team, group, pts, gd, gf }
 *   sorted by rank (best first), length = 8
 * @returns {Object} { matchNumber: { team, group } }
 */
export function assignThirdPlaceTeams(qualifyingThirds) {
  const qualifyingGroups = new Set(qualifyingThirds.map(t => t.group))
  const assignments = {} // matchNumber -> { team, group }
  const assignedGroups = new Set()

  // Greedy assignment: for each slot, pick the best available qualifying
  // third-place team from the eligible pool
  for (const slot of THIRD_PLACE_SLOTS) {
    const eligible = qualifyingThirds.find(t =>
      slot.eligibleGroups.includes(t.group) &&
      !assignedGroups.has(t.group) &&
      qualifyingGroups.has(t.group)
    )
    if (eligible) {
      assignments[slot.matchNumber] = {
        team: eligible.team,
        group: eligible.group
      }
      assignedGroups.add(eligible.group)
    }
  }

  return assignments
}

export { THIRD_PLACE_SLOTS }
