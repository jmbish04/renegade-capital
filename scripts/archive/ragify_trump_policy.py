#!/usr/bin/env python3
"""
ragify_trump_policy.py — RAG Pipeline for America's AI Action Plan

Orchestrates the complete ingestion of the Trump administration's AI Action Plan
PDF into the Renegade Capital infrastructure:

  1. PDF → per-page text extraction via PyPDF2
  2. Text → Markdown conversion via markitdown
  3. Per-page single-PDF extraction → R2 upload via Worker API
  4. Text → BGE-large-en-v1.5 embeddings via Worker API (/api/vectorize/embed)
  5. Embeddings → Vectorize upsert via Worker API (/api/vectorize/upsert)
  6. AI analysis → gpt-oss-120b structured JSON via Cloudflare Workers AI REST
  7. All results → D1 persistence via Worker REST API (/api/policy/*)

Usage:
  pip install PyPDF2 markitdown requests
  export WORKER_URL="https://renegade-capital.hacolby.workers.dev"
  export CF_API_TOKEN="<your-cloudflare-api-token>"
  export CF_ACCOUNT_ID="<your-account-id>"
  python scripts/ragify_trump_policy.py
"""

import os
import sys
import json
import uuid
import time
import hashlib
import requests
import subprocess
from pathlib import Path
from typing import Any

# ─── Third-party imports ───
try:
    from PyPDF2 import PdfReader, PdfWriter
except ImportError:
    print("ERROR: pip install PyPDF2")
    sys.exit(1)

try:
    from markitdown import MarkItDown
except ImportError:
    print("ERROR: pip install markitdown")
    sys.exit(1)

try:
    import asyncio
    from pydantic import BaseModel, Field
    from agents import Agent, Runner, trace
except ImportError:
    print("ERROR: pip install openai openai-agents pydantic")
    sys.exit(1)


# ─── Configuration ───────────────────────────────────────────────────────────────

def get_secret(env_var: str) -> str:
    val = os.environ.get(env_var, "").strip()
    if val:
        return val
    try:
        # Fallback to fetching via tokens CLI
        result = subprocess.run(["tokens", "show", env_var, "--value-only"], capture_output=True, text=True, check=True)
        return result.stdout.strip()
    except Exception as e:
        print(f"WARNING: Could not fetch secret {env_var} via env or tokens CLI: {e}")
        return ""

WORKER_URL = os.environ.get("WORKER_URL", "https://renegade-capital.hacolby.workers.dev")
CF_API_TOKEN = get_secret("CLOUDFLARE_AI_GATEWAY_TOKEN")
if not CF_API_TOKEN:
    CF_API_TOKEN = get_secret("CLOUDFLARE_AI_GATEWAY_TOKEN") # Fallback
CF_ACCOUNT_ID = get_secret("CLOUDFLARE_ACCOUNT_ID")
if not CF_ACCOUNT_ID:
    CF_ACCOUNT_ID = get_secret("CF_ACCOUNT_ID") # Fallback

# Configure openai-agents to route through Cloudflare AI Gateway Unified Endpoint (/compat)
OPENAI_BASE_URL = f"https://gateway.ai.cloudflare.com/v1/{CF_ACCOUNT_ID}/default-gateway/compat"
os.environ["OPENAI_API_KEY"] = CF_API_TOKEN
os.environ["OPENAI_BASE_URL"] = OPENAI_BASE_URL

# Cloudflare Workers AI Model String
# Example: workers-ai/@cf/meta/llama-3.1-70b-instruct
AI_MODEL = "workers-ai/@cf/openai/gpt-oss-120b"
MAX_TOKENS = 8096

PDF_PATH = Path(__file__).parent.parent / "docs" / "Americas-AI-Action-Plan.pdf"
TEMP_DIR = Path(__file__).parent / ".ragify_tmp"

# BGE-large-en-v1.5 constraints
MAX_TOKENS_PER_CHUNK = 450  # Leave margin below the 512 token limit
EMBEDDING_DIM = 1024




