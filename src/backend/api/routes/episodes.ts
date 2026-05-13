import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import { drizzle } from 'drizzle-orm/d1';
import { eq, and, sql, isNotNull, ne, asc } from 'drizzle-orm';
import { 
  episodes, episodeTranscriptLines, episodeTagMap, episodeTag, episodeTagType,
  trumpPolicyPageEpisodeMap, trumpPolicyPage, episodeGuestMap, episodeHostMap, guests, podcastAudio, hosts, episodeNotes
} from '../../db/schema';
import type { Bindings } from '../index';

const episodesRouter = new OpenAPIHono<{ Bindings: Bindings }>();

// Quick bypass schema for raw API routes
const BlankSchema = z.any();

/**
 * GET /api/episodes/pending-transcripts
 * Returns episode IDs that are active but have NO active transcript lines.
 */
episodesRouter.get('/pending-transcripts', async (c) => {
  const db = drizzle(c.env.DB);

  // All active episodes
  const allActive = await db.select({ id: episodes.id })
    .from(episodes)
    .where(eq(episodes.isActive, true));

  // Episode IDs that DO have at least one active transcript line
  const withTranscripts = await db.selectDistinct({ episodeId: episodeTranscriptLines.episodeId })
    .from(episodeTranscriptLines)
    .where(eq(episodeTranscriptLines.isActive, true));

  const hasTranscript = new Set(withTranscripts.map(r => r.episodeId));
  const pending = allActive
    .filter(ep => !hasTranscript.has(ep.id))
    .map(ep => ep.id);

  return c.json({ episodes: pending } as any, 200);
});

/**
 * GET /api/episodes/pending-audio
 * Returns episode IDs whose active transcriptId is NOT yet in active podcast_audio.
 */
episodesRouter.get('/pending-audio', async (c) => {
  const db = drizzle(c.env.DB);

  // Get distinct (episodeId, transcriptId) pairs from active transcript lines
  const activeTranscripts = await db
    .selectDistinct({
      episodeId: episodeTranscriptLines.episodeId,
      transcriptId: episodeTranscriptLines.transcriptId,
    })
    .from(episodeTranscriptLines)
    .where(eq(episodeTranscriptLines.isActive, true));

  // Get transcriptIds already in active podcast_audio
  const existingAudio = await db
    .selectDistinct({ transcriptId: podcastAudio.transcriptId })
    .from(podcastAudio)
    .where(eq(podcastAudio.isActive, true));

  const hasAudio = new Set(existingAudio.map(r => r.transcriptId));

  // Episodes whose active transcript doesn't have audio yet
  const pending = activeTranscripts
    .filter(t => t.transcriptId && !hasAudio.has(t.transcriptId))
    .map(t => t.episodeId);

  // Deduplicate
  const uniquePending = [...new Set(pending)];

  return c.json({ episodes: uniquePending } as any, 200);
});
episodesRouter.get('/', async (c) => {
  const db = drizzle(c.env.DB);
  
  // Fetch active episodes
  const activeEpisodes = await db.select().from(episodes).where(eq(episodes.isActive, true));
  
  // Fetch active tag maps
  const activeTagMaps = await db.select().from(episodeTagMap).where(eq(episodeTagMap.isActive, true));
  
  // Fetch active tags
  const activeTags = await db.select().from(episodeTag).where(eq(episodeTag.isActive, true));
  
  // Fetch active guests
  const activeGuestMaps = await db.select({
    episodeId: episodeGuestMap.episodeId,
    guestId: guests.id,
    name: guests.name,
    headshotUrl: guests.headshotUrl,
    isPrimary: episodeGuestMap.isPrimary,
  }).from(episodeGuestMap)
    .innerJoin(guests, eq(episodeGuestMap.guestId, guests.id))
    .where(eq(episodeGuestMap.isActive, true));

  // Fetch active hosts
  const activeHostMaps = await db.select({
    episodeId: episodeHostMap.episodeId,
    hostId: hosts.id,
    name: hosts.name,
    headshotUrl: hosts.headshotUrl,
    isPrimary: episodeHostMap.isPrimary,
  }).from(episodeHostMap)
    .innerJoin(hosts, eq(episodeHostMap.hostId, hosts.id))
    .where(eq(episodeHostMap.isActive, true));
  
  // Create a map from tagId to tag name
  const tagIdToName: Record<number, string> = {};
  activeTags.forEach(t => tagIdToName[t.id] = t.name);
  
  // Map episodeId to array of tag names
  const episodeIdToTags: Record<string, string[]> = {};
  activeTagMaps.forEach(tm => {
    if (!episodeIdToTags[tm.episodeId]) {
      episodeIdToTags[tm.episodeId] = [];
    }
    if (tagIdToName[tm.tagId]) {
      episodeIdToTags[tm.episodeId].push(tagIdToName[tm.tagId]);
    }
  });
  
  const episodeIdToGuests: Record<string, any[]> = {};
  activeGuestMaps.forEach(gm => {
    if (!episodeIdToGuests[gm.episodeId]) episodeIdToGuests[gm.episodeId] = [];
    episodeIdToGuests[gm.episodeId].push(gm);
  });

  const episodeIdToHosts: Record<string, any[]> = {};
  activeHostMaps.forEach(hm => {
    if (!episodeIdToHosts[hm.episodeId]) episodeIdToHosts[hm.episodeId] = [];
    episodeIdToHosts[hm.episodeId].push(hm);
  });
  
  // Attach tags, guests, hosts to episodes
  const result = activeEpisodes.map(ep => ({
    ...ep,
    tags: episodeIdToTags[ep.id] || [],
    guests: episodeIdToGuests[ep.id] || [],
    hosts: episodeIdToHosts[ep.id] || []
  }));
  
  // Sort by created at descending
  result.sort((a, b) => {
    const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return dateB - dateA;
  });

  return c.json({ episodes: result } as any, 200);
});

