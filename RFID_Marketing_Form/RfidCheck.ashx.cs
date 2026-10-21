using System.Collections.Generic;
using System.Globalization;
using System.Web;
using System.Web.Script.Serialization;
using System.Web.SessionState;
using RFID_Marketing_Form.Data;

namespace RFID_Marketing_Form
{
    public class RfidCheck : IHttpHandler, IRequiresSessionState
    {
        public void ProcessRequest(HttpContext context)
        {
            context.Response.ContentType = "application/json";
            context.Response.Cache.SetCacheability(HttpCacheability.NoCache);

            MarketingAuthContext.EnsurePermissionsLoaded(context);
            string authErr;
            if (!MarketingAuthContext.TryRequirePermission(context, AppPermissionCodes.ScreenForm, out authErr))
            {
                context.Response.StatusCode = 403;
                context.Response.Write(new JavaScriptSerializer().Serialize(new { ok = false, error = authErr }));
                return;
            }

            var empId = (context.Request.Form["empId"] ?? context.Request.QueryString["empId"] ?? string.Empty).Trim();
            var rfid = (context.Request.Form["rfid"] ?? context.Request.QueryString["rfid"] ?? string.Empty).Trim();
            var idText = (context.Request.Form["id"] ?? context.Request.QueryString["id"] ?? string.Empty).Trim();

            decimal idValue;
            decimal? id = null;
            if (idText.Length > 0 && decimal.TryParse(idText, NumberStyles.None, CultureInfo.InvariantCulture, out idValue))
            {
                id = idValue;
            }

            var repo = new RfidRepository();
            var info = repo.FindDuplicates(empId, rfid, id);
            var issues = new List<FieldIssue>();
            if (string.IsNullOrEmpty(info.Error))
            {
                RfidValidator.AddDuplicateIssues(info, issues);
            }

            var payload = new Dictionary<string, object>();
            payload["ok"] = string.IsNullOrEmpty(info.Error);
            payload["blocked"] = info.Blocked;
            payload["error"] = info.Error ?? string.Empty;
            var issueRows = new List<Dictionary<string, string>>();
            for (int i = 0; i < issues.Count; i++)
            {
                var row = new Dictionary<string, string>();
                row["field"] = issues[i].Key;
                row["message"] = issues[i].Message;
                issueRows.Add(row);
            }

            payload["issues"] = issueRows;
            context.Response.Write(new JavaScriptSerializer().Serialize(payload));
        }

        public bool IsReusable
        {
            get { return false; }
        }
    }
}
