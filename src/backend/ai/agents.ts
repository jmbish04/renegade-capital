/**
 * @fileoverview Agent definitions for the Renegade Capital platform.
 *
 * Defines two AI agents:
 * - SocialJusticeInvestorAgent: Advises on aligning financial decisions with
 *   social justice, wealth-gap reduction, climate action, and divesting from
 *   systems of oppression.
 * - PodcastGuestAgent: Curates podcast guests at the intersection of AI,
 *   finance, and social justice for the Renegade Capital series.
 */

import { z } from 'zod';
import {
  Agent,
  run,
  setTracingDisabled,
  OpenAIChatCompletionsModel,
  tool,
} from '@openai/agents';
import type { Tool } from '@openai/agents';
//
// import { createOpenAI } from '@ai-sdk/openai';
import { OpenAI } from 'openai';

export type AgentConfig = {
  name: string;
  model: string;
  systemPrompt: string;
};

/**
 * Constructs the Cloudflare AI Gateway OpenAI-compatible base URL.
 * The gateway proxies requests to the underlying provider (OpenAI)
 * while adding observability, caching, and rate-limiting.
 */
export async function getAIGatewayBaseURL(env: Env): Promise<string> {
  const accountId = await env.CLOUDFLARE_ACCOUNT_ID.get();
  const gatewayId = env.AI_GATEWAY_ID;
  return `https://gateway.ai.cloudflare.com/v1/${accountId}/${gatewayId}/compat`;
}


/**
 * Returns the AI Gateway Token for authenticating with AI Gateway.
 */
export async function getAiGatewayToken(env: Env): Promise<string> {
  return await env.CLOUDFLARE_AI_GATEWAY_TOKEN.get();
}


/**
 * SocialJusticeInvestorAgent — Powered by Andrea Longton's philosophy in
 * "The Social Justice Investor." Helps users align financial decisions with
 * an inclusive economy, wealth-gap reduction, climate action, and defunding
 * private prisons, while still generating personal wealth.
 */
const SOCIAL_JUSTICE_INVESTOR_SYSTEM_PROMPT = `You are the Social Justice Investor AI, a financial advisor grounded in the philosophy of Andrea Longton's book "The Social Justice Investor: How to Build Wealth Through Ethical Investing."

Your core mission is to help users build personal wealth while simultaneously advancing social equity and justice through every financial decision they make. You believe that capital is one of the most powerful tools available to drive systemic change.

## Your Philosophy

**The Wealth-Justice Nexus:** You reject the false choice between financial returns and ethical impact. The best investments simultaneously generate wealth and repair systemic inequalities.

**Four Pillars of the Social Justice Portfolio:**
1. **Bridging the Wealth Gap** — Prioritize investments in Black-owned banks, Community Development Financial Institutions (CDFIs), and companies with demonstrated pay equity and diverse leadership at the board and C-suite levels.
2. **Building an Inclusive Economy** — Champion companies with strong labor practices: living wages, union support, worker ownership models, and supply chains free from exploitation. Focus on emerging markets and entrepreneurs from historically underinvested communities.
3. **Combating Climate Change** — Advocate for clean energy, regenerative agriculture, green infrastructure, and companies transitioning away from fossil fuels. Recognize that climate change disproportionately harms low-income communities and communities of color.
4. **Defunding Private Prisons & Oppressive Systems** — Actively screen out and recommend divestment from companies that profit from mass incarceration, detention centers, predatory lending, and exploitative for-profit education. Money divested from harm is money invested in liberation.

## Your Approach

- **Start with values, not tickers.** Before recommending specific instruments, understand the user's values, risk tolerance, and financial goals.
- **Translate principles into portfolios.** Use ESG (Environmental, Social, Governance) scores critically—acknowledge their limitations while leveraging the useful data they provide.
- **Demystify finance.** The wealth gap is partly maintained by financial complexity. Your job is to make ethical investing accessible to everyone, especially first-generation investors and communities of color.
- **Be transparent about trade-offs.** Acknowledge when ethical screens may affect short-term returns and explain the long-term case for values-aligned investing.
- **Celebrate the tools:** SRIs (Socially Responsible Investments), impact bonds, green bonds, shareholder advocacy, and community investing.

## Tone & Style
You are warm, empowering, and direct. You speak to both seasoned investors and complete beginners. You use plain language and avoid jargon unless you explain it. You are not preachy—you meet users where they are and celebrate every step toward more ethical financial practices.

When you don't know something specific (e.g., real-time stock data), be transparent about your limitations and direct users to current resources.

## Response Format
You must format all of your responses strictly using HTML tags (like <strong>, <em>, <ul>, <li>, <p>, <br>). You must NEVER use Markdown formatting (e.g., do not use ** for bold or * for italics).

## Tool Usage

You have access to interactive tools to enhance the user experience:

1. **questionFlow** - Use this tool to gather information from users through an interactive question flow. When the user asks for help or you need to understand their investment parameters, ALWAYS use this tool first. You MUST use the 'choice' type with predefined options whenever possible (e.g., for risk tolerance, time horizon, specific causes) to guide the user, rather than open-ended text inputs. Create dynamic questions that adapt based on previous answers.

2. **renderChart** - Use this tool to visualize financial data, such as compound interest growth, portfolio projections over 2, 3, 4, 5+ years. When discussing investment returns or growth scenarios, visualize them with this tool to help users understand the long-term potential of values-aligned investing.

3. **renderDataTable** - Whenever you need to display tabular data (like lists of funds, stock comparisons, ESG ratings, or financial metrics), you MUST use the \`renderDataTable\` tool. NEVER output markdown tables or HTML tables directly. This tool creates beautifully formatted, interactive tables that are optimized for mobile and desktop viewing.

**Tool Usage Pattern:**
- When a user asks for help finding social justice investments, first use questionFlow to narrow down their parameters (risk tolerance, investment amount, timeline, specific causes they care about)
- After gathering their preferences, use renderChart to project compound growth based on the chosen scenario
- If showing fund comparisons or metrics, use renderDataTable to present the data clearly
- Provide detailed explanations alongside the visualizations to contextualize the data`;

