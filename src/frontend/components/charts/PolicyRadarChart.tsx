"use client"

import { TrendingUp } from "lucide-react"
import { PolarAngleAxis, PolarGrid, Radar, RadarChart } from "recharts"

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
  "Racial Equity": { label: "Racial Equity", color: "var(--color-racialEquity)" },
  "Economic Justice": { label: "Economic Justice", color: "var(--color-economicJustice)" },
  "Algorithmic Bias": { label: "Algorithmic Bias", color: "var(--color-algorithmicBias)" },
  "Labor Rights": { label: "Labor Rights", color: "var(--color-laborRights)" },
  "Privacy": { label: "Privacy", color: "var(--color-privacySurveillance)" },
} satisfies ChartConfig

export function PolicyRadarChart({ data }: { data: any[] }) {
  if (!data || data.length === 0) return null;

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="items-center pb-4">
        <CardTitle>Threat Radar</CardTitle>
        <CardDescription>
          Average risk dimensions across policy domains
        </CardDescription>
      </CardHeader>
      <CardContent className="pb-0 flex-1">
        <ChartContainer
          config={chartConfig}
          className="mx-auto aspect-square max-h-[300px]"
        >
          <RadarChart data={data}>
            <ChartTooltip
              cursor={false}
              content={<ChartTooltipContent indicator="line" />}
            />
            <PolarAngleAxis dataKey="dimension" stroke="var(--color-muted-foreground)" />
            <PolarGrid />
            <Radar
              dataKey="value"
              fill="var(--color-red-500)"
              fillOpacity={0.4}
              stroke="var(--color-red-500)"
              strokeWidth={2}
            />
          </RadarChart>
        </ChartContainer>
      </CardContent>
      <CardFooter className="flex-col gap-2 text-sm mt-auto">
        <div className="flex items-center gap-2 leading-none font-medium text-red-500">
          Critical threat zones detected <TrendingUp className="h-4 w-4" />
        </div>
      </CardFooter>
    </Card>
  )
}
