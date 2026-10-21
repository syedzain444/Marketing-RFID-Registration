using System;
using System.Web;
using RFID_Marketing_Form.Data;

namespace RFID_Marketing_Form
{
    public class EmpPhoto : IHttpHandler
    {
        public void ProcessRequest(HttpContext context)
        {
            var path = PhotoStorage.NormalizeRelativePath(context.Request.QueryString["p"] ?? string.Empty);
            if (path.Length == 0 || !PhotoStorage.IsSafeRelativePath(path))
            {
                context.Response.StatusCode = 404;
                context.Response.End();
                return;
            }

            string fullPath = PhotoStorage.ResolvePhysicalPath(context, path);
            if (string.IsNullOrEmpty(fullPath) || !System.IO.File.Exists(fullPath))
            {
                context.Response.StatusCode = 404;
                context.Response.TrySkipIisCustomErrors = true;
                context.Response.End();
                return;
            }

            context.Response.ContentType = PhotoStorage.ContentTypeFor(fullPath);
            context.Response.Cache.SetCacheability(HttpCacheability.Public);
            context.Response.Cache.SetMaxAge(TimeSpan.FromHours(4));
            context.Response.TransmitFile(fullPath);
        }

        public bool IsReusable
        {
            get { return true; }
        }
    }
}
