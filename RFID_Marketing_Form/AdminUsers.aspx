<%@ Page Language="C#" AutoEventWireup="true" CodeBehind="AdminUsers.aspx.cs" Inherits="RFID_Marketing_Form.AdminUsersPage" ClientIDMode="Static" %>
<%@ Register Src="~/Controls/MarketingSidebar.ascx" TagPrefix="uc" TagName="MarketingSidebar" %>

<!DOCTYPE html>
<html lang="en" class="records-root admin-users-root">
<head runat="server">
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Application users</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@500&amp;family=Inter:wght@400;500;600;700&amp;display=swap" rel="stylesheet" />
    <link href="https://cdn.datatables.net/1.13.8/css/jquery.dataTables.min.css" rel="stylesheet" />
    <link href="Content/rfid.css" rel="stylesheet" />
    <link href="Content/marketing-sidebar.css?v=4" rel="stylesheet" />
    <link href="Content/marketing-wide.css?v=1" rel="stylesheet" />
    <link href="Content/rfid-records.css?v=10" rel="stylesheet" />
    <link href="Content/admin-users.css?v=2" rel="stylesheet" />
    <link href="Content/marketing-dashboard.css?v=2" rel="stylesheet" />
</head>
<body class="records-page marketing-app dashboard-v2">
    <form id="form1" runat="server" class="marketing-shell">
        <uc:MarketingSidebar runat="server" ID="marketingSidebar" />
        <div class="marketing-main">
            <header class="topbar records-topbar">
                <div class="brand">
                    <span class="mark" aria-hidden="true">
                        <svg viewBox="0 0 32 32" width="22" height="22" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M16 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" stroke="currentColor" stroke-width="1.6"/>
                            <path d="M6 26c0-4 4-7 10-7s10 3 10 7" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
                        </svg>
                    </span>
                    <span class="brand-divider" aria-hidden="true"></span>
                    <div class="brand-text">
                        <h1>Users</h1>
                        <p class="subtitle">View and manage application accounts and roles.</p>
                    </div>
                </div>
                <div class="actions dashboard-actions">
                    <span class="dashboard-user" id="usersUserLabel" runat="server"></span>
                    <button type="button" id="btnNewUser" class="btn-dash btn-dash--outline">+ New user</button>
                    <a href="MarketingLogout.aspx" class="btn-dash">Sign out</a>
                    <button type="button" id="btnRefreshUsers" class="btn-dash btn-dash--primary">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M20 12a8 8 0 1 1-2.34-5.66M20 4v6h-6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>
                        Refresh
                    </button>
                </div>
            </header>

            <main class="records-main">
                <section class="records-stats" aria-live="polite">
                    <article class="stat-card-v2 stat-card-v2--teal">
                        <span class="stat-card-v2__label">Total users</span>
                        <strong class="stat-card-v2__value" id="statUsersTotal">—</strong>
                        <span class="stat-card-v2__icon" aria-hidden="true">
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" stroke="currentColor" stroke-width="1.5"/><circle cx="9" cy="7" r="4" stroke="currentColor" stroke-width="1.5"/></svg>
                        </span>
                        <svg class="stat-card-v2__spark" viewBox="0 0 72 28" fill="none"><path d="M2 22 L18 14 L32 18 L48 8 L70 4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
                    </article>
                    <article class="stat-card-v2 stat-card-v2--green">
                        <span class="stat-card-v2__label">Active</span>
                        <strong class="stat-card-v2__value" id="statUsersActive">—</strong>
                        <span class="stat-card-v2__icon" aria-hidden="true">
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M20 6L9 17l-5-5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
                        </span>
                        <svg class="stat-card-v2__spark" viewBox="0 0 72 28" fill="none"><path d="M2 20 L16 16 L30 12 L44 10 L70 6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
                    </article>
                    <article class="stat-card-v2 stat-card-v2--blue">
                        <span class="stat-card-v2__label">Inactive</span>
                        <strong class="stat-card-v2__value" id="statUsersInactive">—</strong>
                        <span class="stat-card-v2__icon" aria-hidden="true">
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.5"/><path d="M8 12h8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
                        </span>
                        <svg class="stat-card-v2__spark" viewBox="0 0 72 28" fill="none"><path d="M2 18 L20 14 L36 16 L52 10 L70 8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
                    </article>
                </section>

                <section class="records-panel records-panel--dash">
                    <div class="records-panel__head dash-panel__head">
                        <div>
                            <h2 class="records-panel__title">All users</h2>
                            <p class="records-panel__hint">View and manage application accounts and roles.</p>
                        </div>
                        <div id="usersDtToolbar" class="dash-dt-toolbar"></div>
                    </div>
                    <div id="usersAlert" class="records-alert is-hidden" role="alert"></div>
                    <div class="records-table-wrap">
                        <table id="usersTable" class="display records-table" style="width:100%;">
                            <thead>
                                <tr>
                                    <th>Employee ID</th>
                                    <th>Name</th>
                                    <th>Role</th>
                                    <th>Status</th>
                                    <th data-orderable="false">Actions</th>
                                </tr>
                            </thead>
                            <tbody></tbody>
                        </table>
                    </div>
                </section>
            </main>

            <div id="userModal" class="detail-modal is-hidden" role="dialog" aria-modal="true" aria-labelledby="userModalTitle">
                <div class="detail-modal__backdrop" id="userModalBackdrop"></div>
                <div class="detail-modal__sheet detail-modal__sheet--edit">
                    <button type="button" class="detail-modal__close" id="userModalClose" aria-label="Close">&times;</button>
                    <header class="edit-modal__head">
                        <p class="edit-modal__eyebrow">User account</p>
                        <h2 id="userModalTitle" class="edit-modal__title">New user</h2>
                        <p class="edit-modal__sub" id="userModalSub">Create an account</p>
                    </header>
                    <div class="detail-modal__body edit-modal__body">
                        <input type="hidden" id="userFormId" value="0" />
                        <div class="edit-employee-fields edit-employee-fields--solo">
                            <div class="edit-field">
                                <label for="userEmpId">Employee ID</label>
                                <input type="text" id="userEmpId" class="edit-input" maxlength="20" placeholder="e.g. 10428" />
                            </div>
                            <div class="edit-field">
                                <label for="userDisplayName">Display name</label>
                                <input type="text" id="userDisplayName" class="edit-input" maxlength="100" placeholder="Full name" />
                            </div>
                            <div class="edit-field">
                                <label for="userRole">Role</label>
                                <select id="userRole" class="edit-input"></select>
                            </div>
                            <div class="edit-field">
                                <label for="userPassword">Password <span class="tag-opt" id="userPasswordHint">Required for new users</span></label>
                                <input type="password" id="userPassword" class="edit-input" maxlength="100" autocomplete="new-password" />
                            </div>
                            <div class="edit-field edit-field--full edit-field--active-toggle">
                                <span class="edit-field__label" id="userActiveLegend">Active</span>
                                <label class="status-switch is-on" id="userActiveSwitch" aria-labelledby="userActiveLegend">
                                    <input type="checkbox" id="userActive" class="status-switch__input" checked="checked" />
                                    <span class="status-switch__track" aria-hidden="true"><span class="status-switch__thumb"></span></span>
                                    <span class="status-switch__label">Active</span>
                                </label>
                            </div>
                        </div>
                        <p id="userFormError" class="edit-form-error is-hidden" role="alert"></p>
                    </div>
                    <footer class="detail-modal__foot detail-modal__foot--split">
                        <button type="button" class="btn btn-primary" id="btnSaveUser">Save user</button>
                        <button type="button" class="btn btn-ghost" id="userModalCloseFoot">Cancel</button>
                    </footer>
                </div>
            </div>
        </div>

        <script>window.RFID_APP_ROOT = '<%= ResolveUrl("~/") %>';</script>
        <script src="https://code.jquery.com/jquery-3.7.1.min.js"></script>
        <script src="https://cdn.datatables.net/1.13.8/js/jquery.dataTables.min.js"></script>
        <script src="Scripts/admin-users.js"></script>
    </form>
</body>
</html>
