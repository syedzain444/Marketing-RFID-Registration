using System;
using System.Collections.Generic;
using System.Configuration;
using System.Data;
using System.Globalization;
using Oracle.ManagedDataAccess.Client;

namespace RFID_Marketing_Form.Data
{
    public class MarketingAuthRepository
    {
        private const string ConnectionName = "OracleConnection";
        private static readonly string UsersTable = "SPERS.APP_USERS_MARKETING";
        private static readonly string RolesTable = "SPERS.APP_ROLES_MARKETING";
        private static readonly string PermissionsTable = "SPERS.APP_PERMISSIONS_MARKETING";
        private static readonly string RolePermTable = "SPERS.APP_ROLE_PERMISSIONS_MARKETING";

        public MarketingLoginResult Login(string empId, string password)
        {
            var result = new MarketingLoginResult { Permissions = new List<string>() };
            if (string.IsNullOrWhiteSpace(empId) || string.IsNullOrWhiteSpace(password))
            {
                result.Error = "Employee ID and password are required.";
                return result;
            }

            empId = empId.Trim();
            EnsureBootstrapAdmin();

            string cs;
            if (!TryConnectionString(out cs))
            {
                result.Error = "Oracle connection is not configured.";
                return result;
            }

            try
            {
                using (var conn = new OracleConnection(cs))
                {
                    conn.Open();
                    MarketingUser user;
                    string hash;
                    if (!TryReadUserCredentials(conn, empId, out user, out hash))
                    {
                        result.Error = "Invalid employee ID or password.";
                        return result;
                    }

                    if (!user.IsActive)
                    {
                        result.Error = "This account is inactive. Contact an administrator.";
                        return result;
                    }

                    if (!PasswordHasher.Verify(password, hash))
                    {
                        result.Error = "Invalid employee ID or password.";
                        return result;
                    }

                    TouchLastLogin(conn, user.Id);
                    var perms = LoadPermissionsForRole(conn, user.RoleCode);
                    result.Success = true;
                    result.User = user;
                    result.Permissions = perms;
                    return result;
                }
            }
            catch (Exception ex)
            {
                result.Error = RfidErrors.Describe(ex);
                return result;
            }
        }

        public void EnsureBootstrapAdmin()
        {
            var empId = ConfigurationManager.AppSettings["BootstrapAdminEmpId"];
            var password = ConfigurationManager.AppSettings["BootstrapAdminPassword"];
            if (string.IsNullOrWhiteSpace(empId) || string.IsNullOrWhiteSpace(password))
            {
                return;
            }

            string cs;
            if (!TryConnectionString(out cs))
            {
                return;
            }

            try
            {
                using (var conn = new OracleConnection(cs))
                {
                    conn.Open();
                    if (UserCount(conn) > 0)
                    {
                        return;
                    }

                    if (!TableExists(conn, UsersTable))
                    {
                        return;
                    }

                    var hash = PasswordHasher.HashPassword(password.Trim());
                    using (var cmd = conn.CreateCommand())
                    {
                        cmd.CommandText =
                            "INSERT INTO " + UsersTable +
                            " (EMP_ID, PASSWORD_HASH, ROLE_CODE, DISPLAY_NAME, IS_ACTIVE) " +
                            "VALUES (:emp, :hash, 'ADMIN', :name, 'Y')";
                        cmd.Parameters.Add("emp", OracleDbType.Varchar2, empId.Trim(), ParameterDirection.Input);
                        cmd.Parameters.Add("hash", OracleDbType.Varchar2, hash, ParameterDirection.Input);
                        cmd.Parameters.Add("name", OracleDbType.Varchar2, "Bootstrap Administrator", ParameterDirection.Input);
                        cmd.ExecuteNonQuery();
                    }
                }
            }
            catch
            {
                // Bootstrap is best-effort; login will surface real errors.
            }
        }

