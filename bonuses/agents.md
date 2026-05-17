A simple Vue 3 JS application to display a list of items and bonuses in a game.

Main files:
- `app.js`: entrypoint/composition shell only. Do not keep app logic growing here unless it is truly top-level composition.
- `index.html`: static shell markup.
- `style.css`: app-level styling.
- `bonuses.json`: main data configuration and references to individual bonuses source files.

Folder responsibilities:
- `app/`: application and feature logic. Put state orchestration, URL state, data loading, save handling, lifecycle logic, source resolution, and bonuses-specific business logic here.
- `components/`: Vue UI components, popovers, panels, and UI-scoped helpers used by components.
- `lib/`: pure/shared helpers, algorithms, math, restore helpers, placement logic, and other low-level modules that should stay mostly independent from Vue/component state.

Hard placement rules:
- Do not add new general-purpose JS files to the root of `bonuses/`.
- If a new file is not an entry file, component, JSON source, generated artifact, or static asset, it almost certainly belongs in `app/`, `components/`, or `lib/`.
- Default rule:
  UI rendering/presentation => `components/`
  bonuses-specific orchestration/business logic => `app/`
  generic reusable logic/algorithms => `lib/`
- Keep modules focused. Do not create vague files like `misc.js`, `helpers2.js`, `tmp.js`, or dump unrelated logic into existing large files.

Testing rules:
- Tests should live next to the file they test whenever practical, using sibling `*.test.mjs` files.
- When moving logic, move/update its tests in the same change.
- Any meaningful logic change should add or update tests.
- Repo-wide verification must continue to work through `npm test`.

Code principles:
- minimum amount of code
- reuse existing code instead of writing new one
- follow best practices
- preserve direct file loading semantics and relative asset paths

Do not use whole-file rewrite commands. Use apply_patch only. Preserve UTF-8 encoding exactly.
