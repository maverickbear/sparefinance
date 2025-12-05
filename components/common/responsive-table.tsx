"use client";

import { ReactNode, memo, useMemo } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export interface TableColumn<T> {
  key: string;
  header: string;
  cell: (row: T) => ReactNode;
  className?: string;
  mobileLabel?: string; // Label to show in mobile card view
  hideOnMobile?: boolean; // Hide this column on mobile
  hideOnTablet?: boolean; // Hide this column on tablet
}

interface ResponsiveTableProps<T> {
  data: T[];
  columns: TableColumn<T>[];
  emptyMessage?: string;
  loading?: boolean;
  loadingMessage?: string;
  getRowKey?: (row: T) => string;
  onRowClick?: (row: T) => void;
  mobileCardClassName?: string;
}

export const ResponsiveTable = memo(function ResponsiveTable<T extends Record<string, any>>({
  data,
  columns,
  emptyMessage = "No data found",
  loading = false,
  loadingMessage = "Loading...",
  getRowKey = (row) => row.id || String(row),
  onRowClick,
  mobileCardClassName,
}: ResponsiveTableProps<T>) {
  // OPTIMIZED: Memoize filtered columns to avoid recalculation on every render
  const mobileColumns = useMemo(() => columns.filter((col) => !col.hideOnMobile), [columns]);
  
  // Filter columns for tablet (exclude those with hideOnTablet)
  const tabletColumns = useMemo(() => columns.filter((col) => !col.hideOnTablet), [columns]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px] w-full">
        <div className="text-center text-muted-foreground">
          {loadingMessage}
        </div>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[400px] w-full">
        <div className="text-center text-muted-foreground">
          {emptyMessage}
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Mobile Card View - shown on screens smaller than lg (1024px) */}
      <div className="lg:hidden space-y-4">
        {data.map((row) => {
          const rowKey = getRowKey(row);
          return (
            <Card
              key={rowKey}
              className={cn(
                "cursor-pointer transition-colors hover:bg-muted/50",
                onRowClick && "hover:shadow-md",
                mobileCardClassName
              )}
              onClick={() => onRowClick?.(row)}
            >
              <CardContent className="p-4">
                <div className="space-y-4">
                  {mobileColumns.map((column) => {
                    const cellContent = column.cell(row);
                    const label = column.mobileLabel || column.header;
                    
                    return (
                      <div
                        key={column.key}
                        className={cn(
                          "flex flex-col gap-1",
                          column.className
                        )}
                      >
                        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                          {label}
                        </span>
                        <div className="text-sm font-medium text-foreground">
                          {cellContent}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Tablet/Desktop Table View - shown on lg screens and above */}
      <div className="hidden lg:block rounded-lg border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              {tabletColumns.map((column) => (
                <TableHead
                  key={column.key}
                  className={cn("text-xs md:text-sm", column.className)}
                >
                  {column.header}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((row) => {
              const rowKey = getRowKey(row);
              return (
                <TableRow
                  key={rowKey}
                  className={cn(
                    onRowClick && "cursor-pointer"
                  )}
                  onClick={() => onRowClick?.(row)}
                >
                  {tabletColumns.map((column) => (
                    <TableCell
                      key={column.key}
                      className={cn("text-xs md:text-sm", column.className)}
                    >
                      {column.cell(row)}
                    </TableCell>
                  ))}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </>
  );
}) as <T extends Record<string, any>>(props: ResponsiveTableProps<T>) => React.JSX.Element;

