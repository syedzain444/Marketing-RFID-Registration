using System;
using System.Collections.Generic;
using System.Configuration;
using System.Data;
using System.Globalization;
using System.Text.RegularExpressions;
using Oracle.ManagedDataAccess.Client;

namespace RFID_Marketing_Form.Data
{
    /// <summary>Employee RFID Management: active employees from V_EMPS; RFID stored in RFID_CARD_ASSIGN.</summary>
    public class EmpAssignRfidRepository
    {
        private const string ConnectionName = "OracleConnection";
        private const string TableQualified = "SPERS.V_EMPS + SPERS.RFID_CARD_ASSIGN";

        private const string VEmpsActivePredicate = "UPPER(TRIM(NVL(e.EMP_STATUS, 'A'))) <> 'N'";

        private const string VEmpsProfileSelect =
            @"e.ENAME AS EMPLOYEE_NAME, e.DGN_NM AS EMP_DGN_NM, e.DPT_NM AS EMP_DPT_NM,
              e.GRD_AB AS EMP_GRD_AB, e.GRD_ID AS EMP_GRD_ID";

        private const string VEmpsProfileSelectDetail =
            @"e.ENAME AS EMPLOYEE_NAME, e.DGN_NM AS DESIGNATION, e.DPT_NM AS DEPARTMENT, e.PRJ_NM AS PROJECT_LOCATION,
              e.DT_JOIN AS JOINING_DATE, e.BLD_GRP AS BLOOD_GROUP, e.CNIC AS CNIC, e.EMP_STATUS AS EMP_STATUS,
              e.GRD_AB AS EMP_GRD_AB, e.GRD_ID AS EMP_GRD_ID";

        private const string VEmpsActiveExistsForEmpMst =
            @"EXISTS (
                  SELECT 1 FROM SPERS.V_EMPS v
                  WHERE TRIM(v.EMP_ID) = TRIM(emp.EMP_ID)
                    AND UPPER(TRIM(NVL(v.EMP_STATUS, 'A'))) <> 'N'
              )";

        /// <summary>Latest RFID_CARD_ASSIGN row per employee (inline view — avoids ORA-01799 outer-join-to-subquery).</summary>
        /// <summary>Card/grid &quot;Issue date&quot; = RFID_CARD_ASSIGN.PRINT_DATE (fallback ISSUE_DATE if print not set yet).</summary>
        private const string AssignCardIssueDateSql = "NVL(a.PRINT_DATE, a.ISSUE_DATE)";

        private const string LatestAssignPerEmpSubquery =
            @"SELECT a2.ID, a2.EMP_ID, a2.RFID_NUMBER, a2.STATUS, a2.ISSUE_DATE, a2.PRINT_DATE, a2.EXPIRY_DATE, a2.ISSUED_BY,
                     a2.IS_APPROVED, a2.CREATED_DATE, a2.HOD_REMARKS
              FROM SPERS.RFID_CARD_ASSIGN a2
              INNER JOIN (
                  SELECT TRIM(EMP_ID) AS EMP_ID_KEY, MAX(ID) AS MAX_ID
                  FROM SPERS.RFID_CARD_ASSIGN
                  GROUP BY TRIM(EMP_ID)
              ) latest ON TRIM(a2.EMP_ID) = latest.EMP_ID_KEY AND a2.ID = latest.MAX_ID";

        private const string ListSql =
            @"SELECT NVL(a.ID, 0) AS ID,
                     TRIM(e.EMP_ID) AS EMP_ID,
                     a.RFID_NUMBER, a.STATUS, " + AssignCardIssueDateSql + @" AS ISSUE_DATE, a.PRINT_DATE, a.EXPIRY_DATE, a.ISSUED_BY, a.IS_APPROVED, a.CREATED_DATE,
                     a.HOD_REMARKS,
                     " + VEmpsProfileSelect + @"
              FROM SPERS.V_EMPS e
              LEFT JOIN (" + LatestAssignPerEmpSubquery + @") a ON TRIM(a.EMP_ID) = TRIM(e.EMP_ID)
              WHERE " + VEmpsActivePredicate + @"
              ORDER BY TRIM(e.EMP_ID)";

        /// <summary>By assign ID — HR RFID_CARD_ASSIGN columns only; profile from EMP_MST (not marketing forward/request columns).</summary>
        private const string DetailSql =
            @"SELECT a.ID, a.EMP_ID, a.RFID_NUMBER, a.STATUS, NVL(a.PRINT_DATE, a.ISSUE_DATE) AS ISSUE_DATE, a.EXPIRY_DATE, a.ISSUED_BY, a.PRINT_DATE, a.CREATED_DATE,
                     a.IS_APPROVED,
                     CAST(NULL AS DATE) AS APPROVED_DATE,
                     CAST(NULL AS NUMBER) AS APPROVE_ID,
                     a.HOD_REMARKS,
                     CAST(NULL AS VARCHAR2(1)) AS IS_FORWARD_HOD,
                     CAST(NULL AS VARCHAR2(100)) AS FORWARD_HOD_BY,
                     CAST(NULL AS DATE) AS FORWARD_HOD_ON,
                     CAST(NULL AS VARCHAR2(500)) AS REQUESTER_REMARKS,
                     emp.ENAME AS EMPLOYEE_NAME,
                     dgn.DGN_NM AS DESIGNATION,
                     dpt.DPT_NM AS DEPARTMENT,
                     prj.PRJ_NM AS PROJECT_LOCATION,
                     emp.DT_JOIN AS JOINING_DATE,
                     emp.BLD_GRP AS BLOOD_GROUP,
                     emp.CNIC AS CNIC,
                     emp.EMP_STATUS AS EMP_STATUS,
                     grd.GRD_AB AS EMP_GRD_AB,
                     dgn.GRD_ID AS EMP_GRD_ID,
                     CAST(NULL AS VARCHAR2(50)) AS EMERGENCY_NO
              FROM SPERS.RFID_CARD_ASSIGN a
              LEFT JOIN SPERS.EMP_MST emp ON TRIM(a.EMP_ID) = TRIM(emp.EMP_ID)
              LEFT JOIN SPERS.PRJ_MST prj ON emp.PRJ_ID = prj.PRJ_ID
              LEFT JOIN SPERS.DPT_MST dpt ON emp.DPT_ID = dpt.DPT_ID
              LEFT JOIN SPERS.DGN_MST dgn ON emp.DGN_ID = dgn.DGN_ID
              LEFT JOIN SPERS.GRD_MST grd ON dgn.GRD_ID = grd.GRD_ID
              WHERE a.ID = :id";

