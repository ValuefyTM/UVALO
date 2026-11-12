-- The feedback questionnaire appears only to people with at least 60 actions (was 30): the saved setting is raised too, so the
-- threshold changes at once, not only where no setting was ever saved. The default in src/lib/survey.ts is 60 as well.
UPDATE app_settings SET value = json_set(value, '$.min_actions', 60)
WHERE key = 'survey' AND json_valid(value) AND COALESCE(json_extract(value, '$.min_actions'), 0) < 60;