# Seed tag types for the taxonomy
SEED_TAG_TYPES = [
    {"name": "Policy Category", "description": "Government policy area (AI governance, defense, energy, etc.)"},
    {"name": "Social Justice Concern", "description": "Social justice issues raised (bias, wealth gap, surveillance, etc.)"},
    {"name": "Organizing Strategy (Finance)", "description": "How finance practitioners should respond"},
    {"name": "Organizing Strategy (AI)", "description": "How AI practitioners should respond"},
]


# ─── Utilities ────────────────────────────────────────────────────────────────────

def log(msg: str, level: str = "INFO"):
    """Simple logger with timestamp."""
    ts = time.strftime("%H:%M:%S")
    print(f"[{ts}] [{level}] {msg}")


def worker_api(method: str, path: str, data: dict | None = None) -> dict:
    """Call the Worker REST API."""
    url = f"{WORKER_URL}{path}"
    headers = {"Content-Type": "application/json"}
    
    if method == "GET":
        resp = requests.get(url, headers=headers, timeout=60)
    elif method == "POST":
        resp = requests.post(url, headers=headers, json=data, timeout=120)
    elif method == "PUT":
        resp = requests.put(url, headers=headers, json=data, timeout=120)
    else:
        raise ValueError(f"Unsupported method: {method}")

    resp.raise_for_status()
    return resp.json()


def clear_r2_bucket():
    """Clear all objects in the R2 bucket."""
    log("Clearing R2 bucket of previous uploads...")
    try:
        resp = worker_api("POST", "/api/policy/r2-clear")
        log(f"  R2 clear success: Deleted {resp.get('deleted', 0)} files.")
    except Exception as e:
        log(f"  Warning: R2 clear failed: {e}", "WARN")


def test_embed_endpoint():
    """Test that the embedding API on the worker is functioning."""
    log("Testing embedding endpoint on worker...")
    try:
        resp = worker_api("POST", "/api/vectorize/embed", data={"text": "Test embedding connection"})
        if "data" in resp:
            log("  Embedding endpoint is healthy!")
        else:
            log(f"  Warning: Embedding endpoint returned unexpected response: {resp}", "WARN")
    except Exception as e:
        log(f"  Error: Embedding endpoint is failing: {e}", "ERROR")
        raise RuntimeError(f"Embedding endpoint failed. Check worker logs. {e}")


def cf_ai_run(messages: list[dict], response_format: dict | None = None) -> dict:
    """
    Call Cloudflare Workers AI REST API for structured AI analysis.

    gpt-oss-120b (Messages mode):
      Input schema:
        {
          messages: Array<{ role: string, content: string | Array<{ type, text }> }>,
          max_tokens?: number (DEFAULT: 256 — MUST override!),
          temperature?: number (0-5, default 0.6),
          response_format?: { type: "json_object" | "json_schema", json_schema?: {} },
          ...
        }
      Output schema:
        {
          response: string,
          usage: { prompt_tokens, completion_tokens, total_tokens },
          tool_calls?: Array<{ arguments: object, name: string }>
        }

    NOTE: max_tokens defaults to 256 which truncates structured JSON output.
    We override to MAX_TOKENS (8096).
    """
    # Use Cloudflare AI Gateway Universal Endpoint for raw REST calls
    url = f"https://gateway.ai.cloudflare.com/v1/{CF_ACCOUNT_ID}/default-gateway/compat/{AI_MODEL}"
    headers = {
        "Authorization": f"Bearer {CF_API_TOKEN}",
        "Content-Type": "application/json",
    }
    payload: dict[str, Any] = {
        "messages": messages,
        "max_tokens": MAX_TOKENS,       # Override default of 256!
        "temperature": 0.3,              # Low temp for structured JSON output
    }

    # Enable JSON mode for deterministic structured output
    if response_format:
        payload["response_format"] = response_format
    else:
        # Default to JSON object mode for structured analysis
        payload["response_format"] = {"type": "json_object"}

    resp = requests.post(url, headers=headers, json=payload, timeout=180)
    resp.raise_for_status()
    result = resp.json()
    
    if not result.get("success"):
        raise RuntimeError(f"AI API error: {result.get('errors', 'Unknown')}")
    
    # Output: { response: string, usage: { prompt_tokens, completion_tokens, total_tokens } }
    return result["result"]


