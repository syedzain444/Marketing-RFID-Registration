-- ETAG: electronic tag ID assigned at card print time (not on create/request form).
-- Oracle 11g+. Run as SPERS or a user with ALTER on both tables.

ALTER TABLE SPERS.RFID_CARD_ASSIGN_MARKETING ADD (
  ETAG VARCHAR2(50 BYTE)
);

COMMENT ON COLUMN SPERS.RFID_CARD_ASSIGN_MARKETING.ETAG IS
  'Electronic tag (E-Tag) assigned when the physical card is printed.';

ALTER TABLE SPERS.EMP_FAMILY_MARKETING ADD (
  ETAG VARCHAR2(50 BYTE)
);

COMMENT ON COLUMN SPERS.EMP_FAMILY_MARKETING.ETAG IS
  'Electronic tag (E-Tag) assigned when the family pass is printed.';

COMMIT;