episodesRouter.get('/:id', async (c) => {
  const db = drizzle(c.env.DB);
  const id = c.req.param('id');
  const ep = await db.select().from(episodes).where(eq(episodes.id, id));
  if (ep.length === 0) return c.json({ error: 'Not found' }, 404);
  
  const tl = await db.select({
    id: episodeTranscriptLines.id,
    episodeId: episodeTranscriptLines.episodeId,
    transcriptId: episodeTranscriptLines.transcriptId,
    lineNumber: episodeTranscriptLines.lineNumber,
    isHost: episodeTranscriptLines.isHost,
    isGuest: episodeTranscriptLines.isGuest,
    hostId: episodeTranscriptLines.hostId,
    guestId: episodeTranscriptLines.guestId,
    transcriptLine: episodeTranscriptLines.transcriptLine,
    cue: episodeTranscriptLines.cue,
    createdAt: episodeTranscriptLines.createdAt,
    isActive: episodeTranscriptLines.isActive,
    guestName: guests.name,
    hostName: hosts.name
  })
  .from(episodeTranscriptLines)
  .leftJoin(guests, eq(episodeTranscriptLines.guestId, guests.id))
  .leftJoin(hosts, eq(episodeTranscriptLines.hostId, hosts.id))
  .where(
    and(
      eq(episodeTranscriptLines.episodeId, id),
      eq(episodeTranscriptLines.isActive, true),
      isNotNull(episodeTranscriptLines.transcriptId),
      ne(episodeTranscriptLines.transcriptId, "")
    )
  )
  .orderBy(asc(episodeTranscriptLines.lineNumber));

  const mappedTl = tl.map(line => {
    let finalSpeakerName = "ERROR";
    if (line.guestName) {
      finalSpeakerName = line.guestName;
    } else if (line.hostName) {
      finalSpeakerName = line.hostName;
    }
    return { ...line, speakerSource: finalSpeakerName };
  });
  
  // Audio
  const pa = await db.select().from(podcastAudio).where(and(eq(podcastAudio.episodeId, id), eq(podcastAudio.isActive, true)));
  
  // mappedPolicies — JOIN with page content so frontend has everything it needs
  const policiesMap = await db.select({
    id: trumpPolicyPageEpisodeMap.id,
    pageId: trumpPolicyPageEpisodeMap.pageId,
    episodeId: trumpPolicyPageEpisodeMap.episodeId,
    source: trumpPolicyPageEpisodeMap.source,
    aiRationale: trumpPolicyPageEpisodeMap.aiRationale,
    pageNum: trumpPolicyPage.pageNum,
    pageContent: trumpPolicyPage.pageContent,
    aiSummary: trumpPolicyPage.aiSummary,
    pageImageUrl: trumpPolicyPage.pageImageUrl,
  })
  .from(trumpPolicyPageEpisodeMap)
  .innerJoin(trumpPolicyPage, eq(trumpPolicyPageEpisodeMap.pageId, trumpPolicyPage.id))
  .where(eq(trumpPolicyPageEpisodeMap.episodeId, id));

  // tags
  const tagsMap = await db.select().from(episodeTagMap).where(eq(episodeTagMap.episodeId, id));
  
  // guests
  const epGuests = await db.select({
    id: guests.id,
    name: guests.name,
    headshotUrl: guests.headshotUrl,
    sex: guests.sex,
    personaDescription: guests.personaDescription,
    expertise: guests.expertise,
    tone: guests.tone,
    background: guests.background,
    chemistry: guests.chemistry,
    domain: guests.domain,
    affiliation: guests.affiliation,
    podcastFitRationale: guests.podcastFitRationale,
    isPrimary: episodeGuestMap.isPrimary,
  })
  .from(episodeGuestMap)
  .innerJoin(guests, eq(episodeGuestMap.guestId, guests.id))
  .where(eq(episodeGuestMap.episodeId, id));

  // hosts
  const epHosts = await db.select({
    id: hosts.id,
    name: hosts.name,
    headshotUrl: hosts.headshotUrl,
    sex: hosts.sex,
    personaDescription: hosts.personaDescription,
    expertise: hosts.expertise,
    tone: hosts.tone,
    background: hosts.background,
    chemistry: hosts.chemistry,
    domain: hosts.domain,
    affiliation: hosts.affiliation,
    podcastFitRationale: hosts.podcastFitRationale,
    isPrimary: episodeHostMap.isPrimary,
  })
  .from(episodeHostMap)
  .innerJoin(hosts, eq(episodeHostMap.hostId, hosts.id))
  .where(eq(episodeHostMap.episodeId, id));

  return c.json({ 
    episode: ep[0],
    transcriptLines: mappedTl,
    podcastAudio: pa,
    mappedPolicies: policiesMap,
    tags: tagsMap,
    guests: epGuests,
    hosts: epHosts
  } as any, 200);
});

