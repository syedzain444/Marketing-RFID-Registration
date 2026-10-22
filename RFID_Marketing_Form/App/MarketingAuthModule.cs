using System;
using System.Web;
using System.Web.Script.Serialization;
using RFID_Marketing_Form.Data;

namespace RFID_Marketing_Form.App
{
    public class MarketingAuthModule : IHttpModule
    {
        public void Init(HttpApplication context)
        {
            // Run after SessionStateModule so .ashx handlers (IRequiresSessionState) have session loaded.
            context.PostAcquireRequestState += OnPostAcquireRequestState;
        }

        public void Dispose()
        {
        }

        private static void OnPostAcquireRequestState(object sender, EventArgs e)
        {
            var app = (HttpApplication)sender;
            var context = app.Context;
            if (context == null || context.Request == null)
            {
                return;
            }

            var path = context.Request.AppRelativeCurrentExecutionFilePath ?? string.Empty;
            if (IsAnonymousPath(path))
            {
                return;
            }

            if (IsSiteRootPath(path))
            {
                if (!MarketingAuthContext.IsAuthenticated(context))
                {
                    RedirectToLogin(context);
                    return;
                }

                if (!MarketingAuthContext.EnsurePermissionsLoaded(context))
                {
                    MarketingAuthContext.InvalidateAuthentication(context);
                    RedirectToLogin(context);
                    return;
                }

                var landing = MarketingAuthContext.ResolveLandingUrl(context);
                context.Response.Redirect(landing, false);
                context.ApplicationInstance.CompleteRequest();
                return;
            }

            if (IsJsonApiPath(path))
            {
                // Handlers (IRequiresSessionState) load marketing user/permissions in ProcessRequest.
                // Do not require session here — it is often not ready until the handler runs.
                if (!MarketingAuthContext.IsAuthenticated(context))
                {
                    DenyApiJson(context, 401, "Sign in required.");
                    return;
                }

                return;
            }

            if (!MarketingAuthContext.IsAuthenticated(context))
            {
                RedirectToLogin(context);
                return;
            }

            if (!MarketingAuthContext.EnsurePermissionsLoaded(context) || MarketingAuthContext.CurrentUser(context) == null)
            {
                MarketingAuthContext.InvalidateAuthentication(context);
                RedirectToLogin(context);
                return;
            }

            EnforceScreenAccess(context, path);
        }

        private static void EnforceScreenAccess(HttpContext context, string appRelativePath)
        {
            var file = appRelativePath.ToLowerInvariant();
            if (file.EndsWith("records.aspx", StringComparison.Ordinal) &&
                !MarketingAuthContext.HasPermission(context, AppPermissionCodes.ScreenRecords))
            {
                Deny(context, "You cannot open Records.");
                return;
            }

            if ((file.EndsWith("adminusers.aspx", StringComparison.Ordinal) ||
                 file.EndsWith("rolepermissions.aspx", StringComparison.Ordinal)) &&
                !MarketingAuthContext.HasPermission(context, AppPermissionCodes.ScreenAdmin))
            {
                Deny(context, "You cannot open Administration.");
                return;
            }

            if (file.EndsWith("adminusers.aspx", StringComparison.Ordinal) &&
                !MarketingAuthContext.HasPermission(context, AppPermissionCodes.AdminUsers))
            {
                Deny(context, "You cannot manage users.");
                return;
            }

            if (file.EndsWith("rolepermissions.aspx", StringComparison.Ordinal) &&
                !MarketingAuthContext.HasPermission(context, AppPermissionCodes.AdminRoles))
            {
                Deny(context, "You cannot manage role permissions.");
            }
        }

        private static void Deny(HttpContext context, string message)
        {
            context.Response.Clear();
            context.Response.StatusCode = 403;
            context.Response.Write("<html><body><h1>Access denied</h1><p>" + HttpUtility.HtmlEncode(message) + "</p></body></html>");
            context.Response.End();
        }

        private static void DenyApiJson(HttpContext context, int statusCode, string message)
        {
            context.Response.Clear();
            context.Response.StatusCode = statusCode;
            context.Response.ContentType = "application/json; charset=utf-8";
            context.Response.Cache.SetCacheability(HttpCacheability.NoCache);
            var body = new JavaScriptSerializer().Serialize(new { Ok = false, Error = message ?? string.Empty });
            context.Response.Write(body);
            context.ApplicationInstance.CompleteRequest();
        }

        private static bool IsJsonApiPath(string appRelativePath)
        {
            var p = (appRelativePath ?? string.Empty).ToLowerInvariant();
            if (!p.EndsWith(".ashx", StringComparison.Ordinal))
            {
                return false;
            }

            if (p.EndsWith("logincss.ashx", StringComparison.Ordinal) ||
                p.EndsWith("captcha.ashx", StringComparison.Ordinal))
            {
                return false;
            }

            return true;
        }

        private static void RedirectToLogin(HttpContext context)
        {
            var returnUrl = context.Request.RawUrl;
            var login = VirtualPathUtility.ToAbsolute("~/MarketingLogin.aspx");
            if (!string.IsNullOrEmpty(returnUrl) && returnUrl.IndexOf("MarketingLogin.aspx", StringComparison.OrdinalIgnoreCase) < 0)
            {
                login += "?ReturnUrl=" + HttpUtility.UrlEncode(returnUrl);
            }

            context.Response.Redirect(login, false);
            context.ApplicationInstance.CompleteRequest();
        }

        private static bool IsSiteRootPath(string appRelativePath)
        {
            return string.IsNullOrEmpty(appRelativePath)
                || appRelativePath == "~/"
                || appRelativePath == "~";
        }

        private static bool IsAnonymousPath(string appRelativePath)
        {
            if (IsSiteRootPath(appRelativePath))
            {
                return false;
            }

            var p = appRelativePath.ToLowerInvariant();
            if (p.Contains("/account/"))
            {
                return true;
            }

            if (p.EndsWith("marketinglogin.aspx", StringComparison.Ordinal) ||
                p.EndsWith("marketinglogout.aspx", StringComparison.Ordinal) ||
                p.EndsWith("logincss.ashx", StringComparison.Ordinal))
            {
                return true;
            }

            if (p.EndsWith(".css") || p.EndsWith(".js") || p.EndsWith(".png") || p.EndsWith(".jpg") ||
                p.EndsWith(".gif") || p.EndsWith(".svg") || p.EndsWith(".ico") || p.EndsWith(".woff") ||
                p.EndsWith(".woff2"))
            {
                return true;
            }

            if (p.Contains("/content/") || p.Contains("/scripts/") || p.Contains("/images/"))
            {
                return true;
            }

            if (p.EndsWith("captcha.ashx", StringComparison.Ordinal))
            {
                return true;
            }

            return false;
        }
    }
}
