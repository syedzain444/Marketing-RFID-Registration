using System.Collections.Generic;

namespace RFID_Marketing_Form.Data
{
    public class MarketingUser
    {
        public decimal Id { get; set; }
        public string EmpId { get; set; }
        public string RoleCode { get; set; }
        public string RoleName { get; set; }
        public string DisplayName { get; set; }
        public bool IsActive { get; set; }
    }

    public class MarketingRole
    {
        public string RoleCode { get; set; }
        public string RoleName { get; set; }
        public string Description { get; set; }
        public int SortOrder { get; set; }
        public bool IsActive { get; set; }
    }

    public class MarketingPermission
    {
        public string PermissionCode { get; set; }
        public string PermissionName { get; set; }
        public string Category { get; set; }
        public int SortOrder { get; set; }
    }

    public class MarketingLoginResult
    {
        public bool Success { get; set; }
        public string Error { get; set; }
        public MarketingUser User { get; set; }
        public List<string> Permissions { get; set; }
    }

    public class MarketingAuthApiResult
    {
        public bool Ok { get; set; }
        public string Error { get; set; }
        public object Data { get; set; }

        public static MarketingAuthApiResult Fail(string message)
        {
            return new MarketingAuthApiResult { Ok = false, Error = message };
        }

        public static MarketingAuthApiResult OkData(object data)
        {
            return new MarketingAuthApiResult { Ok = true, Data = data };
        }
    }
}
