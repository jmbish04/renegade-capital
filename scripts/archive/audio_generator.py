#!/usr/bin/env python3
"""
audio_generator.py — Multi-voice Podcast Generator using Cloudflare Workers AI & Deepgram Aura
"""

import os
import sys
import json
import time
import requests
import io
import subprocess
import base64
import hashlib
from pathlib import Path

import atexit
atexit.register(lambda: report.save("podcast_generation_report.html"))


class HtmlReport:
    def __init__(self):
        self.html_lines = []
        self.html_lines.append("<html><head><style>body { font-family: sans-serif; line-height: 1.6; } .req { margin-bottom: 10px; border: 1px solid #ccc; padding: 10px; background: #f9f9f9; border-radius: 5px; } .success { color: #155724; font-weight: bold; background-color: #d4edda; padding: 3px 6px; border-radius: 3px; } .error { color: #721c24; font-weight: bold; background-color: #f8d7da; padding: 3px 6px; border-radius: 3px; } pre { background: #eee; padding: 8px; white-space: pre-wrap; word-wrap: break-word; border-radius: 4px; border: 1px solid #ddd; max-height: 400px; overflow-y: auto; } h1, h2, h3 { color: #333; margin-bottom: 5px; } .step { background: #e9ecef; padding: 10px; border-left: 5px solid #007bff; margin-top: 20px; } .info { font-style: italic; color: #555; }</style></head><body>")
        self.html_lines.append("<h1>Podcast Generation Report</h1>")
        self.html_lines.append("<div class='step'><h2>Overall Game Plan</h2><ul><li>1. Check API Health</li><li>2. Assign missing guest sexes (for TTS voices)</li><li>3. Fetch episodes missing transcripts and generate transcripts + artwork</li><li>4. Fetch episodes pending audio and generate audio</li></ul></div>")

    def add_step(self, message):
        print(message)
        self.html_lines.append(f"<div class='step'><h3>{message}</h3></div>")

    def add_info(self, message):
        print(message)
        self.html_lines.append(f"<p class='info'>{message}</p>")

    def add_api_call(self, method, url, payload, status_code, response_text, expected=True):
        icon = "✅" if expected else "❌"
        status_class = "success" if expected else "error"
        self.html_lines.append("<div class='req'>")
        self.html_lines.append(f"<strong>{icon} {method.upper()} {url}</strong> - <span class='{status_class}'>Status: {status_code}</span>")
        if payload:
            self.html_lines.append(f"<div><strong>Payload:</strong><pre>{payload}</pre></div>")
        self.html_lines.append(f"<div><strong>Response:</strong><pre>{response_text}</pre></div>")
        self.html_lines.append("</div>")

    def save(self, filename="podcast_generation_report.html"):
        self.html_lines.append("</body></html>")
        with open(filename, "w", encoding="utf-8") as f:
            f.write("\\n".join(self.html_lines))
        print(f"\\n📄 Report saved to {filename}")

report = HtmlReport()

original_request = requests.request

def logged_request(method, url, **kwargs):
    try:
        response = original_request(method, url, **kwargs)
        payload = kwargs.get("json") or kwargs.get("data")
        
        if method == "PUT" and "audio" in url:
            payload_str = "[Binary Audio Data Upload]"
        else:
            payload_str = json.dumps(payload, indent=2) if kwargs.get("json") else str(payload)[:1000] if payload else ""
            
        expected = response.status_code in (200, 201)
        
        content_type = response.headers.get("content-type", "")
        if "audio" in content_type or "mpeg" in content_type:
            resp_text = f"[Binary Audio Response: {len(response.content)} bytes]"
        else:
            try:
                resp_text = response.text
                if len(resp_text) > 200000:
                    resp_text = resp_text[:200000] + "\n...[TRUNCATED]"
            except:
                resp_text = f"[Binary Data: {len(response.content)} bytes]"
                
        report.add_api_call(method, url, payload_str, response.status_code, resp_text, expected)
        return response
    except Exception as e:
        payload = kwargs.get("json") or kwargs.get("data")
        payload_str = json.dumps(payload, indent=2) if kwargs.get("json") else str(payload)[:1000] if payload else ""
        report.add_api_call(method, url, payload_str, "ERROR", str(e), False)
        raise e

requests.request = logged_request
requests.get = lambda url, **kwargs: logged_request("GET", url, **kwargs)
requests.post = lambda url, **kwargs: logged_request("POST", url, **kwargs)
requests.put = lambda url, **kwargs: logged_request("PUT", url, **kwargs)


