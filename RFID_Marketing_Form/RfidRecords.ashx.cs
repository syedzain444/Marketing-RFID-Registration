using System.Globalization;
using System.Web;
using System.Web.Script.Serialization;
using System.Web.SessionState;
using RFID_Marketing_Form.Data;

namespace RFID_Marketing_Form
{
    public class RfidRecords : IHttpHandler, IRequiresSessionState
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
                var action = (context.Request.QueryString["action"] ?? context.Request.Form["action"] ?? "list").Trim().ToLowerInvariant();
                if (!TryAuthorize(context, action, out result))
                {
                    context.Response.StatusCode = result != null && result.Error != null && result.Error.IndexOf("Sign in", System.StringComparison.OrdinalIgnoreCase) >= 0 ? 401 : 403;
                    WriteJson(context, result);
                    return;
                }

                var repo = new RfidRepository();
                var scope = (context.Request.QueryString["scope"] ?? context.Request.Form["scope"] ?? "employee").Trim().ToLowerInvariant();
                var isFamilyScope = scope == "family";

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
                    result = isFamilyScope ? repo.GetFamilyRecord(id) : repo.GetRecord(id);
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
                    var remarks = (context.Request["remarks"] ?? context.Request.QueryString["remarks"] ?? string.Empty).Trim();
                    result = isFamilyScope ? repo.SetFamilyStatus(id, status, remarks) : repo.SetStatus(id, status, remarks);
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
            else if (action == "updatefamilyprofile")
            {
                var idText = (context.Request["id"] ?? string.Empty).Trim();
                decimal id;
                if (!decimal.TryParse(idText, NumberStyles.None, CultureInfo.InvariantCulture, out id) || id <= 0)
                {
                    result = RfidRecordsResult.Fail("A valid record ID is required.");
                }
                else
                {
                    result = repo.UpdateFamilyProfile(
                        id,
                        context.Request["cardName"],
                        context.Request["relationship"],
                        context.Request["cnic"],
                        context.Request["photoPath"]);
                }
            }
            else if (action == "updateprintassignment")
            {
                var idText = (context.Request["id"] ?? string.Empty).Trim();
                decimal id;
                if (!decimal.TryParse(idText, NumberStyles.None, CultureInfo.InvariantCulture, out id) || id <= 0)
                {
                    result = RfidRecordsResult.Fail("A valid record ID is required.");
                }
                else
                {
                    result = repo.UpdatePrintAssignment(
                        id,
                        context.Request["issuedBy"],
                        context.Request["printDate"],
                        context.Request["rfidNumber"]);
                }
            }
            else if (action == "updatefamilyprintassignment")
            {
                var idText = (context.Request["familyId"] ?? context.Request["id"] ?? string.Empty).Trim();
                decimal id;
                if (!decimal.TryParse(idText, NumberStyles.None, CultureInfo.InvariantCulture, out id) || id <= 0)
                {
                    result = RfidRecordsResult.Fail("A valid family card ID is required.");
                }
                else
                {
                    result = repo.UpdateFamilyPrintAssignment(
                        id,
                        context.Request["issuedBy"],
                        context.Request["printDate"],
                        context.Request["rfidNumber"]);
                }
            }
            else if (action == "lookupemp")
            {
                var empId = (context.Request.QueryString["empId"] ?? context.Request.Form["empId"] ?? string.Empty).Trim();
                var exists = !string.IsNullOrWhiteSpace(empId) && repo.EmployeeRecordExists(empId);
                var displayName = exists ? repo.TryGetEmployeeDisplayName(empId) : null;
                context.Response.Write(new JavaScriptSerializer().Serialize(new
                {
                    Ok = true,
                    Exists = exists,
                    EmpId = empId,
                    EmployeeName = displayName ?? string.Empty
                }));
                return;
            }
                else
                {
                    result = isFamilyScope ? repo.ListFamilyRecords() : repo.ListRecords();
                }

                WriteJson(context, result);
            }
            catch (System.Exception ex)
            {
                context.Response.StatusCode = 500;
                WriteJson(context, RfidRecordsResult.Fail(ex.Message));
            }
        }

        private static void WriteJson(HttpContext context, RfidRecordsResult result)
        {
            context.Response.Write(new JavaScriptSerializer { MaxJsonLength = int.MaxValue }.Serialize(result ?? RfidRecordsResult.Fail("Unexpected empty response.")));
        }

        private static bool TryAuthorize(HttpContext context, string action, out RfidRecordsResult denied)
        {
            denied = null;
            string err;

            switch (action)
            {
                case "detail":
                    if (!MarketingAuthContext.TryRequireAnyPermission(
                        context,
                        new[]
                        {
                            AppPermissionCodes.ActionRecordsView,
                            AppPermissionCodes.ActionRecordsEdit,
                            AppPermissionCodes.ActionRecordsPrint
                        },
                        out err))
                    {
                        denied = RfidRecordsResult.Fail(err);
                        return false;
                    }

                    return true;
                case "setstatus":
                    if (!MarketingAuthContext.TryRequirePermission(context, AppPermissionCodes.ActionRecordsStatus, out err))
                    {
                        denied = RfidRecordsResult.Fail(err);
                        return false;
                    }

                    return true;
                case "updateprofile":
                case "updatefamilyprofile":
                    if (!MarketingAuthContext.TryRequirePermission(context, AppPermissionCodes.ActionRecordsEdit, out err))
                    {
                        denied = RfidRecordsResult.Fail(err);
                        return false;
                    }

                    return true;
                case "updateprintassignment":
                case "updatefamilyprintassignment":
                    if (!MarketingAuthContext.TryRequireAnyPermission(
                        context,
                        new[]
                        {
                            AppPermissionCodes.ActionRecordsPrint,
                            AppPermissionCodes.ActionRecordsEdit
                        },
                        out err))
                    {
                        denied = RfidRecordsResult.Fail(err);
                        return false;
                    }

                    return true;
                case "lookupemp":
                    if (!MarketingAuthContext.TryRequireAnyPermission(
                        context,
                        new[]
                        {
                            AppPermissionCodes.ScreenForm,
                            AppPermissionCodes.ActionFormSave
                        },
                        out err))
                    {
                        denied = RfidRecordsResult.Fail(err);
                        return false;
                    }

                    return true;
                default:
                    if (!MarketingAuthContext.TryRequirePermission(context, AppPermissionCodes.ActionRecordsList, out err))
                    {
                        denied = RfidRecordsResult.Fail(err);
                        return false;
                    }

                    return true;
            }
        }

        public bool IsReusable
        {
            get { return false; }
        }
    }
}
