import * as d3 from "d3";
import dayjs, { type Dayjs } from "dayjs";
import _ from "lodash";
import {
  formatCurrency,
  formatCurrencyCrude,
  type Income,
  type Posting,
  type Tax,
  restName,
  secondName,
  skipTicks,
  tooltip,
  createTooltipContent,
  type IncomeYearlyCard,
  type Legend
} from "./utils";
import { generateColorScheme } from "./colors";

/**
 * Creates tooltip content for income chart segments with highlighting for hovered groups
 */
function createIncomeTooltipContent(allPostings: Posting[], isPositiveSegment: boolean): string {
  return createTooltipContent(allPostings, {
    getAmount: (posting: Posting) => -posting.amount,
    getLabel: (posting: Posting) => restName(posting.account),
    filterCondition: (posting: Posting) => {
      return isPositiveSegment
        ? -posting.amount > 0 // Income (positive when negated)
        : -posting.amount < 0; // Expenses (negative when negated)
    }
  });
}

/**
 * Creates tooltip content for yearly income timeline with highlighting for hovered groups
 */
function createYearlyTooltipContent(
  allPostings: Posting[],
  groups: string[],
  maxEntries: number = 20
): string {
  // Group by income category
  const groupedByCategory = _.groupBy(allPostings, incomeGroup);

  // Aggregate amounts by category
  const aggregatedCategories = Object.entries(groupedByCategory).map(([category, postings]) => ({
    category: category || "Other",
    amount: _.sumBy(postings, (posting) => -posting.amount)
  }));

  // Sort by amount (descending)
  const sortedCategories = _.orderBy(aggregatedCategories, ["amount"], ["desc"]);

  // Calculate total
  const total = _.sumBy(aggregatedCategories, "amount");

  // Limit entries to prevent tooltip overflow
  const shouldTruncate = sortedCategories.length > maxEntries;
  const displayCategories = shouldTruncate
    ? sortedCategories.slice(0, maxEntries)
    : sortedCategories;

  // Format tooltip rows
  const tooltipRows = displayCategories.map((item) => [
    item.category,
    [formatCurrency(item.amount), "has-text-weight-bold has-text-right"]
  ]);

  // Add truncation indicator if needed
  if (shouldTruncate) {
    const remainingCount = sortedCategories.length - maxEntries;
    tooltipRows.push([`... and ${remainingCount} more categories`, ["", ""]]);
  }

  return tooltip(tooltipRows, { total: formatCurrency(total) });
}

export function renderMonthlyInvestmentTimeline(incomes: Income[]): Legend[] {
  return renderIncomeTimeline(incomes, "#d3-income-timeline", "MMM-YYYY");
}

export function renderDailyInvestmentTimeline(
  incomes: Income[],
  year: number,
  month: number
): Legend[] {
  // Transform monthly data to daily data for the specified month
  const dailyIncomes = transformToDailyData(incomes, year, month);
  return renderIncomeTimeline(dailyIncomes, "#d3-income-timeline", "DD-MMM");
}

export function renderMonthlyNetIncomeTimeline(incomes: Income[], taxes: any[]): Legend[] {
  const netIncomes = calculateNetIncomeMonthly(incomes, taxes);
  return renderIncomeTimeline(netIncomes, "#d3-income-timeline", "MMM-YYYY");
}

export function renderDailyNetIncomeTimeline(
  incomes: Income[],
  taxes: any[],
  year: number,
  month: number
): Legend[] {
  const netIncomes = calculateNetIncomeDaily(incomes, taxes, year, month);
  return renderIncomeTimeline(netIncomes, "#d3-income-timeline", "DD-MMM");
}

function transformToDailyData(incomes: Income[], year: number, month: number): Income[] {
  const targetDate = dayjs()
    .year(year)
    .month(month - 1); // dayjs months are 0-indexed
  const startOfMonth = targetDate.startOf("month");
  const endOfMonth = targetDate.endOf("month");
  const daysInMonth = endOfMonth.date();

  // Find all postings for the target month
  const monthlyPostings = _.flatMap(incomes, (income) => {
    const incomeDate = dayjs(income.date);
    if (incomeDate.year() === year && incomeDate.month() === month - 1) {
      return income.postings.map((posting) => ({
        ...posting,
        date: dayjs(posting.date)
      }));
    }
    return [];
  });

  // Group postings by day
  const postingsByDay = _.groupBy(monthlyPostings, (posting) => dayjs(posting.date).date());

  // Create daily income objects for each day of the month
  const dailyIncomes: Income[] = [];
  for (let day = 1; day <= daysInMonth; day++) {
    const dayDate = startOfMonth.date(day);
    const dayPostings = postingsByDay[day] || [];

    dailyIncomes.push({
      date: dayDate,
      postings: dayPostings
    });
  }

  return dailyIncomes;
}

