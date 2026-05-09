"use client";

import * as React from "react";
import { FileText, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import rehypeSanitize from "rehype-sanitize";

interface PolicyPageModalProps {
  page: any | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PolicyPageModal({ page, open, onOpenChange }: PolicyPageModalProps) {
  if (!page) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl h-[90vh] bg-zinc-950 border-zinc-800 p-0 overflow-hidden flex flex-col">
        <DialogHeader className="p-6 border-b border-zinc-900 bg-zinc-900/50 shrink-0">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-2xl font-black text-white flex items-center gap-3">
              <FileText className="size-6 text-red-500" />
              Page {page.pageNum} Analysis
            </DialogTitle>
            <Button
              variant="outline"
              size="sm"
              className="text-zinc-400 border-zinc-800 hover:text-white hover:border-zinc-700"
              onClick={() => window.open("/chat/policy", "_blank")}
            >
              Discuss with Policy Agent
              <ExternalLink className="size-4 ml-2" />
            </Button>
          </div>
        </DialogHeader>

        <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
          {/* Image Pane */}
          <div className="flex-1 bg-black p-4 md:p-8 overflow-auto flex items-center justify-center border-r border-zinc-900">
            {page.imageUrl || page.pageImageUrl ? (
              <img
                src={page.imageUrl || page.pageImageUrl}
                alt={`Page ${page.pageNum}`}
                className="max-h-full max-w-full object-contain shadow-2xl"
              />
            ) : (
              <div className="text-zinc-600 flex flex-col items-center">
                <FileText className="size-16 mb-4" />
                <p>No document image available</p>
              </div>
            )}
          </div>

          {/* Metadata Pane */}
          <div className="w-full md:w-[450px] bg-zinc-950 overflow-auto p-6 space-y-8">
            {/* Summary Section */}
            <div>
              <h4 className="text-sm font-bold text-zinc-500 uppercase tracking-wider mb-2">
                AI Summary
              </h4>
              <p className="text-zinc-300 text-sm leading-relaxed">{page.summary || page.aiSummary}</p>
            </div>

            {/* Risk Assessment Section */}
            {page.scores && (
              <div>
                <h4 className="text-sm font-bold text-zinc-500 uppercase tracking-wider mb-3">
                  Risk Assessment
                </h4>
                <div className="space-y-4">
                  <div className="flex justify-between items-center p-3 rounded bg-zinc-900 border border-zinc-800">
                    <span className="text-sm font-bold text-white">Overall Impact</span>
                    <Badge
                      variant={
                        page.scores.overallImpactScore >= 8
                          ? "destructive"
                          : page.scores.overallImpactScore >= 5
                          ? "default"
                          : "secondary"
                      }
                      className="text-sm px-2 py-0.5"
                    >
                      {page.scores.overallImpactScore}/10
                    </Badge>
                  </div>

                  {/* Detailed Scoring Grid */}
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <ScoreBox title="Racial Equity" score={page.scores.racialEquityScore ?? page.scores.racialEquity} />
                    <ScoreBox title="Economic Justice" score={page.scores.economicJusticeScore ?? page.scores.economicJustice} />
                    <ScoreBox title="Algorithmic Bias" score={page.scores.algorithmicBiasScore ?? page.scores.algorithmicBias} />
                    <ScoreBox title="Labor Rights" score={page.scores.laborRightsScore ?? page.scores.laborRights} />
                    <ScoreBox
                      title="Privacy & Surveillance"
                      score={page.scores.privacySurveillanceScore ?? page.scores.privacySurveillance}
                      className="col-span-2"
                    />
                  </div>

                  {/* Overall Rationale */}
                  {page.scores.overallRationale && (
                    <div className="bg-zinc-900/50 p-3 rounded-md border border-zinc-800/50">
                      <p className="text-xs text-zinc-400 italic">
                        <span className="font-semibold text-zinc-300 not-italic mr-1">Rationale:</span>
                        {page.scores.overallRationale}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Tags & Guests (If available from API) */}
            {page.tags && page.tags.length > 0 && (
              <div>
                <h4 className="text-sm font-bold text-zinc-500 uppercase tracking-wider mb-3">
                  Policy Tags
                </h4>
                <div className="flex flex-wrap gap-2">
                  {page.tags.map((tag: any, idx: number) => (
                    <Badge key={idx} variant="outline" className="bg-zinc-900 border-zinc-800 text-zinc-300">
                      {tag.tagName}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {page.guests && page.guests.length > 0 && (
              <div>
                <h4 className="text-sm font-bold text-zinc-500 uppercase tracking-wider mb-3">
                  Associated Experts
                </h4>
                <div className="space-y-2">
                  {page.guests.map((guest: any, idx: number) => (
                    <div key={idx} className="flex items-center gap-3 p-2 bg-zinc-900/50 rounded-md border border-zinc-800">
                      {guest.headshotUrl ? (
                        <img src={guest.headshotUrl} alt={guest.name} className="size-8 rounded-full object-cover" />
                      ) : (
                        <div className="size-8 rounded-full bg-zinc-800 flex items-center justify-center text-xs font-bold text-zinc-500">
                          {guest.name.substring(0, 2).toUpperCase()}
                        </div>
                      )}
                      <div>
                        <p className="text-sm font-medium text-white">{guest.name}</p>
                        <p className="text-xs text-zinc-500 line-clamp-1">{guest.expertise}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Deep Analysis */}
            {page.analysis && (
              <div>
                <h4 className="text-sm font-bold text-zinc-500 uppercase tracking-wider mb-2">
                  Deep Analysis
                </h4>
                <div className="prose prose-invert prose-sm text-zinc-400">
                  <Markdown
                    remarkPlugins={[remarkGfm]}
                    rehypePlugins={[rehypeRaw, rehypeSanitize]}
                  >
                    {page.analysis}
                  </Markdown>
                </div>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ScoreBox({ title, score, className = "" }: { title: string; score?: number; className?: string }) {
  const getHeatmapColor = (val?: number) => {
    if (val === undefined || val === null) return "bg-zinc-900 text-zinc-500 border-zinc-800";
    if (val >= 8) return "bg-red-950 text-red-400 border-red-900";
    if (val >= 5) return "bg-orange-950 text-orange-400 border-orange-900";
    return "bg-yellow-950 text-yellow-400 border-yellow-900";
  };

  return (
    <div className={`p-2 rounded border ${getHeatmapColor(score)} ${className}`}>
      <div className="font-semibold opacity-80 mb-1">{title}</div>
      <div className="text-lg font-bold">{score !== undefined && score !== null ? score : "-"}</div>
    </div>
  );
}
