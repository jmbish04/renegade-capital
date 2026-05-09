"use client"

import { TrendingUp } from "lucide-react"
import { Bar, BarChart, XAxis, YAxis } from "recharts"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"

const chartConfig = {
  score: {
    label: "Risk Score",
  },
} satisfies ChartConfig

export function PolicyBarChart({ data }: { data: any[] }) {
  if (!data || data.length === 0) return null;

  return (
    <Card className="h-full flex flex-col">
      <CardHeader>
        <CardTitle>Top 10 Individual Risk Scores</CardTitle>
        <CardDescription>Highest scored policy dimensions</CardDescription>
      </CardHeader>
      <CardContent className="flex-1">
        <ChartContainer config={chartConfig} className="max-h-[350px] w-full">
          <BarChart
            accessibilityLayer
            data={data}
            layout="vertical"
            margin={{
              left: 0,
              right: 10,
            }}
          >
            <YAxis
              dataKey="page"
              type="category"
              tickLine={false}
              tickMargin={10}
              axisLine={false}
              tickFormatter={(value) => value.length > 15 ? value.substring(0, 15) + '...' : value}
              width={100}
            />
            <XAxis dataKey="score" type="number" hide />
            <ChartTooltip
              cursor={false}
              content={<ChartTooltipContent hideLabel />}
            />
            <Bar dataKey="score" radius={5} />
          </BarChart>
        </ChartContainer>
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm mt-auto">
        <div className="flex items-center gap-2 font-medium leading-none text-red-500">
          Peak threats isolated <TrendingUp className="h-4 w-4" />
        </div>
        <div className="leading-none text-muted-foreground">
          Showing highest absolute risk scores across all evaluated policies
        </div>
      </CardFooter>
    </Card>
  )
}
