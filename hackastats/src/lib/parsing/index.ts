import type { Spans } from '$lib/hackatime';

/// Group spans by date and sum up the durations
export function parseSpansForHeatmap(spans: Spans): Array<{ date: string; value: number }> {
	const dailyActivity = new Map<string, number>();

	spans.spans.forEach((span) => {
		const date = new Date(span.start_time * 1000);

		// Get date string in YYYY-MM-DD format for grouping
		const dateString = date.toISOString().split('T')[0];

		// Sum up durations for the same date
		const currentValue = dailyActivity.get(dateString) || 0;
		const duration = span.duration || 0;
		dailyActivity.set(dateString, currentValue + duration);
	});

	// Convert Map to array of objects
	const result = Array.from(dailyActivity.entries())
		.map(([dateString, value]) => {
			return { date: dateString, value: value };
		})
		.filter((item): item is { date: string; value: number } => item !== null);

	return result;
}

/// Group data by month to create heatmap series
export function createHeatmapSeries(data: Array<{ date: string; value: number }>) {
	const groupedData = new Map<string, Map<number, number>>();

	data.forEach((item) => {
		const date = new Date(item.date);
		const year = date.getFullYear();
		const day = date.getDate();
		const monthKey = `${date.toLocaleDateString('en-US', { month: 'short' })} ${year}`;

		if (!groupedData.has(monthKey)) {
			groupedData.set(monthKey, new Map<number, number>());
		}

		groupedData.get(monthKey)!.set(day, item.value);
	});

	const currentMonth = new Date().getMonth();
	const currentDay = new Date().getDate();

	// Convert to ApexCharts series format and add filler days
	const series = Array.from(groupedData.entries())
		.sort(([a], [b]) => {
			// Sort months inverse chronologically
			const [monthA, yearA] = a.split(' ');
			const [monthB, yearB] = b.split(' ');
			const dateA = new Date(`${monthA} 1, ${yearA}`);
			const dateB = new Date(`${monthB} 1, ${yearB}`);
			return dateB.getTime() - dateA.getTime();
		})
		.map(([monthKey, dayMap]) => {
			// Parse the month to get year and month number
			const [monthName, yearStr] = monthKey.split(' ');
			const year = parseInt(yearStr);
			const monthDate = new Date(`${monthName} 1, ${year}`);
			const month = monthDate.getMonth();

			// Get the number of days in this month
			const daysInMonth = new Date(year, month + 1, 0).getDate();

			// Create array with all days of the month
			const dayData: Array<{ x: string; y: number }> = [];

			// If it's the current month, only include up to the current day
			const maxDay = month === currentMonth ? currentDay : daysInMonth;

			for (let day = 1; day <= maxDay; day++) {
				const value = dayMap.get(day) || 0;
				dayData.push({
					x: `${day}`,
					y: value
				});
			}

			return {
				name: monthKey,
				data: dayData
			};
		});

	return series;
}

export function splitSpanAcrossHours(span: {
	start_time: number;
	end_time: number;
	duration: number;
}) {
	const startDate = new Date(span.start_time * 1000);
	const endDate = new Date(span.end_time * 1000);

	// If span is within the same hour, return as is
	if (
		startDate.getHours() === endDate.getHours() &&
		startDate.getDate() === endDate.getDate() &&
		startDate.getMonth() === endDate.getMonth() &&
		startDate.getFullYear() === endDate.getFullYear()
	) {
		return [{ hour: startDate.getHours(), duration: span.duration }];
	}

	const hourSegments: Array<{ hour: number; duration: number }> = [];

	// Start from the beginning of the span
	let currentTime = span.start_time;
	const endTime = span.end_time;

	while (currentTime < endTime) {
		const currentDate = new Date(currentTime * 1000);
		const currentHour = currentDate.getHours();

		// Calculate the end of the current hour
		const endOfHour = new Date(currentDate);
		endOfHour.setHours(currentHour + 1, 0, 0, 0);
		const endOfHourTimestamp = endOfHour.getTime() / 1000;

		// The segment ends at either the end of the hour or the end of the span
		const segmentEndTime = Math.min(endOfHourTimestamp, endTime);
		const segmentDuration = segmentEndTime - currentTime;

		if (segmentDuration > 0) {
			hourSegments.push({ hour: currentHour, duration: segmentDuration });
		}

		// Move to the start of the next hour
		currentTime = segmentEndTime;
	}

	return hourSegments;
}
