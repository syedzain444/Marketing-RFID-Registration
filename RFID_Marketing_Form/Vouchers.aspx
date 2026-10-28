<%@ Page Language="C#" AutoEventWireup="true" CodeBehind="Vouchers.aspx.cs" Inherits="RFID_Marketing_Form.VouchersPage" ClientIDMode="Static" %>
<%@ Register Src="~/Controls/MarketingSidebar.ascx" TagPrefix="uc" TagName="MarketingSidebar" %>

<!DOCTYPE html>
<html lang="en" class="records-root vouchers-root">
<head runat="server">
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Payment vouchers</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@500&amp;family=Inter:wght@400;500;600;700&amp;family=Noto+Nastaliq+Urdu:wght@400;700&amp;display=swap" rel="stylesheet" />
    <link href="https://cdn.datatables.net/1.13.8/css/jquery.dataTables.min.css" rel="stylesheet" />
    <link href="Content/rfid.css" rel="stylesheet" />
    <link href="Content/marketing-sidebar.css?v=4" rel="stylesheet" />
    <link href="Content/marketing-wide.css?v=1" rel="stylesheet" />
    <link href="Content/rfid-records.css?v=11" rel="stylesheet" />
    <link href="Content/vouchers.css?v=1" rel="stylesheet" />
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
                            <rect x="5" y="7" width="22" height="18" rx="2" stroke="currentColor" stroke-width="1.6"/>
                            <path d="M8 12h16M8 16h10" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
                        </svg>
                    </span>
                    <span class="brand-divider" aria-hidden="true"></span>
                    <div class="brand-text">
                        <h1>Payment vouchers</h1>
                        <p class="subtitle">Track generated slips and mark paid or unpaid from <span class="mono-soft">CARD_VOUCHERS</span>.</p>
                    </div>
                </div>
                <div class="actions dashboard-actions">
                    <span class="dashboard-user" id="vouchersUserLabel" runat="server"></span>
                    <a href="MarketingLogout.aspx" class="btn-dash">Sign out</a>
                    <button type="button" id="btnRefreshVouchers" class="btn-dash btn-dash--primary">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M20 12a8 8 0 1 1-2.34-5.66M20 4v6h-6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>
                        Refresh
                    </button>
                </div>
            </header>

            <main class="records-main">
                <section class="records-stats" aria-live="polite">
                    <article class="stat-card-v2 stat-card-v2--teal">
                        <span class="stat-card-v2__label">Total vouchers</span>
                        <strong class="stat-card-v2__value" id="statVoucherTotal">—</strong>
                    </article>
                    <article class="stat-card-v2 stat-card-v2--green">
                        <span class="stat-card-v2__label">Paid</span>
                        <strong class="stat-card-v2__value" id="statVoucherPaid">—</strong>
                    </article>
                    <article class="stat-card-v2 stat-card-v2--blue">
                        <span class="stat-card-v2__label">Unpaid</span>
                        <strong class="stat-card-v2__value" id="statVoucherUnpaid">—</strong>
                    </article>
                    <article class="stat-card-v2 stat-card-v2--teal">
                        <span class="stat-card-v2__label">Total cards</span>
                        <strong class="stat-card-v2__value" id="statVoucherCards">—</strong>
                    </article>
                </section>

                <section class="records-panel records-panel--dash">
                    <div class="records-panel__head dash-panel__head vouchers-panel__head">
                        <div>
                            <h2 class="records-panel__title">All vouchers</h2>
                            <p class="records-panel__hint">Status is stored in Oracle column <code>STATUS</code> (GENERATED = unpaid, PAID).</p>
                        </div>
                        <div class="voucher-filter-chips" role="tablist" aria-label="Filter by status">
                            <button type="button" class="voucher-chip is-active" data-filter="all">All</button>
                            <button type="button" class="voucher-chip" data-filter="generated">Unpaid</button>
                            <button type="button" class="voucher-chip" data-filter="paid">Paid</button>
                        </div>
                    </div>
                    <div id="vouchersAlert" class="records-alert is-hidden" role="alert"></div>
                    <div class="records-table-wrap">
                        <table id="vouchersTable" class="display records-table" style="width:100%;">
                            <thead>
                                <tr>
                                    <th>ID</th>
                                    <th>Voucher no.</th>
                                    <th>Name</th>
                                    <th>Amount</th>
                                    <th>Scope</th>
                                    <th>Cards</th>
                                    <th>Status</th>
                                    <th>Generated</th>
                                    <th>Paid</th>
                                    <th data-orderable="false">Actions</th>
                                </tr>
                            </thead>
                            <tbody></tbody>
                        </table>
                    </div>
                </section>
            </main>
        </div>

        <div id="voucherPreviewModal" class="detail-modal voucher-modal is-hidden" role="dialog" aria-modal="true">
            <div class="detail-modal__backdrop" id="voucherPreviewBackdrop"></div>
            <div class="detail-modal__sheet detail-modal__sheet--voucher">
                <button type="button" class="detail-modal__close detail-modal__close--hero" id="voucherPreviewClose" aria-label="Close">&times;</button>
                <header class="voucher-modal__head voucher-modal__head--split no-print-voucher">
                    <div class="voucher-modal__head-main">
                        <p class="voucher-modal__eyebrow">Payment voucher</p>
                        <h2 class="voucher-modal__title" id="voucherPreviewTitle">Bahria Town Karachi</h2>
                        <p class="voucher-modal__sub" id="voucherPreviewSub">—</p>
                    </div>
                    <div class="voucher-modal__head-actions">
                        <span id="voucherPreviewStatus" class="voucher-status-badge voucher-status-badge--generated">Unpaid</span>
                        <button type="button" class="btn btn-primary" id="btnVoucherPreviewPrint">Print / PDF</button>
                    </div>
                </header>
                <div class="detail-modal__body voucher-modal__body" id="voucherPreviewBody"></div>
                <footer class="detail-modal__foot voucher-modal__foot no-print-voucher">
                    <button type="button" class="btn btn-ghost" id="voucherPreviewCloseFoot">Close</button>
                </footer>
            </div>
        </div>

        <div id="voucherStatusModal" class="detail-modal status-change-modal voucher-status-modal is-hidden" role="dialog" aria-modal="true">
            <div class="detail-modal__backdrop" id="voucherStatusBackdrop"></div>
            <div class="detail-modal__sheet detail-modal__sheet--status">
                <button type="button" class="detail-modal__close" id="voucherStatusClose" aria-label="Close">&times;</button>
                <header class="status-change-modal__head voucher-status-modal__head">
                    <p class="status-change-modal__eyebrow">Voucher payment</p>
                    <h2 class="status-change-modal__title" id="voucherStatusTitle">Update status</h2>
                    <p class="status-change-modal__sub" id="voucherStatusSub">—</p>
                </header>
                <div class="voucher-status-modal__transition" aria-live="polite">
                    <span id="voucherStatusFrom" class="voucher-status-badge voucher-status-badge--generated">Unpaid</span>
                    <span class="status-change-arrow" aria-hidden="true">
                        <svg viewBox="0 0 24 24" width="20" height="20" fill="none"><path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
                    </span>
                    <span id="voucherStatusTo" class="voucher-status-badge voucher-status-badge--paid">Paid</span>
                </div>
                <p id="voucherStatusError" class="status-change-error is-hidden" role="alert"></p>
                <footer class="detail-modal__foot status-change-modal__foot">
                    <button type="button" class="btn btn-primary" id="btnConfirmVoucherStatus">Confirm</button>
                    <button type="button" class="btn btn-ghost" id="voucherStatusCancel">Cancel</button>
                </footer>
            </div>
        </div>

        <script>window.RFID_APP_ROOT = '<%= ResolveUrl("~/") %>';</script>
        <script>window.VOUCHER_PERMISSIONS = <%= PermissionsJson ?? "{}" %>;</script>
        <script src="https://code.jquery.com/jquery-3.7.1.min.js"></script>
        <script src="https://cdn.datatables.net/1.13.8/js/jquery.dataTables.min.js"></script>
        <script src="https://cdn.jsdelivr.net/npm/sweetalert2@11"></script>
        <script src="Scripts/rfid-voucher-render.js?v=1"></script>
        <script src="Scripts/vouchers.js?v=4"></script>
    </form>
</body>
</html>
