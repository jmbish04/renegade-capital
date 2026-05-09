"use client";

import * as React from "react";
import { useState, useEffect } from "react";
import { GuestCard } from "./GuestCard";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Shield, Zap, Sword, ExternalLink } from "lucide-react";

export function GuestList() {
  const [guests, setGuests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [selectedGuest, setSelectedGuest] = useState<any | null>(null);
  const [insight, setInsight] = useState<string>("");
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    fetch("/api/guests")
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch guests");
        return res.json();
      })
      .then((data: any) => {
        setGuests(data.guests || []);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Error loading guests:", err);
        setError("Failed to load guests. Please try again later.");
        setLoading(false);
      });
  }, []);

  const handleGuestClick = (guest: any) => {
    setSelectedGuest(guest);
    setInsight(
      guest.podcastFitRationale ||
        "No AI fit rationale available for this guest yet. Please run the RAG pipeline to generate intelligence insights."
    );
    setDialogOpen(true);
  };

  if (loading) {
    return (
      <div className="py-24 text-center">
         <div className="size-10 border-t-2 border-purple-600 rounded-full animate-spin mx-auto mb-4"></div>
         <p className="text-xs font-bold uppercase tracking-[0.2em] text-zinc-500">Scanning Profiles...</p>
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
    <>
      <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {guests.map((guest: any) => (
          <div key={guest.id} onClick={() => handleGuestClick(guest)}>
            <GuestCard
              name={guest.name}
              personaDescription={guest.personaDescription}
              domain={guest.domain}
              chemistry={guest.chemistry}
              headshotUrl={guest.headshotUrl}
              affiliation={guest.affiliation}
            />
          </div>
        ))}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-3xl bg-zinc-950 border-zinc-900 rounded-none p-0 overflow-hidden outline-none">
          {selectedGuest && (
            <div className="flex flex-col md:flex-row h-full">
               {/*  Left Sidebar: Photo & Stats  */}
               <div className="w-full md:w-72 bg-zinc-900 border-r border-zinc-800 p-8 flex flex-col items-center text-center">
                  <div className="size-32 rounded-full border-2 border-purple-600 p-1 mb-6 shadow-[0_0_30px_rgba(168,85,247,0.2)]">
                     <div className="size-full rounded-full overflow-hidden bg-zinc-800 flex items-center justify-center">
                        {selectedGuest.headshotUrl ? (
                           <img src={selectedGuest.headshotUrl} alt={selectedGuest.name} className="size-full object-cover" />
                        ) : (
                           <Shield className="size-12 text-zinc-700" />
                        )}
                     </div>
                  </div>
                  <h3 className="text-xl font-black text-white uppercase italic tracking-tight mb-1">{selectedGuest.name}</h3>
                  <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.2em] mb-8">{selectedGuest.affiliation || "Independent Advisor"}</p>
                  
                  <div className="w-full space-y-4">
                     <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-zinc-600">
                        <span>Intelligence Score</span>
                        <span className="text-purple-500">98%</span>
                     </div>
                     <div className="h-1 w-full bg-zinc-800 overflow-hidden">
                        <div className="h-full bg-purple-600 w-[98%] shadow-[0_0_10px_rgba(168,85,247,0.5)]"></div>
                     </div>
                  </div>

                  <div className="mt-auto pt-8 w-full">
                     <Button variant="outline" className="w-full border-zinc-800 text-[10px] font-black uppercase tracking-widest h-10 rounded-none group">
                        Source Feed <ExternalLink className="size-3 ml-2 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                     </Button>
                  </div>
               </div>

               {/*  Right Side: Intelligence & Bio  */}
               <div className="flex-1 p-8 md:p-12 space-y-10">
                  <div className="space-y-4">
                     <div className="flex items-center gap-2">
                        <Zap className="size-4 text-red-500 fill-red-500" />
                        <h4 className="text-xs font-black uppercase tracking-[0.3em] text-red-500">AI Match Intelligence</h4>
                     </div>
                     <p className="text-lg text-zinc-200 font-medium leading-relaxed italic">
                        "{insight}"
                     </p>
                  </div>

                  <div className="space-y-4">
                     <div className="flex items-center gap-2">
                        <Sword className="size-4 text-zinc-600" />
                        <h4 className="text-xs font-black uppercase tracking-[0.3em] text-zinc-600">Persona Description</h4>
                     </div>
                     <p className="text-sm text-zinc-400 leading-relaxed font-medium">
                        {selectedGuest.personaDescription}
                     </p>
                  </div>

                  <div className="flex flex-wrap gap-2 pt-6">
                     {selectedGuest.domain?.split(',').map((domain: string) => (
                        <Badge key={domain} className="bg-zinc-900 text-zinc-500 border-zinc-800 rounded-none uppercase text-[9px] font-bold tracking-widest py-1 px-3">
                           {domain.trim()}
                        </Badge>
                     ))}
                  </div>
               </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
