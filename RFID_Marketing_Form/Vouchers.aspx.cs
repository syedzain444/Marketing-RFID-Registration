using System;
using System.Linq;
using System.Web.Script.Serialization;
using RFID_Marketing_Form.Data;

namespace RFID_Marketing_Form
{
    public partial class VouchersPage : MarketingPageBase
    {
        protected string PermissionsJson { get; private set; }

        protected void Page_Load(object sender, EventArgs e)
        {
            Require(AppPermissionCodes.ScreenVouchers);

            var user = CurrentMarketingUser();
            vouchersUserLabel.InnerText = user == null
                ? string.Empty
                : (string.IsNullOrWhiteSpace(user.DisplayName) ? user.EmpId : user.DisplayName + " (" + user.EmpId + ")");

            PermissionsJson = new JavaScriptSerializer().Serialize(new
            {
                list = Can(AppPermissionCodes.ActionVouchersList) || Can(AppPermissionCodes.ScreenVouchers),
                manage = Can(AppPermissionCodes.ActionVouchersManage) || Can(AppPermissionCodes.ScreenVouchers)
            });

            SetMarketingNav(marketingSidebar, MarketingNavSection.Vouchers);
        }
    }
}
