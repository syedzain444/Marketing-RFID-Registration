using System.Web;
using System.Web.SessionState;
using RFID_Marketing_Form.Data;

namespace RFID_Marketing_Form
{
    public class RfidFormSave : IHttpHandler, IRequiresSessionState
    {
        public void ProcessRequest(HttpContext context)
        {
            context.Response.ContentType = "application/json; charset=utf-8";
            context.Response.Cache.SetCacheability(HttpCacheability.NoCache);

            string err;
            if (!MarketingAuthContext.TryRequirePermission(context, AppPermissionCodes.ActionFormSave, out err))
            {
                context.Response.StatusCode = 403;
                context.Response.Write(RfidFormSaveService.SerializeClientPayload(new SaveResult
                {
                    Success = false,
                    Kind = "error",
                    Title = "Not allowed",
                    Messages = new System.Collections.Generic.List<string> { err ?? "You do not have permission to save requests." },
                    Fields = new System.Collections.Generic.List<string>()
                }, false));
                return;
            }

            if (!string.Equals(context.Request.HttpMethod, "POST", System.StringComparison.OrdinalIgnoreCase))
            {
                context.Response.StatusCode = 405;
                context.Response.Write(RfidFormSaveService.SerializeClientPayload(new SaveResult
                {
                    Success = false,
                    Kind = "error",
                    Title = "Invalid request",
                    Messages = new System.Collections.Generic.List<string> { "Use POST to save a record." },
                    Fields = new System.Collections.Generic.List<string>()
                }, false));
                return;
            }

            try
            {
                var result = RfidFormSaveService.SaveFromRequest(context);
                context.Response.Write(RfidFormSaveService.SerializeClientPayload(result, result.Success));
            }
            catch (System.Exception ex)
            {
                context.Response.StatusCode = 500;
                context.Response.Write(RfidFormSaveService.SerializeClientPayload(new SaveResult
                {
                    Success = false,
                    Kind = "error",
                    Title = "Unable to save",
                    Messages = new System.Collections.Generic.List<string> { ex.Message ?? "An unexpected error occurred while saving." },
                    Fields = new System.Collections.Generic.List<string>()
                }, false));
            }
        }

        public bool IsReusable
        {
            get { return false; }
        }
    }
}
