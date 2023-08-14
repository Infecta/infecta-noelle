const modifiers = {
	NM: 0,
	NF: 1,
	EZ: 2,
	TD: 4,
	HD: 8,
	HR: 16,
	SD: 32,
	DT: 64,
	RX: 128,
	HT: 256,
	NC: 512,
	FL: 1024,
	AU: 2048,
	SO: 4096,
	AP: 8192,
	PF: 16384,
	Key4: 32768,
	Key5: 65536,
	Key6: 131072,
	Key7: 262144,
	Key8: 524288,
	FadeIn: 1048576,
	Random: 2097152,
	Cinema: 4194304,
	Target: 8388608,
	Key9: 16777216,
	KeyCoop: 33554432,
	Key1: 67108864,
	Key3: 134217728,
	Key2: 268435456,
	ScoreV2: 536870912,
	Mirror: 1073741824,
};

function hasModifier(bitwiseSum, modifier) {
	return (bitwiseSum & modifiers[modifier]) !== 0;
}

function getEnabledMods(bitwiseSum) {
	const enabledModifiers = [];
	const excludedModifiers = new Set();

	for (const modifier in modifiers) {
		if (hasModifier(bitwiseSum, modifier)) {
			if (modifier === 'DT' && hasModifier(bitwiseSum, 'NC')) {
				// If Nightcore is implicitly enabled with DoubleTime, skip adding it to the list
				excludedModifiers.add(modifier);
			}
			else if (modifier === 'SD' && hasModifier(bitwiseSum, 'PF')) {
				// If Perfect is implicitly enabled with SuddenDeath, skip adding it to the list
				excludedModifiers.add(modifier);
			}
			else {
				enabledModifiers.push(modifier);
			}
		}

	}

	const filteredModifiers = enabledModifiers.filter((modifier) => !excludedModifiers.has(modifier));

	if (filteredModifiers.length === 0) {
		return 'No Mod';
	}

	return filteredModifiers.join('');
}

module.exports = { getEnabledMods };