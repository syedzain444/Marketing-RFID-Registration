using System;

using System.Collections.Generic;

using System.Linq;

using System.Web;

using System.Web.UI;

using System.Web.UI.HtmlControls;
using System.Web.UI.WebControls;

using RFID_Marketing_Form.Data;



namespace RFID_Marketing_Form

{

    public partial class RolePermissionsPage : MarketingPageBase

    {

        private readonly MarketingAuthRepository repo = new MarketingAuthRepository();



        private sealed class PermissionRowVm

        {

            public string Code { get; set; }

            public string Name { get; set; }

            public string Description { get; set; }

            public string IconKey { get; set; }

            public string IconHtml { get; set; }

            public bool Selected { get; set; }

        }



        private static readonly Dictionary<string, string> PermissionDescriptions =

            new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)

            {

                { AppPermissionCodes.ScreenForm, "Open the new RFID card request form." },

                { AppPermissionCodes.ScreenRecords, "Open the employee records list and search." },

                { AppPermissionCodes.ScreenAdmin, "Access administration screens (users and roles)." },

                { AppPermissionCodes.ActionFormSave, "Submit and save a new RFID request." },

                { AppPermissionCodes.ActionFormClear, "Reset fields on the RFID request form." },

                { AppPermissionCodes.ActionRecordsList, "Load and refresh the records grid." },

                { AppPermissionCodes.ActionRecordsView, "View full details for a record." },

                { AppPermissionCodes.ActionRecordsEdit, "Edit employee profile fields on a record." },

                { AppPermissionCodes.ActionRecordsPrint, "Print front and back of the ID card." },

                { AppPermissionCodes.ActionRecordsStatus, "Mark records active or inactive." },

                { AppPermissionCodes.ActionRecordsPhoto, "Upload or replace the employee photo." },

                { AppPermissionCodes.ScreenVouchers, "Open the payment vouchers desk." },

                { AppPermissionCodes.ActionVouchersList, "Load and search payment vouchers." },

                { AppPermissionCodes.ActionVouchersManage, "Mark vouchers paid or unpaid (updates STATUS in CARD_VOUCHERS)." },

                { AppPermissionCodes.AdminUsers, "Create users and assign roles." },

                { AppPermissionCodes.AdminRoles, "Change which permissions each role has." }

            };



        protected void Page_Load(object sender, EventArgs e)

        {

            Require(AppPermissionCodes.AdminRoles);

            SetMarketingNav(marketingSidebar, MarketingNavSection.Roles);



            if (!IsPostBack)

            {

                BindRoles();

            }



            BindPermissionMatrix();

            if (IsPostBack)

            {

                RestoreToggleStateFromForm();

            }

        }



        protected void ddlRole_SelectedIndexChanged(object sender, EventArgs e)

        {

            BindPermissionMatrix();

            ApplyAdminRoleUi();

            UpdateEnabledCount();

        }



        protected void btnSave_Click(object sender, EventArgs e)
        {
            SavePermissions();
        }

        private void SavePermissions()

        {

            Require(AppPermissionCodes.AdminRoles);



            var role = ddlRole.SelectedValue;

            if (string.Equals(role, "ADMIN", StringComparison.OrdinalIgnoreCase))

            {

                ShowMessage("Admin role permissions cannot be changed.", false);

                return;

            }



            var selected = CollectSelectedFromRepeater();

            var err = repo.SaveRolePermissions(role, selected);

            if (!string.IsNullOrEmpty(err))

            {

                ShowMessage(err, false);

                return;

            }



            BindPermissionMatrix();

            ApplyAdminRoleUi();

            UpdateEnabledCount();

            ShowMessage("Permissions saved for role " + role + ". Users must sign in again to refresh their access.", true);

        }



        protected void rptPermissions_ItemDataBound(object sender, RepeaterItemEventArgs e)

        {

            if (e.Item.ItemType != ListItemType.Item && e.Item.ItemType != ListItemType.AlternatingItem)

            {

                return;

            }



            var vm = (PermissionRowVm)e.Item.DataItem;

            var chk = e.Item.FindControl("chkPerm") as HtmlInputCheckBox;

            if (chk != null)

            {

                chk.Checked = vm.Selected;

                chk.Disabled = IsAdminRoleLocked();

            }

        }



        private void BindRoles()

        {

            ddlRole.Items.Clear();

            foreach (var role in repo.ListRoles(true))

            {

                ddlRole.Items.Add(new ListItem(role.RoleName + " (" + role.RoleCode + ")", role.RoleCode));

            }

        }



        private void BindPermissionMatrix()

        {

            var role = ddlRole.SelectedValue;

            var granted = GetGrantedSetForRole(role);



            var rows = repo.ListPermissions()

                .Select(p => new PermissionRowVm

                {

                    Code = p.PermissionCode,

                    Name = p.PermissionName,

                    Description = GetDescription(p.PermissionCode),

                    IconKey = GetIconKey(p.PermissionCode, p.Category),

                    IconHtml = GetIconHtml(GetIconKey(p.PermissionCode, p.Category)),

                    Selected = granted.Contains(p.PermissionCode)

                })

                .ToList();



            rptPermissions.DataSource = rows;

            rptPermissions.DataBind();

            ApplyAdminRoleUi();

            UpdateEnabledCount();

        }



