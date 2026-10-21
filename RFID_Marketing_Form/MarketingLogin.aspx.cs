using System;
using System.Web;
using System.Web.UI;
using RFID_Marketing_Form.Data;

namespace RFID_Marketing_Form
{
    public partial class MarketingLogin : Page
    {
        protected void Page_Load(object sender, EventArgs e)
        {
            if (!IsPostBack)
            {
                new MarketingAuthRepository().EnsureBootstrapAdmin();
                if (MarketingAuthContext.IsAuthenticated(Context))
                {
                    if (MarketingAuthContext.EnsurePermissionsLoaded(Context) &&
                        MarketingAuthContext.CurrentUser(Context) != null)
                    {
                        RedirectAfterLogin();
                    }
                    else
                    {
                        MarketingAuthContext.InvalidateAuthentication(Context);
                    }
                }
            }
        }

        protected void btnLogin_Click(object sender, EventArgs e)
        {
            pnlError.Visible = false;
            var repo = new MarketingAuthRepository();
            var result = repo.Login(txtEmpId.Text, txtPassword.Text);
            if (!result.Success)
            {
                pnlError.Visible = true;
                litError.Text = HttpUtility.HtmlEncode(result.Error ?? "Sign in failed.");
                return;
            }

            MarketingAuthContext.SignIn(Context, result.User, result.Permissions, chkRemember.Checked);
            RedirectAfterLogin();
        }

        private void RedirectAfterLogin()
        {
            string target;
            var returnUrl = Request.QueryString["ReturnUrl"];
            if (MarketingAuthContext.TryResolveSafeReturnUrl(Context, returnUrl, out target))
            {
                FinishRedirect(target);
                return;
            }

            target = MarketingAuthContext.ResolveLandingUrl(Context);
            if (target.IndexOf("MarketingLogin.aspx", StringComparison.OrdinalIgnoreCase) >= 0)
            {
                MarketingAuthContext.SignOut(Context);
                pnlError.Visible = true;
                litError.Text = "Your role has no assigned screens. Contact an administrator.";
                return;
            }

            FinishRedirect(target);
        }

        private void FinishRedirect(string target)
        {
            Response.Redirect(target, false);
            Context.ApplicationInstance.CompleteRequest();
        }
    }
}
