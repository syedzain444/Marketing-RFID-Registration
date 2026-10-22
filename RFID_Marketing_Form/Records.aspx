<%@ Page Language="C#" AutoEventWireup="true" CodeBehind="Records.aspx.cs" Inherits="RFID_Marketing_Form.RecordsPage" ClientIDMode="Static" %>
<%@ Register Src="~/Controls/MarketingSidebar.ascx" TagPrefix="uc" TagName="MarketingSidebar" %>
<%@ Register Src="~/Controls/RfidNewRequestForm.ascx" TagPrefix="uc" TagName="RfidNewRequestForm" %>

<!DOCTYPE html>
<html lang="en" class="records-root">
<head runat="server">
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title><%= IsFamilyView ? "Employee Family Records" : "RFID Records" %></title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
    <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@500&amp;family=Inter:wght@400;500;600;700&amp;display=swap" rel="stylesheet" />
    <link href="https://cdn.datatables.net/1.13.8/css/jquery.dataTables.min.css" rel="stylesheet" />
    <link href="Content/rfid.css" rel="stylesheet" />
    <link href="Site.css?v=2" rel="stylesheet" />
    <link href="Content/marketing-sidebar.css?v=4" rel="stylesheet" />
    <link href="Content/marketing-wide.css?v=1" rel="stylesheet" />
    <link href="Content/rfid-records.css?v=4" rel="stylesheet" />
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
                        <rect x="4" y="6" width="24" height="20" rx="2.5" stroke="currentColor" stroke-width="1.6"/>
                        <path d="M4 11h24" stroke="currentColor" stroke-width="1.6"/>
                        <path d="M8 16h8M8 20h14" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
                    </svg>
                </span>
                <span class="brand-divider" aria-hidden="true"></span>
                <div class="brand-text">
                    <h1 runat="server" id="recordsHeading">RFID Records</h1>
                    <p runat="server" id="recordsSubtitle" class="subtitle">Browse saved card assignments from <span id="recordsTableLabel" class="mono-soft">—</span></p>
                </div>
            </div>
            <div class="actions dashboard-actions">
                <span class="dashboard-user" id="recordsUserLabel" runat="server"></span>
                <a runat="server" id="lnkNewRequest" href="#" class="btn-dash btn-dash--outline" Visible="false">+ New request</a>
                <a runat="server" id="lnkAddFamily" href="#" class="btn-dash btn-dash--outline" Visible="false">+ Add family card</a>
                <a runat="server" id="lnkAdmin" href="RolePermissions.aspx" class="btn-dash btn-dash--ghost" Visible="false">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="1.6"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>
                    Admin
                </a>
                <a href="MarketingLogout.aspx" class="btn-dash">Sign out</a>
                <button type="button" id="btnRefreshRecords" class="btn-dash btn-dash--primary">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M20 12a8 8 0 1 1-2.34-5.66M20 4v6h-6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>
                    Refresh
                </button>
            </div>
        </header>

        <main class="records-main">
            <section class="records-stats" id="recordsStats" aria-live="polite">
                <article class="stat-card-v2 stat-card-v2--teal">
                    <span class="stat-card-v2__label">Total records</span>
                    <strong class="stat-card-v2__value" id="statTotal">—</strong>
                    <span class="stat-card-v2__icon" aria-hidden="true">
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><ellipse cx="12" cy="6" rx="8" ry="3" stroke="currentColor" stroke-width="1.5"/><path d="M4 6v12c0 1.66 3.58 3 8 3s8-1.34 8-3V6" stroke="currentColor" stroke-width="1.5"/></svg>
                    </span>
                    <svg class="stat-card-v2__spark" viewBox="0 0 72 28" fill="none"><path d="M2 22 L18 14 L32 18 L48 8 L70 4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
                </article>
                <article class="stat-card-v2 stat-card-v2--green">
                    <span class="stat-card-v2__label">Active</span>
                    <strong class="stat-card-v2__value" id="statActive">—</strong>
                    <span class="stat-card-v2__icon" aria-hidden="true">
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M20 6L9 17l-5-5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
                    </span>
                    <svg class="stat-card-v2__spark" viewBox="0 0 72 28" fill="none"><path d="M2 20 L16 16 L30 12 L44 10 L70 6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
                </article>
                <article class="stat-card-v2 stat-card-v2--blue">
                    <span class="stat-card-v2__label">Approved</span>
                    <strong class="stat-card-v2__value" id="statApproved">—</strong>
                    <span class="stat-card-v2__icon" aria-hidden="true">
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke="currentColor" stroke-width="1.5"/></svg>
                    </span>
                    <svg class="stat-card-v2__spark" viewBox="0 0 72 28" fill="none"><path d="M2 18 L20 14 L36 16 L52 10 L70 8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
                </article>
            </section>

            <section class="records-panel records-panel--dash">
                <div class="records-panel__head dash-panel__head">
                    <div>
                        <h2 class="records-panel__title">All records</h2>
                        <p runat="server" id="recordsPanelHint" class="records-panel__hint">View and manage all RFID card assignments in the system.</p>
                    </div>
                    <div id="recordsDtToolbar" class="dash-dt-toolbar"></div>
                </div>
                <div id="recordsAlert" class="records-alert is-hidden" role="alert"></div>
                <div class="records-table-wrap">
                    <table id="recordsTable" class="display records-table" style="width:100%;">
                        <thead>
                            <% if (IsFamilyView) { %>
                            <tr>
                                <th>ID</th>
                                <th>Employee ID</th>
                                <th>Card name</th>
                                <th>Relationship</th>
                                <th>RFID number</th>
                                <th>Issue date</th>
                                <th>Issued by</th>
                                <th>Approved</th>
                                <th>Created</th>
                                <th>Status</th>
                                <th>Status remarks</th>
                                <th data-orderable="false">Actions</th>
                            </tr>
                            <% } else { %>
                            <tr>
                                <th>ID</th>
                                <th>Employee ID</th>
                                <th>RFID number</th>
                                <th>Issue date</th>
                                <th>Issued by</th>
                                <th>Approved</th>
                                <th>Created</th>
                                <th>Status</th>
                                <th>Status remarks</th>
                                <th data-orderable="false">Actions</th>
                            </tr>
                            <% } %>
                        </thead>
                        <tbody></tbody>
                    </table>
                </div>
            </section>
        </main>

        <div id="detailModal" class="detail-modal is-hidden" role="dialog" aria-modal="true" aria-labelledby="detailModalTitle">
            <div class="detail-modal__backdrop" id="detailBackdrop"></div>
            <div class="detail-modal__sheet detail-modal__sheet--fit">
                <button type="button" class="detail-modal__close" id="detailClose" aria-label="Close">&times;</button>
                <div class="detail-modal__body" id="detailBody">
                    <p class="detail-loading">Loading…</p>
                </div>
                <footer class="detail-modal__foot">
                    <button type="button" class="btn btn-ghost" id="detailCloseFoot">Close</button>
                </footer>
            </div>
        </div>
        <span id="detailModalTitle" class="visually-hidden">Record details</span>

        <div id="printCardModal" class="detail-modal is-hidden" role="dialog" aria-modal="true" aria-labelledby="printCardModalTitle">
            <div class="detail-modal__backdrop" id="printCardBackdrop"></div>
            <div class="detail-modal__sheet detail-modal__sheet--print">
                <button type="button" class="detail-modal__close detail-modal__close--hero" id="printCardClose" aria-label="Close">&times;</button>
                <div class="detail-modal__body" id="printCardBody">
                    <p class="detail-loading">Loading…</p>
                </div>
                <footer class="detail-modal__foot detail-modal__foot--split">
                    <button type="button" class="btn btn-primary" id="btnSavePrintAssignment">Save assignment</button>
                    <button type="button" class="btn btn-primary" id="btnPrintCardPreview">Print card</button>
                    <button type="button" class="btn btn-ghost" id="printCardCloseFoot">Close</button>
                </footer>
            </div>
        </div>
        <span id="printCardModalTitle" class="visually-hidden">Print card preview</span>

        <div id="statusChangeModal" class="detail-modal status-change-modal is-hidden" role="dialog" aria-modal="true" aria-labelledby="statusChangeTitle">
            <div class="detail-modal__backdrop" id="statusChangeBackdrop"></div>
            <div class="detail-modal__sheet detail-modal__sheet--status">
                <button type="button" class="detail-modal__close" id="statusChangeClose" aria-label="Close">&times;</button>
                <header class="status-change-modal__head">
                    <div class="status-change-modal__icon" aria-hidden="true">
                        <svg viewBox="0 0 48 48" width="40" height="40" fill="none">
                            <circle cx="24" cy="24" r="20" stroke="currentColor" stroke-width="2" opacity="0.35"/>
                            <path d="M16 24h16M24 16v16" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
                        </svg>
                    </div>
                    <p class="status-change-modal__eyebrow">Record status</p>
                    <h2 id="statusChangeTitle" class="status-change-modal__title">Change status</h2>
                    <p class="status-change-modal__sub" id="statusChangeSub">Record — · Employee —</p>
                </header>
                <div class="status-change-modal__transition" aria-live="polite">
                    <span id="statusChangeFrom" class="status-change-badge status-change-badge--inactive">Inactive</span>
                    <span class="status-change-arrow" aria-hidden="true">
                        <svg viewBox="0 0 24 24" width="20" height="20" fill="none"><path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
                    </span>
                    <span id="statusChangeTo" class="status-change-badge status-change-badge--active">Active</span>
                </div>
                <div class="detail-modal__body status-change-modal__body">
                    <label class="status-change-label" for="statusChangeRemarks">Remarks <span class="status-change-req">Required</span></label>
                    <textarea id="statusChangeRemarks" class="status-change-textarea" rows="4" maxlength="500" placeholder="Brief reason for activating or deactivating this card…"></textarea>
                    <p class="status-change-hint">This note is saved with the record and shown in the Status remarks column.</p>
                    <p id="statusChangeError" class="status-change-error is-hidden" role="alert"></p>
                </div>
                <footer class="detail-modal__foot detail-modal__foot--split status-change-modal__foot">
                    <button type="button" class="btn btn-primary" id="btnConfirmStatusChange">Confirm change</button>
                    <button type="button" class="btn btn-ghost" id="statusChangeCancel">Cancel</button>
                </footer>
            </div>
        </div>

        <div id="editModal" class="detail-modal is-hidden" role="dialog" aria-modal="true" aria-labelledby="editModalTitle">
            <div class="detail-modal__backdrop" id="editBackdrop"></div>
            <div class="detail-modal__sheet detail-modal__sheet--edit">
                <button type="button" class="detail-modal__close" id="editClose" aria-label="Close">&times;</button>
                <header class="edit-modal__head">
                    <p class="edit-modal__eyebrow" id="editModalEyebrow">Edit employee profile</p>
                    <h2 id="editModalTitle" class="edit-modal__title">Employee</h2>
                    <p class="edit-modal__sub" id="editModalSub">Record —</p>
                </header>
                <div class="detail-modal__body edit-modal__body">
                    <div class="edit-employee-layout">
                        <div class="edit-employee-photo">
                            <div class="edit-employee-photo__frame" id="editPhotoFrame">
                                <img id="editPhotoImg" class="edit-employee-photo__img is-hidden" alt="" />
                                <div id="editPhotoPh" class="edit-employee-photo__ph" aria-hidden="true">
                                    <svg viewBox="0 0 24 24" width="36" height="36" fill="none">
                                        <circle cx="12" cy="9" r="3.5" stroke="currentColor" stroke-width="1.5"/>
                                        <path d="M5 20c1.2-3 3.4-4.5 7-4.5s5.8 1.5 7 4.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                                    </svg>
                                </div>
                            </div>
                            <label class="edit-employee-photo__browse">
                                Change photo
                                <input type="file" id="editPhotoFile" accept="image/*" class="visually-hidden" />
                            </label>
                            <p id="editPhotoHint" class="edit-employee-photo__hint">JPG or PNG</p>
                        </div>
                        <div class="edit-employee-fields">
                            <input type="hidden" id="editRecordId" value="" />
                            <input type="hidden" id="editPhotoPath" value="" />
                            <div id="editEmployeeFieldsPanel">
                                <div class="edit-field">
                                    <label for="editEmpId">Employee ID</label>
                                    <input type="text" id="editEmpId" class="edit-input edit-input--readonly" readonly="readonly" />
                                </div>
                                <div class="edit-field">
                                    <label for="editName">Name</label>
                                    <input type="text" id="editName" class="edit-input" maxlength="100" placeholder="Full name" />
                                </div>
                                <div class="edit-field">
                                    <label for="editDesignation">Designation</label>
                                    <input type="text" id="editDesignation" class="edit-input" maxlength="100" placeholder="Job title" />
                                </div>
                                <div class="edit-field">
                                    <label for="editDepartment">Department</label>
                                    <input type="text" id="editDepartment" class="edit-input" maxlength="100" placeholder="Department" />
                                </div>
                                <div class="edit-field edit-field--full">
                                    <label for="editProject">Project / Location</label>
                                    <input type="text" id="editProject" class="edit-input" maxlength="100" placeholder="Site or city" />
                                </div>
                                <div class="edit-field">
                                    <label for="editJoiningDate">Joining date</label>
                                    <input type="date" id="editJoiningDate" class="edit-input" />
                                </div>
                                <div class="edit-field">
                                    <label for="editBloodGroup">Blood group</label>
                                    <input type="text" id="editBloodGroup" class="edit-input" maxlength="20" placeholder="e.g. O+" />
                                </div>
                                <div class="edit-field">
                                    <label for="editCnic">CNIC</label>
                                    <input type="text" id="editCnic" class="edit-input" maxlength="20" placeholder="12345-1234567-1" />
                                </div>
                                <div class="edit-field">
                                    <label for="editEmergencyNo">Emergency #</label>
                                    <input type="text" id="editEmergencyNo" class="edit-input" maxlength="30" placeholder="Contact number" />
                                </div>
                            </div>
                            <div id="editFamilyFieldsPanel" class="is-hidden">
                                <div class="edit-field">
                                    <label for="editFamilyEmpId">Employee ID</label>
                                    <input type="text" id="editFamilyEmpId" class="edit-input edit-input--readonly" readonly="readonly" />
                                </div>
                                <div class="edit-field">
                                    <label for="editFamilyCardName">Card holder name <span class="req">*</span></label>
                                    <input type="text" id="editFamilyCardName" class="edit-input" maxlength="100" placeholder="As on card" />
                                </div>
                                <div class="edit-field">
                                    <label for="editFamilyRelationship">Relationship <span class="req">*</span></label>
                                    <select id="editFamilyRelationship" class="edit-input">
                                        <option value="">Select...</option>
                                        <option value="SPOUSE">Spouse</option>
                                        <option value="SON">Son</option>
                                        <option value="DAUGHTER">Daughter</option>
                                        <option value="FATHER">Father</option>
                                        <option value="MOTHER">Mother</option>
                                        <option value="BROTHER">Brother</option>
                                        <option value="SISTER">Sister</option>
                                        <option value="OTHER">Other</option>
                                    </select>
                                </div>
                                <div class="edit-field">
                                    <label for="editFamilyCnic">CNIC</label>
                                    <input type="text" id="editFamilyCnic" class="edit-input" maxlength="20" placeholder="42101-5200244-8" />
                                </div>
                                <div class="edit-field">
                                    <label for="editFamilyCardId">Card ID</label>
                                    <input type="text" id="editFamilyCardId" class="edit-input edit-input--readonly" readonly="readonly" />
                                </div>
                            </div>
                        </div>
                    </div>
                    <p id="editFormError" class="edit-form-error is-hidden" role="alert"></p>
                </div>
                <footer class="detail-modal__foot detail-modal__foot--split">
                    <button type="button" class="btn btn-primary" id="btnSaveEdit">Save changes</button>
                    <button type="button" class="btn btn-ghost" id="editCloseFoot">Cancel</button>
                </footer>
            </div>
        </div>

        <div id="newRequestModal" class="detail-modal new-request-modal is-hidden" role="dialog" aria-modal="true" aria-labelledby="newRequestHeroTitle">
            <div class="detail-modal__backdrop" id="newRequestBackdrop"></div>
            <div class="detail-modal__sheet detail-modal__sheet--new-request detail-modal__sheet--fit">
                <button type="button" class="detail-modal__close detail-modal__close--hero" id="newRequestClose" aria-label="Close">&times;</button>
                <div class="detail-modal__body new-request-modal__body">
                    <uc:RfidNewRequestForm runat="server" />
                </div>
                <footer class="detail-modal__foot new-request-modal__foot">
                    <div class="new-request-meter">
                        <div class="meter-row">
                            <span class="meter-title">Before you can save</span>
                            <strong id="meterCount">0 of 4 done</strong>
                        </div>
                        <div class="meter-seg" id="meterSeg" aria-hidden="true">
                            <span></span><span></span><span></span><span></span>
                        </div>
                        <ul class="checks checks--grid checks--compact checks--foot-inline" id="checkList">
                            <li data-check="emp"><span class="check-ico" aria-hidden="true"></span>Emp ID</li>
                            <li data-check="status"><span class="check-ico" aria-hidden="true"></span>Status</li>
                            <li data-check="issue"><span class="check-ico" aria-hidden="true"></span>Issue</li>
                            <li data-check="extra"><span class="check-ico" aria-hidden="true"></span>Extra</li>
                        </ul>
                    </div>
                    <div class="new-request-modal__actions">
                        <button type="button" id="btnClear" class="btn btn-ghost">Clear</button>
                        <button type="button" id="btnNewRequestSave" class="btn btn-primary btn-icon-save">Save record</button>
                        <button type="button" class="btn btn-ghost" id="newRequestCloseFoot">Close</button>
                    </div>
                </footer>
            </div>
        </div>

        <div id="captchaModal" class="captcha-modal is-hidden" role="dialog" aria-modal="true" aria-labelledby="captchaTitle">
            <div class="captcha-modal__backdrop" id="captchaBackdrop"></div>
            <div class="captcha-modal__box">
                <h3 id="captchaTitle" class="captcha-modal__title">Verify before saving</h3>
                <p class="captcha-modal__sub">Answer the question below to submit this record.</p>
                <p class="captcha-modal__question" id="captchaQuestion">—</p>
                <label class="captcha-modal__label" for="captchaInput">Your answer</label>
                <input type="text" id="captchaInput" class="captcha-modal__input" inputmode="numeric" autocomplete="off" maxlength="3" />
                <p id="captchaError" class="captcha-modal__error" hidden="hidden"></p>
                <div class="captcha-modal__actions">
                    <button type="button" class="btn btn-ghost" id="captchaCancel">Cancel</button>
                    <button type="button" class="btn btn-primary btn-icon-save" id="captchaConfirm">Save Record</button>
                </div>
            </div>
        </div>
        </div>

        <script>window.RFID_APP_ROOT = '<%= ResolveUrl("~/") %>';</script>
        <script>window.RFID_PERMISSIONS = <%= PermissionsJson ?? "{}" %>;</script>
        <script>window.RFID_RECORD_SCOPE = '<%= RecordScope ?? "employee" %>';</script>
        <script src="https://code.jquery.com/jquery-3.7.1.min.js"></script>
        <script src="https://cdn.datatables.net/1.13.8/js/jquery.dataTables.min.js"></script>
        <script src="Scripts/rfid-photos.js"></script>
        <script src="https://cdn.jsdelivr.net/npm/sweetalert2@11"></script>
        <script src="Scripts/rfid-form.js?v=11"></script>
        <script src="Scripts/rfid-records.js?v=20"></script>
    </form>
</body>
</html>