function calculateNetIncomeMonthly(incomes: Income[], taxes: Tax[]): Income[] {
  // Create a map of tax amounts by month
  const taxByMonth = new Map<string, number>();

  taxes.forEach((tax) => {
    const monthKey = dayjs(tax.start_date).format("YYYY-MM");
    const taxAmount = _.sumBy(tax.postings, (p: Posting) => p.amount);
    taxByMonth.set(monthKey, (taxByMonth.get(monthKey) || 0) + taxAmount);
  });

  // Calculate net income for each month (income - tax)
  return incomes.map((income) => {
    const monthKey = dayjs(income.date).format("YYYY-MM");
    const grossIncomeAmount = _.sumBy(income.postings, (p) => -p.amount);
    const taxAmount = taxByMonth.get(monthKey) || 0;
    const netIncomeAmount = grossIncomeAmount - taxAmount;

    // Create a synthetic posting for net income
    const basePosting = income.postings[0] || {
      id: "net-income",
      date: income.date,
      payee: "Net Income",
      account: "Income:Net",
      commodity: "INR",
      quantity: 0,
      amount: 0,
      status: "",
      tag_recurring: "",
      transaction_begin_line: 0,
      transaction_end_line: 0,
      file_name: "",
      note: "",
      transaction_note: "",
      market_amount: 0,
      balance: 0
    };

    const netPosting: Posting = {
      ...basePosting,
      amount: -netIncomeAmount, // Negative because income is typically negative in the system
      account: "Income:Net"
    };

    return {
      date: income.date,
      postings: [netPosting]
    };
  });
}

function calculateNetIncomeDaily(
  incomes: Income[],
  taxes: Tax[],
  year: number,
  month: number
): Income[] {
  // First get daily income data
  const dailyIncomes = transformToDailyData(incomes, year, month);

  // Create a map of tax amounts by day for the specified month
  const taxByDay = new Map<string, number>();

  taxes.forEach((tax) => {
    tax.postings.forEach((posting: Posting) => {
      const postingDate = dayjs(posting.date);
      if (postingDate.year() === year && postingDate.month() === month - 1) {
        const dayKey = postingDate.format("YYYY-MM-DD");
        taxByDay.set(dayKey, (taxByDay.get(dayKey) || 0) + posting.amount);
      }
    });
  });

  // Calculate net income for each day (income - tax)
  return dailyIncomes.map((income) => {
    const dayKey = dayjs(income.date).format("YYYY-MM-DD");
    const grossIncomeAmount = _.sumBy(income.postings, (p) => -p.amount);
    const taxAmount = taxByDay.get(dayKey) || 0;
    const netIncomeAmount = grossIncomeAmount - taxAmount;

    // Create a synthetic posting for net income
    const basePosting = income.postings[0] || {
      id: "net-income",
      date: income.date,
      payee: "Net Income",
      account: "Income:Net",
      commodity: "INR",
      quantity: 0,
      amount: 0,
      status: "",
      tag_recurring: "",
      transaction_begin_line: 0,
      transaction_end_line: 0,
      file_name: "",
      note: "",
      transaction_note: "",
      market_amount: 0,
      balance: 0
    };

    const netPosting: Posting = {
      ...basePosting,
      amount: -netIncomeAmount, // Negative because income is typically negative in the system
      account: "Income:Net"
    };

    return {
      date: income.date,
      postings: [netPosting]
    };
  });
}

