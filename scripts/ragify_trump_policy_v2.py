#!/usr/bin/env python3
"""
ragify_trump_policy_v2.py — RAG Pipeline for America's AI Action Plan

Orchestrates the complete ingestion of the Trump administration's AI Action Plan
PDF into the Renegade Capital infrastructure using Cloudflare AI Gateway and Workers AI.
Supports hierarchical tagging, page analysis, and global podcast episode generation.
"""

import os
import sys
import json
import uuid
import time
import requests
import subprocess
from pathlib import Path

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
    from pydantic import BaseModel, Field
except ImportError:
    print("ERROR: pip install pydantic")
    sys.exit(1)

try:
    import fitz  # PyMuPDF
except ImportError:
    print("ERROR: pip install PyMuPDF")
    sys.exit(1)

# ─── Configuration ───────────────────────────────────────────────────────────────

def get_secret(env_var: str) -> str:
    val = os.environ.get(env_var, "").strip()
    if val:
        return val
    try:
        result = subprocess.run(["tokens", "show", env_var, "--value-only"], capture_output=True, text=True, check=True)
        return result.stdout.strip()
    except Exception:
        return ""

WORKER_URL = os.environ.get("WORKER_URL", "https://renegade-capital.hacolby.workers.dev")
CF_API_TOKEN = get_secret("CLOUDFLARE_AI_GATEWAY_TOKEN") or get_secret("CF_API_TOKEN")
CF_ACCOUNT_ID = get_secret("CLOUDFLARE_ACCOUNT_ID") or get_secret("CF_ACCOUNT_ID")
CF_IMAGES_TOKEN = get_secret("CLOUDFLARE_IMAGES_STREAM_TOKEN")

PDF_PATH = Path(__file__).parent.parent / "docs" / "Americas-AI-Action-Plan.pdf"
TEMP_DIR = Path(__file__).parent / ".ragify_tmp"

# ─── Utilities ────────────────────────────────────────────────────────────────────

def log(msg: str, level: str = "INFO"):
    ts = time.strftime("%H:%M:%S")
    print(f"[{ts}] [{level}] {msg}")

def worker_api(method: str, path: str, data: dict | None = None) -> dict:
    url = f"{WORKER_URL}{path}"
    headers = {"Content-Type": "application/json"}
    resp = requests.request(method, url, headers=headers, json=data, timeout=120)
    resp.raise_for_status()
    return resp.json()

def clear_all_pipeline_data():
    """Nuclear reset: clears R2, Cloudflare Images, Vectorize, and D1 tables."""
    log("Clearing ALL pipeline data (R2 + CF Images + Vectorize + D1)...")
    try:
        url = f"{WORKER_URL}/api/policy/clear-all"
        headers = {
            "Content-Type": "application/json",
            "X-Images-Token": CF_IMAGES_TOKEN
        }
        resp = requests.post(url, headers=headers, timeout=120)
        resp.raise_for_status()
        data = resp.json()
        log(f"  R2 deleted: {data.get('r2Deleted', 0)}")
        log(f"  CF Images deleted: {data.get('imagesDeleted', 0)}")
        log(f"  Vectors deleted: {data.get('vectorsDeleted', 0)}")
        log(f"  D1 tables truncated: {data.get('d1Truncated', [])}")
    except Exception as e:
        log(f"  Warning: clear-all failed: {e}", "WARN")

def fetch_existing_tags() -> dict:
    try:
        resp = worker_api("GET", "/api/policy/tags")
        return resp.get("tree", [])
    except Exception as e:
        log(f"Failed to fetch tags: {e}", "WARN")
        return []

def fetch_existing_guests() -> list:
    try:
        resp = worker_api("GET", "/api/guests")
        return resp.get("guests", [])
    except Exception as e:
        log(f"Failed to fetch guests: {e}", "WARN")
        return []

