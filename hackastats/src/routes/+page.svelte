<script lang="ts">
	import { getUserStats } from '$lib/hackatime';
	import type { Stats } from '$lib/hackatime';

	let debounceTimer: number | null = null;
	let cachedNames: Record<string, string> = {};
	let hintText = '...';

	async function userTypeHint(input: string) {
		if (cachedNames[input]) {
			const hint = cachedNames[input];
			hintText = hint;
		} else {
			const startDate = new Date('2030-01-01T00:00:00Z');
			const endDate = new Date(startDate.getTime() + 1000); // 1 second later
			const userStats: Stats | null = await getUserStats(input, 0, 'languages', startDate, endDate);

			if (userStats) {
				const username = userStats.data.username;
				const hint = username ? `${username}` : "...";
				hintText = hint;
				cachedNames[input] = hint;
			} else {
				hintText = 'User not found';
				cachedNames[input] = 'User not found';
			}
		}
	}

	let userInput = '';

	function handleSearch() {
		const trimmedInput = userInput.trim();
		if (trimmedInput) {
			window.location.href = `/data/${trimmedInput}`;
		}
	}

	function handleSubmit(event: Event) {
		event.preventDefault();
		handleSearch();
	}
</script>

<div class="flex min-h-screen flex-col items-center justify-around bg-base text-text">
	<div class="mt-8 rounded-xl border border-surface1 bg-surface0/50 px-20 py-10 shadow-lg">
		<div class="mb-8 text-center">
			<h1 class="mb-2 text-3xl font-bold text-text"><a href="/">Hacka<span class="text-pink">stats</span></a></h1>
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
							return;
						}

						if (cachedNames[userInput]) {
							const hint = cachedNames[userInput];
							hintText = hint;
							return;
						}

						if (debounceTimer !== null) {
							clearTimeout(debounceTimer);
						}

						debounceTimer = setTimeout(async () => {
							await userTypeHint(userInput);
						}, 500);
					}}
					placeholder="user/slack id here..."
					class="rounded input input-bordered w-full max-w-xs border-text bg-surface0 text-text"
				/>

				<div class="w-full max-w-xs mb-4">
					<div class="bg-base border border-surface1 rounded-lg px-3 py-2 shadow-lg">
						<span class="text-text text-sm">{hintText}</span>
					</div>
				</div>

				<button
					type="submit"
					class="rounded btn btn-primary mt-4 cursor-pointer bg-blue px-4 py-2 text-base hover:bg-lavender"
					>Search</button
				>
			</form>
		</div>
	</div>
	<div></div>
</div>
