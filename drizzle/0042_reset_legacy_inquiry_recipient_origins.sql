-- Older recipient rows predate global-email selection; their origin is chosen
-- from the inquiry type where the administrator toggles the shared badge.
UPDATE `contact_inquiry_recipients`
SET `origin_mode` = NULL
WHERE `recipient_type` = 'EMAIL';
