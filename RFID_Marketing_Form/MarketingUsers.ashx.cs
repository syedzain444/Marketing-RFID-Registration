using System.Globalization;
using System.Linq;
using System.Web;
using System.Web.Script.Serialization;
using System.Web.SessionState;
using RFID_Marketing_Form.Data;

namespace RFID_Marketing_Form
{
    public class MarketingUsersHandler : IHttpHandler, IRequiresSessionState
    {
        public void ProcessRequest(HttpContext context)
        {
            context.Response.ContentType = "application/json";
            context.Response.Cache.SetCacheability(HttpCacheability.NoCache);

            if (context.Session != null)
            {
                MarketingAuthContext.EnsurePermissionsLoaded(context);
            }

            var action = (context.Request.QueryString["action"] ?? context.Request.Form["action"] ?? "list").Trim().ToLowerInvariant();
            MarketingAuthApiResult result;
            if (!TryAuthorize(context, action, out result))
            {
                context.Response.StatusCode = result != null && result.Error != null && result.Error.IndexOf("Sign in", System.StringComparison.OrdinalIgnoreCase) >= 0 ? 401 : 403;
                WriteJson(context, result);
                return;
            }

            var repo = new MarketingAuthRepository();
            switch (action)
            {
                case "roles":
                    result = MarketingAuthApiResult.OkData(new
                    {
                        roles = repo.ListRoles(true).Select(r => new { code = r.RoleCode, name = r.RoleName }).ToList()
                    });
                    break;
                case "get":
                    decimal getId;
                    if (!decimal.TryParse((context.Request.QueryString["id"] ?? string.Empty).Trim(), NumberStyles.None, CultureInfo.InvariantCulture, out getId) || getId <= 0)
                    {
                        result = MarketingAuthApiResult.Fail("A valid user ID is required.");
                    }
                    else
                    {
                        var user = repo.ListUsers().FirstOrDefault(u => u.Id == getId);
                        result = user == null
                            ? MarketingAuthApiResult.Fail("User not found.")
                            : MarketingAuthApiResult.OkData(ToDto(user));
                    }
                    break;
                case "setactive":
                    decimal toggleId;
                    if (!decimal.TryParse((context.Request["id"] ?? string.Empty).Trim(), NumberStyles.None, CultureInfo.InvariantCulture, out toggleId) || toggleId <= 0)
                    {
                        result = MarketingAuthApiResult.Fail("A valid user ID is required.");
                        break;
                    }

                    var toggleUser = repo.ListUsers().FirstOrDefault(u => u.Id == toggleId);
                    if (toggleUser == null)
                    {
                        result = MarketingAuthApiResult.Fail("User not found.");
                        break;
                    }

                    var toggleActive = ParseBool(context.Request["isActive"], true);
                    var toggleErr = repo.SaveUser(
                        toggleId,
                        toggleUser.EmpId,
                        toggleUser.RoleCode,
                        toggleUser.DisplayName,
                        toggleActive,
                        string.Empty);
                    result = string.IsNullOrEmpty(toggleErr)
                        ? MarketingAuthApiResult.OkData(new { id = toggleId, isActive = toggleActive })
                        : MarketingAuthApiResult.Fail(toggleErr);
                    break;
                case "save":
                    decimal saveId;
                    decimal.TryParse((context.Request["id"] ?? "0").Trim(), NumberStyles.None, CultureInfo.InvariantCulture, out saveId);
                    decimal? userId = saveId > 0 ? (decimal?)saveId : null;
                    var isActive = ParseBool(context.Request["isActive"], true);
                    var err = repo.SaveUser(
                        userId,
                        context.Request["empId"],
                        context.Request["roleCode"],
                        context.Request["displayName"],
                        isActive,
                        context.Request["password"]);
                    result = string.IsNullOrEmpty(err)
                        ? MarketingAuthApiResult.OkData(new { saved = true })
                        : MarketingAuthApiResult.Fail(err);
                    break;
                default:
                    result = MarketingAuthApiResult.OkData(new
                    {
                        users = repo.ListUsers().Select(ToDto).ToList()
                    });
                    break;
            }

            WriteJson(context, result);
        }

        private static object ToDto(MarketingUser u)
        {
            return new
            {
                id = u.Id,
                empId = u.EmpId,
                displayName = u.DisplayName,
                roleCode = u.RoleCode,
                roleName = u.RoleName,
                isActive = u.IsActive
            };
        }

        private static bool ParseBool(string text, bool defaultValue)
        {
            if (string.IsNullOrWhiteSpace(text))
            {
                return defaultValue;
            }

            var v = text.Trim().ToLowerInvariant();
            if (v == "true" || v == "1" || v == "y" || v == "yes" || v == "on")
            {
                return true;
            }

            if (v == "false" || v == "0" || v == "n" || v == "no" || v == "off")
            {
                return false;
            }

            return defaultValue;
        }

        private static bool TryAuthorize(HttpContext context, string action, out MarketingAuthApiResult denied)
        {
            denied = null;
            MarketingAuthContext.EnsurePermissionsLoaded(context);
            string err;
            if (!MarketingAuthContext.TryRequirePermission(context, AppPermissionCodes.AdminUsers, out err))
            {
                denied = MarketingAuthApiResult.Fail(err);
                return false;
            }

            return true;
        }

        private static void WriteJson(HttpContext context, MarketingAuthApiResult result)
        {
            context.Response.Write(new JavaScriptSerializer { MaxJsonLength = int.MaxValue }.Serialize(result));
        }

        public bool IsReusable
        {
            get { return false; }
        }
    }
}