        private HashSet<string> GetGrantedSetForRole(string role)

        {

            if (string.IsNullOrEmpty(role))

            {

                return new HashSet<string>(StringComparer.OrdinalIgnoreCase);

            }



            if (string.Equals(role, "ADMIN", StringComparison.OrdinalIgnoreCase))

            {

                return new HashSet<string>(

                    repo.ListPermissions().Select(p => p.PermissionCode),

                    StringComparer.OrdinalIgnoreCase);

            }



            var map = repo.GetRolePermissionMap();

            HashSet<string> granted;

            if (!map.TryGetValue(role, out granted))

            {

                granted = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

            }



            return granted;

        }



        private bool IsAdminRoleLocked()

        {

            return string.Equals(ddlRole.SelectedValue, "ADMIN", StringComparison.OrdinalIgnoreCase);

        }



        private void ApplyAdminRoleUi()

        {

            var locked = IsAdminRoleLocked();

            btnSave.Disabled = locked;

            adminRoleHint.Visible = locked;



            foreach (RepeaterItem item in rptPermissions.Items)

            {

                var chk = item.FindControl("chkPerm") as HtmlInputCheckBox;

                if (chk != null)

                {

                    chk.Disabled = locked;

                }

            }

        }



        private void UpdateEnabledCount()

        {

            var count = 0;

            foreach (RepeaterItem item in rptPermissions.Items)

            {

                var chk = item.FindControl("chkPerm") as HtmlInputCheckBox;

                if (chk != null && chk.Checked)

                {

                    count++;

                }

            }



            litEnabledCount.Text = count + (count == 1 ? " permission enabled" : " permissions enabled");

        }



        private void RestoreToggleStateFromForm()

        {

            foreach (RepeaterItem item in rptPermissions.Items)

            {

                var chk = item.FindControl("chkPerm") as HtmlInputCheckBox;

                if (chk == null)

                {

                    continue;

                }



                var posted = Request.Form[chk.UniqueID];

                chk.Checked = !string.IsNullOrEmpty(posted);

            }

        }



        private List<string> CollectSelectedFromRepeater()

        {

            var selected = new List<string>();

            foreach (RepeaterItem item in rptPermissions.Items)

            {

                var hid = item.FindControl("hidPermCode") as HiddenField;

                var chk = item.FindControl("chkPerm") as HtmlInputCheckBox;

                if (hid == null || chk == null || string.IsNullOrEmpty(hid.Value))

                {

                    continue;

                }



                if (chk.Checked)

                {

                    selected.Add(hid.Value);

                }

            }



            return selected;

        }



        private static string GetDescription(string code)

        {

            string text;

            if (PermissionDescriptions.TryGetValue(code, out text))

            {

                return text;

            }



            return "Controls access for this action in the application.";

        }



        private static string GetIconKey(string code, string category)

        {

            if (code != null && code.StartsWith("admin.", StringComparison.OrdinalIgnoreCase))

            {

                return "admin";

            }



            if (code != null && code.StartsWith("screen.", StringComparison.OrdinalIgnoreCase))

            {

                return "screen";

            }



            if (code != null && code.StartsWith("action.form.", StringComparison.OrdinalIgnoreCase))

            {

                return "form";

            }



            return "records";

        }



        private static string GetIconHtml(string iconKey)

        {

            switch (iconKey)

            {

                case "admin":

                    return "<svg width=\"18\" height=\"18\" viewBox=\"0 0 24 24\" fill=\"none\"><path d=\"M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z\" stroke=\"currentColor\" stroke-width=\"1.6\"/><path d=\"M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z\" stroke=\"currentColor\" stroke-width=\"1.4\"/></svg>";

                case "screen":

                    return "<svg width=\"18\" height=\"18\" viewBox=\"0 0 24 24\" fill=\"none\"><rect x=\"3\" y=\"4\" width=\"18\" height=\"14\" rx=\"2\" stroke=\"currentColor\" stroke-width=\"1.6\"/><path d=\"M8 20h8\" stroke=\"currentColor\" stroke-width=\"1.6\" stroke-linecap=\"round\"/></svg>";

                case "form":

                    return "<svg width=\"18\" height=\"18\" viewBox=\"0 0 24 24\" fill=\"none\"><path d=\"M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z\" stroke=\"currentColor\" stroke-width=\"1.6\"/><path d=\"M14 2v6h6M8 13h8M8 17h5\" stroke=\"currentColor\" stroke-width=\"1.4\" stroke-linecap=\"round\"/></svg>";

                default:

                    return "<svg width=\"18\" height=\"18\" viewBox=\"0 0 24 24\" fill=\"none\"><rect x=\"4\" y=\"4\" width=\"16\" height=\"16\" rx=\"2\" stroke=\"currentColor\" stroke-width=\"1.6\"/><path d=\"M8 9h8M8 13h5\" stroke=\"currentColor\" stroke-width=\"1.4\" stroke-linecap=\"round\"/></svg>";

            }

        }



        private void ShowMessage(string text, bool ok)

        {

            pnlMessage.Visible = true;

            pnlMessage.CssClass = ok ? "rp-msg rp-msg--ok" : "rp-msg rp-msg--err";

            litMessage.Text = HttpUtility.HtmlEncode(text);

        }

    }

}