episodesRouter.put('/:id/topics', async (c) => {
  const db = drizzle(c.env.DB);
  const id = c.req.param('id');
  const body = await c.req.json();
  await db.update(episodes).set({
    socialJusticeInvestmentTopics: body.socialJusticeInvestmentTopics,
    aiSocialJusticeTopics: body.aiSocialJusticeTopics
  }).where(eq(episodes.id, id)).execute();
  return c.json({ success: true } as any, 200);
});

episodesRouter.post('/:id/sync-tags', async (c) => {
  const db = drizzle(c.env.DB);
  const id = c.req.param('id');
  const body = await c.req.json();
  const tags = body.tags || [];

  // Clear existing mappings
  await db.delete(episodeTagMap).where(eq(episodeTagMap.episodeId, id)).execute();

  for (const tag of tags) {
    if (!tag.tagName || !tag.typeName) continue;
    
    // UPSERT episodeTagType
    let typeRecord = await db.select().from(episodeTagType).where(eq(episodeTagType.name, tag.typeName));
    let typeId: number;
    if (typeRecord.length === 0) {
      const inserted = await db.insert(episodeTagType).values({ name: tag.typeName }).returning();
      typeId = inserted[0].id;
    } else {
      typeId = typeRecord[0].id;
    }

    // UPSERT episodeTag
    let tagRecord = await db.select().from(episodeTag).where(and(eq(episodeTag.name, tag.tagName), eq(episodeTag.typeId, typeId)));
    let tagId: number;
    if (tagRecord.length === 0) {
      const inserted = await db.insert(episodeTag).values({ name: tag.tagName, typeId }).returning();
      tagId = inserted[0].id;
    } else {
      tagId = tagRecord[0].id;
    }

    // Insert Map
    await db.insert(episodeTagMap).values({ episodeId: id, tagId }).execute();
  }
  return c.json({ success: true } as any, 200);
});

