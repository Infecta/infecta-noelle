function modeSelector(mode) {
	switch (mode) {
	case 'standard':
		return {
			embedDialog: 'osu!standard',
			selectedMode: 0,
		};
	case 'standard-rx':
		return {
			embedDialog: 'osu!standard RX',
			selectedMode: 4,
		};
	case 'taiko':
		return {
			embedDialog: 'osu!taiko',
			selectedMode: 1,
		};
	case 'taiko-rx':
		return {
			embedDialog: 'osu!taiko RX',
			selectedMode: 5,
		};
	case 'ctb':
		return {
			embedDialog: 'osu!ctb',
			selectedMode: 2,
		};
	case 'ctb-rx':
		return {
			embedDialog: 'osu!ctb RX',
			selectedMode: 6,
		};
	case 'mania':
		return {
			embedDialog: 'osu!mania',
			selectedMode: 3,
		};
	default:
		return {
			embedDialog: 'osu!standard',
			selectedMode: 0,
		};
	}
}

module.exports = { modeSelector };