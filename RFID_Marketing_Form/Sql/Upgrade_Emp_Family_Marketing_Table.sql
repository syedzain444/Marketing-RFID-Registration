-- Upgrade EMP_FAMILY_MARKETING to match the app (RfidRepository.SaveFamilyCard).
-- *** Do NOT run Create_Emp_Family_Marketing_Table.sql if the table already exists. ***
--
-- Step 1 (optional): Sql/Inspect_Emp_Family_Marketing.sql
-- Step 2: This file (or Add_Emp_Family_Marketing_Columns.sql if PL/SQL fails)
-- Oracle 11g+. Prefer connecting as table owner (SPERS).

SET SERVEROUTPUT ON SIZE UNLIMITED;

DECLARE
  v_owner  VARCHAR2(128);
  v_tbl    NUMBER;
  v_max_id NUMBER;
  v_rid    ROWID;

  CURSOR c_missing IS
    SELECT ROWID FROM SPERS.EMP_FAMILY_MARKETING WHERE ID IS NULL;

  PROCEDURE add_col(p_name VARCHAR2, p_ddl VARCHAR2) IS
    v_n NUMBER;
  BEGIN
    SELECT COUNT(*)
      INTO v_n
      FROM all_tab_columns
     WHERE owner = v_owner
       AND table_name = 'EMP_FAMILY_MARKETING'
       AND column_name = UPPER(p_name);
    IF v_n = 0 THEN
      EXECUTE IMMEDIATE 'ALTER TABLE ' || v_owner || '.EMP_FAMILY_MARKETING ADD (' || p_ddl || ')';
      DBMS_OUTPUT.PUT_LINE('Added column ' || p_name);
    ELSE
      DBMS_OUTPUT.PUT_LINE('Column exists: ' || p_name);
    END IF;
  EXCEPTION
    WHEN OTHERS THEN
      IF SQLCODE = -1430 THEN
        DBMS_OUTPUT.PUT_LINE('Column already exists (1430): ' || p_name);
      ELSE
        RAISE;
      END IF;
  END;

  PROCEDURE run_ddl(p_sql VARCHAR2) IS
  BEGIN
    EXECUTE IMMEDIATE p_sql;
    DBMS_OUTPUT.PUT_LINE('OK: ' || SUBSTR(p_sql, 1, 90));
  EXCEPTION
    WHEN OTHERS THEN
      IF SQLCODE IN (-955, -1408, -2260, -2261, -2264, -2275, -2443, -1430, -1442) THEN
        DBMS_OUTPUT.PUT_LINE('Skip (' || SQLCODE || '): ' || SUBSTR(p_sql, 1, 75));
      ELSE
        DBMS_OUTPUT.PUT_LINE('FAIL (' || SQLCODE || '): ' || SUBSTR(p_sql, 1, 75));
        RAISE;
      END IF;
  END;

