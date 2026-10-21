-- SPERS.RFID_CARD_ASSIGN_MARKETING — employee profile fields from the RFID form
-- Name, Designation, Department, Project / Location
-- Oracle 11g+. Run as SPERS or a user with ALTER privilege on this table.

-- Optional: list columns before change
-- SELECT column_id, column_name, data_type, data_length, nullable
-- FROM   all_tab_columns
-- WHERE  owner = 'SPERS' AND table_name = 'RFID_CARD_ASSIGN_MARKETING'
-- ORDER BY column_id;

ALTER TABLE SPERS.RFID_CARD_ASSIGN_MARKETING ADD (
  CARD_NAME        VARCHAR2(100 BYTE),
  DESIGNATION      VARCHAR2(100 BYTE),
  DEPARTMENT       VARCHAR2(100 BYTE),
  PROJECT_LOCATION VARCHAR2(100 BYTE)
);

COMMENT ON COLUMN SPERS.RFID_CARD_ASSIGN_MARKETING.CARD_NAME IS
  'Employee full name as printed on the RFID card.';
COMMENT ON COLUMN SPERS.RFID_CARD_ASSIGN_MARKETING.DESIGNATION IS
  'Job title / designation.';
COMMENT ON COLUMN SPERS.RFID_CARD_ASSIGN_MARKETING.DEPARTMENT IS
  'Department name.';
COMMENT ON COLUMN SPERS.RFID_CARD_ASSIGN_MARKETING.PROJECT_LOCATION IS
  'Project or work location.';

COMMIT;
