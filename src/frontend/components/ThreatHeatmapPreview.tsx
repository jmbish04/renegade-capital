"use client";

import * as React from "react";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle } from "lucide-react";

const threats = [
  { name: "Labor Rights", score: 9.2, color: "bg-red-500" },
  { name: "Algorithmic Bias", score: 8.5, color: "bg-orange-500" },
  { name: "Environmental Impact", score: 7.8, color: "bg-yellow-500" },
  { name: "Financial Access", score: 6.4, color: "bg-blue-500" },
];

export function ThreatHeatmapPreview() {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-950/50 p-6 backdrop-blur-sm shadow-[0_0_30px_rgba(220,38,38,0.1)]">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <AlertTriangle className="size-4 text-red-500 animate-pulse" />
          <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-400">Threat Heatmap</h3>
        </div>
        <Badge variant="destructive" className="bg-red-500/10 text-red-500 border-red-500/20 text-[10px]">LATEST UPDATE</Badge>
      </div>
      
      <div className="space-y-5">
        {threats.map((threat) => (
          <div key={threat.name} className="space-y-2">
            <div className="flex items-center justify-between text-xs font-medium">
              <span className="text-zinc-300">{threat.name}</span>
              <span className="text-zinc-500">{threat.score}/10</span>
            </div>
            <Progress value={threat.score * 10} className="h-1 bg-zinc-800" />
          </div>
        ))}
      </div>
      
      <div className="mt-8 pt-6 border-t border-zinc-800">
        <p className="text-[10px] text-zinc-500 leading-relaxed italic">
          Data derived from vectorized analysis of the Trump AI Action Plan vs. Civil Rights frameworks.
        </p>
      </div>
    </div>
  );
}