BEGIN
  SELECT COUNT(*), MIN(owner)
    INTO v_tbl, v_owner
    FROM all_tables
   WHERE table_name = 'EMP_FAMILY_MARKETING';

  IF v_tbl = 0 THEN
    RAISE_APPLICATION_ERROR(-20001, 'EMP_FAMILY_MARKETING not found. Run Create_Emp_Family_Marketing_Table.sql on empty DB.');
  END IF;

  DBMS_OUTPUT.PUT_LINE('Using owner: ' || v_owner);

  BEGIN
    EXECUTE IMMEDIATE
      'CREATE SEQUENCE ' || v_owner || '.EMP_FAMILY_MARKETING_SEQ START WITH 1 INCREMENT BY 1 NOCACHE NOCYCLE';
    DBMS_OUTPUT.PUT_LINE('Created sequence EMP_FAMILY_MARKETING_SEQ');
  EXCEPTION
    WHEN OTHERS THEN
      IF SQLCODE = -955 THEN
        DBMS_OUTPUT.PUT_LINE('Sequence EMP_FAMILY_MARKETING_SEQ already exists');
      ELSE
        RAISE;
      END IF;
  END;

  add_col('ID',                 'ID NUMBER');
  add_col('EMP_ID',             'EMP_ID VARCHAR2(20)');
  add_col('DEPENDENT_ID',       'DEPENDENT_ID NUMBER');
  add_col('CARD_ID',            'CARD_ID VARCHAR2(30)');
  add_col('CARD_NAME',          'CARD_NAME VARCHAR2(100)');
  add_col('RELATIONSHIP',       'RELATIONSHIP VARCHAR2(50)');
  add_col('CNIC',               'CNIC VARCHAR2(20)');
  add_col('RFID_NUMBER',        'RFID_NUMBER VARCHAR2(50)');
  add_col('ISSUE_DATE',         'ISSUE_DATE DATE');
  add_col('EXPIRY_DATE',        'EXPIRY_DATE DATE');
  add_col('ISSUED_BY',          'ISSUED_BY VARCHAR2(50)');
  add_col('PRINT_DATE',         'PRINT_DATE DATE');
  add_col('CREATED_DATE',       'CREATED_DATE DATE DEFAULT SYSDATE');
  add_col('STATUS',             'STATUS VARCHAR2(20) DEFAULT ''Active''');
  add_col('STATUS_REMARKS',     'STATUS_REMARKS VARCHAR2(500)');
  add_col('IS_APPROVED',        'IS_APPROVED VARCHAR2(1) DEFAULT ''N''');
  add_col('APPROVED_DATE',      'APPROVED_DATE DATE');
  add_col('APPROVE_ID',         'APPROVE_ID NUMBER');
  add_col('HOD_REMARKS',        'HOD_REMARKS VARCHAR2(500)');
  add_col('IS_FORWARD_HOD',     'IS_FORWARD_HOD VARCHAR2(1) DEFAULT ''N''');
  add_col('FORWARD_HOD_BY',     'FORWARD_HOD_BY VARCHAR2(100)');
  add_col('FORWARD_HOD_ON',     'FORWARD_HOD_ON DATE');
  add_col('REQUESTER_REMARKS',  'REQUESTER_REMARKS VARCHAR2(500)');
  add_col('IMAGE_PATH',         'IMAGE_PATH VARCHAR2(500)');

  BEGIN
    EXECUTE IMMEDIATE q'[
      MERGE INTO SPERS.EMP_FAMILY_MARKETING t
      USING (
        SELECT ROWID AS rid,
               ROW_NUMBER() OVER (PARTITION BY UPPER(TRIM(EMP_ID)) ORDER BY ROWID) AS dep_seq
          FROM SPERS.EMP_FAMILY_MARKETING
         WHERE DEPENDENT_ID IS NULL
      ) s
      ON (t.ROWID = s.rid)
      WHEN MATCHED THEN UPDATE SET t.DEPENDENT_ID = s.dep_seq
    ]';
  EXCEPTION
    WHEN OTHERS THEN
      DBMS_OUTPUT.PUT_LINE('Backfill DEPENDENT_ID skipped: ' || SQLERRM);
  END;

  EXECUTE IMMEDIATE 'UPDATE ' || v_owner || '.EMP_FAMILY_MARKETING SET CARD_ID = TRIM(EMP_ID) || ''-'' || TO_CHAR(DEPENDENT_ID) WHERE CARD_ID IS NULL AND EMP_ID IS NOT NULL AND DEPENDENT_ID IS NOT NULL';
  EXECUTE IMMEDIATE 'UPDATE ' || v_owner || '.EMP_FAMILY_MARKETING SET CARD_NAME = NVL(CARD_NAME, ''UNKNOWN'') WHERE CARD_NAME IS NULL';
  EXECUTE IMMEDIATE 'UPDATE ' || v_owner || '.EMP_FAMILY_MARKETING SET RELATIONSHIP = NVL(RELATIONSHIP, ''OTHER'') WHERE RELATIONSHIP IS NULL';
  EXECUTE IMMEDIATE 'UPDATE ' || v_owner || '.EMP_FAMILY_MARKETING SET STATUS = NVL(STATUS, ''Active'') WHERE STATUS IS NULL';
  EXECUTE IMMEDIATE 'UPDATE ' || v_owner || '.EMP_FAMILY_MARKETING SET IS_APPROVED = NVL(IS_APPROVED, ''N'') WHERE IS_APPROVED IS NULL';
  EXECUTE IMMEDIATE 'UPDATE ' || v_owner || '.EMP_FAMILY_MARKETING SET IS_FORWARD_HOD = NVL(IS_FORWARD_HOD, ''N'') WHERE IS_FORWARD_HOD IS NULL';
  EXECUTE IMMEDIATE 'UPDATE ' || v_owner || '.EMP_FAMILY_MARKETING SET CREATED_DATE = NVL(CREATED_DATE, SYSDATE) WHERE CREATED_DATE IS NULL';

  SELECT NVL(MAX(ID), 0) INTO v_max_id FROM SPERS.EMP_FAMILY_MARKETING;
  OPEN c_missing;
  LOOP
    FETCH c_missing INTO v_rid;
    EXIT WHEN c_missing%NOTFOUND;
    v_max_id := v_max_id + 1;
    UPDATE SPERS.EMP_FAMILY_MARKETING SET ID = v_max_id WHERE ROWID = v_rid;
  END LOOP;
  CLOSE c_missing;

  run_ddl('ALTER TABLE ' || v_owner || '.EMP_FAMILY_MARKETING MODIFY (ID NOT NULL)');
  run_ddl('ALTER TABLE ' || v_owner || '.EMP_FAMILY_MARKETING MODIFY (EMP_ID NOT NULL)');
  run_ddl('ALTER TABLE ' || v_owner || '.EMP_FAMILY_MARKETING MODIFY (DEPENDENT_ID NOT NULL)');
  run_ddl('ALTER TABLE ' || v_owner || '.EMP_FAMILY_MARKETING MODIFY (CARD_ID NOT NULL)');
  run_ddl('ALTER TABLE ' || v_owner || '.EMP_FAMILY_MARKETING MODIFY (CARD_NAME NOT NULL)');
  run_ddl('ALTER TABLE ' || v_owner || '.EMP_FAMILY_MARKETING MODIFY (RELATIONSHIP NOT NULL)');
  run_ddl('ALTER TABLE ' || v_owner || '.EMP_FAMILY_MARKETING MODIFY (STATUS NOT NULL)');
  run_ddl('ALTER TABLE ' || v_owner || '.EMP_FAMILY_MARKETING MODIFY (IS_APPROVED NOT NULL)');
  run_ddl('ALTER TABLE ' || v_owner || '.EMP_FAMILY_MARKETING MODIFY (IS_FORWARD_HOD NOT NULL)');

  run_ddl('ALTER TABLE ' || v_owner || '.EMP_FAMILY_MARKETING ADD CONSTRAINT PK_EMP_FAMILY_MARKETING PRIMARY KEY (ID)');
  run_ddl('ALTER TABLE ' || v_owner || '.EMP_FAMILY_MARKETING ADD CONSTRAINT UK_EMP_FAMILY_CARD_ID UNIQUE (CARD_ID)');
  run_ddl('ALTER TABLE ' || v_owner || '.EMP_FAMILY_MARKETING ADD CONSTRAINT UK_EMP_FAMILY_EMP_DEP UNIQUE (EMP_ID, DEPENDENT_ID)');
  run_ddl('ALTER TABLE ' || v_owner || '.EMP_FAMILY_MARKETING ADD CONSTRAINT CK_EMP_FAMILY_STATUS CHECK (STATUS IN (''Active'', ''Inactive''))');
  run_ddl('ALTER TABLE ' || v_owner || '.EMP_FAMILY_MARKETING ADD CONSTRAINT CK_EMP_FAMILY_APPROVED CHECK (IS_APPROVED IN (''Y'', ''N''))');
  run_ddl('ALTER TABLE ' || v_owner || '.EMP_FAMILY_MARKETING ADD CONSTRAINT CK_EMP_FAMILY_FWD CHECK (IS_FORWARD_HOD IN (''Y'', ''N''))');

  run_ddl('CREATE INDEX ' || v_owner || '.IX_EMP_FAMILY_EMP_ID ON ' || v_owner || '.EMP_FAMILY_MARKETING (EMP_ID)');
  run_ddl('CREATE INDEX ' || v_owner || '.IX_EMP_FAMILY_RFID ON ' || v_owner || '.EMP_FAMILY_MARKETING (RFID_NUMBER)');

  FOR r IN (
    SELECT column_name
      FROM all_tab_columns
     WHERE owner = v_owner
       AND table_name = 'EMP_FAMILY_MARKETING'
     ORDER BY column_id
  ) LOOP
    DBMS_OUTPUT.PUT_LINE('Col: ' || r.column_name);
  END LOOP;

  DBMS_OUTPUT.PUT_LINE('Upgrade finished for ' || v_owner || '.EMP_FAMILY_MARKETING');