        public MarketingUser GetUserByEmpId(string empId)
        {
            if (string.IsNullOrWhiteSpace(empId))
            {
                return null;
            }

            string cs;
            if (!TryConnectionString(out cs))
            {
                return null;
            }

            try
            {
                using (var conn = new OracleConnection(cs))
                {
                    conn.Open();
                    MarketingUser user;
                    string hash;
                    return TryReadUserCredentials(conn, empId.Trim(), out user, out hash) ? user : null;
                }
            }
            catch
            {
                return null;
            }
        }

        public List<string> GetPermissionsForRole(string roleCode)
        {
            string cs;
            if (!TryConnectionString(out cs) || string.IsNullOrWhiteSpace(roleCode))
            {
                return new List<string>();
            }

            try
            {
                using (var conn = new OracleConnection(cs))
                {
                    conn.Open();
                    return LoadPermissionsForRole(conn, roleCode.Trim());
                }
            }
            catch
            {
                return new List<string>();
            }
        }

        public List<MarketingRole> ListRoles(bool activeOnly)
        {
            var list = new List<MarketingRole>();
            string cs;
            if (!TryConnectionString(out cs))
            {
                return list;
            }

            using (var conn = new OracleConnection(cs))
            {
                conn.Open();
                using (var cmd = conn.CreateCommand())
                {
                    cmd.CommandText =
                        "SELECT ROLE_CODE, ROLE_NAME, DESCRIPTION, SORT_ORDER, IS_ACTIVE FROM " + RolesTable +
                        (activeOnly ? " WHERE IS_ACTIVE = 'Y'" : string.Empty) +
                        " ORDER BY SORT_ORDER, ROLE_NAME";
                    using (var reader = cmd.ExecuteReader())
                    {
                        while (reader.Read())
                        {
                            list.Add(new MarketingRole
                            {
                                RoleCode = ReadString(reader, 0),
                                RoleName = ReadString(reader, 1),
                                Description = ReadString(reader, 2),
                                SortOrder = ReadInt(reader, 3),
                                IsActive = ReadString(reader, 4) == "Y"
                            });
                        }
                    }
                }
            }

            return list;
        }

        public List<MarketingPermission> ListPermissions()
        {
            var list = new List<MarketingPermission>();
            string cs;
            if (!TryConnectionString(out cs))
            {
                return list;
            }

            using (var conn = new OracleConnection(cs))
            {
                conn.Open();
                using (var cmd = conn.CreateCommand())
                {
                    cmd.CommandText =
                        "SELECT PERMISSION_CODE, PERMISSION_NAME, CATEGORY, SORT_ORDER FROM " + PermissionsTable +
                        " ORDER BY CATEGORY, SORT_ORDER, PERMISSION_NAME";
                    using (var reader = cmd.ExecuteReader())
                    {
                        while (reader.Read())
                        {
                            list.Add(new MarketingPermission
                            {
                                PermissionCode = ReadString(reader, 0),
                                PermissionName = ReadString(reader, 1),
                                Category = ReadString(reader, 2),
                                SortOrder = ReadInt(reader, 3)
                            });
                        }
                    }
                }
            }

            return list;
        }

        public Dictionary<string, HashSet<string>> GetRolePermissionMap()
        {
            var map = new Dictionary<string, HashSet<string>>(StringComparer.OrdinalIgnoreCase);
            string cs;
            if (!TryConnectionString(out cs))
            {
                return map;
            }

            using (var conn = new OracleConnection(cs))
            {
                conn.Open();
                using (var cmd = conn.CreateCommand())
                {
                    cmd.CommandText = "SELECT ROLE_CODE, PERMISSION_CODE FROM " + RolePermTable;
                    using (var reader = cmd.ExecuteReader())
                    {
                        while (reader.Read())
                        {
                            var role = ReadString(reader, 0);
                            var perm = ReadString(reader, 1);
                            if (!map.ContainsKey(role))
                            {
                                map[role] = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
                            }

                            map[role].Add(perm);
                        }
                    }
                }
            }

            return map;
        }

