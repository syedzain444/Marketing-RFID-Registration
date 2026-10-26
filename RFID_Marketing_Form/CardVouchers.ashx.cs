using System.Globalization;
using System.Web;
using System.Web.Script.Serialization;
using System.Web.SessionState;
using RFID_Marketing_Form.Data;

namespace RFID_Marketing_Form
{
    public class CardVouchers : IHttpHandler, IRequiresSessionState
    {
        public void ProcessRequest(HttpContext context)
        {
            context.Response.ContentType = "application/json; charset=utf-8";
            context.Response.Cache.SetCacheability(HttpCacheability.NoCache);

            if (context.Session != null)
            {
                MarketingAuthContext.EnsurePermissionsLoaded(context);
            }

            RfidRecordsResult result;
            try
            {
                var action = (context.Request.QueryString["action"] ?? context.Request.Form["action"] ?? "list")
                    .Trim()
                    .ToLowerInvariant();

                if (!TryAuthorize(context, action, out result))
                {
                    context.Response.StatusCode = result != null && result.Error != null &&
                                                 result.Error.IndexOf("Sign in", System.StringComparison.OrdinalIgnoreCase) >= 0
                        ? 401
                        : 403;
                    WriteJson(context, result);
                    return;
                }

                var repo = new CardVoucherRepository();
                var actor = MarketingAuthContext.CurrentEmpId(context) ?? string.Empty;

                if (action == "list")
                {
                    var filter = (context.Request.QueryString["status"] ?? context.Request.Form["status"] ?? "all")
                        .Trim();
                    if (filter.Equals("all", System.StringComparison.OrdinalIgnoreCase))
                    {
                        filter = null;
                    }

                    result = repo.ListVouchers(filter);
                }
                else if (action == "get")
                {
                    decimal id;
                    if (!TryParseId(context, out id))
                    {
                        result = RfidRecordsResult.Fail("A valid voucher ID is required.");
                    }
                    else
                    {
                        result = repo.GetVoucherById(id);
                    }
                }
                else if (action == "setstatus")
                {
                    decimal id;
                    if (!TryParseId(context, out id))
                    {
                        result = RfidRecordsResult.Fail("A valid voucher ID is required.");
                    }
                    else
                    {
                        var status = (context.Request["status"] ?? context.Request.QueryString["status"] ?? string.Empty)
                            .Trim();
                        result = repo.SetVoucherStatus(id, status, actor);
                    }
                }
                else
                {
                    result = RfidRecordsResult.Fail("Unknown action.");
                }

                WriteJson(context, result);
            }
            catch (System.Exception ex)
            {
                context.Response.StatusCode = 500;
                WriteJson(context, RfidRecordsResult.Fail(ex.Message));
            }
        }

        private static bool TryParseId(HttpContext context, out decimal id)
        {
            var idText = (context.Request["id"] ?? context.Request.QueryString["id"] ?? context.Request["voucherId"] ??
                          context.Request.QueryString["voucherId"] ?? string.Empty).Trim();
            return decimal.TryParse(idText, NumberStyles.None, CultureInfo.InvariantCulture, out id) && id > 0;
        }

        private static void WriteJson(HttpContext context, RfidRecordsResult result)
        {
            context.Response.Write(new JavaScriptSerializer { MaxJsonLength = int.MaxValue }
                .Serialize(result ?? RfidRecordsResult.Fail("Unexpected empty response.")));
        }

        private static bool TryAuthorize(HttpContext context, string action, out RfidRecordsResult denied)
        {
            denied = null;
            string err;

            switch (action)
            {
                case "list":
                case "get":
                    if (!MarketingAuthContext.TryRequireAnyPermission(
                        context,
                        new[]
                        {
                            AppPermissionCodes.ActionVouchersList,
                            AppPermissionCodes.ActionVouchersManage,
                            AppPermissionCodes.ScreenVouchers
                        },
                        out err))
                    {
                        denied = RfidRecordsResult.Fail(err);
                        return false;
                    }

                    return true;
                case "setstatus":
                    if (!MarketingAuthContext.TryRequireAnyPermission(
                        context,
                        new[]
                        {
                            AppPermissionCodes.ActionVouchersManage,
                            AppPermissionCodes.ScreenVouchers
                        },
                        out err))
                    {
                        denied = RfidRecordsResult.Fail(err);
                        return false;
                    }

                    return true;
                default:
                    denied = RfidRecordsResult.Fail("Unknown action.");
                    return false;
            }
        }

        public bool IsReusable
        {
            get { return false; }
        }
    }
}
