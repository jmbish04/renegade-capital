INSERT INTO episode_host_map (episode_id, host_id, is_primary)
SELECT id, 'c53f3e1a-5b12-4c2b-b413-5a0a382e2c56', 1 FROM episodes;

UPDATE episode_transcript_lines
SET is_host = 1, host_id = 'c53f3e1a-5b12-4c2b-b413-5a0a382e2c56'
WHERE guest_id IS NULL;

UPDATE episode_transcript_lines
SET is_guest = 1
WHERE guest_id IS NOT NULL;