        public string SaveRolePermissions(string roleCode, IList<string> permissionCodes)
        {
            if (string.IsNullOrWhiteSpace(roleCode))
            {
                return "Role is required.";
            }

            string cs;
            if (!TryConnectionString(out cs))
            {
                return "Oracle connection is not configured.";
            }

            roleCode = roleCode.Trim().ToUpperInvariant();
            using (var conn = new OracleConnection(cs))
            {
                conn.Open();
                using (var tx = conn.BeginTransaction())
                {
                    using (var del = conn.CreateCommand())
                    {
                        del.Transaction = tx;
                        del.CommandText = "DELETE FROM " + RolePermTable + " WHERE ROLE_CODE = :role";
                        del.Parameters.Add("role", OracleDbType.Varchar2, roleCode, ParameterDirection.Input);
                        del.ExecuteNonQuery();
                    }

                    if (permissionCodes != null)
                    {
                        foreach (var code in permissionCodes)
                        {
                            if (string.IsNullOrWhiteSpace(code))
                            {
                                continue;
                            }

                            using (var ins = conn.CreateCommand())
                            {
                                ins.Transaction = tx;
                                ins.CommandText =
                                    "INSERT INTO " + RolePermTable + " (ROLE_CODE, PERMISSION_CODE) VALUES (:role, :perm)";
                                ins.Parameters.Add("role", OracleDbType.Varchar2, roleCode, ParameterDirection.Input);
                                ins.Parameters.Add("perm", OracleDbType.Varchar2, code.Trim(), ParameterDirection.Input);
                                ins.ExecuteNonQuery();
                            }
                        }
                    }

                    tx.Commit();
                }
            }

            return null;
        }

        public List<MarketingUser> ListUsers()
        {
            var list = new List<MarketingUser>();
            string cs;
            if (!TryConnectionString(out cs))
            {
                return list;
            }

            using (var conn = new OracleConnection(cs))
            {
                conn.Open();
                using (var cmd = conn.CreateCommand())
                {
                    cmd.CommandText =
                        "SELECT u.ID, u.EMP_ID, u.ROLE_CODE, r.ROLE_NAME, u.DISPLAY_NAME, u.IS_ACTIVE " +
                        "FROM " + UsersTable + " u " +
                        "LEFT JOIN " + RolesTable + " r ON r.ROLE_CODE = u.ROLE_CODE " +
                        "ORDER BY u.EMP_ID";
                    using (var reader = cmd.ExecuteReader())
                    {
                        while (reader.Read())
                        {
                            list.Add(new MarketingUser
                            {
                                Id = ReadDecimal(reader, 0),
                                EmpId = ReadString(reader, 1),
                                RoleCode = ReadString(reader, 2),
                                RoleName = ReadString(reader, 3),
                                DisplayName = ReadString(reader, 4),
                                IsActive = ReadString(reader, 5) == "Y"
                            });
                        }
                    }
                }
            }

            return list;
        }

