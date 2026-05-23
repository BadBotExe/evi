1. THE ASSISTANT MUST OPTIMIZE FOR DELIVERING THE FINAL CORRECT STATE, NOT FOR CONVERSATIONAL SAFETY OR OPTIONAL COMPATIBILITY.
2. ON ANY DEVIATION FROM THE REQUIREMENTS BELOW YOU SHOULD IMMEDIATELY STOP.
2. ALL FILES SHOULD BE CONSIDERED UTF-8. THERE IS NO WAY YOU TREAT ANY OF FILES AS ASCII. YOU CANNOT RUN ANY TOOL TO 
   GET OR SET A FILE CONTENT WITHOUT EXPLICITLY PASSING AN ENCODING TO THIS TOOL. ALL TOOLS NOT DIRECTLY SUPPORTING
   UTF-8 ARE BANNED.
2. TESTS HAVE PRIORITY OVER CODE. IF A TEST IS FAILING IT MEANS ONLY THAT YOU BROKE CODE. TESTS CANNOT BE MODIFIED 
   UNLESS AN EXPLICIT PERMISSION ABOUT THIS PARTICULAR TEST IS GRANTED. You can freely create new tests only.
3. Work doggedly. Your goal is to be autonomous as long as possible. If you know the user's overall goal, and there is 
   still progress you can make towards that goal, continue working until you can no longer make progress. Whenever you
   stop working, be prepared to justify why.
4. Work smart. When debugging, take a step back and think deeply about what might be going wrong. When something is not
   working as intended, add logging to check your assumptions.
5. Check your work. If you write a chunk of code, try to find a way to run it and make sure it does what you expect. If
   you kick off a long process, wait 30 seconds then check the logs to make sure it is running as expected.
6. Be cautious with terminal commands. Before every terminal command, consider carefully whether it can be expected to
   exit on its own, or if it will run indefinitely (e.g. launching a web server). For processes that run indefinitely,
   always launch them in a new process (e.g. nohup). Similarly, if you have a script to do something, make sure the 
   script has similar protections against running indefinitely before you run it.
7. Always choose decision that is production grade. Hacks and dirty code are not tolerated.
8. The code should be structured properly. No solution containing everything in ome big file, no large methods. Always
   follow the best principles guides. Always reuse code.
9. For any logic implemented a set of tests should be added too.
10. Once you finish coding, verify that nothing is broken by running tests.
11. This project uses UTF-8 characters in files and custom JSON compact formatting that should be preserved. Under no
    circumstance JSON.stringify should be used.
12. All changes must be made consciously, no guesswork.
13. Under no circumstances should small files containing only 1-2 functions be created.
14. If the user’s message can be satisfied by action, you must act instead of discussing. Any explanatory or reflective
    response is forbidden unless the user explicitly asks for explanation.
15. Before introducing any new UI pattern, visual styling, number/date formatting, helper, or data-shaping convention,
    you must first search the repository and identify the existing implementation used by the app for the same concern.
    If a matching pattern/helper exists, you must reuse it or mirror it exactly unless the user explicitly asks for a
    new pattern.
16. For formatting and presentation specifically:
    - Do not invent local formatting logic if the repo already has a shared formatter or an established output style.
    - Do not use platform-default formatting APIs opportunistically just because they are available.
    - First find the exact formatter/helper/component already used for the same kind of value or control in the repo.
17. For UI controls specifically:
    - Before adding a new chevron, badge, toggle, chip, popover trigger, row layout, or visual hierarchy treatment,
      inspect existing app code and copy the established behavior, orientation, spacing, and colors from there.
    - If you have not checked existing implementation sites in the repo, you are not allowed to introduce the control.
18. If no existing pattern/helper can be found after targeted search, say that explicitly in your reasoning and only
    then implement a new local solution.

Project context:
- Repository purpose: static web tooling for the game Evitania. The repo contains multiple browser apps and shared JSON/asset catalogs instead of a single monolith.
- Tech stack: plain browser JavaScript plus Vue 3 in `bonuses`. No bundler is present; apps load JSON/assets directly and use cache-busted query strings in file references.
- Build/test tooling: Node scripts are mainly for generated image atlases and bonus cache stamping. `sharp` is used for atlas generation.

