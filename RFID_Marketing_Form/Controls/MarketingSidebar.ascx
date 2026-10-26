<%@ Control Language="C#" AutoEventWireup="true" CodeBehind="MarketingSidebar.ascx.cs" Inherits="RFID_Marketing_Form.Controls.MarketingSidebar" %>

<aside class="rp-sidebar" aria-label="Application navigation">

    <div class="rp-sidebar__logo">

        <img runat="server" id="logoImg" alt="Bahria Town" onerror="this.style.display='none';this.nextElementSibling.style.display='block';" />

        <span class="rp-sidebar__logo-fallback" style="display:none;">Bahria Town</span>

    </div>

    <nav class="rp-nav" aria-label="Main">

        <a runat="server" id="navRecords" Visible="false">

            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><rect x="4" y="4" width="16" height="16" rx="2" stroke="currentColor" stroke-width="1.6"/><path d="M8 9h8M8 13h5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>

            RFID Management

        </a>

        <a runat="server" id="navParentRecords" Visible="false">

            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><circle cx="9" cy="8" r="2.5" stroke="currentColor" stroke-width="1.5"/><circle cx="16" cy="9" r="2" stroke="currentColor" stroke-width="1.5"/><path d="M4 19c0-2.5 2.2-4 5-4s5 1.5 5 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><path d="M14 19c0-1.8 1.4-3 3.5-3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>

            Employee Family Records

        </a>

        <a runat="server" id="navVouchers" Visible="false">

            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><rect x="4" y="5" width="16" height="14" rx="2" stroke="currentColor" stroke-width="1.5"/><path d="M8 9h8M8 13h6" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>

            Payment vouchers

        </a>

        <a runat="server" id="navUsers" Visible="false">

            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" stroke="currentColor" stroke-width="1.6"/><circle cx="9" cy="7" r="4" stroke="currentColor" stroke-width="1.6"/></svg>

            Users

        </a>

        <a runat="server" id="navRoles" Visible="false">

            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke="currentColor" stroke-width="1.6"/></svg>

            Roles &amp; Permissions

        </a>

    </nav>

    <div class="rp-sidebar__foot rp-profile-wrap">

        <button type="button" class="rp-profile-trigger" id="profileTrigger" aria-haspopup="true" aria-expanded="false">

            <span class="rp-profile-avatar" aria-hidden="true">

                <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="8" r="4" stroke="currentColor" stroke-width="1.6"/><path d="M5 20c1.5-3.5 4.5-5 7-5s5.5 1.5 7 5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>

            </span>

            <span class="rp-profile-text">

                <span runat="server" id="litProfileName" class="rp-profile-name">Account</span>

                <span runat="server" id="litProfileRole" class="rp-profile-role">Signed in</span>

            </span>

            <svg class="rp-profile-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M6 9l6 6 6-6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>

        </button>

        <div class="rp-profile-menu" id="profileMenu" role="menu">

            <div class="rp-profile-menu__head">

                <strong runat="server" id="litProfileMenuName"></strong>

                <span runat="server" id="litProfileMenuMeta"></span>

            </div>

            <a runat="server" id="navLogout" class="rp-profile-menu__logout" role="menuitem">

                <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>

                Sign out

            </a>

        </div>

    </div>

</aside>