        /// <summary>Print/card preview: EmpCard emp_mst joins; active filter via V_EMPS.</summary>
        private const string DetailByEmpSql =
            @"SELECT 0 AS ID,
                     TRIM(emp.EMP_ID) AS EMP_ID,
                     CAST(NULL AS VARCHAR2(50)) AS RFID_NUMBER,
                     CAST(NULL AS VARCHAR2(20)) AS STATUS,
                     CAST(NULL AS DATE) AS ISSUE_DATE,
                     CAST(NULL AS DATE) AS EXPIRY_DATE,
                     CAST(NULL AS VARCHAR2(50)) AS ISSUED_BY,
                     CAST(NULL AS DATE) AS PRINT_DATE,
                     CAST(NULL AS DATE) AS CREATED_DATE,
                     CAST(NULL AS VARCHAR2(1)) AS IS_APPROVED,
                     CAST(NULL AS DATE) AS APPROVED_DATE,
                     CAST(NULL AS NUMBER) AS APPROVE_ID,
                     CAST(NULL AS VARCHAR2(500)) AS HOD_REMARKS,
                     CAST(NULL AS VARCHAR2(1)) AS IS_FORWARD_HOD,
                     CAST(NULL AS VARCHAR2(100)) AS FORWARD_HOD_BY,
                     CAST(NULL AS DATE) AS FORWARD_HOD_ON,
                     CAST(NULL AS VARCHAR2(500)) AS REQUESTER_REMARKS,
                     emp.ENAME AS EMPLOYEE_NAME,
                     dgn.DGN_NM AS DESIGNATION,
                     dpt.DPT_NM AS DEPARTMENT,
                     prj.PRJ_NM AS PROJECT_LOCATION,
                     emp.DT_JOIN AS JOINING_DATE,
                     emp.BLD_GRP AS BLOOD_GROUP,
                     emp.CNIC AS CNIC,
                     emp.EMP_STATUS AS EMP_STATUS,
                     grd.GRD_AB AS EMP_GRD_AB,
                     dgn.GRD_ID AS EMP_GRD_ID,
                     CAST(NULL AS VARCHAR2(50)) AS EMERGENCY_NO
              FROM SPERS.EMP_MST emp
              LEFT JOIN SPERS.PRJ_MST prj ON emp.PRJ_ID = prj.PRJ_ID
              LEFT JOIN SPERS.DPT_MST dpt ON emp.DPT_ID = dpt.DPT_ID
              LEFT JOIN SPERS.DGN_MST dgn ON emp.DGN_ID = dgn.DGN_ID
              LEFT JOIN SPERS.GRD_MST grd ON dgn.GRD_ID = grd.GRD_ID
              WHERE TRIM(emp.EMP_ID) = TRIM(:emp_id)
                AND " + VEmpsActiveExistsForEmpMst;

        public RfidRecordsResult ListRecords()
        {
            string cs;
            string missing;
            if (!TryConnectionString(out cs, out missing))
            {
                return RfidRecordsResult.Fail(missing);
            }

            try
            {
                var rows = new List<RfidRecord>();
                using (var conn = new OracleConnection(cs))
                {
                    conn.Open();
                    using (var cmd = new OracleCommand(ListSql, conn))
                    {
                        cmd.BindByName = true;
                        using (var reader = cmd.ExecuteReader())
                        {
                            while (reader.Read())
                            {
                                rows.Add(ReadSummary(reader));
                            }
                        }
                    }

                }

                return new RfidRecordsResult
                {
                    Ok = true,
                    TableName = TableQualified,
                    Records = rows
                };
            }
            catch (Exception ex)
            {
                return RfidRecordsResult.Fail(RfidErrors.Describe(ex));
            }
        }

        public RfidRecordsResult GetRecord(decimal id)
        {
            if (id <= 0)
            {
                return RfidRecordsResult.Fail("A valid record ID is required.");
            }

            string cs;
            string missing;
            if (!TryConnectionString(out cs, out missing))
            {
                return RfidRecordsResult.Fail(missing);
            }

            try
            {
                using (var conn = new OracleConnection(cs))
                {
                    conn.Open();
                    using (var cmd = new OracleCommand(DetailSql, conn))
                    {
                        cmd.BindByName = true;
                        cmd.Parameters.Add("id", OracleDbType.Decimal).Value = id;
                        using (var reader = cmd.ExecuteReader())
                        {
                            if (!reader.Read())
                            {
                                return RfidRecordsResult.Fail("Record not found.");
                            }

                            var record = ReadDetail(reader);
                            TryEnrichEmergencyFromEmpMst(conn, record);
                            ApplyAssignCardIssueDateFromPrint(record);
                            return new RfidRecordsResult
                            {
                                Ok = true,
                                TableName = TableQualified,
                                Record = record,
                                FamilyCards = new List<FamilyCardRecord>()
                            };
                        }
                    }
                }
            }
            catch (Exception ex)
            {
                return RfidRecordsResult.Fail(RfidErrors.DescribeAssign(ex));
            }
        }

