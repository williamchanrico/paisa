import * as d3 from "d3";
import _ from "lodash";
import {
  forEachMonth,
  formatCurrency,
  formatCurrencyCrude,
  type Posting,
  restName,
  skipTicks,
  tooltip,
  rem,
  now,
  type Legend
} from "./utils";
import { generateColorScheme } from "./colors";
import { iconify } from "./icon";
import type dayjs from "dayjs";

export function renderMonthlyRepaymentTimelineWithFilter(
  postings: Posting[],
  onFilterChange: (selectedGroups: string[]) => void
): Legend[] {
  const id = "#d3-repayment-timeline";
  const timeFormat = "MMM-YYYY";
  const MAX_BAR_WIDTH = rem(40);
  const svg = d3.select(id),
    margin = { top: rem(20), right: rem(30), bottom: rem(60), left: rem(40) },
    width =
      document.getElementById(id.substring(1)).parentElement.clientWidth -
      margin.left -
      margin.right,
    height = +svg.attr("height") - margin.top - margin.bottom,
    g = svg.append("g").attr("transform", "translate(" + margin.left + "," + margin.top + ")");

  const groups = _.chain(postings)
    .map((p) => restName(p.account))
    .uniq()
    .sort()
    .value();

  const defaultValues = _.zipObject(
    groups,
    _.map(groups, () => 0)
  );

  const start = _.min(_.map(postings, (p) => p.date)),
    end = now().startOf("month");
  const ts = _.groupBy(postings, (p) => p.date.format(timeFormat));

  interface Point {
    month: string;
    date: dayjs.Dayjs;
    [key: string]: number | string | dayjs.Dayjs;
  }
  const points: Point[] = [];

  forEachMonth(start, end, (month) => {
    const postings = ts[month.format(timeFormat)] || [];
    const values = _.chain(postings)
      .groupBy((t) => restName(t.account))
      .map((postings, key) => [key, _.sum(_.map(postings, (p) => p.amount))])
      .fromPairs()
      .value();

    points.push(
      _.merge(
        {
          month: month.format(timeFormat),
          date: month,
          postings: postings
        },
        defaultValues,
        values
      )
    );
  });

  const x = d3.scaleBand().range([0, width]).paddingInner(0.1).paddingOuter(0);
  const y = d3.scaleLinear().range([height, 0]);
  const z = generateColorScheme(groups);

  const xAxis = g.append("g").attr("class", "axis x");
  const yAxis = g.append("g").attr("class", "axis y");
  const bars = g.append("g");

  const render = (allowedGroups: string[]) => {
    const filteredPoints = points.map((point) => {
      const filteredPoint = { ...point };
      // Zero out values for non-allowed groups
      groups.forEach((key) => {
        if (!allowedGroups.includes(key)) {
          filteredPoint[key] = 0;
        }
      });
      return filteredPoint;
    });

    x.domain(filteredPoints.map((p) => p.month));
    y.domain([0, d3.max(filteredPoints, (p: Point) => _.sum(_.map(allowedGroups, (k) => p[k])))]);

    const t = svg.transition().duration(750);

    xAxis
      .attr("transform", "translate(0," + height + ")")
      .transition(t)
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

    yAxis.transition(t).call(d3.axisLeft(y).tickSize(-width).tickFormat(formatCurrencyCrude));

    bars
      .selectAll("g")
      .data(
        d3.stack().offset(d3.stackOffsetDiverging).keys(allowedGroups)(
          filteredPoints as { [key: string]: number }[]
        ),
        (d: any) => d.key
      )
      .join(
        (enter) =>
          enter.append("g").attr("fill", function (d) {
            return z(d.key.split("-")[0]);
          }),
        (update) => update.transition(t),
        (exit) =>
          exit.selectAll("rect").transition(t).attr("y", y.range()[0]).attr("height", 0).remove()
      )
      .selectAll("rect")
      .data(function (d) {
        return d;
      })
      .join(
        (enter) =>
          enter
            .append("rect")
            .attr("data-tippy-content", (d) => {
              const postings: Posting[] = (d.data as any).postings;
              const date = (d.data as any).date;
              const filteredPostings = postings.filter((p) =>
                allowedGroups.includes(restName(p.account))
              );
              const total = _.sumBy(filteredPostings, (p) => p.amount);
              return tooltip(
                _.orderBy(
                  filteredPostings.map((p) => ({
                    account: _.drop(p.account.split(":")).join(":"),
                    formatted: [formatCurrency(p.amount), "has-text-weight-bold has-text-right"],
                    amount: p.amount
                  })),
                  "amount",
                  "desc"
                ).map((item) => [item.account, item.formatted]),
                {
                  total: formatCurrency(total),
                  header: date.format("MMM YYYY")
                }
              );
            })
            .attr("x", function (d) {
              return (
                x((d.data as any).month) +
                (x.bandwidth() - Math.min(x.bandwidth(), MAX_BAR_WIDTH)) / 2
              );
            })
            .attr("y", function (d) {
              return y(d[1]);
            })
            .attr("height", function (d) {
              return y(d[0]) - y(d[1]);
            })
            .attr("width", Math.min(x.bandwidth(), MAX_BAR_WIDTH)),
        (update) =>
          update
            .attr("data-tippy-content", (d) => {
              const postings: Posting[] = (d.data as any).postings;
              const date = (d.data as any).date;
              const filteredPostings = postings.filter((p) =>
                allowedGroups.includes(restName(p.account))
              );
              const total = _.sumBy(filteredPostings, (p) => p.amount);
              return tooltip(
                _.orderBy(
                  filteredPostings.map((p) => ({
                    account: _.drop(p.account.split(":")).join(":"),
                    formatted: [formatCurrency(p.amount), "has-text-weight-bold has-text-right"],
                    amount: p.amount
                  })),
                  "amount",
                  "desc"
                ).map((item) => [item.account, item.formatted]),
                {
                  total: formatCurrency(total),
                  header: date.format("MMM YYYY")
                }
              );
            })
            .transition(t)
            .attr("x", function (d) {
              return (
                x((d.data as any).month) +
                (x.bandwidth() - Math.min(x.bandwidth(), MAX_BAR_WIDTH)) / 2
              );
            })
            .attr("y", function (d) {
              return y(d[1]);
            })
            .attr("height", function (d) {
              return y(d[0]) - y(d[1]);
            })
            .attr("width", Math.min(x.bandwidth(), MAX_BAR_WIDTH)),
        (exit) => exit.remove()
      );
  };

  let selectedGroups = groups;
  render(selectedGroups);

  const legends = groups.map(
    (group) =>
      ({
        label: iconify(group, { group: "Liabilities" }),
        color: z(group),
        shape: "square",
        onClick: () => {
          if (selectedGroups.length == 1 && selectedGroups[0] == group) {
            selectedGroups = groups;
          } else {
            selectedGroups = [group];
          }
          render(selectedGroups);
          onFilterChange(selectedGroups);
        }
      }) as Legend
  );

  return legends;
}

