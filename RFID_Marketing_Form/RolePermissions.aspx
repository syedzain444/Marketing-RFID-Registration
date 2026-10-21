<%@ Page Language="C#" AutoEventWireup="true" CodeBehind="RolePermissions.aspx.cs" Inherits="RFID_Marketing_Form.RolePermissionsPage" ClientIDMode="Static" %>
<%@ Register Src="~/Controls/MarketingSidebar.ascx" TagPrefix="uc" TagName="MarketingSidebar" %>

<!DOCTYPE html>
<html lang="en">
<head runat="server">
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Roles &amp; Permissions</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&amp;display=swap" rel="stylesheet" />
    <link href="Content/rfid.css" rel="stylesheet" />
    <link href="Content/marketing-sidebar.css?v=4" rel="stylesheet" />
    <link href="Content/marketing-wide.css?v=1" rel="stylesheet" />
    <link href="Content/role-permissions.css?v=5" rel="stylesheet" />
</head>
<body class="rp-page marketing-app">
    <form id="form1" runat="server" class="marketing-shell rp-form">
        <uc:MarketingSidebar runat="server" ID="marketingSidebar" />

        <div class="rp-main marketing-main">
            <header class="topbar records-topbar rp-topbar">
                <div class="brand">
                    <span class="mark" aria-hidden="true">
                        <svg viewBox="0 0 32 32" width="22" height="22" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke="currentColor" stroke-width="1.6"/>
                        </svg>
                    </span>
                    <span class="brand-divider" aria-hidden="true"></span>
                    <div class="brand-text">
                        <h1>Roles &amp; Permissions</h1>
                        <p class="subtitle">Manage role access for the marketing application.</p>
                    </div>
                </div>
                <div class="actions">
                    <button type="button" class="btn btn-ghost" id="btnRefreshRoles" onclick="window.location.reload(); return false;">Refresh</button>
                    <button type="submit" runat="server" id="btnSave" class="btn btn-primary" onserverclick="btnSave_Click">Save Permissions</button>
                </div>
            </header>
            <div class="rp-main__bg" aria-hidden="true"></div>
            <div class="rp-main__scroll">
                <asp:Panel ID="pnlMessage" runat="server" CssClass="rp-msg" Visible="false">
                    <asp:Literal ID="litMessage" runat="server" />
                </asp:Panel>

                <section class="rp-card rp-card--role">
                    <div class="rp-role-row">
                        <div class="rp-role-field">
                            <div class="rp-field-label">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" stroke="currentColor" stroke-width="1.6"/><circle cx="9" cy="7" r="4" stroke="currentColor" stroke-width="1.6"/></svg>
                                Role
                            </div>
                            <p class="rp-field-hint">Select a role to manage its permissions.</p>
                            <asp:DropDownList ID="ddlRole" runat="server" CssClass="rp-select" AutoPostBack="true" OnSelectedIndexChanged="ddlRole_SelectedIndexChanged" />
                        </div>
                    </div>
                    <p id="adminRoleHint" runat="server" class="rp-admin-banner" visible="false">
                        <strong>Admin</strong> has every permission. This matrix is read-only for that role.
                    </p>
                </section>

                <section class="rp-card rp-card--perms">
                    <div class="rp-perms-head">
                        <div class="rp-perms-head__title">
                            <div class="rp-shield" aria-hidden="true">
                                <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke="currentColor" stroke-width="1.6"/></svg>
                            </div>
                            <div>
                                <h2>Permissions</h2>
                                <p>Toggle access for each action. Users must sign in again after you save.</p>
                            </div>
                        </div>
                        <span class="rp-badge">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M20 6L9 17l-5-5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
                            <asp:Literal ID="litEnabledCount" runat="server" Text="0 permissions enabled" />
                        </span>
                    </div>
                    <div class="rp-perm-grid">
                        <asp:Repeater ID="rptPermissions" runat="server" OnItemDataBound="rptPermissions_ItemDataBound">
                            <ItemTemplate>
                                <div class="rp-perm-item">
                                    <div class="rp-perm-item__left">
                                        <div class="rp-perm-icon rp-perm-icon--<%# Eval("IconKey") %>" aria-hidden="true">
                                            <%# Eval("IconHtml") %>
                                        </div>
                                        <div class="rp-perm-item__text">
                                            <strong><%# Eval("Name") %></strong>
                                            <span><%# Eval("Description") %></span>
                                        </div>
                                    </div>
                                    <div class="rp-perm-item__toggle">
                                        <label class="status-switch">
                                            <input type="checkbox" runat="server" id="chkPerm" clientidmode="AutoID" class="status-switch__input" />
                                            <span class="status-switch__track" aria-hidden="true"><span class="status-switch__thumb"></span></span>
                                        </label>
                                        <asp:HiddenField ID="hidPermCode" runat="server" Value='<%# Eval("Code") %>' />
                                    </div>
                                </div>
                            </ItemTemplate>
                        </asp:Repeater>
                    </div>
                </section>
            </div>
        </div>
    </form>
</body>
</html>
