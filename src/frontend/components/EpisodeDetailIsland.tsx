"use client";

import * as React from "react";
import { useState, useEffect, useCallback, useMemo } from "react";
import {
  AssistantRuntimeProvider,
  ThreadPrimitive,
  ComposerPrimitive,
  MessagePrimitive,
} from "@assistant-ui/react";
import { useChatRuntime, AssistantChatTransport } from "@assistant-ui/react-ai-sdk";
import {
  Mic,
  FileText,
  Shield,
  StickyNote,
  ChevronRight,
  Plus,
  Pencil,
  Trash2,
  Terminal,
  Users,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { teamMembers } from "@/components/TeamCarousel";

const RC_LOGO =
  "https://images.squarespace-cdn.com/content/v1/682230d9918bf67071aafaab/26bed561-51cd-46da-a999-c1c0a599a7fe/RC_Icon.png";

/**
 * Lightweight markdown-to-JSX renderer for transcript lines.
 * Handles **bold**, *italic*, `code`, and line breaks.
 */
function renderMarkdown(text: string): React.ReactNode {
  if (!text) return null;
  // Split into segments using a regex that captures bold, italic, and code
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i} className="font-semibold">{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith('*') && part.endsWith('*')) {
      return <em key={i}>{part.slice(1, -1)}</em>;
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return <code key={i} className="px-1 py-0.5 bg-muted rounded text-xs font-mono">{part.slice(1, -1)}</code>;
    }
    return part;
  });
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface EpisodeNote {
  id: number;
  episodeId: string;
  content: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface Guest {
  id: string;
  name: string;
  personaDescription: string;
  expertise: string;
  tone: string;
  background: string;
  chemistry: string;
  domain: string;
  headshotUrl?: string;
  affiliation?: string;
}

// ─── Guest Profile Dialog ─────────────────────────────────────────────────────

function GuestProfileDialog({ guest }: { guest: Guest }) {
  const expertise = safeParseJSON(guest.expertise);
  const domain = safeParseJSON(guest.domain);
  const chemistry = safeParseJSON(guest.chemistry);

  return (
    <Dialog>
      <DialogTrigger
        render={
          <button className="flex items-center gap-3 w-full text-left rounded-md p-2 hover:bg-accent transition-colors">
            <Avatar>
              <AvatarImage src={guest.headshotUrl || undefined} alt={guest.name} />
              <AvatarFallback>{guest.name.charAt(0)}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">{guest.name}</p>
              {guest.affiliation && (
                <p className="text-xs text-muted-foreground truncate">{guest.affiliation}</p>
              )}
            </div>
          </button>
        }
      />
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-4">
            <Avatar className="size-16">
              <AvatarImage src={guest.headshotUrl || undefined} alt={guest.name} />
              <AvatarFallback className="text-xl">{guest.name.charAt(0)}</AvatarFallback>
            </Avatar>
            <div>
              <DialogTitle>{guest.name}</DialogTitle>
              {guest.affiliation && (
                <DialogDescription>{guest.affiliation}</DialogDescription>
              )}
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Background</p>
            <p className="text-sm text-foreground leading-relaxed">{guest.background}</p>
          </div>

          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Persona</p>
            <p className="text-sm text-muted-foreground leading-relaxed">{guest.personaDescription}</p>
          </div>

          <Separator />

          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Expertise</p>
            <div className="flex flex-wrap gap-1.5">
              {expertise.map((e: string) => (
                <Badge key={e} variant="secondary">{e}</Badge>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Domain</p>
            <div className="flex flex-wrap gap-1.5">
              {domain.map((d: string) => (
                <Badge key={d} variant="outline">{d}</Badge>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Chemistry</p>
            <div className="flex flex-wrap gap-1.5">
              {chemistry.map((c: string) => (
                <Badge key={c}>{c}</Badge>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Tone</p>
            <p className="text-sm text-foreground">{guest.tone}</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Notes CRUD Tab ───────────────────────────────────────────────────────────

function NotesTab({ episodeId }: { episodeId: string }) {
  const [notes, setNotes] = useState<EpisodeNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingNote, setEditingNote] = useState<EpisodeNote | null>(null);
  const [noteContent, setNoteContent] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchNotes = useCallback(async () => {
    try {
      const res = await fetch(`/api/episodes/${episodeId}/notes`);
      const data: any = await res.json();
      setNotes(data.notes || []);
    } catch (err) {
      console.error("Failed to fetch notes:", err);
    } finally {
      setLoading(false);
    }
  }, [episodeId]);

  useEffect(() => {
    fetchNotes();
  }, [fetchNotes]);

  const handleSave = async () => {
    if (!noteContent.trim()) return;
    setSaving(true);
    try {
      if (editingNote) {
        await fetch(`/api/episodes/${episodeId}/notes/${editingNote.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: noteContent }),
        });
      } else {
        await fetch(`/api/episodes/${episodeId}/notes`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: noteContent }),
        });
      }
      setDialogOpen(false);
      setEditingNote(null);
      setNoteContent("");
      await fetchNotes();
    } catch (err) {
      console.error("Failed to save note:", err);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (noteId: number) => {
    try {
      await fetch(`/api/episodes/${episodeId}/notes/${noteId}`, { method: "DELETE" });
      await fetchNotes();
    } catch (err) {
      console.error("Failed to delete note:", err);
    }
  };

  const openCreateDialog = () => {
    setEditingNote(null);
    setNoteContent("");
    setDialogOpen(true);
  };

  const openEditDialog = (note: EpisodeNote) => {
    setEditingNote(note);
    setNoteContent(note.content);
    setDialogOpen(true);
  };

  return (
    <div className="space-y-6 p-6">
      {/* Info Alert */}
      <Alert>
        <Terminal className="size-4" />
        <AlertTitle>Intelligence Notes</AlertTitle>
        <AlertDescription>
          Intelligence Agents can autonomously generate and modify notes based on the transcript. You can also add manual notes below.
        </AlertDescription>
      </Alert>

      {/* Create Button + Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <Button onClick={openCreateDialog}>
          <Plus className="size-4 mr-2" />
          New Note
        </Button>

        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingNote ? "Edit Note" : "Create Note"}</DialogTitle>
            <DialogDescription>
              {editingNote
                ? "Update this intelligence note. The previous version will be archived."
                : "Add a new intelligence note for this episode."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <Textarea
              placeholder="Write your intelligence note..."
              value={noteContent}
              onChange={(e) => setNoteContent(e.target.value)}
              rows={6}
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving || !noteContent.trim()}>
              {saving ? "Saving..." : editingNote ? "Update Note" : "Save Note"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Notes List */}
      {loading ? (
        <div className="py-8 text-center text-muted-foreground text-sm">Loading notes...</div>
      ) : notes.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <StickyNote className="mx-auto size-8 text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground">No intelligence notes yet. Create one above.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {notes.map((note) => (
            <Card key={note.id}>
              <CardContent className="p-4 flex items-start gap-4">
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-foreground whitespace-pre-wrap">{note.content}</p>
                  <p className="text-xs text-muted-foreground mt-2">
                    {new Date(note.createdAt).toLocaleString()}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {/* Edit */}
                  <Button variant="ghost" size="icon" onClick={() => openEditDialog(note)}>
                    <Pencil className="size-4" />
                  </Button>

                  {/* Delete with AlertDialog confirmation */}
                  <AlertDialog>
                    <AlertDialogTrigger
                      render={
                        <Button variant="ghost" size="icon">
                          <Trash2 className="size-4" />
                        </Button>
                      }
                    />
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete Intelligence Note</AlertDialogTitle>
                        <AlertDialogDescription>
                          Are you sure you want to delete this intelligence note? This action cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => handleDelete(note.id)}>
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function EpisodeDetailIsland() {
  const [episodeId, setEpisodeId] = useState<string | null>(null);
  const [episodeData, setEpisodeData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const parts = window.location.pathname.split("/");
      const id = parts[parts.length - 1];
      if (id && id !== "episodes") {
        setEpisodeId(id);
      } else {
        setError("Invalid episode ID");
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    if (!episodeId) return;

    fetch(`/api/episodes/${episodeId}`)
      .then((res) => {
        if (!res.ok) throw new Error("Episode not found");
        return res.json();
      })
      .then((data: any) => {
        setEpisodeData(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setError("Failed to load episode.");
        setLoading(false);
      });
  }, [episodeId]);

  const transcriptText = useMemo(() => {
    if (!episodeData?.transcript) return "";
    return episodeData.transcript.map((line: any) => {
      let speaker = line.speakerSource || "Speaker";
      if (line.isHost && line.hostId) {
        const h = episodeData.hosts?.find((h: any) => h.id === line.hostId);
        if (h) speaker = h.name;
      } else if (line.isGuest && line.guestId) {
        const g = episodeData.guests?.find((g: any) => g.id === line.guestId);
        if (g) speaker = g.name;
      }
      return `[${line.timestampStart || ''}] ${speaker}: ${line.transcriptLine}`;
    }).join('\n');
  }, [episodeData]);

  const runtime = useChatRuntime({
    transport: new AssistantChatTransport({
      api: "/api/chat/podcast",
      body: {
        episodeId: episodeId,
        system: episodeData?.episode
          ? `You are the Renegade Podcast Auditor for Episode "${episodeData.episode.title}". You help users understand this specific episode — its transcript, guests, policy connections, and strategic implications. The episode ID is ${episodeId}.

## EPISODE METADATA
Title: ${episodeData.episode.title}
Description: ${episodeData.episode.description || 'N/A'}
Status: ${episodeData.episode.status}

## HOSTS
${(episodeData.hosts || []).map((h: any) => `- ${h.name} - ${h.role}`).join('\n')}

## GUESTS
${(episodeData.guests || []).map((g: any) => `- ${g.name} (${g.affiliation || 'No affiliation'}) - ${g.personaDescription}`).join('\n')}

## TAGS
${(episodeData.tags || []).map((t: any) => `- ${t.tag?.name || 'Unknown Tag'}`).join('\n')}

## EPISODE NOTES
${(episodeData.notes || []).map((n: any) => `- [${n.timestamp}] ${n.noteText}`).join('\n')}

## FULL TRANSCRIPT
${transcriptText}

Format responses in Markdown. Use **bold**, *italics*, lists, and headings for structure. Never use raw HTML tags.`
          : "You are the Renegade Podcast Auditor. You help users understand podcast episodes — transcripts, guests, policy connections, and strategic implications. Format responses in Markdown. Use **bold**, *italics*, lists, and headings for structure. Never use raw HTML tags.",
      },
    }),
  });

  // Loading state
  if (loading) {
    return (
      <div className="flex h-[calc(100svh-4rem)] items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="size-10 rounded-full border-t-2 border-primary animate-spin" />
          <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Loading Episode...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !episodeData?.episode) {
    return (
      <div className="flex h-[calc(100svh-4rem)] items-center justify-center p-6">
        <Card className="max-w-md w-full text-center p-8">
          <h2 className="text-xl font-bold text-destructive mb-4">Episode Not Found</h2>
          <p className="text-muted-foreground mb-6">{error || "The requested episode could not be loaded."}</p>
          <Button variant="outline" render={<a href="/episodes" />}>
            Return to Archive
          </Button>
        </Card>
      </div>
    );
  }

  const { episode, guests = [], notes = [] } = episodeData;
  const parsedGuests: Guest[] = guests.map((g: any) => ({
    ...g,
    expertise: typeof g.expertise === "string" ? g.expertise : JSON.stringify(g.expertise),
    chemistry: typeof g.chemistry === "string" ? g.chemistry : JSON.stringify(g.chemistry),
    domain: typeof g.domain === "string" ? g.domain : JSON.stringify(g.domain),
  }));

  // Find host images
  const hostImages: Record<string, string> = {
    "andrea": teamMembers[0].image,
    "andrea longton": teamMembers[0].image,
    "ebony": teamMembers[1].image,
    "leah": teamMembers[2].image,
    "host": teamMembers[0].image, // default to Andrea
  };

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <div className="flex flex-col w-full relative">
        <div className="flex flex-col lg:flex-row min-h-[calc(100svh-var(--header-height))] w-full relative z-10">
          {/* ─── Left Column: Sticky Metadata ──────────────────────────── */}
          <aside className="lg:w-[360px] lg:shrink-0 border-b lg:border-b-0 lg:border-r border-border lg:sticky lg:top-[var(--header-height)] lg:h-[calc(100svh-var(--header-height))] lg:overflow-y-auto bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="p-6 space-y-6">
              {/* Artwork + Title */}
              <div className="flex flex-col items-center text-center gap-4">
                <img
                  src={episode.artworkUrl || RC_LOGO}
                  alt={episode.title}
                  className="size-40 lg:size-48 rounded-xl object-cover border-4 border-background shadow-lg"
                />
                <div>
                  <Badge variant="secondary" className="mb-2">
                    Episode #{episode.id.slice(0, 6)}
                  </Badge>
                  <h1 className="text-xl font-bold text-foreground leading-tight">
                    {episode.title}
                  </h1>
                </div>
              </div>

              <Separator />

            {/* Audio Player */}
            <div className="space-y-2">
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Audio</p>
              <audio
                controls
                className="w-full h-10 rounded-md"
                src={`/api/episodes/${episode.id}/audio/stream${
                  episodeData.transcriptLines?.[0]?.transcriptId
                    ? `?transcriptId=${episodeData.transcriptLines[0].transcriptId}`
                    : ''
                }`}
              >
                Your browser does not support audio playback.
              </audio>
            </div>

            <Separator />

            {/* Description */}
            <div className="space-y-2">
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Summary</p>
              <p className="text-sm text-muted-foreground leading-relaxed">{episode.description}</p>
            </div>

            <Separator />

            {/* Host Avatar & Bio */}
            {(() => {
              // Deduce host from transcript if possible
              let activeHost = teamMembers[0]; // Default to Andrea Longton
              if (episodeData.transcriptLines && episodeData.transcriptLines.length > 0) {
                const hostLine = episodeData.transcriptLines.find((l: any) => l.isHost);
                if (hostLine && hostLine.hostName) {
                  const found = teamMembers.find(tm => 
                    tm.name.toLowerCase().includes(hostLine.hostName.toLowerCase()) ||
                    hostLine.hostName.toLowerCase().includes(tm.name.toLowerCase().split(' ')[0])
                  );
                  if (found) activeHost = found;
                }
              }

              return (
                <div className="space-y-3">
                  <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Hosted By
                  </p>
                  <div className="flex items-start gap-4">
                    <Avatar className="size-14 border border-border">
                      <AvatarImage src={activeHost.image} alt={activeHost.name} />
                      <AvatarFallback>{activeHost.name.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col gap-1">
                      <p className="text-sm font-bold text-foreground">{activeHost.name}</p>
                      <p className="text-xs font-medium text-muted-foreground uppercase">{activeHost.role}</p>
                      <p className="text-xs text-muted-foreground leading-relaxed mt-1">
                        {activeHost.bio}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })()}

            <Separator />

            {/* Guests — clicking opens Dialog */}
            <div className="space-y-2">
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Guests ({parsedGuests.length})
              </p>
              {parsedGuests.length > 0 ? (
                <div className="space-y-1">
                  {parsedGuests.map((guest) => (
                    <GuestProfileDialog key={guest.id} guest={guest} />
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No guests assigned yet.</p>
              )}
            </div>
          </div>
        </aside>

        {/* ─── Right Column: Content Tabs ─────────────────────────────── */}
        <main className="flex-1 flex flex-col min-w-0">
          <Tabs defaultValue="transcript" className="flex-1 flex flex-col min-w-0">
            <div className="border-b border-border px-6 w-full overflow-x-auto scrollbar-hide">
              <TabsList className="h-12 bg-transparent justify-start gap-4 min-w-max">
                <TabsTrigger value="transcript" className="gap-2">
                  <FileText className="size-4" />
                  Transcript
                </TabsTrigger>
                <TabsTrigger value="policy" className="gap-2">
                  <Shield className="size-4" />
                  Policy Align
                </TabsTrigger>
                <TabsTrigger value="notes" className="gap-2">
                  <StickyNote className="size-4" />
                  Intelligence Notes
                </TabsTrigger>
                <TabsTrigger value="auditor" className="gap-2">
                  <Mic className="size-4" />
                  Podcast Auditor
                </TabsTrigger>
              </TabsList>
            </div>

            {/* Tab: Transcript */}
            <TabsContent value="transcript" className="flex-1 m-0">
              <ScrollArea className="h-[calc(100svh-var(--header-height)-3rem)]">
                {episodeData.transcriptLines && episodeData.transcriptLines.length > 0 ? (
                  <div className="max-w-3xl mx-auto p-6 space-y-8">
                    {episodeData.transcriptLines.map((line: any) => {
                      const speakerGuest = parsedGuests.find((g: any) => g.id === line.guestId);
                      const isHost = line.isHost;
                      const speakerName = isHost ? (line.hostName || 'Host') : (line.guestName || (speakerGuest ? speakerGuest.name : 'Unknown'));
                      const hostImage = isHost ? (hostImages[speakerName.toLowerCase()] || hostImages["host"]) : undefined;

                      return (
                        <div key={line.id} className={`flex gap-4 ${isHost ? '' : 'flex-row-reverse'}`}>
                          <Avatar className="size-10 shrink-0">
                            <AvatarImage src={isHost ? hostImage : (speakerGuest?.headshotUrl || undefined)} />
                            <AvatarFallback>{isHost ? 'RC' : speakerName.charAt(0) || 'G'}</AvatarFallback>
                          </Avatar>
                          <div className={`flex flex-col gap-1 ${isHost ? 'items-start' : 'items-end'}`}>
                            <div className="flex items-center gap-2">
                               <span className="text-sm font-bold text-foreground">{speakerName}</span>
                               {line.cue && <span className="text-xs text-muted-foreground">{line.cue}</span>}
                            </div>
                            <div className={`p-4 rounded-xl max-w-2xl text-sm leading-relaxed ${isHost ? 'bg-muted text-foreground rounded-tl-sm' : 'bg-primary/10 text-foreground border border-primary/20 rounded-tr-sm'}`}>
                              {renderMarkdown(line.transcriptLine)}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <div className="max-w-3xl mx-auto p-6 space-y-6">
                    <Card className="border-dashed">
                      <CardContent className="py-16 text-center">
                        <Mic className="mx-auto size-10 text-muted-foreground mb-4" />
                        <p className="font-semibold text-foreground mb-2">Transcript Pending</p>
                        <p className="text-sm text-muted-foreground">
                          This episode's transcript has not been ingested yet. Once available, it will appear here with speaker labels and timestamps.
                        </p>
                      </CardContent>
                    </Card>
                  </div>
                )}
              </ScrollArea>
            </TabsContent>

            {/* Tab: Policy War Room */}
            <TabsContent value="policy" className="flex-1 m-0">
              <ScrollArea className="h-[calc(100svh-var(--header-height)-3rem)]">
                <div className="max-w-3xl mx-auto p-6 space-y-6">
                  {episodeData?.mappedPolicies && episodeData.mappedPolicies.length > 0 ? (
                    episodeData.mappedPolicies.map((policy: any, idx: number) => (
                      <Card key={idx} className="border border-border/50 shadow-md">
                        <CardHeader className="bg-card">
                          <CardTitle className="text-xl flex items-center gap-2">
                            <Shield className="size-5 text-primary" />
                            America's AI Action Plan — Page {policy.pageNum}
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="p-6 space-y-4">
                          <div className="bg-primary/5 p-4 rounded-lg border border-primary/10">
                            <h4 className="font-bold text-primary mb-2">AI Policy Rationale</h4>
                            <p className="text-sm text-foreground/90 leading-relaxed italic">
                              {policy.aiRationale || "No rationale provided."}
                            </p>
                          </div>
                          <div>
                            <h4 className="font-bold text-muted-foreground text-sm uppercase tracking-wider mb-2">Policy Preview (First 500 words)</h4>
                            <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
                              {policy.pageContent ? policy.pageContent.split(' ').slice(0, 500).join(' ') + (policy.pageContent.split(' ').length > 500 ? '...' : '') : "No content available."}
                            </p>
                          </div>
                        </CardContent>
                      </Card>
                    ))
                  ) : (
                    <Card className="border-dashed">
                      <CardContent className="py-16 text-center">
                        <Shield className="mx-auto size-10 text-muted-foreground mb-4" />
                        <h3 className="text-xl font-bold text-foreground">Policy War Room</h3>
                        <p className="text-muted-foreground mt-2">
                          No Trump AI policies mapped to this episode yet.
                        </p>
                      </CardContent>
                    </Card>
                  )}
                </div>
              </ScrollArea>
            </TabsContent>

            {/* Tab: Intelligence Notes (CRUD) */}
            <TabsContent value="notes" className="flex-1 m-0">
              <ScrollArea className="h-[calc(100svh-var(--header-height)-3rem)]">
                <div className="max-w-3xl mx-auto">
                  {episodeId && <NotesTab episodeId={episodeId} />}
                </div>
              </ScrollArea>
            </TabsContent>

            {/* Tab: Podcast Auditor (AI Chat) */}
            <TabsContent value="auditor" className="flex-1 m-0 flex flex-col">
              <ThreadPrimitive.Root className="flex-1 flex flex-col relative">
                <ThreadPrimitive.Viewport className="flex-1 p-6 overflow-auto">
                  <ThreadPrimitive.Empty>
                    <div className="flex flex-col items-center justify-center h-full max-w-md mx-auto text-center gap-4">
                      <div className="flex size-16 items-center justify-center rounded-2xl bg-primary/10 border border-primary/10">
                        <Mic className="size-8 text-primary" />
                      </div>
                      <h3 className="text-lg font-bold text-foreground">Podcast Auditor</h3>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        Ask me questions about <span className="font-medium text-foreground">"{episode.title}"</span> — extract insights, summarize debates, or link transcript claims to policy threats.
                      </p>
                      <div className="flex flex-wrap justify-center gap-2 mt-2">
                        {[
                          `Summarize the key arguments in "${episode.title.slice(0, 30)}…"`,
                          "What policy threats are discussed in this episode?",
                          "Who are the guests and what are their positions?",
                        ].map((prompt) => (
                          <ThreadPrimitive.Suggestion
                            key={prompt}
                            prompt={prompt}
                            method="replace"
                            autoSend
                            asChild
                          >
                            <button
                              type="button"
                              className="rounded-full border border-border bg-muted/40 px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-primary/10 hover:border-primary/30 hover:text-foreground"
                            >
                              {prompt}
                            </button>
                          </ThreadPrimitive.Suggestion>
                        ))}
                      </div>
                    </div>
                  </ThreadPrimitive.Empty>

                  <ThreadPrimitive.Messages
                    components={{
                      Message: () => (
                        <MessagePrimitive.Root className="mb-6 max-w-3xl mx-auto">
                          <MessagePrimitive.Content />
                        </MessagePrimitive.Root>
                      ),
                    }}
                  />
                </ThreadPrimitive.Viewport>

                <div className="p-4 border-t border-border">
                  <ComposerPrimitive.Root className="max-w-3xl mx-auto flex items-center gap-2">
                    <ComposerPrimitive.Input
                      placeholder="Ask the Auditor about this episode..."
                      className="flex-1 bg-transparent border border-border rounded-md py-2 px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                    />
                    <ComposerPrimitive.Send asChild>
                      <Button size="icon">
                        <ChevronRight className="size-4" />
                      </Button>
                    </ComposerPrimitive.Send>
                  </ComposerPrimitive.Root>
                </div>
              </ThreadPrimitive.Root>
            </TabsContent>
          </Tabs>
        </main>
      </div>
      </div>
    </AssistantRuntimeProvider>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function safeParseJSON(val: string): string[] {
  try {
    const parsed = JSON.parse(val);
    return Array.isArray(parsed) ? parsed : [val];
  } catch {
    return val ? [val] : [];
  }
}
