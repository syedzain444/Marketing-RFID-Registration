using System;
using System.Collections.Generic;
using System.Configuration;
using System.Data;
using System.Globalization;
using System.Text.RegularExpressions;
using Oracle.ManagedDataAccess.Client;

namespace RFID_Marketing_Form.Data
{
    public class RfidRepository
    {
        private const string ConnectionName = "OracleConnection";
        private static readonly object Gate = new object();
        private static readonly Regex SafeName = new Regex("^[A-Z][A-Z0-9_$#]{0,127}$", RegexOptions.Compiled);
        private static string blockedConnection;
        private static string blockedMessage;
        private static TableRef cachedTable;
        private static string cachedConnection;

        public ConnectionStatus GetStatus()
        {
            string cs;
            string missing;
            if (!TryConnectionString(out cs, out missing))
            {
                return new ConnectionStatus { Level = "warn", Message = missing };
            }

            if (IsBlocked(cs))
            {
                return new ConnectionStatus { Level = "error", Message = blockedMessage };
            }

            try
            {
                var table = ResolveTable(cs);
                return new ConnectionStatus
                {
                    Level = "ok",
                    TableName = table.Qualified,
                    Message = "Connected to SPERS on 172.16.10.60 (SID orcl). Saving into " + table.Qualified + "."
                };
            }
            catch (Exception ex)
            {
                var described = RfidErrors.Describe(ex);
                NoteAuthFailure(cs, ex, described);
                var level = RfidErrors.IsAuthOrEmpty(ex) ? "warn" : "error";
                return new ConnectionStatus { Level = level, Message = described };
            }
        }

        public DuplicateInfo FindDuplicates(string empId, string rfid, decimal? id)
        {
            var info = new DuplicateInfo();
            string cs;
            string missing;
            if (!TryConnectionString(out cs, out missing))
            {
                info.Error = missing;
                return info;
            }

            if (IsBlocked(cs))
            {
                info.Error = blockedMessage;
                return info;
            }

            try
            {
                var table = ResolveTable(cs);
                using (var conn = new OracleConnection(cs))
                {
                    conn.Open();
                    ClearBlock();
                    FillDuplicates(conn, null, table, empId, rfid, id, info);
                }
            }
            catch (Exception ex)
            {
                info.Error = RfidErrors.Describe(ex);
                NoteAuthFailure(cs, ex, info.Error);
            }

            return info;
        }

        public RfidRecordsResult ListRecords()
        {
            string cs;
            string missing;
            if (!TryConnectionString(out cs, out missing))
            {
                return RfidRecordsResult.Fail(missing);
            }

            if (IsBlocked(cs))
            {
                return RfidRecordsResult.Fail(blockedMessage);
            }

            try
            {
                var table = ResolveTable(cs);
                var rows = new List<RfidRecord>();
                var listSql = BuildListSelect(table);
                using (var conn = new OracleConnection(cs))
                {
                    conn.Open();
                    ClearBlock();
                    using (var cmd = Command(conn, null, string.Format(CultureInfo.InvariantCulture, listSql, table.Qualified)))
                    using (var reader = cmd.ExecuteReader())
                    {
                        while (reader.Read())
                        {
                            rows.Add(ReadRecordSummary(reader, table));
                        }
                    }
                }

                return new RfidRecordsResult
                {
                    Ok = true,
                    TableName = table.Qualified,
                    Records = rows
                };
            }
            catch (Exception ex)
            {
                var described = RfidErrors.Describe(ex);
                NoteAuthFailure(cs, ex, described);
                return RfidRecordsResult.Fail(described);
            }
        }

        public RfidRecordsResult GetRecord(decimal id)
        {
            string cs;
            string missing;
            if (!TryConnectionString(out cs, out missing))
            {
                return RfidRecordsResult.Fail(missing);
            }

            if (IsBlocked(cs))
            {
                return RfidRecordsResult.Fail(blockedMessage);
            }

            try
            {
                var table = ResolveTable(cs);
                var sql = BuildDetailSelect(table);
                using (var conn = new OracleConnection(cs))
                {
                    conn.Open();
                    ClearBlock();
                    using (var cmd = Command(conn, null, sql))
                    {
                        AddNumber(cmd, "id", id);
                        using (var reader = cmd.ExecuteReader())
                        {
                            if (!reader.Read())
                            {
                                return RfidRecordsResult.Fail("Record not found.");
                            }

                            var record = ReadRecordDetail(reader, table);
                            EnrichEmployeeProfile(conn, record);
                            var familyCards = ListFamilyCardsByEmpId(conn, record.EmpId);
                            return new RfidRecordsResult
                            {
                                Ok = true,
                                TableName = table.Qualified,
                                Record = record,
                                FamilyCards = familyCards
                            };
                        }
                    }
                }
            }
            catch (Exception ex)
            {
                var described = RfidErrors.Describe(ex);
                NoteAuthFailure(cs, ex, described);
                return RfidRecordsResult.Fail(described);
            }
        }

        public RfidRecordsResult SetStatus(decimal id, string status, string remarks)
        {
            if (id <= 0)
            {
                return RfidRecordsResult.Fail("A valid record ID is required.");
            }

            status = CanonicalRecordStatus(status);
            if (status == null)
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

            if (IsBlocked(cs))
            {
                return RfidRecordsResult.Fail(blockedMessage);
            }

            try
            {
                var table = ResolveTable(cs);
                if (!table.HasStatusRemarks)
                {
                    return RfidRecordsResult.Fail(
                        "STATUS_REMARKS column is missing on the RFID table. Run Sql/Add_Status_Remarks_Column.sql.");
                }

                const string sql = "UPDATE {0} SET STATUS = :status, STATUS_REMARKS = :remarks WHERE ID = :id";
                using (var conn = new OracleConnection(cs))
                {
                    conn.Open();
                    ClearBlock();
                    using (var cmd = Command(conn, null, string.Format(CultureInfo.InvariantCulture, sql, table.Qualified)))
                    {
                        AddVarchar(cmd, "status", status, 20);
                        AddVarchar(cmd, "remarks", remarks, 500);
                        AddNumber(cmd, "id", id);
                        int rows = cmd.ExecuteNonQuery();
                        if (!IsSuccessfulUpdate(rows))
                        {
                            return RfidRecordsResult.Fail("Record not found or status was not updated.");
                        }
                    }
                }

                return new RfidRecordsResult
                {
                    Ok = true,
                    TableName = table.Qualified,
                    Status = status,
                    StatusRemarks = remarks
                };
            }
            catch (Exception ex)
            {
                var described = RfidErrors.Describe(ex);
                NoteAuthFailure(cs, ex, described);
                return RfidRecordsResult.Fail(described);
            }
        }

