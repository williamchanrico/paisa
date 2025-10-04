<script lang="ts">
  import COLORS from "$lib/colors";
  import BoxLabel from "$lib/components/BoxLabel.svelte";
  import LegendCard from "$lib/components/LegendCard.svelte";
  import LevelItem from "$lib/components/LevelItem.svelte";
  import BoxedTabs from "$lib/components/BoxedTabs.svelte";
  import MonthPicker from "$lib/components/MonthPicker.svelte";
  import {
    renderMonthlyInvestmentTimeline,
    renderDailyInvestmentTimeline,
    renderMonthlyNetIncomeTimeline,
    renderDailyNetIncomeTimeline,
    renderMonthlyInvestmentTimelineWithFilter,
    renderDailyInvestmentTimelineWithFilter,
    renderMonthlyNetIncomeTimelineWithFilter,
    renderDailyNetIncomeTimelineWithFilter,
    renderYearlyIncomeTimeline,
    renderYearlyTimelineOf
  } from "$lib/income";
  import { ajax, formatCurrency, type Legend, type Income } from "$lib/utils";
  import _ from "lodash";
  import { onMount } from "svelte";
  import dayjs from "dayjs";

  let grossIncome = 0;
  let netTax = 0;

  // Timeline state
  let timelineMode: "daily" | "monthly" = "monthly";
  let selectedMonthValue = dayjs().format("YYYY-MM"); // Format for MonthPicker

  // Income display mode state
  let incomeDisplayMode: "gross" | "net" = "gross";

  // Options for BoxedTabs
  const timelineOptions = [
    { label: "Daily", value: "daily" },
    { label: "Monthly", value: "monthly" }
  ];

  const incomeDisplayOptions = [
    { label: "Gross", value: "gross" },
    { label: "Net", value: "net" }
  ];

  // Data storage
  let incomeData: Income[] = [];
  let taxData: any[] = [];
  let yearlyCardsData: any[] = [];

  let monthlyInvestmentTimelineLegends: Legend[] = [];
  let yearlyIncomeTimelineLegends: Legend[] = [];
  let yearlyNetIncomeTimelineLegends: Legend[] = [];
  let yearlyNetTaxTimelineLegends: Legend[] = [];

  // State for legend filtering
  let selectedGroups: string[] = [];
  let useFiltering = true;

  onMount(async () => {
    const {
      income_timeline: incomes,
      tax_timeline: taxes,
      yearly_cards: yearlyCards
    } = await ajax("/api/income");

    // Store data for reactive updates
    incomeData = incomes;
    taxData = taxes;
    yearlyCardsData = yearlyCards;

    // Calculate summary values
    grossIncome = _.sumBy(incomes, (i) => _.sumBy(i.postings, (p) => -p.amount));
    netTax = _.sumBy(taxes, (t) => _.sumBy(t.postings, (p) => p.amount));

    // Render yearly charts (these don't change with timeline mode)
    yearlyIncomeTimelineLegends = renderYearlyIncomeTimeline(yearlyCards);
    yearlyNetIncomeTimelineLegends = renderYearlyTimelineOf(
      "Net Income",
      "net_income",
      COLORS.gain,
      yearlyCards
    );
    yearlyNetTaxTimelineLegends = renderYearlyTimelineOf(
      "Net Tax",
      "net_tax",
      COLORS.loss,
      yearlyCards
    );
  });

  // Function to handle filter changes
  function handleFilterChange(newSelectedGroups: string[]) {
    selectedGroups = newSelectedGroups;
  }

  // Reactive statement to update timeline chart when mode, date, or display mode changes
  $: if (incomeData.length > 0) {
    // Clear the SVG before re-rendering to fix update issues
    const svg = document.getElementById("d3-income-timeline");
    if (svg) {
      svg.innerHTML = "";
    }

    if (useFiltering) {
      // Use filtering functions
      if (incomeDisplayMode === "gross") {
        if (timelineMode === "monthly") {
          monthlyInvestmentTimelineLegends = renderMonthlyInvestmentTimelineWithFilter(
            incomeData,
            handleFilterChange
          );
        } else {
          const selectedDate = dayjs(selectedMonthValue, "YYYY-MM");
          monthlyInvestmentTimelineLegends = renderDailyInvestmentTimelineWithFilter(
            incomeData,
            selectedDate.year(),
            selectedDate.month() + 1,
            handleFilterChange
          );
        }
      } else {
        if (timelineMode === "monthly") {
          monthlyInvestmentTimelineLegends = renderMonthlyNetIncomeTimelineWithFilter(
            incomeData,
            taxData,
            handleFilterChange
          );
        } else {
          const selectedDate = dayjs(selectedMonthValue, "YYYY-MM");
          monthlyInvestmentTimelineLegends = renderDailyNetIncomeTimelineWithFilter(
            incomeData,
            taxData,
            selectedDate.year(),
            selectedDate.month() + 1,
            handleFilterChange
          );
        }
      }
    } else {
      // Use original functions (non-filtering)
      if (incomeDisplayMode === "gross") {
        if (timelineMode === "monthly") {
          monthlyInvestmentTimelineLegends = renderMonthlyInvestmentTimeline(incomeData);
        } else {
          const selectedDate = dayjs(selectedMonthValue, "YYYY-MM");
          monthlyInvestmentTimelineLegends = renderDailyInvestmentTimeline(
            incomeData,
            selectedDate.year(),
            selectedDate.month() + 1
          );
        }
      } else {
        if (timelineMode === "monthly") {
          monthlyInvestmentTimelineLegends = renderMonthlyNetIncomeTimeline(incomeData, taxData);
        } else {
          const selectedDate = dayjs(selectedMonthValue, "YYYY-MM");
          monthlyInvestmentTimelineLegends = renderDailyNetIncomeTimeline(
            incomeData,
            taxData,
            selectedDate.year(),
            selectedDate.month() + 1
          );
        }
      }
    }
  }

  // Get min/max dates for MonthPicker
  $: minDate =
    incomeData.length > 0 ? dayjs(_.minBy(incomeData, "date")?.date) : dayjs().subtract(5, "years");
  $: maxDate = dayjs();
