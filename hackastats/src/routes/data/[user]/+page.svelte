<script lang="ts">
    import { chart } from 'svelte-apexcharts?client';
    import type { Stats } from '$lib/hackatime';
    import { getUserStats } from '$lib/hackatime';

    import { page } from '$app/state';
	import { onMount } from 'svelte';

    const user = page.params.user;

    let stats: Stats | null = null;
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

    let chartOptions = $state({
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
                fontFamily: 'inherit',
            },
            y: {
                formatter: function (val: number) {
                    return (val / 3600).toFixed(1) + ' hours';
                }
            }
        },
        responsive: [{
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
        }]
    });

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

            const data = await getUserStats(user, 10, 'languages', tenYearsAgo, now);
            stats = data;

            console.log('Fetched user stats:', stats);

            if (!stats?.data?.languages) {
                error = `No language data found for user: ${user}`;
                loading = false;
                return;
            }

            const languageData = Object.values(stats.data.languages);

            chartOptions.series = languageData.map(lang => lang.total_seconds);
            chartOptions.labels = languageData.map(lang => lang.name);
            
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
        <div class="text-center mb-8">
            <h1 class="text-3xl font-bold text-text mb-2">Hackastats</h1>
            <p class="text-subtext1">Displaying data for user: <strong class="text-text">{user}</strong></p>
        </div>

        <div class="max-w-4xl mx-auto">
            {#if loading}
                <div class="flex flex-col items-center justify-center h-96">
                    <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue mb-4"></div>
                    <p class="text-subtext1">Loading chart data...</p>
                </div>
            {:else if error}
                <div class="flex items-center justify-center h-96">
                    <div class="bg-red/10 border border-red/20 rounded-lg p-6 max-w-md">
                        <p class="text-red font-semibold">Error: {error}</p>
                    </div>
                </div>
            {:else if chartOptions.series.length > 0}
                <div class="bg-surface0/50 rounded-xl p-6 shadow-lg border border-surface1">
                    <div class="h-96 w-full" use:chart={chartOptions}></div>
                </div>
            {:else}
                <div class="flex items-center justify-center h-96">
                    <div class="bg-surface0/50 border border-surface1 rounded-lg p-6">
                        <p class="text-subtext1">No data available to display.</p>
                    </div>
                </div>
            {/if}
        </div>
    </div>
</div>


