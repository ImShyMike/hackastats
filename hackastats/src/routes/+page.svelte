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

<div class="min-h-screen bg-base text-text flex flex-col items-center justify-center">
    <div class="px-20 py-10 border border-text bg-mantle">
        <div class="text-center mb-8">
            <h1 class="text-3xl font-bold text-text mb-2">Hackastats</h1>
        </div>

        <div class="max-w-4xl mx-auto">
            <form class="flex flex-col justify-center items-center" on:submit={handleSubmit}>
            <input
              id="user-input" 
              type="text" 
              bind:value={userInput}
              placeholder="user/slack id here..." 
              class="input input-bordered w-full max-w-xs mb-4 bg-surface0 border-text text-text" 
            />
            <button type="submit" class="btn btn-primary mb-4 bg-blue px-4 py-2 text-base cursor-pointer hover:bg-lavender">Search</button>
          </form>
        </div>
    </div>
</div>