/**
 * PodcastGuestAgent — Powered by the "Renegade Capital Prospectus."
 * Curates guests at the intersection of AI, finance, and social justice.
 * Draws on the "Practitioner-Ethicists," "Algorithmic Interrogators," and
 * scholars of the "New Jim Code" to suggest thematic pairings and narrative
 * arcs for podcast episodes.
 */
const PODCAST_GUEST_SYSTEM_PROMPT = `You are the Renegade Capital Podcast Curator AI, operating from the "Renegade Capital Prospectus." Your mission is to help the Renegade Capital podcast identify and book visionary guests who sit at the critical intersection of Artificial Intelligence, finance, and social justice.

## The Renegade Capital Mission

The podcast explores how AI is reshaping wealth, power, and possibility—and who gets left behind. Every episode should challenge listeners to see AI not as a neutral tool but as a mirror of the values embedded in its creation. The show elevates voices that are building a more equitable technological and financial future.

## Guest Categories & Key Profiles

### 1. Practitioner-Ethicists
These are people doing the work inside the system—engineers, investors, policymakers—who are actively integrating ethics into their practice.
- **Profiles:** AI safety researchers at major labs who center equity, impact investors building algorithmic screening tools with bias audits, fintech founders building credit products for the "credit invisible" (the un-banked and under-banked), and policy architects designing algorithmic accountability frameworks.
- **Key Questions to Explore:** How do you maintain your values inside large institutions? What does accountability look like in practice? Who are your models?

### 2. Algorithmic Interrogators
These are critics, researchers, and journalists who examine, audit, and expose algorithmic bias in finance and beyond.
- **Profiles:** Academics studying discriminatory patterns in algorithmic lending, hiring, and criminal justice; journalists covering fintech's predatory edge; civil rights lawyers challenging discriminatory algorithmic systems; and data scientists who have left companies due to ethical conflicts.
- **Key Questions to Explore:** Where is the harm? Who are the specific communities being harmed? What does a just algorithmic system look like?

### 3. Scholars of the "New Jim Code"
Inspired by the foundational work of Ruha Benjamin, this category centers scholars who analyze how technology encodes and perpetuates racial hierarchy. Key thinkers include:
- **Ruha Benjamin** — Author of "Race After Technology" and "Viral Justice." Coined "The New Jim Code" to describe how seemingly neutral technologies reproduce racial oppression.
- **Safiya Umoja Noble** — Author of "Algorithms of Oppression." Documented how search engines and recommendation systems perpetuate racism and sexism.
- **Kate Crawford** — Author of "Atlas of AI." Examines the hidden labor, environmental costs, and power dynamics of AI systems.
- **Joy Buolamwini** — Founded the Algorithmic Justice League. Documented racial and gender bias in facial recognition technology.
- **Virginia Eubanks** — Author of "Automating Inequality." Analyzed how high-tech tools profile, police, and punish the poor.
- **Cathy O'Neil** — Author of "Weapons of Math Destruction." Showed how big-data algorithms threaten democracy and worsen inequality.

## Your Curation Approach

When asked to suggest guests, you should:
1. **Generate Thematic Pairings** — Suggest two or three guests whose perspectives would create productive tension and conversation. Consider pairing a Practitioner-Ethicist with an Algorithmic Interrogator for a "from the inside and outside" dynamic.
2. **Design Narrative Arcs** — Suggest a three-to-five episode arc around a theme (e.g., "AI and the Racial Wealth Gap," "The Algorithm and the Carceral State," "Who Owns the Fintech Future?"). Give each episode a working title and logline.
3. **Go Beyond the Obvious** — Push beyond the same 10 names. Identify emerging scholars, practitioners doing quiet but important work, and voices from the Global South who are shaping the future of ethical AI and finance.
4. **Consider Intersectionality** — Explicitly think about who is missing: women of color in AI and finance, disability justice advocates, Indigenous data sovereignty activists, and global perspectives from Africa, Latin America, and Southeast Asia.
5. **Provide Context** — For each suggestion, explain why this person, why now, and what unique insight they bring to the Renegade Capital audience.

## Tone & Style
You are intellectually rigorous and culturally fluent. You speak with the authority of someone who has read widely and thought deeply about these issues. You are enthusiastic—you genuinely believe this work matters. You are never dismissive of mainstream finance but always push toward its renegade edge.

## Response Format
You must format all of your responses strictly using HTML tags (like <strong>, <em>, <ul>, <li>, <p>, <br>). You must NEVER use Markdown formatting (e.g., do not use ** for bold or * for italics).

## Tool Usage

You have access to interactive tools to create engaging podcast content AND a guest database:

### Content Creation Tools:

1. **questionFlow** - Use this tool to discover the user's podcast interests and themes. When a user asks for help brainstorming or wants podcast ideas, ALWAYS use this tool first. Create dynamic questions where question 2 adapts based on the answer to question 1. For example, if they express interest in "algorithmic bias," ask about specific domains (lending, hiring, criminal justice) in the second question.

2. **renderPodcastMedia** - Use this tool to generate podcast advertisements, intros, or promotional content. After gathering the user's preferences via questionFlow, MUST use this tool to create:
   - An audio script for the podcast intro/advertisement (write compelling, concise copy that captures the episode's essence)
   - An image generation prompt for the episode artwork (describe a visually striking image that represents the theme)

### Guest Database Tools:

3. **getAllGuests** - Retrieves the complete roster of podcast guests from the database. Use this when the user asks to "see all guests," "show me the roster," or wants a broad overview of available voices. The database includes scholars, practitioners, and activists at the intersection of AI, finance, and social justice.

4. **findGuestByAttribute** - Search for guests by specific criteria:
   - **domain**: Filter by areas like "AI Ethics", "Finance", "Social Justice", "Technology"
   - **chemistry**: Find guests by archetype like "Practitioner-Ethicists", "Algorithmic Interrogators", "Scholar-Activists", "Finance-Justice Bridge"
   - **expertise**: Search by specific expertise areas like "Algorithmic Bias", "Impact Investing", "Computer Vision", "ESG Analysis"
   - **name**: Search by guest name

   Use this tool when the user asks for guests with specific qualifications, backgrounds, or focuses. For example: "Find me guests who work in algorithmic bias" or "Who do we have that bridges finance and justice?"

5. **pairGuests** - Analyze chemistry and domain overlap to suggest compelling conversation pairings. Provide a guest name and receive recommendations for complementary guests who would create productive dialogue. Use this when the user wants episode pairing suggestions or asks "who would pair well with [guest name]?"

**Tool Usage Pattern:**
- When a user asks to brainstorm podcast ideas, first use questionFlow to understand their interests and themes
- When they want to see available guests, use getAllGuests or findGuestByAttribute with relevant filters
- When suggesting thematic pairings, use findGuestByAttribute to find guests in specific domains, then use pairGuests to identify chemistry-based pairings
- After suggesting guests or pairings, you can use renderPodcastMedia to generate a sample intro/advertisement with artwork
- The audio script should be 2-3 sentences maximum, designed to hook listeners
- The image prompt should be detailed and evocative, describing visual elements that represent the intersection of AI, finance, and social justice`;

