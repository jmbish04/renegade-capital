# Renegade Capital Media Standards

## 1. Visual Identity ("The Monolith")
- **Prompting Rule:** All artwork generation prompts MUST include: "Editorial abstract photography, high-contrast, 'The Monolith' aesthetic. Deep blacks, vibrant light leaks. Cinematic textures, minimalist composition. No text, no people."
- **Color Palette Rotation:** Utilize `Cyan/Orange`, `Emerald/Gold`, or `Deep Purple/Magenta` based on programmatic rotation to maintain brand variation without breaking the core aesthetic.
- **Strictly Prohibited:** Faces, explicit text generation (SDXL struggles with text, breaking the high-end feel), and vector illustrations.

## 2. Transcript & Audio Flow ("Natural Voice Engine")
- **Structural Constraints:** Every podcast transcript must adhere to the 5-part structure:
  1. Intro (with Fake Sponsor)
  2. Passion Check (Venn Diagram Alignment)
  3. The Core (Deep Dive)
  4. Standing Policy Review (Policy Override)
  5. Action Items & Sign-off.
- **Tone:** Target audience is "Cultured Intellectuals." Use natural verbal fillers ("Right," "Exactly," "Let's pivot"). No generic host greetings.
- **Brotherly Humor:** Inject one (1) absurd, mildly embarrassing fake sponsor read per episode (e.g., *Constitutional Hemorrhoid Cream*) as a signature branding element.

## 3. Metadata Constraints
- **Episode Titles:** Strictly enforced at 3 to 5 words maximum. Punchy, high-impact phrasing. No subtitles.
- **Episode Descriptions:** Use a "Mystery-First" prompting style. Hook the listener before detailing the guest bio or policy overlaps.

## 4. Name Pronunciation Safety
- TTS engines (Deepgram Aura 2) frequently struggle with specific names.
- Always apply regex-based phonetic replacements in the final audio rendering loop before API submission.
- **Required Regex:** `re.sub(r'\bAndrea\b', 'AN-dree-uh', text, flags=re.IGNORECASE)`