def run_ai_task(system_prompt: str, user_prompt: str, output_schema: type[BaseModel]) -> dict:
    """Make direct API calls to Cloudflare AI Gateway using the OpenAI-compatible Chat Completions endpoint."""
    url = f"https://gateway.ai.cloudflare.com/v1/{CF_ACCOUNT_ID}/default-gateway/compat/chat/completions"
    headers = {
        "Authorization": f"Bearer {CF_API_TOKEN}",
        "cf-aig-authorization": f"Bearer {CF_API_TOKEN}",
        "Content-Type": "application/json"
    }
    schema_json = output_schema.model_json_schema()
    
    messages = [
        {"role": "system", "content": f"{system_prompt}\n\nYou must return a valid JSON object matching this schema:\n{json.dumps(schema_json)}"},
        {"role": "user", "content": user_prompt}
    ]
    
    payload = {
        "model": "workers-ai/@cf/openai/gpt-oss-120b",
        "messages": messages,
        "max_tokens": 4000,
        "response_format": {"type": "json_object"}
    }
    response = requests.post(url, headers=headers, json=payload)
    
    try:
        response.raise_for_status()
    except requests.exceptions.HTTPError as e:
        raise RuntimeError(f"API Error: {response.text}") from e
    
    try:
        result = response.json()
    except json.JSONDecodeError:
        raise RuntimeError(f"Failed to decode JSON. Raw response text: {response.text}")
    
    if "choices" in result:
        choice = result["choices"][0]
        msg = choice.get("message", {})
        content = msg.get("content")
        if content is None:
            reasoning = msg.get("reasoning_content", "")
            finish = choice.get("finish_reason", "unknown")
            raise ValueError(f"Model returned None content (finish_reason: {finish}). Reasoning: {reasoning}")
    elif "result" in result and isinstance(result["result"], dict) and "choices" in result["result"]:
        choice = result["result"]["choices"][0]
        msg = choice.get("message", {})
        content = msg.get("content")
        if content is None:
            reasoning = msg.get("reasoning_content", "")
            finish = choice.get("finish_reason", "unknown")
            raise ValueError(f"Model returned None content (finish_reason: {finish}). Reasoning: {reasoning}")
    else:
        raise ValueError(f"Unexpected response format: {result}")
        
    content = str(content).strip()
    if content.startswith("```json"):
        content = content[7:-3].strip()
    elif content.startswith("```"):
        content = content[3:-3].strip()
    
    return json.loads(content)

# ─── Pipeline Steps ──────────────────────────────────────────────────────────────

def extract_pages(pdf_path: Path) -> list[dict]:
    """Extract text from each page of the PDF."""
    log(f"Extracting pages from {pdf_path.name}...")
    reader = PdfReader(str(pdf_path))
    pages = []

    for i, page in enumerate(reader.pages):
        text = page.extract_text() or ""
        
        # Clean up header
        lines = text.split("\n")
        for j in range(min(3, len(lines))):
            lines[j] = lines[j].replace("AMERICA ’S AI ACTION PLAN", "").strip()
            lines[j] = lines[j].replace("AMERICA'S AI ACTION PLAN", "").strip()
            lines[j] = lines[j].replace("AMERICA’S AI ACTION PLAN", "").strip()
            
        while lines and not lines[0].strip():
            lines = lines[1:]
                
        text = "\n".join(lines).strip()

        pages.append({
            "page_num": i + 1,
            "raw_text": text,
        })
        log(f"  Page {i + 1}: {len(text)} chars")
    return pages

def convert_to_markdown(pages: list[dict]) -> list[dict]:
    """Convert page text to markdown using markitdown."""
    log("Converting pages to markdown...")
    md = MarkItDown()
    TEMP_DIR.mkdir(exist_ok=True)

    for page in pages:
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

def convert_pages_to_images(pdf_path: Path, pages: list[dict]) -> list[dict]:
    """Convert each PDF page to a PNG image and upload to Cloudflare Images."""
    log("Converting pages to images and uploading to Cloudflare Images...")
    TEMP_DIR.mkdir(exist_ok=True)
    doc = fitz.open(str(pdf_path))

    for page in pages:
        idx = page["page_num"] - 1
        if idx >= len(doc):
            continue

        pix = doc[idx].get_pixmap(dpi=200)
        img_path = TEMP_DIR / f"page_{page['page_num']}.png"
        pix.save(str(img_path))

        # Upload to Cloudflare Images directly
        try:
            with open(img_path, "rb") as f:
                resp = requests.post(
                    f"https://api.cloudflare.com/client/v4/accounts/{CF_ACCOUNT_ID}/images/v1",
                    files={"file": (f"page_{page['page_num']}.png", f, "image/png")},
                    headers={"Authorization": f"Bearer {CF_IMAGES_TOKEN}"},
                    timeout=60,
                )
                if resp.status_code == 200:
                    result = resp.json()
                    if result.get("success"):
                        variants = result["result"].get("variants", [])
                        image_url = variants[0] if variants else f"https://imagedelivery.net/{CF_ACCOUNT_ID}/{result['result']['id']}/public"
                        page["page_image_url"] = image_url
                        log(f"  Page {page['page_num']} image → CF Images: {page['page_image_url']}")
                    else:
                        log(f"  Warning: CF Images upload failed for page {page['page_num']}: {result.get('errors')}", "WARN")
                        page["page_image_url"] = None
                else:
                    log(f"  Warning: CF Images upload failed for page {page['page_num']}: {resp.status_code} {resp.text}", "WARN")
                    page["page_image_url"] = None
        except Exception as e:
            log(f"  Warning: CF Images upload failed for page {page['page_num']}: {e}", "WARN")
            page["page_image_url"] = None

    doc.close()
    return pages

