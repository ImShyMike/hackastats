export function getTrustLevelColor(trustValue: number): string {
	if (trustValue == 0) return 'blue';
	if (trustValue == 1) return 'yellow';
	if (trustValue == 2) return 'green';
	if (trustValue == 3) return 'red';
	return 'overlay0';
}

export function humanTime(seconds: number): string {
	const hrs = Math.floor(seconds / 3600);
	const mins = Math.floor((seconds % 3600) / 60);
	if (seconds === 0) {
		return '0s';
	} else if (hrs === 0 && mins === 0) {
		return '<1m';
	} else if (hrs === 0) {
		return `${mins}m`;
	}
	return `${hrs}h ${mins}m`;
}

export function getMinutes(seconds: number): string {
	const mins = Math.floor((seconds % 3600) / 60);
	return mins.toString();
}