episodesRouter.post('/:id/sync-policies', async (c) => {
  const db = drizzle(c.env.DB);
  const id = c.req.param('id');
  const body = await c.req.json();
  const policies = body.policies || [];
  
  for (const policy of policies) {
    await db.insert(trumpPolicyPageEpisodeMap).values({
      episodeId: id,
      pageId: policy.pageId,
      aiRationale: policy.aiRationale,
      isActive: true
    }).execute();
  }
  return c.json({ success: true } as any, 200);
});

episodesRouter.post('/:id/transcript', async (c) => {
  const db = drizzle(c.env.DB);
  const id = c.req.param('id');
  const body = await c.req.json();
  const transcript = body.transcript || [];
  const transcriptId = body.transcriptId || 'default-id';
  
  for (let i = 0; i < transcript.length; i++) {
    await db.insert(episodeTranscriptLines).values({
      episodeId: id,
      transcriptId: transcriptId,
      isHost: transcript[i].isHost ?? false,
      isGuest: transcript[i].isGuest ?? false,
      hostId: transcript[i].hostId || null,
      guestId: transcript[i].guestId || null,
      transcriptLine: transcript[i].text,
      cue: transcript[i].cue,
      lineNumber: i + 1,
      isActive: true
    }).execute();
  }
  return c.json({ success: true } as any, 200);
});

episodesRouter.post('/:id/guests', async (c) => {
  const db = drizzle(c.env.DB);
  const id = c.req.param('id');
  const body = await c.req.json();
  
  await db.delete(episodeGuestMap).where(eq(episodeGuestMap.episodeId, id)).execute();
  
  const primaryGuestIds = body.primaryGuestIds || [];
  const backupGuestIds = body.backupGuestIds || [];

  for (const gId of primaryGuestIds) {
    await db.insert(episodeGuestMap).values({ episodeId: id, guestId: gId, isPrimary: true, isActive: true }).execute();
  }
  for (const gId of backupGuestIds) {
    await db.insert(episodeGuestMap).values({ episodeId: id, guestId: gId, isPrimary: false, isActive: true }).execute();
  }
  
  return c.json({ success: true } as any, 200);
});

episodesRouter.put('/:id/title', async (c) => {
  const db = drizzle(c.env.DB);
  const id = c.req.param('id');
  const body = await c.req.json();
  if (body.title) {
    await db.update(episodes).set({ title: body.title }).where(eq(episodes.id, id)).execute();
  }
  return c.json({ success: true } as any, 200);
});