def generate_embedding(text: str) -> list[float] | None:
    """Generate an embedding vector via the Worker proxy."""
    try:
        resp = worker_api("POST", "/api/vectorize/embed", {"text": text})
        data = resp.get("data")
        if data and len(data) > 0:
            return data[0]
    except Exception as e:
        log(f"  Embedding generation failed: {e}", "WARN")
    return None

def upsert_vector(vector_id: str, values: list[float], metadata: dict | None = None):
    """Upsert a single vector into Vectorize via the Worker proxy."""
    payload = {
        "vectors": [{
            "id": vector_id,
            "values": values,
            **(({"metadata": metadata}) if metadata else {}),
        }]
    }
    return worker_api("POST", "/api/vectorize/upsert", payload)

# ─── Pydantic Models ─────────────────────────────────────────────────────────────

class TagMapping(BaseModel):
    parentType: str | None = Field(default=None, description="Optional parent category type")
    type: str = Field(..., description="The category type for this tag")
    parentTag: str | None = Field(default=None, description="Optional parent tag name for hierarchy")
    name: str = Field(..., description="The tag name")
    rationale: str

class PolicyAnalysisOutput(BaseModel):
    summary: str
    analysis: str
    rationale: str
    organize_tech: str
    organize_finance: str
    tags: list[TagMapping]

class CategoryScore(BaseModel):
    score: int = Field(..., ge=1, le=10)
    rationale: str

class PolicyScoringOutput(BaseModel):
    racial_equity: CategoryScore
    economic_justice: CategoryScore
    algorithmic_bias: CategoryScore
    labor_rights: CategoryScore
    privacy_surveillance: CategoryScore
    overall_impact_score: int
    overall_rationale: str

class EpisodeStrategy(BaseModel):
    title: str
    description: str
    targetTags: list[str] = Field(..., description="List of tag names this episode covers")

class EpisodeStrategyOutput(BaseModel):
    episodes: list[EpisodeStrategy]

class TranscriptLine(BaseModel):
    speaker: str = Field(..., description="Name of speaker (e.g. Host, or guest's specific name)")
    text: str
    cue: str = ""

class TranscriptOutput(BaseModel):
    transcript: list[TranscriptLine]

# ─── Main Pipeline Execution ─────────────────────────────────────────────────────

