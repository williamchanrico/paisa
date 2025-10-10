<script lang="ts">
  import { createEventDispatcher } from "svelte";

  export let options: string[] = [];
  export let selectedItems: Set<string> = new Set();
  export let placeholder: string = "Select items...";
  export let maxDisplayItems: number = 3;

  const dispatch = createEventDispatcher<{
    change: { selectedItems: Set<string> };
  }>();

  let isOpen = false;
  let searchTerm = "";
  let dropdownElement: HTMLElement;

  // Filter options based on search term
  $: filteredOptions = options.filter((option) =>
    option.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Display text for the dropdown button
  $: displayText = getDisplayText();

  function getDisplayText(): string {
    if (selectedItems.size === 0) {
      return placeholder;
    }

    if (selectedItems.size <= maxDisplayItems) {
      return Array.from(selectedItems).join(", ");
    }

    const firstItems = Array.from(selectedItems).slice(0, maxDisplayItems);
    return `${firstItems.join(", ")} +${selectedItems.size - maxDisplayItems} more`;
  }

  function toggleItem(item: string) {
    const newSelectedItems = new Set(selectedItems);

    if (newSelectedItems.has(item)) {
      newSelectedItems.delete(item);
    } else {
      newSelectedItems.add(item);
    }

    selectedItems = newSelectedItems;
    dispatch("change", { selectedItems: newSelectedItems });
  }

  function selectAll() {
    selectedItems = new Set(filteredOptions);
    dispatch("change", { selectedItems });
  }

  function clearAll() {
    // Keep only the first item checked
    const firstItem = filteredOptions.length > 0 ? filteredOptions[0] : null;
    selectedItems = firstItem ? new Set([firstItem]) : new Set();
    dispatch("change", { selectedItems });
  }

  function handleClickOutside(event: MouseEvent) {
    if (dropdownElement && !dropdownElement.contains(event.target as Node)) {
      isOpen = false;
    }
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === "Escape") {
      isOpen = false;
    }
  }
</script>

<svelte:window on:click={handleClickOutside} on:keydown={handleKeydown} />

<div class="dropdown" class:is-active={isOpen} bind:this={dropdownElement}>
  <div class="dropdown-trigger">
    <button
      class="button is-small"
      aria-haspopup="true"
      aria-controls="dropdown-menu"
      on:click={() => (isOpen = !isOpen)}
    >
      <span class="dropdown-text">{displayText}</span>
      <span class="icon is-small">
        <i class="fas fa-angle-down" class:rotated={isOpen}></i>
      </span>
    </button>
  </div>

  <div class="dropdown-menu" id="dropdown-menu" role="menu">
    <div class="dropdown-content">
      <!-- Search input -->
      <div class="dropdown-item p-2">
        <input
          class="input is-small"
          type="text"
          placeholder="Search accounts..."
          bind:value={searchTerm}
          on:click|stopPropagation
        />
      </div>

      <!-- Action buttons -->
      <div class="dropdown-item p-2">
        <div class="buttons are-small">
          <button class="button is-small is-light" on:click={selectAll}> Select All </button>
          <button class="button is-small is-light" on:click={clearAll}> Clear All </button>
        </div>
      </div>

      <hr class="dropdown-divider" />

      <!-- Options list -->
      <div class="dropdown-options">
        {#each filteredOptions as option}
          <label class="dropdown-item checkbox-item">
            <input
              type="checkbox"
              checked={selectedItems.has(option)}
              on:change={() => toggleItem(option)}
              on:click|stopPropagation
            />
            <span class="checkbox-text">{option}</span>
          </label>
        {/each}
      </div>

      {#if filteredOptions.length === 0}
        <div class="dropdown-item has-text-grey">No accounts found</div>
      {/if}
    </div>
  </div>
</div>

<style>
  .dropdown {
    position: relative;
  }

  .dropdown-text {
    max-width: 200px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    text-align: left;
    margin-right: 0.5rem;
  }

  .icon i.rotated {
    transform: rotate(180deg);
  }

  .dropdown-menu {
    min-width: 300px;
    max-width: 400px;
  }

  .dropdown-options {
    max-height: 300px;
    overflow-y: auto;
  }

  .checkbox-item {
    display: flex;
    align-items: center;
    padding: 0.5rem 1rem;
    cursor: pointer;
    transition: background-color 0.2s ease;
  }

  .checkbox-item:hover {
    background-color: #f5f5f5;
  }

  .checkbox-item input[type="checkbox"] {
    margin-right: 0.5rem;
    cursor: pointer;
  }

  .checkbox-text {
    flex: 1;
    font-size: 0.875rem;
    line-height: 1.2;
    word-break: break-all;
  }

  .buttons {
    gap: 0.5rem;
  }

  /* Dark theme support */
  :global(html[data-theme="dark"]) .checkbox-item:hover {
    background-color: #4a4a4a;
  }

  :global(html[data-theme="dark"]) .dropdown-content {
    background-color: #363636;
    color: #f5f5f5;
  }

  :global(html[data-theme="dark"]) .input {
    background-color: #4a4a4a;
    border-color: #5a5a5a;
    color: #f5f5f5;
  }

  :global(html[data-theme="dark"]) .button.is-light {
    background-color: #4a4a4a;
    border-color: #5a5a5a;
    color: #f5f5f5;
  }

  :global(html[data-theme="dark"]) .button.is-light:hover {
    background-color: #5a5a5a;
  }
</style>