def chunk_text(text: str, max_chars: int = 1800) -> list[dict]:
    """
    Split text into chunks that fit within BGE's 512-token limit.
    Uses paragraph boundaries for clean splits.
    Returns list of {text, start_offset, end_offset}.
    """
    if len(text) <= max_chars:
        return [{"text": text, "start": 0, "end": len(text)}]

    chunks = []
    paragraphs = text.split("\n\n")
    current = ""
    current_start = 0
    pos = 0

    for para in paragraphs:
        para_with_sep = para + "\n\n"
        if len(current) + len(para_with_sep) > max_chars and current:
            chunks.append({
                "text": current.strip(),
                "start": current_start,
                "end": pos,
            })
            current = para_with_sep
            current_start = pos
        else:
            current += para_with_sep
        pos += len(para_with_sep)

    if current.strip():
        chunks.append({
            "text": current.strip(),
            "start": current_start,
            "end": pos,
        })

    return chunks


# ─── Pipeline Steps ──────────────────────────────────────────────────────────────

def extract_pages(pdf_path: Path) -> list[dict]:
    """Extract text from each page of the PDF."""
    log(f"Extracting pages from {pdf_path.name}...")
    reader = PdfReader(str(pdf_path))
    pages = []

    for i, page in enumerate(reader.pages):
        text = page.extract_text() or ""
        
        # Remove 'AMERICA ’S AI ACTION PLAN' (and variants) from the first few lines
        lines = text.split("\n")
        
        for j in range(min(3, len(lines))):
            lines[j] = lines[j].replace("AMERICA ’S AI ACTION PLAN", "").strip()
            lines[j] = lines[j].replace("AMERICA'S AI ACTION PLAN", "").strip()
            lines[j] = lines[j].replace("AMERICA’S AI ACTION PLAN", "").strip()
            
        # Remove leading empty lines
        while lines and not lines[0].strip():
            lines = lines[1:]
                
        text = "\n".join(lines).strip()

        pages.append({
            "page_num": i + 1,
            "raw_text": text,
        })
        log(f"  Page {i + 1}: {len(text)} chars")

    log(f"Extracted {len(pages)} pages")
    return pages


def convert_to_markdown(pages: list[dict]) -> list[dict]:
    """Convert page text to markdown using markitdown."""
    log("Converting pages to markdown...")
    md = MarkItDown()

    TEMP_DIR.mkdir(exist_ok=True)

    for page in pages:
        # Write raw text to temp file for markitdown processing
        tmp_file = TEMP_DIR / f"page_{page['page_num']}.txt"
        tmp_file.write_text(page["raw_text"], encoding="utf-8")

        try:
            result = md.convert(str(tmp_file))
            page["markdown"] = result.text_content if result.text_content else page["raw_text"]
        except Exception as e:
            log(f"  Warning: markitdown failed for page {page['page_num']}: {e}", "WARN")
            page["markdown"] = page["raw_text"]

    return pages


def extract_single_page_pdfs(pdf_path: Path, pages: list[dict]) -> list[dict]:
    """Extract single-page PDFs and upload to R2 via Worker API."""
    log("Extracting single-page PDFs for R2 upload...")
    reader = PdfReader(str(pdf_path))
    TEMP_DIR.mkdir(exist_ok=True)

    for page in pages:
        idx = page["page_num"] - 1
        writer = PdfWriter()
        writer.add_page(reader.pages[idx])

        single_pdf_path = TEMP_DIR / f"page_{page['page_num']}.pdf"
        with open(single_pdf_path, "wb") as f:
            writer.write(f)

        # Upload to R2 via Worker API
        r2_key = f"trump-policy/pages/page_{page['page_num']:03d}.pdf"
        try:
            with open(single_pdf_path, "rb") as f:
                upload_url = f"{WORKER_URL}/api/policy/r2-upload"
                resp = requests.post(
                    upload_url,
                    files={"file": (f"page_{page['page_num']}.pdf", f, "application/pdf")},
                    data={"key": r2_key},
                    timeout=60,
                )
                if resp.status_code == 200:
                    page["r2_key"] = r2_key
                    log(f"  Page {page['page_num']} → R2: {r2_key}")
                else:
                    log(f"  Warning: R2 upload failed for page {page['page_num']}: {resp.status_code}", "WARN")
                    page["r2_key"] = None
        except Exception as e:
            log(f"  Warning: R2 upload failed for page {page['page_num']}: {e}", "WARN")
            page["r2_key"] = None

    return pages


