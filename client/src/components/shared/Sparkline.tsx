import { Area, AreaChart } from "recharts";

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";

const sparklineChartConfig = {
  value: {
    label: "Amount",
  },
} satisfies ChartConfig;

type SparklineProps = {
  data: number[];
  labels: string[];
  invert?: boolean;
  current: number;
  previous: number;
};

export default function Sparkline({
  data,
  labels,
  invert = false,
  current,
  previous,
}: SparklineProps) {
  const min = Math.min(...data);
  const max = Math.max(...data);

  const chartData = data.map((value, index) => ({
    value: max === min ? 50 : ((value - min) / (max - min)) * 100,
    raw: value,
    label: labels[index],
  }));

  const isGood = invert ? current <= previous : current >= previous;

  const strokeColor = isGood ? "#22c55e" : "#ef4444";
  const gradientId = isGood ? "sparkUp" : "sparkDown";

  return (
    <ChartContainer
      config={sparklineChartConfig}
      initialDimension={{ width: 100, height: 40 }}
      className="h-10 w-[100px]"
    >
      <AreaChart
        key={JSON.stringify(data)}
        data={chartData}
        margin={{
          top: 4,
          right: 4,
          bottom: 4,
          left: 4,
        }}
      >
        <defs>
          <linearGradient id="sparkUp" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#22c55e" stopOpacity={0.35} />
            <stop offset="100%" stopColor="#22c55e" stopOpacity={0} />
          </linearGradient>

          <linearGradient id="sparkDown" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ef4444" stopOpacity={0.35} />
            <stop offset="100%" stopColor="#ef4444" stopOpacity={0} />
          </linearGradient>
        </defs>

        <ChartTooltip
          cursor={false}
          position={{ x: -150, y: -30 }}
          content={
            <ChartTooltipContent
              indicator="line"
              labelFormatter={(_, payload) =>
                payload?.[0]?.payload?.label || ""
              }
              valueFormatter={(_, item) =>
                `₱${Number(item.payload?.raw || 0).toLocaleString("en-PH", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}`
              }
            />
          }
        />

        <Area
          type="monotone"
          dataKey="value"
          name="value"
          stroke={strokeColor}
          fill={`url(#${gradientId})`}
          strokeWidth={1.5}
          isAnimationActive
          animationDuration={800}
          animationEasing="ease-in-out"
          animationBegin={100}
          dot={false}
        />
      </AreaChart>
    </ChartContainer>
  );
}