END;
/

COMMENT ON TABLE SPERS.EMP_FAMILY_MARKETING IS
  'RFID family / dependent cards for employees listed in RFID_CARD_ASSIGN_MARKETING.';
COMMENT ON COLUMN SPERS.EMP_FAMILY_MARKETING.EMP_ID IS
  'Primary employee ID (must exist on employee RFID assignment).';
COMMENT ON COLUMN SPERS.EMP_FAMILY_MARKETING.DEPENDENT_ID IS
  'Sequence per employee: 1, 2, 3 used in CARD_ID.';
COMMENT ON COLUMN SPERS.EMP_FAMILY_MARKETING.CARD_ID IS
  'Printed card ID, typically EMP_ID || ''-'' || DEPENDENT_ID.';
COMMENT ON COLUMN SPERS.EMP_FAMILY_MARKETING.CARD_NAME IS
  'Dependent name as printed on the family card.';
COMMENT ON COLUMN SPERS.EMP_FAMILY_MARKETING.RELATIONSHIP IS
  'Relationship to employee (e.g. MOTHER, SPOUSE, SON).';
COMMENT ON COLUMN SPERS.EMP_FAMILY_MARKETING.CNIC IS
  'Dependent CNIC as printed on the card.';
COMMENT ON COLUMN SPERS.EMP_FAMILY_MARKETING.IMAGE_PATH IS
  'Relative path to dependent photo under Photos folder.';

COMMIT;
