<script lang="ts">
	import { chart } from 'svelte-apexcharts?client';
	import type { Stats, Spans } from '$lib/hackatime';
	import { getUserStats, getUserSpans } from '$lib/hackatime';
	import { humanTime, getTrustLevelColor } from '$lib/utils';
	import { parseSpansForHeatmap, createHeatmapSeries, splitSpanAcrossHours } from '$lib/parsing';

	import { page } from '$app/state';
	import { browser } from '$app/environment';
	import { onMount } from 'svelte';

	const user = page.params.user;

	let stats: Stats | null = $state(null);
	let spans: Spans | null = $state(null);
	let heatmapData: Array<{ date: string; value: number }> = $state([]);
	let heatmapSeries: Array<{ name: string; data: Array<{ x: string; y: number }> }> = $state([]);
	let chartData: number[] = $state(Array(24).fill(0));
	let selectedDay: string | null = $state(null);

	let loading = $state(true);
	let error: string | null = $state(null);

	const catppuccinColors = [
		'var(--color-red)',
		'var(--color-peach)',
		'var(--color-yellow)',
		'var(--color-green)',
		'var(--color-teal)',
		'var(--color-sky)',
		'var(--color-sapphire)',
		'var(--color-blue)',
		'var(--color-lavender)',
		'var(--color-mauve)',
		'var(--color-pink)',
		'var(--color-flamingo)',
		'var(--color-rosewater)',
		'var(--color-maroon)'
	];

	let chartOptions = $derived({
		chart: {
			type: 'pie',
			height: 400,
			width: '100%',
			background: 'transparent',
			foreColor: 'var(--color-crust)',
			fontFamily: 'inherit'
		},
		colors: catppuccinColors,
		series: [] as number[],
		labels: [] as string[],
		legend: {
			labels: {
				colors: 'var(--color-text)',
				useSeriesColors: true
			},
			position: 'bottom',
			horizontalAlign: 'center',
			floating: false,
			fontSize: '14px',
			fontFamily: 'inherit',
			fontWeight: 400,
			markers: {
				radius: 3,
				offsetX: -3
			}
		},
		plotOptions: {
			pie: {
				labels: {
					show: true,
					name: {
						show: true,
						fontSize: '16px',
						fontFamily: 'inherit',
						fontWeight: 600,
						color: 'var(--color-crust)',
						offsetY: -10
					},
					value: {
						show: true,
						fontSize: '14px',
						fontFamily: 'inherit',
						fontWeight: 400,
						color: 'var(--color-crust)',
						offsetY: 16,
						formatter: function (val: string) {
							return parseFloat(val).toFixed(1) + 'h';
						}
					},
					total: {
						show: true,
						showAlways: false,
						label: 'Total',
						fontSize: '16px',
						fontFamily: 'inherit',
						fontWeight: 600,
						color: 'var(--color-crust)',
						formatter: function (w: any) {
							const total = w.globals.seriesTotals.reduce((a: number, b: number) => a + b, 0);
							return total.toFixed(1) + 'h';
						}
					}
				}
			}
		},
		stroke: {
			show: true,
			width: 2,
			colors: ['var(--color-crust)']
		},
		dataLabels: {
			enabled: true,
			style: {
				fontSize: '12px',
				fontFamily: 'inherit',
				fontWeight: 'bold',
				colors: ['var(--color-crust)']
			},
			formatter: function (val: number) {
				return val.toFixed(1) + '%';
			},
			dropShadow: {
				enabled: true,
				top: 1,
				left: 1,
				blur: 1,
				color: 'var(--color-text)',
				opacity: 0.5
			}
		},
		tooltip: {
			theme: 'dark',
			style: {
				fontSize: '12px',
				fontFamily: 'inherit'
			},
			custom: function ({ series, seriesIndex, dataPointIndex, w }: any) {
				const value = series[seriesIndex];
				const label = w.globals.labels[seriesIndex];
				const hours = (value / 3600).toFixed(1);
				const color = w.config.colors[seriesIndex];

				return `<div style="padding: 8px; background: var(--color-surface0); border: 1px solid var(--color-surface1); border-radius: 4px;">
						<div style="display: flex; align-items: center; margin-bottom: 4px;">
							<span style="display: inline-block; width: 12px; height: 12px; background-color: ${color}; border-radius: 50%; margin-right: 6px;"></span>
							<strong style="color: ${color};">${label}</strong>
						</div>
						<span style="color: var(--color-text);">${hours} hours</span>
					</div>`;
			}
		},
		responsive: [
			{
				breakpoint: 480,
				options: {
					chart: {
						width: 300,
						height: 300
					},
					legend: {
						position: 'bottom'
					}
				}
			}
		]
	});

	let hourlyChartOptions = $derived.by(() => ({
		chart: {
			type: 'bar',
			height: 400,
			width: '100%',
			background: 'transparent',
			foreColor: 'var(--color-text)',
			fontFamily: 'inherit',
			toolbar: {
				show: false
			}
		},
		colors: ['var(--color-blue)'],
		series: [
			{
				name: 'Activity Hours',
				data: [...chartData]
			}
		],
		plotOptions: {
			bar: {
				horizontal: false,
				columnWidth: '60%',
				borderRadius: 4,
				borderRadiusApplication: 'end',
				borderRadiusWhenStacked: 'last'
			}
		},
		dataLabels: {
			enabled: false
		},
		stroke: {
			show: true,
			width: 1,
			colors: ['var(--color-surface1)']
		},
		xaxis: {
			type: 'category',
			categories: Array.from({ length: 24 }, (_, i) => (i + 1).toString()),
			labels: {
				style: {
					colors: 'var(--color-text)',
					fontSize: '12px',
					fontFamily: 'inherit'
				},
				rotate: 0
			},
			axisBorder: {
				show: true,
				color: 'var(--color-surface1)'
			},
			axisTicks: {
				show: true,
				color: 'var(--color-surface1)'
			}
		},
		yaxis: {
			title: {
				text: 'Hours',
				style: {
					color: 'var(--color-text)',
					fontSize: '14px',
					fontFamily: 'inherit',
					fontWeight: 600
				}
			},
			labels: {
				style: {
					colors: 'var(--color-text)',
					fontSize: '12px',
					fontFamily: 'inherit'
				},
				formatter: function (val: number) {
					return (val * 60).toFixed() + 'm';
				}
			}
		},
		grid: {
			show: true,
			borderColor: 'var(--color-surface1)',
			strokeDashArray: 3,
			position: 'back',
			xaxis: {
				lines: {
					show: true
				}
			},
			yaxis: {
				lines: {
					show: true
				}
			}
		},
		tooltip: {
			theme: 'dark',
			style: {
				fontSize: '12px',
				fontFamily: 'inherit'
			},
			custom: function ({ series, seriesIndex, dataPointIndex, w }: any) {
				const value = series[seriesIndex][dataPointIndex];
				const hour = w.globals.labels[dataPointIndex];
				const time = humanTime(value * 3600);

				return `<div style="padding: 8px; background: var(--color-surface0); border: 1px solid var(--color-surface1); border-radius: 4px;">
						<div style="margin-bottom: 4px;">
							<strong style="color: var(--color-text);">${hour.toString().padStart(2, '0')}:00</strong>
						</div>
						<span style="color: var(--color-text);">${time}</span>
					</div>`;
			}
		},
		responsive: [
			{
				breakpoint: 768,
				options: {
					chart: {
						height: 300
					},
					plotOptions: {
						bar: {
							columnWidth: '80%'
						}
					},
					xaxis: {
						labels: {
							rotate: -90
						}
					}
				}
			},
			{
				breakpoint: 480,
				options: {
					chart: {
						height: 250
					},
					plotOptions: {
						bar: {
							columnWidth: '90%'
						}
					}
				}
			}
		]
	}));

	let heatmapOptions = $derived({
		chart: {
			type: 'heatmap',
			height: 400,
			background: 'transparent',
			fontFamily: 'inherit',
			events: {
				dataPointSelection: function (event: any, chartContext: any, config: any) {
					const { seriesIndex, dataPointIndex } = config;
					const monthName = heatmapSeries[seriesIndex]?.name;
					const dayData = heatmapSeries[seriesIndex]?.data[dataPointIndex];
					const day = dayData?.x;
					const value = dayData?.y;

					handleHeatmapClick(monthName, day, value);
				}
			}
		},
		colors: ['var(--color-green)'],
		series: heatmapSeries,
		dataLabels: {
			enabled: false
		},
		stroke: {
			show: true,
			width: 1,
			colors: ['var(--color-crust)']
		},
		plotOptions: {
			heatmap: {
				shadeIntensity: 0.25,
				radius: 0,
				reverseNegativeShade: true,
				useFillColorAsStroke: false,
				colorScale: {
					ranges: [
						{ from: 0.0, to: 1, color: colorVarToHex('--color-surface0'), name: 'No Activity' },
						{
							from: 1,
							to: 0.5 * 3600,
							color: colorVarToHex('--color-teal'),
							name: 'Low'
						},
						{
							from: 0.5 * 3600,
							to: 2 * 3600,
							color: colorVarToHex('--color-green'),
							name: 'Medium'
						},
						{ from: 2 * 3600, to: 4 * 3600, color: colorVarToHex('--color-yellow'), name: 'High' },
						{
							from: 4 * 3600,
							to: 8 * 3600,
							color: colorVarToHex('--color-peach'),
							name: 'Very High'
						},
						{ from: 8 * 3600, to: 24 * 3600, color: colorVarToHex('--color-red'), name: 'Extreme' }
					]
				}
			}
		},
		xaxis: {
			type: 'category',
			labels: {
				style: {
					colors: 'var(--color-text)',
					fontSize: '12px'
				}
			}
		},
		yaxis: {
			labels: {
				style: {
					colors: 'var(--color-text)',
					fontSize: '12px'
				}
			}
		},
		tooltip: {
			theme: 'dark',
			style: {
				fontSize: '12px',
				fontFamily: 'inherit'
			},
			custom: function ({ series, seriesIndex, dataPointIndex, w }: any) {
				const value = series[seriesIndex][dataPointIndex];
				const monthName = w.globals.seriesNames[seriesIndex];
				const day = w.globals.labels[dataPointIndex];
				const time = humanTime(value);

				if (value === 0 || value === null || value === undefined) {
					return `<div style="padding: 8px; background: var(--color-surface0); border: 1px solid var(--color-surface1); border-radius: 4px;">
							<strong style="color: var(--color-text);">${monthName}, Day ${day}</strong><br/>
							<span style="color: var(--color-subtext1);">No activity</span>
						</div>`;
				}

				return `<div style="padding: 8px; background: var(--color-surface0); border: 1px solid var(--color-surface1); border-radius: 4px;">
						<strong style="color: var(--color-text);">${monthName}, Day ${day}</strong><br/>
						<span style="color: var(--color-text);">${time}</span>
					</div>`;
			}
		},
		legend: {
			labels: {
				colors: 'var(--color-text)'
			}
		}
	});

	function handleHeatmapClick(monthName: string, day: string, value: number) {
		selectedDay = `${monthName}, Day ${day}`;

		const daySpans =
			spans?.spans.filter((span) => {
				const spanDate = new Date(span.start_time * 1000);
				const spanDay = spanDate.getDate().toString();
				const spanMonth = spanDate.toLocaleDateString('en-US', { month: 'short' });
				const spanYear = spanDate.getFullYear().toString();
				return (
					spanDay === day &&
					spanMonth === monthName.split(' ')[0] &&
					spanYear === monthName.split(' ')[1]
				);
			}) || [];

		// Initialize hour buckets
		const hourlyDurations = Array(24).fill(0);

		// Split each span across hours and accumulate durations
		daySpans.forEach((span) => {
			const hourSegments = splitSpanAcrossHours(span);
			hourSegments.forEach((segment) => {
				if (segment.hour >= 0 && segment.hour < 24) {
					hourlyDurations[segment.hour] += segment.duration / 3600;
				}
			});
		});

		if (hourlyDurations.reduce((a, b) => a + b, 0) === 0) {
			chartData = Array(24).fill(0);
			return;
		}

		chartData = hourlyDurations;

		// Scroll to the graph
		if (browser) {
			setTimeout(() => {
				window.scrollTo({
					top: document.body.scrollHeight,
					behavior: 'smooth'
				});
			}, 100);
		}
	}

	function colorVarToHex(colorVar: string): string {
		if (!browser) {
			return '#000000';
		}

		const styles = getComputedStyle(document.documentElement);
		const color = styles.getPropertyValue(colorVar).trim();
		return color || '#000000';
	}

	onMount(async () => {
		if (!user) {
			error = 'User parameter is missing';
			loading = false;
			return;
		}

		try {
			const now = new Date();
			const tenYearsAgo = new Date();
			tenYearsAgo.setFullYear(now.getFullYear() - 10);

			const userData = await getUserStats(user, 10, 'languages', tenYearsAgo, now);
			const userSpans = await getUserSpans(user);
			spans = userSpans;
			stats = userData;

			if (spans && spans.spans.length > 0) {
				heatmapData = parseSpansForHeatmap(spans);
				heatmapSeries = createHeatmapSeries(heatmapData);
			}

			if (!stats?.data?.languages) {
				error = `No language data found for user: ${user}`;
				loading = false;
				return;
			}

			const languageData = Object.values(stats.data.languages);

			chartOptions.series = languageData.map((lang) => lang.total_seconds);
			chartOptions.labels = languageData.map((lang) => lang.name);

			loading = false;
		} catch (err) {
			console.error('Error fetching user stats:', err);
			error = `Failed to fetch data for user: ${user}`;
			loading = false;
		}
	});