def generate_embeddings(pages: list[dict]) -> list[dict]:
    """Generate embeddings for each page/chunk via the Worker vectorize proxy."""
    log("Generating embeddings via Worker API...")

    for page in pages:
        content = page.get("markdown", page["raw_text"])
        chunks = chunk_text(content)
        page["chunks"] = []

        for chunk_idx, chunk in enumerate(chunks):
            page_uuid = str(uuid.uuid4())
            vec_id = page_uuid if len(chunks) == 1 else f"{page_uuid}__chunk_{chunk_idx}"

            try:
                result = worker_api("POST", "/api/vectorize/embed", {
                    "text": [chunk["text"]],
                })
                embedding = result["data"][0]

                if not isinstance(embedding, list) or len(embedding) == 0:
                    raise ValueError(f"Invalid embedding format returned: {type(embedding)}")
                if not isinstance(embedding[0], (float, int)):
                    raise ValueError(f"Embedding elements are not numeric: {type(embedding[0])}")

                page["chunks"].append({
                    "vec_id": vec_id,
                    "page_uuid": page_uuid,
                    "chunk_idx": chunk_idx,
                    "text": chunk["text"],
                    "start": chunk["start"],
                    "end": chunk["end"],
                    "embedding": embedding,
                })
                log(f"  Page {page['page_num']} chunk {chunk_idx}: embedded ({len(embedding)} dims)")
            except Exception as e:
                log(f"  ERROR: Embedding failed for page {page['page_num']} chunk {chunk_idx}: {e}", "ERROR")

    return pages


def upsert_to_vectorize(pages: list[dict]) -> None:
    """Upsert all embeddings to the Vectorize index via Worker API."""
    log("Upserting vectors to Vectorize index...")

    vectors = []
    for page in pages:
        for chunk in page.get("chunks", []):
            vectors.append({
                "id": chunk["vec_id"],
                "values": chunk["embedding"],
                "metadata": {
                    "page_num": page["page_num"],
                    "chunk_idx": chunk["chunk_idx"],
                    "chunk_start": chunk["start"],
                    "chunk_end": chunk["end"],
                },
            })

    # Batch upsert (max 100 per call)
    batch_size = 100
    for i in range(0, len(vectors), batch_size):
        batch = vectors[i : i + batch_size]
        try:
            result = worker_api("POST", "/api/vectorize/upsert", {"vectors": batch})
            log(f"  Upserted batch {i // batch_size + 1}: {len(batch)} vectors")
        except Exception as e:
            log(f"  ERROR: Vectorize upsert failed for batch {i // batch_size + 1}: {e}", "ERROR")


# ─── Pydantic Models ─────────────────────────────────────────────────────────────

class PolicyAnalysisOutput(BaseModel):
    summary: str
    analysis: str
    rationale: str
    organize_tech: str
    organize_finance: str

class TagMapping(BaseModel):
    type: str
    name: str
    rationale: str

class TagMappingOutput(BaseModel):
    tags: list[TagMapping]

class GuestMapping(BaseModel):
    guest_id: str
    rationale: str

class GuestMatchOutput(BaseModel):
    guest_matches: list[GuestMapping]

class EpisodeIdea(BaseModel):
    title: str
    description: str

class EpisodeIdeaOutput(BaseModel):
    episode_ideas: list[EpisodeIdea]

class TranscriptLine(BaseModel):
    speaker: str
    text: str
    cue: str = ""

class TranscriptOutput(BaseModel):
    transcript: list[TranscriptLine]

class CategoryScore(BaseModel):
    score: int = Field(..., ge=1, le=10, description="Score from 1 to 10")
    rationale: str = Field(..., description="Justification based on social justice principles")

class PolicyScoringOutput(BaseModel):
    racial_equity: CategoryScore
    economic_justice: CategoryScore
    algorithmic_bias: CategoryScore
    labor_rights: CategoryScore
    privacy_surveillance: CategoryScore
    overall_impact_score: int
    overall_rationale: str


