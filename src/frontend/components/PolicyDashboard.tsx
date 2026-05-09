"use client";

import * as React from "react";
import { useState, useEffect, useMemo } from "react";
import { 
  Bar, 
  BarChart, 
  CartesianGrid, 
  XAxis, 
  YAxis, 
  Tooltip,
  Radar, 
  RadarChart, 
  PolarGrid, 
  PolarAngleAxis, 
  PolarRadiusAxis,
  Cell,
  ResponsiveContainer
} from "recharts";
import { 
  Search, 
  Filter, 
  ArrowRight, 
  Loader2, 
  FileText, 
  Tags, 
  Users,
  AlertTriangle
} from "lucide-react";
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { 
  ChartContainer, 
  ChartTooltip, 
  ChartTooltipContent,
  type ChartConfig
} from "@/components/ui/chart";

export function PolicyDashboard() {
  const [pages, setPages] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [tagsTree, setTagsTree] = useState<any[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [searchLoading, setSearchLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [appliedSearchQuery, setAppliedSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[] | null>(null);
  
  const [selectedTagType, setSelectedTagType] = useState<string>("__all__");
  const [selectedTag, setSelectedTag] = useState<string>("__all__");
  const [minScore, setMinScore] = useState<string>("0");

  useEffect(() => {
    async function fetchInitialData() {
      try {
        setLoading(true);
        const [heatmapRes, statsRes, tagsRes] = await Promise.all([
          fetch('/api/policy/heatmap'),
          fetch('/api/policy/stats'),
          fetch('/api/policy/tags')
        ]);
        
        if (!heatmapRes.ok || !statsRes.ok || !tagsRes.ok) {
          throw new Error('Failed to fetch initial dashboard data');
        }

        const heatmapJson = await heatmapRes.json() as any;
        const statsJson = await statsRes.json() as any;
        const tagsJson = await tagsRes.json() as any;

        setPages(heatmapJson.data || []);
        setStats(statsJson);
        setTagsTree(tagsJson.tree || []);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    
    fetchInitialData();
  }, []);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) {
      setSearchResults(null);
      setAppliedSearchQuery("");
      return;
    }

    try {
      setSearchLoading(true);
      setAppliedSearchQuery(searchQuery);
      const res = await fetch(`/api/policy/search?q=${encodeURIComponent(searchQuery)}&topK=20`);
      if (!res.ok) throw new Error("Search failed");
      const json = await res.json() as any;
      setSearchResults(json.results || []);
    } catch (err: any) {
      console.error(err);
      // Fallback silently or show toast ideally
    } finally {
      setSearchLoading(false);
    }
  };

  const clearSearch = () => {
    setSearchQuery("");
    setAppliedSearchQuery("");
    setSearchResults(null);
  };

  // Build the filtered data population
  const dataPopulation = useMemo(() => {
    let sourceData = appliedSearchQuery && searchResults !== null 
      ? searchResults 
      : pages;

    const threshold = Number(minScore);

    return sourceData.filter(page => {
      // Filter by min score
      const score = page.scores?.overallImpactScore || page.overallImpactScore || 0;
      if (score < threshold) return false;

      // Filter by tags (if tag filtering is active)
      // Since pages from heatmap don't include tags directly, we need to handle this 
      // accurately. For now, we'll apply score and search filtering. 
      // TODO: If full tag filtering is needed, we should cross-reference with the review endpoint data.
      
      return true;
    });
  }, [pages, searchResults, appliedSearchQuery, minScore]);

  // Aggregate Data for Charts
  const chartData = useMemo(() => {
    const scoredPages = pages.filter(p => p.scores !== null);
    
    // 1. Bar Chart Data (Risk by Page)
    const barData = scoredPages.map(p => ({
      page: `Page ${p.pageNum}`,
      pageNum: p.pageNum,
      score: p.scores.overallImpactScore || 0,
      fill: p.scores.overallImpactScore >= 8 ? 'var(--color-critical)' : 
            p.scores.overallImpactScore >= 5 ? 'var(--color-warning)' : 'var(--color-safe)'
    })).sort((a, b) => a.pageNum - b.pageNum);

    // 2. Radar Chart Data (Average across all dimensions)
    let totalRacial = 0, totalEcon = 0, totalAlgo = 0, totalLabor = 0, totalPrivacy = 0;
    let count = 0;
    
    scoredPages.forEach(p => {
      if (p.scores.racialEquity !== null) {
        totalRacial += p.scores.racialEquity || p.scores.racialEquityScore || 0;
        totalEcon += p.scores.economicJustice || p.scores.economicJusticeScore || 0;
        totalAlgo += p.scores.algorithmicBias || p.scores.algorithmicBiasScore || 0;
        totalLabor += p.scores.laborRights || p.scores.laborRightsScore || 0;
        totalPrivacy += p.scores.privacySurveillance || p.scores.privacySurveillanceScore || 0;
        count++;
      }
    });

    const radarData = count > 0 ? [
      { dimension: "Racial Equity", value: Number((totalRacial / count).toFixed(1)) },
      { dimension: "Econ Justice", value: Number((totalEcon / count).toFixed(1)) },
      { dimension: "Algorithmic Bias", value: Number((totalAlgo / count).toFixed(1)) },
      { dimension: "Labor Rights", value: Number((totalLabor / count).toFixed(1)) },
      { dimension: "Privacy", value: Number((totalPrivacy / count).toFixed(1)) },
    ] : [];

    return { barData, radarData };
  }, [pages]);

  const barChartConfig = {
    score: { label: "Impact Score" },
    critical: { color: "var(--destructive)" },
    warning: { color: "#f97316" }, // orange-500
    safe: { color: "#22c55e" },   // green-500
  } satisfies ChartConfig;

  const radarChartConfig = {
    value: { label: "Avg Score", color: "var(--destructive)" }
  } satisfies ChartConfig;

  const getHeatmapColor = (val?: number) => {
    if (val === undefined || val === null) return "text-zinc-500";
    if (val >= 8) return "text-red-400";
    if (val >= 5) return "text-orange-400";
    return "text-green-400";
  };

  const transferToReview = () => {
    const params = new URLSearchParams();
    if (minScore !== "0") params.append("minScore", minScore);
    if (appliedSearchQuery) params.append("search", appliedSearchQuery);
    
    const pageNums = dataPopulation.map(p => p.pageNum).sort((a,b) => a-b);
    if (pageNums.length > 0) {
      params.append("pages", pageNums.join(","));
    }
    
    window.location.href = `/policy/review?${params.toString()}`;
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
        <Skeleton className="h-96 w-full" />
        <Skeleton className="h-[600px] w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive" className="bg-red-950/50 border-red-900">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>System Error</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-8 pb-12">
      {/* Header & Stats */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h1 className="text-3xl font-black text-white tracking-tight">Policy Analytics</h1>
          <p className="text-zinc-400 mt-2 max-w-2xl">
            Analyze the social justice impact of the Trump AI Action Plan. Slice and dice the data population before jumping into the document reader.
          </p>
        </div>
        
        <form onSubmit={handleSearch} className="flex gap-2 w-full md:w-auto">
          <div className="relative w-full md:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-zinc-500" />
            <Input 
              placeholder="Semantic search (e.g. 'nuclear power')" 
              className="pl-9 bg-zinc-900/50 border-zinc-800 focus-visible:ring-red-500"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          {appliedSearchQuery ? (
            <Button type="button" variant="outline" onClick={clearSearch} className="shrink-0 border-zinc-800">
              Clear
            </Button>
          ) : (
            <Button type="submit" variant="secondary" disabled={searchLoading} className="shrink-0">
              {searchLoading ? <Loader2 className="size-4 animate-spin" /> : "Search"}
            </Button>
          )}
        </form>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-zinc-900/30 border-zinc-800">
          <CardContent className="p-6 flex items-center gap-4">
            <div className="p-3 rounded-xl bg-red-500/10 text-red-500">
              <FileText className="size-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-zinc-500">Pages Analyzed</p>
              <h3 className="text-2xl font-black text-white">{stats?.pages || pages.length}</h3>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-zinc-900/30 border-zinc-800">
          <CardContent className="p-6 flex items-center gap-4">
            <div className="p-3 rounded-xl bg-orange-500/10 text-orange-500">
              <Tags className="size-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-zinc-500">Extracted Tags</p>
              <h3 className="text-2xl font-black text-white">{stats?.tags || 0}</h3>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-zinc-900/30 border-zinc-800">
          <CardContent className="p-6 flex items-center gap-4">
            <div className="p-3 rounded-xl bg-blue-500/10 text-blue-500">
              <Users className="size-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-zinc-500">Expert Matchups</p>
              <h3 className="text-2xl font-black text-white">{stats?.guestMappings || 0}</h3>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      {!appliedSearchQuery && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="bg-zinc-900/30 border-zinc-800 lg:col-span-2">
            <CardHeader>
              <CardTitle>Impact Score Timeline</CardTitle>
              <CardDescription>Overall risk score distributed across the document pages.</CardDescription>
            </CardHeader>
            <CardContent>
              <ChartContainer config={barChartConfig} className="h-[300px] w-full">
                <BarChart data={chartData.barData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="pageNum" 
                    tickLine={false} 
                    axisLine={false} 
                    tickFormatter={(val) => `p${val}`}
                  />
                  <YAxis 
                    tickLine={false} 
                    axisLine={false} 
                    domain={[0, 10]}
                    ticks={[0, 2, 4, 6, 8, 10]}
                  />
                  <ChartTooltip 
                    cursor={{ fill: 'hsl(var(--muted))', opacity: 0.2 }} 
                    content={<ChartTooltipContent />} 
                  />
                  <Bar dataKey="score" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ChartContainer>
            </CardContent>
          </Card>

          <Card className="bg-zinc-900/30 border-zinc-800">
            <CardHeader>
              <CardTitle>Threat Averages</CardTitle>
              <CardDescription>Average risk across all analyzed dimensions.</CardDescription>
            </CardHeader>
            <CardContent className="pb-0">
              <ChartContainer config={radarChartConfig} className="h-[300px] w-full mx-auto aspect-square">
                <RadarChart data={chartData.radarData} margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                  <PolarGrid stroke="hsl(var(--border))" />
                  <PolarAngleAxis dataKey="dimension" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} />
                  <PolarRadiusAxis angle={30} domain={[0, 10]} tick={false} axisLine={false} />
                  <Radar
                    name="Average Score"
                    dataKey="value"
                    fill="var(--color-value)"
                    fillOpacity={0.3}
                    stroke="var(--color-value)"
                    strokeWidth={2}
                  />
                  <ChartTooltip content={<ChartTooltipContent />} />
                </RadarChart>
              </ChartContainer>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Data Population Table */}
      <Card className="bg-zinc-900/50 border-zinc-800 overflow-hidden">
        <CardHeader className="border-b border-zinc-800 bg-zinc-950/50">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
            <div>
              <CardTitle className="text-xl">
                {appliedSearchQuery ? "Search Results" : "Data Population"}
              </CardTitle>
              <CardDescription>
                {dataPopulation.length} pages match your current filter criteria.
              </CardDescription>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
              <div className="flex items-center gap-2">
                <Filter className="size-4 text-zinc-500" />
                <Select value={minScore} onValueChange={(val) => setMinScore(val || "0")}>
                  <SelectTrigger className="w-full sm:w-40 bg-zinc-900 border-zinc-800">
                    <SelectValue placeholder="Min Score" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">All Scores</SelectItem>
                    <SelectItem value="5">Risk &gt; 5</SelectItem>
                    <SelectItem value="7">Risk &gt; 7</SelectItem>
                    <SelectItem value="9">Risk &gt; 9 (Critical)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <Button onClick={transferToReview} disabled={dataPopulation.length === 0} className="w-full sm:w-auto bg-red-600 hover:bg-red-700 text-white font-bold">
                Review Documents
                <ArrowRight className="size-4 ml-2" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table className="min-w-[600px]">
            <TableHeader className="bg-zinc-950/80">
              <TableRow className="border-zinc-800 hover:bg-transparent">
                <TableHead className="w-[80px] text-center">Page</TableHead>
                <TableHead className="w-[120px] text-center">Score</TableHead>
                <TableHead>Summary / Context</TableHead>
                <TableHead className="w-[100px] text-right">Thumbnail</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {dataPopulation.map((page) => {
                const score = page.scores?.overallImpactScore || page.vectorScore;
                const isVector = !!page.vectorScore;
                
                return (
                  <TableRow key={page.id || page.uuid} className="border-zinc-800/50 hover:bg-zinc-900">
                    <TableCell className="text-center font-medium text-zinc-300">
                      {page.pageNum}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline" className={`border-zinc-800 ${isVector ? 'text-blue-400' : getHeatmapColor(score as number)}`}>
                        {isVector ? `Match: ${(Number(score) * 100).toFixed(0)}%` : `Risk: ${score}/10`}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <p className="text-sm text-zinc-300 line-clamp-2">
                        {page.summary || page.aiSummary}
                      </p>
                    </TableCell>
                    <TableCell className="text-right">
                      {(page.imageUrl || page.pageImageUrl) ? (
                        <img 
                          src={page.imageUrl || page.pageImageUrl} 
                          alt={`Page ${page.pageNum}`} 
                          className="h-12 w-9 object-cover rounded border border-zinc-800 ml-auto opacity-70"
                        />
                      ) : (
                        <div className="h-12 w-9 rounded border border-zinc-800 bg-zinc-950 ml-auto flex items-center justify-center">
                          <FileText className="size-4 text-zinc-700" />
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
              
              {dataPopulation.length === 0 && (
                <TableRow className="hover:bg-transparent border-0">
                  <TableCell colSpan={4} className="h-48 text-center text-zinc-500">
                    No pages found matching the current criteria.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
