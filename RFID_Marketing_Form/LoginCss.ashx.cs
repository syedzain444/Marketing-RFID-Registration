using System.IO;
using System.Web;

namespace RFID_Marketing_Form
{
    /// <summary>Serves login CSS anonymously (external .css files may be blocked by auth).</summary>
    public class LoginCss : IHttpHandler
    {
        public void ProcessRequest(HttpContext context)
        {
            var path = context.Server.MapPath("~/Content/marketing-login.css");
            context.Response.ContentType = "text/css";
            context.Response.Cache.SetCacheability(HttpCacheability.Public);
            context.Response.Cache.SetMaxAge(new System.TimeSpan(0, 10, 0));

            if (!File.Exists(path))
            {
                context.Response.StatusCode = 404;
                return;
            }

            context.Response.Write(File.ReadAllText(path));
        }

        public bool IsReusable
        {
            get { return true; }
        }
    }
}
