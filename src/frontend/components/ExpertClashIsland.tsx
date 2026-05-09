"use client";

import * as React from "react";
import { useState, useEffect } from "react";
import {
  AssistantRuntimeProvider,
  ThreadPrimitive,
  ComposerPrimitive,
  MessagePrimitive,
} from "@assistant-ui/react";
import { useChatRuntime, AssistantChatTransport } from "@assistant-ui/react-ai-sdk";
import {
  Swords,
  Users,
  Zap,
  ShieldAlert,
  ArrowRight,
  ChevronRight,
  UserPlus,
  X,
  Play,
  RotateCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

export function ExpertClashIsland() {
  const [guests, setGuests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selection, setSelection] = useState<any[]>([]);
  const [isDebating, setIsDebating] = useState(false);

  useEffect(() => {
    fetch("/api/guests")
      .then((res) => res.json())
      .then((data: any) => {
        setGuests(data.guests || []);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setLoading(false);
      });
  }, []);

  const toggleSelection = (guest: any) => {
    if (selection.find((g) => g.id === guest.id)) {
      setSelection(selection.filter((g) => g.id !== guest.id));
    } else if (selection.length < 2) {
      setSelection([...selection, guest]);
    }
  };

  const runtime = useChatRuntime({
    transport: new AssistantChatTransport({
      api: "/api/chat/podcast",
      body: {
        guestIds: selection.map((g) => g.id),
        systemPrompt: `You are the Renegade Clash Facilitator. You are staging a hypothetical debate between ${selection.map((g) => g.name).join(" and ")}. 
        Expert 1: ${selection[0]?.name} (${selection[0]?.personaDescription})
        Expert 2: ${selection[1]?.name} (${selection[1]?.personaDescription})
        
        Your goal is to simulate a provocative, high-stakes debate between these two on the intersection of AI, finance, and social justice. Use their backgrounds and expertise to create contrasting viewpoints. Keep the tone sharp, intellectual, and focused on real-world impact.`,
      },
    }),
  });

  const startDebate = () => {
    if (selection.length === 2) {
      setIsDebating(true);
      runtime.thread.append({
        role: "user",
        content: [
          {
            type: "text",
            text: `Start the debate between ${selection[0].name} and ${selection[1].name} regarding the future of AI deregulation and its impact on the racial wealth gap.`,
          },
        ],
      });
    }
  };

  if (loading) {
    return (
      <div className="flex h-[calc(100svh-4rem)] items-center justify-center bg-zinc-950">
        <div className="flex flex-col items-center gap-4">
          <div className="size-10 border-t-2 border-red-600 rounded-full animate-spin"></div>
          <p className="text-xs font-black uppercase tracking-widest text-zinc-500">Recruiting Titans...</p>
        </div>
      </div>
    );
  }

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <div className="flex flex-col h-[calc(100svh-4rem)] bg-zinc-950 overflow-hidden">
        {!isDebating ? (
          <>
            {/*  Selection Screen  */}
            <div className="flex-1 overflow-hidden flex flex-col px-6 py-12 md:px-12 lg:px-24">
            <div className="max-w-7xl mx-auto w-full mb-16 flex flex-col md:flex-row items-end justify-between gap-8">
              <div className="max-w-xl">
                 <h2 className="text-xs font-black uppercase tracking-[0.3em] text-red-600 mb-4 flex items-center gap-2">
                    <Swords className="size-3 fill-red-600" /> Clash of the Titans
                 </h2>
                 <h3 className="text-4xl md:text-7xl font-bold text-white tracking-tight leading-none uppercase italic">
                    Select Your <br />Combatants
                 </h3>
              </div>
              <div className="flex items-center gap-4">
                 <div className="flex -space-x-4">
                    {[0, 1].map((i) => (
                       <div key={i} className={`size-20 rounded-full border-2 ${selection[i] ? 'border-red-600 shadow-[0_0_20px_rgba(220,38,38,0.3)]' : 'border-zinc-800 border-dashed'} bg-zinc-900 flex items-center justify-center relative overflow-hidden transition-all duration-500`}>
                          {selection[i] ? (
                             <img src={selection[i].headshotUrl} alt={selection[i].name} className="size-full object-cover" />
                          ) : (
                             <UserPlus className="size-6 text-zinc-700" />
                          )}
                          {selection[i] && (
                             <button onClick={() => toggleSelection(selection[i])} className="absolute inset-0 bg-red-600/80 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                                <X className="size-6 text-white" />
                             </button>
                          )}
                       </div>
                    ))}
                 </div>
                 <Button 
                   disabled={selection.length < 2}
                   onClick={startDebate}
                   className="h-20 px-10 bg-red-600 hover:bg-red-700 text-white font-black uppercase italic tracking-widest disabled:bg-zinc-900 disabled:text-zinc-700 transition-all shadow-[0_0_30px_rgba(220,38,38,0.2)]"
                 >
                   Initiate Debate <Play className="size-5 ml-4 fill-current" />
                 </Button>
              </div>
            </div>

            <ScrollArea className="flex-1">
               <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 max-w-7xl mx-auto pb-12">
                  {guests.map((guest) => {
                     const isSelected = selection.find((g) => g.id === guest.id);
                     return (
                        <Card 
                          key={guest.id} 
                          onClick={() => toggleSelection(guest)}
                          className={`bg-zinc-900/30 border-2 cursor-pointer transition-all duration-300 rounded-none overflow-hidden h-64 flex flex-col ${isSelected ? 'border-red-600 bg-red-600/5' : 'border-zinc-900 hover:border-zinc-700'}`}
                        >
                           <CardContent className="p-0 flex flex-col h-full">
                              <div className="flex-1 relative overflow-hidden">
                                 {guest.headshotUrl ? (
                                    <img src={guest.headshotUrl} alt={guest.name} className={`size-full object-cover transition-transform duration-700 ${isSelected ? 'scale-110 grayscale-0' : 'grayscale group-hover:grayscale-0'}`} />
                                 ) : (
                                    <div className="size-full flex items-center justify-center bg-zinc-950">
                                       <Users className="size-10 text-zinc-800" />
                                    </div>
                                 )}
                                 <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-transparent to-transparent"></div>
                                 <div className="absolute bottom-4 left-4 right-4">
                                    <h4 className="text-lg font-black text-white uppercase italic leading-none">{guest.name}</h4>
                                    <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest mt-1">{guest.affiliation || "Independent"}</p>
                                 </div>
                              </div>
                              <div className="p-4 bg-zinc-950 flex flex-wrap gap-1">
                                 {guest.domain?.split(',').slice(0, 2).map((d: string) => (
                                    <Badge key={d} className="bg-zinc-900 text-zinc-600 border-zinc-800 text-[8px] uppercase font-bold py-0.5 px-2 rounded-none">{d.trim()}</Badge>
                                 ))}
                              </div>
                           </CardContent>
                        </Card>
                     );
                  })}
               </div>
            </ScrollArea>
          </div>
        </>
      ) : (
          <>
            {/*  Debate Arena  */}
            <div className="flex-1 flex flex-col lg:flex-row overflow-hidden relative">
               {/*  Arena Header (Mobile Only)  */}
             <div className="lg:hidden p-4 bg-zinc-900 border-b border-zinc-800 flex items-center justify-between">
                <div className="flex items-center gap-2">
                   <Swords className="size-4 text-red-500" />
                   <span className="text-xs font-black uppercase tracking-widest text-white">Debate Arena</span>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setIsDebating(false)} className="text-zinc-500"><RotateCcw className="size-4" /></Button>
             </div>

             {/*  Arena Sidebar: Combatants  */}
             <div className="w-full lg:w-96 border-r border-zinc-900 bg-zinc-950 flex flex-col p-8">
                <div className="flex items-center justify-between mb-8">
                   <h4 className="text-xs font-black uppercase tracking-[0.3em] text-red-600">The Arena</h4>
                   <Button variant="ghost" size="icon" onClick={() => setIsDebating(false)} className="text-zinc-800 hover:text-red-500"><RotateCcw className="size-4" /></Button>
                </div>

                <div className="space-y-12">
                   {selection.map((g, i) => (
                      <div key={g.id} className="relative group">
                         <div className={`absolute -inset-4 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity blur-xl ${i === 0 ? 'bg-red-600/10' : 'bg-purple-600/10'}`}></div>
                         <div className="relative flex flex-col gap-4">
                            <div className={`size-24 rounded-full border-2 ${i === 0 ? 'border-red-600 shadow-[0_0_30px_rgba(220,38,38,0.3)]' : 'border-purple-600 shadow-[0_0_30px_rgba(168,85,247,0.3)]'} overflow-hidden shrink-0`}>
                               <img src={g.headshotUrl} alt={g.name} className="size-full object-cover" />
                            </div>
                            <div>
                               <Badge className={`${i === 0 ? 'bg-red-600' : 'bg-purple-600'} text-white uppercase text-[9px] font-bold rounded-none mb-2`}>Expert {i + 1}</Badge>
                               <h5 className="text-xl font-black text-white uppercase italic tracking-tight mb-1">{g.name}</h5>
                               <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">{g.affiliation || "Independent"}</p>
                            </div>
                         </div>
                      </div>
                   ))}
                </div>

                <div className="mt-auto pt-12">
                   <Card className="bg-zinc-900/30 border-zinc-900 rounded-none p-6">
                      <div className="flex items-center gap-2 mb-4 text-red-500">
                         <ShieldAlert className="size-4" />
                         <span className="text-[10px] font-black uppercase tracking-widest">Rules of Engagement</span>
                      </div>
                      <p className="text-xs text-zinc-500 leading-relaxed font-medium">
                         AI generates a hypothetical debate based on known expertise and public records. 
                         Participants are urged to maintain intellectual integrity.
                      </p>
                   </Card>
                </div>
             </div>

             {/*  Arena Chat: The Debate  */}
             <div className="flex-1 flex flex-col bg-zinc-950 relative overflow-hidden">
                {/*  Background Grid  */}
                 <div 
                   className="absolute inset-0 z-0 opacity-[0.03] pointer-events-none" 
                   style={{ 
                     backgroundImage: "linear-gradient(to right, #27272a 1px, transparent 1px), linear-gradient(to bottom, #27272a 1px, transparent 1px)", 
                     backgroundSize: "60px 60px" 
                   }}
                 ></div>

                <ThreadPrimitive.Root className="relative z-10 flex-1 flex flex-col overflow-hidden">
                  <ThreadPrimitive.Viewport className="flex-1 p-6 md:p-12 overflow-auto no-scrollbar">
                    <ThreadPrimitive.Empty>
                       <div className="flex flex-col items-center justify-center h-full text-center">
                          <Zap className="size-12 text-red-500 animate-pulse mb-6" />
                          <p className="text-zinc-500 text-lg font-medium italic">Simulating initial clash...</p>
                       </div>
                    </ThreadPrimitive.Empty>

                    <ThreadPrimitive.Messages
                      components={{
                        Message: () => (
                          <MessagePrimitive.Root className="mb-12 max-w-4xl mx-auto">
                             <div className="flex gap-6">
                                <div className="size-10 rounded-full border border-zinc-800 bg-zinc-900 flex items-center justify-center shrink-0">
                                   <MessagePrimitive.If user>
                                      <Users className="size-5 text-zinc-600" />
                                   </MessagePrimitive.If>
                                   <MessagePrimitive.If assistant>
                                      <Zap className="size-5 text-red-500" />
                                   </MessagePrimitive.If>
                                </div>
                                <div className="flex-1 space-y-6">
                                   <MessagePrimitive.Content />
                                </div>
                             </div>
                          </MessagePrimitive.Root>
                        )
                      }}
                    />
                  </ThreadPrimitive.Viewport>

                  <div className="p-6 md:p-12 pt-0 border-t border-zinc-900/50 bg-zinc-950/80 backdrop-blur-md">
                    <ComposerPrimitive.Root className="max-w-4xl mx-auto relative flex items-center gap-2 bg-zinc-900 border border-zinc-800 p-2 focus-within:border-red-600/50 transition-colors">
                      <ComposerPrimitive.Input
                        placeholder="Intervene in the debate or ask for a closing statement..."
                        className="flex-1 bg-transparent border-none focus:ring-0 text-zinc-200 placeholder:text-zinc-600 py-3 px-4 text-sm"
                      />
                      <ComposerPrimitive.Send className="bg-red-600 hover:bg-red-700 text-white p-3 transition-all active:scale-95 shadow-[0_0_15px_rgba(220,38,38,0.3)]">
                        <ArrowRight className="size-5" />
                      </ComposerPrimitive.Send>
                    </ComposerPrimitive.Root>
                  </div>
                </ThreadPrimitive.Root>
             </div>
          </div>
        </>
      )}
      </div>
    </AssistantRuntimeProvider>
  );
}
