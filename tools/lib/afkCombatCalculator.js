const DEFAULT_CONSTANTS = Object.freeze({
    secondsPerHour: 3600,
    one: 1,
    playerSurvivalWindowSeconds: 300,
    enemyAttackIntervalSeconds: 3,
    hpRegenDivisor: 5,
    minimumIncomingDps: 0.01,
    travelBaseRange: 5,
});

export const DEFAULT_AFK_COMBAT_PLAYER = Object.freeze({
    maxHp: 1000,
    attack: 100,
    attackSpeed: 1,
    critChance: 0,
    critDamage: 1,
    megaCritCap: 1,
    physicalDefense: 0,
    hpRegen: 0,
    mobSpawnMultiplier: 1,
    mobSpawnFlatBonus: 0,
    weaponId: '',
    attackRange: 0,
    weaponSurvivalMultiplier: 1,
    moveSpeed: 1,
    goldMultiplier: 1,
    expMultiplier: 1,
    offlineRate: 1,
});

export const AFK_COMBAT_WEAPON_RANGES = Object.freeze({
    oneHandSword: 0,
    twoHandSword: 0,
    bow: 6,
    staff: 5,
    other: 0,
    custom: 0,
});

function finiteNumber(value, fallback = 0) {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : fallback;
}

function positiveNumber(value, fallback = 0) {
    return Math.max(0, finiteNumber(value, fallback));
}

function positiveMultiplier(value, fallback = 1) {
    return Math.max(0, finiteNumber(value, fallback));
}

function cappedCritChance(value, cap) {
    const resolvedCap = Math.max(1, Math.floor(finiteNumber(cap, 1)));
    return Math.max(0, Math.min(finiteNumber(value, 0), resolvedCap));
}

function effectiveMobSpawnMultiplier(player) {
    return Math.max(0, finiteNumber(player.mobSpawnMultiplier, 1) + finiteNumber(player.mobSpawnFlatBonus, 0));
}

export function selectedAfkEnemy(location, difficulty = 'normal') {
    const mode = location?.modes?.[difficulty] ?? location?.modes?.normal ?? null;
    if (!location || !mode) return null;
    return {
        id: location.id,
        name: location.name,
        actLabel: location.actLabel,
        difficulty,
        image: location.image,
        hp: positiveNumber(mode.hp),
        attack: positiveNumber(mode.attack),
        exp: positiveNumber(mode.exp),
        gold: positiveNumber(mode.gold),
        loot: mode.loot ?? '',
        maxSpawns: Math.max(1, Math.floor(finiteNumber(location.maxSpawns, 2))),
        baseSpawnSeconds: Math.max(0, finiteNumber(location.baseSpawnSeconds, 3)),
        goldDropChance: Math.max(0, finiteNumber(location.goldDropChance, 1)),
    };
}

