import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import { drizzle } from 'drizzle-orm/d1';
import { eq, and } from 'drizzle-orm';
import { 
  episodes, episodeTranscriptLines, episodeTagMap, episodeTag,
  trumpPolicyPageEpisodeMap, trumpPolicyPage, episodeGuestMap, guests, podcastAudio
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
episodesRouter.get('/:id', async (c) => {
  const db = drizzle(c.env.DB);
  const id = c.req.param('id');
  const ep = await db.select().from(episodes).where(eq(episodes.id, id));
  if (ep.length === 0) return c.json({ error: 'Not found' }, 404);
  
  const tl = await db.select().from(episodeTranscriptLines).where(eq(episodeTranscriptLines.episodeId, id));
  
  // Audio
  const pa = await db.select().from(podcastAudio).where(eq(podcastAudio.episodeId, id));
  
  // mappedPolicies
  const policiesMap = await db.select().from(trumpPolicyPageEpisodeMap).where(eq(trumpPolicyPageEpisodeMap.episodeId, id));
  const policyPages = policiesMap.length ? await db.select().from(trumpPolicyPage) : []; // simplification

  // tags
  const tagsMap = await db.select().from(episodeTagMap).where(eq(episodeTagMap.episodeId, id));
  
  return c.json({ 
    episode: ep[0],
    transcriptLines: tl,
    podcastAudio: pa,
    mappedPolicies: policiesMap,
    tags: tagsMap
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
      speakerSource: transcript[i].speaker,
      transcriptLine: transcript[i].text,
      cue: transcript[i].cue,
      lineNumber: i + 1,
      isActive: true
    }).execute();
  }
  return c.json({ success: true } as any, 200);
});

episodesRouter.post('/:id/guests', async (c) => {
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

    // Helper function to upload to CF Images
    const uploadToCfImages = async (imageBytes: Uint8Array, filename: string) => {
      const blob = new Blob([new Uint8Array(imageBytes)], { type: 'image/png' });
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
    const albumRes = await c.env.AI.run('@cf/stabilityai/stable-diffusion-xl-base-1.0', {
      prompt: body.albumPrompt || 'Podcast album art, professional, abstract, vibrant colors',
    }) as unknown as Uint8Array;
    const artworkUrl = await uploadToCfImages(albumRes, `album-${id}.png`);
    
    // Generate & Upload Cover Photo
    const coverRes = await c.env.AI.run('@cf/stabilityai/stable-diffusion-xl-base-1.0', {
      prompt: body.coverPrompt || 'Podcast hero background cover photo, professional, cinematic',
    }) as unknown as Uint8Array;
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
  return c.json({ success: true } as any, 200);
});

export { episodesRouter };
