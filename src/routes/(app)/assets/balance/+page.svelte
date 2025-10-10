<script lang="ts">
  import AssetsBalance from "$lib/components/AssetsBalance.svelte";
  import MultiSelectDropdown from "$lib/components/MultiSelectDropdown.svelte";
  import { ajax, type AssetBreakdown } from "$lib/utils";
  import _ from "lodash";
  import { onMount } from "svelte";

  let breakdowns: Record<string, AssetBreakdown> = {};
  let hideEmptyMarketValue = false;
  let selectedAccounts: Set<string> = new Set();
  let leafAccounts: string[] = [];

  // Extract leaf accounts when breakdowns change
  $: {
    if (breakdowns) {
      leafAccounts = extractLeafAccounts(breakdowns);
      // Initialize selectedAccounts with all leaf accounts if empty
      if (selectedAccounts.size === 0) {
        selectedAccounts = new Set(leafAccounts);
      }
    }
  }

  // Filter breakdowns based on checkbox state and account selection
  $: filteredBreakdowns = applyFilters(breakdowns, hideEmptyMarketValue, selectedAccounts);

  // Extract leaf accounts (accounts that don't have children)
  function extractLeafAccounts(data: Record<string, AssetBreakdown>): string[] {
    const allAccounts = Object.keys(data);
    const leafAccounts: string[] = [];

    for (const account of allAccounts) {
      // Check if this account has any children
      const hasChildren = allAccounts.some(
        (otherAccount) => otherAccount !== account && otherAccount.startsWith(account + ":")
      );

      if (!hasChildren) {
        leafAccounts.push(account);
      }
    }

    return leafAccounts.sort();
  }

  // Apply all filters: empty market value and account selection
  function applyFilters(
    data: Record<string, AssetBreakdown>,
    hideEmpty: boolean,
    selectedLeafAccounts: Set<string>
  ): Record<string, AssetBreakdown> {
    let filtered = { ...data };

    // First apply empty market value filter if enabled
    if (hideEmpty) {
      filtered = _.pickBy(filtered, (breakdown) => breakdown.marketAmount !== 0);
    }

    // Then apply account selection filter
    filtered = applyAccountSelectionFilter(filtered, selectedLeafAccounts);

    // Finally recalculate parent totals
    return recalculateParentTotals(filtered);
  }

  // Filter based on selected accounts and hide parents when all children are hidden
  function applyAccountSelectionFilter(
    data: Record<string, AssetBreakdown>,
    selectedLeafAccounts: Set<string>
  ): Record<string, AssetBreakdown> {
    const result: Record<string, AssetBreakdown> = {};

    // First, include all selected leaf accounts
    for (const account of Object.keys(data)) {
      if (selectedLeafAccounts.has(account)) {
        result[account] = data[account];
      }
    }

    // Then, include parent accounts only if they have at least one visible child
    for (const account of Object.keys(data)) {
      if (!selectedLeafAccounts.has(account)) {
        // This is a parent account, check if it has any visible children
        const hasVisibleChildren = Object.keys(result).some((visibleAccount) =>
          visibleAccount.startsWith(account + ":")
        );

        if (hasVisibleChildren) {
          result[account] = data[account];
        }
      }
    }

    return result;
  }

  // Handle account selection change
  function handleAccountSelectionChange(event: CustomEvent<{ selectedItems: Set<string> }>) {
    selectedAccounts = event.detail.selectedItems;
  }

  // Function to recalculate parent totals based on visible children
  function recalculateParentTotals(
    filteredData: Record<string, AssetBreakdown>
  ): Record<string, AssetBreakdown> {
    const result = { ...filteredData };

    // Get all unique parent paths from the filtered data
    const allPaths = Object.keys(result);
    const parentPaths = new Set<string>();

    // Collect all possible parent paths
    for (const path of allPaths) {
      const parts = path.split(":");
      for (let i = 1; i < parts.length; i++) {
        parentPaths.add(parts.slice(0, i).join(":"));
      }
    }

    // Sort parent paths by depth (deepest first) to process bottom-up
    const sortedParentPaths = Array.from(parentPaths).sort(
      (a, b) => b.split(":").length - a.split(":").length
    );

    // Process each parent path from deepest to shallowest
    for (const parentPath of sortedParentPaths) {
      // Find all direct children of this parent (both leaf nodes and intermediate parents)
      const directChildren = Object.keys(result).filter((path) => {
        const pathParts = path.split(":");
        const parentParts = parentPath.split(":");

        // Check if this path is a direct child (one level deeper)
        return pathParts.length === parentParts.length + 1 && path.startsWith(parentPath + ":");
      });

      if (directChildren.length > 0) {
        // Calculate totals from all direct children
        const parentTotals = directChildren.reduce(
          (totals, childPath) => {
            const child = result[childPath];
            return {
              investmentAmount: totals.investmentAmount + child.investmentAmount,
              withdrawalAmount: totals.withdrawalAmount + child.withdrawalAmount,
              balanceUnits: totals.balanceUnits + child.balanceUnits,
              marketAmount: totals.marketAmount + child.marketAmount,
              gainAmount: totals.gainAmount + child.gainAmount
            };
          },
          {
            investmentAmount: 0,
            withdrawalAmount: 0,
            balanceUnits: 0,
            marketAmount: 0,
            gainAmount: 0
          }
        );

        // Create or update parent entry with recalculated totals
        result[parentPath] = {
          group: parentPath,
          investmentAmount: parentTotals.investmentAmount,
          withdrawalAmount: parentTotals.withdrawalAmount,
          balanceUnits: parentTotals.balanceUnits,
          marketAmount: parentTotals.marketAmount,
          gainAmount: parentTotals.gainAmount,
          // Calculate derived values
          xirr:
            parentTotals.investmentAmount > 0
              ? (parentTotals.gainAmount / parentTotals.investmentAmount) * 100
              : 0,
          absoluteReturn:
            parentTotals.investmentAmount > 0
              ? ((parentTotals.marketAmount -
                  parentTotals.investmentAmount +
                  parentTotals.withdrawalAmount) /
                  parentTotals.investmentAmount) *
                100
              : 0
        };
      }
    }

    return result;
  }

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
              <div class="field mr-4 is-flex is-align-items-center">
                <label class="checkbox modern-checkbox">
                  <input type="checkbox" bind:checked={hideEmptyMarketValue} />
                  <span class="checkmark"></span>
                  Hide empty
                </label>
              </div>

              <!-- Account filter dropdown -->
              <div class="field is-flex is-align-items-center">
                <MultiSelectDropdown
                  options={leafAccounts}
                  bind:selectedItems={selectedAccounts}
                  placeholder="Filter accounts..."
                  on:change={handleAccountSelectionChange}
                />
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
    height: 32px;
    margin-bottom: 0;
  }

  /* Ensure field containers don't have default margins */
  .field {
    margin-bottom: 0;
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
