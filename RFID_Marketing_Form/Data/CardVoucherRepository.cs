using System;
using System.Collections.Generic;
using System.Configuration;
using System.Globalization;
using Oracle.ManagedDataAccess.Client;

namespace RFID_Marketing_Form.Data
{
    public class CardVoucherRepository
    {
        private const string ConnectionName = "OracleConnection";

        private static string TableName
        {
            get
            {
                var configured = ConfigurationManager.AppSettings["CardVouchersTableName"];
                return string.IsNullOrWhiteSpace(configured) ? "SPERS.CARD_VOUCHERS" : configured.Trim();
            }
        }

        public RfidRecordsResult GetOrCreateVoucher(
            decimal assignmentId,
            string recordScope,
            string generatedBy,
            RfidRecord employeeRecord,
            FamilyCardRecord familyRecord)
        {
            if (assignmentId <= 0)
            {
                return RfidRecordsResult.Fail("A valid record ID is required.");
            }

            recordScope = NormalizeScope(recordScope);
            string cs;
            if (!TryConnectionString(out cs))
            {
                return RfidRecordsResult.Fail("Database connection is not configured.");
            }

            try
            {
                using (var conn = new OracleConnection(cs))
                {
                    conn.Open();
                    var existing = TryLoadVoucher(conn, assignmentId, recordScope);
                    if (existing != null)
                    {
                        return new RfidRecordsResult { Ok = true, Voucher = existing };
                    }

                    var voucher = BuildNewVoucher(assignmentId, recordScope, generatedBy, employeeRecord, familyRecord);
                    InsertVoucher(conn, voucher);
                    return new RfidRecordsResult { Ok = true, Voucher = voucher };
                }
            }
            catch (OracleException ex)
            {
                if (ex.Number == 942)
                {
                    return RfidRecordsResult.Fail(
                        "Table CARD_VOUCHERS was not found. Run Sql/Create_Card_Vouchers_Table.sql on Oracle first.");
                }

                return RfidRecordsResult.Fail(RfidErrors.Describe(ex));
            }
            catch (Exception ex)
            {
                return RfidRecordsResult.Fail(RfidErrors.Describe(ex));
            }
        }

        public RfidRecordsResult MarkVoucherPaid(decimal voucherId, string paidBy)
        {
            return SetVoucherStatus(voucherId, "PAID", paidBy);
        }

        public RfidRecordsResult MarkVoucherUnpaid(decimal voucherId, string updatedBy)
        {
            return SetVoucherStatus(voucherId, "GENERATED", updatedBy);
        }

        public RfidRecordsResult SetVoucherStatus(decimal voucherId, string status, string actor)
        {
            if (voucherId <= 0)
            {
                return RfidRecordsResult.Fail("A valid voucher ID is required.");
            }

            status = NormalizeVoucherStatus(status);
            if (status == null)
            {
                return RfidRecordsResult.Fail("Status must be PAID or GENERATED (unpaid).");
            }

            string cs;
            if (!TryConnectionString(out cs))
            {
                return RfidRecordsResult.Fail("Database connection is not configured.");
            }

            var actorName = NullIfEmpty(actor) ?? "SYSTEM";

            try
            {
                using (var conn = new OracleConnection(cs))
                {
                    conn.Open();
                    string sql;
                    if (status == "PAID")
                    {
                        sql = "UPDATE " + TableName + @" SET STATUS = 'PAID', PAID_BY = :actor, PAID_ON = SYSDATE,
                            UPDATED_BY = :actor, UPDATED_ON = SYSDATE WHERE VOUCHER_ID = :id";
                    }
                    else
                    {
                        sql = "UPDATE " + TableName + @" SET STATUS = 'GENERATED', PAID_BY = NULL, PAID_ON = NULL,
                            UPDATED_BY = :actor, UPDATED_ON = SYSDATE WHERE VOUCHER_ID = :id";
                    }

                    using (var cmd = new OracleCommand(sql, conn))
                    {
                        cmd.BindByName = true;
                        cmd.Parameters.Add("actor", OracleDbType.Varchar2).Value = actorName;
                        cmd.Parameters.Add("id", OracleDbType.Decimal).Value = voucherId;
                        var rows = cmd.ExecuteNonQuery();
                        if (rows == 0)
                        {
                            return RfidRecordsResult.Fail("Voucher not found.");
                        }
                    }

                    return LoadVoucherById(conn, voucherId);
                }
            }
            catch (Exception ex)
            {
                return RfidRecordsResult.Fail(RfidErrors.Describe(ex));
            }
        }

