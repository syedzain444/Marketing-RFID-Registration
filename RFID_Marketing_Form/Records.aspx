<%@ Page Language="C#" AutoEventWireup="true" Inherits="System.Web.UI.Page" ClientIDMode="Static" %>

<!DOCTYPE html>
<html lang="en" class="records-root">
<head runat="server">
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>RFID Records</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
    <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@500&amp;family=Inter:wght@400;500;600;700&amp;display=swap" rel="stylesheet" />
    <link href="https://cdn.datatables.net/1.13.8/css/jquery.dataTables.min.css" rel="stylesheet" />
    <link href="Content/rfid.css" rel="stylesheet" />
    <link href="Site.css" rel="stylesheet" />
    <link href="Content/rfid-records.css" rel="stylesheet" />
</head>
<body class="records-page">
    <form id="form1">
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
                    <h1>RFID Records</h1>
                    <p class="subtitle">Browse saved card assignments from <span id="recordsTableLabel" class="mono-soft">—</span></p>
                </div>
            </div>
            <div class="actions">
                <a href="Default.aspx" class="btn btn-ghost">New request</a>
                <button type="button" id="btnRefreshRecords" class="btn btn-primary">Refresh</button>
            </div>
        </header>

        <main class="records-main">
            <section class="records-stats" id="recordsStats" aria-live="polite">
                <article class="stat-card">
                    <span class="stat-card__label">Total records</span>
                    <strong class="stat-card__value" id="statTotal">—</strong>
                </article>
                <article class="stat-card stat-card--accent">
                    <span class="stat-card__label">Active</span>
                    <strong class="stat-card__value" id="statActive">—</strong>
                </article>
                <article class="stat-card">
                    <span class="stat-card__label">Approved</span>
                    <strong class="stat-card__value" id="statApproved">—</strong>
                </article>
            </section>

            <section class="records-panel">
                <div class="records-panel__head">
                    <h2 class="records-panel__title">All records</h2>
                    <p class="records-panel__hint">Search, sort, and open full details for any row.</p>
                </div>
                <div id="recordsAlert" class="records-alert is-hidden" role="alert"></div>
                <div class="records-table-wrap">
                    <table id="recordsTable" class="display records-table" style="width:100%;">
                        <thead>
                            <tr>
                                <th>ID</th>
                                <th>Employee ID</th>
                                <th>RFID number</th>
                                <th>Issue date</th>
                                <th>Issued by</th>
                                <th>Approved</th>
                                <th>Created</th>
                                <th>Status</th>
                                <th data-orderable="false">Actions</th>
                            </tr>
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
                <button type="button" class="detail-modal__close" id="printCardClose" aria-label="Close">&times;</button>
                <div class="detail-modal__body" id="printCardBody">
                    <p class="detail-loading">Loading…</p>
                </div>
                <footer class="detail-modal__foot detail-modal__foot--split">
                    <button type="button" class="btn btn-primary" id="btnPrintCardPreview">Print card</button>
                    <button type="button" class="btn btn-ghost" id="printCardCloseFoot">Close</button>
                </footer>
            </div>
        </div>
        <span id="printCardModalTitle" class="visually-hidden">Print card preview</span>

        <div id="editModal" class="detail-modal is-hidden" role="dialog" aria-modal="true" aria-labelledby="editModalTitle">
            <div class="detail-modal__backdrop" id="editBackdrop"></div>
            <div class="detail-modal__sheet detail-modal__sheet--edit">
                <button type="button" class="detail-modal__close" id="editClose" aria-label="Close">&times;</button>
                <header class="edit-modal__head">
                    <p class="edit-modal__eyebrow">Edit employee profile</p>
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
                    </div>
                    <p id="editFormError" class="edit-form-error is-hidden" role="alert"></p>
                </div>
                <footer class="detail-modal__foot detail-modal__foot--split">
                    <button type="button" class="btn btn-primary" id="btnSaveEdit">Save changes</button>
                    <button type="button" class="btn btn-ghost" id="editCloseFoot">Cancel</button>
                </footer>
            </div>
        </div>

        <script>window.RFID_APP_ROOT = '<%= ResolveUrl("~/") %>';</script>
        <script src="https://code.jquery.com/jquery-3.7.1.min.js"></script>
        <script src="https://cdn.datatables.net/1.13.8/js/jquery.dataTables.min.js"></script>
        <script src="Scripts/rfid-photos.js"></script>
        <script src="Scripts/rfid-records.js"></script>
    </form>
</body>
</html>