# ─── Agents ──────────────────────────────────────────────────────────────────────

policy_analyzer_agent = Agent(
    name="policy_analyzer_agent",
    model=AI_MODEL,
    instructions="""
    You are a Senior Policy Strategist at the intersection of AI Ethics and Community Development Finance. 
    Analyze the provided text for:
        - Structural Bias: Does the policy remove safeguards for marginalized communities?
        - Financial Gaps: Identify where the policy shifts capital away from (or toward) social equity.
        - The 'Renegade' Angle: Highlight points that contradict the goals of social justice investing.
    Extract actionable insights for 'The Social Justice Investor' audience.
    """,
    output_type=PolicyAnalysisOutput
)

tag_mapper_agent = Agent(
    name="tag_mapper_agent",
    model=AI_MODEL,
    instructions="""
    Review the policy analysis and assign relevant tags from the provided taxonomy.
    """,
    output_type=TagMappingOutput
)

guest_matcher_agent = Agent(
    name="guest_matcher_agent",
    model=AI_MODEL,
    instructions="""
    Compare the Policy Analysis against the Guest List.
    Identify 2-3 guests who don't just 'know' the topic, but can provide a counter-narrative.
    Search Criteria: Match a policy's financial impact with a guest’s 'Finance' domain, 
    and its algorithmic impact with a guest's 'AI Ethics' domain.
    
    Output: Explain the specific 'clash' or 'alignment' between the guest’s life work and this specific Trump AI policy page.
    """,
    output_type=GuestMatchOutput
)

transcript_generator_agent = Agent(
    name="transcript_generator_agent",
    model=AI_MODEL,
    instructions="""
    You are the Lead Producer for Renegade Capital. We are pitching a high-stakes episode to Andrea Longton.
    Topic: Reforming the Trump AI Action Plan through Social Justice Investing.

    Task: Write a provocative podcast transcript snippet (3-5 minutes of dialogue) based on this policy page.
    
    Cast:
    1. Andrea Longton (Host): Professional, inquisitive, focused on 'The Social Justice Investor' mission.
    2. Matched Guests: Use the provided persona and tone for each guest.

    Requirements:
    - Use 'The Hook' (Connect the Trump policy threat to the guest's expertise).
    - The 'Renegade' Move (How this guest helps investors 'reorganize' or 'mobilize' their capital).
    - The 'Vibe' (Provocative and essential).
    - Format as a list of lines with speaker name and text.
    """,
    output_type=TranscriptOutput
)

policy_scorer_agent = Agent(
    name="policy_scorer_agent",
    model=AI_MODEL,
    instructions="""
    You are a Social Justice Auditor. Analyze the provided policy page against these 5 categories:
    1. Racial Equity: Impact on marginalized communities.
    2. Economic Justice: Wealth gap and predatory finance implications.
    3. Algorithmic Bias: Use of automated systems that reinforce inequality.
    4. Labor Rights: Protections for workers in the AI economy.
    5. Privacy/Surveillance: Risks of state or corporate overreach.
    
    For each, provide a score (1-10) where 10 is the most harmful/concerning for social justice, and a deep rationale.
    """,
    output_type=PolicyScoringOutput
)

def match_experts_to_policy(policy_analysis_json: dict, tags_output: list, all_experts: list) -> list[dict]:
    """Hybrid intersection logic between policy analysis and expert database."""
    # Extract keywords from Policy Analysis
    policy_tags = set([t['name'].lower() for t in tags_output])
    policy_summary = policy_analysis_json.get("summary", "").lower()

    matches = []

    for expert in all_experts:
        score = 0
        # Parse JSON strings from D1/Hono API
        expert_tags = set([t.lower() for t in expert.get('expertise', [])])
        expert_domains = set([d.lower() for d in expert.get('domain', [])])
        
        # Intersection: Expertise matches (High Weight)
        expertise_overlap = policy_tags.intersection(expert_tags)
        score += len(expertise_overlap) * 10
        
        # Intersection: Domain matches (Medium Weight)
        domain_overlap = policy_tags.intersection(expert_domains)
        score += len(domain_overlap) * 5
        
        # Keyword Search: Check summary for expert's specific focus
        for tag in expert_tags:
            if tag in policy_summary:
                score += 3

        # Relationship Bonus
        if expert.get('isBookContributor'):
            score += 7

        if score > 0:
            matches.append({
                "id": expert['id'],
                "name": expert['name'],
                "score": score,
                "persona": expert['personaDescription'],
                "tone": expert['tone'],
                "rationale": f"Matched on: {', '.join(expertise_overlap.union(domain_overlap))}"
            })

    # Sort by score and return top 2
    sorted_matches = sorted(matches, key=lambda x: x['score'], reverse=True)
    return sorted_matches[:2]

