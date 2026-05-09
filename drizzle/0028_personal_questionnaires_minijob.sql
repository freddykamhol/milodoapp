ALTER TABLE `personal_questionnaires` ADD COLUMN `nationality` text NOT NULL DEFAULT '';

-- Minijob / GfB specific fields (used when kind = 'MINIJOB')
ALTER TABLE `personal_questionnaires` ADD COLUMN `social_security_number` text NOT NULL DEFAULT '';
ALTER TABLE `personal_questionnaires` ADD COLUMN `tax_id` text NOT NULL DEFAULT '';
ALTER TABLE `personal_questionnaires` ADD COLUMN `health_insurance` text NOT NULL DEFAULT '';
ALTER TABLE `personal_questionnaires` ADD COLUMN `insurance_status` text NOT NULL DEFAULT '';
ALTER TABLE `personal_questionnaires` ADD COLUMN `marital_status` text NOT NULL DEFAULT '';
ALTER TABLE `personal_questionnaires` ADD COLUMN `has_children` integer NOT NULL DEFAULT 0;
ALTER TABLE `personal_questionnaires` ADD COLUMN `children_count` integer;

ALTER TABLE `personal_questionnaires` ADD COLUMN `employment_status_json` text NOT NULL DEFAULT '[]';
ALTER TABLE `personal_questionnaires` ADD COLUMN `employment_status_other` text NOT NULL DEFAULT '';

ALTER TABLE `personal_questionnaires` ADD COLUMN `has_main_job` integer NOT NULL DEFAULT 0;
ALTER TABLE `personal_questionnaires` ADD COLUMN `main_job_employer` text NOT NULL DEFAULT '';

ALTER TABLE `personal_questionnaires` ADD COLUMN `has_other_minijobs` integer NOT NULL DEFAULT 0;
ALTER TABLE `personal_questionnaires` ADD COLUMN `other_minijobs_count` integer;
ALTER TABLE `personal_questionnaires` ADD COLUMN `other_minijobs_employers` text NOT NULL DEFAULT '';

ALTER TABLE `personal_questionnaires` ADD COLUMN `pension_choice` text NOT NULL DEFAULT '';

ALTER TABLE `personal_questionnaires` ADD COLUMN `tax_class` text NOT NULL DEFAULT '';
ALTER TABLE `personal_questionnaires` ADD COLUMN `confession` text NOT NULL DEFAULT '';