        /// <summary>Card/print payload from V_EMPS (active) with optional latest RFID_CARD_ASSIGN.</summary>
        public RfidRecordsResult GetRecordByEmpId(string empId)
        {
            if (string.IsNullOrWhiteSpace(empId))
            {
                return RfidRecordsResult.Fail("Employee ID is required.");
            }

            string cs;
            string missing;
            if (!TryConnectionString(out cs, out missing))
            {
                return RfidRecordsResult.Fail(missing);
            }

            try
            {
                using (var conn = new OracleConnection(cs))
                {
                    conn.Open();
                    using (var cmd = new OracleCommand(DetailByEmpSql, conn))
                    {
                        cmd.BindByName = true;
                        cmd.Parameters.Add("emp_id", OracleDbType.Varchar2).Value = empId.Trim();
                        using (var reader = cmd.ExecuteReader())
                        {
                            if (!reader.Read())
                            {
                                return RfidRecordsResult.Fail("Employee not found in V_EMPS or is not active (EMP_STATUS = N).");
                            }

                            var record = ReadDetail(reader);
                            TryEnrichEmergencyFromEmpMst(conn, record);
                            TryEnrichLatestAssignFromTable(conn, record);
                            TryEnrichIssueDateFromAssign(conn, record);
                            ApplyAssignCardIssueDateFromPrint(record);
                            return new RfidRecordsResult
                            {
                                Ok = true,
                                TableName = TableQualified,
                                Record = record,
                                FamilyCards = new List<FamilyCardRecord>()
                            };
                        }
                    }
                }
            }
            catch (Exception ex)
            {
                return RfidRecordsResult.Fail(RfidErrors.DescribeAssign(ex));
            }
        }

        public RfidRecordsResult SetStatus(decimal id, string status, string remarks)
        {
            if (id <= 0)
            {
                return RfidRecordsResult.Fail("A valid record ID is required.");
            }

            var dbStatus = ToDbActiveInactive(status);
            if (dbStatus == null)
            {
                return RfidRecordsResult.Fail("Status must be Active or Inactive.");
            }

            if (string.IsNullOrWhiteSpace(remarks))
            {
                return RfidRecordsResult.Fail("Please enter remarks for this status change.");
            }

            remarks = remarks.Trim();
            if (remarks.Length > 500)
            {
                remarks = remarks.Substring(0, 500);
            }

            string cs;
            string missing;
            if (!TryConnectionString(out cs, out missing))
            {
                return RfidRecordsResult.Fail(missing);
            }

            try
            {
                using (var conn = new OracleConnection(cs))
                {
                    conn.Open();
                    string current;
                    using (var load = new OracleCommand(
                        "SELECT UPPER(TRIM(STATUS)) FROM SPERS.RFID_CARD_ASSIGN WHERE ID = :id AND ROWNUM = 1", conn))
                    {
                        load.BindByName = true;
                        load.Parameters.Add("id", OracleDbType.Decimal).Value = id;
                        var o = load.ExecuteScalar();
                        if (o == null || o == DBNull.Value)
                        {
                            return RfidRecordsResult.Fail("Record not found.");
                        }

                        current = Convert.ToString(o, CultureInfo.InvariantCulture);
                    }

                    if (current != "ACTIVE" && current != "INACTIVE")
                    {
                        return RfidRecordsResult.Fail(
                            "Only records with status ACTIVE or INACTIVE can be toggled here (current: " + current + ").");
                    }

                    const string sql =
                        @"UPDATE SPERS.RFID_CARD_ASSIGN
                          SET STATUS = :status,
                              HOD_REMARKS = :remarks,
                              ISSUE_DATE = CASE WHEN :status = 'ACTIVE' THEN SYSDATE ELSE ISSUE_DATE END,
                              EXPIRY_DATE = CASE WHEN :status = 'INACTIVE' THEN SYSDATE ELSE EXPIRY_DATE END
                          WHERE ID = :id";
                    using (var cmd = new OracleCommand(sql, conn))
                    {
                        cmd.BindByName = true;
                        cmd.Parameters.Add("status", OracleDbType.Varchar2).Value = dbStatus;
                        cmd.Parameters.Add("remarks", OracleDbType.Varchar2).Value = remarks;
                        cmd.Parameters.Add("id", OracleDbType.Decimal).Value = id;
                        var rows = cmd.ExecuteNonQuery();
                        if (rows != 1)
                        {
                            return RfidRecordsResult.Fail("Record not found or status was not updated.");
                        }
                    }
                }

                var updated = GetRecord(id);
                if (updated != null && updated.Ok && updated.Record != null)
                {
                    updated.Status = ToUiStatus(dbStatus);
                    updated.StatusRemarks = remarks;
                }

                return updated ?? new RfidRecordsResult
                {
                    Ok = true,
                    TableName = TableQualified,
                    Status = ToUiStatus(dbStatus),
                    StatusRemarks = remarks
                };
            }
            catch (Exception ex)
            {
                return RfidRecordsResult.Fail(RfidErrors.Describe(ex));
            }
        }

        public RfidRecordsResult UpdateEmployeeProfile(
            decimal id,
            string employeeName,
            string designation,
            string department,
            string projectLocation,
            string joiningDateText,
            string bloodGroup,
            string cnic,
            string emergencyNo,
            string photoPath)
        {
            if (id <= 0)
            {
                return RfidRecordsResult.Fail("A valid record ID is required.");
            }

            return RfidRecordsResult.Fail(
                "Employee profile fields come from V_EMPS and cannot be edited on this screen.");
        }