async def run_ai_analysis_async(pages: list[dict], existing_guests: list, existing_research: list) -> list[dict]:
    """Run structured AI analysis on each page using deterministic sequential agents."""
    log("Running AI analysis on each page using deterministic sequential agents...")
    
    guests_context = json.dumps([{"id": g["id"], "name": g["name"], "expertise": g.get("expertise", "")} for g in existing_guests[:20]])
    previous_page_content = ""

    for page in pages:
        content = page.get("markdown", page["raw_text"])
        if not content.strip():
            log(f"  Skipping empty page {page['page_num']}")
            continue
            
        context_tail = previous_page_content[-500:] if previous_page_content else "No previous page context."

        with trace(f"Deterministic Agent Flow for Page {page['page_num']}"):
            try:
                # 1. Policy Analysis
                analysis_input = f"Analyze this policy document page:\n\n{content[:4000]}"
                analysis_result = await Runner.run(policy_analyzer_agent, analysis_input)
                policy_analysis = analysis_result.final_output
                log(f"  Page {page['page_num']}: Policy analysis complete")
                
                # 2. Tag Mapping
                tag_input = f"Policy Analysis:\n{policy_analysis.model_dump_json()}\n\nAssign tags based on this taxonomy: {json.dumps(SEED_TAG_TYPES)}"
                tag_result = await Runner.run(tag_mapper_agent, tag_input)
                tags_output = tag_result.final_output
                log(f"  Page {page['page_num']}: Tag mapping complete")

                # 3. Guest Matching (Python Hybrid Logic)
                guest_matches = match_experts_to_policy(
                    policy_analysis.model_dump(), 
                    [t.model_dump() for t in tags_output.tags], 
                    existing_guests
                )
                log(f"  Page {page['page_num']}: Guest matching complete ({len(guest_matches)} matches)")

                # 3b. Transcript Generation (Context Injection)
                guest_context = "\n".join([
                    f"Name: {g['name']}\nPersona: {g['persona']}\nTone: {g['tone']}\nRationale: {g['rationale']}" 
                    for g in guest_matches
                ])
                transcript_input = f"Policy Analysis:\n{policy_analysis.model_dump_json()}\n\nMatched Guests:\n{guest_context}"
                transcript_result = await Runner.run(transcript_generator_agent, transcript_input)
                transcript_output = transcript_result.final_output
                log(f"  Page {page['page_num']}: Transcript generation complete")

                # 4. Policy Scoring (Heat mapping)
                scoring_input = f"PREVIOUS PAGE CONTEXT (tail end):\n{context_tail}\n\nCURRENT PAGE CONTENT:\n{content[:4000]}"
                scoring_result = await Runner.run(policy_scorer_agent, scoring_input)
                policy_scoring = scoring_result.final_output
                log(f"  Page {page['page_num']}: Policy scoring complete")

                # Combine everything back into the expected dictionary shape for D1 persistence
                page["ai_analysis"] = {
                    "summary": policy_analysis.summary,
                    "analysis": policy_analysis.analysis,
                    "rationale": policy_analysis.rationale,
                    "organize_tech": policy_analysis.organize_tech,
                    "organize_finance": policy_analysis.organize_finance,
                    "tags": [t.model_dump() for t in tags_output.tags],
                    "guest_matches": guest_matches,
                    "transcript": [line.model_dump() for line in transcript_output.transcript],
                    "scoring": policy_scoring.model_dump()
                }
                
            except Exception as e:
                log(f"  ERROR: Agent flow failed for page {page['page_num']}: {e}", "ERROR")
                page["ai_analysis"] = None

        previous_page_content = content

        # Rate limiting
        time.sleep(1)

    return pages