episodesRouter.post('/:id/artwork', async (c) => {
  const db = drizzle(c.env.DB);
  const id = c.req.param('id');
  const body = await c.req.json();
  
  try {
    const accountId = await c.env.CLOUDFLARE_ACCOUNT_ID.get();
    // Match the working pattern from policy.ts — use AI_GATEWAY_TOKEN (proven to work for CF Images).
    // Fall back to IMAGES_STREAM_TOKEN if available.
    let apiToken: string | null = null;
    try {
      apiToken = await c.env.CLOUDFLARE_IMAGES_STREAM_TOKEN.get();
    } catch { /* secret not provisioned */ }
    if (!apiToken) {
      apiToken = await c.env.CLOUDFLARE_AI_GATEWAY_TOKEN.get();
    }

    // Helper function to decode base64 if needed and upload
    const uploadToCfImages = async (imageRes: unknown, filename: string) => {
      let binaryData: Uint8Array;
      if (typeof imageRes === 'string') {
        const binaryStr = atob(imageRes);
        binaryData = new Uint8Array(binaryStr.length);
        for (let i = 0; i < binaryStr.length; i++) {
          binaryData[i] = binaryStr.charCodeAt(i);
        }
      } else if (imageRes instanceof ArrayBuffer || imageRes instanceof Uint8Array) {
        binaryData = new Uint8Array(imageRes as ArrayBuffer);
      } else if (imageRes instanceof ReadableStream) {
        const streamResp = new Response(imageRes as any);
        binaryData = new Uint8Array(await streamResp.arrayBuffer());
      } else {
        const fallbackBase64 = (imageRes as any)?.image || "";
        const binaryStr = atob(fallbackBase64);
        binaryData = new Uint8Array(binaryStr.length);
        for (let i = 0; i < binaryStr.length; i++) {
          binaryData[i] = binaryStr.charCodeAt(i);
        }
      }

      const blob = new Blob([binaryData.buffer as ArrayBuffer], { type: 'image/png' });
      const cfForm = new FormData();
      cfForm.append("file", blob, filename);

      const resp = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${accountId}/images/v1`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${apiToken}` },
          body: cfForm,
        }
      );

      const result = await resp.json() as any;
      if (!result.success) {
        throw new Error(`CF Images upload failed: ${JSON.stringify(result.errors)}`);
      }
      
      const imageId = result.result.id;
      const variants = result.result.variants as string[];
      // Return the public variant URL or delivery URL
      return variants?.[0] || `https://imagedelivery.net/${accountId}/${imageId}/public`;
    };

    // Generate & Upload Album Artwork
    const albumRes = await c.env.AI.run('@cf/bytedance/stable-diffusion-xl-lightning', {
      prompt: body.albumPrompt || 'Podcast album art, professional, abstract, vibrant colors',
    });
    const artworkUrl = await uploadToCfImages(albumRes, `album-${id}.png`);
    
    // Generate & Upload Cover Photo
    const coverRes = await c.env.AI.run('@cf/bytedance/stable-diffusion-xl-lightning', {
      prompt: body.coverPrompt || 'Podcast hero background cover photo, professional, cinematic',
    });
    const coverPhotoUrl = await uploadToCfImages(coverRes, `cover-${id}.png`);
    
    await db.update(episodes).set({
      artworkUrl,
      coverPhotoUrl
    }).where(eq(episodes.id, id)).execute();
    
    return c.json({ success: true, artworkUrl, coverPhotoUrl } as any, 200);
  } catch (err: any) {
    console.error("Artwork generation failed:", err);
    return c.json({ error: 'Artwork generation failed', details: err.message }, 500);
  }
});

episodesRouter.get('/:id/audio-manifest', async (c) => {
  const db = drizzle(c.env.DB);
  const id = c.req.param('id');
  const transcriptId = c.req.query('transcriptId');
  
  let query = db.select().from(episodeTranscriptLines)
    .where(and(eq(episodeTranscriptLines.episodeId, id), eq(episodeTranscriptLines.isActive, true)));
    
  const tl = await query;
  // If transcriptId is provided, filter them
  const filtered = transcriptId ? tl.filter(l => l.transcriptId === transcriptId) : tl;
  
  return c.json({ manifest: filtered } as any, 200);
});

episodesRouter.put('/:id/audio', async (c) => {
  const db = drizzle(c.env.DB);
  const id = c.req.param('id');
  const transcriptId = c.req.query('transcriptId') || '';
  
  try {
    const arrayBuffer = await c.req.arrayBuffer();
    if (!arrayBuffer || arrayBuffer.byteLength === 0) {
      return c.json({ error: 'Empty audio payload' } as any, 400);
    }
    
    // Generate an R2 key using the podcast-audio prefix
    const r2Key = `podcast-audio/${id}-${Date.now()}.mp3`;
    
    // Upload the audio bytes to R2
    await c.env.R2_TRUMP_POLICY.put(r2Key, arrayBuffer, {
      httpMetadata: { contentType: 'audio/mpeg' }
    });
    
    // Deactivate any existing audio records for this episode to prevent duplicates
    await db.update(podcastAudio)
      .set({ isActive: false })
      .where(and(eq(podcastAudio.episodeId, id), eq(podcastAudio.isActive, true)))
      .execute();

    // Insert the new audio record into the database
    await db.insert(podcastAudio).values({
      episodeId: id,
      transcriptId: transcriptId,
      r2Key: r2Key,
      sizeBytes: arrayBuffer.byteLength,
      isActive: true
    }).execute();
    
    return c.json({ success: true, r2Key } as any, 200);
  } catch (err: any) {
    console.error("Audio upload failed:", err);
    return c.json({ error: 'Audio upload failed', details: err.message }, 500);
  }
});

