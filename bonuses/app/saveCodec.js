const textDecoder = new TextDecoder('utf-8');

export function decodeHexSave(hex) {
    const trimmed = String(hex ?? '').trim();
    if (trimmed.length % 2 !== 0) throw new Error('Odd-length hex string');
    const bytes = new Uint8Array(trimmed.length / 2);
    for (let i = 0; i < trimmed.length; i += 2) {
        bytes[i / 2] = parseInt(trimmed.substring(i, i + 2), 16) ^ 255;
    }
    return textDecoder.decode(bytes);
}

function getHeroClassId(heroClass) {
    if (heroClass === 1) return 'warrior';
    if (heroClass === 2) return 'mage';
    if (heroClass === 3) return 'rogue';
    return 'warrior';
}

function collectOwnedGear(raw, hero) {
    const owned = new Map();
    const pushItem = item => {
        if (!item?.itemGuid) return;
        const existing = owned.get(item.itemGuid) ?? {
            count: 0,
            enhancementLevel: 0,
            level: 0
        };
        owned.set(item.itemGuid, {
            count: existing.count + 1,
            enhancementLevel: Math.max(existing.enhancementLevel ?? 0, item.EnhancementLevel ?? 0),
            level: Math.max(existing.level ?? 0, item.Level ?? 0)
        });
    };

    for (const item of Object.values(hero?.equipment ?? {})) {
        pushItem(item);
    }
    for (const item of raw?.Inventory?.stash ?? []) {
        pushItem(item);
    }
    return owned;
}

function collectEquippedGear(hero) {
    const equipped = new Map();
    for (const item of Object.values(hero?.equipment ?? {})) {
        if (!item?.itemGuid) continue;
        const existing = equipped.get(item.itemGuid) ?? {
            count: 0,
            enhancementLevel: 0,
            level: 0
        };
        equipped.set(item.itemGuid, {
            count: existing.count + 1,
            enhancementLevel: Math.max(existing.enhancementLevel ?? 0, item.EnhancementLevel ?? 0),
            level: Math.max(existing.level ?? 0, item.Level ?? 0)
        });
    }
    return equipped;
}

function collectOwnedPets(raw, heroIndex) {
    const bestByName = new Map();
    for (const pet of raw?.Pets?.petSaveData ?? []) {
        if (!pet?.petName || pet.isUnlocked === false) continue;
        if (pet.characterId !== -1 && pet.characterId !== heroIndex) continue;
        const existing = bestByName.get(pet.petName);
        const currentScore = (pet.tier ?? 0) * 1000 + (pet.level ?? 0);
        const existingScore = existing ? ((existing.tier ?? 0) * 1000 + (existing.level ?? 0)) : -1;
        if (currentScore > existingScore) {
            bestByName.set(pet.petName, {
                level: Number(pet.level ?? 1),
                tier: Number(pet.tier ?? 0)
            });
        }
    }
    return bestByName;
}

function collectActivePet(raw, heroIndex) {
    const pet = (raw?.Pets?.petSaveData ?? []).find(entry =>
        entry?.characterId === heroIndex &&
        entry?.petSlot === 0 &&
        entry?.isUnlocked !== false
    );
    if (!pet?.petName) return null;
    return {
        name: pet.petName,
        level: Number(pet.level ?? 1),
        tier: Number(pet.tier ?? 0)
    };
}

function collectOwnedCurios(raw) {
    const bestByGuid = new Map();
    for (const curio of raw?.CurioSystem?.Inventory ?? []) {
        if (!curio?.DefinitionId) continue;
        const existing = bestByGuid.get(curio.DefinitionId) ?? { count: 0, level: 0, tier: 0 };
        bestByGuid.set(curio.DefinitionId, {
            count: existing.count + 1,
            level: Math.max(existing.level, Number(curio.Level ?? 1)),
            tier: Math.max(existing.tier, Number(curio.Tier ?? 0))
        });
    }
    return bestByGuid;
}