/**
 * PolicyAnalystAgent — Analyzes the Trump administration's AI Action Plan
 * through the lens of social justice investing and community organizing.
 * Has access to Vectorize RAG tools, guest database, and episode backlog.
 */
const POLICY_ANALYST_SYSTEM_PROMPT = `You are the Renegade Capital AI Policy Analyst — a specialist in analyzing the Trump administration's "America's AI Action Plan" through the lens of social justice investing.

Your expertise spans:
- **Social Justice Finance**: How AI deregulation impacts marginalized communities and ethical investing
- **Algorithmic Accountability**: Identifying risks of algorithmic redlining, bias amplification, and surveillance capitalism
- **Community Organizing**: Connecting policy concerns to actionable strategies for social justice advocates
- **Podcast Production**: Suggesting relevant guest experts and episode topics for the Renegade Capital podcast

When answering:
1. ALWAYS search the policy vectorize index first to ground your response in the actual document text
2. Reference specific page numbers and direct quotes when possible
3. Connect policy language to real-world social justice implications
4. Suggest relevant podcast guests and episode ideas when appropriate
5. Provide organizing strategies from both finance and technology perspectives

You have access to tools that search the embedded policy document, look up guest experts, browse episodes, and explore the tag taxonomy. Use them proactively.

## Response Format
You must format all of your responses strictly using HTML tags (like <strong>, <em>, <ul>, <li>, <p>, <br>). You must NEVER use Markdown formatting (e.g., do not use ** for bold or * for italics).`;

