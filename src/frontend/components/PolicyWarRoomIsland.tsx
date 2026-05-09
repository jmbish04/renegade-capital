"use client";

import * as React from "react";
import { useState, useEffect } from "react";
import {
  AssistantRuntimeProvider,
  ThreadPrimitive,
} from "@assistant-ui/react";
import { useChatRuntime, AssistantChatTransport } from "@assistant-ui/react-ai-sdk";
import {
  Sword,
  Bot,
  Search,
  BookOpen,
  ArrowRight,
  Loader2,
  AlertTriangle,
  Check,
  FileText,
  Copy
} from "lucide-react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import rehypeSanitize from "rehype-sanitize";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { VerticalVideoPlayer } from "@/components/VerticalVideoPlayer";
import { PolicyRadarChart } from "@/components/charts/PolicyRadarChart";
import { PolicyBarChart } from "@/components/charts/PolicyBarChart";
import { PolicyPieChart } from "@/components/charts/PolicyPieChart";
import { AgentThread } from "@/components/AgentThread";

export function PolicyWarRoomIsland() {
  const [metrics, setMetrics] = useState<any>(null);
  const [metricsLoading, setMetricsLoading] = useState(true);
  
  const [summary, setSummary] = useState<string | null>(null);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  const [selectedPage, setSelectedPage] = useState<any>(null);

  useEffect(() => {
    // 1. Fetch Metrics immediately
    fetch("/api/policy/metrics")
      .then((res) => res.json())
      .then((data: any) => {
        setMetrics(data);
        setMetricsLoading(false);
      })
      .catch((err) => {
        console.error("Failed to fetch policy metrics:", err);
        setMetricsLoading(false);
      });

    // 2. Fetch AI Summary asynchronously
    fetch("/api/policy/summary")
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        return res.json();
      })
      .then((data: any) => {
        if (data.error) throw new Error(data.error);
        setSummary(data.summary);
        setSummaryLoading(false);
      })
      .catch((err) => {
        console.error("Failed to fetch AI summary:", err);
        setSummaryError(err.message || "Failed to generate AI summary.");
        setSummaryLoading(false);
      });
  }, []);

  const runtime = useChatRuntime({
    transport: new AssistantChatTransport({
      api: "/api/chat/policy",
    }),
  });

  const copyPrompt = () => {
    const text = `The /api/policy/summary endpoint failed with the following error:\n\n${summaryError}\n\nPlease fix this issue.`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <div className="flex h-[calc(100svh-4rem)] flex-col xl:flex-row bg-zinc-950 overflow-hidden">
        
        {/* Main Dashboard Area */}
        <div className="flex-1 overflow-auto p-6 md:p-10 space-y-8 no-scrollbar">
          
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h1 className="text-4xl font-black tracking-tighter text-white flex items-center gap-3">
                <Sword className="size-8 text-red-500" />
                POLICY WAR ROOM
              </h1>
              <p className="text-zinc-400 mt-2 max-w-2xl">
                Real-time threat metrics and social justice impact analysis of the Trump AI Action Plan.
              </p>
            </div>
          </div>

          {/* Navigation Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="bg-zinc-900/50 border-zinc-800 hover:border-red-500/50 transition-colors">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Search className="size-5 text-red-400" />
                  Semantic Search
                </CardTitle>
                <CardDescription>Search the policy documents semantically using AI.</CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant="outline" className="w-full justify-between" onClick={() => window.location.href = '/policy/search'}>
                  Go to Search
                  <ArrowRight className="size-4" />
                </Button>
              </CardContent>
            </Card>
            
            <Card className="bg-zinc-900/50 border-zinc-800 hover:border-red-500/50 transition-colors">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <BookOpen className="size-5 text-red-400" />
                  Policy Review
                </CardTitle>
                <CardDescription>Browse policies by category, tags, and risk scores.</CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant="outline" className="w-full justify-between" onClick={() => window.location.href = '/policy/review'}>
                  Go to Review
                  <ArrowRight className="size-4" />
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Charts Row */}
          {metricsLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
               <Skeleton className="h-[400px] w-full rounded-xl bg-zinc-900" />
               <Skeleton className="h-[400px] w-full rounded-xl bg-zinc-900" />
               <Skeleton className="h-[400px] w-full rounded-xl bg-zinc-900" />
            </div>
          ) : metrics ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
               <div className="md:col-span-1 h-[450px]">
                 <PolicyRadarChart data={metrics.radarData} />
               </div>
               <div className="md:col-span-1 h-[450px]">
                 <PolicyBarChart data={metrics.barData} />
               </div>
               <div className="md:col-span-1 h-[450px]">
                 <PolicyPieChart data={metrics.pieData} />
               </div>
            </div>
          ) : (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>Failed to load metrics data.</AlertDescription>
            </Alert>
          )}

          {/* AI Summary & Video Row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pb-12">
            <div className="lg:col-span-2">
              <Card className="h-full border-zinc-800 bg-zinc-900/40">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Bot className="size-5 text-red-500" />
                    AI Risk Summary
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {summaryLoading ? (
                    <div className="space-y-4">
                      <Skeleton className="h-4 w-full bg-zinc-800" />
                      <Skeleton className="h-4 w-11/12 bg-zinc-800" />
                      <Skeleton className="h-4 w-4/5 bg-zinc-800" />
                      <Skeleton className="h-4 w-full bg-zinc-800" />
                      <Skeleton className="h-4 w-5/6 bg-zinc-800" />
                      <div className="flex items-center gap-2 text-sm text-zinc-500 mt-4">
                        <Loader2 className="size-4 animate-spin" />
                        Generating deep analysis...
                      </div>
                    </div>
                  ) : summaryError ? (
                    <Alert variant="destructive" className="bg-red-950/50 border-red-900">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertTitle>Analysis Failed</AlertTitle>
                      <AlertDescription className="mt-2 space-y-4">
                        <p>{summaryError}</p>
                        <Button variant="outline" size="sm" onClick={copyPrompt} className="text-white border-red-800 hover:bg-red-900">
                          {copied ? <Check className="size-4 mr-2" /> : <Copy className="size-4 mr-2" />}
                          {copied ? "Copied Prompt" : "Copy to Clipboard"}
                        </Button>
                      </AlertDescription>
                    </Alert>
                  ) : (
                    <div className="prose prose-invert max-w-none text-zinc-300">
                      {/* Simple markdown render for paragraphs */}
                      {summary?.split('\n').map((p, i) => p.trim() ? <p key={i}>{p}</p> : <br key={i} />)}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
            
            <div className="lg:col-span-1">
               <div className="w-full max-w-[300px] mx-auto shadow-[0_0_30px_rgba(220,38,38,0.15)] rounded-md overflow-hidden border border-zinc-800 aspect-[9/16]">
                  <VerticalVideoPlayer 
                     src={import.meta.env.INTRO_VIDEO_URL || "https://pub-434f7a70bfdd41a382e8631347f40764.r2.dev/media/IntroPodcastExplainer.mp4"} 
                  />
               </div>
            </div>
          </div>

        </div>

        {/* AI Assistant Sidebar (Right) */}
        <div className="w-full xl:w-[450px] flex flex-col bg-zinc-950 border-l border-zinc-900 relative z-10 shadow-2xl shrink-0 h-full">
          <div className="p-4 border-b border-zinc-900 bg-zinc-900/20">
            <div className="flex items-center gap-3">
              <div className="size-8 rounded bg-red-600 flex items-center justify-center text-white shadow-[0_0_20px_rgba(220,38,38,0.3)]">
                <Sword className="size-4" />
              </div>
              <div>
                <h2 className="text-base font-black uppercase italic tracking-tighter text-white">Policy Agent</h2>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-hidden relative">
             <AgentThread 
               agentName="Policy Agent"
               agentAvatar="PO"
               agentColor="#DC2626"
               emptyDescription="Hello. I am the Policy Analyst Agent. How can I assist you with analyzing the Trump AI Action Plan today?"
               onSourceClick={(source) => {
                 if (source?.uuid || source?.id) {
                   fetch(`/api/policy/pages/${source.uuid || source.id}`)
                     .then(res => res.json())
                     .then((data: any) => setSelectedPage(data.page))
                     .catch(err => console.error(err));
                 }
               }}
             />
          </div>
        </div>
      </div>

      {/* PDF Modal */}
      <Dialog open={!!selectedPage} onOpenChange={(open) => !open && setSelectedPage(null)}>
        <DialogContent className="max-w-5xl h-[90vh] bg-zinc-950 border-zinc-800 p-0 overflow-hidden flex flex-col">
          <DialogHeader className="p-6 border-b border-zinc-900 bg-zinc-900/50 shrink-0">
            <DialogTitle className="text-2xl font-black text-white flex items-center gap-3">
              <FileText className="size-6 text-red-500" />
              Page {selectedPage?.pageNum} Analysis
            </DialogTitle>
          </DialogHeader>
          
          <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
            {/* Image Pane */}
            <div className="flex-1 bg-black p-4 md:p-8 overflow-auto flex items-center justify-center border-r border-zinc-900">
               {selectedPage?.imageUrl ? (
                 <img src={selectedPage.imageUrl} alt={`Page ${selectedPage.pageNum}`} className="max-h-full max-w-full object-contain shadow-2xl" />
               ) : (
                 <div className="text-zinc-600 flex flex-col items-center">
                    <FileText className="size-16 mb-4" />
                    <p>No document image available</p>
                 </div>
               )}
            </div>
            
            {/* Metadata Pane */}
            <div className="w-full md:w-[400px] bg-zinc-950 overflow-auto p-6 space-y-6">
              <div>
                <h4 className="text-sm font-bold text-zinc-500 uppercase tracking-wider mb-2">AI Summary</h4>
                <p className="text-zinc-300 text-sm leading-relaxed">{selectedPage?.summary}</p>
              </div>
              
              {selectedPage?.scores && (
                <div>
                  <h4 className="text-sm font-bold text-zinc-500 uppercase tracking-wider mb-3">Risk Assessment</h4>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center p-2 rounded bg-zinc-900 border border-zinc-800">
                      <span className="text-sm text-zinc-400">Overall Impact</span>
                      <Badge variant={selectedPage.scores.overallImpactScore >= 8 ? "destructive" : "secondary"}>
                        {selectedPage.scores.overallImpactScore}/10
                      </Badge>
                    </div>
                    {selectedPage.scores.overallRationale && (
                      <p className="text-xs text-zinc-500 italic px-2">{selectedPage.scores.overallRationale}</p>
                    )}
                  </div>
                </div>
              )}

              {selectedPage?.analysis && (
                <div>
                  <h4 className="text-sm font-bold text-zinc-500 uppercase tracking-wider mb-2">Deep Analysis</h4>
                  <div className="prose prose-invert prose-sm text-zinc-400">
                    <Markdown
                      remarkPlugins={[remarkGfm]}
                      rehypePlugins={[rehypeRaw, rehypeSanitize]}
                    >
                      {selectedPage.analysis}
                    </Markdown>
                  </div>
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </AssistantRuntimeProvider>
  );
}
