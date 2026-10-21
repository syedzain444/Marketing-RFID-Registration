using System;
using System.Collections.Generic;
using System.Web;
using System.Web.Script.Serialization;
using System.Web.SessionState;

namespace RFID_Marketing_Form
{
    public class Captcha : IHttpHandler, IRequiresSessionState
    {
        public void ProcessRequest(HttpContext context)
        {
            context.Response.ContentType = "application/json";
            context.Response.Cache.SetCacheability(HttpCacheability.NoCache);

            var rng = new Random();
            var a = rng.Next(2, 9);
            var b = rng.Next(2, 9);
            var key = Guid.NewGuid().ToString("N");
            context.Session["captcha_" + key] = a + b;
            context.Session["captcha_ts_" + key] = DateTime.UtcNow;

            var payload = new Dictionary<string, object>
            {
                { "ok", true },
                { "key", key },
                { "a", a },
                { "b", b }
            };

            context.Response.Write(new JavaScriptSerializer().Serialize(payload));
        }

        public bool IsReusable
        {
            get { return false; }
        }

        public static bool TryValidate(HttpContext context, string key, string answerText)
        {
            if (context == null || context.Session == null)
            {
                return false;
            }

            key = (key ?? string.Empty).Trim();
            answerText = (answerText ?? string.Empty).Trim();
            if (key.Length == 0 || answerText.Length == 0)
            {
                return false;
            }

            var sessionKey = "captcha_" + key;
            var expected = context.Session[sessionKey];
            if (expected == null)
            {
                return false;
            }

            int given;
            if (!int.TryParse(answerText, out given))
            {
                return false;
            }

            var ok = given == Convert.ToInt32(expected);
            context.Session.Remove(sessionKey);
            context.Session.Remove("captcha_ts_" + key);
            return ok;
        }
    }
}
