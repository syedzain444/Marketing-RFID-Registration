using System;
using System.Linq;
using System.Web.Script.Serialization;
using RFID_Marketing_Form.Data;

namespace RFID_Marketing_Form
{
    public partial class RecordsPage : MarketingPageBase
    {
        protected string PermissionsJson { get; private set; }
        protected string UserLabel { get; private set; }

        protected void Page_Load(object sender, EventArgs e)
        {
            Require(AppPermissionCodes.ScreenRecords);
            var user = CurrentMarketingUser();
            UserLabel = user == null
                ? string.Empty
                : (string.IsNullOrWhiteSpace(user.DisplayName) ? user.EmpId : user.DisplayName + " (" + user.EmpId + ")");

            var perms = MarketingAuthContext.Permissions(Context).ToList();
            PermissionsJson = new JavaScriptSerializer().Serialize(new
            {
                list = perms.Contains(AppPermissionCodes.ActionRecordsList),
                view = perms.Contains(AppPermissionCodes.ActionRecordsView),
                edit = perms.Contains(AppPermissionCodes.ActionRecordsEdit),
                print = perms.Contains(AppPermissionCodes.ActionRecordsPrint),
                status = perms.Contains(AppPermissionCodes.ActionRecordsStatus),
                photo = perms.Contains(AppPermissionCodes.ActionRecordsPhoto),
                admin = perms.Contains(AppPermissionCodes.ScreenAdmin),
                form = perms.Contains(AppPermissionCodes.ScreenForm),
                formSave = perms.Contains(AppPermissionCodes.ActionFormSave),
                formClear = perms.Contains(AppPermissionCodes.ActionFormClear)
            });

            recordsUserLabel.InnerText = UserLabel;
            lnkNewRequest.Visible = Can(AppPermissionCodes.ScreenForm);
            lnkAdmin.Visible = Can(AppPermissionCodes.ScreenAdmin);

            SetMarketingNav(marketingSidebar, MarketingNavSection.Records);
        }
    }
}