# Validating dependencies
try:
    from pydub import AudioSegment
except ImportError:
    print("ERROR: Please install pydub: pip install pydub")
    print("Note: You may also need to install ffmpeg on your system.")
    sys.exit(1)

try:
    from pydantic import BaseModel, Field
except ImportError:
    print("ERROR: pip install pydantic")
    sys.exit(1)

# ─── Pydantic Models ─────────────────────────────────────────────────────────────
class TranscriptLine(BaseModel):
    isHost: bool = Field(..., description="True if the speaker is one of the hosts")
    isGuest: bool = Field(..., description="True if the speaker is a guest")
    hostId: str = Field(None, description="If isHost is true, provide the exact ID of the host from the provided host list")
    guestId: str = Field(None, description="If isGuest is true, provide the exact ID of the guest from the provided guest list")
    text: str
    cue: str = ""

class TranscriptOutput(BaseModel):
    transcript: list[TranscriptLine]

class GuestSelectionOutput(BaseModel):
    selected_guests: list[str] = Field(..., description="List of exact guest names chosen for the episode (min 1, max 4)")
    reasoning: str = Field(..., description="Brief reasoning for why these guests were selected based on the topic")

class TitleOptimizationOutput(BaseModel):
    is_appropriate: bool = Field(..., description="True if the title is strictly 5-7 words, catchy, and appropriate for Apple Podcasts.")
    optimized_title: str = Field(..., description="If is_appropriate is False, provide a new title strictly 5-7 words maximum.")

class TopicsOutput(BaseModel):
    social_justice_investment_topics: str = Field(..., description="Generated social justice investment topics and context.")
    ai_social_justice_topics: str = Field(..., description="Generated AI and social justice intersection topics.")

ANDREA_BIO = """
Andrea Longton is a social justice investor and author of 'The Social Justice Investor'. She has extensive experience in capital markets and financial services, leveraging her expertise to direct capital toward communities and causes that have been historically marginalized or ignored. Her mission is to demystify finance and show everyday people how they can align their money with their values to create tangible, positive social impact. She bridges the gap between traditional finance and social justice movements.
"""

class GuestSexOutput(BaseModel):
    id: str
    sex: str = Field(..., description="'M' for male, 'F' for female")

class BulkGuestSexOutput(BaseModel):
    guests: list[GuestSexOutput]

class TagOutput(BaseModel):
    tagName: str = Field(..., description="The name of the tag")
    typeName: str = Field(..., description="The category/type of the tag")

class TagsOutput(BaseModel):
    tags: list[TagOutput]

class PolicyMapping(BaseModel):
    pageId: int = Field(..., description="The ID of the policy page")
    aiRationale: str = Field(..., description="A clear, transparent rationale explaining why this policy is mapped to the episode")

class PolicyMappingOutput(BaseModel):
    policies: list[PolicyMapping]

def get_secret(env_var: str) -> str:
    """Fetches secrets from env or local tokens CLI fallback."""
    val = os.environ.get(env_var, "").strip()
    if val:
        return val
    try:
        # Fixed: subprocess was not imported in original snippet
        result = subprocess.run(["tokens", "show", env_var, "--value-only"], capture_output=True, text=True, check=True)
        return result.stdout.strip()
    except Exception as e:
        print(f"WARNING: Could not fetch secret {env_var}: {e}")
        return ""

def generate_audio_for_line(text: str, speaker: str, api_token: str, account_id: str) -> bytes:
    """Calls Cloudflare Workers AI Deepgram Aura model."""
    # Note: Ensure your account has access to @cf/deepgram/aura-2-en
    url = f"https://api.cloudflare.com/client/v4/accounts/{account_id}/ai/run/@cf/deepgram/aura-2-en"
    headers = {
        "Authorization": f"Bearer {api_token}",
        "Content-Type": "application/json"
    }
    # We will use the deterministic voice passed to us
    data = {
        "text": text,
        "speaker": speaker if speaker else "apollo"
    }
    
    try:
        response = requests.post(url, headers=headers, json=data, timeout=30)
        if response.status_code != 200:
            print(f"ERROR: AI Gateway returned {response.status_code}")
            print(response.text)
            return None
            
        content_type = response.headers.get("content-type", "")
        if "application/json" in content_type:
            try:
                resp_json = response.json()
                if "result" in resp_json:
                    result_data = resp_json["result"]
                    if isinstance(result_data, dict) and "audio" in result_data:
                        return base64.b64decode(result_data["audio"])
                    elif isinstance(result_data, str):
                        return base64.b64decode(result_data)
            except Exception as parse_e:
                print(f"JSON parsing error: {parse_e}")
                
        return response.content
    except requests.exceptions.RequestException as e:
        print(f"Request failed: {e}")
        return None