function renderIncomeTimeline(incomes: Income[], id: string, timeFormat: string): Legend[] {
  const MAX_BAR_WIDTH = 40;
  const svg = d3.select(id),
    margin = { top: 20, right: 30, bottom: 80, left: 40 },
    width =
      document.getElementById(id.substring(1)).parentElement.clientWidth -
      margin.left -
      margin.right,
    height = +svg.attr("height") - margin.top - margin.bottom,
    g = svg.append("g").attr("transform", "translate(" + margin.left + "," + margin.top + ")");

  const postings = _.flatMap(incomes, (i) => i.postings);
  const groupKeys = _.chain(postings)
    .map((p) => incomeGroup(p))
    .uniq()
    .sort()
    .value();

  const groupTotal = _.chain(postings)
    .groupBy((p) => incomeGroup(p))
    .map((postings, key) => {
      const total = _.sumBy(postings, (p) => -p.amount);
      return [key, `${key}\n${formatCurrency(total)}`];
    })
    .fromPairs()
    .value();

  const defaultValues = _.zipObject(
    groupKeys,
    _.map(groupKeys, () => 0)
  );

  interface Point {
    date: dayjs.Dayjs;
    month: string;
    [key: string]: number | string | dayjs.Dayjs;
  }
  let points: Point[] = [];

  points = _.map(incomes, (i) => {
    const values = _.chain(i.postings)
      .groupBy((p) => incomeGroup(p))
      .flatMap((postings, key) => [[key, _.sumBy(postings, (p) => -p.amount)]])
      .fromPairs()
      .value();

    return _.merge(
      {
        month: i.date.format(timeFormat),
        date: i.date,
        postings: i.postings
      },
      defaultValues,
      values
    );
  });

  const x = d3.scaleBand().range([0, width]).paddingInner(0.1).paddingOuter(0);
  const y = d3.scaleLinear().range([height, 0]);

  const sum = (filter: (n: number) => boolean) => (p: Point) =>
    _.sum(
      _.filter(
        _.map(groupKeys, (k) => p[k]),
        filter
      )
    );
  x.domain(points.map((p) => p.month));
  y.domain([
    d3.min(
      points,
      sum((a) => a < 0)
    ),
    d3.max(
      points,
      sum((a) => a > 0)
    )
  ]);

  const z = generateColorScheme(groupKeys);

  g.append("g")
    .attr("class", "axis x")
    .attr("transform", "translate(0," + height + ")")
    .call(
      d3
        .axisBottom(x)
        .ticks(5)
        .tickFormat(skipTicks(30, x, (d) => d.toString()))
    )
    .selectAll("text")
    .attr("y", 10)
    .attr("x", -8)
    .attr("dy", ".35em")
    .attr("transform", "rotate(-45)")
    .style("text-anchor", "end");

  g.append("g")
    .attr("class", "axis y")
    .call(d3.axisLeft(y).tickSize(-width).tickFormat(formatCurrencyCrude));

  g.append("g")
    .selectAll("g")
    .data(
      d3.stack().offset(d3.stackOffsetDiverging).keys(groupKeys)(
        points as { [key: string]: number }[]
      )
    )
    .enter()
    .append("g")
    .attr("fill", function (d) {
      return z(d.key.split("-")[0]);
    })
    .selectAll("rect")
    .data(function (d) {
      return d;
    })
    .enter()
    .append("rect")
    .attr("data-tippy-content", function (d) {
      const allPostings: Posting[] = (d.data as any).postings;
      const isPositiveSegment = d[1] > d[0];

      return createIncomeTooltipContent(allPostings, isPositiveSegment);
    })
    .attr("x", function (d) {
      return (
        x((d.data as any).month) + (x.bandwidth() - Math.min(x.bandwidth(), MAX_BAR_WIDTH)) / 2
      );
    })
    .attr("y", function (d) {
      return y(d[1]);
    })
    .attr("height", function (d) {
      return y(d[0]) - y(d[1]);
    })
    .attr("width", Math.min(x.bandwidth(), MAX_BAR_WIDTH));

  return _.map(groupKeys, (k) => {
    return {
      label: groupTotal[k],
      color: z(k),
      shape: "square"
    };
  });
}

function financialYear(card: IncomeYearlyCard) {
  return `${card.start_date.format("YYYY")} - ${card.end_date.format("YY")}`;
}

