"use client";

import * as React from "react";
import {
  Area, Bar, CartesianGrid, Cell, ComposedChart, Legend, Line, Pie, PieChart,
  ReferenceLine, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis,
} from "recharts";
import type { ChartSpec, Datum } from "./chartTypes";
import { dashFor, markerFor, toneColor } from "./chartTypes";
import {
  AXIS_STYLE, ChartTooltip, PatternDefs, axisTickFormatter, formatValue, seriesFill,
} from "./ChartPrimitives";
import { useReducedMotion } from "./useReducedMotion";

/**
 * One renderer for every chart on the five surfaces, so the axis treatment,
 * the gridline opacity, the entry animation and the click-through behaviour
 * cannot drift between them.
 *
 * Colour is never the only signal: bars carry hatch patterns, lines carry dash
 * signatures and marker shapes, and single-series category charts are directly
 * labelled on the axis.
 */

interface Props {
  spec: ChartSpec;
  hidden: Set<string>;
  onSelect?: (d: Datum) => void;
}

type Row = Record<string, number | string | Datum | undefined> & { __datum: Datum; __label: string };

export function SeriesChart({ spec, hidden, onSelect }: Props) {
  const reduced = useReducedMotion();
  const height = spec.height ?? 260;
  const idPrefix = `pv-${spec.id}`;
  const visible = spec.series.filter((s) => !hidden.has(s.key));
  const patterned = spec.series.length > 1;

  const rows: Row[] = spec.data.map((d) => {
    const r: Row = { __datum: d, __label: d.label };
    for (const s of spec.series) r[s.key] = d.values[s.key] ?? 0;
    return r;
  });

  const anim = (index: number) => ({
    isAnimationActive: !reduced,
    animationDuration: reduced ? 0 : 400,
    animationBegin: reduced ? 0 : index * 30,
  });

  const leftUnit = visible.find((s) => s.axis !== "right")?.unit ?? "COUNT";
  const rightUnit = visible.find((s) => s.axis === "right")?.unit ?? "COUNT";
  const hasRight = visible.some((s) => s.axis === "right");
  const clickable = Boolean(onSelect) && spec.data.some((d) => d.drill);

  const handleRowClick = (payload: unknown) => {
    if (!onSelect) return;
    const row = payload as { __datum?: Datum; payload?: { __datum?: Datum } } | undefined;
    const d = row?.__datum ?? row?.payload?.__datum;
    if (d?.drill) onSelect(d);
  };

  /* ------------------------------------------------------------- donut */
  if (spec.kind === "donut") {
    const key = spec.series[0]!.key;
    const unit = spec.series[0]!.unit;
    return (
      <div style={{ height }} className="px-2">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <PatternDefs idPrefix={idPrefix} />
            <Pie
              data={rows}
              dataKey={key}
              nameKey="__label"
              innerRadius="52%"
              outerRadius="80%"
              paddingAngle={1}
              stroke="var(--surface-1)"
              strokeWidth={1}
              label={(p: { name?: string; value?: number }) =>
                `${p.name ?? ""} · ${formatValue(Number(p.value ?? 0), unit)}`
              }
              labelLine={{ stroke: "var(--line-strong)" }}
              onClick={handleRowClick}
              {...anim(0)}
            >
              {rows.map((r, i) => (
                <Cell
                  key={String(r.__label)}
                  fill={seriesFill(idPrefix, (i % 8) + 1, true)}
                  cursor={clickable ? "pointer" : "default"}
                />
              ))}
            </Pie>
            <Tooltip
              content={<ChartTooltip series={[{ ...spec.series[0]!, key }]} drillHint={clickable} />}
              cursor={{ fill: "var(--surface-2)" }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
    );
  }

  /* ----------------------------------------------------------- scatter */
  if (spec.kind === "scatter") {
    const xKey = spec.series[0]!.key;
    const yKey = spec.series[1]!.key;
    return (
      <div style={{ height }} className="px-2">
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 8, right: 16, bottom: 24, left: 8 }}>
            <CartesianGrid stroke="var(--line-strong)" strokeOpacity={0.08} />
            <XAxis
              type="number"
              dataKey={xKey}
              name={spec.series[0]!.label}
              tickFormatter={axisTickFormatter(spec.series[0]!.unit)}
              {...AXIS_STYLE}
              label={{ value: spec.xLabel, position: "insideBottom", offset: -14, fill: "var(--text-lo)", fontSize: 12 }}
            />
            <YAxis
              type="number"
              dataKey={yKey}
              name={spec.series[1]!.label}
              tickFormatter={axisTickFormatter(spec.series[1]!.unit)}
              {...AXIS_STYLE}
              label={{ value: spec.yLabel, angle: -90, position: "insideLeft", fill: "var(--text-lo)", fontSize: 12 }}
              width={54}
            />
            <ZAxis range={[80, 80]} />
            {spec.reference !== undefined ? (
              <ReferenceLine
                y={spec.reference.value}
                stroke="var(--warn)"
                strokeDasharray="4 3"
                label={{ value: spec.reference.label, fill: "var(--warn)", fontSize: 12, position: "insideTopRight" }}
              />
            ) : null}
            <Tooltip
              content={<ChartTooltip series={spec.series} drillHint={clickable} />}
              cursor={{ stroke: "var(--line-strong)" }}
            />
            <Scatter
              data={rows}
              fill={toneColor(spec.series[1]!.tone)}
              shape={markerFor(spec.series[1]!.tone)}
              onClick={handleRowClick}
              cursor={clickable ? "pointer" : "default"}
              {...anim(0)}
            />
          </ScatterChart>
        </ResponsiveContainer>
      </div>
    );
  }

  /* -------------------------------------------------- bars / lines / area */
  const horizontal = spec.kind === "horizontalBar";

  return (
    <div style={{ height }} className="px-2">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart
          data={rows}
          layout={horizontal ? "vertical" : "horizontal"}
          margin={{ top: 8, right: hasRight ? 8 : 16, bottom: 8, left: 8 }}
          barCategoryGap={horizontal ? "18%" : "22%"}
        >
          <PatternDefs idPrefix={idPrefix} />
          <CartesianGrid
            stroke="var(--line-strong)"
            strokeOpacity={0.08}
            vertical={horizontal}
            horizontal={!horizontal}
          />
          {horizontal ? (
            <>
              <XAxis type="number" tickFormatter={axisTickFormatter(leftUnit)} {...AXIS_STYLE} />
              <YAxis
                type="category"
                dataKey="__label"
                width={150}
                interval={0}
                {...AXIS_STYLE}
              />
            </>
          ) : (
            <>
              <XAxis
                dataKey="__label"
                interval="preserveStartEnd"
                minTickGap={4}
                {...AXIS_STYLE}
              />
              <YAxis
                yAxisId="left"
                tickFormatter={axisTickFormatter(leftUnit)}
                width={62}
                {...AXIS_STYLE}
              />
              {hasRight ? (
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  tickFormatter={axisTickFormatter(rightUnit)}
                  width={56}
                  {...AXIS_STYLE}
                />
              ) : null}
            </>
          )}

          {spec.reference !== undefined ? (
            <ReferenceLine
              {...(horizontal ? { x: spec.reference.value } : { y: spec.reference.value, yAxisId: "left" })}
              stroke={`var(--${spec.reference.tone ?? "warn"})`}
              strokeDasharray="4 3"
              label={{
                value: spec.reference.label,
                fill: `var(--${spec.reference.tone ?? "warn"})`,
                fontSize: 12,
                position: horizontal ? "top" : "insideTopRight",
              }}
            />
          ) : null}

          <Tooltip
            content={<ChartTooltip series={spec.series} drillHint={clickable} />}
            cursor={{ fill: "color-mix(in srgb, var(--surface-3) 45%, transparent)" }}
          />
          <Legend content={() => null} />

          {visible.map((s, i) => {
            const yAxisId = horizontal ? undefined : s.axis === "right" ? "right" : "left";
            const asKind = s.as ?? (spec.kind === "line" ? "line" : spec.kind === "area" || spec.kind === "stackedArea" ? "area" : "bar");

            if (asKind === "line") {
              return (
                <Line
                  key={s.key}
                  yAxisId={yAxisId}
                  type="monotone"
                  dataKey={s.key}
                  name={s.label}
                  stroke={toneColor(s.tone)}
                  strokeWidth={2}
                  strokeDasharray={dashFor(s.tone)}
                  dot={{ r: 2.5, fill: toneColor(s.tone), strokeWidth: 0 }}
                  activeDot={{ r: 4 }}
                  connectNulls
                  {...anim(i)}
                />
              );
            }
            if (asKind === "area") {
              return (
                <Area
                  key={s.key}
                  yAxisId={yAxisId}
                  type="monotone"
                  dataKey={s.key}
                  name={s.label}
                  stackId={spec.kind === "stackedArea" ? (s.stackId ?? "a") : undefined}
                  stroke={toneColor(s.tone)}
                  strokeWidth={2}
                  strokeDasharray={dashFor(s.tone)}
                  fill={seriesFill(idPrefix, s.tone, true)}
                  fillOpacity={0.35}
                  {...anim(i)}
                />
              );
            }
            return (
              <Bar
                key={s.key}
                yAxisId={yAxisId}
                dataKey={s.key}
                name={s.label}
                stackId={spec.kind === "stackedBar" ? (s.stackId ?? "a") : undefined}
                fill={seriesFill(idPrefix, s.tone, patterned)}
                radius={horizontal ? [0, 3, 3, 0] : [3, 3, 0, 0]}
                maxBarSize={horizontal ? 22 : 44}
                onClick={handleRowClick}
                cursor={clickable ? "pointer" : "default"}
                {...anim(i)}
              />
            );
          })}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
