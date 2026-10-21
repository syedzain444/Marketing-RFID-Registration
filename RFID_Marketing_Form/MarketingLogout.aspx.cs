using System;
using System.Web.UI;
using RFID_Marketing_Form.Data;

namespace RFID_Marketing_Form
{
    public partial class MarketingLogout : Page
    {
        protected void Page_Load(object sender, EventArgs e)
        {
            MarketingAuthContext.SignOut(Context);
            Response.Redirect("~/MarketingLogin.aspx", false);
        }
    }
}
