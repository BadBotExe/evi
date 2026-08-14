import assert from 'node:assert/strict';

import {
    calculateAfkCombatDurationRewards,
    calculateAfkCombatRewards,
    selectedAfkEnemy
} from './afkCombatCalculator.js';

function assertClose(actual, expected, epsilon = 0.000001) {
    assert.ok(
        Math.abs(actual - expected) <= epsilon,
        `expected ${actual} to be within ${epsilon} of ${expected}`
    );
}

const horus = {
    id: 'horus',
    name: 'Horus',
    actLabel: 'Act 3',
    maxSpawns: 9,
    baseSpawnSeconds: 2,
    goldDropChance: 1,
    modes: {
        normal: { hp: 124650000, attack: 3700, gold: 38, exp: 41134500 }
    }
};

const matryoshka = {
    id: 'matryoshka',
    name: 'Matryoshka',
    actLabel: 'Act 2',
    maxSpawns: 11,
    baseSpawnSeconds: 2,
    goldDropChance: 1,
    modes: {
        normal: { hp: 755595, attack: 1000, gold: 25, exp: 367132 },
        hard: { hp: 25000000, attack: 3000, gold: 34, exp: 8250000 },
        nightmare: { hp: 450000000, attack: 5100, gold: 40, exp: 148500000 }
    }
};

{
    const enemy = selectedAfkEnemy(matryoshka, 'nightmare');
    assert.equal(enemy.hp, 450000000);
    assert.equal(enemy.attack, 5100);
    assert.equal(enemy.gold, 40);
    assert.equal(enemy.baseSpawnSeconds, 2);
    assert.equal(enemy.maxSpawns, 11);
}

{
    const result = calculateAfkCombatRewards({
        enemy: selectedAfkEnemy(horus, 'normal'),
        player: {
            attack: 19288790,
            attackSpeed: 2.13,
            moveSpeed: 9.2,
            critChance: 1.305,
            critDamage: 6.87,
            megaCritCap: 2,
            physicalDefense: 8404,
            mobSpawnMultiplier: 0.7100591715976331,
            attackRange: 0,
            offlineRate: 1.25
        }
    });

    assertClose(result.enemyKillSeconds, 0.3044494109, 0.0000000001);
    assert.equal(result.survival, 1);
    assertClose(result.spawnCapKillsPerHour, 2544, 0.000001);
    assert.equal(result.killsPerHour, 3180);
}

{
    const result = calculateAfkCombatRewards({
        enemy: selectedAfkEnemy(matryoshka, 'nightmare'),
        player: {
            attack: 28933190,
            attackSpeed: 2.13,
            moveSpeed: 9.2,
            critChance: 1.305,
            critDamage: 6.87,
            megaCritCap: 2,
            physicalDefense: 8404,
            mobSpawnMultiplier: 0.71,
            mobSpawnFlatBonus: -0.2,
            attackRange: 0,
            offlineRate: 1.25
        }
    });

    assertClose(result.mobSpawnMultiplier, 0.51);
    assertClose(result.enemyKillSeconds, 0.7327301042, 0.0000000001);
    assertClose(result.travelDelay, 0.5434782609, 0.0000000001);
    assertClose(result.killsPerHour, 3526.069977, 0.000001);
}

{
    const result = calculateAfkCombatRewards({
        enemy: selectedAfkEnemy(matryoshka, 'nightmare'),
        player: {
            attack: 11354400,
            attackSpeed: 2.23,
            moveSpeed: 9.2,
            critChance: 1.305,
            critDamage: 6.82,
            megaCritCap: 2,
            physicalDefense: 8404,
            mobSpawnMultiplier: 0.71,
            mobSpawnFlatBonus: -0.2,
            attackRange: 6,
            offlineRate: 1.25
        }
    });

    assert.equal(result.travelDelay, 0);
    assertClose(result.enemyKillSeconds, 1.7951629633, 0.0000000001);
    assertClose(result.killsPerHour, 2506.736208, 0.000001);
}

{
    const rewards = calculateAfkCombatDurationRewards({ killsPerHour: 12.8, goldPerHour: 50, expPerHour: 75 }, 2.5);
    assert.equal(rewards.kills, 32);
    assert.equal(rewards.gold, 125);
    assert.equal(rewards.exp, 187.5);
}

console.log('tools/lib/afkCombatCalculator.test.mjs passed');
