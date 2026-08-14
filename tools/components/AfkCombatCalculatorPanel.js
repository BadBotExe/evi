import { SpriteImage } from '../../bonuses/components/SpriteImage.js?v=a6508ec846';

const AFK_MOBILE_TABS = new Set(['input', 'results', 'formula']);

export const AfkCombatCalculatorPanel = {
    props: ['app'],
    components: { SpriteImage },
    data() {
        return {
            formulaOpen: false,
            mobileTab: 'input',
            locationPickerOpen: false,
            locationSearch: '',
            weaponPickerOpen: false,
            weaponSearch: '',
            mobileHelpOpen: false,
            mobileHelpText: '',
            escapeKeyHandler: null
        };
    },
    computed: {
        state() { return this.app.afkCombatState; },
        player() { return this.state.player; },
        locations() { return this.app.afkCombatLocations(); },
        selectedLocation() {
            return this.locations.find(location => location.id === this.state.locationId) ?? null;
        },
        filteredLocations() {
            const needle = this.locationSearch.trim().toLowerCase();
            if (!needle) return this.locations;
            return this.locations.filter(location => `${location.code} ${location.name}`.toLowerCase().includes(needle));
        },
        selectedEnemy() { return this.app.afkCombatSelectedEnemy(); },
        result() { return this.app.afkCombatResult(); },
        capBreakpoints() { return this.result.capBreakpoints ?? {}; },
        statLimits() { return this.app.afkCombatStatLimits(); },
        difficulties() { return this.app.afkCombatAvailableDifficulties(); },
        weaponOptions() { return this.app.afkCombatWeaponOptions(); },
        selectedWeapon() {
            return this.weaponOptions.find(weapon => weapon.id === this.player.weaponId) ?? null;
        },
        filteredWeaponOptions() {
            const needle = this.weaponSearch.trim().toLowerCase();
            if (!needle) return this.weaponOptions;
            return this.weaponOptions.filter(weapon => weapon.label.toLowerCase().includes(needle));
        },
        selectedWeaponSurvivalBonus() {
            const multiplier = Number(this.selectedWeapon?.survivalMultiplier ?? 1);
            if (!Number.isFinite(multiplier) || multiplier <= 1) return 'None';
            return `+${this.formatFixed((multiplier - 1) * 100, 2)}%`;
        },
        afkHelp() {
            return {
                status: 'Shows whether current kills/hour already equals the location cap. At cap means more damage, crit, attack speed, movement, HP, defence, or regeneration will not increase kills on this location.',
                action: 'The practical next step. If it says Kills capped, improve Gold Multiplier, Exp Multiplier, Offline Gains Rate, or reduce Mob Spawn Time. If it says Increase DPS, improve Atk, Attack Speed, Crit Chance, Crit Damage, or Double Crit.',
                bottleneck: 'The group currently limiting kills and what to improve next. Spawn means the location cannot provide mobs faster: improve Gold Multiplier, Exp Multiplier, Offline Gains Rate, or reduce Mob Spawn Time. Damage means Time to Kill is too high: improve Atk, Attack Speed, Crit Chance, Crit Damage, or Double Crit. Movement means travel time is too high: improve Movement Speed or weapon range. Survival means deaths reduce AFK kills: improve HP, Phys. Defence, HP Regeneration, or weapon survival.',
                offlineRate: 'Your in-game Offline Gains Rate percent. It multiplies final kills, gold, and exp after raw AFK kills are calculated. Example: 125% turns 2544 raw kills into 3180 displayed kills/hour.',
                mobSpawnTime: 'Your final in-game Mob Spawn Time percent. Lower is faster. Example: 71% with a 2s enemy spawn cooldown uses 2 * 0.71 = 1.42s before max-spawn bonus.',
                mobSpawnLimit: 'The selected location cap for kills/hour at the shown Mob Spawn Time and Offline Gains Rate. Formula: (3600 / (enemy spawn cooldown * Mob Spawn Time) + max spawned enemies) * Offline Gains Rate.',
                currentKills: 'Your calculated kills/hour with all current player stats and selected weapon. Final result is the lower value between the location spawn cap and what the character can kill/survive.',
                missingKills: 'How many kills/hour are missing before this location reaches its spawn cap. Zero means the location is already capped.',
                limitBreakdown: 'The result is controlled by the lowest active limit. Compare Mob Spawn Limit, Damage + Movement Limit, and Survival Adjusted Limit to see which group is blocking kills.',
                combatLimit: 'How many kills/hour the character can process from Time to Kill plus Movement Time, before deaths reduce it. Formula: 3600 / (Time to Kill + Movement Time) * Offline Gains Rate.',
                survivalLimit: 'Damage + Movement Limit after survival is applied. If this is lower than Damage + Movement Limit, HP, Phys. Defence, HP Regeneration, or weapon survival is reducing AFK kills.',
                dpsTarget: 'Required damage per second to reach the selected location spawn cap with current Movement Time and Survival. Atk, Attack Speed, Crit Chance, Crit Damage, and Double Crit all feed this one number.',
                currentDps: 'Current outgoing damage per second from the AFK formula. Formula: Atk * Attack Speed * (1 + capped Crit Chance * Crit Damage).',
                dpsGap: 'Required DPS minus current DPS. Positive means more DPS is needed. Zero or negative means damage is already enough for this location cap.',
                dpsProgress: 'Current DPS divided by DPS needed for spawn cap. 100% or more means damage is not the blocker.',
                critMultiplier: 'The multiplier created by Crit Chance and Crit Damage after Crit Chance cap. Example: 130.5% crit and 687% crit damage gives 1 + 1.305 * 6.87 = 9.965x.',
                movementImpact: 'Movement Group explains the travel part of Damage + Movement Limit. Movement Time is added after Time to Kill: higher Movement Speed or higher weapon range lowers this delay. If Damage + Movement Limit is the lowest limit, movement can reduce kills/hour.',
                movementTime: 'Time added for reaching the next enemy. Formula: max(0, (5 - weapon range) / Movement Speed). If weapon range is 5 or higher, this becomes 0.',
                survivalImpact: 'Survival Group explains the death penalty applied after Damage + Movement Limit. HP, Phys. Defence, HP Regeneration, and weapon survival determine Survival. If Survival Adjusted Limit is lower than Damage + Movement Limit, survival is reducing kills/hour.',
                damageTaken: 'Incoming damage after Phys. Defence and HP Regeneration. Formula: max(enemy Atk - Phys. Defence, 0) / 3 - HP Regeneration / 5. Display clamps below zero to 0.',
                timeToDeath: 'How long the character survives under incoming damage. No death means incoming damage is below the AFK death threshold, so survival is not limiting kills.',
                survival: 'AFK survival factor used in kill limit. If it is 100%, survival is not reducing kills. If it is below 100%, improve HP, Phys. Defence, HP Regeneration, or weapon survival.'
            };
        }
    },
    methods: {
        setNumber(field, value) { this.app.setAfkCombatPlayerField(field, value); },
        setPercent(field, value) {
            if (String(value).trim() === '') return;
            this.app.setAfkCombatPlayerField(field, value);
        },
        percentValue(field) {
            const numeric = Number(this.player[field]);
            return Number.isFinite(numeric) ? numeric : 0;
        },
        setDoubleCrit(checked) { this.app.setAfkCombatPlayerField('megaCritCap', checked ? 2 : 1); },
        setLocation(value) {
            this.app.setAfkCombatLocation(value);
            this.locationPickerOpen = false;
            this.locationSearch = '';
        },
        toggleLocationPicker() {
            const nextOpen = !this.locationPickerOpen;
            this.weaponPickerOpen = false;
            this.locationPickerOpen = nextOpen;
            if (this.locationPickerOpen) this.locationSearch = '';
        },
        setWeapon(value) {
            this.app.setAfkCombatWeapon(value);
            this.weaponPickerOpen = false;
            this.weaponSearch = '';
        },
        toggleWeaponPicker() {
            const nextOpen = !this.weaponPickerOpen;
            this.locationPickerOpen = false;
            this.weaponPickerOpen = nextOpen;
            if (this.weaponPickerOpen) this.weaponSearch = '';
        },
        closePickers() {
            this.locationPickerOpen = false;
            this.weaponPickerOpen = false;
        },
        format(value, digits = 2) { return this.app.formatAfkCombatNumber(value, digits); },
        formatFixed(value, digits = 2) {
            const numeric = Number(value);
            if (!Number.isFinite(numeric)) return 'inf';
            return numeric.toLocaleString(undefined, {
                minimumFractionDigits: 0,
                maximumFractionDigits: digits
            });
        },
        formatNonNegativeFixed(value, digits = 2) {
            const numeric = Number(value);
            return this.formatFixed(Number.isFinite(numeric) ? Math.max(0, numeric) : numeric, digits);
        },
        formatTime(value) { return this.app.formatAfkCombatSeconds(value); },
        formatSurvivalTime(value) {
            const numeric = Number(value);
            if (Number.isFinite(numeric) && numeric < 0) return 'No death';
            return this.formatTime(value);
        },
        formatSignedCapNumber(value, digits = 2) {
            const numeric = Number(value);
            if (!Number.isFinite(numeric)) return 'Impossible';
            const sign = numeric > 0 ? '+' : '';
            return `${sign}${this.format(numeric, digits)}`;
        },
        showHelp(event, text) {
            if (event?.type === 'click') {
                this.toggleHelp(event, text);
                return;
            }
            this.app.showTooltip?.(event, text);
        },
        toggleHelp(event, text) {
            event?.preventDefault?.();
            if (this.app.isMobileViewport) {
                this.app.hideTooltip?.();
                this.mobileHelpText = text ?? '';
                this.mobileHelpOpen = true;
                return;
            }
            if (this.app.tooltipVisible && this.app.tooltipText === text) {
                this.app.hideTooltip?.();
                return;
            }
            this.app.showTooltip?.(event, text);
        },
        hideHelp() {
            this.app.hideTooltip?.();
        },
        closeMobileHelp() {
            this.mobileHelpOpen = false;
            this.mobileHelpText = '';
        },
        toggleFormula() { this.formulaOpen = !this.formulaOpen; },
        closeFormula() { this.formulaOpen = false; },
        setMobileTab(tab) {
            if (!AFK_MOBILE_TABS.has(tab)) return;
            this.mobileTab = tab;
            this.app.setAfkCombatMobileTab?.(tab);
            this.locationPickerOpen = false;
            this.weaponPickerOpen = false;
            this.formulaOpen = false;
            this.closeMobileHelp();
        }
    },
    mounted() {
        if (AFK_MOBILE_TABS.has(this.app.afkCombatMobileTab)) {
            this.mobileTab = this.app.afkCombatMobileTab;
        }
        this.pickerOutsideHandler = (event) => {
            this.hideHelp();
            if (this.app.isMobileViewport) return;
            const locationPicker = this.$refs.locationPickerWrap;
            const weaponPicker = this.$refs.weaponPickerWrap;
            if (locationPicker?.contains(event.target) || weaponPicker?.contains(event.target)) return;
            this.closePickers();
        };
        this.escapeKeyHandler = (event) => {
            if (event.key !== 'Escape') return;
            this.hideHelp();
            this.formulaOpen = false;
            this.closePickers();
            this.closeMobileHelp();
        };
        document.addEventListener('pointerdown', this.pickerOutsideHandler);
        document.addEventListener('keydown', this.escapeKeyHandler);
    },
    beforeUnmount() {
        if (this.pickerOutsideHandler) document.removeEventListener('pointerdown', this.pickerOutsideHandler);
        if (this.escapeKeyHandler) document.removeEventListener('keydown', this.escapeKeyHandler);
    },
    template: `
        <section class="source-section engineering-planner-panel tools-afk-combat-panel" :style="{ '--section-color': app.typeColor('engineering_production') }">
            <div class="section-header engineering-planner-header">
                <span>AFK Combat Calculator</span>
            </div>
            <div class="engineering-planner-body">
                <nav class="mobile-tabbar tools-afk-mobile-tabs" role="tablist" aria-label="AFK combat calculator view">
                    <button type="button" class="mobile-tab" :class="{ active: mobileTab === 'input' }" @click="setMobileTab('input')">
                        <span class="mobile-tab-icon tools-afk-tab-icon" aria-hidden="true">
                            <svg viewBox="0 0 24 24"><path d="M4 5h16M4 12h16M4 19h10"></path></svg>
                        </span>
                        <span>Input</span>
                    </button>
                    <button type="button" class="mobile-tab" :class="{ active: mobileTab === 'results' }" @click="setMobileTab('results')">
                        <span class="mobile-tab-icon tools-afk-tab-icon" aria-hidden="true">
                            <svg viewBox="0 0 24 24"><path d="M4 19V5M4 19h16M8 16v-5M12 16V8M16 16v-8"></path></svg>
                        </span>
                        <span>Results</span>
                    </button>
                    <button type="button" class="mobile-tab" :class="{ active: mobileTab === 'formula' }" @click="setMobileTab('formula')">
                        <span class="mobile-tab-icon tools-afk-tab-icon" aria-hidden="true">
                            <svg viewBox="0 0 24 24"><path d="M4 7h16M7 4v6M17 4v6M8 15h8M10 19h4"></path></svg>
                        </span>
                        <span>Formula</span>
                    </button>
                </nav>
                <div class="tools-afk-layout">
                    <div class="tools-afk-controls" :class="{ active: mobileTab === 'input' }">
                        <div class="tools-afk-group">
                            <div class="tools-recipe-section-label">Location</div>
                            <div class="engineering-field">
                                <span class="engineering-field-label">Enemy</span>
                                <div ref="locationPickerWrap" class="tools-calculator-select-wrap tools-picker-wrap" :class="{ open: locationPickerOpen }">
                                    <button type="button" class="tools-mobile-picker-trigger" @click.stop="toggleLocationPicker" @pointerdown.stop>
                                        <sprite-image v-if="selectedLocation?.image" :image="selectedLocation.image" :alt="selectedLocation.name" img-class="tools-mobile-picker-image"></sprite-image>
                                        <span class="tools-mobile-picker-name">{{ selectedLocation?.name ?? 'Select location' }}</span>
                                    </button>
                                    <div v-if="!app.isMobileViewport" class="tools-calculator-dropdown" :class="{ open: locationPickerOpen }" @click.stop @pointerdown.stop>
                                        <div class="tools-calculator-search-wrap">
                                            <input class="tools-calculator-search" type="search" placeholder="Search location" v-model="locationSearch">
                                        </div>
                                        <div class="tools-calculator-options">
                                            <button v-for="location in filteredLocations" :key="location.id" type="button" class="tools-calculator-option tools-picker-option" :class="{ active: location.id === state.locationId }" @click="setLocation(location.id)">
                                                <span class="tools-picker-option-frame">
                                                    <sprite-image v-if="location.image" :image="location.image" :alt="location.name" img-class="tools-picker-option-image"></sprite-image>
                                                </span>
                                                <span class="tools-picker-option-name">{{ location.name }}</span>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                                <div v-if="locationPickerOpen && app.isMobileViewport"
                                      class="mobile-drawer-overlay tools-smeltery-calc-overlay open"
                                      @click="closePickers"></div>
                                <div v-if="locationPickerOpen && app.isMobileViewport"
                                      class="mobile-drawer tools-smeltery-calc-sheet tools-picker-sheet open">
                                    <div class="mobile-drawer-header">
                                        <div class="mobile-drawer-handle"></div>
                                        <button type="button"
                                                class="mobile-drawer-close"
                                                aria-label="Close location picker"
                                                @click="closePickers">&times;</button>
                                    </div>
                                    <div class="mobile-drawer-body tools-picker-wrap">
                                        <div class="tools-calculator-search-wrap">
                                            <input class="tools-calculator-search" type="search" placeholder="Search location" v-model="locationSearch">
                                        </div>
                                        <div class="tools-calculator-options">
                                            <button v-for="location in filteredLocations" :key="location.id" type="button" class="tools-calculator-option tools-picker-option" :class="{ active: location.id === state.locationId }" @click="setLocation(location.id)">
                                                <span class="tools-picker-option-frame">
                                                    <sprite-image v-if="location.image" :image="location.image" :alt="location.name" img-class="tools-picker-option-image"></sprite-image>
                                                </span>
                                                <span class="tools-picker-option-name">{{ location.name }}</span>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div class="engineering-mode-row tools-afk-difficulty-row">
                                <button v-for="difficulty in difficulties" :key="difficulty.id" type="button"
                                        class="engineering-mode-btn"
                                        :class="{ active: state.difficulty === difficulty.id }"
                                        @click="app.setAfkCombatDifficulty(difficulty.id)">{{ difficulty.label }}</button>
                            </div>
                            <div v-if="selectedEnemy" class="tools-afk-enemy-card">
                                <img v-if="selectedEnemy.image" class="tools-afk-enemy-image" :src="selectedEnemy.image" :alt="selectedEnemy.name">
                                <div class="tools-afk-enemy-main">
                                    <div class="tools-afk-enemy-name">{{ selectedEnemy.actLabel }} - {{ selectedEnemy.name }}</div>
                                    <div class="tools-afk-enemy-stats">
                                        <span>HP: {{ format(selectedEnemy.hp, 0) }}</span>
                                        <span>ATK: {{ format(selectedEnemy.attack, 0) }}</span>
                                        <span>Spawn: {{ formatFixed(selectedEnemy.baseSpawnSeconds, 2) }}s</span>
                                        <span>Max: {{ selectedEnemy.maxSpawns }}</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div class="tools-afk-group">
                            <div class="tools-recipe-section-label">Weapon</div>
                            <div class="tools-afk-input-grid">
                                <div class="engineering-field">
                                    <span class="engineering-field-label">Weapon</span>
                                    <div ref="weaponPickerWrap" class="tools-calculator-select-wrap tools-picker-wrap" :class="{ open: weaponPickerOpen }">
                                        <button type="button" class="tools-mobile-picker-trigger" @click.stop="toggleWeaponPicker" @pointerdown.stop>
                                            <sprite-image v-if="selectedWeapon?.image" :image="selectedWeapon.image" :alt="selectedWeapon.label" img-class="tools-mobile-picker-image"></sprite-image>
                                            <span class="tools-mobile-picker-name">{{ selectedWeapon?.label ?? 'Select weapon' }}</span>
                                        </button>
                                        <div v-if="!app.isMobileViewport" class="tools-calculator-dropdown" :class="{ open: weaponPickerOpen }" @click.stop @pointerdown.stop>
                                            <div class="tools-calculator-search-wrap">
                                                <input class="tools-calculator-search" type="search" placeholder="Search weapon" v-model="weaponSearch">
                                            </div>
                                            <div class="tools-calculator-options">
                                                <button v-for="weapon in filteredWeaponOptions" :key="weapon.id" type="button" class="tools-calculator-option tools-picker-option" :class="{ active: weapon.id === player.weaponId }" @click="setWeapon(weapon.id)">
                                                    <span class="tools-picker-option-frame">
                                                        <sprite-image v-if="weapon.image" :image="weapon.image" :alt="weapon.label" img-class="tools-picker-option-image"></sprite-image>
                                                    </span>
                                                    <span class="tools-picker-option-name">{{ weapon.label }}</span>
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                    <div v-if="weaponPickerOpen && app.isMobileViewport"
                                          class="mobile-drawer-overlay tools-smeltery-calc-overlay open"
                                          @click="closePickers"></div>
                                    <div v-if="weaponPickerOpen && app.isMobileViewport"
                                          class="mobile-drawer tools-smeltery-calc-sheet tools-picker-sheet open">
                                        <div class="mobile-drawer-header">
                                            <div class="mobile-drawer-handle"></div>
                                            <button type="button"
                                                    class="mobile-drawer-close"
                                                    aria-label="Close weapon picker"
                                                    @click="closePickers">&times;</button>
                                        </div>
                                        <div class="mobile-drawer-body tools-picker-wrap">
                                            <div class="tools-calculator-search-wrap">
                                                <input class="tools-calculator-search" type="search" placeholder="Search weapon" v-model="weaponSearch">
                                            </div>
                                            <div class="tools-calculator-options">
                                                <button v-for="weapon in filteredWeaponOptions" :key="weapon.id" type="button" class="tools-calculator-option tools-picker-option" :class="{ active: weapon.id === player.weaponId }" @click="setWeapon(weapon.id)">
                                                    <span class="tools-picker-option-frame">
                                                        <sprite-image v-if="weapon.image" :image="weapon.image" :alt="weapon.label" img-class="tools-picker-option-image"></sprite-image>
                                                    </span>
                                                    <span class="tools-picker-option-name">{{ weapon.label }}</span>
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div v-if="selectedWeapon" class="tools-afk-weapon-stats">
                                <span>Range: {{ formatFixed(selectedWeapon.attackRange, 2) }}</span>
                                <span v-if="selectedWeaponSurvivalBonus !== 'None'">Survival: {{ selectedWeaponSurvivalBonus }}</span>
                            </div>
                        </div>

                        <div class="tools-afk-group">
                            <div class="tools-recipe-section-label">Player Combat Stats</div>
                            <div class="tools-afk-input-grid">
                                <label class="engineering-field"><span class="engineering-field-label">Atk</span><input class="engineering-input tools-number-input" type="number" step="1" :value="player.attack" @input="setNumber('attack', $event.target.value)"></label>
                                <label class="engineering-field"><span class="engineering-field-label">Attack Speed (Cap: {{ statLimits.attackSpeedMax }})</span><input class="engineering-input tools-number-input" type="number" step="0.01" :value="player.attackSpeed" @input="setNumber('attackSpeed', $event.target.value)"></label>
                                <label class="engineering-field"><span class="engineering-field-label">Crit Chance %</span><input class="engineering-input tools-number-input" type="number" step="any" :value="percentValue('critChance')" @input="setPercent('critChance', $event.target.value)"></label>
                                <label class="engineering-field"><span class="engineering-field-label">Crit Damage %</span><input class="engineering-input tools-number-input" type="number" step="any" :value="percentValue('critDamage')" @input="setPercent('critDamage', $event.target.value)"></label>
                                <label class="engineering-field tools-afk-switch-field">
                                    <span class="engineering-field-label">Double Crit</span>
                                    <span class="tools-afk-switch-control">
                                        <span class="tools-afk-switch" :class="{ active: player.megaCritCap >= 2 }">
                                            <input class="tools-afk-switch-input" type="checkbox" :checked="player.megaCritCap >= 2" @change="setDoubleCrit($event.target.checked)">
                                            <span class="tools-afk-switch-track" aria-hidden="true"><span class="tools-afk-switch-thumb"></span></span>
                                            <span class="tools-afk-switch-state">{{ player.megaCritCap >= 2 ? 'ON' : 'OFF' }}</span>
                                        </span>
                                    </span>
                                </label>
                                <label class="engineering-field"><span class="engineering-field-label">Phys. Defence</span><input class="engineering-input tools-number-input" type="number" step="1" :value="player.physicalDefense" @input="setNumber('physicalDefense', $event.target.value)"></label>
                                <label class="engineering-field"><span class="engineering-field-label">HP</span><input class="engineering-input tools-number-input" type="number" step="1" :value="player.maxHp" @input="setNumber('maxHp', $event.target.value)"></label>
                                <label class="engineering-field"><span class="engineering-field-label">HP Regeneration</span><input class="engineering-input tools-number-input" type="number" step="0.01" :value="player.hpRegen" @input="setNumber('hpRegen', $event.target.value)"></label>
                                <label class="engineering-field"><span class="engineering-field-label">Movement Speed (Cap: {{ statLimits.movementSpeedMax }})</span><input class="engineering-input tools-number-input" type="number" step="0.01" :value="player.moveSpeed" @input="setNumber('moveSpeed', $event.target.value)"></label>
                                <label class="engineering-field"><span class="engineering-field-label">Offline Gains Rate %</span><input class="engineering-input tools-number-input" type="number" step="any" :value="percentValue('offlineRate')" @input="setPercent('offlineRate', $event.target.value)"></label>
                                <label class="engineering-field"><span class="engineering-field-label">Gold Multiplier %</span><input class="engineering-input tools-number-input" type="number" step="any" :value="percentValue('goldMultiplier')" @input="setPercent('goldMultiplier', $event.target.value)"></label>
                                <label class="engineering-field"><span class="engineering-field-label">Exp Multiplier %</span><input class="engineering-input tools-number-input" type="number" step="any" :value="percentValue('expMultiplier')" @input="setPercent('expMultiplier', $event.target.value)"></label>
                                <label class="engineering-field"><span class="engineering-field-label">Mob Spawn Time %</span><input class="engineering-input tools-number-input" type="number" step="any" :value="percentValue('mobSpawnMultiplier')" @input="setPercent('mobSpawnMultiplier', $event.target.value)"></label>
                            </div>
                        </div>
                    </div>

                    <div class="tools-afk-results" :class="{ active: mobileTab === 'results' }">
                        <div class="tools-result-card tools-afk-summary-card">
                            <div class="tools-recipe-section-label">Per Hour</div>
                            <div class="tools-afk-summary-grid">
                                <div><span>Kills</span><strong>{{ formatFixed(result.killsPerHour, 2) }}</strong></div>
                                <div><span>Gold</span><strong>{{ format(result.goldPerHour, 2) }}</strong></div>
                                <div><span>EXP</span><strong>{{ format(result.expPerHour, 2) }}</strong></div>
                                <div><span>Base kills</span><strong>{{ formatFixed(result.killsPerHourRaw, 2) }}</strong></div>
                            </div>
                        </div>

                        <div class="tools-result-card">
                            <div class="tools-afk-card-heading">
                                <div class="tools-recipe-section-label">Combat Model</div>
                                <button type="button" class="tools-afk-formula-btn" @click="toggleFormula">Formula</button>
                            </div>
                            <div class="tools-afk-detail-grid">
                                <span>Time to Kill</span><strong>{{ formatTime(result.enemyKillSeconds) }}</strong>
                                <span>Time to Death</span><strong>{{ formatSurvivalTime(result.playerSurvivalSeconds) }}</strong>
                                <span>Damage per Second</span><strong>{{ format(result.outgoingDps, 2) }}</strong>
                                <span>Damage Taken per Second</span><strong>{{ formatNonNegativeFixed(result.incomingDps, 4) }}</strong>
                                <span>Survival</span><strong>{{ formatFixed(result.survival * 100, 2) }}%</strong>
                                <span>Mob Spawn Time</span><strong>{{ formatTime(result.spawnSeconds) }}</strong>
                                <span>Mob Spawn Limit</span><strong>{{ formatFixed(result.spawnCapKillsPerHour, 2) }}</strong>
                                <span>Movement Time</span><strong>{{ formatTime(result.travelDelay) }}</strong>
                                <span>Kill Limit</span><strong>{{ formatFixed(result.killLimitedKillsPerHour, 2) }}</strong>
                            </div>
                        </div>

                        <div class="tools-result-card">
                            <div class="tools-recipe-section-label">Location Cap</div>
                            <div class="tools-afk-cap-overview">
                                <div class="tools-afk-cap-row">
                                    <span class="tools-afk-cap-label">Status <button type="button" class="bd-info-btn tools-afk-help-btn" @pointerdown.stop @click.stop="showHelp($event, afkHelp.status)">i</button></span>
                                    <strong>{{ capBreakpoints.reached ? 'At cap' : 'Below cap' }}</strong>
                                </div>
                                <div class="tools-afk-cap-row">
                                    <span class="tools-afk-cap-label">Bottleneck <button type="button" class="bd-info-btn tools-afk-help-btn" @pointerdown.stop @click.stop="showHelp($event, afkHelp.bottleneck)">i</button></span>
                                    <strong>{{ capBreakpoints.bottleneck }}</strong>
                                </div>
                            </div>
                            <div class="tools-afk-cap-metrics">
                                <div class="tools-afk-cap-row">
                                    <span class="tools-afk-cap-label">Offline Gains Rate <button type="button" class="bd-info-btn tools-afk-help-btn" @pointerdown.stop @click.stop="showHelp($event, afkHelp.offlineRate)">i</button></span>
                                    <strong>{{ formatFixed(player.offlineRate, 2) }}%</strong>
                                </div>
                                <div class="tools-afk-cap-row">
                                    <span class="tools-afk-cap-label">Mob Spawn Time <button type="button" class="bd-info-btn tools-afk-help-btn" @pointerdown.stop @click.stop="showHelp($event, afkHelp.mobSpawnTime)">i</button></span>
                                    <strong>{{ formatFixed(player.mobSpawnMultiplier, 2) }}%</strong>
                                </div>
                                <div class="tools-afk-cap-row">
                                    <span class="tools-afk-cap-label">Mob Spawn Limit <button type="button" class="bd-info-btn tools-afk-help-btn" @pointerdown.stop @click.stop="showHelp($event, afkHelp.mobSpawnLimit)">i</button></span>
                                    <strong>{{ formatFixed(capBreakpoints.maxKillsPerHour, 2) }} / h</strong>
                                </div>
                                <div class="tools-afk-cap-row">
                                    <span class="tools-afk-cap-label">Current Kills <button type="button" class="bd-info-btn tools-afk-help-btn" @pointerdown.stop @click.stop="showHelp($event, afkHelp.currentKills)">i</button></span>
                                    <strong>{{ formatFixed(capBreakpoints.currentKillsPerHour, 2) }} / h</strong>
                                </div>
                                <div class="tools-afk-cap-row">
                                    <span class="tools-afk-cap-label">Missing Kills <button type="button" class="bd-info-btn tools-afk-help-btn" @pointerdown.stop @click.stop="showHelp($event, afkHelp.missingKills)">i</button></span>
                                    <strong>{{ formatFixed(capBreakpoints.missingKillsPerHour, 2) }} / h</strong>
                                </div>
                            </div>
                            <div class="tools-recipe-section-label">Limit Breakdown</div>
                            <div class="tools-afk-cap-metrics">
                                <div class="tools-afk-cap-row">
                                    <span class="tools-afk-cap-label">Mob Spawn Limit <button type="button" class="bd-info-btn tools-afk-help-btn" @pointerdown.stop @click.stop="showHelp($event, afkHelp.mobSpawnLimit)">i</button></span>
                                    <strong>{{ formatFixed(capBreakpoints.maxKillsPerHour, 2) }} / h</strong>
                                </div>
                                <div class="tools-afk-cap-row">
                                    <span class="tools-afk-cap-label">Damage + Movement Limit <button type="button" class="bd-info-btn tools-afk-help-btn" @pointerdown.stop @click.stop="showHelp($event, afkHelp.combatLimit)">i</button></span>
                                    <strong>{{ formatFixed(capBreakpoints.combatLimitNoSurvival, 2) }} / h</strong>
                                </div>
                                <div class="tools-afk-cap-row">
                                    <span class="tools-afk-cap-label">Survival Adjusted Limit <button type="button" class="bd-info-btn tools-afk-help-btn" @pointerdown.stop @click.stop="showHelp($event, afkHelp.survivalLimit)">i</button></span>
                                    <strong>{{ formatFixed(capBreakpoints.survivalAdjustedLimit, 2) }} / h</strong>
                                </div>
                            </div>
                            <div class="tools-afk-source-note">Source: result is the lowest active limit.</div>
                            <div class="tools-recipe-section-label">Damage Group</div>
                            <div class="tools-afk-cap-metrics">
                                <div class="tools-afk-cap-row">
                                    <span class="tools-afk-cap-label">DPS to Spawn Limit <button type="button" class="bd-info-btn tools-afk-help-btn" @pointerdown.stop @click.stop="showHelp($event, afkHelp.dpsTarget)">i</button></span>
                                    <strong>{{ format(capBreakpoints.requiredDps, 2) }}</strong>
                                </div>
                                <div class="tools-afk-cap-row">
                                    <span class="tools-afk-cap-label">Current DPS <button type="button" class="bd-info-btn tools-afk-help-btn" @pointerdown.stop @click.stop="showHelp($event, afkHelp.currentDps)">i</button></span>
                                    <strong>{{ format(capBreakpoints.currentDps, 2) }}</strong>
                                </div>
                                <div class="tools-afk-cap-row">
                                    <span class="tools-afk-cap-label">DPS Gap <button type="button" class="bd-info-btn tools-afk-help-btn" @pointerdown.stop @click.stop="showHelp($event, afkHelp.dpsGap)">i</button></span>
                                    <strong>{{ formatSignedCapNumber(capBreakpoints.dpsGap, 2) }}</strong>
                                </div>
                                <div class="tools-afk-cap-row">
                                    <span class="tools-afk-cap-label">DPS Progress <button type="button" class="bd-info-btn tools-afk-help-btn" @pointerdown.stop @click.stop="showHelp($event, afkHelp.dpsProgress)">i</button></span>
                                    <strong>{{ formatFixed(capBreakpoints.dpsRatio * 100, 2) }}%</strong>
                                </div>
                                <div class="tools-afk-cap-row">
                                    <span class="tools-afk-cap-label">Crit Multiplier <button type="button" class="bd-info-btn tools-afk-help-btn" @pointerdown.stop @click.stop="showHelp($event, afkHelp.critMultiplier)">i</button></span>
                                    <strong>x{{ formatFixed(capBreakpoints.critMultiplier, 3) }}</strong>
                                </div>
                            </div>
                            <div class="tools-afk-source-note">Source: DPS = Atk * Attack Speed * (1 + Crit Chance * Crit Damage).</div>
                            <div class="tools-recipe-section-label tools-afk-section-label-help">
                                <span>Movement Group</span>
                                <button type="button" class="bd-info-btn tools-afk-help-btn" @pointerdown.stop @click.stop="showHelp($event, afkHelp.movementImpact)">i</button>
                            </div>
                            <div class="tools-afk-cap-metrics">
                                <div class="tools-afk-cap-row">
                                    <span class="tools-afk-cap-label">Movement Time <button type="button" class="bd-info-btn tools-afk-help-btn" @pointerdown.stop @click.stop="showHelp($event, afkHelp.movementTime)">i</button></span>
                                    <strong>{{ formatTime(result.travelDelay) }}</strong>
                                </div>
                            </div>
                            <div class="tools-afk-source-note">Source: movement time = max(0, (5 - weapon range) / Movement Speed).</div>
                            <div class="tools-recipe-section-label tools-afk-section-label-help">
                                <span>Survival Group</span>
                                <button type="button" class="bd-info-btn tools-afk-help-btn" @pointerdown.stop @click.stop="showHelp($event, afkHelp.survivalImpact)">i</button>
                            </div>
                            <div class="tools-afk-cap-metrics">
                                <div class="tools-afk-cap-row">
                                    <span class="tools-afk-cap-label">Damage Taken per Second <button type="button" class="bd-info-btn tools-afk-help-btn" @pointerdown.stop @click.stop="showHelp($event, afkHelp.damageTaken)">i</button></span>
                                    <strong>{{ formatNonNegativeFixed(result.incomingDps, 4) }}</strong>
                                </div>
                                <div class="tools-afk-cap-row">
                                    <span class="tools-afk-cap-label">Time to Death <button type="button" class="bd-info-btn tools-afk-help-btn" @pointerdown.stop @click.stop="showHelp($event, afkHelp.timeToDeath)">i</button></span>
                                    <strong>{{ formatSurvivalTime(result.playerSurvivalSeconds) }}</strong>
                                </div>
                                <div class="tools-afk-cap-row">
                                    <span class="tools-afk-cap-label">Survival <button type="button" class="bd-info-btn tools-afk-help-btn" @pointerdown.stop @click.stop="showHelp($event, afkHelp.survival)">i</button></span>
                                    <strong>{{ formatFixed(result.survival * 100, 2) }}%</strong>
                                </div>
                            </div>
                            <div class="tools-afk-source-note">Source: survival uses HP, Phys. Defence, HP Regeneration, and weapon survival.</div>
                        </div>

                    </div>
                    <div class="tools-afk-formula-tab" :class="{ active: mobileTab === 'formula' }">
                        <div class="tools-result-card">
                            <div class="tools-recipe-section-label">Formula</div>
                            <div class="tools-afk-formula-body">
                                <section class="tools-afk-formula-section">
                                    <dl>
                                        <dt>Percent inputs</dt><dd>Use in-game percent values in the UI. 130.5% is entered as 130.5 and converted to 1.305 for the formula.</dd>
                                    </dl>
                                    <pre>CritChance = CritChancePercent / 100
CritDamage = CritDamagePercent / 100
OfflineGainsRate = OfflineGainsRatePercent / 100
GoldMultiplier = GoldMultiplierPercent / 100
ExpMultiplier = ExpMultiplierPercent / 100
MobSpawnTime = MobSpawnTimePercent / 100</pre>
                                </section>
                                <section class="tools-afk-formula-section">
                                    <dl>
                                        <dt>Double Crit</dt><dd>Unchecked means crit cap 100%. Checked means crit cap 200%.</dd>
                                    </dl>
                                    <pre>if DoubleCrit:
    critCap = 2
else:
    critCap = 1
cappedCritChance = min(CritChance, critCap)
critMultiplier = 1 + cappedCritChance * CritDamage</pre>
                                </section>
                                <section class="tools-afk-formula-section">
                                    <dl>
                                        <dt>Damage</dt><dd>Damage controls Time to Kill. If Time to Kill is too high, Damage + Movement Limit can fall below the location cap.</dd>
                                        <dt>Attack Speed</dt><dd>Attack Speed directly multiplies DPS. Confirmed upper cap: 5.</dd>
                                    </dl>
                                    <pre>playerDps = critMultiplier * Atk * AttackSpeed
enemyKillSeconds = enemyMaxHp / playerDps</pre>
                                </section>
                                <section class="tools-afk-formula-section">
                                    <dl>
                                        <dt>Phys. Defence</dt><dd>Enemy incoming damage uses physical defence only: max(enemyAtk - PhysDefence, 0) / 3.</dd>
                                    </dl>
                                    <pre>hpRegenPerSecond = HPRegeneration / 5
incomingDps = max(enemyAtk - PhysDefence, 0) / 3 - hpRegenPerSecond
if incomingDps >= 0.01:
    playerSurvivalSeconds = HP / incomingDps
else:
    playerSurvivalSeconds = -1</pre>
                                </section>
                                <section class="tools-afk-formula-section">
                                    <dl>
                                        <dt>Weapon Survival</dt><dd>Selected weapon can add survival time: WeaponSurvival = 1 + AliveTime / 100.</dd>
                                    </dl>
                                    <pre>if playerSurvivalSeconds <= 0:
    survival = 1
else:
    survival = 1 - 300 / (playerSurvivalSeconds + 300)
if playerSurvivalSeconds > 0 and enemyKillSeconds > playerSurvivalSeconds:
    survival = 0
survival = survival * WeaponAliveTimeMultiplier</pre>
                                </section>
                                <section class="tools-afk-formula-section">
                                    <dl>
                                        <dt>Mob Spawn Time</dt><dd>Use the final percent shown in game. 71% is entered as 71 and converted to 0.71.</dd>
                                    </dl>
                                    <pre>spawnInterval = max(enemySpawnCooldown * MobSpawnTime, enemyKillSeconds)
spawnCap = 3600 / spawnInterval + maxSpawnedEnemies</pre>
                                </section>
                                <section class="tools-afk-formula-section">
                                    <dl>
                                        <dt>Weapon range</dt><dd>Range affects travel time between kills: max(0, (5 - range) / MovementSpeed).</dd>
                                        <dt>Movement Speed</dt><dd>Movement Speed reduces Movement Time. Confirmed upper cap: 12.</dd>
                                        <dt>Kill Limit</dt><dd>Maximum kills per hour allowed by Time to Kill, Movement Time, and Survival: Survival * 3600 / (TimeToKill + MovementTime).</dd>
                                    </dl>
                                    <pre>movementPenalty = max(0, (5 - WeaponRange) / MovementSpeed)
damageMovementLimit = 3600 / (movementPenalty + enemyKillSeconds)
killTravelCap = survival * damageMovementLimit</pre>
                                </section>
                                <section class="tools-afk-formula-section">
                                    <dl>
                                        <dt>Final Rewards</dt><dd>Final kills use the lowest active limit. Gold and EXP are based on raw kills, then multiplied by reward multipliers and Offline Gains Rate.</dd>
                                    </dl>
                                    <pre>rawKillsPerHour = min(spawnCap, killTravelCap)
killsPerHour = rawKillsPerHour * OfflineGainsRate
goldPerHour = rawKillsPerHour * enemyGold * goldDropChance * GoldMultiplier * OfflineGainsRate
expPerHour = rawKillsPerHour * enemyExp * ExpMultiplier * OfflineGainsRate</pre>
                                </section>
                                <dl>
                                    <dt>Enemy Armor</dt><dd>Current regular enemies have Armor 0, and the recovered AFK method does not subtract it in enemy kill time.</dd>
                                </dl>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <div v-if="mobileHelpOpen && app.isMobileViewport"
                  class="mobile-drawer-overlay tools-smeltery-calc-overlay open"
                  @click="closeMobileHelp"></div>
            <div v-if="mobileHelpOpen && app.isMobileViewport"
                  class="mobile-drawer tools-smeltery-calc-sheet tools-afk-help-sheet open"
                  @click.stop
                  @pointerdown.stop>
                <div class="mobile-drawer-header">
                    <div class="mobile-drawer-handle"></div>
                    <button type="button"
                            class="mobile-drawer-close"
                            aria-label="Close help"
                            @click="closeMobileHelp">&times;</button>
                </div>
                <div class="mobile-drawer-body">
                    <div class="tools-afk-help-sheet-body">{{ mobileHelpText }}</div>
                </div>
            </div>
            <div v-if="formulaOpen" class="tools-afk-formula-backdrop" @click.self="closeFormula">
                <div class="tools-afk-formula-popover" role="dialog" aria-modal="true" aria-label="AFK Combat Formula">
                    <div class="tools-afk-formula-header">
                        <div>AFK Combat Formula</div>
                        <button type="button" class="tools-afk-formula-close" @click="closeFormula">x</button>
                    </div>
                    <div class="tools-afk-formula-body">
                        <section class="tools-afk-formula-section">
                            <dl>
                                <dt>Percent inputs</dt><dd>Use in-game percent values in the UI. 130.5% is entered as 130.5 and converted to 1.305 for the formula.</dd>
                            </dl>
                            <pre>CritChance = CritChancePercent / 100
CritDamage = CritDamagePercent / 100
OfflineGainsRate = OfflineGainsRatePercent / 100
GoldMultiplier = GoldMultiplierPercent / 100
ExpMultiplier = ExpMultiplierPercent / 100
MobSpawnTime = MobSpawnTimePercent / 100</pre>
                        </section>
                        <section class="tools-afk-formula-section">
                            <dl>
                                <dt>Double Crit</dt><dd>Unchecked means crit cap 100%. Checked means crit cap 200%.</dd>
                            </dl>
                            <pre>if DoubleCrit:
    critCap = 2
else:
    critCap = 1
cappedCritChance = min(CritChance, critCap)
critMultiplier = 1 + cappedCritChance * CritDamage</pre>
                        </section>
                        <section class="tools-afk-formula-section">
                            <dl>
                                <dt>Damage</dt><dd>Damage controls Time to Kill. If Time to Kill is too high, Damage + Movement Limit can fall below the location cap.</dd>
                                <dt>Attack Speed</dt><dd>Attack Speed directly multiplies DPS. Confirmed upper cap: 5.</dd>
                            </dl>
                            <pre>playerDps = critMultiplier * Atk * AttackSpeed
enemyKillSeconds = enemyMaxHp / playerDps</pre>
                        </section>
                        <section class="tools-afk-formula-section">
                            <dl>
                                <dt>Phys. Defence</dt><dd>Enemy incoming damage uses physical defence only: max(enemyAtk - PhysDefence, 0) / 3.</dd>
                            </dl>
                            <pre>hpRegenPerSecond = HPRegeneration / 5
incomingDps = max(enemyAtk - PhysDefence, 0) / 3 - hpRegenPerSecond
if incomingDps >= 0.01:
    playerSurvivalSeconds = HP / incomingDps
else:
    playerSurvivalSeconds = -1</pre>
                        </section>
                        <section class="tools-afk-formula-section">
                            <dl>
                                <dt>Weapon Survival</dt><dd>Selected weapon can add survival time: WeaponSurvival = 1 + AliveTime / 100.</dd>
                            </dl>
                            <pre>if playerSurvivalSeconds <= 0:
    survival = 1
else:
    survival = 1 - 300 / (playerSurvivalSeconds + 300)
if playerSurvivalSeconds > 0 and enemyKillSeconds > playerSurvivalSeconds:
    survival = 0
survival = survival * WeaponAliveTimeMultiplier</pre>
                        </section>
                        <section class="tools-afk-formula-section">
                            <dl>
                                <dt>Mob Spawn Time</dt><dd>Use the final percent shown in game. 71% is entered as 71 and converted to 0.71.</dd>
                            </dl>
                            <pre>spawnInterval = max(enemySpawnCooldown * MobSpawnTime, enemyKillSeconds)
spawnCap = 3600 / spawnInterval + maxSpawnedEnemies</pre>
                        </section>
                        <section class="tools-afk-formula-section">
                            <dl>
                                <dt>Weapon range</dt><dd>Range affects travel time between kills: max(0, (5 - range) / MovementSpeed).</dd>
                                <dt>Movement Speed</dt><dd>Movement Speed reduces Movement Time. Confirmed upper cap: 12.</dd>
                                <dt>Kill Limit</dt><dd>Maximum kills per hour allowed by Time to Kill, Movement Time, and Survival: Survival * 3600 / (TimeToKill + MovementTime).</dd>
                            </dl>
                            <pre>movementPenalty = max(0, (5 - WeaponRange) / MovementSpeed)
damageMovementLimit = 3600 / (movementPenalty + enemyKillSeconds)
killTravelCap = survival * damageMovementLimit</pre>
                        </section>
                        <section class="tools-afk-formula-section">
                            <dl>
                                <dt>Final Rewards</dt><dd>Final kills use the lowest active limit. Gold and EXP are based on raw kills, then multiplied by reward multipliers and Offline Gains Rate.</dd>
                            </dl>
                            <pre>rawKillsPerHour = min(spawnCap, killTravelCap)
killsPerHour = rawKillsPerHour * OfflineGainsRate
goldPerHour = rawKillsPerHour * enemyGold * goldDropChance * GoldMultiplier * OfflineGainsRate
expPerHour = rawKillsPerHour * enemyExp * ExpMultiplier * OfflineGainsRate</pre>
                        </section>
                        <dl>
                            <dt>Enemy Armor</dt><dd>Current regular enemies have Armor 0, and the recovered AFK method does not subtract it in enemy kill time.</dd>
                        </dl>
                    </div>
                </div>
            </div>
        </section>
    `
};
