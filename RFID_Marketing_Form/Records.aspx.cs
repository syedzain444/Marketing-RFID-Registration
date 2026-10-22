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
        protected string RecordScope { get; private set; }
        protected bool IsFamilyView { get; private set; }

        protected void Page_Load(object sender, EventArgs e)
        {
            Require(AppPermissionCodes.ScreenRecords);
            var view = (Request.QueryString["view"] ?? string.Empty).Trim();
            IsFamilyView = view.Equals("family", StringComparison.OrdinalIgnoreCase);
            RecordScope = IsFamilyView ? "family" : "employee";
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
            lnkAddFamily.Visible = Can(AppPermissionCodes.ScreenForm);
            lnkAdmin.Visible = Can(AppPermissionCodes.ScreenAdmin);

            if (IsFamilyView)
            {
                Page.Title = "Employee Family Records";
                if (recordsHeading != null) recordsHeading.InnerText = "Employee Family Records";
                if (recordsSubtitle != null)
                {
                    recordsSubtitle.InnerHtml =
                        "Browse employee family cards from <span id=\"recordsTableLabel\" class=\"mono-soft\">SPERS.EMP_FAMILY_MARKETING</span>";
                }
                if (recordsPanelHint != null)
                {
                    recordsPanelHint.InnerText = "View and manage family RFID cards (card name, relationship, status, and print).";
                }
                SetMarketingNav(marketingSidebar, MarketingNavSection.ParentRecords);
            }
            else
            {
                SetMarketingNav(marketingSidebar, MarketingNavSection.Records);
            }
        }
    }
}