def run_ai_analysis(pages: list[dict], existing_guests: list, existing_research: list) -> list[dict]:
    return asyncio.run(run_ai_analysis_async(pages, existing_guests, existing_research))


def persist_to_d1(pages: list[dict]) -> None:
    """Persist all analysis results to D1 via Worker REST API."""
    log("Persisting results to D1...")

    for page in pages:
        analysis = page.get("ai_analysis") or {}
        page_uuid = page["chunks"][0]["page_uuid"] if page.get("chunks") else str(uuid.uuid4())

        # Create the policy page record
        scoring = analysis.get("scoring")
        policy_scoring_data = None
        if scoring:
            policy_scoring_data = {
                "racialEquityScore": scoring["racial_equity"]["score"],
                "racialEquityRationale": scoring["racial_equity"]["rationale"],
                "economicJusticeScore": scoring["economic_justice"]["score"],
                "economicJusticeRationale": scoring["economic_justice"]["rationale"],
                "algorithmicBiasScore": scoring["algorithmic_bias"]["score"],
                "algorithmicBiasRationale": scoring["algorithmic_bias"]["rationale"],
                "laborRightsScore": scoring["labor_rights"]["score"],
                "laborRightsRationale": scoring["labor_rights"]["rationale"],
                "privacySurveillanceScore": scoring["privacy_surveillance"]["score"],
                "privacySurveillanceRationale": scoring["privacy_surveillance"]["rationale"],
                "overallImpactScore": scoring["overall_impact_score"],
                "overallRationale": scoring["overall_rationale"],
            }
            
        page_data = {
            "uuid": page_uuid,
            "pageNum": page["page_num"],
            "pageContent": page.get("markdown", page["raw_text"]),
            "r2Key": page.get("r2_key"),
            "pageImageUrl": page.get("page_image_url"),
            "aiSummary": analysis.get("summary"),
            "aiAnalysis": analysis.get("analysis"),
            "aiRationale": analysis.get("rationale"),
            "aiOrganizeTech": analysis.get("organize_tech"),
            "aiOrganizeFinance": analysis.get("organize_finance"),
            "tags": analysis.get("tags"),
            "guestMatches": analysis.get("guest_matches"),
            "transcript": analysis.get("transcript"),
            "policyScoring": policy_scoring_data,
        }

        try:
            result = worker_api("POST", "/api/policy/pages", page_data)
            log(f"  Page {page['page_num']} persisted to D1 (id: {result.get('id', 'unknown')})")
        except Exception as e:
            log(f"  ERROR: D1 persist failed for page {page['page_num']}: {e}", "ERROR")

    log("D1 persistence complete")


# ─── Step 9: Update Guest Rationale in D1 ─────────────────────────────────────────

