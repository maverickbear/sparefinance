"use client";

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";
import { ChartCard } from "@/components/charts/chart-card";
import { formatMoney } from "@/components/common/money";
import { getAssetTypeColor } from "@/lib/utils/portfolio-utils";

interface AssetAllocationData {
  type: string;
  value: number;
  percent: number;
  count: number;
}

interface AssetAllocationChartProps {
  data: AssetAllocationData[];
}

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0];
    return (
      <div className="rounded-lg border bg-background p-3 shadow-sm">
        <div className="font-semibold">{data.name}</div>
        <div className="text-sm text-muted-foreground">
          Value: {formatMoney(data.value)}
        </div>
        <div className="text-sm text-muted-foreground">
          Allocation: {data.payload.percent.toFixed(2)}%
        </div>
        <div className="text-sm text-muted-foreground">
          Holdings: {data.payload.count}
        </div>
      </div>
    );
  }
  return null;
};

const CustomLegend = ({ payload }: any) => {
  return (
    <div className="flex flex-wrap justify-center gap-4 mt-4">
      {payload?.map((entry: any, index: number) => (
        <div key={index} className="flex items-center gap-2">
          <div
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-sm text-muted-foreground">
            {entry.value} ({entry.payload.percent.toFixed(1)}%)
          </span>
        </div>
      ))}
    </div>
  );
};

export function AssetAllocationChart({ data }: AssetAllocationChartProps) {
  const chartData = data.map((item) => ({
    name: item.type,
    value: item.value,
    percent: item.percent,
    count: item.count,
    fill: getAssetTypeColor(item.type),
  }));

  return (
    <ChartCard
      title="Asset Allocation"
      description="Portfolio distribution by asset type"
      className="overflow-hidden"
    >
      <ResponsiveContainer width="100%" height={300}>
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={({ percent }) => `${(percent < 1 ? percent * 100 : percent).toFixed(0)}%`}
            outerRadius={100}
            fill="#8884d8"
            dataKey="value"
          >
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.fill} />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
          <Legend content={<CustomLegend />} />
        </PieChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