def main():
    log("Starting Renegade Capital Global Pipeline...")
    
    if not CF_API_TOKEN or not CF_ACCOUNT_ID:
        log("ERROR: Missing Cloudflare credentials.", "ERROR")
        return
        
    if not PDF_PATH.exists():
        log(f"ERROR: PDF not found at {PDF_PATH}", "ERROR")
        return

    clear_all_pipeline_data()

    # Stage 1: Extraction
    pages = extract_pages(PDF_PATH)
    pages = convert_to_markdown(pages)
    pages = extract_single_page_pdfs(PDF_PATH, pages)
    pages = convert_pages_to_images(PDF_PATH, pages)
    
    existing_tags = fetch_existing_tags()
    existing_guests = fetch_existing_guests()
    
    processed_pages = []
    
    # Stage 2: Page Analysis
    log("Starting Phase 2: Page Analysis...")
    previous_content = ""
    
    for page in pages:
        current_content = page.get("markdown", page["raw_text"])
        if not current_content.strip(): continue

        # Append last 500 characters of the previous page to prevent context loss
        content_for_ai = current_content
        if previous_content:
            context_tail = previous_content[-500:].strip()
            content_for_ai = f"[CONTEXT FROM END OF PREVIOUS PAGE: {context_tail}]\n\n{current_content}"
            
        previous_content = current_content

        try:
            # Analyze & Tag
            system_prompt = f"""
            Analyze the document for structural bias and financial gaps for Social Justice Investors.
            You must assign tags to categorize the content.
            Use hierarchical tags if necessary (i.e. use parentType and parentTag). You can invent new tags.
            Existing Tag Tree: {json.dumps(existing_tags)}
            """
            analysis_dict = run_ai_task(system_prompt, content_for_ai, PolicyAnalysisOutput)
            
            # Score
            system_prompt_scores = "Score the policy on social justice categories from 1-10 (10 being most harmful)."
            scoring_dict = run_ai_task(system_prompt_scores, content_for_ai, PolicyScoringOutput)
            
            # Generate a stable UUID that ties D1 record to Vectorize embedding
            page_uuid = str(uuid.uuid4())
            
            scoring_mapped = {
                "racialEquity": scoring_dict.get("racial_equity", {}).get("score"),
                "economicJustice": scoring_dict.get("economic_justice", {}).get("score"),
                "algorithmicBias": scoring_dict.get("algorithmic_bias", {}).get("score"),
                "laborRights": scoring_dict.get("labor_rights", {}).get("score"),
                "privacySurveillance": scoring_dict.get("privacy_surveillance", {}).get("score"),
                "overallImpactScore": scoring_dict.get("overall_impact_score"),
                "overallRationale": scoring_dict.get("overall_rationale"),
            }
            
            payload = {
                "uuid": page_uuid,
                "pageNum": page["page_num"],
                "pageContent": current_content,
                "r2Key": page.get("r2_key"),
                "pageImageUrl": page.get("page_image_url"),
                "aiSummary": analysis_dict.get("summary"),
                "aiAnalysis": analysis_dict.get("analysis"),
                "aiRationale": analysis_dict.get("rationale"),
                "aiOrganizeTech": analysis_dict.get("organize_tech"),
                "aiOrganizeFinance": analysis_dict.get("organize_finance"),
                "policyScoring": scoring_mapped,
                "tags": analysis_dict.get("tags", [])
            }
            
            resp = worker_api("POST", "/api/policy/pages", payload)
            log(f"  Page {page['page_num']} saved to D1. ID: {resp.get('id')}")
            
            # Generate embedding and upsert to Vectorize with same uuid
            embed_text = f"{analysis_dict.get('summary', '')} {current_content[:1500]}"
            embedding = generate_embedding(embed_text)
            if embedding:
                upsert_vector(page_uuid, embedding, {
                    "pageNum": page["page_num"],
                    "summary": analysis_dict.get("summary", "")[:200],
                })
                log(f"  Page {page['page_num']} vector upserted. UUID: {page_uuid}")
            else:
                log(f"  Warning: No embedding for page {page['page_num']}", "WARN")
            
            processed_pages.append({
                "pageNum": page["page_num"],
                "summary": analysis_dict.get("summary"),
                "tags": analysis_dict.get("tags", [])
            })
            
        except Exception as e:
            log(f"  Error on page {page['page_num']}: {e}", "ERROR")

    if not processed_pages:
        log("No pages processed successfully. Exiting.")
        return

    # Stage 3: Global Episode Strategy
    log("Starting Phase 3: Global Episode Strategy...")
    try:
        strategy_prompt = f"""
        You are a podcast producer for Renegade Capital.
        Review all the policy summaries and tags collected below.
        Decide on a strategic lineup of podcast episodes to cover these topics comprehensively.
        Create a handful of episodes based on this data.
        
        Data: {json.dumps(processed_pages)}
        """
        strategy_dict = run_ai_task(strategy_prompt, "Generate the episode strategy.", EpisodeStrategyOutput)
        episodes = strategy_dict.get("episodes", [])
        log(f"Generated {len(episodes)} episode concepts.")
    except Exception as e:
        log(f"Error generating episode strategy: {e}", "ERROR")
        return

    # Stage 4: Transcript Generation
    log("Starting Phase 4: Transcript Generation...")
    final_episodes = []
    
    guest_context = [{"name": g.get("name"), "expertise": g.get("expertise")} for g in existing_guests if g.get("name")]
    
    for ep in episodes:
        try:
            # We must pass the target tags and any relevant context
            transcript_prompt = f"""
            Write a podcast transcript for the episode "{ep.get('title')}".
            Description: {ep.get('description')}
            Target Tags: {ep.get('targetTags')}
            
            Available Guests to choose from: {json.dumps(guest_context)}
            The host is 'Host' (or Andrea). The guest MUST be a specific name exactly matching one of the Available Guests list.
            The transcript should involve a discussion about the Target Tags.
            """
            transcript_dict = run_ai_task(transcript_prompt, "Generate the transcript.", TranscriptOutput)
            
            ep["transcript"] = transcript_dict.get("transcript", [])
            final_episodes.append(ep)
            log(f"  Transcript generated for episode: {ep.get('title')}")
        except Exception as e:
            log(f"  Error generating transcript for episode: {e}", "ERROR")

    if final_episodes:
        try:
            resp = worker_api("POST", "/api/policy/global-episodes", {"episodes": final_episodes})
            log(f"Global episodes saved! Inserted IDs: {resp.get('episodesInserted')}")
        except Exception as e:
            log(f"Error saving global episodes: {e}", "ERROR")

if __name__ == "__main__":
    main()