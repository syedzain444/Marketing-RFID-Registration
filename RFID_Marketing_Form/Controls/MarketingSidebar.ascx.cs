using System.Web;
using System.Web.UI.HtmlControls;
using RFID_Marketing_Form.Data;

namespace RFID_Marketing_Form.Controls
{
    public partial class MarketingSidebar : System.Web.UI.UserControl
    {
        public MarketingNavSection ActiveSection { get; set; }

        protected void Page_PreRender(object sender, System.EventArgs e)
        {
            logoImg.Src = ResolveUrl("~/Images/LogoB.png");
            logoImg.Alt = "Bahria Town Karachi";
            navRecords.HRef = ResolveUrl("~/Records.aspx");
            navForm.HRef = ResolveUrl("~/Default.aspx");
            navUsers.HRef = ResolveUrl("~/AdminUsers.aspx");
            navRoles.HRef = ResolveUrl("~/RolePermissions.aspx");
            navLogout.HRef = ResolveUrl("~/MarketingLogout.aspx");

            var user = MarketingAuthContext.CurrentUser(Context);
            if (user != null)
            {
                var display = string.IsNullOrWhiteSpace(user.DisplayName) ? user.EmpId : user.DisplayName;
                var meta = string.IsNullOrWhiteSpace(user.RoleName) ? user.RoleCode : user.RoleName;
                litProfileName.InnerText = display;
                litProfileRole.InnerText = meta;
                litProfileMenuName.InnerText = display;
                litProfileMenuMeta.InnerText = user.EmpId + (string.IsNullOrWhiteSpace(meta) ? "" : " · " + meta);
            }

            var ctx = HttpContext.Current;
            navRecords.Visible = MarketingAuthContext.HasPermission(ctx, AppPermissionCodes.ScreenRecords);
            navForm.Visible = MarketingAuthContext.HasPermission(ctx, AppPermissionCodes.ScreenForm);
            navUsers.Visible = MarketingAuthContext.HasPermission(ctx, AppPermissionCodes.AdminUsers);
            navRoles.Visible = MarketingAuthContext.HasPermission(ctx, AppPermissionCodes.AdminRoles);

            SetActive(navRecords, ActiveSection == MarketingNavSection.Records);
            SetActive(navForm, ActiveSection == MarketingNavSection.Form);
            SetActive(navUsers, ActiveSection == MarketingNavSection.Users);
            SetActive(navRoles, ActiveSection == MarketingNavSection.Roles);

            RegisterProfileScript();
        }

        private void RegisterProfileScript()
        {
            var key = "marketing-profile";
            if (Page.ClientScript.IsClientScriptIncludeRegistered(Page.GetType(), key))
            {
                return;
            }

            Page.ClientScript.RegisterClientScriptInclude(Page.GetType(), key, ResolveUrl("~/Scripts/marketing-profile.js"));
        }

        private static void SetActive(HtmlAnchor link, bool active)
        {
            if (link == null)
            {
                return;
            }

            const string activeClass = "is-active";
            var css = link.Attributes["class"] ?? string.Empty;
            if (active)
            {
                if (css.IndexOf(activeClass, System.StringComparison.Ordinal) < 0)
                {
                    link.Attributes["class"] = string.IsNullOrEmpty(css) ? activeClass : css + " " + activeClass;
                }
            }
            else
            {
                link.Attributes["class"] = css.Replace(activeClass, string.Empty).Trim();
            }
        }
    }
}