</script>

<section class="section tab-income">
  <div class="container">
    <nav class="level">
      <LevelItem title="Gross Income" value={formatCurrency(grossIncome)} color={COLORS.gainText} />
      <LevelItem title="Net Tax" value={formatCurrency(netTax)} color={COLORS.lossText} />
    </nav>
  </div>
</section>
<section class="section">
  <div class="container is-fluid">
    <div class="columns">
      <div class="column is-12">
        <div class="box">
          <!-- Action buttons section -->
          <div class="action-buttons mb-4">
            <div class="is-flex is-align-items-center is-justify-content-flex-end pr-3">
              <!-- Month picker (only visible in daily mode) -->
              {#if timelineMode === "daily"}
                <MonthPicker bind:value={selectedMonthValue} min={minDate} max={maxDate} />
              {/if}

              <!-- Timeline toggle -->
              <div class="ml-3">
                <BoxedTabs bind:value={timelineMode} options={timelineOptions} />
              </div>

              <!-- Gross/Net toggle -->
              <div class="ml-3">
                <BoxedTabs bind:value={incomeDisplayMode} options={incomeDisplayOptions} />
              </div>
            </div>
          </div>

          <LegendCard
            legends={monthlyInvestmentTimelineLegends}
            clazz="flex justify-start gap-0 ml-4 overflow-x-auto"
          />
          <svg id="d3-income-timeline" width="100%" height="500" />
        </div>
      </div>
    </div>
    <BoxLabel
      text="{timelineMode === 'daily' ? 'Daily' : 'Monthly'} {incomeDisplayMode === 'gross'
        ? 'Gross'
        : 'Net'} Income Timeline"
    />
  </div>
</section>
<section class="section">
  <div class="container is-fluid">
    <div class="columns">
      <div class="column is-one-third">
        <div class="box px-3">
          <LegendCard legends={yearlyIncomeTimelineLegends} clazz="ml-4" />
          <svg id="d3-yearly-income-timeline" width="100%" />
        </div>
      </div>
      <div class="column is-one-third">
        <div class="box px-3">
          <LegendCard legends={yearlyNetIncomeTimelineLegends} clazz="ml-4" />
          <svg id="d3-yearly-net_income-timeline" width="100%" />
        </div>
      </div>
      <div class="column is-one-third">
        <div class="box px-3">
          <LegendCard legends={yearlyNetTaxTimelineLegends} clazz="ml-4" />
          <svg id="d3-yearly-net_tax-timeline" width="100%" />
        </div>
      </div>
    </div>
    <BoxLabel text="Financial Year Income Timeline" />
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
</style>
