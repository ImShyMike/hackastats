<script lang="ts">
	import { userTypeHint } from '$lib/hackatime';

	let debounceTimer: number | null = null;
	let cachedNames: Record<string, string> = {};
	let hintText = '...';

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
							await userTypeHint(userInput, cachedNames).then((hint) => {
								hintText = hint;
							});
						}, 500);
					}}
					placeholder="user/slack id here..."
					class="input input-bordered w-full max-w-xs rounded border-text bg-surface0 text-text"
				/>

				<div class="mb-4 w-full max-w-xs">
					<div class="rounded-lg border border-surface1 bg-base px-3 py-2 shadow-lg">
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
