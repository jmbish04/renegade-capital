/**
 * @fileoverview DataTable Tool UI Component
 *
 * Renders an interactive data table for displaying tabular information
 * like fund comparisons, stock metrics, or financial data.
 */

import * as React from 'react';
import { Card } from '../ui/card';

export type DataTableColumn = {
  key: string;
  label: string;
  priority?: 'high' | 'medium' | 'low';
};

export type DataTableProps = {
  columns: DataTableColumn[];
  data: Record<string, any>[];
  title?: string;
};

export function DataTable({ columns, data, title }: DataTableProps) {
  if (!data || data.length === 0) {
    return (
      <Card className="p-6 bg-muted/30 border-border">
        <p className="text-sm text-muted-foreground">No data to display</p>
      </Card>
    );
  }

  // Sort columns by priority
  const sortedColumns = [...columns].sort((a, b) => {
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    const aPriority = priorityOrder[a.priority || 'medium'];
    const bPriority = priorityOrder[b.priority || 'medium'];
    return aPriority - bPriority;
  });

  return (
    <Card className="p-6 bg-muted/30 border-border overflow-hidden">
      <div className="space-y-4">
        {title && (
          <h3 className="text-base font-semibold text-foreground">{title}</h3>
        )}

        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-border">
                {sortedColumns.map((column) => (
                  <th
                    key={column.key}
                    className="px-4 py-3 text-left text-xs font-semibold text-foreground uppercase tracking-wider"
                  >
                    {column.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.map((row, rowIndex) => (
                <tr
                  key={rowIndex}
                  className="border-b border-border/50 hover:bg-muted/50 transition-colors"
                >
                  {sortedColumns.map((column) => (
                    <td
                      key={column.key}
                      className="px-4 py-3 text-sm text-muted-foreground"
                    >
                      {formatCell(row[column.key])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Summary info */}
        <div className="pt-2 text-xs text-muted-foreground">
          Showing {data.length} {data.length === 1 ? 'row' : 'rows'}
        </div>
      </div>
    </Card>
  );
}

/**
 * Format cell values for display
 */
function formatCell(value: any): string {
  if (value === null || value === undefined) {
    return '—';
  }

  // Format numbers
  if (typeof value === 'number') {
    // Check if it looks like a percentage
    if (value > -1 && value < 1 && value !== 0) {
      return `${(value * 100).toFixed(2)}%`;
    }
    // Check if it looks like currency
    if (value >= 1000 || value <= -1000) {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(value);
    }
    return value.toFixed(2);
  }

  // Format booleans
  if (typeof value === 'boolean') {
    return value ? '✓' : '✗';
  }

  // Return string as-is
  return String(value);
}
