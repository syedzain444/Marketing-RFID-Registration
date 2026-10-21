using System;
using System.Web;
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
            if (!Can(permissionCode))
            {
                throw new HttpException(403, "Access denied.");
            }
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
    }
}
