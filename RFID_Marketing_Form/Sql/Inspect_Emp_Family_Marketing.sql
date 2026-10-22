-- List current EMP_FAMILY_MARKETING structure (run before/after upgrade).
-- Expected app columns include: DEPENDENT_ID, CARD_ID, CARD_NAME, RELATIONSHIP, CNIC, ...

SELECT owner, table_name
  FROM all_tables
 WHERE table_name = 'EMP_FAMILY_MARKETING'
 ORDER BY owner;

SELECT column_id, column_name, data_type, data_length, nullable
  FROM all_tab_columns
 WHERE table_name = 'EMP_FAMILY_MARKETING'
   AND owner = (
         SELECT MIN(owner)
           FROM all_tables
          WHERE table_name = 'EMP_FAMILY_MARKETING'
       )
 ORDER BY column_id;

SELECT constraint_name, constraint_type, search_condition
  FROM all_constraints
 WHERE table_name = 'EMP_FAMILY_MARKETING'
   AND owner = (
         SELECT MIN(owner)
           FROM all_tables
          WHERE table_name = 'EMP_FAMILY_MARKETING'
       )
 ORDER BY constraint_type, constraint_name;
