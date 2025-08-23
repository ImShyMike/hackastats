<script lang="ts">
	// @ts-expect-error
	import { chart } from 'svelte-apexcharts?client';
	import type { Stats, Spans } from '$lib/hackatime';
	import { getUserStats, getUserSpans } from '$lib/hackatime';
	import { humanTime, getMinutes, getTrustLevelColor } from '$lib/utils';
	import { parseSpansForHeatmap, createHeatmapSeries, splitSpanAcrossHours } from '$lib/parsing';
	import { userTypeHint } from '$lib/hackatime';

	import { page } from '$app/state';
	import { browser } from '$app/environment';
	import { onMount } from 'svelte';

	const user = page.params.user;

	let userElement: HTMLElement | null = null;
	let stats: Stats | null = $state(null);
	let spans: Spans | null = $state(null);
	let projectsStats: Stats | null = $state(null);
	let heatmapData: Array<{ date: string; value: number }> = $state([]);
	let heatmapSeries: Array<{ name: string; data: Array<{ x: string; y: number }> }> = $state([]);
	let chartData: number[] = $state(Array(24).fill(0));
	let projectData: Array<{ name: string; total_seconds: number }> = $state([]);
	let dailyProjectData: Array<{ name: string; total_seconds: number }> = $state([]);
	let selectedDay: string | null = $state(null);

	let loading = $state({ pieChart: true, projectChart: true, heatmap: true });
	let error: string | null = $state(null);

	let debounceTimer: number | null = null;
	let cachedTypeHints: Record<string, { hint: string; trustLevel: number }> = {};
	let hintText = $state('...');
	let userTrustLevel = $state(-1);

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

	let pieChartOptions = $derived({
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
							return (Math.round(parseFloat(val) * 10) / 10).toFixed(1) + 'h';
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
							return (Math.round(total * 10) / 10).toFixed(1) + 'h';
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
				return (Math.round(val * 10) / 10).toFixed(1) + '%';
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
				const hours = (Math.round((value / 3600) * 10) / 10).toFixed(1);
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

	let projectChartOptions = $derived({
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
		colors: ['var(--color-mauve)'],
		series: [
			{
				name: 'Hours',
				data: projectData.map((p) => p.total_seconds / 3600).slice(0, 10)
			}
		],
		plotOptions: {
			bar: {
				horizontal: true,
				columnWidth: '90%',
				borderRadius: 4,
				borderRadiusApplication: 'end',
				borderRadiusWhenStacked: 'last'
			}
		},
		dataLabels: {
			enabled: true,
			textAnchor: 'end',
			offsetX: 20,
			style: {
				fontSize: '12px',
				fontFamily: 'inherit',
				fontWeight: 'bold',
				colors: ['var(--color-base)']
			},
			formatter: function (val: number) {
				return humanTime(val * 3600);
			}
		},
		stroke: {
			show: true,
			width: 1,
			colors: ['var(--color-surface1)']
		},
		xaxis: {
			title: {
				text: 'Hours',
				style: {
					color: 'var(--color-text)',
					fontSize: '14px',
					fontFamily: 'inherit',
					fontWeight: 600
				}
			},
			type: 'category',
			categories: projectData.map((p) => p.name).slice(0, 10),
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
				text: 'Projects',
				style: {
					color: 'var(--color-text)',
					fontSize: '14px',
					fontFamily: 'inherit',
					fontWeight: 600
				},
				offsetX: 10
			},
			labels: {
				style: {
					colors: 'var(--color-text)',
					fontSize: '12px',
					fontFamily: 'inherit'
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
				const name = w.globals.labels[dataPointIndex];
				const time = humanTime(value * 3600);

				return `<div style="padding: 8px; background: var(--color-surface0); border: 1px solid var(--color-surface1); border-radius: 4px;">
						<div style="margin-bottom: 4px;">
							<strong style="color: var(--color-text);">${escapeHtml(name)}</strong>
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
				columnWidth: '90%',
				borderRadius: 4,
				borderRadiusApplication: 'end',
				borderRadiusWhenStacked: 'last'
			}
		},
		dataLabels: {
			enabled: true,
			style: {
				fontSize: '12px',
				fontFamily: 'inherit',
				fontWeight: 'bold',
				colors: ['var(--color-base)']
			},
			formatter: function (val: number) {
				if (val === 0) return '';
				return getMinutes(val * 3600);
			}
		},
		stroke: {
			show: true,
			width: 1,
			colors: ['var(--color-surface1)']
		},
		xaxis: {
			title: {
				text: 'Time of day',
				style: {
					color: 'var(--color-text)',
					fontSize: '14px',
					fontFamily: 'inherit',
					fontWeight: 600
				},
				offsetX: 10
			},
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
					return humanTime(val * 3600);
				}
			},
			max: 1
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
			},
			toolbar: {
				show: false
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

	let dailyProjectChartOptions = $derived({
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
		colors: ['var(--color-maroon)'],
		series: [
			{
				name: 'Time',
				data: dailyProjectData.map((p) => p.total_seconds / 3600).slice(0, 10)
			}
		],
		plotOptions: {
			bar: {
				horizontal: true,
				columnWidth: '90%',
				borderRadius: 4,
				borderRadiusApplication: 'end',
				borderRadiusWhenStacked: 'last'
			}
		},
		dataLabels: {
			enabled: true,
			textAnchor: 'end',
			offsetX: 20,
			style: {
				fontSize: '12px',
				fontFamily: 'inherit',
				fontWeight: 'bold',
				colors: ['var(--color-base)']
			},
			formatter: function (val: number) {
				return humanTime(val * 3600);
			}
		},
		stroke: {
			show: true,
			width: 1,
			colors: ['var(--color-surface1)']
		},
		xaxis: {
			title: {
				text: 'Hours',
				style: {
					color: 'var(--color-text)',
					fontSize: '14px',
					fontFamily: 'inherit',
					fontWeight: 600
				}
			},
			type: 'category',
			categories: dailyProjectData.map((p) => p.name).slice(0, 10),
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
				text: 'Projects',
				style: {
					color: 'var(--color-text)',
					fontSize: '14px',
					fontFamily: 'inherit',
					fontWeight: 600
				},
				offsetX: 10
			},
			labels: {
				style: {
					colors: 'var(--color-text)',
					fontSize: '12px',
					fontFamily: 'inherit'
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
				const name = w.globals.labels[dataPointIndex];
				const time = humanTime(value * 3600);

				return `<div style="padding: 8px; background: var(--color-surface0); border: 1px solid var(--color-surface1); border-radius: 4px;">
						<div style="margin-bottom: 4px;">
							<strong style="color: var(--color-text);">${escapeHtml(name)}</strong>
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
	});

	function escapeHtml(text: string) {
		const map: Record<string, string> = {
			'&': '&amp;',
			'<': '&lt;',
			'>': '&gt;',
			'"': '&quot;',
			"'": '&#039;'
		};
		return text.replace(/[&<>"']/g, function (m) {
			return map[m];
		});
	}

	async function getProjectsForDay(monthName: string, day: string) {
		if (!user) return;

		// Get date object for the start of the day
		const [monthAbbr, year] = monthName.split(' ');
		const startDate = new Date(`${monthAbbr} ${day}, ${year} 00:00:00`);
		const endDate = new Date(`${monthAbbr} ${day}, ${year} 23:59:59`);

		getUserStats(user, 10, 'projects', startDate, endDate).then((data) => {
			console.log('Projects for day data:', data);
			if (data?.data?.projects) {
				dailyProjectData = Object.values(data.data.projects).sort(
					(a, b) => b.total_seconds - a.total_seconds
				);
			} else {
				dailyProjectData = [];
			}
		});
	}
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

		// Get projects for that day
		getProjectsForDay(monthName, day);

		// Scroll to the graphs
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

	function changePage() {
		if (browser && userElement) {
			const newUser = userElement.innerText.trim();
			if (newUser && newUser !== user) {
				window.location.href = `/${newUser}`;
			}
		}
	}

	async function loadPieChart(user: string, tenYearsAgo: Date, now: Date) {
		try {
			const userData = await getUserStats(user, 10, 'languages', tenYearsAgo, now);
			stats = userData;

			if (!stats?.data?.languages) {
				error = `No language data found for user: ${user}`;
				loading.pieChart = false;
				return;
			}

			const languageData = Object.values(stats.data.languages);

			pieChartOptions.series = languageData.map((lang) => lang.total_seconds);
			pieChartOptions.labels = languageData.map((lang) => lang.name);
		} catch (err) {
			console.error('Error fetching user stats:', err);
			error = `Failed to fetch data for user: ${user}`;
		} finally {
			loading.pieChart = false;
		}
	}

	async function loadProjectChart(user: string, tenYearsAgo: Date, now: Date) {
		try {
			const userProjectsData = await getUserStats(user, 10, 'projects', tenYearsAgo, now);
			projectsStats = userProjectsData;

			projectData = projectsStats.data.projects
				? Object.values(projectsStats.data.projects).sort(
						(a, b) => b.total_seconds - a.total_seconds
					)
				: [];
		} catch (err) {
			console.error('Error fetching user projects:', err);
			error = `Failed to fetch projects for user: ${user}`;
		} finally {
			loading.projectChart = false;
		}
	}

	async function loadSpans(user: string) {
		try {
			const userSpans = await getUserSpans(user);
			spans = userSpans;

			if (spans && spans.spans.length > 0) {
				heatmapData = parseSpansForHeatmap(spans);
				heatmapSeries = createHeatmapSeries(heatmapData);
			} else {
				error = `No span data found for user: ${user}`;
			}
		} catch (err) {
			console.error('Error fetching user spans:', err);
			error = `Failed to fetch spans for user: ${user}`;
		} finally {
			loading.heatmap = false;
		}
	}

	onMount(async () => {
		if (!user) {
			error = 'User parameter is missing';
			loading.pieChart = false;
			loading.projectChart = false;
			loading.heatmap = false;
			return;
		}

		const now = new Date();
		const tenYearsAgo = new Date();
		tenYearsAgo.setFullYear(now.getFullYear() - 10);

		loadPieChart(user, tenYearsAgo, now);
		loadProjectChart(user, tenYearsAgo, now);
		loadSpans(user);
	});
</script>

<div class="min-h-screen bg-base text-text">
	<div class="container mx-auto px-4 py-8">
		<div class="mb-8 text-center">
			<h1 class="mb-2 text-3xl font-bold text-text">
				<a href="/">Hacka<span class="text-pink">stats</span></a>
			</h1>

			<p class="text-subtext1">
				Displaying data for user: <span
					id="current-user"
					class="rounded-lg border border-lavender bg-surface0 px-1.5 py-0.5 text-text"
					role="textbox"
					onblur={() => {
						hintText = '...';
						if (userElement) {
							userElement.textContent = user ? user : '';
						}
					}}
					onkeypress={(e) => {
						if (e.key === 'Enter') {
							e.preventDefault();
							changePage();
						}
					}}
					tabindex="0"
					oninput={async () => {
						const userInput = userElement?.innerText || '';

						if (userInput.trim() === '') {
							hintText = '...';
							userTrustLevel = -1;
							return;
						}

						if (cachedTypeHints[userInput]) {
							const { hint, trustLevel } = cachedTypeHints[userInput];
							hintText = hint;
							userTrustLevel = trustLevel;
							return;
						}

						if (debounceTimer !== null) {
							clearTimeout(debounceTimer);
						}

						debounceTimer = setTimeout(async () => {
							await userTypeHint(userInput, cachedTypeHints).then(
								({ hint, trustLevel }: { hint: string; trustLevel: number }) => {
									hintText = hint;
									userTrustLevel = trustLevel;
								}
							);
						}, 500);
					}}
					contenteditable
					bind:this={userElement}>{user}</span
				>
			</p>

			{#if hintText !== '...'}
				<div class="relative flex w-full justify-center" style="z-index:10;">
					<div
						class="absolute top-0 left-1/2 w-max max-w-xs -translate-x-1/2 rounded-lg border border-surface1 bg-base px-3 py-2 shadow-lg"
					>
						<span
							class="mr-1 inline-block h-6 w-6 rounded-full border-2 border-surface2 align-middle"
							style="background: var(--color-{getTrustLevelColor(userTrustLevel)});"
						></span>
						<span class="text-sm text-text">{hintText}</span>
					</div>
				</div>
			{/if}
		</div>

		<div class="mx-auto max-w-4xl">
			<div class="rounded-xl border border-surface1 bg-surface0/50 p-6 shadow-lg">
				<div class="mb-4 flex items-center">
					<span
						class="mr-2 inline-block h-6 w-6 rounded-full border-2 border-surface2 align-middle"
						style="background: var(--color-{stats
							? getTrustLevelColor(stats.trust_factor.trust_value)
							: 'overlay0'});"
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

				{#if loading.pieChart}
					<div class="flex h-96 flex-col items-center justify-center">
						<div class="mb-4 h-12 w-12 animate-spin rounded-full border-b-2 border-yellow"></div>
						<p class="text-subtext1">Loading chart data...</p>
					</div>
				{:else if error}
					<div class="flex h-96 items-center justify-center">
						<div class="max-w-md rounded-lg border border-red/20 bg-red/10 p-6">
							<p class="font-semibold text-red">Error: {error}</p>
						</div>
					</div>
				{:else if pieChartOptions.series.length > 0}
					<div class="h-96 w-full" use:chart={pieChartOptions}></div>
				{:else}
					<div class="flex h-96 items-center justify-center">
						<div class="rounded-lg border border-surface1 bg-surface0/50 p-6">
							<p class="text-subtext1">No data available to display</p>
						</div>
					</div>
				{/if}
			</div>

			{#if !error}
				<div class="mt-8 rounded-xl border border-surface1 bg-surface0/50 p-6 shadow-lg">
					{#if loading.projectChart}
						<div class="flex h-96 flex-col items-center justify-center">
							<div class="mb-4 h-12 w-12 animate-spin rounded-full border-b-2 border-mauve"></div>
							<p class="text-subtext1">Loading project data...</p>
						</div>
					{:else if projectData.length === 0}
						<div class="flex h-96 items-center justify-center">
							<div class="rounded-lg border border-surface1 bg-surface0/50 p-6">
								<p class="text-subtext1">No project data available to display</p>
							</div>
						</div>
					{:else}
						{#key projectChartOptions}
							<div class="overwrite-min-height h-96 w-full" use:chart={projectChartOptions}></div>
						{/key}
					{/if}
				</div>
			{/if}

			{#if !error}
				<div class="mt-8 rounded-xl border border-surface1 bg-surface0/50 p-6 shadow-lg">
					{#if loading.heatmap}
						<div class="flex h-96 flex-col items-center justify-center">
							<div class="mb-4 h-12 w-12 animate-spin rounded-full border-b-2 border-sky"></div>
							<p class="text-subtext1">Loading heatmap data...</p>
						</div>
					{:else if heatmapSeries.length > 0}
						<h3 class="mb-4 text-xl font-semibold text-text">Activity Heatmap</h3>
						<div class="h-96 w-full" use:chart={heatmapOptions}></div>
					{/if}
				</div>
			{/if}

			{#if !error}
				<div
					class="mt-8 rounded-xl border border-surface1 bg-surface0/50 p-6 shadow-lg"
					style="min-height: 896px;"
				>
					{#if loading.heatmap}
						<div class="flex h-192 flex-col items-center justify-center">
							<div class="mb-4 h-12 w-12 animate-spin rounded-full border-b-2 border-blue"></div>
							<p class="text-subtext1">Loading daily data...</p>
						</div>
					{:else if selectedDay}
						{#if chartData.reduce((a, b) => a + b, 0) === 0}
							<h3 class="mb-4 text-xl font-semibold text-text">{selectedDay}</h3>
							<div class="flex h-192 items-center justify-center">
								<p class="text-subtext1">No data available to display for this day</p>
							</div>
						{:else}
							<h3 class="mb-4 text-xl font-semibold text-text">{selectedDay}</h3>
							{#key chartData}
								<div class="overwrite-min-height h-96 w-full" use:chart={hourlyChartOptions}></div>

								<div class="overwrite-min-height h-96 w-full" use:chart={dailyProjectChartOptions}></div>
							{/key}
						{/if}
					{:else}
						<div class="flex h-192 items-center justify-center">
							<p class="text-subtext1">
								Click on a day in the heatmap above to view daily activity
							</p>
						</div>
					{/if}
				</div>
			{/if}
		</div>
	</div>
</div>

<style>
	/* this is probably an ApexCharts config but i can't find it */
	.overwrite-min-height {
		min-height: 400px !important;
	}
</style>
