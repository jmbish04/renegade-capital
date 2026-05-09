"use client";

import * as React from "react";
import { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
// Removed unused lucide-react import

export function ResearchList() {
  const [researchItems, setResearchItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/research")
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch research profiles");
        return res.json();
      })
      .then((data: any) => {
        setResearchItems(data.research || []);
        setLoading(false)
      })
      .catch((err) => {
        console.error("Error loading research:", err);
        setError("Failed to load research. Please try again later.");
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="py-24 text-center">
         <div className="size-10 border-t-2 border-red-600 rounded-full animate-spin mx-auto mb-4"></div>
         <p className="text-xs font-bold uppercase tracking-[0.2em] text-zinc-500">Accessing Ground Truth...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="py-16 text-center text-red-500 font-bold uppercase tracking-widest">
        {error}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-12 sm:grid-cols-2 lg:grid-cols-3 pt-8">
      {researchItems.map((item: any) => (
        <div key={item.id} className="relative transition-transform hover:-translate-y-1">
          <div data-slot="avatar" className="flex shrink-0 overflow-hidden rounded-full absolute left-4 -top-8 sm:-left-8 z-10 h-16 w-16 ring-2 ring-background">
            {item.avatarUrl ? (
              <img data-slot="avatar-image" className="aspect-square h-full w-full object-cover" alt={item.name} src={item.avatarUrl} />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-muted text-lg font-medium">
                {item.name.substring(0, 2).toUpperCase()}
              </div>
            )}
          </div>
          <div data-slot="card" data-size="default" className="group/card gap-6 rounded-xl bg-card py-6 text-sm text-card-foreground shadow-xs ring-1 ring-foreground/10 has-[>img:first-child]:pt-0 data-[size=sm]:gap-4 data-[size=sm]:py-4 *:[img:first-child]:rounded-t-xl *:[img:last-child]:rounded-b-xl overflow-hidden h-full flex flex-col hover:ring-2 hover:ring-primary/20">
            <div data-slot="card-header" className="group/card-header @container/card-header grid auto-rows-min items-start gap-1 rounded-t-xl px-6 group-data-[size=sm]/card:px-4 has-data-[slot=card-action]:grid-cols-[1fr_auto] has-data-[slot=card-description]:grid-rows-[auto_auto] [.border-b]:pb-6 group-data-[size=sm]/card:[.border-b]:pb-4 pb-3 pt-10 sm:pt-6">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 pt-1">
                  <div data-slot="card-title" className="group-data-[size=sm]/card:text-sm text-lg font-semibold leading-tight text-foreground">{item.name}</div>
                  {item.affiliation && (
                    <p className="mt-1 text-xs text-muted-foreground font-medium tracking-wide uppercase">{item.affiliation}</p>
                  )}
                </div>
              </div>
            </div>
            <div data-slot="card-content" className="px-6 group-data-[size=sm]/card:px-4 space-y-4 flex-1 flex flex-col">
              <div className="text-sm leading-relaxed text-muted-foreground"><strong>Topic:</strong> {item.topic}</div>
              {item.domain && item.domain.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {item.domain.map((d: string, idx: number) => (
                    <span key={idx} data-slot="badge" data-variant="outline" className="group/badge inline-flex h-5 w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-4xl border px-2 py-0.5 whitespace-nowrap transition-colors focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&>svg]:pointer-events-none [&>svg]:size-3! border-border text-foreground [a]:hover:bg-muted [a]:hover:text-muted-foreground text-xs font-medium">{d}</span>
                  ))}
                </div>
              )}
              {/* Added a secondary badge space if needed, using the 'type' or something if available. Defaulting to 'Visionary' for demo purposes based on snapshot */}
              <div className="flex flex-wrap gap-1.5 pt-2 border-t border-border/50">
                <span data-slot="badge" data-variant="secondary" className="group/badge inline-flex h-5 w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-4xl border border-transparent px-2 py-0.5 font-medium whitespace-nowrap transition-colors focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&>svg]:pointer-events-none [&>svg]:size-3! bg-secondary text-secondary-foreground [a]:hover:bg-secondary/80 text-xs">Visionary</span>
              </div>
              <div className="mt-auto pt-4 flex items-center justify-between">
                <a href={item.link || '#'} target="_blank" rel="noopener noreferrer" className="text-xs font-semibold text-primary hover:underline">View Research →</a>
                <span className="text-xs text-muted-foreground">{item.dateAdded ? new Date(item.dateAdded).toLocaleDateString() : 'N/A'}</span>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