</script>

<div class="min-h-screen bg-base text-text">
	<div class="container mx-auto px-4 py-8">
		<div class="mb-8 text-center">
			<h1 class="mb-2 text-3xl font-bold text-text">
				<a href="/">Hacka<span class="text-pink">stats</span></a>
			</h1>
			<p class="text-subtext1">
				Displaying data for user: <strong class="text-text">{user}</strong>
			</p>
		</div>

		<div class="mx-auto max-w-4xl">
			<div class="rounded-xl border border-surface1 bg-surface0/50 p-6 shadow-lg">
				<div class="mb-4 flex items-center">
					<span
						class="mr-2 inline-block h-6 w-6 rounded-full border-2 border-surface2 align-middle"
						style="background: var(--color-{stats
							? getTrustLevelColor(stats.trust_factor.trust_value)
							: 'blue'});"
					></span>
					{#if isNaN(parseInt(user!))}
						<h2 class="text-xl font-semibold text-text">
							{stats ? stats.data.username : 'Loading...'}
							<span class="text-subtext0">({stats ? stats.data.user_id : '...'})</span>
						</h2>
					{:else}
						<h2 class="text-xl font-semibold text-text">
							{stats ? stats.data.username : 'Loading...'}
						</h2>
					{/if}
				</div>

				<div>
					<p class="text-subtext1">
						Total time: {stats ? stats.data.human_readable_total : 'Loading...'}
					</p>
				</div>

				{#if loading}
					<div class="flex h-96 flex-col items-center justify-center">
						<div class="mb-4 h-12 w-12 animate-spin rounded-full border-b-2 border-blue"></div>
						<p class="text-subtext1">Loading chart data...</p>
					</div>
				{:else if error}
					<div class="flex h-96 items-center justify-center">
						<div class="max-w-md rounded-lg border border-red/20 bg-red/10 p-6">
							<p class="font-semibold text-red">Error: {error}</p>
						</div>
					</div>
				{:else if chartOptions.series.length > 0}
					<div class="h-96 w-full" use:chart={chartOptions}></div>
				{:else}
					<div class="flex h-96 items-center justify-center">
						<div class="rounded-lg border border-surface1 bg-surface0/50 p-6">
							<p class="text-subtext1">No data available to display.</p>
						</div>
					</div>
				{/if}
			</div>

			{#if !error}
				<div class="mt-8 rounded-xl border border-surface1 bg-surface0/50 p-6 shadow-lg">
					{#if loading}
						<div class="flex h-96 flex-col items-center justify-center">
							<div class="mb-4 h-12 w-12 animate-spin rounded-full border-b-2 border-blue"></div>
							<p class="text-subtext1">Loading heatmap data...</p>
						</div>
					{:else if heatmapSeries.length > 0}
						<h3 class="mb-4 text-xl font-semibold text-text">Activity Heatmap</h3>
						<div class="latte h-96 w-full" use:chart={heatmapOptions}></div>
					{/if}
				</div>
			{/if}

			{#if !error}
				<div
					class="mt-8 rounded-xl border border-surface1 bg-surface0/50 p-6 shadow-lg"
					style="min-height: 500px;"
				>
					{#if loading}
						<div class="flex h-96 flex-col items-center justify-center">
							<div class="mb-4 h-12 w-12 animate-spin rounded-full border-b-2 border-blue"></div>
							<p class="text-subtext1">Loading data...</p>
						</div>
					{:else if selectedDay}
						{#if chartData.reduce((a, b) => a + b, 0) === 0}
							<h3 class="mb-4 text-xl font-semibold text-text">{selectedDay}</h3>
							<div class="flex h-96 items-center justify-center">
								<p class="text-subtext1">No data available to display for this day</p>
							</div>
						{:else}
							<h3 class="mb-4 text-xl font-semibold text-text">{selectedDay}</h3>
							{#key chartData}
								<div class="latte h-96 w-full" use:chart={hourlyChartOptions}></div>
							{/key}
						{/if}
					{:else}
						<div class="flex h-96 items-center justify-center">
							<p class="text-subtext1">
								Click on a day in the heatmap above to view hourly activity
							</p>
						</div>
					{/if}
				</div>
			{/if}
		</div>
	</div>
</div>
