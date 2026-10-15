-- Optional MySQL manual path, NOT an automatic startup migration.
-- Prefer the existing Hibernate ddl-auto=update path; never run both blindly.
-- Additive nullable columns only. Existing records remain intact and are not
-- backfilled with invented activity timestamps. Review the selected schema first.
SET @dal_lifecycle_schema = DATABASE();
SET @dal_lifecycle_ddl = IF(
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = @dal_lifecycle_schema AND table_name = 'user_locations' AND column_name = 'activity_at') = 0,
  'ALTER TABLE user_locations ADD COLUMN activity_at DATETIME(6) NULL', 'SELECT 1');
PREPARE dal_lifecycle_statement FROM @dal_lifecycle_ddl;
EXECUTE dal_lifecycle_statement;
DEALLOCATE PREPARE dal_lifecycle_statement;

SET @dal_lifecycle_ddl = IF(
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = @dal_lifecycle_schema AND table_name = 'location_sharing_settings' AND column_name = 'locations_valid_from') = 0,
  'ALTER TABLE location_sharing_settings ADD COLUMN locations_valid_from DATETIME(6) NULL', 'SELECT 1');
PREPARE dal_lifecycle_statement FROM @dal_lifecycle_ddl;
EXECUTE dal_lifecycle_statement;
DEALLOCATE PREPARE dal_lifecycle_statement;

SET @dal_lifecycle_ddl = IF(
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = @dal_lifecycle_schema AND table_name = 'group_members' AND column_name = 'locations_valid_from') = 0,
  'ALTER TABLE group_members ADD COLUMN locations_valid_from DATETIME(6) NULL', 'SELECT 1');
PREPARE dal_lifecycle_statement FROM @dal_lifecycle_ddl;
EXECUTE dal_lifecycle_statement;
DEALLOCATE PREPARE dal_lifecycle_statement;
