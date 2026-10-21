using System.Web;
using System.Web.Script.Serialization;
using RFID_Marketing_Form.Data;

namespace RFID_Marketing_Form
{
    public class PhotoUpload : IHttpHandler
    {
        public void ProcessRequest(HttpContext context)
        {
            context.Response.ContentType = "application/json";
            context.Response.Cache.SetCacheability(HttpCacheability.NoCache);

            if (context.Request.HttpMethod != "POST")
            {
                Write(context, false, "POST required.", null, null);
                return;
            }

            var file = context.Request.Files["file"];
            if (file == null || file.ContentLength <= 0)
            {
                file = context.Request.Files.Count > 0 ? context.Request.Files[0] : null;
            }

            if (file == null || file.ContentLength <= 0)
            {
                Write(context, false, "No image file was received.", null, null);
                return;
            }

            var relativePath = PhotoStorage.SavePostedPhoto(context, file);
            if (string.IsNullOrEmpty(relativePath))
            {
                Write(context, false, "Could not save the image.", null, null);
                return;
            }

            var publicUrl = PhotoStorage.BuildPublicUrl(context, relativePath);
            Write(context, true, string.Empty, relativePath, publicUrl);
        }

        private static void Write(HttpContext context, bool ok, string error, string path, string url)
        {
            var payload = new
            {
                ok = ok,
                error = error ?? string.Empty,
                path = path ?? string.Empty,
                url = url ?? string.Empty
            };
            context.Response.Write(new JavaScriptSerializer().Serialize(payload));
        }

        public bool IsReusable
        {
            get { return false; }
        }
    }
}
