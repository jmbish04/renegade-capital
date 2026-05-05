import React, { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "./ui/card";
import { Badge } from "./ui/badge";
import { Separator } from "./ui/separator";

interface Guest {
  name: string;
  role: string;
  impact: string;
  animationConfig: {
    delay: string;
    duration: string;
    yOffset: string;
  };
}

interface Pillar {
  id: string;
  title: string;
  goal: string;
  trumpPlan: string;
  guests: Guest[];
}

interface ClashData {
  pillars: Pillar[];
  pdfUrl: string;
}

const floatKeyframes = `
@keyframes floatAnim {
  0% { transform: translateY(0px); }
  50% { transform: translateY(var(--y-offset, -10px)); }
  100% { transform: translateY(0px); }
}
.floating-guest {
  animation: floatAnim var(--duration, 6s) ease-in-out infinite;
  animation-delay: var(--delay, 0s);
}
`;

export default function ClashAnimations() {
  const [data, setData] = useState<ClashData | null>(null);

  useEffect(() => {
    fetch('/api/clash')
      .then(res => res.json())
      .then(setData)
      .catch(err => console.error("Failed to fetch clash data", err));
  }, []);

  if (!data) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-pulse flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-zinc-400 font-mono text-sm">Loading Strategic Intel...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <style>{floatKeyframes}</style>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
        
        {/* Left Column: The Pillars and Floating Guests */}
        <div className="space-y-16">
          {data.pillars.map((pillar) => (
            <div key={pillar.id} className="relative">
              <Card className="relative z-10 bg-zinc-950 border-zinc-800 shadow-2xl">
                <CardHeader>
                  <CardTitle className="text-2xl font-bold text-zinc-100">{pillar.title}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div>
                    <h4 className="text-emerald-400 font-semibold mb-2 uppercase tracking-wider text-xs">Social Justice Goal</h4>
                    <p className="text-zinc-300">{pillar.goal}</p>
                  </div>
                  <Separator className="bg-zinc-800" />
                  <div>
                    <h4 className="text-red-400 font-semibold mb-2 uppercase tracking-wider text-xs">AI Action Plan Directive</h4>
                    <p className="text-zinc-400 italic">"{pillar.trumpPlan}"</p>
                  </div>
                </CardContent>
              </Card>

              {/* Floating Orbiting Guests */}
              <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-6 relative z-20 px-4">
                {pillar.guests.map(guest => (
                  <div 
                    key={guest.name} 
                    className="floating-guest bg-zinc-900 p-5 rounded-xl border border-zinc-700 shadow-[0_0_30px_rgba(16,185,129,0.05)] hover:border-emerald-500/50 transition-colors"
                    style={{
                      '--delay': guest.animationConfig.delay,
                      '--duration': guest.animationConfig.duration,
                      '--y-offset': guest.animationConfig.yOffset,
                    } as React.CSSProperties}
                  >
                    <Badge className="mb-3 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border-emerald-500/20">{guest.role}</Badge>
                    <h4 className="font-bold text-zinc-100 text-lg mb-2">{guest.name}</h4>
                    <p className="text-sm text-zinc-400 leading-relaxed">{guest.impact}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Right Column: Sticky PDF Iframe */}
        <div className="sticky top-8 rounded-xl overflow-hidden shadow-2xl border border-zinc-800 bg-zinc-950 flex flex-col h-[calc(100vh-4rem)]">
          <div className="p-4 bg-zinc-900 border-b border-zinc-800 flex justify-between items-center z-10">
            <h3 className="text-sm font-bold text-white flex items-center gap-3">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
              </span>
              America's AI Action Plan
            </h3>
            <Badge variant="outline" className="text-zinc-400 border-zinc-700">Source Document</Badge>
          </div>
          <iframe 
            src={data.pdfUrl} 
            className="w-full flex-1 border-0 bg-white" 
            allow="autoplay"
            title="America's AI Action Plan PDF"
          ></iframe>
        </div>
        
      </div>
    </>
  );
}
