ALTER TABLE `contact_inquiry_recipients` ADD COLUMN `origin_mode` text;

UPDATE `contact_inquiry_recipients`
SET `origin_mode` = (
  SELECT `source`.`mode`
  FROM `contact_inquiry_recipients` AS `source`
  WHERE `source`.`recipient_type` = 'EMAIL'
    AND `source`.`email` = `contact_inquiry_recipients`.`email`
  ORDER BY `source`.`id` ASC
  LIMIT 1
)
WHERE `recipient_type` = 'EMAIL';
