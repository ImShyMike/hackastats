type Features = 'projects' | 'languages';

export type Stats = {
	data: {
		username: string;
		user_id: string;
		is_coding_activity_visible: boolean;
		is_other_usage_visible: boolean;
		status: string;
		start: string;
		end: string;
		range: string;
		human_readable_range: string;
		total_seconds: number;
		daily_average: number;
		human_readable_total: string;
		human_readable_daily_average: string;
		projects?: {
			[key: string]: {
				name: string;
				total_seconds: number;
				text: string;
				hours: number;
				minutes: number;
				percent: number;
				digital: string;
			};
		};
		languages?: {
			[key: string]: {
				name: string;
				total_seconds: number;
				text: string;
				hours: number;
				minutes: number;
				percent: number;
				digital: string;
			};
		};
	};
	trust_factor: {
		trust_level: string;
		trust_value: number;
	};
};

export type Spans = {
	spans: Array<{
		start_time: number;
		end_time: number;
		duration: number;
	}>;
};

async function getJson(url: string): Promise<unknown> {
	return fetch(url, {
		headers: {
			'Content-Type': 'application/json',
			Accept: 'application/json'
		}
	})
		.then((response) => {
			if (!response.ok) {
				throw new Error(`HTTP error! status: ${response.status}`);
			}
			return response.json();
		})
		.catch((error) => {
			console.error('Error fetching JSON:', error);
			return null;
		});
}

export async function getUserStats(
	user: string | number,
	limit: number,
	features: Features,
	start_date: Date,
	end_date: Date
): Promise<Stats> {
	const url = `https://hackatime.hackclub.com/api/v1/users/${user}/stats?limit=${limit}&features=${features}&start_date=${start_date.toISOString()}&end_date=${end_date.toISOString()}`;
	return (await getJson(url)) as Stats;
}

export async function getUserSpans(user: string | number): Promise<Spans> {
	const url = `https://hackatime.hackclub.com/api/v1/users/${user}/heartbeats/spans`;
	return (await getJson(url)) as Spans;
}

export async function userTypeHint(
	input: string,
	cachedTypeHints: Record<string, {hint: string, trustLevel: number}>
): Promise<{hint: string, trustLevel: number}> {
	if (cachedTypeHints[input]) {
		const { hint, trustLevel } = cachedTypeHints[input];
		return { hint, trustLevel };
	} else {
		const startDate = new Date('2030-01-01T00:00:00Z');
		const endDate = new Date(startDate.getTime() + 1000); // 1 second later
		const userStats: Stats | null = await getUserStats(input, 0, 'languages', startDate, endDate);

		if (userStats) {
			const username = userStats.data.username;
			const hint = username ? `${username}` : '...';
			const trustLevel = userStats.trust_factor.trust_value || 0;
			cachedTypeHints[input] = { hint, trustLevel };

			return { hint, trustLevel };
		} else {
			cachedTypeHints[input] = { hint: 'User not found', trustLevel: -1 };

			return { hint: 'User not found', trustLevel: -1 };
		}
	}
}
