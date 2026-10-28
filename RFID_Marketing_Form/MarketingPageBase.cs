using System;
using System.Configuration;
using System.Web;
using System.Web.Script.Serialization;
using System.Web.UI;
using RFID_Marketing_Form.Data;

namespace RFID_Marketing_Form
{
    public class MarketingPageBase : Page
    {
        protected override void OnInit(EventArgs e)
        {
            base.OnInit(e);
            MarketingAuthContext.EnsurePermissionsLoaded(Context);
        }

        protected bool Can(string permissionCode)
        {
            return MarketingAuthContext.HasPermission(Context, permissionCode);
        }

        protected void Require(string permissionCode)
        {
            if (Can(permissionCode))
            {
                return;
            }

            if (!MarketingAuthContext.IsAuthenticated(Context))
            {
                RedirectToMarketingLogin();
                return;
            }

            var landing = MarketingAuthContext.ResolveLandingUrl(Context);
            Response.Redirect(landing, false);
            Context.ApplicationInstance.CompleteRequest();
        }

        private void RedirectToMarketingLogin()
        {
            var login = VirtualPathUtility.ToAbsolute("~/MarketingLogin.aspx");
            var returnUrl = Request.RawUrl;
            if (!string.IsNullOrEmpty(returnUrl) &&
                returnUrl.IndexOf("MarketingLogin.aspx", StringComparison.OrdinalIgnoreCase) < 0)
            {
                login += "?ReturnUrl=" + HttpUtility.UrlEncode(returnUrl);
            }

            Response.Redirect(login, false);
            Context.ApplicationInstance.CompleteRequest();
        }

        protected MarketingUser CurrentMarketingUser()
        {
            return MarketingAuthContext.CurrentUser(Context);
        }

        protected void SetMarketingNav(Controls.MarketingSidebar sidebar, MarketingNavSection section)
        {
            if (sidebar != null)
            {
                sidebar.ActiveSection = section;
            }
        }

        /// <summary>JSON string for window.RFID_EMPLOYEE_IMAGE_URL (use {id} placeholder).</summary>
        protected string RfidEmployeeImageUrlJson()
        {
            var tpl = ConfigurationManager.AppSettings["EmployeeImageUrlTemplate"];
            if (string.IsNullOrWhiteSpace(tpl))
            {
                tpl = "http://172.16.10.54/EImages/EImages/{id}.jpg";
            }

            return new JavaScriptSerializer().Serialize(tpl.Trim());
        }
    }
}
