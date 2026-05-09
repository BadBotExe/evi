export const petReferenceMethods = {
    petReferencePanel() {
        const progression = this.data?.sources?.find(src => src.type === 'pet')?._file_pet_progression
            ?? this.data?.sources?.find(src => src.type === 'pet')?.pet_progression
            ?? null;
        const maxLevel = progression?.levels?.max ?? 50;
        const maxTier = progression?.tiers?.max ?? 6;
        return {
            id: 'pet-reference',
            title: 'Pet Progression',
            description: 'Shared pet progression reference data generated from the pet formulas used in this dataset.',
            actions: [
                {
                    id: 'xp',
                    label: 'Level XP',
                    title: 'Pet Level XP',
                    subtitle: `Levels 1-${maxLevel}`,
                    tables: this.buildPetLevelRequirementTables(maxLevel),
                    tableGridClass: 'data-table-grid-2',
                    popoverClass: 'price-breakdown-popover-cols-2',
                    tablesTabLabel: 'Levels',
                    formulaSections: [
                        {
                            costs: [
                                {
                                    label: 'Formula',
                                    expression: '91.9202 * 1.0879^Level',
                                    expressionHtml: this._formatFormulaExpressionHtml('91.9202 * 1.0879^Level')
                                }
                            ]
                        }
                    ]
                },
                {
                    id: 'sacrifice',
                    label: 'Sacrifice Value',
                    title: 'Pet Sacrifice Value',
                    subtitle: `Tiers 1-${maxTier}`,
                    tables: this.buildPetSacrificeTables(maxTier, maxLevel),
                    tabbed: true,
                    tableGridClass: 'data-table-grid-2',
                    popoverClass: 'price-breakdown-popover-cols-2',
                    formulaSections: [
                        {
                            costs: [
                                {
                                    label: 'Formula',
                                    expression: 'Tier * 50 + Level',
                                    expressionHtml: this._formatFormulaExpressionHtml('Tier * 50 + Level')
                                }
                            ]
                        }
                    ]
                },
                {
                    id: 'tier-up',
                    label: 'Tier Up',
                    title: 'Pet Tier-Up Requirements',
                    subtitle: 'Shared across all pets',
                    description: 'Food points required to reach the next tier.',
                    popoverClass: 'price-breakdown-popover-cols-2',
                    tables: [
                        {
                            id: 'pet-tier-up',
                            columns: [
                                { key: 'tier', label: 'Target Tier' },
                                { key: 'requirement', label: 'Food Points' }
                            ],
                            rows: this.buildPetTierRequirementRows()
                        }
                    ]
                }
            ]
        };
    },

    buildPetLevelRequirementRows(maxLevel = 50) {
        return Array.from({ length: Math.max(0, maxLevel) }, (_, index) => {
            const level = index + 1;
            return {
                level: `Lvl ${level}`,
                xp: Math.round(91.9202 * (1.0879 ** level)).toLocaleString()
            };
        });
    },

    buildPetLevelRequirementTables(maxLevel = 50) {
        const rows = this.buildPetLevelRequirementRows(maxLevel);
        const midpoint = Math.ceil(rows.length / 2);
        const columns = [
            { key: 'level', label: 'Level' },
            { key: 'xp', label: 'XP for Next Level' }
        ];
        return [
            {
                id: 'pet-level-xp',
                splitTables: [
                    {
                        id: 'pet-level-xp-1',
                        columns,
                        rows: rows.slice(0, midpoint)
                    },
                    {
                        id: 'pet-level-xp-2',
                        columns,
                        rows: rows.slice(midpoint)
                    }
                ]
            }
        ];
    },

    buildPetSacrificeTables(maxTier = 6, maxLevel = 50) {
        return Array.from({ length: Math.max(0, maxTier) }, (_, tierIndex) => {
            const tier = tierIndex + 1;
            const rows = Array.from({ length: Math.max(0, maxLevel) }, (_, levelIndex) => {
                const level = levelIndex + 1;
                return {
                    level: `Lvl ${level}`,
                    value: (tier * 50 + level).toLocaleString()
                };
            });
            const midpoint = Math.ceil(rows.length / 2);
            const columns = [
                { key: 'level', label: 'Level' },
                { key: 'value', label: 'Sacrifice Value' }
            ];
            return {
                id: `pet-sacrifice-t${tier}`,
                tabLabel: `T${tier}`,
                splitTables: [
                    {
                        id: `pet-sacrifice-t${tier}-1`,
                        columns,
                        rows: rows.slice(0, midpoint)
                    },
                    {
                        id: `pet-sacrifice-t${tier}-2`,
                        columns,
                        rows: rows.slice(midpoint)
                    }
                ]
            };
        });
    },

    buildPetTierRequirementRows() {
        const requirements = [
            { tier: 'T2', requirement: 150 },
            { tier: 'T3', requirement: 350 },
            { tier: 'T4', requirement: 700 },
            { tier: 'T5', requirement: 1200 },
            { tier: 'T6', requirement: 1850 }
        ];
        return requirements.map(entry => ({
            tier: entry.tier,
            requirement: entry.requirement.toLocaleString()
        }));
    },

    dataTablePopoverClass(entry) {
        return entry?.action?.popoverClass ?? 'price-breakdown-popover-cols-2';
    }
};
