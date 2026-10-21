-- SPERS.RFID_CARD_ASSIGN_MARKETING — reason when status is set Active / Inactive
-- Oracle 11g+. Run as SPERS or a user with ALTER privilege on this table.

ALTER TABLE SPERS.RFID_CARD_ASSIGN_MARKETING ADD (
  STATUS_REMARKS VARCHAR2(500 BYTE)
);

COMMENT ON COLUMN SPERS.RFID_CARD_ASSIGN_MARKETING.STATUS_REMARKS IS
  'Remarks captured when record status is changed to Active or Inactive.';

COMMIT;