function collectEquippedCurios(raw) {
    const equipped = new Map();
    const instanceMap = new Map();
    for (const curio of raw?.CurioSystem?.Inventory ?? []) {
        if (curio?.InstanceId) instanceMap.set(curio.InstanceId, curio);
    }
    for (const instanceId of Object.values(raw?.CurioSystem?.EquippedSlots ?? {})) {
        const item = instanceMap.get(instanceId);
        if (!item?.DefinitionId) continue;
        const existing = equipped.get(item.DefinitionId) ?? { count: 0, level: 0, tier: 0 };
        equipped.set(item.DefinitionId, {
            count: existing.count + 1,
            level: Math.max(existing.level, Number(item.Level ?? 1)),
            tier: Math.max(existing.tier, Number(item.Tier ?? 0))
        });
    }
    return equipped;
}

function collectRunes(raw) {
    const counts = new Map();
    for (const row of raw?.RuneSystem?.Rows ?? []) {
        for (const runeGuid of Object.values(row?.SlottedRunes ?? {})) {
            if (!runeGuid) continue;
            counts.set(runeGuid, (counts.get(runeGuid) ?? 0) + 1);
        }
    }
    for (const entry of raw?.RuneSystem?.Inventory?.SlotEntries ?? []) {
        if (!entry?.ItemId || !entry?.Count) continue;
        counts.set(entry.ItemId, (counts.get(entry.ItemId) ?? 0) + Number(entry.Count ?? 0));
    }
    return counts;
}

function collectEquippedRunes(raw) {
    const counts = new Map();
    for (const row of raw?.RuneSystem?.Rows ?? []) {
        for (const runeGuid of Object.values(row?.SlottedRunes ?? {})) {
            if (!runeGuid) continue;
            counts.set(runeGuid, (counts.get(runeGuid) ?? 0) + 1);
        }
    }
    return counts;
}

function collectActiveRunewords(raw) {
    const counts = new Map();
    for (const row of raw?.RuneSystem?.Rows ?? []) {
        if (!row?.ActiveRunewordId) continue;
        counts.set(row.ActiveRunewordId, (counts.get(row.ActiveRunewordId) ?? 0) + 1);
    }
    return counts;
}

function collectCards(raw) {
    const counts = new Map();
    for (const [key, value] of Object.entries(raw?.Currency?.cards ?? {})) {
        const saveKey = String(key ?? '').trim();
        if (!saveKey) continue;
        counts.set(saveKey, (counts.get(saveKey) ?? 0) + Number(value ?? 0));
    }
    return counts;
}

function buildHeroSummary(raw, hero, heroIndex) {
    const skills = new Map((hero?.skillModels ?? []).map(skill => [skill?.ESkill, Number(skill?.currentLevel ?? 1)]));
    return {
        index: heroIndex,
        name: hero?.Name ?? `Hero ${heroIndex + 1}`,
        classId: getHeroClassId(hero?.HeroClass),
        level: skills.get(0) ?? 1,
        miningLevel: skills.get(1) ?? 1,
        woodcuttingLevel: skills.get(2) ?? 1,
        enhancements: { ...(hero?.Enhancements ?? {}) },
        equippedTools: {
            pickaxe: hero?.equipment?.Pickaxe ?? null,
            axe: hero?.equipment?.Axe ?? null
        },
        ownedGear: collectOwnedGear(raw, hero),
        equippedGear: collectEquippedGear(hero),
        ownedPets: collectOwnedPets(raw, heroIndex),
        activePet: collectActivePet(raw, heroIndex)
    };
}

export function parseSaveText(saveText) {
    //const decoded = decodeHexSave(saveText);
    //const raw = JSON.parse(decoded);
    const raw = JSON.parse(saveText);
    const heroes = (raw?.Heroes?.Heroes ?? []).map((hero, index) => buildHeroSummary(raw, hero, index));

    return {
        raw,
        enhancements: { ...(raw?.ProgressProfile?.Enhancements ?? {}) },
        achievementCount: Object.values(raw?.Achievement?.AchievementStates ?? {}).reduce(
            (total, entry) => total + Number(entry?.currentTier ?? 0),
            0
        ),
        heroes,
        ownedCurios: collectOwnedCurios(raw),
        equippedCurios: collectEquippedCurios(raw),
        ownedRunes: collectRunes(raw),
        equippedRunes: collectEquippedRunes(raw),
        activeRunewords: collectActiveRunewords(raw),
        cards: collectCards(raw)
    };
}