        public RfidRecordsResult GetVoucherById(decimal voucherId)
        {
            if (voucherId <= 0)
            {
                return RfidRecordsResult.Fail("A valid voucher ID is required.");
            }

            string cs;
            if (!TryConnectionString(out cs))
            {
                return RfidRecordsResult.Fail("Database connection is not configured.");
            }

            try
            {
                using (var conn = new OracleConnection(cs))
                {
                    conn.Open();
                    return LoadVoucherById(conn, voucherId);
                }
            }
            catch (Exception ex)
            {
                return RfidRecordsResult.Fail(RfidErrors.Describe(ex));
            }
        }

        public RfidRecordsResult ListVouchers(string statusFilter)
        {
            string cs;
            if (!TryConnectionString(out cs))
            {
                return RfidRecordsResult.Fail("Database connection is not configured.");
            }

            var filter = NormalizeVoucherStatus(statusFilter);
            var list = new List<CardVoucherRecord>();

            try
            {
                using (var conn = new OracleConnection(cs))
                {
                    conn.Open();
                    var sql =
                        "SELECT VOUCHER_ID, ASSIGNMENT_ID, RECORD_SCOPE, VOUCHER_NO, VOUCHER_TYPE, REF_NO, EMPLOYEE_NAME, CNIC, " +
                        "CATEGORY_NAME, AMOUNT, CARD_COUNT, STATUS, GENERATED_BY, GENERATED_ON, PAID_BY, PAID_ON, REMARKS " +
                        "FROM " + TableName;
                    if (filter == "PAID")
                    {
                        sql += " WHERE STATUS = 'PAID'";
                    }
                    else if (filter == "GENERATED")
                    {
                        sql += " WHERE STATUS = 'GENERATED'";
                    }

                    sql += " ORDER BY GENERATED_ON DESC, VOUCHER_ID DESC";

                    using (var cmd = new OracleCommand(sql, conn))
                    using (var reader = cmd.ExecuteReader())
                    {
                        while (reader.Read())
                        {
                            list.Add(ReadVoucher(reader));
                        }
                    }
                }

                return new RfidRecordsResult { Ok = true, Vouchers = list };
            }
            catch (OracleException ex)
            {
                if (ex.Number == 942)
                {
                    return RfidRecordsResult.Fail(
                        "Table CARD_VOUCHERS was not found. Run Sql/Create_Card_Vouchers_Table.sql on Oracle first.");
                }

                return RfidRecordsResult.Fail(RfidErrors.Describe(ex));
            }
            catch (Exception ex)
            {
                return RfidRecordsResult.Fail(RfidErrors.Describe(ex));
            }
        }

        private static RfidRecordsResult LoadVoucherById(OracleConnection conn, decimal voucherId)
        {
            using (var cmd = new OracleCommand(
                "SELECT VOUCHER_ID, ASSIGNMENT_ID, RECORD_SCOPE, VOUCHER_NO, VOUCHER_TYPE, REF_NO, EMPLOYEE_NAME, CNIC, " +
                "CATEGORY_NAME, AMOUNT, CARD_COUNT, STATUS, GENERATED_BY, GENERATED_ON, PAID_BY, PAID_ON, REMARKS " +
                "FROM " + TableName + " WHERE VOUCHER_ID = :id", conn))
            {
                cmd.BindByName = true;
                cmd.Parameters.Add("id", OracleDbType.Decimal).Value = voucherId;
                using (var reader = cmd.ExecuteReader())
                {
                    if (!reader.Read())
                    {
                        return RfidRecordsResult.Fail("Voucher not found.");
                    }

                    return new RfidRecordsResult { Ok = true, Voucher = ReadVoucher(reader) };
                }
            }
        }

        private static string NormalizeVoucherStatus(string status)
        {
            if (string.IsNullOrWhiteSpace(status))
            {
                return null;
            }

            var s = status.Trim().ToUpperInvariant();
            if (s == "UNPAID" || s == "GENERATED" || s == "PENDING")
            {
                return "GENERATED";
            }

            if (s == "PAID")
            {
                return "PAID";
            }

            return null;
        }

