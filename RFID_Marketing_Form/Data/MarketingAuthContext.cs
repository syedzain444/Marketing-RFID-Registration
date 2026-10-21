using System;
using System.Collections.Generic;
using System.Linq;
using System.Web;
using System.Web.Security;

namespace RFID_Marketing_Form.Data
{
    public static class MarketingAuthContext
    {
        public const string SessionPermissionsKey = "MarketingAuth_Permissions";
        public const string SessionUserKey = "MarketingAuth_User";

        public static bool IsAuthenticated(HttpContext context)
        {
            return context != null
                && context.User != null
                && context.User.Identity != null
                && context.User.Identity.IsAuthenticated;
        }

        public static MarketingUser CurrentUser(HttpContext context)
        {
            if (context == null || context.Session == null)
            {
                return null;
            }

            return context.Session[SessionUserKey] as MarketingUser;
        }

        public static string CurrentEmpId(HttpContext context)
        {
            if (IsAuthenticated(context))
            {
                return context.User.Identity.Name;
            }

            return string.Empty;
        }

        public static HashSet<string> Permissions(HttpContext context)
        {
            EnsurePermissionsLoaded(context);
            var list = context.Session[SessionPermissionsKey] as List<string>;
            if (list == null)
            {
                return new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            }

            return new HashSet<string>(list, StringComparer.OrdinalIgnoreCase);
        }

        public static bool HasPermission(HttpContext context, string permissionCode)
        {
            if (string.IsNullOrWhiteSpace(permissionCode))
            {
                return false;
            }

            var user = CurrentUser(context);
            if (user != null && string.Equals(user.RoleCode, "ADMIN", StringComparison.OrdinalIgnoreCase))
            {
                return true;
            }

            return Permissions(context).Contains(permissionCode.Trim());
        }

        public static bool HasAnyPermission(HttpContext context, params string[] permissionCodes)
        {
            if (permissionCodes == null || permissionCodes.Length == 0)
            {
                return false;
            }

            for (var i = 0; i < permissionCodes.Length; i++)
            {
                if (HasPermission(context, permissionCodes[i]))
                {
                    return true;
                }
            }

            return false;
        }

        public static void RequirePermission(HttpContext context, string permissionCode)
        {
            if (!HasPermission(context, permissionCode))
            {
                throw new HttpException(403, "You do not have permission for this action.");
            }
        }

        public static bool TryRequirePermission(HttpContext context, string permissionCode, out string error)
        {
            error = null;
            if (!IsAuthenticated(context))
            {
                error = "Sign in required.";
                return false;
            }

            if (!EnsurePermissionsLoaded(context))
            {
                error = "Sign in required.";
                return false;
            }

            if (!HasPermission(context, permissionCode))
            {
                error = "You do not have permission for this action.";
                return false;
            }

            return true;
        }

        public static bool TryRequireAnyPermission(HttpContext context, string[] permissionCodes, out string error)
        {
            error = null;
            if (!IsAuthenticated(context))
            {
                error = "Sign in required.";
                return false;
            }

            if (!EnsurePermissionsLoaded(context))
            {
                error = "Sign in required.";
                return false;
            }

            if (permissionCodes != null)
            {
                for (var i = 0; i < permissionCodes.Length; i++)
                {
                    if (HasPermission(context, permissionCodes[i]))
                    {
                        return true;
                    }
                }
            }

            error = "You do not have permission for this action.";
            return false;
        }

        public static void SignIn(HttpContext context, MarketingUser user, IList<string> permissions, bool remember)
        {
            if (context == null || user == null)
            {
                return;
            }

            var ticket = new FormsAuthenticationTicket(
                1,
                user.EmpId,
                DateTime.Now,
                DateTime.Now.Add(FormsAuthentication.Timeout),
                remember,
                user.RoleCode,
                FormsAuthentication.FormsCookiePath);

            var encrypted = FormsAuthentication.Encrypt(ticket);
            var cookie = new HttpCookie(FormsAuthentication.FormsCookieName, encrypted)
            {
                HttpOnly = true,
                Secure = context.Request != null && context.Request.IsSecureConnection,
                Path = FormsAuthentication.FormsCookiePath
            };

            if (remember)
            {
                cookie.Expires = ticket.Expiration;
            }

            context.Response.Cookies.Set(cookie);
            context.Session[SessionUserKey] = user;
            context.Session[SessionPermissionsKey] = permissions == null
                ? new List<string>()
                : permissions.Distinct(StringComparer.OrdinalIgnoreCase).ToList();
        }