        /// <summary>Save RFID from grid: upsert ACTIVE row in RFID_CARD_ASSIGN for an active V_EMPS employee.</summary>
        public RfidRecordsResult SaveGridRfid(string empId, string rfidNumber, string issuedBy)
        {
            if (string.IsNullOrWhiteSpace(empId))
            {
                return RfidRecordsResult.Fail("Employee ID is required.");
            }

            empId = empId.Trim();
            rfidNumber = TrimMax(rfidNumber, 50);
            if (string.IsNullOrWhiteSpace(rfidNumber))
            {
                return RfidRecordsResult.Fail("Enter an RFID number.");
            }

            if (rfidNumber.Length < 4 || !RfidValidator.IsRfid(rfidNumber))
            {
                return RfidRecordsResult.Fail(
                    "RFID number must be 4 to 50 characters: letters, numbers, spaces, hyphens, or colons.");
            }

            issuedBy = TrimMax(issuedBy, 50);
            if (string.IsNullOrWhiteSpace(issuedBy))
            {
                issuedBy = "HR_ADMIN";
            }
            else if (!RfidValidator.IsPersonName(issuedBy))
            {
                return RfidRecordsResult.Fail("Issued by must be 1 to 50 characters: letters, numbers, spaces, and . ' -");
            }

            string cs;
            string missing;
            if (!TryConnectionString(out cs, out missing))
            {
                return RfidRecordsResult.Fail(missing);
            }

            try
            {
                using (var conn = new OracleConnection(cs))
                {
                    conn.Open();

                    if (!IsActiveEmployeeInVemps(conn, empId))
                    {
                        return RfidRecordsResult.Fail("Employee is not active in V_EMPS.");
                    }

                    decimal? existingAssignId = null;
                    using (var dupRfid = new OracleCommand(
                        @"SELECT ID, TRIM(EMP_ID) AS EMP_ID FROM SPERS.RFID_CARD_ASSIGN
                          WHERE UPPER(TRIM(RFID_NUMBER)) = UPPER(TRIM(:rfid))
                            AND UPPER(TRIM(NVL(STATUS, ' '))) = 'ACTIVE'
                            AND ROWNUM = 1",
                        conn))
                    {
                        dupRfid.BindByName = true;
                        dupRfid.Parameters.Add("rfid", OracleDbType.Varchar2).Value = rfidNumber;
                        using (var reader = dupRfid.ExecuteReader())
                        {
                            if (reader.Read())
                            {
                                var otherEmp = ReadString(reader, "EMP_ID");
                                if (!string.Equals(otherEmp, empId, StringComparison.OrdinalIgnoreCase))
                                {
                                    return RfidRecordsResult.Fail(
                                        "This RFID number is already assigned to employee " + otherEmp + ".");
                                }

                                existingAssignId = ReadDecimal(reader, "ID");
                            }
                        }
                    }

                    using (var tran = conn.BeginTransaction())
                    {
                        try
                        {
                            using (var deactivateEmp = new OracleCommand(
                                @"UPDATE SPERS.RFID_CARD_ASSIGN
                                  SET STATUS = 'INACTIVE'
                                  WHERE TRIM(EMP_ID) = TRIM(:emp)
                                    AND UPPER(TRIM(NVL(STATUS, ' '))) = 'ACTIVE'
                                    AND (:keep_id IS NULL OR ID <> :keep_id)",
                                conn))
                            {
                                deactivateEmp.Transaction = tran;
                                deactivateEmp.BindByName = true;
                                deactivateEmp.Parameters.Add("emp", OracleDbType.Varchar2).Value = empId;
                                deactivateEmp.Parameters.Add("keep_id", OracleDbType.Decimal).Value =
                                    existingAssignId.HasValue && existingAssignId.Value > 0
                                        ? (object)existingAssignId.Value
                                        : DBNull.Value;
                                deactivateEmp.ExecuteNonQuery();
                            }

                            using (var deactivateRfid = new OracleCommand(
                                @"UPDATE SPERS.RFID_CARD_ASSIGN
                                  SET STATUS = 'INACTIVE'
                                  WHERE UPPER(TRIM(RFID_NUMBER)) = UPPER(TRIM(:rfid))
                                    AND UPPER(TRIM(NVL(STATUS, ' '))) = 'ACTIVE'
                                    AND (:keep_id IS NULL OR ID <> :keep_id)",
                                conn))
                            {
                                deactivateRfid.Transaction = tran;
                                deactivateRfid.BindByName = true;
                                deactivateRfid.Parameters.Add("rfid", OracleDbType.Varchar2).Value = rfidNumber;
                                deactivateRfid.Parameters.Add("keep_id", OracleDbType.Decimal).Value =
                                    existingAssignId.HasValue && existingAssignId.Value > 0
                                        ? (object)existingAssignId.Value
                                        : DBNull.Value;
                                deactivateRfid.ExecuteNonQuery();
                            }

                            decimal savedId;
                            if (existingAssignId.HasValue && existingAssignId.Value > 0)
                            {
                                savedId = existingAssignId.Value;
                                using (var update = new OracleCommand(
                                    @"UPDATE SPERS.RFID_CARD_ASSIGN
                                      SET RFID_NUMBER = :rfid,
                                          ISSUE_DATE = NVL(ISSUE_DATE, SYSDATE),
                                          EXPIRY_DATE = NVL(EXPIRY_DATE, ADD_MONTHS(SYSDATE, 12)),
                                          ISSUED_BY = :issued_by,
                                          STATUS = 'ACTIVE',
                                          PRINT_DATE = NVL(PRINT_DATE, SYSDATE)
                                      WHERE ID = :id",
                                    conn))
                                {
                                    update.Transaction = tran;
                                    update.BindByName = true;
                                    update.Parameters.Add("rfid", OracleDbType.Varchar2).Value = rfidNumber;
                                    update.Parameters.Add("issued_by", OracleDbType.Varchar2).Value = issuedBy;
                                    update.Parameters.Add("id", OracleDbType.Decimal).Value = savedId;
                                    update.ExecuteNonQuery();
                                }
                            }
                            else
                            {
                                using (var insert = new OracleCommand(
                                    @"INSERT INTO SPERS.RFID_CARD_ASSIGN
                                      (EMP_ID, RFID_NUMBER, STATUS, ISSUE_DATE, EXPIRY_DATE, ISSUED_BY, PRINT_DATE, CREATED_DATE, IS_APPROVED)
                                      VALUES
                                      (:emp, :rfid, 'ACTIVE', SYSDATE, ADD_MONTHS(SYSDATE, 12), :issued_by, SYSDATE, SYSDATE, 'Y')",
                                    conn))
                                {
                                    insert.Transaction = tran;
                                    insert.BindByName = true;
                                    insert.Parameters.Add("emp", OracleDbType.Varchar2).Value = empId;
                                    insert.Parameters.Add("rfid", OracleDbType.Varchar2).Value = rfidNumber;
                                    insert.Parameters.Add("issued_by", OracleDbType.Varchar2).Value = issuedBy;
                                    insert.ExecuteNonQuery();
                                }

                                using (var loadId = new OracleCommand(
                                    @"SELECT ID FROM (
                                          SELECT ID FROM SPERS.RFID_CARD_ASSIGN
                                          WHERE TRIM(EMP_ID) = TRIM(:emp)
                                            AND UPPER(TRIM(RFID_NUMBER)) = UPPER(TRIM(:rfid))
                                          ORDER BY ID DESC
                                      ) WHERE ROWNUM = 1",
                                    conn))
                                {
                                    loadId.Transaction = tran;
                                    loadId.BindByName = true;
                                    loadId.Parameters.Add("emp", OracleDbType.Varchar2).Value = empId;
                                    loadId.Parameters.Add("rfid", OracleDbType.Varchar2).Value = rfidNumber;
                                    var o = loadId.ExecuteScalar();
                                    if (o == null || o == DBNull.Value)
                                    {
                                        tran.Rollback();
                                        return RfidRecordsResult.Fail("RFID was not saved. Check RFID_CARD_ASSIGN permissions.");
                                    }

                                    savedId = Convert.ToDecimal(o, CultureInfo.InvariantCulture);
                                }
                            }

                            tran.Commit();
                            return GetRecord(savedId);
                        }
                        catch
                        {
                            tran.Rollback();
                            throw;
                        }
                    }
                }
            }
            catch (Exception ex)
            {
                return RfidRecordsResult.Fail(RfidErrors.Describe(ex));
            }
        }

        public RfidRecordsResult UpdatePrintAssignment(
            decimal id,
            string issuedBy,
            string printDateText,
            string rfidNumber,
            string etag)
        {
            if (id <= 0)
            {
                return RfidRecordsResult.Fail("A valid record ID is required.");
            }

            rfidNumber = TrimMax(rfidNumber, 50);
            if (!string.IsNullOrEmpty(rfidNumber) &&
                (rfidNumber.Length < 4 || !RfidValidator.IsRfid(rfidNumber)))
            {
                return RfidRecordsResult.Fail(
                    "RFID number must be 4 to 50 characters: letters, numbers, spaces, hyphens, or colons.");
            }

            issuedBy = TrimMax(issuedBy, 50);
            if (!string.IsNullOrEmpty(issuedBy) && !RfidValidator.IsPersonName(issuedBy))
            {
                return RfidRecordsResult.Fail("Issued by must be 1 to 50 characters: letters, numbers, spaces, and . ' -");
            }

            string cs;
            string missing;
            if (!TryConnectionString(out cs, out missing))
            {
                return RfidRecordsResult.Fail(missing);
            }

            try
            {
                var existing = GetRecord(id);
                if (existing == null || !existing.Ok || existing.Record == null)
                {
                    return RfidRecordsResult.Fail("Record not found.");
                }

                using (var conn = new OracleConnection(cs))
                {
                    conn.Open();

                    if (!string.IsNullOrEmpty(rfidNumber))
                    {
                        using (var dupCmd = new OracleCommand(
                            "SELECT 1 FROM SPERS.RFID_CARD_ASSIGN WHERE UPPER(TRIM(RFID_NUMBER)) = UPPER(TRIM(:rfid)) AND ID <> :id AND ROWNUM = 1",
                            conn))
                        {
                            dupCmd.BindByName = true;
                            dupCmd.Parameters.Add("rfid", OracleDbType.Varchar2).Value = rfidNumber;
                            dupCmd.Parameters.Add("id", OracleDbType.Decimal).Value = id;
                            var dup = dupCmd.ExecuteScalar();
                            if (dup != null && dup != DBNull.Value)
                            {
                                return RfidRecordsResult.Fail("This RFID number is already on file. Use a different card number.");
                            }
                        }
                    }

                    const string sql =
                        "UPDATE SPERS.RFID_CARD_ASSIGN SET ISSUED_BY = :issued_by, PRINT_DATE = SYSDATE, RFID_NUMBER = :rfid_number WHERE ID = :id";
                    using (var cmd = new OracleCommand(sql, conn))
                    {
                        cmd.BindByName = true;
                        cmd.Parameters.Add("issued_by", OracleDbType.Varchar2).Value = NullIfEmpty(issuedBy);
                        cmd.Parameters.Add("rfid_number", OracleDbType.Varchar2).Value = NullIfEmpty(rfidNumber);
                        cmd.Parameters.Add("id", OracleDbType.Decimal).Value = id;
                        var rows = cmd.ExecuteNonQuery();
                        if (rows != 1)
                        {
                            return RfidRecordsResult.Fail("Record not found or assignment was not updated.");
                        }
                    }
                }

                return GetRecord(id);
            }
            catch (Exception ex)
            {
                return RfidRecordsResult.Fail(RfidErrors.Describe(ex));
            }
        }

        public bool EmployeeRecordExists(string empId)
        {
            if (string.IsNullOrWhiteSpace(empId))
            {
                return false;
            }

            string cs;
            string missing;
            if (!TryConnectionString(out cs, out missing))
            {
                return false;
            }

            try
            {
                using (var conn = new OracleConnection(cs))
                {
                    conn.Open();
                    using (var cmd = new OracleCommand(
                        "SELECT 1 FROM SPERS.V_EMPS e WHERE TRIM(e.EMP_ID) = TRIM(:emp) AND " + VEmpsActivePredicate + " AND ROWNUM = 1",
                        conn))
                    {
                        cmd.BindByName = true;
                        cmd.Parameters.Add("emp", OracleDbType.Varchar2).Value = empId.Trim();
                        var found = cmd.ExecuteScalar();
                        return found != null && found != DBNull.Value;
                    }
                }
            }
            catch
            {
                return false;
            }
        }

        public string TryGetEmployeeDisplayName(string empId)
        {
            if (string.IsNullOrWhiteSpace(empId))
            {
                return null;
            }

            string cs;
            string missing;
            if (!TryConnectionString(out cs, out missing))
            {
                return null;
            }

            try
            {
                using (var conn = new OracleConnection(cs))
                {
                    conn.Open();
                    using (var cmd = new OracleCommand(
                        "SELECT ENAME FROM SPERS.V_EMPS e WHERE TRIM(e.EMP_ID) = TRIM(:emp) AND " + VEmpsActivePredicate +
                        " AND ROWNUM = 1",
                        conn))
                    {
                        cmd.BindByName = true;
                        cmd.Parameters.Add("emp", OracleDbType.Varchar2).Value = empId.Trim();
                        var value = cmd.ExecuteScalar();
                        if (value == null || value == DBNull.Value)
                        {
                            return null;
                        }

                        var name = Convert.ToString(value, CultureInfo.InvariantCulture).Trim();
                        return name.Length == 0 ? null : name;
                    }
                }
            }
            catch
            {
                return null;
            }
        }

        private static RfidRecord ReadSummary(IDataReader reader)
        {
            var rawStatus = ReadString(reader, "STATUS");
            var record = new RfidRecord
            {
                Id = ReadDecimal(reader, "ID"),
                EmpId = ReadString(reader, "EMP_ID"),
                EmployeeName = ReadStringCoalesce(reader, "EMPLOYEE_NAME", "ENAME"),
                Designation = ReadStringCoalesce(reader, "EMP_DGN_NM", "DESIGNATION", "DGN_NM"),
                Department = ReadStringCoalesce(reader, "EMP_DPT_NM", "DEPARTMENT", "DPT_NM"),
                RfidNumber = ReadString(reader, "RFID_NUMBER"),
                Status = ToUiStatus(rawStatus),
                IssueDate = ReadDateDisplay(reader, "ISSUE_DATE"),
                ExpiryDate = ReadDateDisplay(reader, "EXPIRY_DATE"),
                IssuedBy = ReadString(reader, "ISSUED_BY"),
                IsApproved = FormatYesNo(reader, "IS_APPROVED"),
                CreatedDate = ReadDateDisplay(reader, "CREATED_DATE"),
                StatusRemarks = ReadString(reader, "HOD_REMARKS")
            };
            ApplyGradeFromEmpProfile(record, reader);
            return record;
        }

        private static RfidRecord ReadDetail(IDataReader reader)
        {
            var record = ReadSummary(reader);
            record.ExpiryDate = ReadDateDisplay(reader, "EXPIRY_DATE");
            record.PrintDate = ReadDateDisplay(reader, "PRINT_DATE");
            record.ApprovedDate = ReadDateDisplay(reader, "APPROVED_DATE");
            record.ApproveId = ReadString(reader, "APPROVE_ID");
            record.HodRemarks = ReadString(reader, "HOD_REMARKS");
            record.IsForwardHod = FormatYesNo(reader, "IS_FORWARD_HOD");
            record.ForwardBy = ReadString(reader, "FORWARD_HOD_BY");
            record.ForwardOn = ReadDateDisplay(reader, "FORWARD_HOD_ON");
            record.RequesterRemarks = ReadString(reader, "REQUESTER_REMARKS");
            record.Designation = ReadStringCoalesce(reader, "DESIGNATION", "EMP_DGN_NM", "DGN_NM");
            record.Department = ReadStringCoalesce(reader, "DEPARTMENT", "EMP_DPT_NM", "DPT_NM");
            record.ProjectLocation = ReadString(reader, "PROJECT_LOCATION");
            record.JoiningDate = ReadDateDisplay(reader, "JOINING_DATE");
            record.BloodGroup = ReadString(reader, "BLOOD_GROUP");
            record.Cnic = ReadString(reader, "CNIC");
            record.EmergencyNo = ReadStringCoalesce(reader, "EMERGENCY_NO", "PH_CELL2");
            return record;
        }

        private static string ToUiStatus(string dbStatus)
        {
            if (string.IsNullOrWhiteSpace(dbStatus))
            {
                return string.Empty;
            }

            var s = dbStatus.Trim();
            if (s.Equals("ACTIVE", StringComparison.OrdinalIgnoreCase))
            {
                return "Active";
            }

            if (s.Equals("INACTIVE", StringComparison.OrdinalIgnoreCase))
            {
                return "Inactive";
            }

            return s;
        }

        private static string ToDbActiveInactive(string uiStatus)
        {
            if (string.IsNullOrWhiteSpace(uiStatus))
            {
                return null;
            }

            uiStatus = uiStatus.Trim();
            if (uiStatus.Equals("Active", StringComparison.OrdinalIgnoreCase))
            {
                return "ACTIVE";
            }

            if (uiStatus.Equals("Inactive", StringComparison.OrdinalIgnoreCase))
            {
                return "INACTIVE";
            }

            return null;
        }

        private static string FormatYesNo(IDataReader reader, string column)
        {
            var raw = ReadString(reader, column);
            if (string.IsNullOrWhiteSpace(raw))
            {
                return string.Empty;
            }

            raw = raw.Trim();
            if (raw.Equals("Y", StringComparison.OrdinalIgnoreCase) || raw.Equals("YES", StringComparison.OrdinalIgnoreCase))
            {
                return "Yes";
            }

            if (raw.Equals("N", StringComparison.OrdinalIgnoreCase) || raw.Equals("NO", StringComparison.OrdinalIgnoreCase))
            {
                return "No";
            }

            return raw;
        }

        private static void TryEnrichEmergencyFromEmpMst(OracleConnection conn, RfidRecord record)
        {
            if (record == null || string.IsNullOrWhiteSpace(record.EmpId))
            {
                return;
            }

            if (!string.IsNullOrWhiteSpace(record.EmergencyNo))
            {
                return;
            }

            const string sql =
                @"SELECT PH_CELL2 FROM SPERS.EMP_MST WHERE TRIM(EMP_ID) = TRIM(:emp) AND ROWNUM = 1";
            try
            {
                using (var cmd = new OracleCommand(sql, conn))
                {
                    cmd.BindByName = true;
                    cmd.Parameters.Add("emp", OracleDbType.Varchar2).Value = record.EmpId.Trim();
                    var value = cmd.ExecuteScalar();
                    if (value == null || value == DBNull.Value)
                    {
                        return;
                    }

                    var text = Convert.ToString(value, CultureInfo.InvariantCulture).Trim();
                    if (text.Length > 0)
                    {
                        record.EmergencyNo = text;
                    }
                }
            }
            catch
            {
                /* PH_CELL2 may be absent on some schemas */
            }
        }

        private static void TryEnrichLatestAssignFromTable(OracleConnection conn, RfidRecord record)
        {
            if (record == null || string.IsNullOrWhiteSpace(record.EmpId))
            {
                return;
            }

            const string sql =
                @"SELECT ID, RFID_NUMBER, STATUS, PRINT_DATE, ISSUE_DATE, EXPIRY_DATE, ISSUED_BY
                  FROM (
                      SELECT a.ID, a.RFID_NUMBER, a.STATUS, a.PRINT_DATE,
                             NVL(a.PRINT_DATE, a.ISSUE_DATE) AS ISSUE_DATE,
                             a.EXPIRY_DATE, a.ISSUED_BY
                      FROM SPERS.RFID_CARD_ASSIGN a
                      WHERE TRIM(a.EMP_ID) = TRIM(:emp)
                      ORDER BY a.ID DESC
                  ) WHERE ROWNUM = 1";
            try
            {
                using (var cmd = new OracleCommand(sql, conn))
                {
                    cmd.BindByName = true;
                    cmd.Parameters.Add("emp", OracleDbType.Varchar2).Value = record.EmpId.Trim();
                    using (var reader = cmd.ExecuteReader())
                    {
                        if (!reader.Read())
                        {
                            return;
                        }

                        var assignId = ReadDecimal(reader, "ID");
                        if (assignId > 0)
                        {
                            record.Id = assignId;
                        }

                        var rfid = ReadString(reader, "RFID_NUMBER");
                        if (!string.IsNullOrWhiteSpace(rfid))
                        {
                            record.RfidNumber = rfid;
                        }

                        var status = ReadString(reader, "STATUS");
                        if (!string.IsNullOrWhiteSpace(status))
                        {
                            record.Status = ToUiStatus(status);
                        }

                        var printDate = ReadDateDisplay(reader, "PRINT_DATE");
                        var issueFromPrint = ReadDateDisplay(reader, "ISSUE_DATE");
                        if (!string.IsNullOrWhiteSpace(printDate))
                        {
                            record.PrintDate = printDate;
                        }

                        if (!string.IsNullOrWhiteSpace(issueFromPrint))
                        {
                            record.IssueDate = issueFromPrint;
                        }

                        ApplyAssignCardIssueDateFromPrint(record);
                        record.ExpiryDate = ReadDateDisplay(reader, "EXPIRY_DATE") ?? record.ExpiryDate;
                        record.IssuedBy = ReadString(reader, "ISSUED_BY") ?? record.IssuedBy;
                    }
                }
            }
            catch
            {
                /* optional — print still shows HR profile */
            }
        }

        private static void TryEnrichIssueDateFromAssign(OracleConnection conn, RfidRecord record)
        {
            if (record == null || string.IsNullOrWhiteSpace(record.EmpId))
            {
                return;
            }

            if (!string.IsNullOrWhiteSpace(record.IssueDate))
            {
                return;
            }

            const string sql =
                @"SELECT issue_dt FROM (
                      SELECT NVL(a.PRINT_DATE, a.ISSUE_DATE) AS issue_dt
                      FROM SPERS.RFID_CARD_ASSIGN a
                      WHERE TRIM(a.EMP_ID) = TRIM(:emp)
                        AND NVL(a.PRINT_DATE, a.ISSUE_DATE) IS NOT NULL
                      ORDER BY a.ID DESC
                  ) WHERE ROWNUM = 1";
            try
            {
                using (var cmd = new OracleCommand(sql, conn))
                {
                    cmd.BindByName = true;
                    cmd.Parameters.Add("emp", OracleDbType.Varchar2).Value = record.EmpId.Trim();
                    var value = cmd.ExecuteScalar();
                    var formatted = FormatDateValue(value);
                    if (!string.IsNullOrWhiteSpace(formatted))
                    {
                        record.IssueDate = formatted;
                        if (string.IsNullOrWhiteSpace(record.PrintDate))
                        {
                            record.PrintDate = formatted;
                        }
                    }
                }
            }
            catch
            {
                /* optional enrich — do not block print modal */
            }
        }

        /// <summary>ID card back Issue Date displays PRINT_DATE from RFID_CARD_ASSIGN.</summary>
        private static void ApplyAssignCardIssueDateFromPrint(RfidRecord record)
        {
            if (record == null)
            {
                return;
            }

            if (!string.IsNullOrWhiteSpace(record.PrintDate))
            {
                record.IssueDate = record.PrintDate.Trim();
                return;
            }

            if (!string.IsNullOrWhiteSpace(record.IssueDate))
            {
                record.PrintDate = record.IssueDate.Trim();
            }
        }

        private static string FormatDateValue(object value)
        {
            if (value == null || value == DBNull.Value)
            {
                return string.Empty;
            }

            if (value is DateTime)
            {
                return ((DateTime)value).ToString("dd-MMM-yyyy", CultureInfo.InvariantCulture);
            }

            DateTime parsed;
            var text = Convert.ToString(value, CultureInfo.InvariantCulture).Trim();
            if (DateTime.TryParse(text, CultureInfo.InvariantCulture, DateTimeStyles.None, out parsed) ||
                DateTime.TryParse(text, CultureInfo.GetCultureInfo("en-GB"), DateTimeStyles.None, out parsed))
            {
                return parsed.ToString("dd-MMM-yyyy", CultureInfo.InvariantCulture);
            }

            return text;
        }

        private static bool IsActiveEmployeeInVemps(OracleConnection conn, string empId)
        {
            using (var cmd = new OracleCommand(
                "SELECT 1 FROM SPERS.V_EMPS e WHERE TRIM(e.EMP_ID) = TRIM(:emp) AND " + VEmpsActivePredicate + " AND ROWNUM = 1",
                conn))
            {
                cmd.BindByName = true;
                cmd.Parameters.Add("emp", OracleDbType.Varchar2).Value = empId;
                var found = cmd.ExecuteScalar();
                return found != null && found != DBNull.Value;
            }
        }

        private static void ApplyGradeFromEmpProfile(RfidRecord record, IDataReader reader)
        {
            if (record == null)
            {
                return;
            }

            var grdAb = ReadStringCoalesce(reader, "EMP_GRD_AB", "GRD_AB");
            var grdId = ReadStringCoalesce(reader, "EMP_GRD_ID", "GRD_ID");
            ApplyGradeFromValues(record, grdAb, grdId);
        }

        private static void ApplyGradeFromValues(RfidRecord record, string grdAb, string grdId)
        {
            if (record == null)
            {
                return;
            }

            record.Grade = !string.IsNullOrWhiteSpace(grdAb) ? grdAb.Trim() : (grdId ?? string.Empty).Trim();
            record.CardBadge = ResolveCardBadge(grdAb, grdId);
        }

        /// <summary>Same rule as EmpCard: digits from GRD_AB (or GRD_ID) &gt; 5 → OFFICIAL, else EMPLOYEE.</summary>
        private static string ResolveCardBadge(string grdAb, string grdId)
        {
            var gradeNum = ParseGradeNumber(grdAb);
            if (gradeNum <= 0)
            {
                gradeNum = ParseGradeNumber(grdId);
            }

            return gradeNum > 5 ? "OFFICIAL" : "EMPLOYEE";
        }

        private static int ParseGradeNumber(string value)
        {
            if (string.IsNullOrWhiteSpace(value))
            {
                return 0;
            }

            var digits = Regex.Replace(value.Trim(), @"[^\d]", string.Empty);
            if (digits.Length == 0)
            {
                return 0;
            }

            int parsed;
            return int.TryParse(digits, NumberStyles.Integer, CultureInfo.InvariantCulture, out parsed) ? parsed : 0;
        }

        private static string ReadStringCoalesce(IDataReader reader, params string[] columns)
        {
            if (columns == null)
            {
                return string.Empty;
            }

            for (var i = 0; i < columns.Length; i++)
            {
                var value = ReadString(reader, columns[i]);
                if (!string.IsNullOrWhiteSpace(value))
                {
                    return value;
                }
            }

            return string.Empty;
        }

        private static string ReadString(IDataReader reader, string column)
        {
            if (string.IsNullOrWhiteSpace(column))
            {
                return string.Empty;
            }

            var ord = FindColumnOrdinal(reader, column);
            if (ord < 0 || reader.IsDBNull(ord))
            {
                return string.Empty;
            }

            return Convert.ToString(reader.GetValue(ord), CultureInfo.InvariantCulture).Trim();
        }

        private static int FindColumnOrdinal(IDataReader reader, string column)
        {
            try
            {
                return reader.GetOrdinal(column);
            }
            catch (IndexOutOfRangeException)
            {
                // fall through to case-insensitive scan
            }
            catch (ArgumentException)
            {
                // fall through
            }

            for (var i = 0; i < reader.FieldCount; i++)
            {
                if (string.Equals(reader.GetName(i), column, StringComparison.OrdinalIgnoreCase))
                {
                    return i;
                }
            }

            return -1;
        }

        private static decimal ReadDecimal(IDataReader reader, string column)
        {
            try
            {
                var ord = reader.GetOrdinal(column);
                if (reader.IsDBNull(ord))
                {
                    return 0;
                }

                return Convert.ToDecimal(reader.GetValue(ord), CultureInfo.InvariantCulture);
            }
            catch (IndexOutOfRangeException)
            {
                return 0;
            }
        }

        private static string ReadDateDisplay(IDataReader reader, string column)
        {
            var ord = FindColumnOrdinal(reader, column);
            if (ord < 0 || reader.IsDBNull(ord))
            {
                return string.Empty;
            }

            return FormatDateValue(reader.GetValue(ord));
        }

        private static bool TryConnectionString(out string connectionString, out string missingMessage)
        {
            connectionString = null;
            missingMessage = null;
            var settings = ConfigurationManager.ConnectionStrings[ConnectionName];
            if (settings == null || string.IsNullOrWhiteSpace(settings.ConnectionString))
            {
                missingMessage = "Oracle connection string \"" + ConnectionName + "\" is missing in Web.config.";
                return false;
            }

            connectionString = settings.ConnectionString;
            return true;
        }

        private static string TrimMax(string value, int max)
        {
            if (value == null)
            {
                return string.Empty;
            }

            value = value.Trim();
            if (value.Length > max)
            {
                return value.Substring(0, max);
            }

            return value;
        }

        private static string NullIfEmpty(string value)
        {
            return string.IsNullOrWhiteSpace(value) ? null : value.Trim();
        }

        private static DateTime? TryParseOptionalDate(string text)
        {
            if (string.IsNullOrWhiteSpace(text))
            {
                return null;
            }

            text = text.Trim();
            DateTime parsed;
            if (DateTime.TryParse(text, CultureInfo.InvariantCulture, DateTimeStyles.None, out parsed))
            {
                return parsed;
            }

            if (DateTime.TryParse(text, CultureInfo.GetCultureInfo("en-GB"), DateTimeStyles.None, out parsed))
            {
                return parsed;
            }

            return null;
        }
    }
}