        private static CardVoucherRecord BuildNewVoucher(
            decimal assignmentId,
            string recordScope,
            string generatedBy,
            RfidRecord employeeRecord,
            FamilyCardRecord familyRecord)
        {
            var isFamily = recordScope == "FAMILY";
            var name = isFamily
                ? (familyRecord != null ? familyRecord.CardName : null)
                : (employeeRecord != null ? employeeRecord.EmployeeName : null);
            var cnic = isFamily
                ? (familyRecord != null ? familyRecord.Cnic : null)
                : (employeeRecord != null ? employeeRecord.Cnic : null);
            if (string.IsNullOrWhiteSpace(name))
            {
                name = isFamily ? "Family member" : "Employee";
            }

            var amount = CardVoucherHelper.DefaultAmount(recordScope);
            var category = CardVoucherHelper.DefaultCategory(recordScope);
            var refNo = CardVoucherHelper.ResolveRefNo(employeeRecord, familyRecord);
            var voucherNo = "CR-" + assignmentId.ToString(CultureInfo.InvariantCulture) + "-" +
                            DateTime.Now.ToString("yyMMddHHmmss", CultureInfo.InvariantCulture);

            return new CardVoucherRecord
            {
                AssignmentId = assignmentId,
                RecordScope = recordScope,
                VoucherNo = voucherNo,
                VoucherType = "INDIVIDUAL",
                RefNo = refNo,
                EmployeeName = name.Trim(),
                Cnic = string.IsNullOrWhiteSpace(cnic) ? "—" : cnic.Trim(),
                CategoryName = category,
                Amount = amount,
                CardCount = 1,
                Status = "GENERATED",
                GeneratedBy = NullIfEmpty(generatedBy) ?? "SYSTEM",
                GeneratedOn = DateTime.Now.ToString("dd-MMM-yy", CultureInfo.InvariantCulture),
                AmountWords = CardVoucherHelper.NumberToWords((int)amount) + " Only"
            };
        }

        private static void InsertVoucher(OracleConnection conn, CardVoucherRecord voucher)
        {
            var sql = @"INSERT INTO " + TableName + @" (
                ASSIGNMENT_ID, RECORD_SCOPE, VOUCHER_NO, VOUCHER_TYPE, REF_NO, EMPLOYEE_NAME, CNIC,
                CATEGORY_NAME, AMOUNT, CARD_COUNT, STATUS, GENERATED_BY, GENERATED_ON)
                VALUES (
                :assignment_id, :record_scope, :voucher_no, :voucher_type, :ref_no, :employee_name, :cnic,
                :category_name, :amount, :card_count, :status, :generated_by, SYSDATE)
                RETURNING VOUCHER_ID INTO :voucher_id";

            using (var cmd = new OracleCommand(sql, conn))
            {
                cmd.BindByName = true;
                cmd.Parameters.Add("assignment_id", OracleDbType.Decimal).Value = voucher.AssignmentId;
                cmd.Parameters.Add("record_scope", OracleDbType.Varchar2).Value = voucher.RecordScope;
                cmd.Parameters.Add("voucher_no", OracleDbType.Varchar2).Value = voucher.VoucherNo;
                cmd.Parameters.Add("voucher_type", OracleDbType.Varchar2).Value = voucher.VoucherType;
                cmd.Parameters.Add("ref_no", OracleDbType.Varchar2).Value = voucher.RefNo ?? string.Empty;
                cmd.Parameters.Add("employee_name", OracleDbType.Varchar2).Value = voucher.EmployeeName ?? string.Empty;
                cmd.Parameters.Add("cnic", OracleDbType.Varchar2).Value = voucher.Cnic ?? string.Empty;
                cmd.Parameters.Add("category_name", OracleDbType.Varchar2).Value = voucher.CategoryName ?? string.Empty;
                cmd.Parameters.Add("amount", OracleDbType.Decimal).Value = voucher.Amount;
                cmd.Parameters.Add("card_count", OracleDbType.Int32).Value = voucher.CardCount;
                cmd.Parameters.Add("status", OracleDbType.Varchar2).Value = voucher.Status ?? "GENERATED";
                cmd.Parameters.Add("generated_by", OracleDbType.Varchar2).Value = voucher.GeneratedBy ?? string.Empty;
                var outId = new OracleParameter("voucher_id", OracleDbType.Decimal)
                {
                    Direction = System.Data.ParameterDirection.Output
                };
                cmd.Parameters.Add(outId);
                cmd.ExecuteNonQuery();
                voucher.VoucherId = Convert.ToDecimal(outId.Value.ToString(), CultureInfo.InvariantCulture);
            }
        }