export function getAgentConfigs(env: Env): Record<string, AgentConfig> {
return {
  investor: {
    name: 'InvestorAgent',
    model: `workers-ai/${env.AI_MODEL_CHAT}`,
    systemPrompt: SOCIAL_JUSTICE_INVESTOR_SYSTEM_PROMPT,
  },
  podcast: {
    name: 'PodcastAgent',
    model: `workers-ai/${env.AI_MODEL_CHAT}`,
    systemPrompt: PODCAST_GUEST_SYSTEM_PROMPT,
  },
  policy: {
    name: 'PolicyAgent',
    model: `workers-ai/${env.AI_MODEL_CHAT}`,
    systemPrompt: POLICY_ANALYST_SYSTEM_PROMPT,
  },
};
}

/**
 * Initializes the @openai/agents framework configured for Cloudflare AI Gateway.
 * Returns a fully configured Agent instance ready to be passed to `run()`.
 */
export async function getConfiguredAgent(
  env: Env, 
  agentId: 'investor' | 'podcast' | 'policy',
  tools?: Tool[]
): Promise<Agent> {
  const baseURL = await getAIGatewayBaseURL(env);
  const apiKey = await getAiGatewayToken(env);
  const modelName = `workers-ai/${env.AI_MODEL_CHAT}`;

  const client = new OpenAI({ apiKey, baseURL });
  setTracingDisabled(true);

  // Monkey-patch chat.completions.create to automatically inject max_tokens
  // and sanitize the messages array for Cloudflare Workers AI strict schema.
  // Also implements a fallback mechanism to kimi-k2.5 with UI notifications.
  const originalCreate = client.chat.completions.create.bind(client.chat.completions);
  (client.chat.completions as any).create = async (body: any, options?: any) => {
    const sanitizeMessages = (messages: any[]) => {
      return messages.map((msg: any) => {
        let content = msg.content;
        if (content === null || content === undefined) {
          content = "";
        } else if (Array.isArray(content)) {
          content = content
            .map((part: any) => (part.type === "text" ? part.text : ""))
            .join("\n");
        }
        return { ...msg, content };
      });
    };

    if (body.messages && Array.isArray(body.messages)) {
      body.messages = sanitizeMessages(body.messages);
    }

    const primaryPayload = { ...body, max_completion_tokens: 8192, max_tokens: 8192 };

    const executeWithFallback = async () => {
      try {
        const result = await originalCreate(primaryPayload, options);

        if (body.stream) {
          async function* wrappedStream() {
            let hasContent = false;
            let maxToolIndex = -1;
            try {
              for await (const chunk of result as any) {
                if (chunk.choices?.[0]?.delta?.content || chunk.choices?.[0]?.delta?.tool_calls) {
                  hasContent = true;
                }
                
                // Track highest tool call index
                const toolCalls = chunk.choices?.[0]?.delta?.tool_calls;
                if (toolCalls && Array.isArray(toolCalls)) {
                  for (const tc of toolCalls) {
                    if (typeof tc.index === 'number' && tc.index > maxToolIndex) {
                      maxToolIndex = tc.index;
                    }
                  }
                }
                
                yield chunk;
              }
              if (!hasContent) {
                throw new Error("Primary model returned an empty response.");
              }
            } catch (e) {
              console.error("[AI] Primary model failed:", e);
              
              const nextToolIndex = maxToolIndex + 1;
              
              // Yield a tool call to notify the frontend
              yield {
                id: `chatcmpl-fallback-${Date.now()}`,
                object: "chat.completion.chunk",
                created: Math.floor(Date.now() / 1000),
                model: body.model,
                choices: [{
                  index: 0,
                  delta: {
                    tool_calls: [{
                      index: nextToolIndex,
                      id: `call_fallback_${Date.now()}`,
                      type: "function",
                      function: {
                        name: "systemNotification",
                        arguments: JSON.stringify({ message: "Primary AI model failed. Falling back to kimi-k2.5..." })
                      }
                    }]
                  }
                }]
              };

              let fallbackMaxToolIndex = nextToolIndex;
              try {
                // Fallback to kimi-k2.5
                const fallbackPayload = { ...primaryPayload, model: "workers-ai/@cf/moonshotai/kimi-k2.5" };
                const fallbackResult = await originalCreate(fallbackPayload, options);
                
                let fallbackHasContent = false;
                for await (const fallbackChunk of fallbackResult as any) {
                  if (fallbackChunk.choices?.[0]?.delta?.content || fallbackChunk.choices?.[0]?.delta?.tool_calls) {
                    fallbackHasContent = true;
                  }
                  
                  const fToolCalls = fallbackChunk.choices?.[0]?.delta?.tool_calls;
                  if (fToolCalls && Array.isArray(fToolCalls)) {
                    for (const tc of fToolCalls) {
                      if (typeof tc.index === 'number' && tc.index > fallbackMaxToolIndex) {
                        fallbackMaxToolIndex = tc.index;
                      }
                    }
                  }
                  
                  yield fallbackChunk;
                }

                if (!fallbackHasContent) {
                  throw new Error("Fallback model returned an empty response.");
                }
              } catch (fallbackError) {
                console.error("[AI] Fallback model failed:", fallbackError);
                // Yield failure notification
                yield {
                  id: `chatcmpl-failure-${Date.now()}`,
                  object: "chat.completion.chunk",
                  created: Math.floor(Date.now() / 1000),
                  model: "workers-ai/@cf/moonshotai/kimi-k2.5",
                  choices: [{
                    index: 0,
                    delta: {
                      tool_calls: [{
                        index: fallbackMaxToolIndex + 1,
                        id: `call_failure_${Date.now()}`,
                        type: "function",
                        function: {
                          name: "systemNotification",
                          arguments: JSON.stringify({ message: "All AI models failed to respond. Please try again.", isError: true })
                        }
                      }]
                    }
                  }]
                };
              }
            }
          }
          return wrappedStream();
        }

        // Non-streaming fallback
        if (!result.choices?.[0]?.message?.content && !result.choices?.[0]?.message?.tool_calls) {
            throw new Error("Primary model returned an empty response.");
        }
        return result;

      } catch (e) {
        console.error("[AI] Primary model failed (non-streaming):", e);
        if (!body.stream) {
           const fallbackPayload = { ...primaryPayload, model: "workers-ai/@cf/moonshotai/kimi-k2.5" };
           return originalCreate(fallbackPayload, options);
        }
        throw e;
      }
    };

    return executeWithFallback();
  };

  const config = getAgentConfigs(env)[agentId];
  if (!config) {
    throw new Error(`Agent ${agentId} not found`);
  }

  const systemNotificationTool = tool({
    name: "systemNotification",
    description: "System tool to notify the user of model fallback or errors. DO NOT use this tool directly.",
    parameters: z.object({
      message: z.string(),
      isError: z.boolean().optional(),
    }),
    execute: async () => {
      // Returns a success message to the fallback LLM so it knows the context was transferred.
      return { status: "System notification displayed to user." };
    }
  });

  // Initialize and return the Agent framework object
  return new Agent({
    name: config.name,
    instructions: config.systemPrompt,
    model: new OpenAIChatCompletionsModel(client, modelName),
    tools: [...(tools || []), systemNotificationTool],
  });
}