export function calculateAfkCombatRewards({ enemy, player = {}, constants = {} } = {}) {
    const resolvedEnemy = enemy ?? {};
    const resolvedPlayer = { ...DEFAULT_AFK_COMBAT_PLAYER, ...player };
    const resolvedConstants = { ...DEFAULT_CONSTANTS, ...constants };

    const one = finiteNumber(resolvedConstants.one, 1);
    const secondsPerHour = positiveNumber(resolvedConstants.secondsPerHour, 3600);
    const playerSurvivalWindowSeconds = positiveNumber(resolvedConstants.playerSurvivalWindowSeconds, 300);
    const enemyAttackIntervalSeconds = positiveNumber(resolvedConstants.enemyAttackIntervalSeconds, 3) || 3;
    const hpRegenDivisor = positiveNumber(resolvedConstants.hpRegenDivisor, 5) || 5;
    const minimumIncomingDps = positiveNumber(resolvedConstants.minimumIncomingDps, 0.01);
    const travelBaseRange = positiveNumber(resolvedConstants.travelBaseRange, 5);

    const enemyAttack = positiveNumber(resolvedEnemy.attack);
    const physicalDefense = positiveNumber(resolvedPlayer.physicalDefense);
    const hpRegenPerSecond = finiteNumber(resolvedPlayer.hpRegen, 0) / hpRegenDivisor;
    const incomingDamagePerSecond = Math.max(enemyAttack - physicalDefense, 0) / enemyAttackIntervalSeconds
        - hpRegenPerSecond;
    const playerSurvivalSeconds = incomingDamagePerSecond >= minimumIncomingDps
        ? positiveNumber(resolvedPlayer.maxHp) / incomingDamagePerSecond
        : -1;

    const playerCritChance = cappedCritChance(resolvedPlayer.critChance, resolvedPlayer.megaCritCap);
    const playerCritDamage = positiveMultiplier(resolvedPlayer.critDamage, 1);
    const outgoingDamagePerSecond = (one + playerCritChance * playerCritDamage)
        * positiveNumber(resolvedPlayer.attack)
        * positiveMultiplier(resolvedPlayer.attackSpeed, 0);
    const enemyKillSeconds = outgoingDamagePerSecond > 0
        ? positiveNumber(resolvedEnemy.hp) / outgoingDamagePerSecond
        : Infinity;

    let survival = one;
    if (playerSurvivalSeconds > 0 && Number.isFinite(playerSurvivalSeconds)) {
        survival = one - playerSurvivalWindowSeconds / (playerSurvivalSeconds + playerSurvivalWindowSeconds);
        if (enemyKillSeconds > playerSurvivalSeconds) survival = 0;
    }
    survival = Math.max(0, Math.min(1, survival));
    const weaponSurvivalMultiplier = positiveMultiplier(resolvedPlayer.weaponSurvivalMultiplier, 1);
    survival *= weaponSurvivalMultiplier;

    const mobSpawnMultiplier = effectiveMobSpawnMultiplier(resolvedPlayer);
    const spawnInterval = Math.max(
        mobSpawnMultiplier * positiveNumber(resolvedEnemy.baseSpawnSeconds, 0),
        enemyKillSeconds
    );
    const spawnRatePerHour = spawnInterval > 0 ? secondsPerHour / spawnInterval : 0;
    const moveSpeed = Math.max(0.0001, positiveNumber(resolvedPlayer.moveSpeed, 1));
    const attackRange = positiveNumber(resolvedPlayer.attackRange, 0);
    const travelDelay = Math.max(0, (travelBaseRange - attackRange) / moveSpeed);
    const killCycleSeconds = enemyKillSeconds + travelDelay;
    const killLimitedKillsPerHour = killCycleSeconds > 0 && Number.isFinite(killCycleSeconds)
        ? survival * secondsPerHour / killCycleSeconds
        : 0;
    const spawnCapKillsPerHour = spawnRatePerHour + positiveNumber(resolvedEnemy.maxSpawns, 1);
    const killsPerHourRaw = killLimitedKillsPerHour < 0
        ? 0
        : Math.min(spawnCapKillsPerHour, killLimitedKillsPerHour);

    const expRawPerHour = killsPerHourRaw
        * positiveNumber(resolvedEnemy.exp)
        * positiveMultiplier(resolvedPlayer.expMultiplier, 1);
    const goldRawPerHour = killsPerHourRaw
        * positiveNumber(resolvedEnemy.gold)
        * positiveNumber(resolvedEnemy.goldDropChance, 1)
        * positiveMultiplier(resolvedPlayer.goldMultiplier, 1);
    const offlineRate = positiveMultiplier(resolvedPlayer.offlineRate, 1);

    return {
        timeToKill: enemyKillSeconds,
        timeToDie: playerSurvivalSeconds,
        enemyKillSeconds,
        playerSurvivalSeconds,
        survival,
        weaponSurvivalMultiplier,
        outgoingDps: outgoingDamagePerSecond,
        incomingDps: incomingDamagePerSecond,
        cappedCritChance: playerCritChance,
        mobSpawnMultiplier,
        spawnSeconds: spawnInterval,
        spawnRatePerHour,
        spawnCapKillsPerHour,
        travelDelay,
        killLimitedKillsPerHour,
        killsPerHourRaw,
        offlineRate,
        killsPerHour: killsPerHourRaw * offlineRate,
        goldPerHour: goldRawPerHour * offlineRate,
        expPerHour: expRawPerHour * offlineRate,
    };
}

export function calculateAfkCombatDurationRewards(snapshot, hours = 1) {
    const resolvedHours = Math.max(0, finiteNumber(hours, 0));
    const killsFloat = resolvedHours * finiteNumber(snapshot?.killsPerHour, 0);
    return {
        hours: resolvedHours,
        kills: Math.floor(killsFloat),
        killsFloat,
        gold: resolvedHours * finiteNumber(snapshot?.goldPerHour, 0),
        exp: resolvedHours * finiteNumber(snapshot?.expPerHour, 0),
    };
}
