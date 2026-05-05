/**
 * @fileoverview GuestCard Component
 *
 * A minimalist dark-themed card component for displaying podcast guest information.
 * Adheres to "The Monolith" aesthetic with high-end editorial design principles.
 */

import * as React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';

export interface GuestCardProps {
  name: string;
  personaDescription: string;
  domain: string[];
  chemistry: string[];
  headshotUrl?: string;
  affiliation?: string;
}

/**
 * GuestCard displays a podcast guest with their portrait overlapping the card edge
 * following The Monolith aesthetic - minimal, editorial, high-end dark theme
 */
export function GuestCard({
  name,
  personaDescription,
  domain,
  chemistry,
  headshotUrl,
  affiliation,
}: GuestCardProps) {
  // Get initials for fallback avatar
  const initials = name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="relative">
      {/* Avatar positioned to overlap card edge - centered on top-left corner */}
      <Avatar className="absolute -left-8 -top-8 z-10 h-16 w-16 ring-2 ring-background">
        {headshotUrl ? (
          <AvatarImage src={headshotUrl} alt={name} />
        ) : (
          <AvatarFallback className="bg-primary/10 text-primary text-sm font-bold">
            {initials}
          </AvatarFallback>
        )}
      </Avatar>

      {/* Card with The Monolith aesthetic */}
      <Card className="overflow-hidden transition-all hover:ring-2 hover:ring-primary/20">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 pt-1">
              <CardTitle className="text-lg font-semibold leading-tight text-foreground">
                {name}
              </CardTitle>
              {affiliation && (
                <p className="mt-1 text-xs text-muted-foreground font-medium tracking-wide uppercase">
                  {affiliation}
                </p>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Brief bio */}
          <p className="text-sm leading-relaxed text-muted-foreground">
            {personaDescription}
          </p>

          {/* Domain tags */}
          {domain && domain.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {domain.map((tag, index) => (
                <Badge
                  key={`domain-${index}`}
                  variant="outline"
                  className="text-xs font-medium"
                >
                  {tag}
                </Badge>
              ))}
            </div>
          )}

          {/* Chemistry/archetype tags */}
          {chemistry && chemistry.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-2 border-t border-border/50">
              {chemistry.map((tag, index) => (
                <Badge
                  key={`chemistry-${index}`}
                  variant="secondary"
                  className="text-xs"
                >
                  {tag}
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
