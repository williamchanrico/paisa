<script lang="ts">
  import AssetsBalance from "$lib/components/AssetsBalance.svelte";
  import { ajax, type AssetBreakdown } from "$lib/utils";
  import _ from "lodash";
  import { onMount } from "svelte";

  let breakdowns: Record<string, AssetBreakdown> = {};
  let hideEmptyMarketValue = false;

  // Filter breakdowns based on checkbox state
  $: filteredBreakdowns = hideEmptyMarketValue
    ? _.pickBy(breakdowns, (breakdown) => breakdown.marketAmount !== 0)
    : breakdowns;

  onMount(async () => {
    ({ asset_breakdowns: breakdowns } = await ajax("/api/assets/balance"));
  });
</script>

<section class="section pb-0">
  <div class="container is-fluid">
    <div class="columns">
      <div class="column is-12 pb-0">
        <div class="box">
          <!-- Action buttons section -->
          <div class="action-buttons mb-4">
            <div class="is-flex is-align-items-center is-justify-content-flex-start pr-3 pl-3">
              <!-- Hide empty checkbox -->
              <div class="field">
                <label class="checkbox modern-checkbox">
                  <input type="checkbox" bind:checked={hideEmptyMarketValue} />
                  <span class="checkmark"></span>
                  Hide empty
                </label>
              </div>
            </div>
          </div>

          <AssetsBalance breakdowns={filteredBreakdowns} />
        </div>
      </div>
    </div>
  </div>
</section>

<style>
  .action-buttons {
    border-bottom: 1px solid #e0e0e0;
    padding-bottom: 1rem;
  }

  /* Dark theme support */
  :global(html[data-theme="dark"]) .action-buttons {
    border-bottom-color: #5a5a5a;
  }

  /* Modern checkbox styles */
  .modern-checkbox {
    position: relative;
    display: flex;
    align-items: center;
    cursor: pointer;
    font-size: 0.9rem;
    user-select: none;
  }

  .modern-checkbox input[type="checkbox"] {
    position: absolute;
    opacity: 0;
    cursor: pointer;
    height: 0;
    width: 0;
  }

  .checkmark {
    position: relative;
    height: 18px;
    width: 18px;
    background-color: #fff;
    border: 2px solid #ddd;
    border-radius: 4px;
    margin-right: 8px;
    transition: all 0.2s ease;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .modern-checkbox:hover .checkmark {
    border-color: #3273dc;
  }

  .modern-checkbox input:checked ~ .checkmark {
    background-color: #3273dc;
    border-color: #3273dc;
  }

  .modern-checkbox input:checked ~ .checkmark::after {
    content: "";
    position: absolute;
    width: 5px;
    height: 9px;
    border: solid white;
    border-width: 0 2px 2px 0;
    transform: rotate(45deg);
    top: 1px;
  }

  /* Dark theme support for checkbox */
  :global(html[data-theme="dark"]) .checkmark {
    background-color: #363636;
    border-color: #5a5a5a;
  }

  :global(html[data-theme="dark"]) .modern-checkbox:hover .checkmark {
    border-color: #3273dc;
  }

  :global(html[data-theme="dark"]) .modern-checkbox input:checked ~ .checkmark {
    background-color: #3273dc;
    border-color: #3273dc;
  }
</style>
