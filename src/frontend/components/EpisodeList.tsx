"use client";

import * as React from "react";
import { useState, useEffect, useMemo } from "react";
import { Input } from "./ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardAction } from "./ui/card";
import { Badge } from "./ui/badge";
import { Search, ArrowRight } from "lucide-react";

const RC_LOGO = "https://images.squarespace-cdn.com/content/v1/682230d9918bf67071aafaab/26bed561-51cd-46da-a999-c1c0a599a7fe/RC_Icon.png";

export function EpisodeList() {
  const [episodes, setEpisodes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  useEffect(() => {
    fetch("/api/episodes")
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch episodes");
        return res.json();
      })
      .then((data: any) => {
        setEpisodes(data.episodes || []);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Failed to load episodes:", err);
        setError("Failed to load episode archive.");
        setLoading(false);
      });
  }, []);

  const allUniqueTags = useMemo(() => {
    const tags = new Set<string>();
    episodes.forEach(ep => ep.tags?.forEach((t: string) => tags.add(t)));
    return Array.from(tags).sort();
  }, [episodes]);

  const filteredEpisodes = useMemo(() => {
    let result = episodes;
    if (search) {
      result = result.filter(
        (ep) =>
          ep.title.toLowerCase().includes(search.toLowerCase()) ||
          ep.description.toLowerCase().includes(search.toLowerCase()),
      );
    }
    if (selectedTags.length > 0) {
      result = result.filter(ep => ep.tags?.some((t: string) => selectedTags.includes(t)));
    }
    return result;
  }, [episodes, search, selectedTags]);

  const groupedEpisodes = useMemo(() => {
    const groups: Record<string, any[]> = {};
    filteredEpisodes.forEach(ep => {
      // Group by the first tag, or 'Uncategorized'
      const groupKey = ep.tags && ep.tags.length > 0 ? ep.tags[0] : 'Uncategorized';
      if (!groups[groupKey]) groups[groupKey] = [];
      groups[groupKey].push(ep);
    });
    return groups;
  }, [filteredEpisodes]);

  if (loading) {
    return (
      <div className="py-24 text-center">
        <div className="size-10 border-t-2 border-primary rounded-full animate-spin mx-auto mb-4" />
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">Retrieving Archive...</p>
      </div>
    );
  }

  if (error) {
    return <div className="py-16 text-center text-destructive font-bold uppercase tracking-widest">{error}</div>;
  }

  return (
    <div className="space-y-12">
      {/* Search & Filter Bar */}
      <div className="flex flex-col gap-6">
        <div className="relative w-full max-w-xl">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Search episodes..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        
        {/* Multi-select Tags */}
        {allUniqueTags.length > 0 && (
          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium text-muted-foreground">Filter by Categories:</span>
            <div className="flex flex-wrap gap-2">
              {allUniqueTags.map(tag => (
                <Badge 
                  key={tag} 
                  variant={selectedTags.includes(tag) ? "default" : "outline"}
                  className="cursor-pointer transition-colors"
                  onClick={() => {
                    setSelectedTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag])
                  }}
                >
                  {tag}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Episode Groups Grid */}
      <div className="space-y-16">
        {Object.entries(groupedEpisodes).sort(([a], [b]) => a.localeCompare(b)).map(([groupName, groupEpisodes]) => (
          <div key={groupName} className="space-y-6">
            <h2 className="text-2xl font-bold tracking-tight border-b border-border pb-2">{groupName}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {groupEpisodes.map((episode) => (
                <a key={episode.id} href={`/episodes/${episode.id}`} className="block group">
                  <Card className="relative mx-auto w-full max-w-sm pt-0 h-full overflow-hidden transition-all duration-300 group-hover:border-primary/50 group-hover:shadow-md">
                    <div className="absolute inset-0 z-30 aspect-video bg-black/35 pointer-events-none" />
                    <img
                      src={episode.coverPhotoUrl || RC_LOGO}
                      alt={episode.title}
                      className="relative z-20 aspect-video w-full object-cover brightness-60 grayscale dark:brightness-40 group-hover:brightness-100 group-hover:grayscale-0 transition-all duration-500"
                    />
                    <CardHeader className="relative z-40 bg-card">
                      <CardAction>
                        <Badge variant="secondary">{groupName}</Badge>
                      </CardAction>
                      <CardTitle className="text-xl group-hover:text-primary transition-colors">{episode.title}</CardTitle>
                      <CardDescription className="line-clamp-3 leading-relaxed">
                        {episode.description}
                      </CardDescription>
                    </CardHeader>
                  </Card>
                </a>
              ))}
            </div>
          </div>
        ))}

        {Object.keys(groupedEpisodes).length === 0 && (
          <Card className="border-dashed">
            <CardContent className="py-16 text-center">
              <Search className="mx-auto size-10 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No episodes found matching your criteria.</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