        private static string CanonicalRecordStatus(string status)
        {
            if (string.IsNullOrWhiteSpace(status))
            {
                return null;
            }

            status = status.Trim();
            if (status.Equals("Active", StringComparison.OrdinalIgnoreCase))
            {
                return "Active";
            }

            if (status.Equals("Inactive", StringComparison.OrdinalIgnoreCase))
            {
                return "Inactive";
            }

            return null;
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

            employeeName = TrimMax(employeeName, 100);
            designation = TrimMax(designation, 100);
            department = TrimMax(department, 100);
            projectLocation = TrimMax(projectLocation, 100);
            bloodGroup = TrimMax(bloodGroup, 20);
            cnic = TrimMax(cnic, 20);
            emergencyNo = TrimMax(emergencyNo, 30);
            photoPath = TrimMax(photoPath, 500);
            DateTime? joiningDate = TryParseOptionalDate(joiningDateText);
            if (!string.IsNullOrWhiteSpace(joiningDateText) && !joiningDate.HasValue)
            {
                return RfidRecordsResult.Fail("Joining date is not a valid date.");
            }

            string cs;
            string missing;
            if (!TryConnectionString(out cs, out missing))
            {
                return RfidRecordsResult.Fail(missing);
            }

            if (IsBlocked(cs))
            {
                return RfidRecordsResult.Fail(blockedMessage);
            }

            try
            {
                InvalidateTableCache();
                var table = ResolveTable(cs);
                var sets = new List<string>();

                if (table.HasCardName)
                {
                    sets.Add("CARD_NAME = :card_name");
                }
                else if (!string.IsNullOrEmpty(table.NameColumn))
                {
                    sets.Add(table.NameColumn + " = :card_name");
                }

                if (table.HasDesignation)
                {
                    sets.Add("DESIGNATION = :designation");
                }

                if (table.HasDepartment)
                {
                    sets.Add("DEPARTMENT = :department");
                }

                if (table.HasProjectLocation)
                {
                    sets.Add("PROJECT_LOCATION = :project_location");
                }

                if (table.HasJoiningDate)
                {
                    sets.Add("JOINING_DATE = :joining_date");
                }

                if (table.HasBloodGroup)
                {
                    sets.Add("BLOOD_GROUP = :blood_group");
                }

                if (table.HasCnic)
                {
                    sets.Add("CNIC = :cnic");
                }

                if (table.HasEmergencyNo)
                {
                    sets.Add("EMERGENCY_NO = :emergency_no");
                }

                if (!string.IsNullOrEmpty(table.PhotoColumn))
                {
                    sets.Add(table.PhotoColumn + " = :photo_path");
                }

                if (sets.Count == 0)
                {
                    return RfidRecordsResult.Fail("Employee profile columns are not available on this table.");
                }

                var sql = "UPDATE " + table.Qualified + " SET " + string.Join(", ", sets.ToArray()) + " WHERE ID = :id";
                using (var conn = new OracleConnection(cs))
                {
                    conn.Open();
                    ClearBlock();
                    using (var cmd = Command(conn, null, sql))
                    {
                        if (table.HasCardName || !string.IsNullOrEmpty(table.NameColumn))
                        {
                            AddVarchar(cmd, "card_name", NullIfEmpty(employeeName), 100);
                        }

                        if (table.HasDesignation)
                        {
                            AddVarchar(cmd, "designation", NullIfEmpty(designation), 100);
                        }

                        if (table.HasDepartment)
                        {
                            AddVarchar(cmd, "department", NullIfEmpty(department), 100);
                        }

                        if (table.HasProjectLocation)
                        {
                            AddVarchar(cmd, "project_location", NullIfEmpty(projectLocation), 100);
                        }

                        if (table.HasJoiningDate)
                        {
                            AddDate(cmd, "joining_date", joiningDate);
                        }

                        if (table.HasBloodGroup)
                        {
                            AddVarchar(cmd, "blood_group", NullIfEmpty(bloodGroup), 20);
                        }

                        if (table.HasCnic)
                        {
                            AddVarchar(cmd, "cnic", NullIfEmpty(cnic), 20);
                        }

                        if (table.HasEmergencyNo)
                        {
                            AddVarchar(cmd, "emergency_no", NullIfEmpty(emergencyNo), 30);
                        }

                        if (!string.IsNullOrEmpty(table.PhotoColumn))
                        {
                            AddVarchar(cmd, "photo_path", NullIfEmpty(photoPath), 500);
                        }

                        AddNumber(cmd, "id", id);
                        int rows = cmd.ExecuteNonQuery();
                        if (!IsSuccessfulUpdate(rows))
                        {
                            return RfidRecordsResult.Fail("Record not found or profile was not updated.");
                        }
                    }
                }

                return GetRecord(id);
            }
            catch (Exception ex)
            {
                var described = RfidErrors.Describe(ex);
                NoteAuthFailure(cs, ex, described);
                return RfidRecordsResult.Fail(described);
            }
        }

        public RfidRecordsResult UpdatePrintAssignment(decimal id, string issuedBy, string printDateText, string rfidNumber)
        {
            if (id <= 0)
            {
                return RfidRecordsResult.Fail("A valid record ID is required.");
            }

            rfidNumber = TrimMax(rfidNumber, 50);
            if (!string.IsNullOrEmpty(rfidNumber) &&
                (rfidNumber.Length < 4 || !RfidValidator.IsRfid(rfidNumber)))
            {
                return RfidRecordsResult.Fail("RFID number must be 4 to 50 characters: letters, numbers, spaces, hyphens, or colons.");
            }

            issuedBy = TrimMax(issuedBy, 50);
            if (!string.IsNullOrEmpty(issuedBy) && !RfidValidator.IsPersonName(issuedBy))
            {
                return RfidRecordsResult.Fail("Issued by must be 1 to 50 characters: letters, numbers, spaces, and . ' -");
            }

            DateTime? printDate = null;
            if (!string.IsNullOrWhiteSpace(printDateText))
            {
                printDate = TryParseOptionalDate(printDateText);
                if (!printDate.HasValue)
                {
                    return RfidRecordsResult.Fail("Print date is not a valid date.");
                }
            }

            string cs;
            string missing;
            if (!TryConnectionString(out cs, out missing))
            {
                return RfidRecordsResult.Fail(missing);
            }

            if (IsBlocked(cs))
            {
                return RfidRecordsResult.Fail(blockedMessage);
            }

            try
            {
                InvalidateTableCache();
                var table = ResolveTable(cs);
                var existing = GetRecord(id);
                if (existing == null || !existing.Ok || existing.Record == null)
                {
                    return RfidRecordsResult.Fail("Record not found.");
                }

                if (printDate.HasValue && !string.IsNullOrWhiteSpace(existing.Record.IssueDate))
                {
                    DateTime issueDate;
                    if (DateTime.TryParse(existing.Record.IssueDate, CultureInfo.InvariantCulture, DateTimeStyles.None, out issueDate) ||
                        DateTime.TryParse(existing.Record.IssueDate, CultureInfo.GetCultureInfo("en-GB"), DateTimeStyles.None, out issueDate))
                    {
                        if (printDate.Value.Date < issueDate.Date)
                        {
                            return RfidRecordsResult.Fail("Print date cannot be before the issue date.");
                        }
                    }
                }

                using (var conn = new OracleConnection(cs))
                {
                    conn.Open();
                    ClearBlock();

                    if (!string.IsNullOrEmpty(rfidNumber))
                    {
                        using (var dupCmd = Command(conn, null,
                            "SELECT 1 FROM " + table.Qualified +
                            " WHERE UPPER(TRIM(RFID_NUMBER)) = UPPER(TRIM(:rfid)) AND ID <> :id AND ROWNUM = 1"))
                        {
                            AddVarchar(dupCmd, "rfid", rfidNumber, 50);
                            AddNumber(dupCmd, "id", id);
                            var dup = dupCmd.ExecuteScalar();
                            if (dup != null && dup != DBNull.Value)
                            {
                                return RfidRecordsResult.Fail("This RFID number is already on file. Use a different card number.");
                            }
                        }
                    }

                    const string sql = "UPDATE {0} SET ISSUED_BY = :issued_by, PRINT_DATE = :print_date, RFID_NUMBER = :rfid_number WHERE ID = :id";
                    using (var cmd = Command(conn, null, string.Format(CultureInfo.InvariantCulture, sql, table.Qualified)))
                    {
                        AddVarchar(cmd, "issued_by", NullIfEmpty(issuedBy), 50);
                        AddDate(cmd, "print_date", printDate);
                        AddVarchar(cmd, "rfid_number", NullIfEmpty(rfidNumber), 50);
                        AddNumber(cmd, "id", id);
                        int rows = cmd.ExecuteNonQuery();
                        if (!IsSuccessfulUpdate(rows))
                        {
                            return RfidRecordsResult.Fail("Record not found or assignment was not updated.");
                        }
                    }
                }

                return GetRecord(id);
            }
            catch (Exception ex)
            {
                var described = RfidErrors.Describe(ex);
                NoteAuthFailure(cs, ex, described);
                return RfidRecordsResult.Fail(described);
            }
        }

        private static bool IsSuccessfulUpdate(int rowsAffected)
        {
            // Oracle ODP.NET often returns -1 when row count is unknown but the statement succeeded.
            return rowsAffected != 0;
        }

        private static void InvalidateTableCache()
        {
            lock (Gate)
            {
                cachedTable = null;
                cachedConnection = null;
            }
        }

        private static string TrimMax(string value, int maxLen)
        {
            if (string.IsNullOrWhiteSpace(value))
            {
                return string.Empty;
            }

            value = value.Trim();
            if (value.Length > maxLen)
            {
                value = value.Substring(0, maxLen);
            }

            return value;
        }

        private static readonly string[] ProfileDateFormats = new[]
        {
            "yyyy-MM-dd",
            "dd/MM/yyyy",
            "dd-MMM-yyyy"
        };

        private static DateTime? TryParseOptionalDate(string text)
        {
            if (string.IsNullOrWhiteSpace(text))
            {
                return null;
            }

            DateTime value;
            if (DateTime.TryParseExact(text.Trim(), ProfileDateFormats, CultureInfo.InvariantCulture, DateTimeStyles.None, out value))
            {
                return value.Date;
            }

            if (DateTime.TryParse(text.Trim(), CultureInfo.InvariantCulture, DateTimeStyles.None, out value))
            {
                return value.Date;
            }

            return null;
        }

