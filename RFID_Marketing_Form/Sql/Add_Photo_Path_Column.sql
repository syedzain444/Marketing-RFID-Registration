-- SPERS.RFID_CARD_ASSIGN_MARKETING — add employee photo path (18th column)
-- Matches the form field "Employee photo path" and ID card preview.
-- Oracle 11g. Run as SPERS or a user with ALTER privilege on this table.

-- Optional: confirm current columns (should list 17 before this change)
-- SELECT column_id, column_name, data_type, nullable
-- FROM   all_tab_columns
-- WHERE  owner = 'SPERS' AND table_name = 'RFID_CARD_ASSIGN_MARKETING'
-- ORDER BY column_id;

ALTER TABLE SPERS.RFID_CARD_ASSIGN_MARKETING
  ADD PHOTO_PATH VARCHAR2(500 BYTE);

COMMENT ON COLUMN SPERS.RFID_CARD_ASSIGN_MARKETING.PHOTO_PATH IS
  'Path or URL to the employee photo shown on the RFID ID card (optional).';

-- Optional: confirm the new column (should be COLUMN_ID 18)
-- SELECT column_id, column_name, data_type, data_length, nullable
-- FROM   all_tab_columns
-- WHERE  owner = 'SPERS' AND table_name = 'RFID_CARD_ASSIGN_MARKETING'
-- ORDER BY column_id;

COMMIT;
