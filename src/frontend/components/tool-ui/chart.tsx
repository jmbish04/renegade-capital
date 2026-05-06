/**
 * @fileoverview Chart Tool UI Component
 *
 * Renders a line chart for visualizing financial data such as
 * compound interest and investment growth over time.
 */

import * as React from 'react';
import { Card } from '../ui/card';

export type ChartDataPoint = {
  [key: string]: string | number;
};

export type ChartSeries = {
  key: string;
  label: string;
  color?: string;
};

export type ChartProps = {
  data: ChartDataPoint[];
  xKey: string;
  series: ChartSeries[];
  title?: string;
  colors?: string[];
};

const DEFAULT_COLORS = [
  'rgb(59, 130, 246)', // blue
  'rgb(34, 197, 94)',  // green
  'rgb(168, 85, 247)', // purple
  'rgb(251, 146, 60)', // orange
];

export function Chart({ data, xKey, series, title, colors = DEFAULT_COLORS }: ChartProps) {
  if (!data || data.length === 0) {
    return (
      <Card className="p-6 bg-muted/30 border-border">
        <p className="text-sm text-muted-foreground">No data to display</p>
      </Card>
    );
  }

  // Calculate dimensions
  const width = 600;
  const height = 300;
  const padding = { top: 40, right: 40, bottom: 60, left: 80 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  // Find min and max values across all series
  let minY = Infinity;
  let maxY = -Infinity;

  series.forEach(({ key }) => {
    data.forEach((point) => {
      const value = Number(point[key]);
      if (!isNaN(value)) {
        minY = Math.min(minY, value);
        maxY = Math.max(maxY, value);
      }
    });
  });

  // Add some padding to the y-axis range
  const yRange = maxY - minY;
  minY = Math.floor(minY - yRange * 0.1);
  maxY = Math.ceil(maxY + yRange * 0.1);

  // Scale functions
  const scaleX = (index: number) => {
    return padding.left + (index / (data.length - 1)) * chartWidth;
  };

  const scaleY = (value: number) => {
    return padding.top + chartHeight - ((value - minY) / (maxY - minY)) * chartHeight;
  };

  // Format currency
  const formatCurrency = (value: number) => {
    if (value >= 1000000) {
      return `$${(value / 1000000).toFixed(1)}M`;
    }
    if (value >= 1000) {
      return `$${(value / 1000).toFixed(1)}K`;
    }
    return `$${value.toFixed(0)}`;
  };

  return (
    <Card className="p-6 bg-muted/30 border-border">
      <div className="space-y-4">
        {title && (
          <h3 className="text-base font-semibold text-foreground">{title}</h3>
        )}

        <div className="overflow-x-auto">
          <svg
            width={width}
            height={height}
            viewBox={`0 0 ${width} ${height}`}
            className="max-w-full h-auto"
          >
            {/* Grid lines */}
            {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
              const y = padding.top + chartHeight * (1 - ratio);
              const value = minY + (maxY - minY) * ratio;
              return (
                <g key={ratio}>
                  <line
                    x1={padding.left}
                    y1={y}
                    x2={padding.left + chartWidth}
                    y2={y}
                    stroke="currentColor"
                    strokeOpacity={0.1}
                    strokeWidth={1}
                  />
                  <text
                    x={padding.left - 10}
                    y={y}
                    textAnchor="end"
                    dominantBaseline="middle"
                    className="text-xs fill-muted-foreground"
                  >
                    {formatCurrency(value)}
                  </text>
                </g>
              );
            })}

            {/* X-axis labels */}
            {data.map((point, index) => {
              const x = scaleX(index);
              return (
                <text
                  key={index}
                  x={x}
                  y={padding.top + chartHeight + 20}
                  textAnchor="middle"
                  className="text-xs fill-muted-foreground"
                >
                  {String(point[xKey])}
                </text>
              );
            })}

            {/* Data lines */}
            {series.map((s, seriesIndex) => {
              const color = s.color || colors[seriesIndex % colors.length];
              const points = data
                .map((point, index) => {
                  const value = Number(point[s.key]);
                  if (isNaN(value)) return null;
                  return { x: scaleX(index), y: scaleY(value) };
                })
                .filter((p): p is { x: number; y: number } => p !== null);

              const pathData = points
                .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`)
                .join(' ');

              return (
                <g key={s.key}>
                  {/* Line */}
                  <path
                    d={pathData}
                    fill="none"
                    stroke={color}
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  {/* Points */}
                  {points.map((p, i) => (
                    <circle
                      key={i}
                      cx={p.x}
                      cy={p.y}
                      r={4}
                      fill={color}
                    />
                  ))}
                </g>
              );
            })}

            {/* Axes */}
            <line
              x1={padding.left}
              y1={padding.top}
              x2={padding.left}
              y2={padding.top + chartHeight}
              stroke="currentColor"
              strokeOpacity={0.2}
              strokeWidth={1}
            />
            <line
              x1={padding.left}
              y1={padding.top + chartHeight}
              x2={padding.left + chartWidth}
              y2={padding.top + chartHeight}
              stroke="currentColor"
              strokeOpacity={0.2}
              strokeWidth={1}
            />
          </svg>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-4">
          {series.map((s, index) => {
            const color = s.color || colors[index % colors.length];
            return (
              <div key={s.key} className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: color }}
                />
                <span className="text-xs text-muted-foreground">{s.label}</span>
              </div>
            );
          })}
        </div>
      </div>
    </Card>
  );
}
