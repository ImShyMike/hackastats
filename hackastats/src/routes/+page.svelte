<script lang="ts">
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

<div class="flex min-h-screen flex-col items-center justify-center bg-base text-text">
	<div class="border border-text bg-mantle px-20 py-10">
		<div class="mb-8 text-center">
			<h1 class="mb-2 text-3xl font-bold text-text">Hackastats</h1>
		</div>

		<div class="mx-auto max-w-4xl">
			<form class="flex flex-col items-center justify-center" on:submit={handleSubmit}>
				<input
					id="user-input"
					type="text"
					bind:value={userInput}
					placeholder="user/slack id here..."
					class="input input-bordered mb-4 w-full max-w-xs border-text bg-surface0 text-text"
				/>
				<button
					type="submit"
					class="btn btn-primary mb-4 cursor-pointer bg-blue px-4 py-2 text-base hover:bg-lavender"
					>Search</button
				>
			</form>
		</div>
	</div>
</div>