        public static void SignOut(HttpContext context)
        {
            if (context == null)
            {
                return;
            }

            FormsAuthentication.SignOut();
            if (context.Session != null)
            {
                context.Session.Remove(SessionUserKey);
                context.Session.Remove(SessionPermissionsKey);
            }
        }

        public static bool EnsurePermissionsLoaded(HttpContext context)
        {
            if (context == null || !IsAuthenticated(context))
            {
                return false;
            }

            if (context.Session == null)
            {
                return false;
            }

            if (context.Session[SessionPermissionsKey] != null && context.Session[SessionUserKey] != null)
            {
                return true;
            }

            var repo = new MarketingAuthRepository();
            var empId = context.User.Identity.Name;
            var user = repo.GetUserByEmpId(empId);
            if (user == null || !user.IsActive)
            {
                InvalidateAuthentication(context);
                return false;
            }

            var perms = repo.GetPermissionsForRole(user.RoleCode);
            context.Session[SessionUserKey] = user;
            context.Session[SessionPermissionsKey] = perms;
            return true;
        }

        public static string ResolveLandingUrl(HttpContext context)
        {
            if (HasPermission(context, AppPermissionCodes.ScreenRecords))
            {
                return VirtualPathUtility.ToAbsolute("~/Records.aspx");
            }

            if (HasPermission(context, AppPermissionCodes.ScreenForm))
            {
                return VirtualPathUtility.ToAbsolute("~/Default.aspx");
            }

            if (HasPermission(context, AppPermissionCodes.ScreenAdmin))
            {
                return VirtualPathUtility.ToAbsolute("~/RolePermissions.aspx");
            }

            return VirtualPathUtility.ToAbsolute("~/MarketingLogin.aspx");
        }

        public static bool TryResolveSafeReturnUrl(HttpContext context, string returnUrl, out string target)
        {
            target = null;
            if (context == null || string.IsNullOrWhiteSpace(returnUrl))
            {
                return false;
            }

            returnUrl = returnUrl.Trim();
            if (returnUrl == "/" || returnUrl == "~/" || returnUrl.Equals("~/", StringComparison.Ordinal))
            {
                return false;
            }

            var appPath = (context.Request.ApplicationPath ?? string.Empty).TrimEnd('/');
            if (appPath.Length > 0 && string.Equals(returnUrl, appPath, StringComparison.OrdinalIgnoreCase))
            {
                return false;
            }

            if (appPath.Length > 0 && string.Equals(returnUrl, appPath + "/", StringComparison.OrdinalIgnoreCase))
            {
                return false;
            }

            if (!returnUrl.StartsWith("/") || returnUrl.StartsWith("//") || returnUrl.IndexOf("://", StringComparison.Ordinal) >= 0)
            {
                return false;
            }

            if (returnUrl.IndexOf("MarketingLogin.aspx", StringComparison.OrdinalIgnoreCase) >= 0)
            {
                return false;
            }

            target = returnUrl;
            return true;
        }

        /// <summary>Clears forms cookie and session so login page does not bounce with a stale ticket.</summary>
        public static void InvalidateAuthentication(HttpContext context)
        {
            SignOut(context);
            if (context == null || context.Response == null)
            {
                return;
            }

            var expired = new HttpCookie(FormsAuthentication.FormsCookieName, string.Empty)
            {
                Expires = DateTime.Now.AddYears(-1),
                HttpOnly = true,
                Path = FormsAuthentication.FormsCookiePath
            };
            context.Response.Cookies.Set(expired);
        }
    }
}