        public string SaveUser(decimal? id, string empId, string roleCode, string displayName, bool isActive, string newPassword)
        {
            if (string.IsNullOrWhiteSpace(empId))
            {
                return "Employee ID is required.";
            }

            if (string.IsNullOrWhiteSpace(roleCode))
            {
                return "Role is required.";
            }

            string cs;
            if (!TryConnectionString(out cs))
            {
                return "Oracle connection is not configured.";
            }

            empId = empId.Trim();
            roleCode = roleCode.Trim().ToUpperInvariant();
            displayName = displayName == null ? string.Empty : displayName.Trim();
            var activeFlag = isActive ? "Y" : "N";

            using (var conn = new OracleConnection(cs))
            {
                conn.Open();
                if (!id.HasValue || id.Value <= 0)
                {
                    if (string.IsNullOrWhiteSpace(newPassword))
                    {
                        return "Password is required for a new user.";
                    }

                    var hash = PasswordHasher.HashPassword(newPassword);
                    using (var cmd = conn.CreateCommand())
                    {
                        cmd.CommandText =
                            "INSERT INTO " + UsersTable +
                            " (EMP_ID, PASSWORD_HASH, ROLE_CODE, DISPLAY_NAME, IS_ACTIVE) " +
                            "VALUES (:emp, :hash, :role, :name, :act)";
                        cmd.Parameters.Add("emp", OracleDbType.Varchar2, empId, ParameterDirection.Input);
                        cmd.Parameters.Add("hash", OracleDbType.Varchar2, hash, ParameterDirection.Input);
                        cmd.Parameters.Add("role", OracleDbType.Varchar2, roleCode, ParameterDirection.Input);
                        cmd.Parameters.Add("name", OracleDbType.Varchar2, displayName, ParameterDirection.Input);
                        cmd.Parameters.Add("act", OracleDbType.Char, activeFlag, ParameterDirection.Input);
                        cmd.ExecuteNonQuery();
                    }
                }
                else
                {
                    using (var cmd = conn.CreateCommand())
                    {
                        if (!string.IsNullOrWhiteSpace(newPassword))
                        {
                            var hash = PasswordHasher.HashPassword(newPassword);
                            cmd.CommandText =
                                "UPDATE " + UsersTable +
                                " SET EMP_ID = :emp, ROLE_CODE = :role, DISPLAY_NAME = :name, IS_ACTIVE = :act, PASSWORD_HASH = :hash " +
                                "WHERE ID = :id";
                            cmd.Parameters.Add("hash", OracleDbType.Varchar2, hash, ParameterDirection.Input);
                        }
                        else
                        {
                            cmd.CommandText =
                                "UPDATE " + UsersTable +
                                " SET EMP_ID = :emp, ROLE_CODE = :role, DISPLAY_NAME = :name, IS_ACTIVE = :act " +
                                "WHERE ID = :id";
                        }

                        cmd.Parameters.Add("emp", OracleDbType.Varchar2, empId, ParameterDirection.Input);
                        cmd.Parameters.Add("role", OracleDbType.Varchar2, roleCode, ParameterDirection.Input);
                        cmd.Parameters.Add("name", OracleDbType.Varchar2, displayName, ParameterDirection.Input);
                        cmd.Parameters.Add("act", OracleDbType.Char, activeFlag, ParameterDirection.Input);
                        cmd.Parameters.Add("id", OracleDbType.Decimal, id.Value, ParameterDirection.Input);
                        cmd.ExecuteNonQuery();
                    }
                }
            }

            return null;
        }

        private static bool TryReadUserCredentials(OracleConnection conn, string empId, out MarketingUser user, out string passwordHash)
        {
            user = null;
            passwordHash = null;
            using (var cmd = conn.CreateCommand())
            {
                cmd.CommandText =
                    "SELECT u.ID, u.EMP_ID, u.PASSWORD_HASH, u.ROLE_CODE, r.ROLE_NAME, u.DISPLAY_NAME, u.IS_ACTIVE " +
                    "FROM " + UsersTable + " u " +
                    "LEFT JOIN " + RolesTable + " r ON r.ROLE_CODE = u.ROLE_CODE " +
                    "WHERE UPPER(TRIM(u.EMP_ID)) = UPPER(TRIM(:emp)) AND ROWNUM = 1";
                cmd.Parameters.Add("emp", OracleDbType.Varchar2, empId, ParameterDirection.Input);
                using (var reader = cmd.ExecuteReader())
                {
                    if (!reader.Read())
                    {
                        return false;
                    }

                    passwordHash = ReadString(reader, 2);
                    user = new MarketingUser
                    {
                        Id = ReadDecimal(reader, 0),
                        EmpId = ReadString(reader, 1),
                        RoleCode = ReadString(reader, 3),
                        RoleName = ReadString(reader, 4),
                        DisplayName = ReadString(reader, 5),
                        IsActive = ReadString(reader, 6) == "Y"
                    };
                    return true;
                }
            }
        }

