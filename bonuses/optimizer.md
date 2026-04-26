/**
* =============================================================================
* optimizer.js — Generic Slot Optimizer
* =============================================================================
*
* PURPOSE
* -------
* Finds the optimal assignment of items into containers to maximize a single
* bonus value. Designed to be completely independent of the main app — it
* knows nothing about Vue, the UI, or game-specific concepts. It only knows
* about containers, items, and bonuses.
*
* CORE CONCEPTS
* -------------
* CONTAINER
*   A thing that holds items. Has a fixed number of slots and a limit on how
*   many exclusive items it can hold.
*   Examples: rune circle, gear slot, skill socket
*
* EXCLUSIVE ITEM
*   An item that occupies multiple slots and can only appear once per container.
*   Combinations of exclusive items are brute-forced (small N assumed).
*   Examples: runewords
*
* STACKABLE ITEM
*   An item that occupies exactly 1 slot with no exclusivity constraints.
*   Selected greedily by marginal value (no combinatorics needed).
*   Examples: runes, gems
*
* BONUS TYPES
*   Items can contribute to a bonus in three unit types that compound together:
*   - flat:       additive raw value          (e.g. +10 hp)
*   - percent:    additive percentage          (e.g. +5% hp)
*   - multiplier: multiplicative scalar        (e.g. ×1.2 hp)
*
*   Final value formula:
*     final = flat × (1 + percent/100) × multiplier
*
* MARGINAL VALUE
*   Instead of comparing raw bonus values, each item is scored by how much
*   it actually increases the final compounded result given current totals.
*   Partial derivatives of the final formula:
*     +1 flat       → (1 + percent/100) × multiplier
*     +1 percent    → flat × 0.01 × multiplier
*     +1 multiplier → flat × (1 + percent/100)
*   This means a +1% rune correctly evaluates to +10 when base flat is 1000,
*   rather than being compared as +1 vs +10 flat.
*
* ALGORITHM
* ---------
* 1. Pre-filter exclusive items: keep if they contribute to the bonus OR are
*    small enough that remaining slots could be filled profitably with stackables.
* 2. Pre-filter stackable items: keep only those contributing to the bonus.
* 3. Generate all combinations of exclusive items (0 to containers.length).
* 4. For each combination:
*    a. Fit exclusive items into containers (largest first).
*    b. Score remaining stackables by marginal value given current totals.
*    c. Greedily fill remaining slots with top-scored stackables.
*    d. Compute final compounded total.
* 5. Return the combination with the highest final total.
*
* COMPLEXITY
* ----------
* Exclusive items: O(C(n,k)) where n = exclusive items, k = containers.
*   Expensive if n is large, but runewords are assumed to be few (<30).
* Stackable items: O(m log m) for sort, O(1) per slot fill.
*   Scales to hundreds of rune types with no issue.
*
* EXTENDING
* ---------
* The optimizer is intentionally unaware of game systems. To add new systems:
*
* Gear slots:
*   containers: [{ id: 'helmet', slots: 1, maxExclusive: 1 }, ...]
*   exclusiveItems: gear items (size: 1)
*   stackableItems: [] (no stackables in gear)
*   Note: with size=1 exclusives, no combinatorics needed — optimizer
*   naturally degrades to per-slot best-item selection.
*
* New runeword sizes:
*   Just set size: N on the runeword. No other changes needed.
*
* New constraints (e.g. runeword requires specific circle):
*   Pre-filter exclusiveItems before passing to optimize(), or add a
*   container-filter function to the item definition.
*
* Better algorithm for large N:
*   Replace getCombinations() + tryAssignment() with a smarter search
*   (greedy, DP, branch-and-bound). The optimize() signature never changes.
*
* =============================================================================
*
* API
* ---
*
* optimize(containers, exclusiveItems, stackableItems, bonusId, currentTotals)
*
*   containers: Array<{
*     id:           string   — unique identifier
*     slots:        number   — total slot capacity
*     maxExclusive: number   — max exclusive items allowed (usually 1)
*   }>
*
*   exclusiveItems: Array<{
*     id:      string
*     name:    string
*     size:    number        — slots consumed (2+)
*     bonuses: Array<Bonus>
*   }>
*
*   stackableItems: Array<{
*     id:      string
*     name:    string
*     bonuses: Array<Bonus>
*   }>
*
*   bonusId: string          — the bonus id to maximize (e.g. 'attack_damage')
*
*   currentTotals: {         — contributions from all other sources (not runes)
*     flat:       number     — default 0
*     percent:    number     — default 0
*     multiplier: number     — default 1
*   }
*
*   Bonus: {
*     bonus:     string      — bonus id
*     value:     number
*     unit_type: 'flat' | 'percent' | 'multiplier'
*   }
*
*   Returns: {
*     total:      number     — final compounded value
*     assignment: Array<{    — one entry per container
*       id:        string
*       slots:     number
*       remaining: number    — unused slots
*       items:     Array     — placed items (_exclusive: true for runewords)
*     }>
*   }
*
* =============================================================================
*
* KNOWN LIMITATIONS
* -----------------
* - Stackable scoring is computed once after all exclusives are placed.
*   If two stackable types interact (e.g. one amplifies the other), the greedy
*   approach may not find the true optimum. Currently no such interactions exist.
*
* - Exclusive combinations are brute-forced. If runewords ever number in the
*   hundreds, getCombinations() must be replaced with a smarter search.
*
* - multiplier default is 1 (neutral). If currentTotals.multiplier is 0
*   (no multiplier sources), flat and percent gains will also evaluate to 0.
*   Callers must ensure multiplier is at least 1 if no multiplier sources exist.
*
* =============================================================================
  */