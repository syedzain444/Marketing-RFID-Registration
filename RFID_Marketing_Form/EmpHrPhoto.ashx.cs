using System;
using System.Configuration;
using System.Net;
using System.Text.RegularExpressions;
using System.Web;

namespace RFID_Marketing_Form
{
    /// <summary>Same-origin proxy for HR employee photos (EImages server) — enables PDF/canvas capture.</summary>
    public class EmpHrPhoto : IHttpHandler
    {
        private static readonly Regex SafeEmpId = new Regex("^[0-9]{1,20}$", RegexOptions.Compiled);

        public void ProcessRequest(HttpContext context)
        {
            var empId = (context.Request.QueryString["empId"] ?? string.Empty).Trim();
            if (empId.Length == 0 || !SafeEmpId.IsMatch(empId))
            {
                context.Response.StatusCode = 404;
                context.Response.TrySkipIisCustomErrors = true;
                context.Response.End();
                return;
            }

            var template = ConfigurationManager.AppSettings["EmployeeImageUrlTemplate"];
            if (string.IsNullOrWhiteSpace(template))
            {
                template = "http://172.16.10.54/EImages/EImages/{id}.jpg";
            }

            var remoteUrl = template.Trim()
                .Replace("{id}", empId)
                .Replace("{ID}", empId);

            try
            {
                byte[] bytes;
                using (var client = new WebClient())
                {
                    client.Headers.Add(HttpRequestHeader.UserAgent, "RFID-Marketing-Form/1.0");
                    bytes = client.DownloadData(remoteUrl);
                }

                if (bytes == null || bytes.Length == 0)
                {
                    context.Response.StatusCode = 404;
                    context.Response.TrySkipIisCustomErrors = true;
                    context.Response.End();
                    return;
                }

                context.Response.ContentType = GuessContentType(remoteUrl, bytes);
                context.Response.Cache.SetCacheability(HttpCacheability.Public);
                context.Response.Cache.SetMaxAge(TimeSpan.FromHours(4));
                context.Response.OutputStream.Write(bytes, 0, bytes.Length);
            }
            catch
            {
                context.Response.StatusCode = 404;
                context.Response.TrySkipIisCustomErrors = true;
                context.Response.End();
            }
        }

        private static string GuessContentType(string url, byte[] bytes)
        {
            if (bytes.Length >= 3 && bytes[0] == 0xFF && bytes[1] == 0xD8 && bytes[2] == 0xFF)
            {
                return "image/jpeg";
            }

            if (bytes.Length >= 8 && bytes[0] == 0x89 && bytes[1] == 0x50 && bytes[2] == 0x4E && bytes[3] == 0x47)
            {
                return "image/png";
            }

            var lower = (url ?? string.Empty).ToLowerInvariant();
            if (lower.EndsWith(".png", StringComparison.Ordinal))
            {
                return "image/png";
            }

            if (lower.EndsWith(".gif", StringComparison.Ordinal))
            {
                return "image/gif";
            }

            return "image/jpeg";
        }

        public bool IsReusable
        {
            get { return true; }
        }
    }
}
