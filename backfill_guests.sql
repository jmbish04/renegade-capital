INSERT INTO episode_guest_map (episode_id, guest_id, is_primary)
SELECT DISTINCT episode_id, guest_id, 0
FROM episode_transcript_lines
WHERE guest_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM episode_guest_map 
    WHERE episode_guest_map.episode_id = episode_transcript_lines.episode_id 
      AND episode_guest_map.guest_id = episode_transcript_lines.guest_id
  );
