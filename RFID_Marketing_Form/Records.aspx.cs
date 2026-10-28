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
        protected string IssuedByDefaultName { get; private set; }
        protected string IssuedByDefaultNameJson { get; private set; }
        protected string RecordScope { get; private set; }
        protected bool IsFamilyView { get; private set; }
        protected bool IsAssignView { get; private set; }

        protected void Page_Load(object sender, EventArgs e)
        {
            var path = (Request.AppRelativeCurrentExecutionFilePath ?? string.Empty).ToUpperInvariant();
            IsAssignView = path.IndexOf("EMPLOYEERFIDMANAGEMENT.ASPX", StringComparison.Ordinal) >= 0;
            if (IsAssignView)
            {
                if (!Can(AppPermissionCodes.ScreenEmployeeRfid) && !Can(AppPermissionCodes.ScreenRecords))
                {
                    Require(AppPermissionCodes.ScreenEmployeeRfid);
                }
            }
            else
            {
                Require(AppPermissionCodes.ScreenRecords);
            }

            var view = (Request.QueryString["view"] ?? string.Empty).Trim();
            IsFamilyView = !IsAssignView && view.Equals("family", StringComparison.OrdinalIgnoreCase);
            RecordScope = IsFamilyView ? "family" : (IsAssignView ? "assign" : "employee");
            var user = CurrentMarketingUser();
            UserLabel = user == null
                ? string.Empty
                : (string.IsNullOrWhiteSpace(user.DisplayName) ? user.EmpId : user.DisplayName + " (" + user.EmpId + ")");

            IssuedByDefaultName = user == null
                ? string.Empty
                : (string.IsNullOrWhiteSpace(user.DisplayName) ? (user.EmpId ?? string.Empty).Trim() : user.DisplayName.Trim());
            IssuedByDefaultNameJson = new JavaScriptSerializer().Serialize(IssuedByDefaultName ?? string.Empty);

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
                formClear = perms.Contains(AppPermissionCodes.ActionFormClear),
                voucherManage = Can(AppPermissionCodes.ActionVouchersManage) || Can(AppPermissionCodes.ScreenVouchers),
                voucherScreen = Can(AppPermissionCodes.ScreenVouchers)
            });

            lnkVoucherDesk.Visible = Can(AppPermissionCodes.ScreenVouchers);

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
            else if (IsAssignView)
            {
                Page.Title = "Employee RFID Management";
                if (recordsHeading != null) recordsHeading.InnerText = "Employee RFID Management";
                if (recordsSubtitle != null)
                {
                    recordsSubtitle.InnerHtml =
                        "Active employees from <span class=\"mono-soft\">SPERS.V_EMPS</span> · RFID saved to <span id=\"recordsTableLabel\" class=\"mono-soft\">SPERS.RFID_CARD_ASSIGN</span>";
                }
                if (recordsPanelHint != null)
                {
                    recordsPanelHint.InnerText =
                        "All active employees are listed below. Enter RFID on the grid to create or update the ACTIVE assignment in RFID_CARD_ASSIGN.";
                }
                lnkNewRequest.Visible = false;
                lnkAddFamily.Visible = false;
                SetMarketingNav(marketingSidebar, MarketingNavSection.EmployeeRfid);
            }
            else
            {
                SetMarketingNav(marketingSidebar, MarketingNavSection.Records);
            }
        }
    }
}