def generate_guest_rationales(existing_guests: list[dict]):
    """Generates and updates a podcast fit rationale for each guest based on the AI policy context."""
    if not existing_guests:
        log("No guests to update rationale for.")
        return

    log(f"Generating podcast fit rationale for {len(existing_guests)} guests...")

    for guest in existing_guests:
        guest_id = guest.get("id")
        guest_name = guest.get("name", "Unknown")
        expertise = ", ".join(guest.get("expertise", []))
        domain = ", ".join(guest.get("domain", []))
        chemistry = ", ".join(guest.get("chemistry", []))
        
        policy_analysis_summary = "The Trump Administration's 'America's AI Action Plan' emphasizes deregulation, defense-first AI, and potential rollbacks of algorithmic bias safeguards, posing significant challenges and opportunities for social justice investing."
        
        prompt = f"""You are the Lead Producer for Renegade Capital. We are pitching a high-stakes episode to Andrea Longton.
Topic: Reforming the Trump AI Action Plan through Social Justice Investing.

Guest: {guest_name}
Guest Background: {guest.get('background', '')}
Expertise: {expertise}
Domain: {domain}
Persona: {guest.get('personaDescription', '')}

Analysis Context: {policy_analysis_summary}

Task: Write a 3-sentence hook.
- Sentence 1: The 'Why Now' (Connect a specific Trump policy threat to the guest's expertise).
- Sentence 2: The 'Renegade' Move (How this guest helps investors 'reorganize' or 'mobilize' their capital in response).
- Sentence 3: The 'Vibe' (Why this conversation will be provocative and essential for her listeners).
"""
        messages = [
            {"role": "system", "content": "You are a precise JSON generator. Always return a valid JSON object with the exact keys requested."},
            {"role": "user", "content": prompt + "\n\nReturn ONLY a JSON object with a single key 'podcastFitRationale' containing the pitch."}
        ]
        
        try:
            log(f"  Generating rationale for guest: {guest_name}")
            result = cf_ai_run(messages=messages, response_format={"type": "json_object"})
            
            response_str = result.get("response", "")
            if not response_str:
                log(f"    Failed to extract rationale: empty response", "WARN")
                continue
                
            try:
                data = json.loads(response_str)
                rationale = data.get("podcastFitRationale")
            except json.JSONDecodeError:
                log(f"    Failed to parse JSON rationale from: {response_str}", "WARN")
                continue
            
            if rationale:
                # Update via REST
                worker_api("PATCH", f"/api/guests/{guest_id}", {"podcastFitRationale": rationale})
                log(f"    Successfully updated rationale in D1")
            else:
                log(f"    Missing 'podcastFitRationale' in AI response", "WARN")
                
        except Exception as e:
            log(f"    ERROR updating rationale for guest {guest_name}: {e}", "ERROR")


# ─── Main Pipeline ────────────────────────────────────────────────────────────────

def main():
    log("=" * 60)
    log("Renegade Capital — Trump AI Policy RAG Pipeline")
    log("=" * 60)

    # Validate config
    if not CF_API_TOKEN:
        log("ERROR: Set CF_API_TOKEN environment variable", "ERROR")
        sys.exit(1)
    if not CF_ACCOUNT_ID:
        log("ERROR: Set CF_ACCOUNT_ID environment variable", "ERROR")
        sys.exit(1)
    if not PDF_PATH.exists():
        log(f"ERROR: PDF not found at {PDF_PATH}", "ERROR")
        sys.exit(1)

    log(f"PDF: {PDF_PATH}")
    log(f"Worker: {WORKER_URL}")

    # Step 0: Test embeddings and clear R2
    test_embed_endpoint()
    clear_r2_bucket()

    # Step 1: Extract pages
    pages = extract_pages(PDF_PATH)

    # Step 2: Convert to markdown
    pages = convert_to_markdown(pages)

    # Step 3: Extract single-page PDFs and upload to R2
    pages = extract_single_page_pdfs(PDF_PATH, pages)

    # Step 4: Generate embeddings
    pages = generate_embeddings(pages)

    # Step 5: Upsert to Vectorize
    upsert_to_vectorize(pages)

    # Step 6: Fetch existing guests for AI matching
    try:
        guests_resp = worker_api("GET", "/api/guests")
        existing_guests = guests_resp.get("guests", [])
        log(f"Loaded {len(existing_guests)} guests for matching")
    except Exception as e:
        log(f"Warning: Could not fetch guests: {e}", "WARN")
        existing_guests = []

    try:
        research_resp = worker_api("GET", "/api/research")
        existing_research = research_resp.get("research", [])
        log(f"Loaded {len(existing_research)} research entries for matching")
    except Exception as e:
        log(f"Warning: Could not fetch research: {e}", "WARN")
        existing_research = []

    # Step 7: Run AI analysis
    pages = run_ai_analysis(pages, existing_guests, existing_research)

    # Step 8: Persist to D1
    persist_to_d1(pages)

    # Step 9: Update Guest Rationale in D1
    generate_guest_rationales(existing_guests)

    log("=" * 60)
    log("Pipeline complete!")
    log(f"  Pages processed: {len(pages)}")
    log(f"  Total chunks: {sum(len(p.get('chunks', [])) for p in pages)}")
    log(f"  Pages with AI analysis: {sum(1 for p in pages if p.get('ai_analysis'))}")
    log("=" * 60)


if __name__ == "__main__":
    main()