export function renderMonthlyRepaymentTimeline(postings: Posting[]): Legend[] {
  const id = "#d3-repayment-timeline";
  const timeFormat = "MMM-YYYY";
  const MAX_BAR_WIDTH = rem(40);
  const svg = d3.select(id),
    margin = { top: rem(20), right: rem(30), bottom: rem(60), left: rem(40) },
    width =
      document.getElementById(id.substring(1)).parentElement.clientWidth -
      margin.left -
      margin.right,
    height = +svg.attr("height") - margin.top - margin.bottom,
    g = svg.append("g").attr("transform", "translate(" + margin.left + "," + margin.top + ")");

  const groups = _.chain(postings)
    .map((p) => restName(p.account))
    .uniq()
    .sort()
    .value();

  const defaultValues = _.zipObject(
    groups,
    _.map(groups, () => 0)
  );

  const start = _.min(_.map(postings, (p) => p.date)),
    end = now().startOf("month");
  const ts = _.groupBy(postings, (p) => p.date.format(timeFormat));

  interface Point {
    month: string;
    date: dayjs.Dayjs;
    [key: string]: number | string | dayjs.Dayjs;
  }
  const points: Point[] = [];

  forEachMonth(start, end, (month) => {
    const postings = ts[month.format(timeFormat)] || [];
    const values = _.chain(postings)
      .groupBy((t) => restName(t.account))
      .map((postings, key) => [key, _.sum(_.map(postings, (p) => p.amount))])
      .fromPairs()
      .value();

    points.push(
      _.merge(
        {
          month: month.format(timeFormat),
          date: month,
          postings: postings
        },
        defaultValues,
        values
      )
    );
  });

  const x = d3.scaleBand().range([0, width]).paddingInner(0.1).paddingOuter(0);
  const y = d3.scaleLinear().range([height, 0]);

  x.domain(points.map((p) => p.month));
  y.domain([0, d3.max(points, (p: Point) => _.sum(_.map(groups, (k) => p[k])))]);

  const z = generateColorScheme(groups);

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
    .attr("data-tippy-content", (d) => {
      const postings: Posting[] = (d.data as any).postings;
      const date = (d.data as any).date;
      const total = _.sumBy(postings, (p) => p.amount);
      return tooltip(
        _.orderBy(
          postings.map((p) => ({
            account: _.drop(p.account.split(":")).join(":"),
            formatted: [formatCurrency(p.amount), "has-text-weight-bold has-text-right"],
            amount: p.amount
          })),
          "amount",
          "desc"
        ).map((item) => [item.account, item.formatted]),
        {
          total: formatCurrency(total),
          header: date.format("MMM YYYY")
        }
      );
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

  return _.map(groups, (group) => ({
    label: iconify(group, { group: "Liabilities" }),
    color: z(group),
    shape: "square"
  }));
}