        private static CardVoucherRecord TryLoadVoucher(OracleConnection conn, decimal assignmentId, string recordScope)
        {
            using (var cmd = new OracleCommand(
                "SELECT VOUCHER_ID, ASSIGNMENT_ID, RECORD_SCOPE, VOUCHER_NO, VOUCHER_TYPE, REF_NO, EMPLOYEE_NAME, CNIC, " +
                "CATEGORY_NAME, AMOUNT, CARD_COUNT, STATUS, GENERATED_BY, GENERATED_ON, PAID_BY, PAID_ON, REMARKS " +
                "FROM " + TableName + " WHERE ASSIGNMENT_ID = :aid AND RECORD_SCOPE = :scope AND VOUCHER_TYPE = 'INDIVIDUAL' AND ROWNUM = 1", conn))
            {
                cmd.BindByName = true;
                cmd.Parameters.Add("aid", OracleDbType.Decimal).Value = assignmentId;
                cmd.Parameters.Add("scope", OracleDbType.Varchar2).Value = recordScope;
                using (var reader = cmd.ExecuteReader())
                {
                    if (!reader.Read())
                    {
                        return null;
                    }

                    return ReadVoucher(reader);
                }
            }
        }

        private static CardVoucherRecord ReadVoucher(OracleDataReader reader)
        {
            var amount = reader["AMOUNT"] == DBNull.Value ? 0m : Convert.ToDecimal(reader["AMOUNT"], CultureInfo.InvariantCulture);
            var generatedOn = reader["GENERATED_ON"];
            string genText;
            if (generatedOn == DBNull.Value)
            {
                genText = DateTime.Now.ToString("dd-MMM-yy", CultureInfo.InvariantCulture);
            }
            else
            {
                genText = Convert.ToDateTime(generatedOn, CultureInfo.InvariantCulture)
                    .ToString("dd-MMM-yy", CultureInfo.InvariantCulture);
            }

            var voucher = new CardVoucherRecord
            {
                VoucherId = Convert.ToDecimal(reader["VOUCHER_ID"].ToString(), CultureInfo.InvariantCulture),
                AssignmentId = Convert.ToDecimal(reader["ASSIGNMENT_ID"].ToString(), CultureInfo.InvariantCulture),
                RecordScope = Convert.ToString(reader["RECORD_SCOPE"]),
                VoucherNo = Convert.ToString(reader["VOUCHER_NO"]),
                VoucherType = Convert.ToString(reader["VOUCHER_TYPE"]),
                RefNo = Convert.ToString(reader["REF_NO"]),
                EmployeeName = Convert.ToString(reader["EMPLOYEE_NAME"]),
                Cnic = Convert.ToString(reader["CNIC"]),
                CategoryName = Convert.ToString(reader["CATEGORY_NAME"]),
                Amount = amount,
                CardCount = reader["CARD_COUNT"] == DBNull.Value ? 1 : Convert.ToInt32(reader["CARD_COUNT"], CultureInfo.InvariantCulture),
                Status = Convert.ToString(reader["STATUS"]),
                GeneratedBy = Convert.ToString(reader["GENERATED_BY"]),
                GeneratedOn = genText,
                PaidBy = reader["PAID_BY"] == DBNull.Value ? null : Convert.ToString(reader["PAID_BY"]),
                PaidOn = reader["PAID_ON"] == DBNull.Value
                    ? null
                    : Convert.ToDateTime(reader["PAID_ON"], CultureInfo.InvariantCulture)
                        .ToString("dd-MMM-yy", CultureInfo.InvariantCulture),
                Remarks = reader["REMARKS"] == DBNull.Value ? null : Convert.ToString(reader["REMARKS"]),
                AmountWords = CardVoucherHelper.NumberToWords((int)amount) + " Only"
            };
            return voucher;
        }

        private static string NormalizeScope(string scope)
        {
            return string.Equals(scope, "family", StringComparison.OrdinalIgnoreCase) ? "FAMILY" : "EMPLOYEE";
        }

        private static bool TryConnectionString(out string cs)
        {
            cs = ConfigurationManager.ConnectionStrings[ConnectionName] != null
                ? ConfigurationManager.ConnectionStrings[ConnectionName].ConnectionString
                : null;
            return !string.IsNullOrWhiteSpace(cs);
        }

        private static string NullIfEmpty(string value)
        {
            return string.IsNullOrWhiteSpace(value) ? null : value.Trim();
        }
    }
}