def run_ai_task(system_prompt: str, user_prompt: str, output_schema: type[BaseModel], api_token: str, account_id: str) -> dict:
    """Make direct API calls to Cloudflare AI Gateway using the OpenAI-compatible Chat Completions endpoint."""
    url = f"https://gateway.ai.cloudflare.com/v1/{account_id}/default-gateway/compat/chat/completions"
    headers = {
        "Authorization": f"Bearer {api_token}",
        "cf-aig-authorization": f"Bearer {api_token}",
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
    elif "result" in result and isinstance(result["result"], dict) and "choices" in result["result"]:
        choice = result["result"]["choices"][0]
        msg = choice.get("message", {})
        content = msg.get("content")
    else:
        raise ValueError(f"Unexpected response format: {result}")
        
    content = str(content).strip()
    if content.startswith("```json"):
        content = content[7:-3].strip()
    elif content.startswith("```"):
        content = content[3:-3].strip()
    
    return json.loads(content)

def get_pending_episodes(worker_url: str) -> list:
    report.add_step("Fetching episodes pending audio generation...")
    url = f"{worker_url}/api/episodes/pending-audio"
    try:
        resp = requests.get(url, timeout=10)
        resp.raise_for_status()
        return resp.json().get("episodes", [])
    except Exception as e:
        print(f"Failed to fetch pending episodes: {e}")
        return []

def get_pending_transcripts(worker_url: str) -> list:
    report.add_step("Fetching episodes pending transcript generation...")
    url = f"{worker_url}/api/episodes/pending-transcripts"
    try:
        resp = requests.get(url, timeout=10)
        resp.raise_for_status()
        return resp.json().get("episodes", [])
    except Exception as e:
        print(f"Failed to fetch pending transcripts: {e}")
        return []

def get_guests(worker_url: str) -> list:
    print("Fetching guests...")
    url = f"{worker_url}/api/guests"
    try:
        resp = requests.get(url, timeout=10)
        resp.raise_for_status()
        return resp.json().get("guests", [])
    except Exception as e:
        print(f"Failed to fetch guests: {e}")
        return []

def get_hosts(worker_url: str) -> list:
    print("Fetching hosts...")
    url = f"{worker_url}/api/hosts"
    try:
        resp = requests.get(url, timeout=10)
        resp.raise_for_status()
        return resp.json().get("hosts", [])
    except Exception as e:
        print(f"Failed to fetch hosts: {e}")
        return []

def fetch_policy_pages(worker_url: str):
    print("Fetching policy previews...")
    url = f"{worker_url}/api/policy/content-previews"
    try:
        resp = requests.get(url, timeout=10)
        resp.raise_for_status()
        return resp.json().get("pages", [])
    except Exception as e:
        print(f"Failed to fetch policy previews: {e}")
        return []

def generate_transcript_and_artwork(episode_id: str, cf_token: str, cf_account: str, worker_url: str, guests: list, hosts: list):
    import uuid
    report.add_step(f"Generating Transcript & Artwork for Episode {episode_id}")
    try:
        # Fetch episode details
        resp = requests.get(f"{worker_url}/api/episodes/{episode_id}", timeout=10)
        resp.raise_for_status()
        episode_data = resp.json()
        episode = episode_data.get("episode", {})
        transcript_lines = episode_data.get("transcriptLines", [])
        
        tags = episode.get("tags", [])
        title = episode.get("title", "")
        desc = episode.get("description", "")
        
        # 1. Transcript check
        active_transcript_lines = [tl for tl in transcript_lines if tl.get("isActive", True) in (1, True, "1", "true")]
        if active_transcript_lines:
            print("✅ Transcript already exists. Skipping transcript generation.")
            transcript_id = active_transcript_lines[0].get("transcriptId")
            if not transcript_id:
                transcript_id = str(uuid.uuid4())
        else:
            transcript_id = str(uuid.uuid4())
            # Title Check & Optimize pre-step
            word_count = len(title.split())
            if word_count > 7:
                print("Checking/optimizing episode title...")
                title_prompt = f"""
                The current episode title is too long ({word_count} words). It needs to sound like normal human language and something someone would click on from Apple Podcasts.
                Rewrite it to be exactly 5 to 7 words maximum.
                
                Current Title: "{title}"
                Description: {desc}
                """
                title_dict = run_ai_task(title_prompt, "Optimize this title.", TitleOptimizationOutput, cf_token, cf_account)
                if not title_dict.get("is_appropriate", True):
                    new_title = title_dict.get("optimized_title", title)
                    if new_title and new_title != title:
                        print(f"✅ AI optimized title: '{new_title}'")
                        try:
                            title_resp = requests.put(f"{worker_url}/api/episodes/{episode_id}/title", json={"title": new_title}, timeout=30)
                            title_resp.raise_for_status()
                            title = new_title
                            print("✅ Synced new title to database.")
                        except Exception as e:
                            print(f"⚠️ Failed to sync title: {e}")

            # Guest selection pre-step
            episode_guests = episode_data.get("guests", [])
            primary_guests = [g for g in episode_guests if g.get("isPrimary")]
            
            if len(primary_guests) < 1 or len(primary_guests) > 4:
                print("Running AI guest selection pre-step...")
                guest_context = [{"id": g.get("id"), "name": g.get("name"), "expertise": g.get("expertise")} for g in guests if g.get("name")]
                
                selection_prompt = f"""
                Review the following episode topic and target tags. Then select exactly 1 to 4 primary guests from the Available Guests list whose expertise perfectly matches the episode's themes.
                Do NOT select 0 guests. You MUST select between 1 and 4 primary guests.

                Episode Title: "{title}"
                Description: {desc}
                Target Tags: {tags}
                
                Available Guests: {json.dumps(guest_context)}
                """
                
                selection_dict = run_ai_task(selection_prompt, "Select exactly 1 to 4 primary guests for this episode.", GuestSelectionOutput, cf_token, cf_account)
                selected_guest_names = selection_dict.get("selected_guests", [])
                print(f"✅ AI selected guests: {selected_guest_names}")
                
                primary_ids = [g["id"] for g in guests if g["name"] in selected_guest_names]
                backup_ids = [g["id"] for g in guests if g["name"] not in selected_guest_names]
                try:
                    sync_guests_resp = requests.post(f"{worker_url}/api/episodes/{episode_id}/guests", json={"primaryGuestIds": primary_ids[:4], "backupGuestIds": backup_ids}, timeout=30)
                    sync_guests_resp.raise_for_status()
                    print("✅ Synced primary guests to database.")
                    selected_guests_context = [{"id": g["id"], "name": g["name"]} for g in guests if g["id"] in primary_ids[:4]]
                except Exception as e:
                    print(f"⚠️ Failed to sync guests: {e}")
                    selected_guests_context = guest_context
            else:
                selected_guests_context = [{"id": g.get("id"), "name": g.get("name")} for g in primary_guests]
                
            # Tag Mapping Pre-Step
            mapped_tags = episode_data.get("tags", [])
            active_tags = []
            for t in mapped_tags:
                if isinstance(t, dict):
                    if t.get("isActive", True) in (1, True, "1", "true"):
                        active_tags.append(t)
                else:
                    active_tags.append(t)
            
            if not active_tags:
                print("Running AI tag mapping pre-step...")
                tag_prompt = f"""
                Review the following episode details. Generate 3 to 5 relevant tags and their categories (types).
                
                Episode Title: "{title}"
                Description: {desc}
                """
                tag_dict = run_ai_task(tag_prompt, "Generate tags for this episode.", TagsOutput, cf_token, cf_account)
                
                tags_list = tag_dict.get("tags", [])
                if tags_list:
                    print(f"✅ AI generated tags: {tags_list}")
                    # sync tags
                    try:
                        sync_tags_resp = requests.post(f"{worker_url}/api/episodes/{episode_id}/sync-tags", json={"tags": tags_list}, timeout=30)
                        sync_tags_resp.raise_for_status()
                        mapped_tags = [{"tagName": t["tagName"]} for t in tags_list]
                        print("✅ Synced tags to database.")
                    except Exception as e:
                        print(f"⚠️ Failed to sync tags: {e}")

            # Policy Mapping Pre-Step
            mapped_policies = episode_data.get("mappedPolicies", [])
            active_policies = [p for p in mapped_policies if p.get("isActive", True) in (1, True, "1", "true")]
            policy_rationales = ""
            if not active_policies:
                print("Running AI policy mapping pre-step...")
                policy_pages = fetch_policy_pages(worker_url)
                # Only send a snippet of policy context or page names
                policy_context = [{"pageId": p["id"], "pageNum": p["pageNum"], "title": p["title"], "preview": p["contentPreview"][:150]} for p in policy_pages]
                
                policy_prompt = f"""
                Review the following episode details and the available Trump AI Action Plan policy pages.
                Select 1 to 3 policy pages that represent the biggest threat or most relevant overlap to the episode's topic.
                For each selected page, provide a clear, transparent rationale for WHY it was selected.

                Episode Title: "{title}"
                Description: {desc}

                Available Policy Pages: {json.dumps(policy_context)}
                """
                
                policy_dict = run_ai_task(policy_prompt, "Map relevant policy pages to this episode.", PolicyMappingOutput, cf_token, cf_account)
                policies_list = policy_dict.get("policies", [])
                
                if policies_list:
                    print(f"✅ AI generated policy mappings: {policies_list}")
                    try:
                        sync_policies_resp = requests.post(f"{worker_url}/api/episodes/{episode_id}/sync-policies", json={"policies": policies_list}, timeout=30)
                        sync_policies_resp.raise_for_status()
                        
                        policy_rationales = "\n".join([f"Policy Page {p['pageId']} Rationale: {p['aiRationale']}" for p in policies_list])
                        print("✅ Synced policies to database.")
                    except Exception as e:
                        print(f"⚠️ Failed to sync policies: {e}")
            else:
                policy_rationales = "\n".join([f"Policy Page {p.get('pageNum', '')} Rationale: {p.get('aiRationale', '')}" for p in active_policies])

            # Topic Generation pre-step
            sj_topics = episode.get("socialJusticeInvestmentTopics")
            ai_topics = episode.get("aiSocialJusticeTopics")
            
            if not sj_topics or not ai_topics:
                print("Running AI topic generation pre-step...")
                topics_prompt = f"""
                Review the following episode details, selected guests, and Andrea Longton's bio. 
                Also consider the following overlapping Trump AI Policies and Rationales:
                {policy_rationales}

                Generate the core social justice investment topics and AI social justice topics for this episode.
                
                Andrea's Bio: {ANDREA_BIO}
                
                Episode Title: "{title}"
                Description: {desc}
                Selected Guests: {json.dumps(selected_guests_context)}
                """
                
                topics_dict = run_ai_task(topics_prompt, "Generate social justice and AI topics for this episode.", TopicsOutput, cf_token, cf_account)
                sj_topics = topics_dict.get("social_justice_investment_topics", "")
                ai_topics = topics_dict.get("ai_social_justice_topics", "")
                
                print(f"✅ AI generated topics.")
                
                # Update the database
                try:
                    update_resp = requests.put(
                        f"{worker_url}/api/episodes/{episode_id}/topics",
                        json={
                            "socialJusticeInvestmentTopics": sj_topics,
                            "aiSocialJusticeTopics": ai_topics
                        },
                        timeout=10
                    )
                    update_resp.raise_for_status()
                    print("✅ Saved generated topics to database.")
                except Exception as e:
                    print(f"⚠️ Failed to save generated topics to database: {e}")

            transcript_prompt = f"""
            Write a podcast transcript for the episode "{title}".
            Description: {desc}
            Target Tags: {tags}
            
            Social Justice Investment Topics: {sj_topics}
            AI & Social Justice Topics: {ai_topics}
            
            TRUMP AI POLICY RATIONALES TO WEAVE IN:
            {policy_rationales}
            
            The guest(s) MUST exactly match these selected guests: {json.dumps(selected_guests_context)}.
            
            SPEAKER LABEL REQUIREMENTS (STRICT):
            - For a host, you MUST set `isHost` to true, `isGuest` to false, and `hostId` exactly to their ID from the hosts list.
            - For guests, you MUST set `isGuest` to true, `isHost` to false, and `guestId` exactly to their ID from the list above. NEVER use generic labels like "Guest".
            
            HOSTS AVAILABLE:
            {json.dumps([{"id": h.get("id"), "name": h.get("name")} for h in hosts])}

            CRITICAL STRUCTURAL REQUIREMENTS:
            You must follow this exact rigid structure for the podcast transcript:
            
            1. INTRO SEGMENT:
               - Andrea Longton introduces the guests and their backgrounds, immediately drawing the connection to her social justice investor mission.
               - Incorporate the specific "Social Justice Investment Topics" and "AI & Social Justice Topics" provided above to build this connection.
               - IMPORTANT: Andrea should NEVER say "the title of this podcast is..." The intro must sound completely natural and organic.
               - For EACH guest:
                 * Andrea tees up the guest by briefly describing the overlap area (the center of the Venn diagram) between their expertise and social justice investing.
                 * The guest briefly discusses their side of the overlap and reiterates their alignment with social justice.
                 * Andrea summarizes the center of that Venn diagram in simpler words, highlighting how important it is to partner on this shared commonality.

            2. MAIN CONTENT SEGMENT:
               - Dive deep into the shared mission between social justice investing and AI social justice.
               - The conversation must be meaningful, deep, and organic. 
               - The flow should include Andrea talking to guests, guests asking each other questions, expanding on topics, and overlapping discussions.
               - Andrea should occasionally jump in during guest-to-guest dialogue to draw attention back to social justice investing.

            3. TRUMP AI POLICY SEGMENT:
               - Andrea must end the main segment by transitioning into a brief intro about Trump AI Policy.
               - She should explain why it is crucial to pay attention and push back.
               - She must summarize the specific AI policies that overlap with the podcast topic and guest bios.
               - The guests must then discuss this Trump AI policy, explicitly addressing the risks it poses to the core mission of social justice (e.g., fixing inequalities).

            4. CONCLUSION & CALL-TO-ACTION:
               - Andrea must conclude with explicit action items for listeners: e.g., buy the guest's book, sign up for their podcast, or join movements organized against the discussed Trump AI policies by the social justice coalition.
               - Andrea says goodbye and thanks her guests.
               - Andrea must use a witty, catchy sign-off slogan (do NOT use basic phrases like "until next time team social justice out"). She is witty as fuck.
               - Include an explicit cue indicating a fade out to a musical soundtrack at the very end.
            """
            
            report.add_info("Running AI transcript generation...")
            transcript_dict = run_ai_task(transcript_prompt, "Generate the transcript.", TranscriptOutput, cf_token, cf_account)
            transcript = transcript_dict.get("transcript", [])
            
            print(f"Uploading {len(transcript)} lines of transcript...")
            for tl in transcript:
                tl["transcriptId"] = transcript_id
            upload_resp = requests.post(f"{worker_url}/api/episodes/{episode_id}/transcript", json={"transcript": transcript, "transcriptId": transcript_id}, timeout=30)
            upload_resp.raise_for_status()
            print("✅ Transcript uploaded.")
            
            print("Saving Episode Guest Mapping...")
            primary_ids = [g["id"] for g in guests if g["name"] in selected_guest_names]
            backup_ids = [g["id"] for g in guests if g["name"] not in selected_guest_names]
            map_payload = {"primaryGuestIds": primary_ids, "backupGuestIds": backup_ids}
            try:
                map_resp = requests.post(f"{worker_url}/api/episodes/{episode_id}/guests", json=map_payload, timeout=30)
                map_resp.raise_for_status()
                print("✅ Episode guest mapping saved.")
            except Exception as me:
                print(f"⚠️ Failed to save guest mapping: {me}")

        
        # 2. Artwork check
        has_album = bool(episode.get("artworkUrl"))
        has_cover = bool(episode.get("coverPhotoUrl"))
        
        if has_album and has_cover:
            print("✅ Artwork & Cover Photo already exist. Skipping artwork generation.")
        else:
            report.add_info("Triggering artwork generation...")
            artwork_prompt = f"Podcast album art for an episode titled '{title}'. Topic: {desc}. High quality, professional, abstract, vibrant colors."
            cover_prompt = f"Podcast hero background cover photo for an episode titled '{title}'. Topic: {desc}. Professional, cinematic, minimal text."
            art_resp = requests.post(f"{worker_url}/api/episodes/{episode_id}/artwork", json={"albumPrompt": artwork_prompt, "coverPrompt": cover_prompt}, timeout=180)
            art_resp.raise_for_status()
            print("✅ Artwork generated & saved.")
        
    except Exception as e:
        print(f"Error generating transcript/artwork: {e}")

# Refined Voice Mapping for Aura 2
def get_voice_for_speaker(name: str, guests_list: list, hosts_list: list) -> str:
    name_lower = name.lower()
    
    # Andrea always uses Asteria (Aura 2 High-Fidelity Female)
    if "andrea" in name_lower:
        return "asteria"
        
    # Standardizing on Aura 2 models for 2026
    # Male: Orpheus, Orion, Neptune | Female: Asteria, Hera, Athena
    male_voices = ["orpheus", "orion", "neptune", "jupiter"]
    female_voices = ["asteria", "hera", "athena", "cora"]
    
    # Use a stable hash to keep guest voices consistent across episodes
    hash_val = int(hashlib.md5(name.encode("utf-8")).hexdigest(), 16)
    
    # Determine sex from DB or fallback
    guest_sex = next((g.get("sex") for g in guests_list if g.get("name") == name), None)
    
    if guest_sex == "M":
        return male_voices[hash_val % len(male_voices)]
    return female_voices[hash_val % len(female_voices)]

def process_episode(episode_id: str, cf_token: str, cf_account: str, worker_url: str, guests: list, hosts: list):
    # Idempotency check: Does it already have an audio track for the active transcript?
    try:
        ep_resp = requests.get(f"{worker_url}/api/episodes/{episode_id}", timeout=10)
        ep_resp.raise_for_status()
        episode_data = ep_resp.json()
        
        transcript_lines = episode_data.get("transcriptLines", [])
        active_lines = [tl for tl in transcript_lines if tl.get("isActive", True) in (1, True, "1", "true")]
        if not active_lines:
            print(f"No active transcript lines for episode {episode_id}. Cannot generate audio.")
            return
            
        transcript_id = active_lines[0].get("transcriptId")
        if not transcript_id:
            print(f"Active transcript for episode {episode_id} missing transcriptId. Skipping.")
            return
            
        podcast_audio = episode_data.get("podcastAudio", [])
        active_audio = [pa for pa in podcast_audio if pa.get("isActive", True) in (1, True, "1", "true")]
        
        if any(pa.get("transcriptId") == transcript_id for pa in active_audio):
            print(f"✅ Audio already exists for active transcript {transcript_id}. Skipping audio generation.")
            return
            
    except Exception as e:
        print(f"Failed to check existing audio: {e}")
        return

    print(f"Fetching audio manifest for episode {episode_id}...")
    # Provide transcriptId query param or filter locally
    manifest_url = f"{worker_url}/api/episodes/{episode_id}/audio-manifest?transcriptId={transcript_id}"
    try:
        resp = requests.get(manifest_url, timeout=10)
        resp.raise_for_status()
    except Exception as e:
        print(f"Failed to fetch manifest: {e}")
        return
        
    data = resp.json()
    manifest = data.get("manifest", [])
    
    if not manifest:
        print("Manifest is empty. No transcript lines found.")
        return
        
    print(f"Found {len(manifest)} transcript lines. Starting generation...")
    
    try:
        print("Downloading podcast theme music...")
        theme_resp = requests.get("https://pub-434f7a70bfdd41a382e8631347f40764.r2.dev/media/Blueprint_for_the_Block.mp3", timeout=30)
        theme_resp.raise_for_status()
        theme_audio = AudioSegment.from_file(io.BytesIO(theme_resp.content), format="mp3")
        
        # Intro: start at 5s (5000ms), 20s long (ends at 25000ms), 3s fade out
        intro_music = theme_audio[5000:25000].fade_out(3000)
        # Outro: start at 5s (5000ms) to the end, 2s fade in
        outro_music = theme_audio[5000:].fade_in(2000)
        
        combined_audio = intro_music
    except Exception as e:
        print(f"⚠️ Failed to download theme music, continuing without it: {e}")
        combined_audio = AudioSegment.empty()
        outro_music = AudioSegment.empty()
    # Ensure build directory exists
    output_dir = Path(f"./audio_build/{episode_id}")
    output_dir.mkdir(parents=True, exist_ok=True)
    
    pause = AudioSegment.silent(duration=500) # 500ms natural gap

    for idx, line in enumerate(manifest):
        text = line.get("transcriptLine")
        if not text:
            continue
            
        # Ensure correct pronunciation of Andrea by the TTS engine
        import re
        text = re.sub(r'\bAndrea\b', 'AN-dree-uh', text, flags=re.IGNORECASE)
            
        guestName = line.get("hostName") if line.get("isHost") else line.get("guestName")
        if not guestName:
            guestName = "Host"
            
        speaker = get_voice_for_speaker(guestName, guests, hosts)
        
        print(f"[{idx+1}/{len(manifest)}] Generating: {guestName} ({speaker})...")
        
        audio_bytes = generate_audio_for_line(text, speaker, cf_token, cf_account)
        
        if audio_bytes:
            try:
                segment = AudioSegment.from_file(io.BytesIO(audio_bytes), format="mp3")
                combined_audio += segment + pause
            except Exception as e:
                print(f"Error processing audio segment {idx}: {e}")
        
        # Respectful throttling for the AI Gateway
        time.sleep(0.2)
        
    combined_audio = combined_audio + outro_music
        
    final_output = f"./episode_{episode_id}.mp3"
    print(f"Exporting final podcast episode to {final_output}...")
    
    try:
        combined_audio.export(final_output, format="mp3", bitrate="192k")
        print("✅ Done!")
        
        # Upload to the Worker API
        worker_admin_token = get_secret("CLOUDFLARE_WORKER_ADMIN_TOKEN")
        
        print(f"Uploading podcast to R2 via API...")
        upload_url = f"{worker_url}/api/episodes/{episode_id}/audio?transcriptId={transcript_id}"
        upload_headers = {}
        if worker_admin_token:
            upload_headers["Authorization"] = f"Bearer {worker_admin_token}"
            
        with open(final_output, "rb") as f:
            upload_resp = requests.put(upload_url, headers=upload_headers, data=f, timeout=60)
            
        if upload_resp.status_code in (200, 201):
            print("✅ Successfully uploaded audio to R2!")
        else:
            print(f"⚠️ Upload failed (Status {upload_resp.status_code}): {upload_resp.text}")
            
    except Exception as e:
        print(f"Export or upload failed: {e}")

def check_api_health(worker_url: str):
    print(f"Checking API health for {worker_url}...")
    try:
        res = requests.get(f"{worker_url}/api/health", timeout=10)
        res.raise_for_status()
        print("✅ API is reachable and healthy.")
    except Exception as e:
        print(f"❌ API Health Check Failed! Please ensure the worker is deployed and running.")
        print(f"Error: {e}")
        sys.exit(1)

def main():
    # Using the standard naming from your environment setup
    cf_token = get_secret("CLOUDFLARE_AI_GATEWAY_TOKEN")
    cf_account = get_secret("CLOUDFLARE_ACCOUNT_ID")
    worker_url = os.environ.get("WORKER_URL", "https://renegade-capital.hacolby.workers.dev").rstrip('/')
    
    if not cf_token or not cf_account:
        print("ERROR: Missing Cloudflare Credentials (Token or Account ID)")
        sys.exit(1)
        
    check_api_health(worker_url)

    # Pre-step: Determine missing guest sexes
    try:
        report.add_step("Checking for guests missing sex properties...")
        missing_resp = requests.get(f"{worker_url}/api/guests/missing-sex", timeout=10)
        if missing_resp.status_code == 200:
            missing_guests = missing_resp.json().get("guests", [])
            if missing_guests:
                print(f"Found {len(missing_guests)} guests missing sex. Analyzing...")
                guest_info_list = [{"id": g.get("id"), "name": g.get("name"), "bio": g.get("personaDescription")} for g in missing_guests]
                prompt = f"Determine if each of these individuals is male ('M') or female ('F') based on their name and bio. If unknown, output 'Other'. Guests: {json.dumps(guest_info_list)}"
                res = run_ai_task(prompt, "Determine the sex of these guests.", BulkGuestSexOutput, cf_token, cf_account)
                updates = res.get("guests", [])
                
                print(f"Uploading sex determinations for {len(updates)} guests...")
                update_resp = requests.post(f"{worker_url}/api/guests/bulk-update-sex", json={"updates": updates}, timeout=30)
                update_resp.raise_for_status()
                print("✅ Guest sexes updated in DB.")
    except Exception as se:
        print(f"⚠️ Failed to update missing guest sexes: {se}")

    # Fetch updated guests and hosts
    guests = get_guests(worker_url)
    hosts = get_hosts(worker_url)

    # Pre-step: Generate missing transcripts
    pending_transcripts = get_pending_transcripts(worker_url)
    if pending_transcripts:
        report.add_info(f"Found {len(pending_transcripts)} episodes missing transcripts.")
        guests = get_guests(worker_url)
        hosts = get_hosts(worker_url)
        for ep_id in pending_transcripts:
            generate_transcript_and_artwork(ep_id, cf_token, cf_account, worker_url, guests, hosts)
    else:
        print("No episodes missing transcripts.")

    # Audio generation
    episodes_to_process = []
    
    if len(sys.argv) > 1:
        episodes_to_process = [sys.argv[1]]
    else:
        episodes_to_process = get_pending_episodes(worker_url)
        
    if not episodes_to_process:
        print("No episodes pending audio generation. Provide an ID manually or ensure there are transcripts ready.")
        sys.exit(0)
        
    report.add_info(f"Found {len(episodes_to_process)} episodes pending audio to process.")

    for episode_id in episodes_to_process:
        report.add_step(f"Processing Episode Audio: {episode_id}")
        process_episode(episode_id, cf_token, cf_account, worker_url, guests, hosts)

if __name__ == "__main__":
    main()