// ─── Audio Streaming ───────────────────────────────────────────────────────────

/**
 * GET /api/episodes/:id/audio/stream
 * Streams the active podcast audio MP3 from R2.
 */
episodesRouter.get('/:id/audio/stream', async (c) => {
  const db = drizzle(c.env.DB);
  const id = c.req.param('id');

  const transcriptId = c.req.query('transcriptId');

  const conditions = [
    eq(podcastAudio.episodeId, id),
    eq(podcastAudio.isActive, true)
  ];

  if (transcriptId) {
    conditions.push(eq(podcastAudio.transcriptId, transcriptId));
  }

  const audioRecord = await db.select()
    .from(podcastAudio)
    .where(and(...conditions))
    .limit(1);

  if (!audioRecord.length || !audioRecord[0].r2Key) {
    return c.json({ error: 'No audio available for this episode' } as any, 404);
  }

  const r2Object = await c.env.R2_TRUMP_POLICY.get(audioRecord[0].r2Key);
  if (!r2Object) {
    return c.json({ error: 'Audio file not found in storage' } as any, 404);
  }

  const headers = new Headers();
  headers.set('Content-Type', 'audio/mpeg');
  headers.set('Accept-Ranges', 'bytes');
  if (r2Object.size) headers.set('Content-Length', String(r2Object.size));
  headers.set('Cache-Control', 'public, max-age=86400');

  return new Response(r2Object.body as any, { status: 200, headers });
});

// ─── Episode Notes CRUD ────────────────────────────────────────────────────────

/**
 * GET /api/episodes/:id/notes
 * Lists all active notes for an episode.
 */
episodesRouter.get('/:id/notes', async (c) => {
  const db = drizzle(c.env.DB);
  const id = c.req.param('id');
  const allNotes = await db.select()
    .from(episodeNotes)
    .where(and(eq(episodeNotes.episodeId, id), eq(episodeNotes.isActive, true)))
    .orderBy(episodeNotes.createdAt);
  return c.json({ notes: allNotes } as any, 200);
});

/**
 * POST /api/episodes/:id/notes
 * Creates a new note for an episode.
 */
episodesRouter.post('/:id/notes', async (c) => {
  const db = drizzle(c.env.DB);
  const id = c.req.param('id');
  const body = await c.req.json();
  const content = body?.content;
  if (!content || typeof content !== 'string' || !content.trim()) {
    return c.json({ error: 'Note content is required' } as any, 400);
  }
  const result = await db.insert(episodeNotes).values({
    episodeId: id,
    content: content.trim(),
  }).returning({ id: episodeNotes.id });
  return c.json({ success: true, id: result[0].id } as any, 201);
});

/**
 * PUT /api/episodes/:id/notes/:noteId
 * Updates an existing note (creates a new version, deactivates old).
 */
episodesRouter.put('/:id/notes/:noteId', async (c) => {
  const db = drizzle(c.env.DB);
  const noteId = parseInt(c.req.param('noteId'), 10);
  const body = await c.req.json();
  const content = body?.content;
  if (!content || typeof content !== 'string' || !content.trim()) {
    return c.json({ error: 'Note content is required' } as any, 400);
  }
  await db.update(episodeNotes)
    .set({ content: content.trim(), updatedAt: sql`(unixepoch())` })
    .where(eq(episodeNotes.id, noteId));
  return c.json({ success: true } as any, 200);
});

/**
 * DELETE /api/episodes/:id/notes/:noteId
 * Soft-deletes a note by marking it inactive.
 */
episodesRouter.delete('/:id/notes/:noteId', async (c) => {
  const db = drizzle(c.env.DB);
  const noteId = parseInt(c.req.param('noteId'), 10);
  await db.update(episodeNotes)
    .set({ isActive: false })
    .where(eq(episodeNotes.id, noteId));
  return c.json({ success: true } as any, 200);
});

export { episodesRouter };
