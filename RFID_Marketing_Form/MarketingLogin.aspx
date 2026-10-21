<%@ Page Language="C#" AutoEventWireup="true" CodeBehind="MarketingLogin.aspx.cs" Inherits="RFID_Marketing_Form.MarketingLogin" ClientIDMode="Static" %>
<!DOCTYPE html>
<html lang="en">
<head runat="server">
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Sign in — RFID Marketing</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&amp;display=swap" rel="stylesheet" />
    <link href="LoginCss.ashx?v=5" rel="stylesheet" />
</head>
<body class="login-page">
    <div class="login-scene" aria-hidden="true">
        <div class="login-scene__orb login-scene__orb--1"></div>
        <div class="login-scene__orb login-scene__orb--2"></div>
        <div class="login-scene__orb login-scene__orb--3"></div>
    </div>

    <header class="login-topbar">
        <div class="login-topbar__brand">
            <img class="login-topbar__logo" src="<%= ResolveUrl("~/Images/LogoB.png") %>" alt="Bahria Town Karachi" />
        </div>
    </header>

    <form id="form1" runat="server" autocomplete="off" class="login-form">
        <main class="login-shell">
            <section class="login-card">
                <div class="login-card__brand">
                    <span class="login-card__mark" aria-hidden="true">
                        <svg viewBox="0 0 32 32" width="22" height="22" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <rect x="5" y="9" width="22" height="15" rx="2.5" stroke="currentColor" stroke-width="1.6"/>
                            <path d="M5 13h22" stroke="currentColor" stroke-width="1.6"/>
                            <path d="M16 6c3 1.2 5 3.4 5.5 6" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
                            <path d="M16 6c-3 1.2-5 3.4-5.5 6" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
                        </svg>
                    </span>
                    <p class="login-card__app-name">RFID Marketing Desk</p>
                </div>
                <header class="login-card__head">
                    <h1>Sign in with employee ID</h1>
                    <p>Access RFID card requests, records, and printing tools for your role.</p>
                </header>

                <asp:Panel ID="pnlError" runat="server" CssClass="login-alert" Visible="false">
                    <asp:Literal ID="litError" runat="server" />
                </asp:Panel>

                <div class="login-field">
                    <label class="visually-hidden" for="txtEmpId">Employee ID</label>
                    <div class="login-input">
                        <span class="login-input__ico" aria-hidden="true">
                            <svg viewBox="0 0 24 24" width="18" height="18" fill="none"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><circle cx="12" cy="7" r="4" stroke="currentColor" stroke-width="1.6"/></svg>
                        </span>
                        <asp:TextBox ID="txtEmpId" runat="server" CssClass="login-input__control" MaxLength="20" placeholder="Employee ID" />
                    </div>
                </div>

                <div class="login-field">
                    <label class="visually-hidden" for="txtPassword">Password</label>
                    <div class="login-input">
                        <span class="login-input__ico" aria-hidden="true">
                            <svg viewBox="0 0 24 24" width="18" height="18" fill="none"><rect x="5" y="11" width="14" height="10" rx="2" stroke="currentColor" stroke-width="1.6"/><path d="M8 11V8a4 4 0 1 1 8 0v3" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>
                        </span>
                        <asp:TextBox ID="txtPassword" runat="server" TextMode="Password" CssClass="login-input__control" MaxLength="100" placeholder="Password" />
                        <button type="button" class="login-input__toggle" id="btnTogglePassword" aria-label="Show password" title="Show password">
                            <svg viewBox="0 0 24 24" width="18" height="18" fill="none"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" stroke="currentColor" stroke-width="1.6"/><circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="1.6"/></svg>
                        </button>
                    </div>
                </div>

                <div class="login-row">
                    <label class="login-remember">
                        <asp:CheckBox ID="chkRemember" runat="server" />
                        <span>Remember me</span>
                    </label>
                </div>

                <asp:Button ID="btnLogin" runat="server" Text="Sign in" CssClass="login-submit" OnClick="btnLogin_Click" />
            </section>
        </main>
    </form>

    <script>
        (function () {
            var btn = document.getElementById("btnTogglePassword");
            var pwd = document.getElementById("txtPassword");
            if (!btn || !pwd) return;
            btn.addEventListener("click", function () {
                var show = pwd.type === "password";
                pwd.type = show ? "text" : "password";
                btn.setAttribute("aria-label", show ? "Hide password" : "Show password");
            });
        })();
    </script>
</body>
</html>