export function renderYearlyIncomeTimeline(yearlyCards: IncomeYearlyCard[]): Legend[] {
  const id = "#d3-yearly-income-timeline";
  const BAR_HEIGHT = 20;
  const svg = d3.select(id),
    margin = { top: 15, right: 20, bottom: 20, left: 70 },
    width =
      document.getElementById(id.substring(1)).parentElement.clientWidth -
      margin.left -
      margin.right,
    g = svg.append("g").attr("transform", "translate(" + margin.left + "," + margin.top + ")");

  const groups = _.chain(yearlyCards)
    .flatMap((c) => c.postings)
    .map((p) => secondName(p.account))
    .uniq()
    .sort()
    .value();

  const defaultValues = _.zipObject(
    groups,
    _.map(groups, () => 0)
  );

  const start = _.min(_.map(yearlyCards, (c) => c.start_date)),
    end = _.max(_.map(yearlyCards, (c) => c.end_date));

  if (!start || !end) {
    return [];
  }

  const height = BAR_HEIGHT * (end.year() - start.year());
  svg.attr("height", height + margin.top + margin.bottom);

  interface Point {
    year: string;
    [key: string]: number | string | dayjs.Dayjs;
  }
  const points: Point[] = [];

  _.each(yearlyCards, (card) => {
    const postings = card.postings;
    const values = _.chain(postings)
      .groupBy((t) => secondName(t.account))
      .map((postings, key) => [key, _.sum(_.map(postings, (p) => -p.amount))])
      .fromPairs()
      .value();

    points.push(
      _.merge(
        {
          year: financialYear(card),
          postings: postings
        },
        defaultValues,
        values
      )
    );
  });

  const x = d3.scaleLinear().range([0, width]);
  const y = d3.scaleBand().range([height, 0]).paddingInner(0.1).paddingOuter(0);

  y.domain(points.map((p) => p.year));
  x.domain([0, d3.max(points, (p: Point) => _.sum(_.map(groups, (k) => p[k])))]);

  const z = generateColorScheme(groups);

  g.append("g")
    .attr("class", "axis y")
    .attr("transform", "translate(0," + height + ")")
    .call(d3.axisBottom(x).tickSize(-height).tickFormat(formatCurrencyCrude));

  g.append("g").attr("class", "axis y dark").call(d3.axisLeft(y));

  g.append("g")
    .selectAll("g")
    .data(
      d3.stack().offset(d3.stackOffsetDiverging).keys(groups)(points as { [key: string]: number }[])
    )
    .enter()
    .append("g")
    .attr("fill", function (d) {
      return z(d.key.split("-")[0]);
    })
    .selectAll("rect")
    .data(function (d) {
      return d;
    })
    .enter()
    .append("rect")
    .attr("data-tippy-content", function (d) {
      const allPostings: Posting[] = (d.data as any).postings;

      return createYearlyTooltipContent(allPostings, groups);
    })
    .attr("x", function (d) {
      return x(d[0]);
    })
    .attr("y", function (d) {
      return y((d.data as any).year) + (y.bandwidth() - Math.min(y.bandwidth(), BAR_HEIGHT)) / 2;
    })
    .attr("width", function (d) {
      return x(d[1]) - x(d[0]);
    })
    .attr("height", y.bandwidth());

  return _.map(groups, (k) => ({
    label: k,
    color: z(k),
    shape: "square"
  }));
}

export function renderYearlyTimelineOf(
  label: string,
  key: "net_tax" | "net_income",
  color: string,
  yearlyCards: IncomeYearlyCard[]
): Legend[] {
  const id = `#d3-yearly-${key}-timeline`;
  const BAR_HEIGHT = 20;
  const svg = d3.select(id),
    margin = { top: 15, right: 20, bottom: 20, left: 70 },
    width =
      document.getElementById(id.substring(1)).parentElement.clientWidth -
      margin.left -
      margin.right,
    g = svg.append("g").attr("transform", "translate(" + margin.left + "," + margin.top + ")");

  const colorKeys = [label];
  const colorScale = d3.scaleOrdinal<string>().domain(colorKeys).range([color]);

  const start = _.min(_.map(yearlyCards, (c) => c.start_date)),
    end = _.max(_.map(yearlyCards, (c) => c.end_date));

  if (!start || !end) {
    return [];
  }

  const height = BAR_HEIGHT * (end.year() - start.year());
  svg.attr("height", height + margin.top + margin.bottom);

  interface Point {
    year: string;
    value: number;
  }

  const points: Point[] = _.map(yearlyCards, (card) => {
    return {
      year: financialYear(card),
      value: card[key]
    };
  });

  const x = d3.scaleLinear().range([0, width]);
  const y = d3.scaleBand().range([height, 0]).paddingInner(0.1).paddingOuter(0);

  y.domain(points.map((p) => p.year));
  x.domain([0, d3.max(points, (p: Point) => p.value)]);

  g.append("g")
    .attr("class", "axis y")
    .attr("transform", "translate(0," + height + ")")
    .call(d3.axisBottom(x).tickSize(-height).tickFormat(formatCurrencyCrude));

  g.append("g").attr("class", "axis y dark").call(d3.axisLeft(y));

  g.append("g")
    .selectAll("rect")
    .data(points)
    .join("rect")
    .attr("fill", color)
    .attr("data-tippy-content", (d) => {
      return tooltip([[label, [formatCurrency(d.value), "has-text-weight-bold has-text-right"]]]);
    })
    .attr("x", x(0))
    .attr("y", function (d) {
      return y(d.year) + (y.bandwidth() - Math.min(y.bandwidth(), BAR_HEIGHT)) / 2;
    })
    .attr("width", function (d) {
      return x(d.value) - x(0);
    })
    .attr("height", y.bandwidth());

  return _.map(colorKeys, (k) => ({
    label: k,
    color: colorScale(k),
    shape: "square"
  }));
}

export function incomeGroup(posting: Posting) {
  return secondName(posting.account);
}
