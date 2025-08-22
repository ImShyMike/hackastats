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
