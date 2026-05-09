"use client";

import * as React from "react";
import { useState, useEffect, useMemo } from "react";
import { 
  Loader2, 
  ArrowLeft, 
  FileText, 
  ExternalLink, 
  ShieldAlert,
  Bot
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

type Segment = 
  | { type: 'page', page: any }
  | { type: 'placeholder', start: number, end: number, count: number };

export function PolicyReviewIsland() {
  const [pages, setPages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [activePageNum, setActivePageNum] = useState<number | null>(null);
  const [targetPageNums, setTargetPageNums] = useState<Set<number>>(new Set());
  const [queryParams, setQueryParams] = useState<{ minScore?: string, search?: string }>({});

  useEffect(() => {
    // Parse URL params
    const params = new URLSearchParams(window.location.search);
    const pagesParam = params.get("pages");
    
    if (pagesParam) {
      setTargetPageNums(new Set(pagesParam.split(',').map(Number)));
    }
    
    setQueryParams({
      minScore: params.get("minScore") || undefined,
      search: params.get("search") || undefined,
    });
    
    // Fetch all pages
    fetch('/api/policy/heatmap')
      .then(res => {
        if (!res.ok) throw new Error("Failed to load policy document");
        return res.json();
      })
      .then((json: any) => {
        const sorted = (json.data || []).sort((a: any, b: any) => a.pageNum - b.pageNum);
        setPages(sorted);
        
        // If no target pages, fall back to all scored pages
        if (!pagesParam) {
           const scored = sorted.filter((p: any) => p.scores !== null).map((p: any) => p.pageNum);
           setTargetPageNums(new Set(scored));
           if (scored.length > 0) setActivePageNum(scored[0]);
        } else if (sorted.length > 0) {
           const firstTarget = pagesParam.split(',').map(Number)[0];
           if (firstTarget) setActivePageNum(firstTarget);
        }
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  // Segmentation Algorithm
  const segments = useMemo(() => {
    if (pages.length === 0) return [];
    
    const result: Segment[] = [];
    let currentPlaceholderStart: number | null = null;
    
    const maxPageNum = Math.max(...pages.map(p => p.pageNum), 38);
    
    for (let i = 1; i <= maxPageNum; i++) {
      const page = pages.find(p => p.pageNum === i);
      const isTarget = targetPageNums.has(i);
      
      if (isTarget && page) {
        if (currentPlaceholderStart !== null) {
          result.push({
            type: 'placeholder',
            start: currentPlaceholderStart,
            end: i - 1,
            count: (i - 1) - currentPlaceholderStart + 1
          });
          currentPlaceholderStart = null;
        }
        result.push({ type: 'page', page });
      } else {
        if (currentPlaceholderStart === null) {
          currentPlaceholderStart = i;
        }
      }
    }
    
    if (currentPlaceholderStart !== null) {
      result.push({
        type: 'placeholder',
        start: currentPlaceholderStart,
        end: maxPageNum,
        count: maxPageNum - currentPlaceholderStart + 1
      });
    }
    
    return result;
  }, [pages, targetPageNums]);

  // Intersection Observer for scroll tracking
  useEffect(() => {
    if (loading || segments.length === 0) return;
    
    const observer = new IntersectionObserver((entries) => {
      // Find the page taking up the most space in the viewport
      let maxRatio = 0;
      let mostVisible: number | null = null;
      
      entries.forEach(entry => {
        if (entry.isIntersecting && entry.intersectionRatio > maxRatio) {
          maxRatio = entry.intersectionRatio;
          const pageNum = Number(entry.target.getAttribute('data-page'));
          if (pageNum) mostVisible = pageNum;
        }
      });
      
      if (mostVisible !== null) {
        setActivePageNum(prev => prev !== mostVisible ? mostVisible : prev);
      }
    }, {
      root: document.getElementById('document-scroll-container'),
      threshold: [0.1, 0.3, 0.5, 0.7, 0.9]
    });
    
    document.querySelectorAll('.document-page').forEach(el => observer.observe(el));
    
    return () => observer.disconnect();
  }, [loading, segments]);

  const activePage = useMemo(() => {
    return pages.find(p => p.pageNum === activePageNum);
  }, [activePageNum, pages]);

  const getHeatmapColor = (val?: number) => {
    if (val === undefined || val === null) return "bg-zinc-900 text-zinc-500 border-zinc-800";
    if (val >= 8) return "bg-red-950 text-red-400 border-red-900";
    if (val >= 5) return "bg-orange-950 text-orange-400 border-orange-900";
    return "bg-green-950 text-green-400 border-green-900";
  };

  if (loading) {
    return (
      <div className="flex h-[calc(100svh-4rem)] flex-col bg-zinc-950 p-6">
        <div className="flex gap-6 h-full">
          <div className="w-2/3 h-full">
            <Skeleton className="w-full h-full rounded-xl" />
          </div>
          <div className="w-1/3 h-full space-y-6">
            <Skeleton className="w-full h-48 rounded-xl" />
            <Skeleton className="w-full h-96 rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-10 max-w-4xl mx-auto">
        <Alert variant="destructive" className="bg-red-950/50 border-red-900">
          <ShieldAlert className="h-4 w-4" />
          <AlertTitle>Document Loading Failed</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
        <Button 
          variant="outline" 
          onClick={() => window.location.href = '/policy/dashboard'}
          className="mt-6"
        >
          <ArrowLeft className="size-4 ml-2" />
          Return to Dashboard
        </Button>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100svh-4rem)] flex-col bg-zinc-950 overflow-hidden">
      {/* Top Bar */}
      <div className="h-16 shrink-0 border-b border-zinc-800 bg-zinc-900/50 flex items-center justify-between px-6">
        <div className="flex items-center gap-4">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => window.location.href = '/policy/dashboard'}
            className="text-zinc-400 hover:text-white"
          >
            <ArrowLeft className="size-4 mr-2" />
            Back to Analytics
          </Button>
          <Separator orientation="vertical" className="h-6" />
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-zinc-300">Active Filters:</span>
            {queryParams.search && (
              <Badge variant="outline" className="bg-blue-950/30 text-blue-400 border-blue-900">
                Search: "{queryParams.search}"
              </Badge>
            )}
            {queryParams.minScore && (
              <Badge variant="outline" className="bg-red-950/30 text-red-400 border-red-900">
                Risk &gt;= {queryParams.minScore}
              </Badge>
            )}
            <Badge variant="outline" className="bg-zinc-800 text-zinc-300 border-zinc-700">
              {targetPageNums.size} Pages in Population
            </Badge>
          </div>
        </div>
        
        <div className="text-sm font-medium text-zinc-400">
          Viewing Page {activePageNum || '-'} of 38
        </div>
      </div>

      {/* Main Split View */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* Left Pane: Document Viewer (Continuous Scroll) */}
        <div className="w-full lg:w-[65%] border-r border-zinc-800 relative bg-zinc-950/50 flex flex-col">
          <ScrollArea 
            id="document-scroll-container"
            className="flex-1 w-full"
          >
            <div className="p-8 max-w-4xl mx-auto space-y-12 pb-32">
              {segments.map((segment, idx) => {
                
                if (segment.type === 'placeholder') {
                  return (
                    <Card key={`placeholder-${idx}`} className="bg-zinc-900/20 border-zinc-800/50 border-dashed">
                      <CardContent className="p-12 flex flex-col items-center justify-center text-center">
                        <FileText className="size-10 text-zinc-700 mb-4 opacity-50" />
                        <h3 className="text-lg font-bold text-zinc-500">
                          {segment.count > 1 
                            ? `Pages ${segment.start}-${segment.end} Skipped`
                            : `Page ${segment.start} Skipped`}
                        </h3>
                        <p className="text-sm text-zinc-600 mt-2">
                          Outside your current data population.
                        </p>
                      </CardContent>
                    </Card>
                  );
                }

                // Page Segment
                const { page } = segment;
                const isActive = activePageNum === page.pageNum;
                
                return (
                  <div 
                    key={page.pageNum}
                    data-page={page.pageNum}
                    className={`document-page transition-all duration-500 ${isActive ? 'opacity-100 scale-[1.01]' : 'opacity-60 scale-100'}`}
                  >
                    <div className="flex items-center gap-4 mb-4">
                      <Separator className="flex-1" />
                      <Badge variant="outline" className={`uppercase tracking-widest ${isActive ? 'bg-red-950/50 text-red-400 border-red-900' : 'bg-zinc-900 text-zinc-500 border-zinc-800'}`}>
                        Page {page.pageNum}
                      </Badge>
                      <Separator className="flex-1" />
                    </div>
                    
                    <Card className={`overflow-hidden bg-black transition-colors duration-500 ${isActive ? 'border-zinc-600 shadow-2xl shadow-red-900/10' : 'border-zinc-800'}`}>
                      <CardContent className="p-0">
                        {page.imageUrl || page.pageImageUrl ? (
                          <img 
                            src={page.imageUrl || page.pageImageUrl} 
                            alt={`Page ${page.pageNum}`}
                            className="w-full h-auto object-contain min-h-[600px] bg-black"
                            loading="lazy"
                          />
                        ) : (
                          <div className="w-full h-[800px] flex flex-col items-center justify-center text-zinc-600 bg-zinc-950">
                            <FileText className="size-16 mb-4" />
                            <p>No document image available</p>
                            <p className="text-sm mt-2 max-w-md text-center">
                              {page.pageContent?.substring(0, 150)}...
                            </p>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        </div>

        {/* Right Pane: Metadata Sidebar */}
        <div className="hidden lg:flex w-[35%] bg-zinc-950 flex-col">
          {activePage ? (
            <ScrollArea className="flex-1">
              <div className="p-8 space-y-8">
                
                {/* Header info */}
                <div className="flex justify-between items-start">
                  <div>
                    <h2 className="text-2xl font-black text-white">Page {activePage.pageNum}</h2>
                    <p className="text-sm text-zinc-500 mt-1">AI Metadata & Analysis</p>
                  </div>
                  
                  {activePage.scores && (
                    <Badge 
                      variant={activePage.scores.overallImpactScore >= 8 ? "destructive" : "secondary"}
                      className="text-base px-3 py-1"
                    >
                      Impact: {activePage.scores.overallImpactScore}/10
                    </Badge>
                  )}
                </div>

                {/* AI Summary */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-wider flex items-center gap-2">
                    <Bot className="size-4" />
                    AI Summary
                  </h4>
                  <p className="text-sm text-zinc-300 leading-relaxed bg-zinc-900/50 p-4 rounded-lg border border-zinc-800/50">
                    {activePage.summary || activePage.aiSummary || "No summary available."}
                  </p>
                </div>

                {/* Risk Grid */}
                {activePage.scores && (
                  <div className="space-y-3">
                    <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-wider">
                      Risk Dimensions
                    </h4>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className={`p-3 rounded-md border ${getHeatmapColor(activePage.scores.racialEquityScore || activePage.scores.racialEquity)}`}>
                        <div className="font-semibold opacity-80 mb-1">Racial Equity</div>
                        <div className="text-xl font-bold">{activePage.scores.racialEquityScore || activePage.scores.racialEquity || "-"}</div>
                      </div>
                      <div className={`p-3 rounded-md border ${getHeatmapColor(activePage.scores.economicJusticeScore || activePage.scores.economicJustice)}`}>
                        <div className="font-semibold opacity-80 mb-1">Economic Justice</div>
                        <div className="text-xl font-bold">{activePage.scores.economicJusticeScore || activePage.scores.economicJustice || "-"}</div>
                      </div>
                      <div className={`p-3 rounded-md border ${getHeatmapColor(activePage.scores.algorithmicBiasScore || activePage.scores.algorithmicBias)}`}>
                        <div className="font-semibold opacity-80 mb-1">Algorithmic Bias</div>
                        <div className="text-xl font-bold">{activePage.scores.algorithmicBiasScore || activePage.scores.algorithmicBias || "-"}</div>
                      </div>
                      <div className={`p-3 rounded-md border ${getHeatmapColor(activePage.scores.laborRightsScore || activePage.scores.laborRights)}`}>
                        <div className="font-semibold opacity-80 mb-1">Labor Rights</div>
                        <div className="text-xl font-bold">{activePage.scores.laborRightsScore || activePage.scores.laborRights || "-"}</div>
                      </div>
                      <div className={`p-3 rounded-md border col-span-2 ${getHeatmapColor(activePage.scores.privacySurveillanceScore || activePage.scores.privacySurveillance)}`}>
                        <div className="font-semibold opacity-80 mb-1">Privacy & Surveillance</div>
                        <div className="text-xl font-bold">{activePage.scores.privacySurveillanceScore || activePage.scores.privacySurveillance || "-"}</div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Rationale */}
                {activePage.scores?.overallRationale && (
                  <div className="space-y-3">
                    <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-wider">
                      Scoring Rationale
                    </h4>
                    <p className="text-sm text-zinc-400 italic border-l-2 border-zinc-700 pl-4 py-1">
                      "{activePage.scores.overallRationale}"
                    </p>
                  </div>
                )}

                {/* Tags (if fetched from the page details, currently heatmap data lacks tags) */}
                {/* We'll leave space for them if the data structure gets updated */}
                
                <Separator className="bg-zinc-800" />
                
                {/* CTA */}
                <Button 
                  className="w-full bg-zinc-800 hover:bg-zinc-700 text-white"
                  onClick={() => window.open("/chat/policy", "_blank")}
                >
                  Discuss with Policy Agent
                  <ExternalLink className="size-4 ml-2 text-zinc-400" />
                </Button>

              </div>
            </ScrollArea>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8 text-zinc-500">
              <FileText className="size-16 mb-4 opacity-20" />
              <p className="text-lg font-medium text-zinc-400">No Document Selected</p>
              <p className="text-sm mt-2 max-w-xs">
                Scroll through the document viewer on the left to see AI metadata and analysis for a specific page.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