        public bool EmployeeRecordExists(string empId)
        {
            if (string.IsNullOrWhiteSpace(empId))
            {
                return false;
            }

            string cs;
            string missing;
            if (!TryConnectionString(out cs, out missing) || IsBlocked(cs))
            {
                return false;
            }

            try
            {
                var table = ResolveTable(cs);
                using (var conn = new OracleConnection(cs))
                {
                    conn.Open();
                    ClearBlock();
                    using (var cmd = Command(conn, null, "SELECT 1 FROM " + table.Qualified + " WHERE UPPER(TRIM(EMP_ID)) = UPPER(TRIM(:emp)) AND ROWNUM = 1"))
                    {
                        AddVarchar(cmd, "emp", empId.Trim(), 20);
                        return cmd.ExecuteScalar() != null;
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
            if (!TryConnectionString(out cs, out missing) || IsBlocked(cs))
            {
                return null;
            }

            try
            {
                var table = ResolveTable(cs);
                using (var conn = new OracleConnection(cs))
                {
                    conn.Open();
                    ClearBlock();
                    var nameCol = !string.IsNullOrEmpty(table.NameColumn)
                        ? table.NameColumn
                        : (table.HasCardName ? "CARD_NAME" : null);
                    if (string.IsNullOrEmpty(nameCol))
                    {
                        return EmployeeRecordExists(empId) ? empId.Trim() : null;
                    }

                    var sql = "SELECT " + nameCol + " FROM " + table.Qualified +
                              " WHERE UPPER(TRIM(EMP_ID)) = UPPER(TRIM(:emp)) AND ROWNUM = 1";
                    using (var cmd = Command(conn, null, sql))
                    {
                        AddVarchar(cmd, "emp", empId.Trim(), 20);
                        var scalar = cmd.ExecuteScalar();
                        if (scalar == null || scalar == DBNull.Value)
                        {
                            return null;
                        }

                        var name = Convert.ToString(scalar, CultureInfo.InvariantCulture).Trim();
                        return name.Length > 0 ? name : empId.Trim();
                    }
                }
            }
            catch
            {
                return null;
            }
        }

        public SaveResult SaveFamilyCard(FamilyCardInput input)
        {
            var issues = FamilyCardValidator.Validate(input);
            if (issues.Count > 0)
            {
                return SaveResult.FromIssues("validation", "Some fields need attention", issues);
            }

            string cs;
            string missing;
            if (!TryConnectionString(out cs, out missing))
            {
                return ErrorResult(missing);
            }

            if (IsBlocked(cs))
            {
                return ErrorResult(blockedMessage);
            }

            if (!EmployeeRecordExists(input.EmpId))
            {
                return SaveResult.FromIssues(
                    "validation",
                    "Some fields need attention",
                    new List<FieldIssue>
                    {
                        new FieldIssue
                        {
                            Key = "emp",
                            Message = "Employee ID was not found on the employee RFID assignment table. Create the employee record first."
                        }
                    });
            }

            var familyTable = ResolveFamilyTableQualified();
            try
            {
                using (var conn = new OracleConnection(cs))
                {
                    conn.Open();
                    ClearBlock();
                    using (var tx = conn.BeginTransaction())
                    {
                        if (!string.IsNullOrWhiteSpace(input.RfidNumber))
                        {
                            using (var dup = Command(conn, tx, "SELECT 1 FROM " + familyTable + " WHERE UPPER(TRIM(RFID_NUMBER)) = UPPER(TRIM(:rfid)) AND ROWNUM = 1"))
                            {
                                AddVarchar(dup, "rfid", input.RfidNumber, 50);
                                if (dup.ExecuteScalar() != null)
                                {
                                    return SaveResult.FromIssues(
                                        "validation",
                                        "Some fields need attention",
                                        new List<FieldIssue> { new FieldIssue { Key = "rfid", Message = "This RFID number is already assigned to a family card." } });
                                }
                            }
                        }

                        decimal dependentId;
                        using (var depCmd = Command(conn, tx, "SELECT NVL(MAX(DEPENDENT_ID), 0) + 1 FROM " + familyTable + " WHERE UPPER(TRIM(EMP_ID)) = UPPER(TRIM(:emp))"))
                        {
                            AddVarchar(depCmd, "emp", input.EmpId, 20);
                            dependentId = ReadDecimal(depCmd.ExecuteScalar());
                        }

                        input.DependentId = dependentId;
                        input.CardId = input.EmpId.Trim() + "-" + dependentId.ToString(CultureInfo.InvariantCulture);

                        decimal newId;
                        using (var idCmd = Command(conn, tx, "SELECT NVL(MAX(ID), 0) + 1 FROM " + familyTable))
                        {
                            newId = ReadDecimal(idCmd.ExecuteScalar());
                        }

                        decimal? parentAssignId = null;
                        var empTable = ResolveTable(cs);
                        using (var parentCmd = Command(conn, tx,
                            "SELECT ID FROM " + empTable.Qualified + " WHERE UPPER(TRIM(EMP_ID)) = UPPER(TRIM(:emp)) AND ROWNUM = 1"))
                        {
                            AddVarchar(parentCmd, "emp", input.EmpId, 20);
                            var parentScalar = parentCmd.ExecuteScalar();
                            if (parentScalar != null && parentScalar != DBNull.Value)
                            {
                                parentAssignId = ReadDecimal(parentScalar);
                            }
                        }

                        const string insertSql =
                            "INSERT INTO {0} (ID, PARENT_ASSIGN_ID, EMP_ID, DEPENDENT_ID, CARD_ID, CARD_NUMBER, CARD_NAME, RELATIONSHIP, CNIC, RFID_NUMBER, " +
                            "ISSUE_DATE, EXPIRY_DATE, ISSUED_BY, PRINT_DATE, CREATED_DATE, STATUS, IS_APPROVED, APPROVED_DATE, APPROVE_ID, " +
                            "HOD_REMARKS, IS_FORWARD_HOD, FORWARD_HOD_BY, FORWARD_HOD_ON, REQUESTER_REMARKS, REMARKS, IMAGE_PATH) VALUES (" +
                            ":id, :parent_assign_id, :emp_id, :dependent_id, :card_id, :card_number, :card_name, :relationship, :cnic, :rfid_number, " +
                            ":issue_date, :expiry_date, :issued_by, :print_date, :created_date, :status, :is_approved, :approved_date, :approve_id, " +
                            ":hod_remarks, :is_forward_hod, :forward_hod_by, :forward_hod_on, :requester_remarks, :remarks, :image_path)";

                        using (var cmd = Command(conn, tx, string.Format(CultureInfo.InvariantCulture, insertSql, familyTable)))
                        {
                            AddNumber(cmd, "id", newId);
                            AddNumber(cmd, "parent_assign_id", parentAssignId);
                            AddVarchar(cmd, "emp_id", input.EmpId, 20);
                            AddNumber(cmd, "dependent_id", dependentId);
                            AddVarchar(cmd, "card_id", input.CardId, 30);
                            AddVarchar(cmd, "card_number", input.CardId, 30);
                            AddVarchar(cmd, "card_name", input.CardName, 100);
                            AddVarchar(cmd, "relationship", input.Relationship, 50);
                            AddVarchar(cmd, "cnic", NullIfEmpty(input.Cnic), 20);
                            AddVarchar(cmd, "rfid_number", NullIfEmpty(input.RfidNumber), 50);
                            AddDate(cmd, "issue_date", input.IssueDate);
                            AddDate(cmd, "expiry_date", input.ExpiryDate);
                            AddVarchar(cmd, "issued_by", NullIfEmpty(input.IssuedBy), 50);
                            AddDate(cmd, "print_date", input.PrintDate);
                            AddDate(cmd, "created_date", input.CreatedDate ?? DateTime.Now);
                            AddVarchar(cmd, "status", input.Status, 20);
                            AddVarchar(cmd, "is_approved", input.IsApproved == "Y" ? "Y" : "N", 1);
                            AddDate(cmd, "approved_date", input.IsApproved == "Y" ? input.ApprovedDate : null);
                            AddNumber(cmd, "approve_id", input.ApproveId);
                            AddVarchar(cmd, "hod_remarks", NullIfEmpty(input.HodRemarks), 500);
                            AddVarchar(cmd, "is_forward_hod", input.IsForwardHod == "Y" ? "Y" : "N", 1);
                            AddVarchar(cmd, "forward_hod_by", input.IsForwardHod == "Y" ? NullIfEmpty(input.ForwardBy) : null, 100);
                            AddDate(cmd, "forward_hod_on", input.IsForwardHod == "Y" ? input.ForwardOn : null);
                            AddVarchar(cmd, "requester_remarks", NullIfEmpty(input.RequesterRemarks), 500);
                            AddVarchar(cmd, "remarks", NullIfEmpty(input.RequesterRemarks), 500);
                            AddVarchar(cmd, "image_path", NullIfEmpty(input.PhotoPath), 500);
                            cmd.ExecuteNonQuery();
                        }

                        tx.Commit();
                        return new SaveResult
                        {
                            Success = true,
                            Kind = "success",
                            Title = "Family card saved",
                            NewId = newId,
                            TableName = familyTable,
                            Messages = new List<string>
                            {
                                "Family card " + input.CardId + " was saved for employee " + input.EmpId + " (" + input.CardName + ", " + input.Relationship + ")."
                            },
                            Fields = new List<string>()
                        };
                    }
                }
            }
            catch (Exception ex)
            {
                var message = RfidErrors.Describe(ex);
                NoteAuthFailure(cs, ex, message);
                return ErrorResult(message);
            }
        }

        private static List<FamilyCardRecord> ListFamilyCardsByEmpId(OracleConnection conn, string empId)
        {
            var list = new List<FamilyCardRecord>();
            if (conn == null || string.IsNullOrWhiteSpace(empId))
            {
                return list;
            }

            var familyTable = ResolveFamilyTableQualified();
            const string sqlTemplate =
                "SELECT ID, EMP_ID, DEPENDENT_ID, CARD_ID, CARD_NAME, RELATIONSHIP, CNIC, RFID_NUMBER, " +
                "ISSUE_DATE, EXPIRY_DATE, IMAGE_PATH, STATUS FROM {0} " +
                "WHERE UPPER(TRIM(EMP_ID)) = UPPER(TRIM(:emp)) ORDER BY DEPENDENT_ID";

            try
            {
                using (var cmd = Command(conn, null, string.Format(CultureInfo.InvariantCulture, sqlTemplate, familyTable)))
                {
                    AddVarchar(cmd, "emp", empId.Trim(), 20);
                    using (var reader = cmd.ExecuteReader())
                    {
                        while (reader.Read())
                        {
                            list.Add(new FamilyCardRecord
                            {
                                Id = ReadDecimal(reader["ID"]),
                                EmpId = ReadString(reader, "EMP_ID"),
                                DependentId = ReadDecimal(reader["DEPENDENT_ID"]),
                                CardId = ReadString(reader, "CARD_ID"),
                                CardName = ReadString(reader, "CARD_NAME"),
                                Relationship = ReadString(reader, "RELATIONSHIP"),
                                Cnic = ReadString(reader, "CNIC"),
                                RfidNumber = ReadString(reader, "RFID_NUMBER"),
                                IssueDate = ReadDateDisplay(reader, "ISSUE_DATE"),
                                ExpiryDate = ReadDateDisplay(reader, "EXPIRY_DATE"),
                                PhotoPath = ReadString(reader, "IMAGE_PATH"),
                                Status = ReadString(reader, "STATUS")
                            });
                        }
                    }
                }
            }
            catch
            {
                return new List<FamilyCardRecord>();
            }

            return list;
        }

        private static string ResolveFamilyTableQualified()
        {
            var configured = ConfigurationManager.AppSettings["EmpFamilyTableName"];
            if (string.IsNullOrWhiteSpace(configured))
            {
                configured = "SPERS.EMP_FAMILY_MARKETING";
            }

            configured = configured.Trim();
            if (configured.IndexOf('.') < 0)
            {
                configured = "SPERS." + configured;
            }

            return configured.ToUpperInvariant();
        }

        public SaveResult Save(RfidInput input)
        {
            var issues = RfidValidator.Validate(input);
            if (issues.Count > 0)
            {
                return SaveResult.FromIssues("validation", "Some fields need attention", issues);
            }

            string cs;
            string missing;
            if (!TryConnectionString(out cs, out missing))
            {
                return ErrorResult(missing);
            }

            if (IsBlocked(cs))
            {
                return ErrorResult(blockedMessage);
            }

            try
            {
                var table = ResolveTable(cs);
                using (var conn = new OracleConnection(cs))
                {
                    conn.Open();
                    ClearBlock();
                    using (var tx = conn.BeginTransaction())
                    {
                        var dupInfo = new DuplicateInfo();
                        FillDuplicates(conn, tx, table, input.EmpId, input.RfidNumber, null, dupInfo);
                        if (!string.IsNullOrEmpty(dupInfo.Error))
                        {
                            return ErrorResult(dupInfo.Error);
                        }

                        var dupIssues = new List<FieldIssue>();
                        RfidValidator.AddDuplicateIssues(dupInfo, dupIssues);
                        if (dupIssues.Count > 0)
                        {
                            return SaveResult.FromIssues("validation", "Some fields need attention", dupIssues);
                        }

                        if (!input.Id.HasValue && !table.HasInsertTrigger)
                        {
                            input.Id = NextId(conn, tx, table);
                        }

                        decimal? newId = Insert(conn, tx, table, input);
                        if (!ConfirmSavedRow(conn, tx, table, input, newId))
                        {
                            tx.Rollback();
                            return ErrorResult("The insert did not appear in " + table.Qualified + ". Confirm RfidTableName in Web.config and try again.");
                        }

                        tx.Commit();

                        var savedId = newId.HasValue && newId.Value > 0
                            ? newId.Value.ToString(CultureInfo.InvariantCulture)
                            : "new";
                        return new SaveResult
                        {
                            Success = true,
                            Kind = "success",
                            Title = "RFID record saved",
                            NewId = newId,
                            TableName = table.Qualified,
                            Messages = new List<string>
                            {
                                "Record " + savedId + " was saved in " + table.Qualified + " for employee " + input.EmpId + " with RFID " + input.RfidNumber + "."
                            },
                            Fields = new List<string>()
                        };
                    }
                }
            }
            catch (Exception ex)
            {
                var message = RfidErrors.Describe(ex);
                NoteAuthFailure(cs, ex, message);
                if (RfidErrors.IsUniqueViolation(ex))
                {
                    cachedTable = null;
                    return SaveResult.FromIssues("validation", "Some fields need attention", new List<FieldIssue>
                    {
                        new FieldIssue
                        {
                            Key = "rfid",
                            Message = "This employee ID or RFID number is already in use. Change the value and try again."
                        }
                    });
                }

                return ErrorResult(message);
            }
        }

        private static void FillDuplicates(OracleConnection conn, OracleTransaction tx, TableRef table, string empId, string rfid, decimal? id, DuplicateInfo info)
        {
            empId = empId == null ? string.Empty : empId.Trim();
            rfid = rfid == null ? string.Empty : rfid.Trim();

            if (empId.Length > 0)
            {
                using (var cmd = Command(conn, tx, "SELECT 1 FROM " + table.Qualified + " WHERE UPPER(TRIM(EMP_ID)) = UPPER(TRIM(:emp)) AND ROWNUM = 1"))
                {
                    AddVarchar(cmd, "emp", empId, 20);
                    var found = cmd.ExecuteScalar();
                    info.HasEmpOpen = found != null && found != DBNull.Value;
                }
            }

            if (rfid.Length > 0)
            {
                using (var cmd = Command(conn, tx, "SELECT 1 FROM " + table.Qualified + " WHERE UPPER(TRIM(RFID_NUMBER)) = UPPER(TRIM(:rfid)) AND ROWNUM = 1"))
                {
                    AddVarchar(cmd, "rfid", rfid, 50);
                    var found = cmd.ExecuteScalar();
                    info.HasRfid = found != null && found != DBNull.Value;
                }
            }

            if (id.HasValue)
            {
                using (var cmd = Command(conn, tx, "SELECT 1 FROM " + table.Qualified + " WHERE ID = :id AND ROWNUM = 1"))
                {
                    AddNumber(cmd, "id", id);
                    var found = cmd.ExecuteScalar();
                    info.HasId = found != null && found != DBNull.Value;
                }
            }
        }

        private static bool ConfirmSavedRow(OracleConnection conn, OracleTransaction tx, TableRef table, RfidInput input, decimal? newId)
        {
            string sql;
            if (newId.HasValue && newId.Value > 0)
            {
                sql = "SELECT 1 FROM " + table.Qualified + " WHERE ID = :id AND ROWNUM = 1";
            }
            else
            {
                sql = "SELECT 1 FROM " + table.Qualified + " WHERE UPPER(TRIM(EMP_ID)) = UPPER(TRIM(:emp)) AND UPPER(TRIM(RFID_NUMBER)) = UPPER(TRIM(:rfid)) AND ROWNUM = 1";
            }

            using (var cmd = Command(conn, tx, sql))
            {
                if (newId.HasValue && newId.Value > 0)
                {
                    AddNumber(cmd, "id", newId);
                }
                else
                {
                    AddVarchar(cmd, "emp", input.EmpId, 20);
                    AddVarchar(cmd, "rfid", input.RfidNumber, 50);
                }

                var found = cmd.ExecuteScalar();
                return found != null && found != DBNull.Value;
            }
        }

        private static string BuildListSelect(TableRef table)
        {
            var cols = new List<string>
            {
                "ID", "EMP_ID", "RFID_NUMBER", "STATUS", "ISSUE_DATE", "ISSUED_BY", "IS_APPROVED", "CREATED_DATE"
            };
            if (table.HasStatusRemarks && !cols.Contains("STATUS_REMARKS"))
            {
                cols.Add("STATUS_REMARKS");
            }

            return "SELECT " + string.Join(", ", cols.ToArray()) + " FROM {0} ORDER BY ID DESC";
        }

        private static string BuildDetailSelect(TableRef table)
        {
            var cols = new List<string>
            {
                "ID", "EMP_ID", "RFID_NUMBER", "STATUS", "ISSUE_DATE", "EXPIRY_DATE", "ISSUED_BY", "PRINT_DATE", "CREATED_DATE",
                "IS_APPROVED", "APPROVED_DATE", "APPROVE_ID", "HOD_REMARKS", "REQUESTER_REMARKS"
            };
            if (table.HasStatusRemarks && !cols.Contains("STATUS_REMARKS"))
            {
                cols.Add("STATUS_REMARKS");
            }
            if (table.HasIsForwardHod && !cols.Contains("IS_FORWARD_HOD"))
            {
                cols.Add("IS_FORWARD_HOD");
            }

            if (!string.IsNullOrEmpty(table.ForwardByColumn) && !cols.Contains(table.ForwardByColumn))
            {
                cols.Add(table.ForwardByColumn);
            }

            if (!string.IsNullOrEmpty(table.ForwardOnColumn) && !cols.Contains(table.ForwardOnColumn))
            {
                cols.Add(table.ForwardOnColumn);
            }
            if (!string.IsNullOrEmpty(table.PhotoColumn) && !cols.Contains(table.PhotoColumn))
            {
                cols.Add(table.PhotoColumn);
            }

            if (!string.IsNullOrEmpty(table.NameColumn) && !cols.Contains(table.NameColumn))
            {
                cols.Add(table.NameColumn);
            }

            AppendProfileColumns(table, cols);

            return "SELECT " + string.Join(", ", cols.ToArray()) + " FROM " + table.Qualified + " WHERE ID = :id";
        }

        private static void AppendProfileColumns(TableRef table, List<string> cols)
        {
            if (table.HasCardName && !cols.Contains("CARD_NAME"))
            {
                cols.Add("CARD_NAME");
            }

            if (table.HasDesignation && !cols.Contains("DESIGNATION"))
            {
                cols.Add("DESIGNATION");
            }

            if (table.HasDepartment && !cols.Contains("DEPARTMENT"))
            {
                cols.Add("DEPARTMENT");
            }

            if (table.HasProjectLocation && !cols.Contains("PROJECT_LOCATION"))
            {
                cols.Add("PROJECT_LOCATION");
            }

            if (table.HasJoiningDate && !cols.Contains("JOINING_DATE"))
            {
                cols.Add("JOINING_DATE");
            }

            if (table.HasBloodGroup && !cols.Contains("BLOOD_GROUP"))
            {
                cols.Add("BLOOD_GROUP");
            }

            if (table.HasCnic && !cols.Contains("CNIC"))
            {
                cols.Add("CNIC");
            }

            if (table.HasEmergencyNo && !cols.Contains("EMERGENCY_NO"))
            {
                cols.Add("EMERGENCY_NO");
            }
        }

        private static RfidRecord ReadRecordSummary(IDataReader reader, TableRef table)
        {
            var record = new RfidRecord
            {
                Id = ReadDecimal(reader, "ID"),
                EmpId = ReadString(reader, "EMP_ID"),
                RfidNumber = ReadString(reader, "RFID_NUMBER"),
                Status = ReadString(reader, "STATUS"),
                IssueDate = ReadDateDisplay(reader, "ISSUE_DATE"),
                IssuedBy = ReadString(reader, "ISSUED_BY"),
                IsApproved = FormatYesNo(reader, "IS_APPROVED"),
                CreatedDate = ReadDateDisplay(reader, "CREATED_DATE")
            };
            if (table != null && table.HasStatusRemarks)
            {
                record.StatusRemarks = ReadString(reader, "STATUS_REMARKS");
            }

            return record;
        }

        private static RfidRecord ReadRecordDetail(IDataReader reader, TableRef table)
        {
            var record = ReadRecordSummary(reader, table);
            record.ExpiryDate = ReadDateDisplay(reader, "EXPIRY_DATE");
            record.PrintDate = ReadDateDisplay(reader, "PRINT_DATE");
            record.ApprovedDate = ReadDateDisplay(reader, "APPROVED_DATE");
            record.ApproveId = ReadString(reader, "APPROVE_ID");
            record.HodRemarks = ReadString(reader, "HOD_REMARKS");
            if (table.HasIsForwardHod)
            {
                record.IsForwardHod = FormatYesNo(reader, "IS_FORWARD_HOD");
            }

            if (!string.IsNullOrEmpty(table.ForwardByColumn))
            {
                record.ForwardBy = ReadString(reader, table.ForwardByColumn);
            }

            if (!string.IsNullOrEmpty(table.ForwardOnColumn))
            {
                record.ForwardOn = ReadDateDisplay(reader, table.ForwardOnColumn);
            }

            record.RequesterRemarks = ReadString(reader, "REQUESTER_REMARKS");
            if (!string.IsNullOrEmpty(table.PhotoColumn))
            {
                record.PhotoPath = ReadString(reader, table.PhotoColumn);
            }

            if (!string.IsNullOrEmpty(table.NameColumn))
            {
                record.EmployeeName = ReadString(reader, table.NameColumn);
            }
            else if (table.HasCardName)
            {
                record.EmployeeName = ReadString(reader, "CARD_NAME");
            }

            if (table.HasDesignation)
            {
                record.Designation = ReadString(reader, "DESIGNATION");
            }

            if (table.HasDepartment)
            {
                record.Department = ReadString(reader, "DEPARTMENT");
            }

            if (table.HasProjectLocation)
            {
                record.ProjectLocation = ReadString(reader, "PROJECT_LOCATION");
            }

            if (table.HasJoiningDate)
            {
                record.JoiningDate = ReadDateDisplay(reader, "JOINING_DATE");
            }

            if (table.HasBloodGroup)
            {
                record.BloodGroup = ReadString(reader, "BLOOD_GROUP");
            }

            if (table.HasCnic)
            {
                record.Cnic = ReadString(reader, "CNIC");
            }

            if (table.HasEmergencyNo)
            {
                record.EmergencyNo = ReadString(reader, "EMERGENCY_NO");
            }

            return record;
        }

        private static void EnrichEmployeeProfile(OracleConnection conn, RfidRecord record)
        {
            if (record == null || string.IsNullOrWhiteSpace(record.EmpId) || !string.IsNullOrWhiteSpace(record.EmployeeName))
            {
                return;
            }

            var configured = ConfigurationManager.AppSettings["RfidEmployeeNameSql"];
            if (!string.IsNullOrWhiteSpace(configured))
            {
                record.EmployeeName = QueryEmployeeScalar(conn, configured.Trim(), record.EmpId);
                if (!string.IsNullOrWhiteSpace(record.EmployeeName))
                {
                    return;
                }
            }

            var lookupSql = GetOrDiscoverEmployeeLookupSql(conn);
            if (!string.IsNullOrEmpty(lookupSql))
            {
                record.EmployeeName = QueryEmployeeScalar(conn, lookupSql, record.EmpId);
                if (string.IsNullOrWhiteSpace(record.EmployeeName))
                {
                    var trimmed = record.EmpId.Trim().TrimStart('0');
                    if (trimmed.Length > 0 && !string.Equals(trimmed, record.EmpId.Trim(), StringComparison.OrdinalIgnoreCase))
                    {
                        record.EmployeeName = QueryEmployeeScalar(conn, lookupSql, trimmed);
                    }
                }
            }
        }

        private static string QueryEmployeeScalar(OracleConnection conn, string sql, string empId)
        {
            try
            {
                using (var cmd = Command(conn, null, sql))
                {
                    AddVarchar(cmd, "emp_id", empId, 32);
                    var value = cmd.ExecuteScalar();
                    if (value == null || value == DBNull.Value)
                    {
                        return string.Empty;
                    }

                    return Convert.ToString(value, CultureInfo.InvariantCulture).Trim();
                }
            }
            catch
            {
                return string.Empty;
            }
        }

        private static string GetOrDiscoverEmployeeLookupSql(OracleConnection conn)
        {
            lock (Gate)
            {
                if (cachedEmployeeLookupSql != null)
                {
                    return cachedEmployeeLookupSql.Length == 0 ? null : cachedEmployeeLookupSql;
                }
            }

            string discovered = DiscoverEmployeeLookupSql(conn);
            lock (Gate)
            {
                cachedEmployeeLookupSql = discovered ?? string.Empty;
                return discovered;
            }
        }

        private static string DiscoverEmployeeLookupSql(OracleConnection conn)
        {
            const string sql =
                "SELECT table_name, " +
                "MAX(CASE WHEN column_name IN ('EMP_ID','EMP_CODE','EMPLOYEE_ID','EMPNO','EMP_NUMBER') THEN column_name END) AS id_col, " +
                "MAX(CASE WHEN column_name IN ('EMP_NAME','EMPLOYEE_NAME','FULL_NAME','NAME','EMP_FULL_NAME','CARD_NAME') THEN column_name END) AS name_col " +
                "FROM all_tab_columns WHERE owner = 'SPERS' GROUP BY table_name " +
                "HAVING MAX(CASE WHEN column_name IN ('EMP_ID','EMP_CODE','EMPLOYEE_ID','EMPNO','EMP_NUMBER') THEN 1 END) = 1 " +
                "AND MAX(CASE WHEN column_name IN ('EMP_NAME','EMPLOYEE_NAME','FULL_NAME','NAME','EMP_FULL_NAME','CARD_NAME') THEN 1 END) = 1 " +
                "ORDER BY CASE WHEN table_name LIKE '%EMPLOY%' THEN 0 WHEN table_name LIKE '%EMP%' THEN 1 ELSE 2 END, table_name";

            try
            {
                using (var cmd = Command(conn, null, sql))
                using (var reader = cmd.ExecuteReader())
                {
                    while (reader.Read())
                    {
                        var table = Convert.ToString(reader.GetValue(0), CultureInfo.InvariantCulture).Trim().ToUpperInvariant();
                        var idCol = Convert.ToString(reader.GetValue(1), CultureInfo.InvariantCulture).Trim().ToUpperInvariant();
                        var nameCol = Convert.ToString(reader.GetValue(2), CultureInfo.InvariantCulture).Trim().ToUpperInvariant();
                        if (table.Length == 0 || idCol.Length == 0 || nameCol.Length == 0 || !SafeName.IsMatch(table) || !SafeName.IsMatch(idCol) || !SafeName.IsMatch(nameCol))
                        {
                            continue;
                        }

                        if (table.Contains("RFID") || table.Contains("ASSIGN"))
                        {
                            continue;
                        }

                        return "SELECT " + nameCol + " FROM SPERS." + table + " WHERE UPPER(TRIM(TO_CHAR(" + idCol + "))) = UPPER(TRIM(:emp_id)) AND ROWNUM = 1";
                    }
                }
            }
            catch
            {
                return null;
            }

            return null;
        }

        private static string cachedEmployeeLookupSql;

        private static string ReadString(IDataReader reader, string column)
        {
            int ord = Ordinal(reader, column);
            if (ord < 0 || reader.IsDBNull(ord))
            {
                return string.Empty;
            }

            return Convert.ToString(reader.GetValue(ord), CultureInfo.InvariantCulture).Trim();
        }

        private static decimal ReadDecimal(IDataReader reader, string column)
        {
            int ord = Ordinal(reader, column);
            if (ord < 0 || reader.IsDBNull(ord))
            {
                return 0m;
            }

            return ReadDecimal(reader.GetValue(ord));
        }

        private static string ReadDateDisplay(IDataReader reader, string column)
        {
            int ord = Ordinal(reader, column);
            if (ord < 0 || reader.IsDBNull(ord))
            {
                return string.Empty;
            }

            var value = reader.GetValue(ord);
            DateTime dt;
            if (value is DateTime)
            {
                dt = (DateTime)value;
            }
            else if (!DateTime.TryParse(Convert.ToString(value, CultureInfo.InvariantCulture), CultureInfo.InvariantCulture, DateTimeStyles.None, out dt))
            {
                return Convert.ToString(value, CultureInfo.InvariantCulture).Trim();
            }

            return dt.ToString("dd MMM yyyy", CultureInfo.InvariantCulture);
        }

        private static string FormatYesNo(IDataReader reader, string column)
        {
            var text = ReadString(reader, column);
            if (text.Length == 0)
            {
                return "—";
            }

            if (string.Equals(text, "Y", StringComparison.OrdinalIgnoreCase))
            {
                return "Yes";
            }

            if (string.Equals(text, "N", StringComparison.OrdinalIgnoreCase))
            {
                return "No";
            }

            return text;
        }

        private static int Ordinal(IDataReader reader, string column)
        {
            try
            {
                return reader.GetOrdinal(column);
            }
            catch (IndexOutOfRangeException)
            {
                return -1;
            }
        }

        private static decimal Insert(OracleConnection conn, OracleTransaction tx, TableRef table, RfidInput input)
        {
            var includeId = input.Id.HasValue || !table.HasInsertTrigger;
            string sql;
            var cols = new List<string>();
            var binds = new List<string>();
            if (includeId)
            {
                cols.Add("ID");
                binds.Add(":id");
            }

            cols.Add("EMP_ID");
            binds.Add(":emp_id");
            cols.Add("RFID_NUMBER");
            binds.Add(":rfid_number");
            if (table.HasCardName)
            {
                cols.Add("CARD_NAME");
                binds.Add(":card_name");
            }

            if (table.HasDesignation)
            {
                cols.Add("DESIGNATION");
                binds.Add(":designation");
            }

            if (table.HasDepartment)
            {
                cols.Add("DEPARTMENT");
                binds.Add(":department");
            }

            if (table.HasProjectLocation)
            {
                cols.Add("PROJECT_LOCATION");
                binds.Add(":project_location");
            }

            if (table.HasJoiningDate)
            {
                cols.Add("JOINING_DATE");
                binds.Add(":joining_date");
            }

            if (table.HasBloodGroup)
            {
                cols.Add("BLOOD_GROUP");
                binds.Add(":blood_group");
            }

            if (table.HasCnic)
            {
                cols.Add("CNIC");
                binds.Add(":cnic");
            }

            if (table.HasEmergencyNo)
            {
                cols.Add("EMERGENCY_NO");
                binds.Add(":emergency_no");
            }

            cols.Add("ISSUE_DATE");
            binds.Add(":issue_date");
            cols.Add("EXPIRY_DATE");
            binds.Add(":expiry_date");
            cols.Add("ISSUED_BY");
            binds.Add(":issued_by");
            cols.Add("STATUS");
            binds.Add(":status");
            cols.Add("CREATED_DATE");
            binds.Add(":created_date");
            cols.Add("IS_APPROVED");
            binds.Add(":is_approved");
            cols.Add("APPROVED_DATE");
            binds.Add(":approved_date");
            cols.Add("APPROVE_ID");
            binds.Add(":approve_id");
            cols.Add("HOD_REMARKS");
            binds.Add(":hod_remarks");
            cols.Add("PRINT_DATE");
            binds.Add(":print_date");
            cols.Add("IS_FORWARD_HOD");
            binds.Add(":is_forward_hod");
            cols.Add("FORWARD_HOD_BY");
            binds.Add(":forward_hod_by");
            cols.Add("FORWARD_HOD_ON");
            binds.Add(":forward_hod_on");
            cols.Add("REQUESTER_REMARKS");
            binds.Add(":requester_remarks");
            if (!string.IsNullOrEmpty(table.PhotoColumn))
            {
                cols.Add(table.PhotoColumn);
                binds.Add(":photo_path");
            }

            sql = "INSERT INTO " + table.Qualified + " (" + string.Join(", ", cols.ToArray()) + ") VALUES (" + string.Join(", ", binds.ToArray()) + ") RETURNING ID INTO :new_id";

            using (var cmd = Command(conn, tx, sql))
            {
                if (includeId)
                {
                    AddNumber(cmd, "id", input.Id);
                }

                AddVarchar(cmd, "emp_id", input.EmpId, 20);
                AddVarchar(cmd, "rfid_number", NullIfEmpty(input.RfidNumber), 50);
                if (table.HasCardName)
                {
                    AddVarchar(cmd, "card_name", NullIfEmpty(input.CardName), 100);
                }

                if (table.HasDesignation)
                {
                    AddVarchar(cmd, "designation", NullIfEmpty(input.Designation), 100);
                }

                if (table.HasDepartment)
                {
                    AddVarchar(cmd, "department", NullIfEmpty(input.Department), 100);
                }

                if (table.HasProjectLocation)
                {
                    AddVarchar(cmd, "project_location", NullIfEmpty(input.ProjectLocation), 100);
                }

                if (table.HasJoiningDate)
                {
                    AddDate(cmd, "joining_date", input.JoiningDate);
                }

                if (table.HasBloodGroup)
                {
                    AddVarchar(cmd, "blood_group", NullIfEmpty(input.BloodGroup), 20);
                }

                if (table.HasCnic)
                {
                    AddVarchar(cmd, "cnic", NullIfEmpty(input.Cnic), 20);
                }

                if (table.HasEmergencyNo)
                {
                    AddVarchar(cmd, "emergency_no", NullIfEmpty(input.EmergencyNo), 30);
                }

                AddDate(cmd, "issue_date", input.IssueDate);
                AddDate(cmd, "expiry_date", input.ExpiryDate);
                AddVarchar(cmd, "issued_by", NullIfEmpty(input.IssuedBy), 50);
                AddVarchar(cmd, "status", input.Status, 20);
                AddDate(cmd, "created_date", input.CreatedDate);
                AddVarchar(cmd, "is_approved", string.IsNullOrEmpty(input.IsApproved) ? null : input.IsApproved, 1);
                AddDate(cmd, "approved_date", input.IsApproved == "Y" ? input.ApprovedDate : null);
                AddNumber(cmd, "approve_id", input.IsApproved == "Y" ? input.ApproveId : null);
                AddVarchar(cmd, "hod_remarks", NullIfEmpty(input.HodRemarks), 500);
                AddDate(cmd, "print_date", input.PrintDate);
                AddVarchar(cmd, "is_forward_hod", input.IsForwardHod == "Y" ? "Y" : "N", 1);
                AddVarchar(cmd, "forward_hod_by", input.IsForwardHod == "Y" ? input.ForwardBy : null, 100);
                AddDate(cmd, "forward_hod_on", input.IsForwardHod == "Y" ? input.ForwardOn : null);
                AddVarchar(cmd, "requester_remarks", input.RequesterRemarks, 500);
                if (!string.IsNullOrEmpty(table.PhotoColumn))
                {
                    AddVarchar(cmd, "photo_path", NullIfEmpty(input.PhotoPath), 500);
                }

                var outId = cmd.Parameters.Add("new_id", OracleDbType.Decimal);
                outId.Direction = ParameterDirection.Output;
                cmd.ExecuteNonQuery();
                return ReadDecimal(outId.Value);
            }
        }

        private static decimal NextId(OracleConnection conn, OracleTransaction tx, TableRef table)
        {
            using (var cmd = Command(conn, tx, "SELECT NVL(MAX(ID), 0) + 1 FROM " + table.Qualified))
            {
                return ReadDecimal(cmd.ExecuteScalar());
            }
        }

        private static TableRef ResolveTable(string cs)
        {
            lock (Gate)
            {
                if (cachedTable != null && string.Equals(cachedConnection, cs, StringComparison.Ordinal))
                {
                    if (cachedTable.ForwardColumnsResolved)
                    {
                        return cachedTable;
                    }
                }
            }

            var configured = ConfigurationManager.AppSettings["RfidTableName"];
            using (var conn = new OracleConnection(cs))
            {
                conn.Open();
                ClearBlock();
                string me = ReadUser(conn);
                TableRef table;
                if (!string.IsNullOrWhiteSpace(configured))
                {
                    table = TableFromConfig(configured, me);
                    EnsureExists(conn, table);
                }
                else
                {
                    table = Discover(conn, me);
                }

                table.HasInsertTrigger = HasInsertTrigger(conn, table);
                table.PhotoColumn = ResolvePhotoColumn(conn, table);
                table.NameColumn = ResolveNameColumn(conn, table);
                ResolveProfileColumns(conn, table);
                ResolveForwardColumns(conn, table);
                lock (Gate)
                {
                    cachedTable = table;
                    cachedConnection = cs;
                }

                return table;
            }
        }

        private static string ResolvePhotoColumn(OracleConnection conn, TableRef table)
        {
            var configured = ConfigurationManager.AppSettings["RfidPhotoColumn"];
            if (!string.IsNullOrWhiteSpace(configured))
            {
                var name = configured.Trim().ToUpperInvariant();
                if (SafeName.IsMatch(name) && ColumnExists(conn, table, name))
                {
                    return name;
                }
            }

            var candidates = new[]
            {
                "PHOTO_PATH", "EMP_PHOTO_PATH", "EMP_PHOTO", "IMAGE_PATH", "PHOTO", "EMP_IMAGE", "PICTURE_PATH", "PHOTO_URL"
            };
            for (int i = 0; i < candidates.Length; i++)
            {
                if (ColumnExists(conn, table, candidates[i]))
                {
                    return candidates[i];
                }
            }

            return null;
        }

        private static void ResolveProfileColumns(OracleConnection conn, TableRef table)
        {
            table.HasCardName = ColumnExists(conn, table, "CARD_NAME");
            table.HasDesignation = ColumnExists(conn, table, "DESIGNATION");
            table.HasDepartment = ColumnExists(conn, table, "DEPARTMENT");
            table.HasProjectLocation = ColumnExists(conn, table, "PROJECT_LOCATION");
            table.HasJoiningDate = ColumnExists(conn, table, "JOINING_DATE");
            table.HasBloodGroup = ColumnExists(conn, table, "BLOOD_GROUP");
            table.HasCnic = ColumnExists(conn, table, "CNIC");
            table.HasEmergencyNo = ColumnExists(conn, table, "EMERGENCY_NO");
            table.HasStatusRemarks = ColumnExists(conn, table, "STATUS_REMARKS");
        }

        private static void ResolveForwardColumns(OracleConnection conn, TableRef table)
        {
            table.HasIsForwardHod = ColumnExists(conn, table, "IS_FORWARD_HOD");
            if (ColumnExists(conn, table, "FORWARD_HOD_BY"))
            {
                table.ForwardByColumn = "FORWARD_HOD_BY";
            }

            if (ColumnExists(conn, table, "FORWARD_HOD_ON"))
            {
                table.ForwardOnColumn = "FORWARD_HOD_ON";
            }
            else if (ColumnExists(conn, table, "FORWARD_ON"))
            {
                table.ForwardOnColumn = "FORWARD_ON";
            }

            table.ForwardColumnsResolved = true;
        }

        private static string ResolveNameColumn(OracleConnection conn, TableRef table)
        {
            var candidates = new[]
            {
                "CARD_NAME", "EMP_NAME", "EMPLOYEE_NAME", "FULL_NAME", "NAME_ON_CARD", "NAME"
            };
            for (int i = 0; i < candidates.Length; i++)
            {
                if (ColumnExists(conn, table, candidates[i]))
                {
                    return candidates[i];
                }
            }

            return null;
        }

        private static bool ColumnExists(OracleConnection conn, TableRef table, string columnName)
        {
            using (var cmd = Command(conn, null, "SELECT 1 FROM all_tab_columns WHERE owner = :owner AND table_name = :name AND column_name = :col AND ROWNUM = 1"))
            {
                AddVarchar(cmd, "owner", table.Owner, 128);
                AddVarchar(cmd, "name", table.Name, 128);
                AddVarchar(cmd, "col", columnName, 128);
                return cmd.ExecuteScalar() != null;
            }
        }

        private static TableRef Discover(OracleConnection conn, string me)
        {
            var matches = new List<TableRef>();
            const string sql = "SELECT owner, table_name FROM all_tab_columns WHERE column_name IN ('EMP_ID','RFID_NUMBER','REQUESTER_REMARKS','IS_FORWARD_HOD','HOD_REMARKS') GROUP BY owner, table_name HAVING COUNT(DISTINCT column_name) = 5 ORDER BY owner, table_name";
            using (var cmd = Command(conn, null, sql))
            using (var reader = cmd.ExecuteReader())
            {
                while (reader.Read())
                {
                    matches.Add(new TableRef
                    {
                        Owner = Convert.ToString(reader.GetValue(0)).ToUpperInvariant(),
                        Name = Convert.ToString(reader.GetValue(1)).ToUpperInvariant()
                    });
                }
            }

            if (matches.Count == 0)
            {
                throw new InvalidOperationException("No SPERS table has EMP_ID, RFID_NUMBER, REQUESTER_REMARKS, IS_FORWARD_HOD, and HOD_REMARKS. Set RfidTableName in Web.config to the table that owns this form.");
            }

            var own = new List<TableRef>();
            for (int i = 0; i < matches.Count; i++)
            {
                if (string.Equals(matches[i].Owner, me, StringComparison.OrdinalIgnoreCase))
                {
                    own.Add(matches[i]);
                }
            }

            var pool = own.Count > 0 ? own : matches;
            TableRef chosen = pool[0];
            if (pool.Count > 1)
            {
                TableRef rfidNamed = null;
                int named = 0;
                for (int i = 0; i < pool.Count; i++)
                {
                    if (pool[i].Name.IndexOf("RFID", StringComparison.OrdinalIgnoreCase) >= 0)
                    {
                        rfidNamed = pool[i];
                        named++;
                    }
                }

                if (named == 1)
                {
                    chosen = rfidNamed;
                }
                else
                {
                    var names = new List<string>();
                    for (int i = 0; i < pool.Count; i++)
                    {
                        names.Add(pool[i].Owner + "." + pool[i].Name);
                    }

                    throw new InvalidOperationException("More than one table matches this form: " + string.Join(", ", names.ToArray()) + ". Set RfidTableName in Web.config to the right one.");
                }
            }

            chosen.Qualified = Qualify(chosen, me);
            return chosen;
        }

        private static TableRef TableFromConfig(string configured, string me)
        {
            var parts = configured.Trim().Split('.');
            if (parts.Length > 2)
            {
                throw new InvalidOperationException("RfidTableName must be a table name, or OWNER.TABLE.");
            }

            var table = new TableRef();
            if (parts.Length == 2)
            {
                table.Owner = parts[0].Trim().ToUpperInvariant();
                table.Name = parts[1].Trim().ToUpperInvariant();
            }
            else
            {
                table.Owner = me.ToUpperInvariant();
                table.Name = parts[0].Trim().ToUpperInvariant();
            }

            if (!SafeName.IsMatch(table.Owner) || !SafeName.IsMatch(table.Name))
            {
                throw new InvalidOperationException("RfidTableName contains characters that are not allowed in an Oracle name.");
            }

            table.Qualified = Qualify(table, me);
            return table;
        }

        private static void EnsureExists(OracleConnection conn, TableRef table)
        {
            using (var cmd = Command(conn, null, "SELECT 1 FROM all_tables WHERE owner = :owner AND table_name = :name AND ROWNUM = 1"))
            {
                AddVarchar(cmd, "owner", table.Owner, 128);
                AddVarchar(cmd, "name", table.Name, 128);
                var found = cmd.ExecuteScalar();
                if (found == null || found == DBNull.Value)
                {
                    throw new InvalidOperationException("Table " + table.Owner + "." + table.Name + " was not found. Check RfidTableName in Web.config.");
                }
            }
        }

        private static bool HasInsertTrigger(OracleConnection conn, TableRef table)
        {
            try
            {
                using (var cmd = Command(conn, null, "SELECT COUNT(*) FROM all_triggers WHERE table_owner = :owner AND table_name = :name AND status = 'ENABLED' AND UPPER(triggering_event) LIKE '%INSERT%'"))
                {
                    AddVarchar(cmd, "owner", table.Owner, 128);
                    AddVarchar(cmd, "name", table.Name, 128);
                    return ReadDecimal(cmd.ExecuteScalar()) > 0;
                }
            }
            catch (OracleException)
            {
                return false;
            }
        }

        private static string Qualify(TableRef table, string me)
        {
            if (string.Equals(table.Owner, me, StringComparison.OrdinalIgnoreCase))
            {
                return table.Name;
            }

            return table.Owner + "." + table.Name;
        }

        private static string ReadUser(OracleConnection conn)
        {
            using (var cmd = Command(conn, null, "SELECT USER FROM DUAL"))
            {
                return Convert.ToString(cmd.ExecuteScalar()).ToUpperInvariant();
            }
        }

        private static bool TryConnectionString(out string connectionString, out string message)
        {
            connectionString = null;
            message = null;
            var entry = ConfigurationManager.ConnectionStrings[ConnectionName];
            if (entry == null || string.IsNullOrWhiteSpace(entry.ConnectionString))
            {
                message = "OracleConnection is missing from Web.config.";
                return false;
            }

            connectionString = entry.ConnectionString;
            try
            {
                var builder = new OracleConnectionStringBuilder(connectionString);
                if (string.IsNullOrEmpty(builder.Password))
                {
                    message = "SPERS at 172.16.10.60:1521 (SID orcl) is reachable, but the password in Web.config is empty. Set Password= on OracleConnection, then refresh this page.";
                    return false;
                }
            }
            catch (Exception ex)
            {
                message = "The Oracle connection string in Web.config could not be read. " + ex.Message;
                return false;
            }

            return true;
        }

        private static bool IsBlocked(string cs)
        {
            lock (Gate)
            {
                return blockedConnection != null && string.Equals(blockedConnection, cs, StringComparison.Ordinal);
            }
        }

        private static void ClearBlock()
        {
            lock (Gate)
            {
                blockedConnection = null;
                blockedMessage = null;
            }
        }

        private static void NoteAuthFailure(string cs, Exception ex, string described)
        {
            if (!RfidErrors.IsAuthOrEmpty(ex) && !RfidErrors.IsLocked(ex))
            {
                return;
            }

            lock (Gate)
            {
                blockedConnection = cs;
                blockedMessage = described + " Further login attempts are paused so the SPERS account is not locked. Fix Web.config and restart the site.";
            }
        }

        private static SaveResult ErrorResult(string message)
        {
            return new SaveResult
            {
                Success = false,
                Kind = "error",
                Title = "The record was not saved",
                Messages = new List<string> { message },
                Fields = new List<string>()
            };
        }

        private static string NullIfEmpty(string value)
        {
            return string.IsNullOrEmpty(value) ? null : value;
        }

        private static OracleCommand Command(OracleConnection conn, OracleTransaction tx, string sql)
        {
            var cmd = conn.CreateCommand();
            cmd.BindByName = true;
            cmd.CommandText = sql;
            if (tx != null)
            {
                cmd.Transaction = tx;
            }

            return cmd;
        }

        private static void AddVarchar(OracleCommand cmd, string name, string value, int size)
        {
            var p = cmd.Parameters.Add(name, OracleDbType.Varchar2, size);
            p.Value = string.IsNullOrEmpty(value) ? (object)DBNull.Value : value;
        }

        private static void AddDate(OracleCommand cmd, string name, DateTime? value)
        {
            var p = cmd.Parameters.Add(name, OracleDbType.Date);
            p.Value = value.HasValue ? (object)value.Value : DBNull.Value;
        }

        private static void AddNumber(OracleCommand cmd, string name, decimal? value)
        {
            var p = cmd.Parameters.Add(name, OracleDbType.Decimal);
            p.Value = value.HasValue ? (object)value.Value : DBNull.Value;
        }

        private static decimal ReadDecimal(object value)
        {
            if (value == null || value == DBNull.Value)
            {
                return 0m;
            }

            return Convert.ToDecimal(value.ToString(), CultureInfo.InvariantCulture);
        }

        private class TableRef
        {
            public string Owner { get; set; }
            public string Name { get; set; }
            public string Qualified { get; set; }
            public bool HasInsertTrigger { get; set; }
            public string PhotoColumn { get; set; }
            public string NameColumn { get; set; }
            public bool HasCardName { get; set; }
            public bool HasDesignation { get; set; }
            public bool HasDepartment { get; set; }
            public bool HasProjectLocation { get; set; }
            public bool HasJoiningDate { get; set; }
            public bool HasBloodGroup { get; set; }
            public bool HasCnic { get; set; }
            public bool HasEmergencyNo { get; set; }
            public bool HasStatusRemarks { get; set; }
            public bool HasIsForwardHod { get; set; }
            public string ForwardByColumn { get; set; }
            public string ForwardOnColumn { get; set; }
            public bool ForwardColumnsResolved { get; set; }
        }
    }

    public static class RfidErrors
    {
        public static string Describe(Exception ex)
        {
            var oracle = FindOracle(ex);
            if (oracle != null)
            {
                switch (oracle.Number)
                {
                    case 1005:
                        return "SPERS at 172.16.10.60:1521 (SID orcl) is reachable, but the password in Web.config is empty. Set Password= on OracleConnection, then refresh this page.";
                    case 1017:
                        return "Oracle refused the SPERS login. Update the password on OracleConnection in Web.config.";
                    case 28000:
                        return "The SPERS account is locked. Ask the DBA to unlock it before trying again.";
                    case 28001:
                        return "The SPERS password has expired. Reset it, then update Web.config.";
                    case 1:
                        return "A record with the same key already exists.";
                    case 1400:
                        return "A required database column was empty.";
                    case 12899:
                        return "One of the values is longer than the database column allows.";
                    case 904:
                        return "The target table is missing one of the expected columns. Check RfidTableName in Web.config.";
                    case 942:
                        return "The RFID table was not found in SPERS. Set RfidTableName in Web.config.";
                    case 12154:
                    case 12541:
                    case 12514:
                    case 12505:
                    case 12170:
                    case 12545:
                        return "Could not reach Oracle at 172.16.10.60 port 1521, SID orcl. Connect to that network and try again.";
                    default:
                        return "Oracle could not complete the request (ORA-" + oracle.Number.ToString(CultureInfo.InvariantCulture) + ").";
                }
            }

            var plain = ex == null ? "Unknown error." : ex.Message;
            if (string.IsNullOrEmpty(plain))
            {
                plain = "Unknown error.";
            }

            var line = plain.Split('\n')[0].Trim();
            if (line.IndexOf("Password=", StringComparison.OrdinalIgnoreCase) >= 0)
            {
                return "The database request failed.";
            }

            return line;
        }

        public static bool IsUniqueViolation(Exception ex)
        {
            var oracle = FindOracle(ex);
            return oracle != null && oracle.Number == 1;
        }

        public static bool IsAuthOrEmpty(Exception ex)
        {
            var oracle = FindOracle(ex);
            return oracle != null && (oracle.Number == 1017 || oracle.Number == 1005);
        }

        public static bool IsLocked(Exception ex)
        {
            var oracle = FindOracle(ex);
            return oracle != null && (oracle.Number == 28000 || oracle.Number == 28001);
        }

        private static OracleException FindOracle(Exception ex)
        {
            while (ex != null)
            {
                var oracle = ex as OracleException;
                if (oracle != null)
                {
                    return oracle;
                }

                ex = ex.InnerException;
            }

            return null;
        }
    }
}
