"use client";

import * as React from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatCount, formatDate } from "@/lib/format";
import { Overline } from "@/components/patterns/primitives";
import { Button, Th, Td } from "./ui";

export interface HoursPoint {
  at: string;
  hours: number;
}

/** E5-S2 — running-hours history, with the tabular equivalent one tap away. */
export function RunningHoursChart({ points }: { points: HoursPoint[] }) {
  const [asTable, setAsTable] = React.useState(false);

  const data = React.useMemo(
    () => points.map((p) => ({ ...p, t: new Date(p.at).getTime() })),
    [points],
  );

  if (!points.length) {
    return (
      <p className="t-body-sm px-4 py-6 text-text-mid">
        No running-hours readings have been recorded against this machine yet. Readings are captured
        on each job card and on the meter update in the register.
      </p>
    );
  }

  const first = points[0]!;
  const last = points[points.length - 1]!;
  const days = Math.max(
    1,
    Math.round((new Date(last.at).getTime() - new Date(first.at).getTime()) / 86_400_000),
  );
  const perDay = (last.hours - first.hours) / days;

  return (
    <div className="flex flex-col gap-3 px-4 py-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Overline>Latest meter</Overline>
          <p className="t-display-md tabular-nums text-text-hi">{formatCount(last.hours)} h</p>
          <p className="t-body-sm text-text-lo">
            Read {formatDate(last.at)} · averaging {perDay.toFixed(1)} h per day over {days} days
          </p>
        </div>
        <Button onClick={() => setAsTable((v) => !v)}>
          {asTable ? "Show chart" : "Show table"}
        </Button>
      </div>

      {asTable ? (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr>
                <Th>Reading date</Th>
                <Th numeric>Running hours</Th>
                <Th numeric>Change</Th>
              </tr>
            </thead>
            <tbody>
              {points.map((p, i) => (
                <tr key={p.at} className="h-[var(--row-h,36px)]">
                  <Td nowrap>{formatDate(p.at)}</Td>
                  <Td numeric>{formatCount(p.hours)}</Td>
                  <Td numeric>
                    {i === 0 ? "—" : `+${formatCount(Math.max(0, p.hours - points[i - 1]!.hours))}`}
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="h-56 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 8, right: 12, bottom: 4, left: 4 }}>
              <CartesianGrid stroke="var(--line)" strokeDasharray="2 4" vertical={false} />
              <XAxis
                dataKey="t"
                type="number"
                scale="time"
                domain={["dataMin", "dataMax"]}
                tickFormatter={(v: number) => formatDate(new Date(v)).slice(3)}
                stroke="var(--text-lo)"
                tick={{ fill: "var(--text-lo)", fontSize: 11 }}
                tickLine={false}
                axisLine={{ stroke: "var(--line)" }}
              />
              <YAxis
                stroke="var(--text-lo)"
                tick={{ fill: "var(--text-lo)", fontSize: 11 }}
                tickLine={false}
                axisLine={{ stroke: "var(--line)" }}
                width={52}
                tickFormatter={(v: number) => formatCount(v)}
              />
              <Tooltip
                contentStyle={{
                  background: "var(--surface-2)",
                  border: "1px solid var(--line-strong)",
                  borderRadius: 3,
                  fontSize: 12,
                  color: "var(--text-hi)",
                }}
                labelFormatter={(v) => formatDate(new Date(Number(v)))}
                formatter={(v) => [`${formatCount(Number(v))} h`, "Running hours"]}
              />
              <Line
                type="monotone"
                dataKey="hours"
                stroke="var(--dv-1)"
                strokeWidth={2}
                dot={{ r: 2, fill: "var(--dv-1)", stroke: "var(--dv-1)" }}
                activeDot={{ r: 4 }}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