Subsystems:
- `bonuses/`: main Vue 3 application and the most actively developed part of the repo. It loads `bonuses/bonuses.json`, then resolves many source JSON files plus shared data from `../items/items.json` and `../items/item-sources.json`.
- `bonuses/` responsibilities: browse bonus sources, inspect items, calculate maximum obtainable bonus values, show resource breakdowns, load player saves, and run the engineering planner. It can also switch into a cards view by lazily mounting `../cards/module.js`.
- `bonuses/app/`: application-level and feature-level logic only. This is where state orchestration, data loading, URL state, lifecycle, save integration, source resolution, feature helpers, and bonuses-specific business rules belong. Prefer extending these modules instead of putting more logic in `bonuses/app.js`.
- `bonuses/components/`: reusable Vue UI units only. This folder is for panels, popovers, render helpers tightly coupled to Vue components, and UI-specific helpers used by components. `EngineeringPlannerPanel` and `MaxPanel` are key UI surfaces.
- `bonuses/lib/`: low-level shared utilities, pure helpers, math/placement algorithms, and other code that should stay decoupled from Vue app state as much as possible. Files here should be easy to unit test directly from Node.
- `cards/`: separate card viewer application with its own `cards.json`, `index.html`, `style.css`, and embedded runtime in `cards/module.js`.
- `cards/` responsibilities: browse cards by category, switch between normal/hard modes, inspect star tiers, and display drop tables/related rewards. It maintains URL/route-like state (`card`, `mode`, `stars`, `filter`, `tab`) and has dedicated mobile/desktop behavior.
- `items/`: shared item catalog and acquisition-source catalog. `items/items.json` is the canonical list of item metadata/icons/categories/source references; `items/item-sources.json` defines normalized source entities such as acts, zones, veins, trees, bosses, shops, events, engineer, rewards, and unobtainable/legacy sources.
- `items/images/`: shared sprite assets and atlases for materials, gear, cards, curios, runes, engineer currencies, and other item families. `bonuses` depends heavily on this folder for display and source resolution.

Cross-module relationships:
- `bonuses` is the integration hub. It imports shared item/source data from `items` and embeds the `cards` app when the view mode is `cards`.
- `cards` keeps its own card/drop dataset in `cards/cards.json`; it does not read `items/items.json` directly, but its data model overlaps conceptually with the shared item catalog.
- Refactors in one area should preserve direct file loading semantics and relative asset paths. `bonuses` and `cards` both rely on stable JSON schemas and cache-busted asset references rather than a compile step.

Structure rules:
- Do not place new general-purpose JS modules directly in the root of `bonuses/` unless they are true entrypoint/shell files such as `app.js`, `index.html`, `style.css`, `bonuses.json`, generated artifacts, or source data files.
- New `bonuses` JavaScript must go into the correct logical folder from the start:
  `bonuses/app/` for app/feature orchestration,
  `bonuses/components/` for Vue UI,
  `bonuses/lib/` for pure/shared helpers and algorithms.
- If a file is hard to classify, default away from `components/`: Vue rendering/presentation belongs in `components`, bonuses-specific orchestration belongs in `app`, generic logic belongs in `lib`.
- Keep `bonuses/app.js` as a thin entrypoint/composition shell. Do not keep growing it with unrelated logic.
- Prefer small focused modules over dumping unrelated helpers into one large file. New modules should be named by responsibility, not by vague buckets like `misc`, `helpers2`, `temp`, or `newLogic`.
- Tests must live next to the code they verify whenever practical, using sibling `*.test.mjs` files.
- When moving logic between files, move or update the tests in the same change. Do not leave tests stranded in unrelated directories.
- Every meaningful logic change should either add/update a targeted unit test or clearly justify why direct automated coverage is not feasible.
- `npm test` is the required repo-wide verification entrypoint. When adding tests, wire them into the unified test flow instead of creating isolated undocumented commands.
- Preserve direct file-loading semantics and relative path behavior. Do not introduce bundler assumptions into `bonuses`, `cards`, or shared data access.
