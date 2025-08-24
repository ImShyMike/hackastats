<script lang="ts">
	import { userTypeHint } from '$lib/hackatime';
	import { getTrustLevelColor } from '$lib/utils';

	let debounceTimer: number | null = null;
	let cachedTypeHints: Record<string, { hint: string; trustLevel: number }> = {};
	let hintText = '...';
	let userTrustLevel = -1;

	let userInput = '';

	function handleSearch() {
		const trimmedInput = userInput.trim();
		if (trimmedInput) {
			window.location.href = `/${trimmedInput}`;
		}
	}

	function handleSubmit(event: Event) {
		event.preventDefault();
		handleSearch();
	}
</script>

<svelte:head>
	<title>Hackastats</title>
	<meta name="description" content="An easy to use Hackatime stats viewer." />
	<meta name="viewport" content="width=device-width, initial-scale=1" />

	<meta property="og:title" content="Hackastats" />
	<meta property="og:description" content="An easy to use Hackatime stats viewer." />
	<meta property="og:type" content="website" />
	<meta property="og:url" content="https://hackastats.pages.dev/" />
	<meta property="og:image" content="https://hackastats.pages.dev/hackastats.png" />
	<meta property="og:image:alt" content="Hackastats Logo" />

	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:title" content="Hackastats" />
	<meta name="twitter:description" content="An easy to use Hackatime stats viewer." />
	<meta name="twitter:image" content="https://hackastats.pages.dev/hackastats.png" />
	<meta name="twitter:image:alt" content="Hackastats Logo" />
</svelte:head>

<div class="flex min-h-screen flex-col items-center justify-around bg-base text-text">
	<div class="mt-8 rounded-xl border border-surface1 bg-surface0/50 px-20 py-10 shadow-lg">
		<div class="mb-8 text-center">
			<h1 class="mb-2 text-3xl font-bold text-text">
				<a href="/">Hacka<span class="text-pink">stats</span></a>
			</h1>
		</div>

		<div class="mx-auto max-w-4xl">
			<form class="flex flex-col items-center justify-center" onsubmit={handleSubmit}>
				<input
					id="user-input"
					type="text"
					bind:value={userInput}
					autocomplete="off"
					oninput={async () => {
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
					placeholder="user/slack id here..."
					class="input input-bordered w-full max-w-xs rounded border-text bg-surface0 text-text"
				/>

				<div class="mb-4 w-full max-w-xs">
					<div class="rounded-lg border border-surface1 bg-base px-3 py-2 shadow-lg">
						{#if userTrustLevel !== -1}
							<span
								class="mr-2 inline-block h-6 w-6 rounded-full border-2 border-surface2 align-middle"
								style="background: var(--color-{getTrustLevelColor(userTrustLevel)});"
							></span>
						{/if}
						<span class="text-sm text-text">{hintText}</span>
					</div>
				</div>

				<button
					type="submit"
					class="btn btn-primary mt-4 cursor-pointer rounded bg-blue px-4 py-2 text-base hover:bg-lavender"
					>Search</button
				>
			</form>
		</div>
	</div>
	<div></div>
</div>