        private static void TouchLastLogin(OracleConnection conn, decimal userId)
        {
            using (var cmd = conn.CreateCommand())
            {
                cmd.CommandText = "UPDATE " + UsersTable + " SET LAST_LOGIN = SYSDATE WHERE ID = :id";
                cmd.Parameters.Add("id", OracleDbType.Decimal, userId, ParameterDirection.Input);
                cmd.ExecuteNonQuery();
            }
        }

        private static List<string> LoadPermissionsForRole(OracleConnection conn, string roleCode)
        {
            var list = new List<string>();
            if (string.Equals(roleCode, "ADMIN", StringComparison.OrdinalIgnoreCase))
            {
                using (var cmd = conn.CreateCommand())
                {
                    cmd.CommandText = "SELECT PERMISSION_CODE FROM " + PermissionsTable;
                    using (var reader = cmd.ExecuteReader())
                    {
                        while (reader.Read())
                        {
                            list.Add(ReadString(reader, 0));
                        }
                    }
                }

                return list;
            }

            using (var cmd = conn.CreateCommand())
            {
                cmd.CommandText =
                    "SELECT PERMISSION_CODE FROM " + RolePermTable + " WHERE ROLE_CODE = :role ORDER BY PERMISSION_CODE";
                cmd.Parameters.Add("role", OracleDbType.Varchar2, roleCode, ParameterDirection.Input);
                using (var reader = cmd.ExecuteReader())
                {
                    while (reader.Read())
                    {
                        list.Add(ReadString(reader, 0));
                    }
                }
            }

            return list;
        }

        private static int UserCount(OracleConnection conn)
        {
            using (var cmd = conn.CreateCommand())
            {
                cmd.CommandText = "SELECT COUNT(*) FROM " + UsersTable;
                return Convert.ToInt32(cmd.ExecuteScalar(), CultureInfo.InvariantCulture);
            }
        }

        private static bool TableExists(OracleConnection conn, string qualified)
        {
            var parts = qualified.Split('.');
            if (parts.Length != 2)
            {
                return false;
            }

            using (var cmd = conn.CreateCommand())
            {
                cmd.CommandText =
                    "SELECT 1 FROM ALL_TABLES WHERE OWNER = :owner AND TABLE_NAME = :name AND ROWNUM = 1";
                cmd.Parameters.Add("owner", OracleDbType.Varchar2, parts[0].ToUpperInvariant(), ParameterDirection.Input);
                cmd.Parameters.Add("name", OracleDbType.Varchar2, parts[1].ToUpperInvariant(), ParameterDirection.Input);
                var o = cmd.ExecuteScalar();
                return o != null && o != DBNull.Value;
            }
        }

        private static bool TryConnectionString(out string cs)
        {
            cs = ConfigurationManager.ConnectionStrings[ConnectionName] == null
                ? null
                : ConfigurationManager.ConnectionStrings[ConnectionName].ConnectionString;
            return !string.IsNullOrWhiteSpace(cs);
        }

        private static string ReadString(IDataReader reader, int ord)
        {
            if (reader.IsDBNull(ord))
            {
                return string.Empty;
            }

            return Convert.ToString(reader.GetValue(ord), CultureInfo.InvariantCulture).Trim();
        }

        private static int ReadInt(IDataReader reader, int ord)
        {
            if (reader.IsDBNull(ord))
            {
                return 0;
            }

            return Convert.ToInt32(reader.GetValue(ord), CultureInfo.InvariantCulture);
        }

        private static decimal ReadDecimal(IDataReader reader, int ord)
        {
            if (reader.IsDBNull(ord))
            {
                return 0;
            }

            return Convert.ToDecimal(reader.GetValue(ord), CultureInfo.InvariantCulture);
        }
    }
}
