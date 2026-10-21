using System.Globalization;
using System.Web;
using System.Web.Script.Serialization;
using RFID_Marketing_Form.Data;

namespace RFID_Marketing_Form
{
    public class RfidRecords : IHttpHandler
    {
        public void ProcessRequest(HttpContext context)
        {
            context.Response.ContentType = "application/json";
            context.Response.Cache.SetCacheability(HttpCacheability.NoCache);

            var action = (context.Request.QueryString["action"] ?? context.Request.Form["action"] ?? "list").Trim().ToLowerInvariant();
            var repo = new RfidRepository();
            RfidRecordsResult result;

            if (action == "detail")
            {
                var idText = (context.Request.QueryString["id"] ?? string.Empty).Trim();
                decimal id;
                if (!decimal.TryParse(idText, NumberStyles.None, CultureInfo.InvariantCulture, out id) || id <= 0)
                {
                    result = RfidRecordsResult.Fail("A valid record ID is required.");
                }
                else
                {
                    result = repo.GetRecord(id);
                }
            }
            else if (action == "setstatus")
            {
                var idText = (context.Request["id"] ?? context.Request.QueryString["id"] ?? string.Empty).Trim();
                var status = (context.Request["status"] ?? context.Request.QueryString["status"] ?? string.Empty).Trim();
                decimal id;
                if (!decimal.TryParse(idText, NumberStyles.None, CultureInfo.InvariantCulture, out id) || id <= 0)
                {
                    result = RfidRecordsResult.Fail("A valid record ID is required.");
                }
                else
                {
                    result = repo.SetStatus(id, status);
                }
            }
            else if (action == "updateprofile")
            {
                var idText = (context.Request["id"] ?? string.Empty).Trim();
                decimal id;
                if (!decimal.TryParse(idText, NumberStyles.None, CultureInfo.InvariantCulture, out id) || id <= 0)
                {
                    result = RfidRecordsResult.Fail("A valid record ID is required.");
                }
                else
                {
                    result = repo.UpdateEmployeeProfile(
                        id,
                        context.Request["employeeName"],
                        context.Request["designation"],
                        context.Request["department"],
                        context.Request["projectLocation"],
                        context.Request["joiningDate"],
                        context.Request["bloodGroup"],
                        context.Request["cnic"],
                        context.Request["emergencyNo"],
                        context.Request["photoPath"]);
                }
            }
            else
            {
                result = repo.ListRecords();
            }

            context.Response.Write(new JavaScriptSerializer { MaxJsonLength = int.MaxValue }.Serialize(result));
        }

        public bool IsReusable
        {
            get { return false; }
        }
    }
}
