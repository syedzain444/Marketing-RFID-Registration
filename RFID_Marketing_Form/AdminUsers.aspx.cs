using RFID_Marketing_Form.Data;

namespace RFID_Marketing_Form
{
    public partial class AdminUsersPage : MarketingPageBase
    {
        protected void Page_Load(object sender, System.EventArgs e)
        {
            Require(AppPermissionCodes.AdminUsers);
            var user = CurrentMarketingUser();
            if (usersUserLabel != null && user != null)
            {
                usersUserLabel.InnerText = string.IsNullOrWhiteSpace(user.DisplayName)
                    ? user.EmpId
                    : user.DisplayName + " (" + user.EmpId + ")";
            }

            SetMarketingNav(marketingSidebar, MarketingNavSection.Users);
        }
    }
}
