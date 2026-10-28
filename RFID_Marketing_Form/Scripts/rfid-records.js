(function () {
    "use strict";

    var table = null;
    var cachedRows = [];
    var cachedAllRows = [];
    var assignStatusTab = "assigned";
    var statusChangeCtx = null;
    var printModalScope = "employee";

    function isFamilyRecordsScope() {
        return (window.RFID_RECORD_SCOPE || "employee") === "family";
    }

    function isAssignRecordsScope() {
        return (window.RFID_RECORD_SCOPE || "employee") === "assign";
    }

    function isToggleableRecordStatus(status) {
        var s = (status || "").toLowerCase();
        return s === "active" || s === "inactive";
    }

    function recordField(record, name) {
        if (!record || !name) return "";
        if (record[name] != null && String(record[name]).trim()) return String(record[name]).trim();
        var camel = name.charAt(0).toLowerCase() + name.slice(1);
        if (record[camel] != null && String(record[camel]).trim()) return String(record[camel]).trim();
        return "";
    }

    function parseGradeNumber(value) {
        var digits = String(value || "").replace(/[^\d]/g, "");
        if (!digits) return 0;
        var n = parseInt(digits, 10);
        return isNaN(n) ? 0 : n;
    }

    /** V_EMPS GRD_AB / GRD_ID: grade &gt; 5 → OFFICIAL, else EMPLOYEE (EmpCard rule). */
    function resolveCardGradeBadge(record) {
        var fromApi = recordField(record, "CardBadge");
        if (fromApi) return fromApi.toUpperCase();
        var gradeNum = parseGradeNumber(recordField(record, "Grade"));
        if (gradeNum <= 0) {
            gradeNum = parseGradeNumber(recordField(record, "GradeId"));
        }
        return gradeNum > 5 ? "OFFICIAL" : "EMPLOYEE";
    }

    function perms() {
        return window.RFID_PERMISSIONS || {};
    }

    function can(key) {
        var p = perms();
        return p[key] === true;
    }

    function esc(text) {
        if (text == null) return "";
        return String(text)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;");
    }

    var svgView = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" stroke="currentColor" stroke-width="1.6"/><circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="1.6"/></svg>';
    var svgEdit = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>';
    var svgPrint = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" stroke="currentColor" stroke-width="1.6"/><rect x="6" y="14" width="12" height="8" stroke="currentColor" stroke-width="1.6"/></svg>';
    var svgPdf = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 3v12m0 0l4-4m-4 4L8 11" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>';
    var svgMore = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="6" r="1.5" fill="currentColor"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/><circle cx="12" cy="18" r="1.5" fill="currentColor"/></svg>';
    var svgVoucher =
        '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">' +
        '<rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" stroke-width="1.6"/>' +
        '<path d="M7 9h10M7 13h6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>';

    var voucherCtx = null;

    function avatarColor(name) {
        var h = 0;
        var s = String(name || "");
        for (var i = 0; i < s.length; i++) {
            h = s.charCodeAt(i) + ((h << 5) - h);
        }
        var colors = ["#0a7a62", "#2563eb", "#004d4d", "#e8882e", "#6d28d9", "#0891b2"];
        return colors[Math.abs(h) % colors.length];
    }

    function issuerCell(name) {
        var n = (name || "").trim();
        if (!n || n === "—") return "—";
        var initial = n.charAt(0).toUpperCase();
        return (
            '<span class="user-chip">' +
            '<span class="user-chip__avatar" style="background:' + avatarColor(n) + '">' + esc(initial) + "</span>" +
            '<span class="user-chip__name">' + esc(n) + "</span></span>"
        );
    }

    function moveRecordsDtToolbar() {
        var toolbar = document.getElementById("recordsDtToolbar");
        if (!toolbar || !table) return;
        var $wrap = $("#recordsTable").closest(".dataTables_wrapper");
        $wrap.find(".dataTables_length, .dataTables_filter").appendTo(toolbar);
        var $input = $wrap.find(".dataTables_filter input");
        if ($input.length) {
            $input.attr("placeholder", "Search by name, ID or RFID tag");
        }
    }

    function apiOk(payload) {
        return payload && (payload.Ok === true || payload.ok === true);
    }

    function apiError(payload) {
        if (!payload) return "";
        return payload.Error || payload.error || "";
    }

    function recordsApiUrl(query) {
        var url = "RfidRecords.ashx" + (query ? "?" + query : "");
        if (isFamilyRecordsScope()) {
            url += (url.indexOf("?") >= 0 ? "&" : "?") + "scope=family";
        } else if (isAssignRecordsScope()) {
            url += (url.indexOf("?") >= 0 ? "&" : "?") + "scope=assign";
        }
        return url;
    }

    function fetchJson(url, options) {
        var opts = options || {};
        if (!opts.credentials) {
            opts.credentials = "same-origin";
        }
        return fetch(url, opts).then(function (res) {
            return res.text().then(function (text) {
                if (!text || !text.trim()) {
                    throw new Error("Empty response from server.");
                }
                var payload;
                try {
                    payload = JSON.parse(text);
                } catch (e) {
                    if (text.indexOf("<html") >= 0 && text.indexOf("MarketingLogin") >= 0) {
                        throw new Error("Your session expired. Sign in again and retry.");
                    }
                    throw new Error("Could not read server response. Rebuild the site and try again.");
                }
                if (!payload || payload.Ok !== true) {
                    var msg = (payload && (payload.Error || payload.error)) || "Server error (" + res.status + ").";
                    throw new Error(msg);
                }
                return payload;
            });
        });
    }

    function showAlert(message, isError) {
        var el = document.getElementById("recordsAlert");
        if (!el) return;
        el.textContent = message || "";
        el.classList.toggle("is-hidden", !message);
        el.classList.toggle("is-error", !!isError);
    }

    function isActiveStatus(status) {
        return (status || "").toLowerCase() === "active";
    }

    function isInactiveStatus(status) {
        return (status || "").toLowerCase() === "inactive";
    }

    function normalizeAssignTab(tab) {
        if (tab === "inactive" || tab === "unassigned") {
            return "unassigned";
        }
        return "assigned";
    }

    /** Assigned tab: saved in RFID_CARD_ASSIGN (e.g. 25258). Unassigned tab: V_EMPS only, ID — (e.g. 21543). */
    function assignRowOnAssignedTab(record) {
        return assignHasSavedRecord(record);
    }

    function assignRowOnUnassignedTab(record) {
        return !assignHasSavedRecord(record);
    }

    function filterAssignRowsByTab(rows, tab) {
        rows = rows || [];
        tab = normalizeAssignTab(tab || assignStatusTab);
        if (tab === "unassigned") {
            return rows.filter(assignRowOnUnassignedTab);
        }
        return rows.filter(assignRowOnAssignedTab);
    }

    function syncAssignTabFilteredRows() {
        if (!isAssignRecordsScope()) {
            return;
        }
        cachedRows = filterAssignRowsByTab(cachedAllRows);
    }

    function updateAssignTabCounts(rows) {
        if (!isAssignRecordsScope()) {
            return;
        }
        var activeEl = document.getElementById("assignTabActiveCount");
        var inactiveEl = document.getElementById("assignTabInactiveCount");
        if (!activeEl && !inactiveEl) {
            return;
        }
        var source = rows || cachedAllRows;
        if (!source || !source.length) {
            if (activeEl) activeEl.textContent = "0";
            if (inactiveEl) inactiveEl.textContent = "0";
            return;
        }
        var assigned = 0;
        var unassigned = 0;
        for (var i = 0; i < source.length; i++) {
            if (assignRowOnUnassignedTab(source[i])) {
                unassigned++;
            } else if (assignRowOnAssignedTab(source[i])) {
                assigned++;
            }
        }
        if (activeEl) activeEl.textContent = String(assigned);
        if (inactiveEl) inactiveEl.textContent = String(unassigned);
    }

    function updateAssignPanelTitleForTab() {
        if (!isAssignRecordsScope()) {
            return;
        }
        var title = document.querySelector(".records-panel__title");
        var hint = document.getElementById("recordsPanelHint");
        if (normalizeAssignTab(assignStatusTab) === "unassigned") {
            if (title) title.textContent = "Inactive records";
            if (hint) {
                hint.textContent =
                    "Active employees with no RFID_CARD_ASSIGN row yet (ID —). Enter RFID here or open Print card; saving creates the assignment.";
            }
        } else {
            if (title) title.textContent = "Active records";
            if (hint) {
                hint.textContent =
                    "Employees with an active RFID assignment on file (ID, status Active). Update RFID on the grid or use Print / voucher actions.";
            }
        }
    }

    function setAssignStatusTab(tab) {
        if (!isAssignRecordsScope()) {
            return;
        }
        assignStatusTab = normalizeAssignTab(tab);
        document.querySelectorAll(".assign-records-tab").forEach(function (btn) {
            var on = normalizeAssignTab(btn.getAttribute("data-assign-tab")) === assignStatusTab;
            btn.classList.toggle("is-active", on);
            btn.setAttribute("aria-selected", on ? "true" : "false");
        });
        updateAssignPanelTitleForTab();
        syncAssignTabFilteredRows();
        refreshTableFromCache();
    }

    function statusBadge(status) {
        var s = (status || "").toLowerCase();
        if (s === "active") return '<span class="badge badge--active">Active</span>';
        if (s === "inactive") return '<span class="badge badge--inactive">Inactive</span>';
        return '<span class="badge badge--muted">' + esc(status || "—") + "</span>";
    }

    function assignRecordId(record) {
        if (!record) {
            return null;
        }
        var raw = record.Id != null ? record.Id : record.id;
        if (raw == null || raw === "") {
            return null;
        }
        var id = String(raw).trim();
        if (!id || id === "0") {
            return null;
        }
        return id;
    }

    function assignHasSavedRecord(record) {
        return !!assignRecordId(record);
    }

    /** Assign grid: print allowed for Active or Inactive when RFID assignment row exists. */
    function assignGridPrintAllowed(record) {
        return isAssignRecordsScope() && assignHasSavedRecord(record);
    }

    function parseActionRecordId(raw) {
        if (raw == null) {
            return null;
        }
        var id = String(raw).trim();
        if (!id || id === "0") {
            return null;
        }
        return id;
    }

    function todayIsoDateLocal() {
        var d = new Date();
        var m = String(d.getMonth() + 1);
        var day = String(d.getDate());
        if (m.length < 2) m = "0" + m;
        if (day.length < 2) day = "0" + day;
        return d.getFullYear() + "-" + m + "-" + day;
    }

    /** Assign scope: card/grid issue date = RFID_CARD_ASSIGN.PRINT_DATE. */
    function assignPrintDateDisplay(record) {
        if (!record) return "";
        var printDt = recordField(record, "PrintDate");
        if (printDt) return printDt;
        return recordField(record, "IssueDate");
    }

    /** Assign preview/print: show today when no RFID assignment dates exist yet. */
    function assignCardIssueDateSource(record) {
        if (!record) return todayIsoDateLocal();
        var printDt = recordField(record, "PrintDate");
        if (printDt) return printDt;
        var issueDt = recordField(record, "IssueDate");
        if (issueDt) return issueDt;
        return todayIsoDateLocal();
    }

    function assignStatusDateDisplay(record) {
        if (!record) return "—";
        if (isAssignRecordsScope()) {
            var printAsIssue = assignPrintDateDisplay(record);
            if (isActiveStatus(record.Status)) {
                return printAsIssue || "—";
            }
            if ((record.Status || "").toLowerCase() === "inactive") {
                return record.ExpiryDate && String(record.ExpiryDate).trim()
                    ? record.ExpiryDate
                    : printAsIssue || "—";
            }
            return printAsIssue || "—";
        }
        if (isActiveStatus(record.Status)) {
            return record.IssueDate && String(record.IssueDate).trim() ? record.IssueDate : "—";
        }
        if ((record.Status || "").toLowerCase() === "inactive") {
            return record.ExpiryDate && String(record.ExpiryDate).trim()
                ? record.ExpiryDate
                : record.IssueDate && String(record.IssueDate).trim()
                  ? record.IssueDate
                  : "—";
        }
        return record.IssueDate && String(record.IssueDate).trim() ? record.IssueDate : "—";
    }

    function printCardButtonHtml(record) {
        if (!can("print")) {
            return "";
        }
        var active = isActiveStatus(record.Status);
        var recordId = assignRecordId(record);
        var idAttr = esc(recordId || recordField(record, "Id") || "0");
        var empAttr = esc(recordField(record, "EmpId") || "");
        if (isAssignRecordsScope()) {
            return (
                '<button type="button" class="btn-print-card" data-id="' + idAttr + '" data-emp-id="' + empAttr + '" ' +
                'title="Print card from V_EMPS employee profile">' +
                svgPrint +
                " Print Card</button>"
            );
        }
        if (!active) {
            return (
                '<button type="button" class="btn-print-card is-disabled" data-id="' + idAttr + '" disabled ' +
                'title="Print is only available for active records">' + svgPrint + " Print Card</button>"
            );
        }
        return '<button type="button" class="btn-print-card" data-id="' + idAttr + '">' + svgPrint + " Print Card</button>";
    }

    function voucherButtonHtml(record) {
        if (!can("view") && !can("print")) {
            return "";
        }
        if (isAssignRecordsScope() && !assignHasSavedRecord(record)) {
            return "";
        }
        return (
            '<button type="button" class="btn-voucher" data-id="' + esc(record.Id) + '">' + svgVoucher + " Voucher</button>"
        );
    }

    function canVoucherManage() {
        return can("voucherManage");
    }

    function updateVoucherStatusUi(v) {
        var vr = window.RfidVoucherRender;
        if (!vr) return;
        var status = (v && v.Status ? v.Status : "GENERATED").toUpperCase();
        var paid = status === "PAID";
        vr.applyStatusBadge(document.getElementById("voucherStatusBadge"), status);
        var dbStatus = document.getElementById("voucherDbStatus");
        if (dbStatus) {
            dbStatus.textContent = paid ? "PAID" : "GENERATED (unpaid)";
        }
        var btnPaid = document.getElementById("btnVoucherMarkPaid");
        var btnUnpaid = document.getElementById("btnVoucherMarkUnpaid");
        if (btnPaid) {
            btnPaid.classList.toggle("is-hidden", paid || !canVoucherManage());
            btnPaid.disabled = paid;
        }
        if (btnUnpaid) {
            btnUnpaid.classList.toggle("is-hidden", !paid || !canVoucherManage());
            btnUnpaid.disabled = !paid;
        }
    }

    function closeVoucherModal() {
        var modal = document.getElementById("voucherModal");
        if (modal) modal.classList.add("is-hidden");
        document.body.classList.remove("voucher-print-mode");
        voucherCtx = null;
        var othersOpen = ["detailModal", "printCardModal", "editModal", "statusChangeModal", "newRequestModal"].some(function (mid) {
            var m = document.getElementById(mid);
            return m && !m.classList.contains("is-hidden");
        });
        if (!othersOpen) document.body.style.overflow = "";
    }

    function showVoucher(recordId) {
        var body = document.getElementById("voucherBody");
        var sub = document.getElementById("voucherModalSub");
        if (body) body.innerHTML = '<p class="detail-loading">Loading voucher…</p>';
        document.getElementById("voucherModal").classList.remove("is-hidden");
        document.body.style.overflow = "hidden";
        fetchJson(recordsApiUrl("action=voucher&id=" + encodeURIComponent(recordId)))
            .then(function (payload) {
                var v = payload.Voucher;
                if (!v) throw new Error("Voucher data was not returned.");
                voucherCtx = { recordId: recordId, voucher: v };
                if (sub) {
                    sub.textContent =
                        (v.EmployeeName || "Record") +
                        " · " +
                        (v.VoucherNo || "") +
                        (v.GeneratedBy ? " · by " + v.GeneratedBy : "");
                }
                if (body && window.RfidVoucherRender) body.innerHTML = RfidVoucherRender.renderGrid(v);
                updateVoucherStatusUi(v);
            })
            .catch(function (err) {
                if (body) body.innerHTML = '<p class="detail-loading">' + esc(err.message || "Could not load voucher.") + "</p>";
                showAlert(err.message || "Could not load voucher.", true);
            });
    }

    function printVoucherPreview() {
        if (!window.RfidVoucherRender || !RfidVoucherRender.printFromContainer("#voucherBody .voucher-grid")) {
            showAlert("Nothing to print. Wait for the voucher to load.", true);
        }
    }

    function setVoucherStatusFromRecords(action) {
        if (!voucherCtx || !voucherCtx.voucher || !voucherCtx.voucher.VoucherId) return;
        var fd = new FormData();
        fd.append("action", action);
        fd.append("voucherId", String(voucherCtx.voucher.VoucherId));
        return fetchJson("RfidRecords.ashx", { method: "POST", body: fd }).then(function (payload) {
            if (!payload.Voucher) throw new Error("Update failed.");
            voucherCtx.voucher = payload.Voucher;
            updateVoucherStatusUi(payload.Voucher);
            showAlert(action === "vouchermarkpaid" ? "Marked as paid in database." : "Marked as unpaid in database.", false);
        });
    }

    function markVoucherPaid() {
        var btn = document.getElementById("btnVoucherMarkPaid");
        if (btn) btn.disabled = true;
        setVoucherStatusFromRecords("vouchermarkpaid").catch(function (err) {
            showAlert(err.message || "Could not update voucher.", true);
            if (btn) btn.disabled = false;
        });
    }

    function markVoucherUnpaid() {
        var btn = document.getElementById("btnVoucherMarkUnpaid");
        if (btn) btn.disabled = true;
        setVoucherStatusFromRecords("vouchermarkunpaid").catch(function (err) {
            showAlert(err.message || "Could not update voucher.", true);
            if (btn) btn.disabled = false;
        });
    }

    function setPrintButtonForRecord(id, active) {
        var btn = document.querySelector('.btn-print-card[data-id="' + id + '"]');
        if (!btn) return;
        if (isAssignRecordsScope()) {
            btn.disabled = false;
            btn.classList.remove("is-disabled");
            btn.removeAttribute("title");
            return;
        }
        btn.disabled = !active;
        btn.classList.toggle("is-disabled", !active);
        if (!active) {
            btn.setAttribute("title", "Print is only available for active records");
        } else {
            btn.removeAttribute("title");
        }
    }

    function statusPillHtml(record, interactive) {
        var active = isActiveStatus(record.Status);
        var id = esc(record.Id);
        var cls = "status-pill" + (active ? " status-pill--active" : "");
        var label = active ? "Active" : "Inactive";
        if (interactive) {
            return (
                '<button type="button" class="' + cls + ' status-pill-btn" data-id="' + id + '" data-active="' + (active ? "true" : "false") + '">' +
                label +
                "</button>"
            );
        }
        return '<span class="' + cls + '">' + label + "</span>";
    }

    function refreshPillBtn(btn, active) {
        if (!btn) return;
        btn.setAttribute("data-active", active ? "true" : "false");
        btn.classList.toggle("status-pill--active", active);
        btn.textContent = active ? "Active" : "Inactive";
        btn.setAttribute("aria-label", "Set record " + btn.getAttribute("data-id") + " " + (active ? "inactive" : "active"));
    }

    function statusToggleCell(record) {
        if (isAssignRecordsScope() && !isToggleableRecordStatus(record.Status)) {
            return statusBadge(record.Status);
        }
        var dash = document.body.classList.contains("dashboard-v2");
        if (dash) {
            return statusPillHtml(record, can("status") && isToggleableRecordStatus(record.Status));
        }
        if (!can("status")) {
            return statusBadge(record.Status);
        }
        var active = isActiveStatus(record.Status);
        var id = esc(record.Id);
        return (
            '<label class="status-switch' + (active ? " is-on" : "") + '" data-id="' + id + '" data-order="' + (active ? "1" : "0") + '">' +
            '<input type="checkbox" class="status-switch__input"' + (active ? " checked" : "") +
            ' aria-label="Set record ' + id + ' ' + (active ? "inactive" : "active") + '" />' +
            '<span class="status-switch__track" aria-hidden="true"><span class="status-switch__thumb"></span></span>' +
            '<span class="status-switch__label">' + (active ? "Active" : "Inactive") + "</span>" +
            "</label>"
        );
    }

    function approvedBadge(value) {
        var v = (value || "").toLowerCase();
        if (v === "yes") return '<span class="badge badge--yes">Yes</span>';
        if (v === "no") return '<span class="badge badge--no">No</span>';
        return '<span class="badge badge--muted">—</span>';
    }

    function statusRemarksCell(text) {
        var t = String(text || "").trim();
        if (!t) return '<span class="status-remarks-empty">—</span>';
        var short = t.length > 56 ? t.slice(0, 53) + "…" : t;
        return '<span class="status-remarks-cell" title="' + esc(t) + '">' + esc(short) + "</span>";
    }

    function findCachedRecord(id) {
        var list = isAssignRecordsScope() ? cachedAllRows : cachedRows;
        for (var i = 0; i < list.length; i++) {
            if (String(list[i].Id) === String(id)) return list[i];
        }
        return null;
    }

    function refreshTableFromCache() {
        if (!table) return;
        table.clear();
        table.rows.add(renderTableRows(cachedRows));
        table.draw(false);
    }

    function updateStats(rows) {
        var total = rows.length;
        var active = 0;
        var inactive = 0;
        var approved = 0;
        for (var i = 0; i < rows.length; i++) {
            if (isInactiveStatus(rows[i].Status)) inactive++;
            else if (isActiveStatus(rows[i].Status)) active++;
            if ((rows[i].IsApproved || "").toLowerCase() === "yes") approved++;
        }
        document.getElementById("statTotal").textContent = String(total);
        var statActiveEl = document.getElementById("statActive");
        if (statActiveEl) statActiveEl.textContent = String(active);
        document.getElementById("statApproved").textContent = String(approved);
        updateAssignTabCounts(rows);
    }

    function relationshipTableCell(rel) {
        var label = formatRelationshipLabel(rel || "");
        if (!label || label === "FAMILY") return "—";
        return esc(label);
    }

    function assignGridRfidInputCell(r) {
        var rfid = String(r.RfidNumber || "").trim();
        if (!can("edit")) {
            return rfid ? '<span class="rfid-mono">' + esc(rfid) + "</span>" : '<span class="status-remarks-empty">—</span>';
        }
        return (
            '<input type="text" class="assign-rfid-input rfid-mono" autocomplete="off" spellcheck="false" ' +
            'data-emp-id="' +
            esc(r.EmpId) +
            '" data-assign-id="' +
            esc(r.Id || "0") +
            '" data-original="' +
            esc(rfid) +
            '" value="' +
            esc(rfid) +
            '" placeholder="Enter RFID" maxlength="50" aria-label="RFID for employee ' +
            esc(r.EmpId) +
            '" />'
        );
    }

    function findCachedByEmpId(empId) {
        var list = isAssignRecordsScope() ? cachedAllRows : cachedRows;
        for (var i = 0; i < list.length; i++) {
            if (String(list[i].EmpId) === String(empId)) {
                return list[i];
            }
        }
        return null;
    }

    function syncAssignGridRfidSave(record) {
        if (!record || !record.EmpId) {
            return;
        }
        var row = findCachedByEmpId(record.EmpId);
        if (!row) {
            return;
        }
        row.Id = record.Id;
        row.RfidNumber = record.RfidNumber;
        row.Status = record.Status;
        row.IssueDate = record.IssueDate;
        row.IssuedBy = record.IssuedBy;
        row.IsApproved = record.IsApproved;
        row.CreatedDate = record.CreatedDate;
        row.StatusRemarks = record.StatusRemarks;
        updateStats(cachedAllRows.length ? cachedAllRows : cachedRows);
        syncAssignTabFilteredRows();
        refreshTableFromCache();
        if (assignHasSavedRecord(record)) {
            setAssignStatusTab("assigned");
        }
    }

    function saveAssignGridRfid(inputEl) {
        if (!inputEl || !isAssignRecordsScope() || !can("edit")) {
            return;
        }
        var empId = (inputEl.getAttribute("data-emp-id") || "").trim();
        var original = (inputEl.getAttribute("data-original") || "").trim();
        var next = (inputEl.value || "").trim();
        if (!empId) {
            return;
        }
        if (next === original) {
            return;
        }
        if (!next) {
            showAlert("Enter an RFID number before leaving the field.", true);
            inputEl.value = original;
            return;
        }
        inputEl.disabled = true;
        inputEl.classList.add("is-saving");
        var body = new URLSearchParams();
        body.set("action", "savegridrfid");
        body.set("empId", empId);
        body.set("rfidNumber", next);
        fetchJson(recordsApiUrl(""), { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: body.toString() })
            .then(function (payload) {
                var record = payload.Record;
                if (!record) {
                    throw new Error("Saved but record was not returned.");
                }
                syncAssignGridRfidSave(record);
                showAlert("RFID saved for employee " + empId + ".", false);
            })
            .catch(function (err) {
                inputEl.value = original;
                showAlert((err && err.message) || "Could not save RFID.", true);
            })
            .finally(function () {
                inputEl.disabled = false;
                inputEl.classList.remove("is-saving");
            });
    }

    function renderActionsCell(r) {
        var parts = ['<div class="records-actions">'];
        if (can("view") && (!isAssignRecordsScope() || assignHasSavedRecord(r))) {
            parts.push('<button type="button" class="btn-view" data-id="' + esc(r.Id) + '">' + svgView + " View details</button>");
        }
        if (can("edit") && !isAssignRecordsScope()) {
            parts.push('<button type="button" class="btn-edit" data-id="' + esc(r.Id) + '">' + svgEdit + " Edit</button>");
        }
        parts.push(printCardButtonHtml(r));
        parts.push(voucherButtonHtml(r));
        parts.push('<button type="button" class="btn-row-more" aria-label="More actions">' + svgMore + "</button>");
        parts.push("</div>");
        return parts.join("");
    }

    function renderTableRows(rows) {
        var data = [];
        for (var i = 0; i < rows.length; i++) {
            var r = rows[i];
            if (isFamilyRecordsScope()) {
                data.push([
                    esc(r.Id),
                    esc(r.EmpId),
                    esc(r.EmployeeName || "—"),
                    relationshipTableCell(r.Relationship),
                    '<span class="rfid-mono">' + esc(r.RfidNumber) + "</span>",
                    esc(r.IssueDate || "—"),
                    issuerCell(r.IssuedBy),
                    approvedBadge(r.IsApproved),
                    esc(r.CreatedDate || "—"),
                    statusToggleCell(r),
                    statusRemarksCell(r.StatusRemarks),
                    renderActionsCell(r)
                ]);
            } else if (isAssignRecordsScope()) {
                data.push([
                    assignHasSavedRecord(r) ? esc(r.Id) : "—",
                    esc(r.EmpId),
                    esc(recordField(r, "EmployeeName") || "—"),
                    esc(recordField(r, "Designation") || "—"),
                    esc(recordField(r, "Department") || "—"),
                    assignGridRfidInputCell(r),
                    esc(assignStatusDateDisplay(r)),
                    issuerCell(r.IssuedBy),
                    approvedBadge(r.IsApproved),
                    esc(r.CreatedDate || "—"),
                    statusToggleCell(r),
                    statusRemarksCell(r.StatusRemarks),
                    renderActionsCell(r)
                ]);
            } else {
                data.push([
                    esc(r.Id),
                    esc(r.EmpId),
                    '<span class="rfid-mono">' + esc(r.RfidNumber) + "</span>",
                    esc(r.IssueDate || "—"),
                    issuerCell(r.IssuedBy),
                    approvedBadge(r.IsApproved),
                    esc(r.CreatedDate || "—"),
                    statusToggleCell(r),
                    statusRemarksCell(r.StatusRemarks),
                    renderActionsCell(r)
                ]);
            }
        }
        return data;
    }

    function initOrRefreshTable(rows) {
        if (isAssignRecordsScope()) {
            cachedAllRows = rows || [];
            syncAssignTabFilteredRows();
        } else {
            cachedAllRows = [];
            cachedRows = rows || [];
        }
        var data = renderTableRows(cachedRows);
        if (!table) {
            var columnDefs;
            if (isFamilyRecordsScope()) {
                columnDefs = [
                    { targets: [0], className: "rfid-mono" },
                    { targets: [4], orderable: true },
                    { targets: [9], className: "dt-status", orderable: false },
                    { targets: [10], className: "dt-status-remarks" },
                    { targets: [11], className: "dt-actions" }
                ];
            } else if (isAssignRecordsScope()) {
                columnDefs = [
                    { targets: [0, 1], className: "rfid-mono" },
                    { targets: [5], orderable: true },
                    { targets: [10], className: "dt-status", orderable: false },
                    { targets: [11], className: "dt-status-remarks" },
                    { targets: [12], className: "dt-actions" }
                ];
            } else {
                columnDefs = [
                    { targets: [0], className: "rfid-mono" },
                    { targets: [2], orderable: true },
                    { targets: [7], className: "dt-status", orderable: false },
                    { targets: [8], className: "dt-status-remarks" },
                    { targets: [9], className: "dt-actions" }
                ];
            }
            table = $("#recordsTable").DataTable({
                data: data,
                order: isAssignRecordsScope() ? [[1, "asc"]] : [[0, "desc"]],
                pageLength: 15,
                lengthMenu: [[10, 15, 25, 50, -1], [10, 15, 25, 50, "All"]],
                language: {
                    search: "",
                    searchPlaceholder: isFamilyRecordsScope()
                        ? "Search by card name, employee ID or RFID"
                        : isAssignRecordsScope()
                          ? "Search by name, department, designation, ID or RFID"
                          : "Search by name, ID or RFID tag",
                    lengthMenu: "Show: _MENU_ rows",
                    info: "Showing _START_ to _END_ of _TOTAL_ records",
                    infoEmpty: "No records to show",
                    zeroRecords: "No matching records found",
                    paginate: { first: "«", last: "»", next: "›", previous: "‹" }
                },
                initComplete: function () {
                    moveRecordsDtToolbar();
                },
                drawCallback: function () {
                    moveRecordsDtToolbar();
                },
                columnDefs: columnDefs
            });
        } else {
            table.clear();
            table.rows.add(data);
            table.draw();
        }
    }

    function syncCachedStatusChange(id, status, remarks, record) {
        var list = isAssignRecordsScope() ? cachedAllRows : cachedRows;
        for (var i = 0; i < list.length; i++) {
            if (String(list[i].Id) === String(id)) {
                list[i].Status = status;
                if (remarks != null) list[i].StatusRemarks = remarks;
                if (record) {
                    if (record.IssueDate != null) list[i].IssueDate = record.IssueDate;
                    if (record.ExpiryDate != null) list[i].ExpiryDate = record.ExpiryDate;
                }
                break;
            }
        }
        updateStats(isAssignRecordsScope() ? cachedAllRows : cachedRows);
        syncAssignTabFilteredRows();
        refreshTableFromCache();
    }

    function applyStatusChangeUi(uiCtx, newStatus) {
        if (!uiCtx) return;
        if (uiCtx.inputEl && uiCtx.label) {
            uiCtx.inputEl.checked = isActiveStatus(newStatus);
            refreshSwitchUi(uiCtx.label);
        }
        if (uiCtx.pillBtn) {
            refreshPillBtn(uiCtx.pillBtn, isActiveStatus(newStatus));
        }
    }

    function setStatusChangeBadge(el, status) {
        if (!el) return;
        var active = isActiveStatus(status);
        el.textContent = active ? "Active" : "Inactive";
        el.className =
            "status-change-badge " + (active ? "status-change-badge--active" : "status-change-badge--inactive");
    }

    function showStatusChangeError(msg) {
        var el = document.getElementById("statusChangeError");
        if (!el) return;
        el.textContent = msg || "";
        el.classList.toggle("is-hidden", !msg);
    }

    function openStatusChangeModal(id, newStatus, uiCtx) {
        statusChangeCtx = { id: id, newStatus: newStatus, uiCtx: uiCtx || {} };
        var rec = findCachedRecord(id);
        var empId = rec && rec.EmpId ? rec.EmpId : "—";
        var fromStatus = isActiveStatus(newStatus) ? "Inactive" : "Active";
        var sub = document.getElementById("statusChangeSub");
        if (sub) sub.textContent = "Record #" + id + " · Employee " + empId;
        setStatusChangeBadge(document.getElementById("statusChangeFrom"), fromStatus);
        setStatusChangeBadge(document.getElementById("statusChangeTo"), newStatus);
        var title = document.getElementById("statusChangeTitle");
        if (title) {
            title.textContent = newStatus === "Active" ? "Activate this record" : "Deactivate this record";
        }
        var head = document.querySelector(".status-change-modal__head");
        if (head) {
            head.classList.toggle("status-change-modal__head--activate", newStatus === "Active");
            head.classList.toggle("status-change-modal__head--deactivate", newStatus !== "Active");
        }
        var ta = document.getElementById("statusChangeRemarks");
        if (ta) ta.value = "";
        showStatusChangeError("");
        document.getElementById("statusChangeModal").classList.remove("is-hidden");
        document.body.style.overflow = "hidden";
        if (ta) window.setTimeout(function () { ta.focus(); }, 60);
    }

    function closeStatusChangeModal() {
        var modal = document.getElementById("statusChangeModal");
        if (modal) modal.classList.add("is-hidden");
        var othersOpen = ["detailModal", "printCardModal", "editModal"].some(function (mid) {
            var m = document.getElementById(mid);
            return m && !m.classList.contains("is-hidden");
        });
        if (!othersOpen) document.body.style.overflow = "";
        statusChangeCtx = null;
    }

    function confirmStatusChange() {
        if (!statusChangeCtx) return;
        var remarks = (document.getElementById("statusChangeRemarks").value || "").trim();
        if (!remarks) {
            showStatusChangeError("Please enter remarks before confirming.");
            return;
        }
        showStatusChangeError("");
        var btn = document.getElementById("btnConfirmStatusChange");
        var label = btn ? btn.textContent : "";
        if (btn) {
            btn.disabled = true;
            btn.textContent = "Saving…";
        }
        setRecordStatus(statusChangeCtx.id, statusChangeCtx.newStatus, remarks, statusChangeCtx.uiCtx)
            .then(function () {
                closeStatusChangeModal();
            })
            .catch(function () {
                /* SweetAlert in setRecordStatus */
            })
            .finally(function () {
                if (btn) {
                    btn.disabled = false;
                    btn.textContent = label;
                }
            });
    }

    function setRecordStatus(id, status, remarks, uiCtx) {
        var body = new URLSearchParams();
        body.append("id", id);
        body.append("status", status);
        body.append("remarks", remarks || "");

        return fetchJson(recordsApiUrl("action=setstatus"), {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: body.toString()
        })
            .then(function (payload) {
                if (!payload || !payload.Ok) {
                    throw new Error((payload && payload.Error) || "Unable to update status.");
                }
                var newStatus = payload.Status || status;
                var newRemarks = (payload && payload.StatusRemarks) || remarks || "";
                syncCachedStatusChange(id, newStatus, newRemarks, payload.Record || null);
                if (isAssignRecordsScope()) {
                    setPrintButtonForRecord(id, true);
                } else {
                    setPrintButtonForRecord(id, isActiveStatus(newStatus));
                }
                applyStatusChangeUi(uiCtx, newStatus);
                return recordsSweetAlert(
                    "success",
                    "Status updated",
                    "Record #" + id + " is now " + newStatus + "."
                ).then(function () {
                    return payload;
                });
            })
            .catch(function (err) {
                return recordsSweetAlert("error", "Status not saved", err.message || "Failed to update status.").then(
                    function () {
                        throw err;
                    }
                );
            });
    }

    function refreshSwitchUi(label) {
        if (!label) return;
        var input = label.querySelector(".status-switch__input");
        var text = label.querySelector(".status-switch__label");
        if (!input || !text) return;
        var on = input.checked;
        label.classList.toggle("is-on", on);
        label.setAttribute("data-order", on ? "1" : "0");
        text.textContent = on ? "Active" : "Inactive";
        input.setAttribute("aria-label", "Set record " + label.getAttribute("data-id") + " " + (on ? "inactive" : "active"));
    }

    function loadRecords() {
        if (!can("list")) {
            showAlert("You do not have permission to load records.", true);
            return;
        }
        showAlert("");
        fetchJson(recordsApiUrl("action=list"), { cache: "no-store" })
            .then(function (payload) {
                if (!payload || !payload.Ok) {
                    showAlert((payload && payload.Error) || "Unable to load records.", true);
                    initOrRefreshTable([]);
                    return;
                }
                var label = document.getElementById("recordsTableLabel");
                if (label && payload.TableName) label.textContent = payload.TableName;
                var rows = payload.Records || [];
                initOrRefreshTable(rows);
                updateStats(isAssignRecordsScope() ? cachedAllRows : rows);
                if (isAssignRecordsScope()) {
                    updateAssignPanelTitleForTab();
                    updateAssignTabCounts(cachedAllRows);
                }
            })
            .catch(function (err) {
                showAlert((err && err.message) || "Network error while loading records.", true);
                initOrRefreshTable([]);
            });
    }

    function resolvePhotoUrl(path, empId) {
        if (window.RfidPhotos && window.RfidPhotos.employeePhotoUrls) {
            return window.RfidPhotos.employeePhotoUrls(path, empId).primary;
        }
        if (window.RfidPhotos) {
            return window.RfidPhotos.displayUrl(path);
        }
        if (empId && window.RfidPhotos && window.RfidPhotos.employeeImageUrl) {
            var direct = window.RfidPhotos.employeeImageUrl(empId);
            if (direct) return direct;
        }
        if (!path) return "";
        var p = String(path).trim();
        if (/^https?:\/\//i.test(p)) return p;
        p = p.replace(/\\/g, "/").replace(/^\/+/, "");
        return "EmpPhoto.ashx?p=" + encodeURIComponent(p);
    }

    function resolvePhotoFallback(path, empId) {
        if (window.RfidPhotos && window.RfidPhotos.employeePhotoUrls) {
            return window.RfidPhotos.employeePhotoUrls(path, empId).fallback;
        }
        if (window.RfidPhotos) {
            return window.RfidPhotos.handlerUrl(path);
        }
        if (!path) return "";
        var p = String(path).trim().replace(/\\/g, "/").replace(/^\/+/, "");
        return "EmpPhoto.ashx?p=" + encodeURIComponent(p);
    }

    function primaryName(record) {
        var name = (record.EmployeeName || "").trim();
        if (name) return name;
        return "";
    }

    function detailCell(label, value, wide) {
        var cls = wide ? " detail-cell detail-cell--wide" : " detail-cell";
        return (
            '<div class="' + cls.trim() + '">' +
            "<dt>" + esc(label) + "</dt>" +
            '<dd class="' + (wide ? "detail-remarks" : "") + '" title="' + esc(value || "") + '">' + (value ? esc(value) : "—") + "</dd>" +
            "</div>"
        );
    }

    function renderPhotoBlock(record) {
        var url = resolvePhotoUrl(record.PhotoPath, record.EmpId);
        var fallback = resolvePhotoFallback(record.PhotoPath, record.EmpId);
        if (url && fallback && url === fallback && window.RfidPhotos) {
            fallback = window.RfidPhotos.publicUrl(record.PhotoPath);
        }
        var imgTag = "";
        if (url) {
            imgTag =
                '<img class="detail-mini__img" src="' + url.replace(/"/g, "%22") + '" alt="" ' +
                'data-fallback="' + fallback.replace(/"/g, "%22") + '" ' +
                'onload="this.classList.add(\'is-loaded\');var p=this.parentNode.querySelector(\'.detail-mini__ph\');if(p)p.classList.add(\'is-hidden\');" ' +
                'onerror="if(this.dataset.fallback&&!this.dataset.tried){this.dataset.tried=1;this.src=this.dataset.fallback;return;}var p=this.parentNode.querySelector(\'.detail-mini__ph\');if(p)p.classList.remove(\'is-hidden\');" />';
        }
        return (
            '<div class="detail-mini__photo">' +
            '<div class="detail-mini__frame">' +
            imgTag +
            '<div class="detail-mini__ph' + (url ? "" : "") + '">' +
            '<svg viewBox="0 0 24 24" width="28" height="28" fill="none" aria-hidden="true">' +
            '<circle cx="12" cy="9" r="3.5" stroke="currentColor" stroke-width="1.5"/>' +
            '<path d="M5 20c1.2-3 3.4-4.5 7-4.5s5.8 1.5 7 4.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>' +
            "</svg></div></div></div>"
        );
    }

    function renderDetail(record) {
        if (!record) return "<p class=\"detail-loading\">No data.</p>";
        var name = primaryName(record);
        var headline = name ? esc(name) : esc(record.EmpId || "—");
        var subline = name
            ? ('Employee ID <span class="rfid-mono">' + esc(record.EmpId) + "</span>")
            : ('<span class="rfid-mono">' + esc(record.RfidNumber || "—") + "</span>");

        return (
            '<article class="detail-fit">' +
            '<header class="detail-mini">' +
            renderPhotoBlock(record) +
            '<div class="detail-mini__head">' +
            '<p class="detail-mini__eyebrow">RFID card assignment · Record #' + esc(record.Id) + "</p>" +
            "<h3 class=\"detail-mini__title\">" + headline + "</h3>" +
            '<p class="detail-mini__sub">' + subline + "</p>" +
            '<div class="detail-mini__chips">' + statusBadge(record.Status) + approvedBadge(record.IsApproved) +
            '<span class="badge badge--muted">RFID <span class="rfid-mono">' + esc(record.RfidNumber || "—") + "</span></span></div>" +
            "</div></header>" +
            '<dl class="detail-fit-grid">' +
            detailCell("Designation", record.Designation) +
            detailCell("Department", record.Department) +
            detailCell("Project / Location", record.ProjectLocation) +
            detailCell("Joining date", record.JoiningDate) +
            detailCell("Blood group", record.BloodGroup) +
            detailCell("CNIC", record.Cnic) +
            detailCell("Emergency #", record.EmergencyNo) +
            detailCell("Issue date", record.IssueDate) +
            detailCell("Expiry date", record.ExpiryDate) +
            detailCell("Print date", record.PrintDate) +
            detailCell("Created date", record.CreatedDate) +
            detailCell("Issued by", record.IssuedBy) +
            detailCell("Forward to HOD", record.IsForwardHod) +
            detailCell("Forwarded by", record.ForwardBy) +
            detailCell("Forwarded on", record.ForwardOn) +
            detailCell("Approved", record.IsApproved === "Yes" ? "Yes" : (record.IsApproved === "No" ? "No" : record.IsApproved)) +
            detailCell("Approved date", record.ApprovedDate) +
            detailCell("Approver ID", record.ApproveId) +
            detailCell("Status remarks", record.StatusRemarks, true) +
            detailCell("HOD remarks", record.HodRemarks, true) +
            detailCell("Requester remarks", record.RequesterRemarks, true) +
            "</dl></article>"
        );
    }

    function renderFamilyDetail(record, family) {
        family = family || {};
        if (!record) return "<p class=\"detail-loading\">No data.</p>";
        var name = (record.EmployeeName || family.CardName || "").trim();
        var headline = name ? esc(name) : esc(record.EmpId || "—");
        var subline =
            "Employee ID <span class=\"rfid-mono\">" +
            esc(record.EmpId || "—") +
            "</span> · " +
            esc(formatRelationshipLabel(family.Relationship || ""));

        return (
            '<article class="detail-fit">' +
            '<header class="detail-mini">' +
            renderPhotoBlock(record) +
            '<div class="detail-mini__head">' +
            '<p class="detail-mini__eyebrow">Employee family card · Record #' + esc(record.Id) + "</p>" +
            "<h3 class=\"detail-mini__title\">" + headline + "</h3>" +
            '<p class="detail-mini__sub">' + subline + "</p>" +
            '<div class="detail-mini__chips">' +
            statusBadge(record.Status) +
            approvedBadge(record.IsApproved) +
            '<span class="badge badge--muted">RFID <span class="rfid-mono">' + esc(record.RfidNumber || "—") + "</span></span></div>" +
            "</div></header>" +
            '<dl class="detail-fit-grid">' +
            detailCell("Card ID", family.CardId) +
            detailCell("Dependent #", family.DependentId) +
            detailCell("Relationship", formatRelationshipLabel(family.Relationship)) +
            detailCell("CNIC", record.Cnic) +
            detailCell("Issue date", record.IssueDate) +
            detailCell("Expiry date", record.ExpiryDate) +
            detailCell("Print date", record.PrintDate) +
            detailCell("Created date", record.CreatedDate) +
            detailCell("Issued by", record.IssuedBy) +
            detailCell("Approved", record.IsApproved === "Yes" ? "Yes" : record.IsApproved === "No" ? "No" : record.IsApproved) +
            detailCell("Status remarks", record.StatusRemarks, true) +
            "</dl></article>"
        );
    }

    function openModal() {
        document.getElementById("detailModal").classList.remove("is-hidden");
        document.body.style.overflow = "hidden";
    }

    function closeModal() {
        document.getElementById("detailModal").classList.add("is-hidden");
        if (
            document.getElementById("printCardModal").classList.contains("is-hidden") &&
            document.getElementById("editModal").classList.contains("is-hidden")
        ) {
            document.body.style.overflow = "";
        }
    }

    function appRoot() {
        var root = window.RFID_APP_ROOT || "/";
        if (root.charAt(root.length - 1) !== "/") root += "/";
        return root;
    }

    function valOrDash(v) {
        if (v == null || String(v).trim() === "") return "—";
        return String(v).trim();
    }

    function formatCardBackDate(v) {
        if (v == null || String(v).trim() === "" || String(v).trim() === "—") return "—";
        var s = String(v).trim();
        if (/^\d{1,2}-[A-Za-z]{3}-\d{2}$/.test(s)) return s;
        var months = { Jan: 1, Feb: 2, Mar: 3, Apr: 4, May: 5, Jun: 6, Jul: 7, Aug: 8, Sep: 9, Oct: 10, Nov: 11, Dec: 12 };
        var parts = s.split(/\s+/);
        if (parts.length === 3 && months[parts[1]] != null) {
            var yy = parts[2].length >= 2 ? parts[2].slice(-2) : parts[2];
            return parts[0] + "-" + parts[1] + "-" + yy;
        }
        if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
            var iso = s.split("-");
            var d = new Date(parseInt(iso[0], 10), parseInt(iso[1], 10) - 1, parseInt(iso[2], 10));
            if (!isNaN(d.getTime())) {
                var names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
                return d.getDate() + "-" + names[d.getMonth()] + "-" + String(d.getFullYear()).slice(-2);
            }
        }
        return s;
    }

    function displayDateToIso(display) {
        if (!display || !String(display).trim()) return "";
        var s = String(display).trim();
        if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
        var months = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11 };
        var parts = s.split(/\s+/);
        if (parts.length === 3 && months[parts[1]] != null) {
            var d = parseInt(parts[0], 10);
            var mo = months[parts[1]] + 1;
            var y = parseInt(parts[2], 10);
            if (!isNaN(d) && !isNaN(y)) {
                return y + "-" + String(mo).padStart(2, "0") + "-" + String(d).padStart(2, "0");
            }
        }
        return "";
    }

    function roField(label, value, opts) {
        opts = opts || {};
        var cls = "ro-field";
        if (opts.full) cls += " ro-field--full";
        if (opts.half) cls += " ro-field--half";
        var valCls = "ro-value" + (opts.full || opts.half ? " ro-value--remarks" : "");
        return (
            '<div class="' + cls + '">' +
            "<label>" + esc(label) + "</label>" +
            '<div class="' + valCls + '" title="' + esc(valOrDash(value)) + '">' + esc(valOrDash(value)) + "</div>" +
            "</div>"
        );
    }

    function formatFamilyCardDate(v) {
        if (v == null || String(v).trim() === "" || String(v).trim() === "—") return "—";
        var iso = displayDateToIso(v);
        if (!iso) return String(v).trim();
        var p = iso.split("-");
        if (p.length !== 3) return String(v).trim();
        return p[2] + "/" + p[1] + "/" + p[0];
    }

    function formatRelationshipLabel(rel) {
        if (!rel || !String(rel).trim()) return "FAMILY";
        return String(rel).trim().replace(/_/g, " ").toUpperCase();
    }

    var FAMILY_QR_PLACEHOLDER =
        "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";

    function familyQrPayload(family) {
        family = family || {};
        return (
            "Name: " + (family.CardName || "") +
            "\nCNIC: " + (family.Cnic || "") +
            "\nEmp ID: " + (family.EmpId || "") +
            "\nRelation: " + formatRelationshipLabel(family.Relationship)
        );
    }

    function familyQrPayloadFromImg(img) {
        if (!img) return "";
        var enc = img.getAttribute("data-qr-payload");
        if (!enc) return "";
        try {
            return decodeURIComponent(enc);
        } catch (decodeErr) {
            return enc;
        }
    }

    function generateFamilyQrDataUrl(payload) {
        payload = payload == null ? "" : String(payload);
        if (!payload.trim()) return Promise.resolve(FAMILY_QR_PLACEHOLDER);
        var qrLib = typeof QRCode !== "undefined" ? QRCode : null;
        if (qrLib && typeof qrLib.toDataURL === "function") {
            return qrLib
                .toDataURL(payload, {
                    width: 120,
                    margin: 1,
                    errorCorrectionLevel: "Q",
                    color: { dark: "#000000", light: "#ffffff" }
                })
                .catch(function () {
                    return (
                        "https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=" +
                        encodeURIComponent(payload)
                    );
                });
        }
        return Promise.resolve(
            "https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=" + encodeURIComponent(payload)
        );
    }

    function hydrateFamilyCardQrCodes(container, family) {
        if (!container || !family) return Promise.resolve();
        var imgs = container.querySelectorAll(".family-id-card-back__qr");
        if (!imgs.length) return Promise.resolve();
        var payload = familyQrPayload(family);
        return generateFamilyQrDataUrl(payload).then(function (dataUrl) {
            Array.prototype.forEach.call(imgs, function (img) {
                img.setAttribute("src", dataUrl);
                img.setAttribute("data-qr-payload", encodeURIComponent(payload));
            });
        });
    }

    function getFamilyPreviewRoot() {
        return document.getElementById("printCardPreviewAreaFamily");
    }

    function isFamilyQrPlaceholderSrc(src) {
        return !src || String(src) === FAMILY_QR_PLACEHOLDER;
    }

    function bakeFamilyQrOntoPrintRoot(root, family) {
        if (!root || !family) return Promise.resolve(root);
        var payload = familyQrPayload(family);
        return generateFamilyQrDataUrl(payload).then(function (dataUrl) {
            var qr = root.querySelector(".family-id-card-back__qr");
            if (qr && dataUrl && dataUrl !== FAMILY_QR_PLACEHOLDER) {
                qr.setAttribute("src", dataUrl);
                qr.setAttribute("data-qr-payload", encodeURIComponent(payload));
            }
            return root;
        });
    }

    function prepareFamilyCr80PrintRoot(area, family) {
        if (!area) return Promise.resolve(null);
        return hydrateFamilyCardQrCodes(area, family).then(function () {
            var root = buildFamilyCr80PrintRoot(area);
            if (!root) return null;
            return bakeFamilyQrOntoPrintRoot(root, family);
        });
    }

    function renderFamilyIdCardBlock(family) {
        var root = appRoot();
        var logoN = root + "Images/logoN.png";
        var logoNAlt = root + "Images/LogoN.png";
        var logoB = root + "Images/LogoB.png";
        var logoBAlt = root + "Images/logoB.png";
        var sign = root + "Images/signature.png";
        var fallbackLogo = root + "Images/logo.png";
        var photoUrl = resolvePhotoUrl(family.PhotoPath);
        var fallback = window.RfidPhotos ? window.RfidPhotos.publicUrl(family.PhotoPath) : "";
        var name = family.CardName ? String(family.CardName).toUpperCase() : "—";
        var role = formatRelationshipLabel(family.Relationship);
        var img =
            photoUrl
                ? ('<img src="' + esc(photoUrl) + '" alt="" data-fallback="' + esc(fallback) + '" ' +
                    'onerror="if(this.dataset.fallback&&!this.dataset.tried){this.dataset.tried=1;this.src=this.dataset.fallback;}" />')
                : "";

        function detailRow(label, value) {
            return (
                '<div class="family-id-card-front__row">' +
                '<span class="family-id-card-front__label">' + esc(label) + "</span>" +
                '<span class="family-id-card-front__value">' + esc(value) + "</span></div>"
            );
        }

        return (
            '<div id="printCardPreviewAreaFamily" class="family-card-container preview-scaled">' +
            '<div class="card-print-page card-print-page--family-front">' +
            '<div class="family-id-card-aspect family-id-card-front family-id-card-front-side">' +
            '<div class="family-card-watermark" aria-hidden="true"></div>' +
            '<div class="family-id-card-front__header">' +
            '<img class="logo-n" src="' + esc(logoN) + '" alt="" onerror="if(!this.dataset.alt1){this.dataset.alt1=1;this.src=\'' +
            esc(logoNAlt) +
            "';}else{this.onerror=null;this.src='" +
            esc(fallbackLogo) +
            "';}\" />" +
            '<div class="family-id-card-front__titles">' +
            '<div class="family-id-card-front__titles-stack">' +
            "<h2>BAHRIA TOWN</h2><h2 style = 'margin-right: 36px;' class=\"family-id-card-front__titles-city\">KARACHI</h2><h3>EMPLOYEE FAMILY</h3></div></div></div>" +
            '<div class="family-id-card-front__middle">' +
            '<div class="family-id-card-front__photo-wrap"><div class="family-id-card-front__photo">' + img + "</div></div>" +
            '<div class="family-id-card-front__identity">' +
            '<h2 class="family-id-card-front__name">' + esc(name) + "</h2>" +
            '<p class="family-id-card-front__role">' + esc(role) + "</p></div></div>" +
            '<div class="family-id-card-front__divider"></div>' +
            '<div class="family-id-card-front__footer">' +
            '<div class="family-id-card-front__col-left">' +
            detailRow("Issue Date", formatFamilyCardDate(family.IssueDate)) +
            detailRow("Expiry Date", formatFamilyCardDate(family.ExpiryDate)) +
            "</div>" +
            '<div class="family-id-card-front__vrule"></div>' +
            '<div class="family-id-card-front__col-right">' +
            detailRow("Card ID", valOrDash(family.CardId)) +
            detailRow("Employee ID", valOrDash(family.EmpId)) +
            detailRow("CNIC", valOrDash(family.Cnic)) +
            "</div></div></div></div>" +
            '<div class="card-print-page card-print-page--family-back">' +
            '<div class="family-id-card-aspect family-id-card-back family-id-card-back-side">' +
            '<div class="family-id-card-back__bar"><span>NON RESIDENT</span></div>' +
            '<div class="family-id-card-back__wm" aria-hidden="true"></div>' +
            '<div class="family-id-card-back__body">' +
            '<div class="family-id-card-back__left">' +
            '<img class="logo-b" src="' + esc(logoB) + '" alt="" onerror="if(!this.dataset.alt1){this.dataset.alt1=1;this.src=\'' +
            esc(logoBAlt) +
            "';}else{this.onerror=null;this.src='" +
            esc(fallbackLogo) +
            "';}\" />" +
            "<p>24/7 Call</p><p>(021) 3877 1555 Ext-685</p><p>www.btkarachi.com</p>" +
            '<img class="family-id-card-back__sign" src="' + esc(sign) + '" alt="" onerror="this.style.display=\'none\'" />' +
            "<p>Issuing Authority</p><p>Director Security&nbsp;Bahria&nbsp;Town</p></div>" +
            '<div class="family-id-card-back__vrule"></div>' +
            '<div class="family-id-card-back__right">' +
            '<img class="family-id-card-back__qr" src="' +
            esc(FAMILY_QR_PLACEHOLDER) +
            '" data-qr-payload="' +
            esc(encodeURIComponent(familyQrPayload(family))) +
            '" alt="QR code" />' +
            "<ul>" +
            "<li>This card is for employee&nbsp;family members&nbsp;only.</li>" +
            "<li>Pass only carried&nbsp;by authorized&nbsp;person.</li>" +
            "<li>Photocopy of this pass is&nbsp;not allowed.</li>" +
            "<li>Pass is non-transferable.</li></ul>" +
            "<div class=\"family-id-card-back__return\">" +
            "<p>If Found.</p><p>Please&nbsp;return to</p><p>Bahria Town (Pvt)&nbsp;Ltd.</p></div></div></div></div></div></div>"
        );
    }

    function renderIdCardBlock(record) {
        var name = (record.EmployeeName || record.EmpId || "—");
        if (name !== "—") name = String(name).toUpperCase();
        var dgn = record.Designation ? String(record.Designation).toUpperCase() : "—";
        var dept = record.Department ? String(record.Department).toUpperCase() : "—";
        var proj = record.ProjectLocation ? String(record.ProjectLocation).toUpperCase() : "—";
        var photoUrl = resolvePhotoUrl(record.PhotoPath, record.EmpId);
        var fallback = resolvePhotoFallback(record.PhotoPath, record.EmpId);
        var logo = appRoot() + "Images/logo.png";
        var sign = appRoot() + "Images/signature.png";
        var gradeBadge = resolveCardGradeBadge(record);
        var img =
            photoUrl
                ? ('<img src="' + esc(photoUrl) + '" alt="" data-emp-id="' + esc(record.EmpId || "") + '" data-fallback="' + esc(fallback) + '" ' +
                    'onerror="if(this.dataset.fallback&&!this.dataset.tried){this.dataset.tried=1;this.src=this.dataset.fallback;}" />')
                : "";

        return (
            '<div id="printCardPreviewArea" class="card-container preview-scaled">' +
            '<div class="card-print-page card-print-page--front">' +
            '<div class="id-card front-card">' +
            '<div class="front-header">' +
            '<div class="header-logo"><img src="' + esc(logo) + '" alt="Bahria Town" /></div>' +
            '<div class="header-photo">' + img + "</div></div>" +
            '<div class="front-body">' +
            '<div class="field-group"><span class="field-label">Employee ID:</span><span class="field-value emp-id">' + esc(record.EmpId || "—") + "</span></div>" +
            '<div class="field-group"><span class="field-label">Name :</span><span class="field-value">' + esc(name) + "</span></div>" +
            '<div class="field-group"><span class="field-label">Designation:</span><span class="field-value">' + esc(dgn) + "</span></div>" +
            '<div class="field-group"><span class="field-label">Department:</span><span class="field-value">' + esc(dept) + "</span></div>" +
            '<div class="field-group"><span class="field-label">Project/Location:</span><span class="field-value">' + esc(proj) + "</span></div>" +
            "</div>" +
            '<div class="grade-badge">' + esc(gradeBadge) + "</div></div></div>" +
            '<div class="card-print-page card-print-page--back">' +
            '<div class="id-card back-card">' +
            '<div class="back-details">' +
            '<div class="back-row"><span class="back-label">Joining Date:</span><span class="back-value">' + esc(formatCardBackDate(recordField(record, "JoiningDate"))) + "</span></div>" +
            '<div class="back-row"><span class="back-label">Issue Date:</span><span class="back-value">' +
            esc(
                formatCardBackDate(
                    isAssignRecordsScope() ? assignCardIssueDateSource(record) : recordField(record, "IssueDate")
                )
            ) +
            "</span></div>" +
            '<div class="back-row"><span class="back-label">Expiry Date:</span><span class="back-value">AS PER RENEWAL</span></div>' +
            '<div class="back-row"><span class="back-label">Blood Group:</span><span class="back-value">' + esc(valOrDash(recordField(record, "BloodGroup"))) + "</span></div>" +
            '<div class="back-row"><span class="back-label">CNIC:</span><span class="back-value">' + esc(valOrDash(recordField(record, "Cnic"))) + "</span></div>" +
            '<div class="back-row"><span class="back-label">Emergency #:</span><span class="back-value">' + esc(valOrDash(recordField(record, "EmergencyNo"))) + "</span></div>" +
            "</div>" +
            '<div class="back-notes">' +
            "<p>The Employee ID card is replaceable if there is a change in employee's designation or department.</p>" +
            "<p><strong>Return:</strong><br />The Employee ID card is property of Bahria Town (Pvt) Ltd. and must be returned to HR Department upon the disengagement of services.</p>" +
            '<div class="authority-container">' +
            '<div class="authority-text">' +
            '<p class="authority-text__line"><strong>Issuing Authority:</strong></p>' +
            '<p class="authority-text__line">HR Department Bahria<br />Town</p>' +
            "</div>" +
            '<div class="authority-sign">' +
            '<img class="authority-sign__img" src="' + esc(sign) + '" alt="" onerror="this.style.display=\'none\'" />' +
            '<div class="sign-line"></div>' +
            '<div class="sign-label">SGM HR</div>' +
            "</div></div></div>" +
            '<div class="back-footer">' +
            "<p><strong>If found please return to</strong></p>" +
            "<p>HR Department.</p>" +
            "<p>Nagori Stop Super Highway 9KM from Toll Plaza</p>" +
            "<p>0800-00100</p>" +
            "<p>www.bahriatown.com</p></div></div></div></div>"
        );
    }

    function defaultIssuedByName() {
        var name = window.RFID_ISSUED_BY_DEFAULT;
        if (name == null) return "";
        return String(name).trim();
    }

    function resolveIssuedByForPrint(stored) {
        var value = stored == null ? "" : String(stored).trim();
        if (value) return value;
        return defaultIssuedByName();
    }

    function printAssignmentFieldsHtml(opts) {
        opts = opts || {};
        var isFamily = opts.mode === "family";
        var src = opts.source || {};
        var printIso = isAssignRecordsScope() && !isFamily
            ? todayIsoDateLocal()
            : displayDateToIso(src.PrintDate) || todayIsoDateLocal();
        var issuedByValue = resolveIssuedByForPrint(src.IssuedBy);
        var createdDisplay = src.CreatedDate && String(src.CreatedDate).trim() ? src.CreatedDate : "—";
        var recordId = src.Id != null ? String(src.Id) : "";
        var rfidId = isFamily ? "printFamilyRfidNumber" : "printCardRfidNumber";
        var etagId = isFamily ? "printFamilyEtag" : "printCardEtag";
        var printId = isFamily ? "printFamilyPrintDate" : "printCardPrintDate";
        var issuedId = isFamily ? "printFamilyIssuedBy" : "printCardIssuedBy";
        var createdId = isFamily ? "printFamilyCreatedDisplay" : "printCardCreatedDisplay";
        var hiddenId = isFamily ? "printFamilyRecordId" : "printCardRecordId";
        var errId = isFamily ? "printFamilyAssignError" : "printAssignError";
        var skipEtag = !isFamily && isAssignRecordsScope();
        var empHidden =
            !isFamily && isAssignRecordsScope()
                ? '<input type="hidden" id="printCardEmpId" value="' + esc(recordField(src, "EmpId") || "") + '" />'
                : "";
        var etagBlock = skipEtag
            ? ""
            : '<div class="edit-field edit-field--full">' +
              '<label for="' + etagId + '">ETAG <span class="req">*</span></label>' +
              '<input type="text" id="' + etagId + '" class="edit-input rfid-mono" maxlength="50" placeholder="Electronic tag ID" value="' +
              esc(src.Etag || "") +
              '" />' +
              '<p class="print-assign-hint">Required before printing. E-Tag for the printed card (not on the request form).</p>' +
              "</div>";
        return (
            '<div class="print-assign-fields">' +
            '<input type="hidden" id="' + hiddenId + '" value="' + esc(recordId) + '" />' +
            empHidden +
            '<div class="edit-field edit-field--full">' +
            '<label for="' + rfidId + '">RFID number <span class="req">*</span></label>' +
            '<input type="text" id="' + rfidId + '" class="edit-input rfid-mono" maxlength="50" placeholder="e.g. 123456" value="' + esc(src.RfidNumber || "") + '" />' +
            '<p class="print-assign-hint">Required before printing. Assign the physical card tag here.</p>' +
            "</div>" +
            etagBlock +
            '<div class="edit-field">' +
            '<label for="' + printId + '">Print date' +
            (isAssignRecordsScope() && !isFamily ? "" : ' <span class="req">*</span>') +
            "</label>" +
            '<input type="date" id="' + printId + '" class="edit-input"' +
            (isAssignRecordsScope() && !isFamily ? ' readonly="readonly" title="Uses today\'s date when saving"' : "") +
            ' value="' +
            esc(printIso) +
            '" />' +
            (isAssignRecordsScope() && !isFamily
                ? '<p class="print-assign-hint">Saved automatically as today\'s date (no manual entry).</p>'
                : "") +
            "</div>" +
            '<div class="edit-field">' +
            '<label for="' + issuedId + '">Issued by <span class="req">*</span></label>' +
            '<input type="text" id="' + issuedId + '" class="edit-input" maxlength="50" placeholder="Name" value="' + esc(issuedByValue) + '" />' +
            "</div>" +
            '<div class="edit-field edit-field--full">' +
            "<label>Created date</label>" +
            '<div class="print-assign-readonly" id="' + createdId + '" title="Set when the record was saved">' +
            esc(createdDisplay) +
            "</div>" +
            '<p class="print-assign-hint">System date when the record was created (not editable).</p>' +
            "</div>" +
            '<p id="' + errId + '" class="edit-form-error is-hidden" role="alert"></p>' +
            "</div>"
        );
    }

    function renderEmployeePrintDetails(record) {
        return (
            '<div class="ro-form ro-form--wide">' +
            roField("Record ID", record.Id) +
            roField("Employee ID", record.EmpId) +
            roField("Name", record.EmployeeName) +
            roField("Designation", record.Designation) +
            roField("Department", record.Department) +
            roField("Project / Location", record.ProjectLocation) +
            roField("Joining date", record.JoiningDate) +
            roField("Blood group", record.BloodGroup) +
            roField("CNIC", record.Cnic) +
            roField("Emergency #", record.EmergencyNo) +
            roField("Status", record.Status) +
            roField("Status remarks", record.StatusRemarks) +
            roField(
                "Issue date",
                isAssignRecordsScope()
                    ? formatCardBackDate(assignCardIssueDateSource(record))
                    : record.IssueDate
            ) +
            roField("Expiry date", record.ExpiryDate) +
            roField("Approved", record.IsApproved) +
            roField("Approved date", record.ApprovedDate) +
            roField("Approver ID", record.ApproveId) +
            roField("Forward to HOD", record.IsForwardHod) +
            roField("Forwarded by", record.ForwardBy) +
            roField("Forwarded on", record.ForwardOn) +
            roField("HOD remarks", record.HodRemarks, { half: true }) +
            roField("Requester remarks", record.RequesterRemarks, { half: true }) +
            "</div>"
        );
    }

    function renderFamilyPrintDetails(family) {
        return (
            '<div class="ro-form ro-form--wide">' +
            roField("Family record ID", family.Id) +
            roField("Employee ID", family.EmpId) +
            roField("Dependent #", family.DependentId) +
            roField("Card ID", family.CardId) +
            roField("Card holder name", family.CardName) +
            roField("Relationship", formatRelationshipLabel(family.Relationship)) +
            roField("CNIC", family.Cnic) +
            roField("Status", family.Status) +
            roField("Issue date", family.IssueDate) +
            roField("Expiry date", family.ExpiryDate) +
            roField("Photo path", family.PhotoPath, { full: true }) +
            "</div>"
        );
    }

    function renderFamilyPrintFormPanel(family) {
        if (!family) {
            return '<p class="print-assign-hint">Select a family member to view details.</p>';
        }
        return (
            '<p class="print-card-layout__form-title">Print &amp; assignment</p>' +
            printAssignmentFieldsHtml({ mode: "family", source: family }) +
            '<p class="print-card-layout__form-title print-card-layout__form-title--sub">Family card details</p>' +
            renderFamilyPrintDetails(family)
        );
    }

    function renderFamilyStandalonePrintLayout(family) {
        if (!family) {
            return '<p class="detail-loading">No family card data.</p>';
        }
        var name = (family.CardName || "").trim();
        var subtitle = name
            ? name + " · " + formatRelationshipLabel(family.Relationship)
            : "Record #" + (family.Id || "—");
        return (
            '<article class="print-card-layout">' +
            '<header class="print-card-layout__head">' +
            '<div class="print-card-layout__head-main">' +
            "<h3>Employee Family ID card preview</h3>" +
            "<p>" + esc(subtitle) + "</p></div></header>" +
            '<div class="print-card-layout__split">' +
            '<section class="print-card-layout__cards print-card-layout__cards--family">' +
            '<p class="print-card-layout__cards-title">Family pass (front &amp; back)</p>' +
            '<div class="family-preview-side-toggle no-print-in-modal">' +
            '<button type="button" class="family-side-btn is-active" data-family-side="front">Show front</button>' +
            '<button type="button" class="family-side-btn" data-family-side="back">Show back</button></div>' +
            '<div id="printFamilyPreviewHost">' + renderFamilyIdCardBlock(family) + "</div></section>" +
            '<section class="print-card-layout__form">' +
            renderFamilyPrintFormPanel(family) +
            "</section></div></article>"
        );
    }

    function bindFamilyStandalonePrintUi(family) {
        printModalFamilyCards = family ? [family] : [];
        document.querySelectorAll(".family-side-btn").forEach(function (btn) {
            btn.addEventListener("click", function () {
                setFamilyPreviewSide(btn.getAttribute("data-family-side"));
            });
        });
        setFamilyPreviewSide("front");
        hydrateFamilyCardQrCodes(getFamilyPreviewRoot(), family);
    }

    function renderEmployeePrintFormPanel(record) {
        return (
            '<p class="print-card-layout__form-title">Print &amp; assignment</p>' +
            printAssignmentFieldsHtml({ mode: "employee", source: record }) +
            '<p class="print-card-layout__form-title print-card-layout__form-title--sub">Employee details</p>' +
            renderEmployeePrintDetails(record)
        );
    }

    function renderPrintCardLayout(record, familyCards) {
        familyCards = familyCards || [];
        var hasFamily = familyCards.length > 0;
        var name = primaryName(record);
        var subtitle = name
            ? ("Employee " + (record.EmpId || "—") + " · " + name)
            : ("Record #" + (record.Id || "—"));

        var iconEmployee =
            '<svg class="print-card-tabs__icon" viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden="true">' +
            '<rect x="3" y="6" width="18" height="13" rx="2" stroke="currentColor" stroke-width="1.6"/>' +
            '<path d="M3 10h18" stroke="currentColor" stroke-width="1.6"/>' +
            '<circle cx="9" cy="14" r="2" stroke="currentColor" stroke-width="1.4"/></svg>';
        var iconFamily =
            '<svg class="print-card-tabs__icon" viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden="true">' +
            '<circle cx="9" cy="8" r="2.5" stroke="currentColor" stroke-width="1.5"/>' +
            '<circle cx="16" cy="9" r="2" stroke="currentColor" stroke-width="1.5"/>' +
            '<path d="M4 19c0-2.5 2.2-4 5-4s5 1.5 5 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>' +
            '<path d="M14 19c0-1.8 1.4-3 3.5-3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>';

        var tabsHtml = hasFamily
            ? ('<nav class="print-card-tabs" role="tablist" aria-label="Preview card type">' +
              '<button type="button" class="print-card-tabs__btn print-card-tab is-active" data-print-tab="employee" role="tab" aria-selected="true">' +
              iconEmployee + "<span>Employee card</span></button>" +
              '<button type="button" class="print-card-tabs__btn print-card-tabs__btn--family print-card-tab" data-print-tab="family" role="tab" aria-selected="false">' +
              iconFamily + "<span>Family card</span></button></nav>")
            : "";

        var familyPickerHtml = "";
        if (hasFamily && familyCards.length > 1) {
            familyPickerHtml = '<div class="print-family-picker"><label for="printFamilyMemberPicker">Family member</label><select id="printFamilyMemberPicker">';
            for (var fi = 0; fi < familyCards.length; fi++) {
                var fc = familyCards[fi];
                familyPickerHtml +=
                    '<option value="' + fi + '">' + esc(valOrDash(fc.CardName)) + " · " + esc(formatRelationshipLabel(fc.Relationship)) + "</option>";
            }
            familyPickerHtml += "</select></div>";
        }

        var familyPreviewHtml = hasFamily
            ? ('<div class="family-preview-side-toggle no-print-in-modal">' +
              '<button type="button" class="family-side-btn is-active" data-family-side="front">Show front</button>' +
              '<button type="button" class="family-side-btn" data-family-side="back">Show back</button></div>' +
              familyPickerHtml +
              '<div id="printFamilyPreviewHost">' + renderFamilyIdCardBlock(familyCards[0]) + "</div>")
            : '<p class="print-assign-hint">No family cards linked to this employee.</p>';

        return (
            '<article class="print-card-layout">' +
            '<header class="print-card-layout__head">' +
            '<div class="print-card-layout__head-main">' +
            "<h3>ID card preview</h3>" +
            "<p>" + esc(subtitle) + "</p></div>" +
            tabsHtml +
            "</header>" +
            '<div class="print-card-layout__split">' +
            '<section class="print-card-layout__cards print-card-tab-panel" id="printCardTabEmployee" data-print-panel="employee">' +
            '<p class="print-card-layout__cards-title">Employee card (front &amp; back)</p>' +
            '<div id="printCardPreviewHost">' + renderIdCardBlock(record) + "</div>" +
            "</section>" +
            (hasFamily
                ? ('<section class="print-card-layout__cards print-card-layout__cards--family print-card-tab-panel is-hidden" id="printCardTabFamily" data-print-panel="family">' +
                  '<p class="print-card-layout__cards-title">Family pass (front &amp; back)</p>' +
                  familyPreviewHtml +
                  "</section>")
                : "") +
            '<section class="print-card-layout__form">' +
            '<div class="print-card-form-panel" id="printFormPanelEmployee" data-print-form="employee">' +
            renderEmployeePrintFormPanel(record) +
            "</div>" +
            (hasFamily
                ? ('<div class="print-card-form-panel is-hidden" id="printFormPanelFamily" data-print-form="family">' +
                  renderFamilyPrintFormPanel(familyCards[0]) +
                  "</div>")
                : "") +
            "</section></div></article>"
        );
    }

    var printModalFamilyCards = [];

    function getSelectedFamilyCardIndex() {
        var picker = document.getElementById("printFamilyMemberPicker");
        if (!picker) return 0;
        var idx = parseInt(picker.value, 10);
        return isNaN(idx) ? 0 : idx;
    }

    function syncPrintFormPanels() {
        var tab = activePrintTab();
        var empForm = document.getElementById("printFormPanelEmployee");
        var famForm = document.getElementById("printFormPanelFamily");
        if (empForm) empForm.classList.toggle("is-hidden", tab === "family" && !!famForm);
        if (famForm) famForm.classList.toggle("is-hidden", tab !== "family");
    }

    function refreshFamilyPrintFormPanel() {
        var host = document.getElementById("printFormPanelFamily");
        if (!host || !printModalFamilyCards.length) return;
        var idx = getSelectedFamilyCardIndex();
        var family = printModalFamilyCards[idx];
        host.innerHTML = renderFamilyPrintFormPanel(family);
    }

    function setFamilyPreviewSide(side) {
        var area = document.getElementById("printCardPreviewAreaFamily");
        if (!area) return;
        var frontPage = area.querySelector(".card-print-page--family-front");
        var backPage = area.querySelector(".card-print-page--family-back");
        var showFront = side !== "back";
        if (frontPage) frontPage.classList.toggle("is-hidden", !showFront);
        if (backPage) backPage.classList.toggle("is-hidden", showFront);
        document.querySelectorAll(".family-side-btn").forEach(function (btn) {
            var active = btn.getAttribute("data-family-side") === (showFront ? "front" : "back");
            btn.classList.toggle("is-active", active);
        });
    }

    function bindPrintCardUi(record, familyCards) {
        familyCards = familyCards || [];
        printModalFamilyCards = familyCards;
        document.querySelectorAll(".print-card-tab").forEach(function (btn) {
            btn.addEventListener("click", function () {
                var tab = btn.getAttribute("data-print-tab");
                document.querySelectorAll(".print-card-tab").forEach(function (b) {
                    var on = b === btn;
                    b.classList.toggle("is-active", on);
                    b.setAttribute("aria-selected", on ? "true" : "false");
                });
                var empPanel = document.getElementById("printCardTabEmployee");
                var famPanel = document.getElementById("printCardTabFamily");
                if (empPanel) empPanel.classList.toggle("is-hidden", tab !== "employee");
                if (famPanel) famPanel.classList.toggle("is-hidden", tab !== "family");
                syncPrintFormPanels();
                syncPrintCardButton();
            });
        });

        var picker = document.getElementById("printFamilyMemberPicker");
        if (picker && familyCards.length) {
            picker.addEventListener("change", function () {
                var idx = parseInt(picker.value, 10);
                if (isNaN(idx) || !familyCards[idx]) return;
                var host = document.getElementById("printFamilyPreviewHost");
                if (host) host.innerHTML = renderFamilyIdCardBlock(familyCards[idx]);
                hydrateFamilyCardQrCodes(getFamilyPreviewRoot(), familyCards[idx]);
                setFamilyPreviewSide("front");
                refreshFamilyPrintFormPanel();
                syncPrintCardButton();
            });
        }

        document.querySelectorAll(".family-side-btn").forEach(function (btn) {
            btn.addEventListener("click", function () {
                setFamilyPreviewSide(btn.getAttribute("data-family-side"));
            });
        });

        if (familyCards.length) {
            setFamilyPreviewSide("front");
            hydrateFamilyCardQrCodes(
                getFamilyPreviewRoot(),
                familyCards[getSelectedFamilyCardIndex()] || familyCards[0]
            );
        }
        syncPrintFormPanels();
    }

    function openPrintModal() {
        document.getElementById("printCardModal").classList.remove("is-hidden");
        document.body.style.overflow = "hidden";
        var printBtn = document.getElementById("btnPrintCardPreview");
        if (printBtn) {
            printBtn.disabled = true;
            printBtn.classList.add("is-disabled");
        }
    }

    function closePrintModal() {
        document.getElementById("printCardModal").classList.add("is-hidden");
        printModalScope = "employee";
        if (document.getElementById("detailModal").classList.contains("is-hidden")) {
            document.body.style.overflow = "";
        }
    }

    function showPrintAssignError(msg) {
        var isFam = activePrintTab() === "family";
        var el = document.getElementById(isFam ? "printFamilyAssignError" : "printAssignError");
        if (!el && !isFam) el = document.getElementById("printAssignError");
        if (!el) return;
        el.textContent = msg || "";
        el.classList.toggle("is-hidden", !msg);
    }

    function recordsSweetAlert(kind, title, message) {
        var text = message || "";
        if (typeof Swal === "undefined") {
            window.alert(title + (text ? "\n\n" + text : ""));
            return Promise.resolve();
        }
        return Swal.fire({
            icon: kind,
            title: title,
            text: text,
            confirmButtonColor: "#004d4d"
        });
    }

    function printAssignmentIsCompleteFor(prefix) {
        var rfidEl = document.getElementById(prefix + "RfidNumber");
        var etagEl = document.getElementById(prefix + "Etag");
        var printEl = document.getElementById(prefix + "PrintDate");
        var issuedEl = document.getElementById(prefix + "IssuedBy");
        var createdEl = document.getElementById(prefix + "CreatedDisplay");
        var rfid = rfidEl ? String(rfidEl.value || "").trim() : "";
        var etag = etagEl ? String(etagEl.value || "").trim() : "";
        var printDate = printEl ? String(printEl.value || "").trim() : "";
        var issuedBy = issuedEl ? String(issuedEl.value || "").trim() : "";
        var created = createdEl ? String(createdEl.textContent || "").trim() : "";
        if (prefix === "printCard" && isAssignRecordsScope()) {
            return !!document.getElementById("printCardPreviewArea");
        }
        var etagRequired = prefix !== "printCard" || !isAssignRecordsScope();
        if (!rfid || !printDate || !issuedBy) {
            return false;
        }
        if (etagRequired && !etag) {
            return false;
        }
        if (!created || created === "—" || created === "-") {
            return false;
        }
        return true;
    }

    function printAssignmentIsComplete() {
        return printAssignmentIsCompleteFor("printCard");
    }

    function printFamilyAssignmentIsComplete() {
        return printAssignmentIsCompleteFor("printFamily");
    }

    function activePrintTab() {
        if (printModalScope === "family-only") {
            return "family";
        }
        var active = document.querySelector(".print-card-tab.is-active");
        return active ? active.getAttribute("data-print-tab") : "employee";
    }

    function setPrintActionButtonState(btn, enabled, disabledTitle) {
        if (!btn) return;
        btn.disabled = !enabled;
        btn.classList.toggle("is-disabled", !enabled);
        btn.setAttribute("aria-disabled", enabled ? "false" : "true");
        if (!enabled && disabledTitle) {
            btn.setAttribute("title", disabledTitle);
        } else {
            btn.removeAttribute("title");
        }
    }

    function syncPrintCardButton() {
        var btnPrint = document.getElementById("btnPrintCardPreview");
        var btnPdf = document.getElementById("btnDownloadCardPdf");
        if (!btnPrint && !btnPdf) return;
        if (activePrintTab() === "family") {
            var famOk = printFamilyAssignmentIsComplete() && !!document.getElementById("printCardPreviewAreaFamily");
            var famTitle = "Fill RFID number, ETAG, print date, and issued by for this family card.";
            setPrintActionButtonState(btnPrint, famOk, famTitle);
            setPrintActionButtonState(btnPdf, famOk, famTitle);
            return;
        }
        var ok = printAssignmentIsComplete();
        var empTitle = isAssignRecordsScope()
            ? "Fill RFID number and issued by to print."
            : "Fill RFID number, ETAG, print date, issued by, and ensure created date is set.";
        setPrintActionButtonState(btnPrint, ok, empTitle);
        setPrintActionButtonState(btnPdf, ok, empTitle);
    }

    function savePrintAssignment() {
        var isFamily = activePrintTab() === "family";
        var idEl = document.getElementById(isFamily ? "printFamilyRecordId" : "printCardRecordId");
        var id = idEl ? idEl.value : "";
        var assignEmpEl = document.getElementById("printCardEmpId");
        var assignEmpId = assignEmpEl ? String(assignEmpEl.value || "").trim() : "";
        if (!isFamily && isAssignRecordsScope()) {
            showPrintAssignError("");
            var rfidOnly = ((document.getElementById("printCardRfidNumber") || {}).value || "").trim();
            if (rfidOnly && assignEmpId) {
                var body = new URLSearchParams();
                body.set("action", "savegridrfid");
                body.set("empId", assignEmpId);
                body.set("rfidNumber", rfidOnly);
                var btn = document.getElementById("btnSavePrintAssignment");
                var label = btn ? btn.textContent : "";
                if (btn) {
                    btn.disabled = true;
                    btn.textContent = "Saving…";
                }
                fetchJson(recordsApiUrl(""), { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: body.toString() })
                    .then(function (payload) {
                        if (!payload || !payload.Record) {
                            throw new Error((payload && payload.Error) || "Unable to save RFID.");
                        }
                        var saved = mergeAssignGridRowForPrint(payload.Record, assignEmpId);
                        syncAssignGridRfidSave(saved);
                        refreshPrintCardPreview(saved, []);
                        loadRecords();
                        return recordsSweetAlert("success", "RFID saved", "RFID saved to RFID_CARD_ASSIGN for employee " + assignEmpId + ".");
                    })
                    .catch(function (err) {
                        showPrintAssignError((err && err.message) || "Could not save RFID.");
                        return recordsSweetAlert("error", "Save failed", (err && err.message) || "Could not save RFID.");
                    })
                    .finally(function () {
                        if (btn) {
                            btn.disabled = false;
                            btn.textContent = label;
                        }
                    });
                return;
            }
            recordsSweetAlert(
                "info",
                "V_EMPS profile",
                "Card name, designation, and department come from V_EMPS. Enter RFID here or on the grid to save it to RFID_CARD_ASSIGN."
            );
            return;
        }
        if (!id) {
            showPrintAssignError("Record is still loading.");
            return;
        }
        showPrintAssignError("");
        var btn = document.getElementById("btnSavePrintAssignment");
        var label = btn ? btn.textContent : "";
        if (btn) {
            btn.disabled = true;
            btn.textContent = "Saving…";
        }
        var body = new URLSearchParams();
        if (isFamily) {
            body.append("familyId", id);
        } else {
            body.append("id", id);
        }
        body.append(
            "issuedBy",
            ((document.getElementById(isFamily ? "printFamilyIssuedBy" : "printCardIssuedBy") || {}).value) || ""
        );
        body.append(
            "printDate",
            isAssignRecordsScope() && !isFamily
                ? todayIsoDateLocal()
                : ((document.getElementById(isFamily ? "printFamilyPrintDate" : "printCardPrintDate") || {}).value) || ""
        );
        body.append(
            "rfidNumber",
            ((document.getElementById(isFamily ? "printFamilyRfidNumber" : "printCardRfidNumber") || {}).value) || ""
        );
        body.append(
            "etag",
            ((document.getElementById(isFamily ? "printFamilyEtag" : "printCardEtag") || {}).value) || ""
        );

        fetchJson(recordsApiUrl(isFamily ? "action=updatefamilyprintassignment" : "action=updateprintassignment"), {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: body.toString()
        })
            .then(function (payload) {
                if (!payload || !payload.Ok) {
                    throw new Error((payload && payload.Error) || "Unable to save assignment.");
                }
                if (isFamilyRecordsScope() && isFamily) {
                    showFamilyRecordPrintCard(id);
                    syncPrintCardButton();
                    loadRecords();
                    return recordsSweetAlert(
                        "success",
                        "Assignment saved",
                        "Print and assignment details were saved for family card #" + id + "."
                    );
                }
                if (!payload.Record) {
                    throw new Error((payload && payload.Error) || "Unable to save assignment.");
                }
                var r = payload.Record;
                var bodyEl = document.getElementById("printCardBody");
                if (bodyEl) {
                    bodyEl.innerHTML = renderPrintCardLayout(r, payload.FamilyCards || []);
                    bindPrintCardUi(r, payload.FamilyCards || []);
                }
                syncPrintCardButton();
                loadRecords();
                return recordsSweetAlert(
                    "success",
                    "Assignment saved",
                    isFamily
                        ? "Print and assignment details were saved for family card #" + id + "."
                        : "Print and assignment details were saved for record #" + id + "."
                );
            })
            .catch(function (err) {
                var msg = (err && err.message) || "Could not save assignment.";
                showPrintAssignError(msg);
                return recordsSweetAlert("error", "Save failed", msg);
            })
            .finally(function () {
                if (btn) {
                    btn.disabled = false;
                    btn.textContent = label;
                }
            });
    }

    function showFamilyRecordPrintCard(id) {
        var body = document.getElementById("printCardBody");
        body.innerHTML = '<p class="detail-loading">Loading…</p>';
        printModalScope = "family-only";
        openPrintModal();

        fetchJson(recordsApiUrl("action=detail&id=" + encodeURIComponent(id)), { cache: "no-store" })
            .then(function (payload) {
                if (!payload || !payload.Ok) {
                    body.innerHTML =
                        "<p class=\"detail-loading\">" + esc((payload && payload.Error) || "Unable to load record.") + "</p>";
                    return;
                }
                var family = (payload.FamilyCards && payload.FamilyCards[0]) || null;
                if (!family && payload.Record) {
                    family = {
                        Id: payload.Record.Id,
                        EmpId: payload.Record.EmpId,
                        CardName: payload.Record.EmployeeName,
                        RfidNumber: payload.Record.RfidNumber,
                        Etag: payload.Record.Etag,
                        IssueDate: payload.Record.IssueDate,
                        ExpiryDate: payload.Record.ExpiryDate,
                        IssuedBy: payload.Record.IssuedBy,
                        PrintDate: payload.Record.PrintDate,
                        CreatedDate: payload.Record.CreatedDate,
                        Status: payload.Record.Status,
                        Cnic: payload.Record.Cnic,
                        PhotoPath: payload.Record.PhotoPath
                    };
                }
                if (!family) {
                    body.innerHTML = "<p class=\"detail-loading\">Unable to load family card.</p>";
                    return;
                }
                body.innerHTML = renderFamilyStandalonePrintLayout(family);
                bindFamilyStandalonePrintUi(family);
                syncPrintCardButton();
            })
            .catch(function (err) {
                body.innerHTML =
                    "<p class=\"detail-loading\">" + esc((err && err.message) || "Network error while loading record.") + "</p>";
            });
    }

    function assignGridRfidDraftForEmp(empId) {
        if (!empId) {
            return "";
        }
        var input = document.querySelector('.assign-rfid-input[data-emp-id="' + empId + '"]');
        return input ? String(input.value || "").trim() : "";
    }

    function mergeAssignGridRowForPrint(record, empId) {
        if (!record || !empId) {
            return record;
        }
        var draft = assignGridRfidDraftForEmp(empId);
        if (draft) {
            record.RfidNumber = draft;
        }
        var row = findCachedByEmpId(empId);
        if (!row) {
            return record;
        }
        function fillIfEmpty(field) {
            var cur = recordField(record, field);
            if (cur) {
                return;
            }
            var fromGrid = recordField(row, field);
            if (fromGrid) {
                record[field] = fromGrid;
            }
        }
        fillIfEmpty("Id");
        fillIfEmpty("PrintDate");
        fillIfEmpty("ExpiryDate");
        fillIfEmpty("Status");
        fillIfEmpty("IssuedBy");
        if (!recordField(record, "IssueDate") && recordField(record, "PrintDate")) {
            record.IssueDate = recordField(record, "PrintDate");
        }
        fillIfEmpty("IssueDate");
        fillIfEmpty("RfidNumber");
        if (isAssignRecordsScope()) {
            if (!recordField(record, "PrintDate")) {
                record.PrintDate = todayIsoDateLocal();
            }
            if (!recordField(record, "IssueDate")) {
                record.IssueDate = recordField(record, "PrintDate") || todayIsoDateLocal();
            }
        }
        return record;
    }

    function refreshPrintCardPreview(record, family) {
        var bodyEl = document.getElementById("printCardBody");
        if (!bodyEl || !record) {
            return;
        }
        family = family || [];
        bodyEl.innerHTML = renderPrintCardLayout(record, family);
        bindPrintCardUi(record, family);
        syncPrintCardButton();
    }

    function showPrintCard(id, options) {
        options = options || {};
        if (isFamilyRecordsScope()) {
            showFamilyRecordPrintCard(id);
            return;
        }
        var body = document.getElementById("printCardBody");
        body.innerHTML = '<p class="detail-loading">Loading…</p>';
        openPrintModal();

        var empId = (options.empId || "").trim();
        var detailUrl;
        if (isAssignRecordsScope()) {
            if (!empId) {
                body.innerHTML = '<p class="detail-loading">Employee ID is missing for print.</p>';
                return;
            }
            detailUrl = recordsApiUrl("action=assignempdetail&empId=" + encodeURIComponent(empId));
        } else if (parseActionRecordId(id)) {
            detailUrl = recordsApiUrl("action=detail&id=" + encodeURIComponent(parseActionRecordId(id)));
        } else {
            body.innerHTML = '<p class="detail-loading">A valid record ID is required.</p>';
            return;
        }

        fetchJson(detailUrl, { cache: "no-store" })
            .then(function (payload) {
                if (!payload || !payload.Ok || !payload.Record) {
                    body.innerHTML = "<p class=\"detail-loading\">" + esc((payload && payload.Error) || "Unable to load record.") + "</p>";
                    return;
                }
                var record = mergeAssignGridRowForPrint(
                    payload.Record,
                    empId || recordField(payload.Record, "EmpId")
                );
                var family = payload.FamilyCards || [];
                refreshPrintCardPreview(record, family);
            })
            .catch(function (err) {
                body.innerHTML = "<p class=\"detail-loading\">" + esc((err && err.message) || "Network error while loading record.") + "</p>";
            });
    }

    function setEditPhotoPreview(path, empId) {
        var img = document.getElementById("editPhotoImg");
        var ph = document.getElementById("editPhotoPh");
        if (!empId) {
            var empEl = document.getElementById("editEmpId");
            empId = empEl ? empEl.value : "";
        }
        var url = resolvePhotoUrl(path, empId);
        var fallback = resolvePhotoFallback(path, empId);
        if (!img || !ph) return;
        if (!url) {
            img.classList.add("is-hidden");
            img.removeAttribute("src");
            ph.classList.remove("is-hidden");
            return;
        }
        img.onload = function () {
            img.classList.remove("is-hidden");
            ph.classList.add("is-hidden");
        };
        img.onerror = function () {
            if (fallback && img.dataset.fallback !== "1") {
                img.dataset.fallback = "1";
                img.src = fallback;
                return;
            }
            img.classList.add("is-hidden");
            ph.classList.remove("is-hidden");
        };
        img.dataset.fallback = "0";
        img.src = url;
    }

    function openEditModal() {
        document.getElementById("editModal").classList.remove("is-hidden");
        document.body.style.overflow = "hidden";
    }

    function closeEditModal() {
        document.getElementById("editModal").classList.add("is-hidden");
        if (
            document.getElementById("detailModal").classList.contains("is-hidden") &&
            document.getElementById("printCardModal").classList.contains("is-hidden")
        ) {
            document.body.style.overflow = "";
        }
        var file = document.getElementById("editPhotoFile");
        if (file) file.value = "";
        hideEditError();
    }

    function showEditError(msg) {
        var el = document.getElementById("editFormError");
        if (!el) return;
        el.textContent = msg || "";
        el.classList.toggle("is-hidden", !msg);
    }

    function hideEditError() {
        showEditError("");
    }

    function setEditUiMode(mode) {
        var isFamily = mode === "family";
        var empPanel = document.getElementById("editEmployeeFieldsPanel");
        var famPanel = document.getElementById("editFamilyFieldsPanel");
        var eyebrow = document.getElementById("editModalEyebrow");
        if (empPanel) empPanel.classList.toggle("is-hidden", isFamily);
        if (famPanel) famPanel.classList.toggle("is-hidden", !isFamily);
        if (eyebrow) {
            eyebrow.textContent = isFamily ? "Edit family card profile" : "Edit employee profile";
        }
    }

    function populateFamilyEditForm(record, family) {
        family = family || {};
        setEditUiMode("family");
        document.getElementById("editRecordId").value = record.Id != null ? String(record.Id) : "";
        document.getElementById("editPhotoPath").value = record.PhotoPath || family.PhotoPath || "";
        document.getElementById("editFamilyEmpId").value = record.EmpId || family.EmpId || "";
        document.getElementById("editFamilyCardName").value = record.EmployeeName || family.CardName || "";
        document.getElementById("editFamilyCnic").value = record.Cnic || family.Cnic || "";
        document.getElementById("editFamilyCardId").value = family.CardId || record.CardId || "";
        var relEl = document.getElementById("editFamilyRelationship");
        var rel = (family.Relationship || record.Relationship || "").trim().toUpperCase();
        if (relEl) {
            relEl.value = rel;
            if (rel && relEl.value !== rel) {
                relEl.value = "OTHER";
            }
        }

        var name = (record.EmployeeName || family.CardName || "").trim() || record.EmpId || "Family member";
        document.getElementById("editModalTitle").textContent = name;
        document.getElementById("editModalSub").textContent =
            "Record #" + (record.Id || "—") + " · Employee ID " + (record.EmpId || "—");

        setEditPhotoPreview(record.PhotoPath || family.PhotoPath || "");
    }

    function populateEditForm(record) {
        setEditUiMode("employee");
        document.getElementById("editRecordId").value = record.Id != null ? String(record.Id) : "";
        document.getElementById("editPhotoPath").value = record.PhotoPath || "";
        document.getElementById("editEmpId").value = record.EmpId || "";
        document.getElementById("editName").value = record.EmployeeName || "";
        document.getElementById("editDesignation").value = record.Designation || "";
        document.getElementById("editDepartment").value = record.Department || "";
        document.getElementById("editProject").value = record.ProjectLocation || "";
        document.getElementById("editJoiningDate").value = displayDateToIso(record.JoiningDate);
        document.getElementById("editBloodGroup").value = record.BloodGroup || "";
        document.getElementById("editCnic").value = record.Cnic || "";
        document.getElementById("editEmergencyNo").value = record.EmergencyNo || "";

        var name = (record.EmployeeName || "").trim() || record.EmpId || "Employee";
        document.getElementById("editModalTitle").textContent = name;
        document.getElementById("editModalSub").textContent =
            "Record #" + (record.Id || "—") + " · Employee ID " + (record.EmpId || "—");

        setEditPhotoPreview(record.PhotoPath || "");
    }

    function resetEditForm() {
        var ids = [
            "editRecordId", "editPhotoPath", "editEmpId", "editName", "editDesignation",
            "editDepartment", "editProject", "editJoiningDate", "editBloodGroup", "editCnic", "editEmergencyNo",
            "editFamilyEmpId", "editFamilyCardName", "editFamilyCnic", "editFamilyCardId"
        ];
        ids.forEach(function (elId) {
            var el = document.getElementById(elId);
            if (el) el.value = "";
        });
        var relEl = document.getElementById("editFamilyRelationship");
        if (relEl) relEl.value = "";
        var file = document.getElementById("editPhotoFile");
        if (file) file.value = "";
        setEditPhotoPreview("");
        setEditUiMode(isFamilyRecordsScope() ? "family" : "employee");
    }

    function showEdit(id) {
        hideEditError();
        resetEditForm();
        openEditModal();
        document.getElementById("editModalTitle").textContent = "Loading…";
        document.getElementById("editModalSub").textContent = "Record #" + id;

        fetchJson(recordsApiUrl("action=detail&id=" + encodeURIComponent(id)), { cache: "no-store" })
            .then(function (payload) {
                if (!payload || !payload.Ok || !payload.Record) {
                    showEditError((payload && payload.Error) || "Unable to load record.");
                    return;
                }
                if (isFamilyRecordsScope()) {
                    populateFamilyEditForm(payload.Record, (payload.FamilyCards && payload.FamilyCards[0]) || null);
                } else {
                    populateEditForm(payload.Record);
                }
            })
            .catch(function (err) {
                showEditError((err && err.message) || "Network error while loading record.");
            });
    }

    function saveEditProfile(e) {
        if (e && e.preventDefault) e.preventDefault();
        hideEditError();
        var id = (document.getElementById("editRecordId").value || "").trim();
        if (!id) {
            showEditError("Record is still loading. Wait a moment and try again.");
            return;
        }

        if (isFamilyRecordsScope()) {
            var cardName = (document.getElementById("editFamilyCardName").value || "").trim();
            var relationship = (document.getElementById("editFamilyRelationship").value || "").trim();
            if (!cardName) {
                showEditError("Card holder name is required.");
                return;
            }
            if (!relationship) {
                showEditError("Relationship is required.");
                return;
            }
        }

        var btn = document.getElementById("btnSaveEdit");
        var btnLabel = btn.textContent;
        btn.disabled = true;
        btn.textContent = "Saving…";

        function postProfile(photoPath) {
            var body = new URLSearchParams();
            body.append("id", id);
            body.append("photoPath", photoPath || "");
            var action;
            if (isFamilyRecordsScope()) {
                action = "action=updatefamilyprofile";
                body.append("cardName", document.getElementById("editFamilyCardName").value.trim());
                body.append("relationship", document.getElementById("editFamilyRelationship").value.trim());
                body.append("cnic", document.getElementById("editFamilyCnic").value.trim());
            } else {
                action = "action=updateprofile";
                body.append("employeeName", document.getElementById("editName").value.trim());
                body.append("designation", document.getElementById("editDesignation").value.trim());
                body.append("department", document.getElementById("editDepartment").value.trim());
                body.append("projectLocation", document.getElementById("editProject").value.trim());
                body.append("joiningDate", document.getElementById("editJoiningDate").value.trim());
                body.append("bloodGroup", document.getElementById("editBloodGroup").value.trim());
                body.append("cnic", document.getElementById("editCnic").value.trim());
                body.append("emergencyNo", document.getElementById("editEmergencyNo").value.trim());
            }

            return fetchJson(recordsApiUrl(action), {
                method: "POST",
                headers: { "Content-Type": "application/x-www-form-urlencoded" },
                body: body.toString(),
                credentials: "same-origin"
            });
        }

        var fileInput = document.getElementById("editPhotoFile");
        var file = fileInput && fileInput.files && fileInput.files[0];
        var pathPromise;

        if (file && window.RfidPhotos && window.RfidPhotos.uploadFile) {
            var photoCategory = isFamilyRecordsScope() ? "family" : "employee";
            pathPromise = window.RfidPhotos.uploadFile(file, { category: photoCategory }).then(function (data) {
                if (!data || !data.ok) {
                    throw new Error((data && data.error) || "Photo upload failed.");
                }
                document.getElementById("editPhotoPath").value = data.path || "";
                return data.path || document.getElementById("editPhotoPath").value;
            });
        } else {
            pathPromise = Promise.resolve(document.getElementById("editPhotoPath").value.trim());
        }

        pathPromise
            .then(postProfile)
            .then(function (payload) {
                if (!apiOk(payload) || !payload.Record) {
                    throw new Error(apiError(payload) || "Save failed. Rebuild the web project so updateprofile is deployed.");
                }
                closeEditModal();
                showAlert(
                    isFamilyRecordsScope()
                        ? "Family card profile saved for record #" + id + "."
                        : "Employee profile saved for record #" + id + ".",
                    false
                );
                loadRecords();
            })
            .catch(function (err) {
                showEditError(err.message || "Could not save changes.");
            })
            .finally(function () {
                btn.disabled = false;
                btn.textContent = btnLabel;
            });
    }

    function cr80FamilyPrintInlineCss() {
        return (
            "@page { size: 540px 340px; margin: 0 !important; }" +
            "*, *::before, *::after { box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }" +
            "html, body { margin: 0 !important; padding: 0 !important; width: 540px !important; height: auto !important; background: #fff !important; overflow: visible !important; }" +
            ".card-print-root { display: block !important; width: 540px !important; margin: 0 !important; padding: 0 !important; }" +
            ".card-print-page--family-front, .card-print-page--family-back { display: block !important; width: 540px !important; height: 340px !important; margin: 0 !important; padding: 0 !important; overflow: hidden !important; page-break-inside: avoid !important; break-inside: avoid !important; page-break-before: auto !important; break-before: auto !important; }" +
            ".card-print-page--family-front { page-break-after: always !important; break-after: page !important; }" +
            ".card-print-page--family-back { page-break-after: auto !important; break-after: auto !important; }" +
            ".family-id-card-aspect { width: 540px !important; height: 340px !important; min-width: 540px !important; min-height: 340px !important; margin: 0 !important; padding: 0 !important; border-radius: 0 !important; box-shadow: none !important; transform: none !important; overflow: hidden !important; }" +
            ".family-id-card-front { display: flex !important; flex-direction: column !important; justify-content: space-between !important; height: 340px !important; }" +
            ".family-id-card-back, .family-id-card-back-side { display: block !important; height: 340px !important; }" +
            "body.print-family-card-preview > .card-print-root { display: block !important; visibility: visible !important; }" +
            ".family-id-card-back p,.family-id-card-back li{font-family:Arial,Helvetica,sans-serif!important;" +
            "letter-spacing:0!important;word-spacing:normal!important;white-space:normal!important;" +
            "word-break:normal!important;font-kerning:normal!important;font-variant-ligatures:none!important;}" +
            ".family-id-card-back__qr{mix-blend-mode:normal!important;background:#fff!important;" +
            "-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important;}" +
            cr80PdfCaptureOverrideCss("family")
        );
    }

    function waitForDocumentImages(doc, timeoutMs) {
        timeoutMs = timeoutMs || 10000;
        if (!doc) return Promise.resolve();
        var imgs = doc.querySelectorAll("img");
        var waits = [];
        for (var i = 0; i < imgs.length; i++) {
            (function (img) {
                var src = img.getAttribute("src");
                if (!src || !String(src).trim()) return;
                if (img.classList.contains("family-id-card-back__qr")) {
                    if (isFamilyQrPlaceholderSrc(src)) return;
                    if (String(src).indexOf("data:image") === 0 && img.complete && img.naturalWidth >= 32) return;
                }
                if (img.complete && img.naturalWidth > 0) return;
                waits.push(
                    new Promise(function (resolve) {
                        function done() {
                            resolve();
                        }
                        img.addEventListener("load", done, { once: true });
                        img.addEventListener("error", done, { once: true });
                        setTimeout(done, timeoutMs);
                    })
                );
            })(imgs[i]);
        }
        if (!waits.length) return Promise.resolve();
        return Promise.all(waits);
    }

    function absolutizeDocumentImages(doc, baseHref) {
        if (!doc || !baseHref) return;
        var imgs = doc.querySelectorAll("img[src]");
        for (var i = 0; i < imgs.length; i++) {
            var img = imgs[i];
            var src = img.getAttribute("src");
            if (!src || /^data:|^https?:|^\/\//i.test(src)) continue;
            try {
                img.setAttribute("src", new URL(src, baseHref).href);
            } catch (e) {
                /* keep original */
            }
        }
    }

    var HEADER_LOGO_DARKEN_BRIGHTNESS = 0.82;
    var HEADER_LOGO_DARKEN_CONTRAST = 1.08;

    function applyHeaderLogoDarkenToImageData(imageData) {
        var d = imageData.data;
        var bright = HEADER_LOGO_DARKEN_BRIGHTNESS;
        var contrast = HEADER_LOGO_DARKEN_CONTRAST;
        var i;
        for (i = 0; i < d.length; i += 4) {
            if (d[i + 3] === 0) continue;
            var r = d[i] * bright;
            var g = d[i + 1] * bright;
            var b = d[i + 2] * bright;
            r = ((r / 255 - 0.5) * contrast + 0.5) * 255;
            g = ((g / 255 - 0.5) * contrast + 0.5) * 255;
            b = ((b / 255 - 0.5) * contrast + 0.5) * 255;
            d[i] = Math.max(0, Math.min(255, Math.round(r)));
            d[i + 1] = Math.max(0, Math.min(255, Math.round(g)));
            d[i + 2] = Math.max(0, Math.min(255, Math.round(b)));
        }
        return imageData;
    }

    function isHeaderLogoImg(imgEl) {
        return !!(imgEl && imgEl.closest && imgEl.closest(".header-logo"));
    }

    function canvasImageToDataUrl(imgEl, options) {
        options = options || {};
        if (!imgEl || !imgEl.complete || !imgEl.naturalWidth) return null;
        try {
            var canvas = document.createElement("canvas");
            canvas.width = imgEl.naturalWidth;
            canvas.height = imgEl.naturalHeight;
            var ctx = canvas.getContext("2d");
            ctx.drawImage(imgEl, 0, 0);
            if (options.headerLogoDarken || isHeaderLogoImg(imgEl)) {
                var imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                ctx.putImageData(applyHeaderLogoDarkenToImageData(imageData), 0, 0);
            }
            return canvas.toDataURL("image/png");
        } catch (e) {
            return null;
        }
    }

    function dataUrlWithHeaderLogoDarken(dataUrl) {
        if (!dataUrl || String(dataUrl).indexOf("data:") !== 0) {
            return Promise.resolve(dataUrl);
        }
        return new Promise(function (resolve) {
            var img = new Image();
            img.onload = function () {
                resolve(canvasImageToDataUrl(img, { headerLogoDarken: true }) || dataUrl);
            };
            img.onerror = function () {
                resolve(dataUrl);
            };
            img.src = dataUrl;
        });
    }

    function pdfProxyEmployeePhotoSrc(src, iframeImg) {
        if (!src) return src;
        if (String(src).indexOf("EmpHrPhoto.ashx") >= 0) return src;
        var empId = iframeImg && iframeImg.getAttribute ? iframeImg.getAttribute("data-emp-id") : "";
        if (!empId) {
            var eimgMatch = String(src).match(/EImages\/([^/?#]+)\.(jpg|jpeg|png)/i);
            if (eimgMatch) {
                empId = eimgMatch[1];
            }
        }
        if (empId && (String(src).indexOf("172.16.10.54") >= 0 || /EImages\//i.test(src))) {
            return appRoot() + "EmpHrPhoto.ashx?empId=" + encodeURIComponent(String(empId).trim());
        }
        return src;
    }

    function fetchResourceAsDataUrl(url) {
        if (!url) return Promise.resolve(null);
        if (String(url).indexOf("data:") === 0) return Promise.resolve(url);
        return fetch(url, { credentials: "same-origin", cache: "force-cache" })
            .then(function (response) {
                if (!response.ok) throw new Error("fetch failed");
                return response.blob();
            })
            .then(function (blob) {
                return new Promise(function (resolve, reject) {
                    var reader = new FileReader();
                    reader.onload = function () {
                        resolve(reader.result);
                    };
                    reader.onerror = reject;
                    reader.readAsDataURL(blob);
                });
            })
            .catch(function () {
                return null;
            });
    }

    function findPreviewImageForPdf(previewRoot, iframeImg) {
        if (!previewRoot || !iframeImg) return null;
        var className = iframeImg.className || "";
        var parts = className.split(/\s+/).filter(Boolean);
        var i;
        for (i = 0; i < parts.length; i++) {
            var byClass = previewRoot.querySelector("img." + parts[i]);
            if (byClass) return byClass;
        }
        if (iframeImg.closest(".family-id-card-front__photo")) {
            return previewRoot.querySelector(".family-id-card-front__photo img");
        }
        if (iframeImg.closest(".header-photo")) {
            return previewRoot.querySelector(".header-photo img");
        }
        if (iframeImg.closest(".header-logo")) {
            return previewRoot.querySelector(".header-logo img");
        }
        var iframeSrc = iframeImg.getAttribute("src") || "";
        var previewImgs = previewRoot.querySelectorAll("img");
        for (i = 0; i < previewImgs.length; i++) {
            var p = previewImgs[i];
            if (p.getAttribute("src") === iframeSrc || p.src === iframeImg.src) return p;
        }
        return null;
    }

    function prepareIframeImagesForPdf(idoc, previewRoot) {
        if (!idoc) return Promise.resolve();
        var iframeImgs = idoc.querySelectorAll("img[src]");
        var tasks = [];
        Array.prototype.forEach.call(iframeImgs, function (iframeImg) {
            tasks.push(
                new Promise(function (resolve) {
                    var isLogo = isHeaderLogoImg(iframeImg);
                    var previewImg = previewRoot ? findPreviewImageForPdf(previewRoot, iframeImg) : null;
                    var embedded = previewImg
                        ? canvasImageToDataUrl(previewImg, { headerLogoDarken: isLogo })
                        : null;
                    if (embedded) {
                        iframeImg.setAttribute("src", embedded);
                        resolve();
                        return;
                    }
                    if (iframeImg.classList.contains("family-id-card-back__qr")) {
                        var qrPayload = familyQrPayloadFromImg(iframeImg);
                        if (!qrPayload && previewImg) {
                            qrPayload = familyQrPayloadFromImg(previewImg);
                        }
                        var qrSrc = iframeImg.getAttribute("src") || "";
                        if (
                            qrPayload &&
                            (isFamilyQrPlaceholderSrc(qrSrc) || String(qrSrc).indexOf("data:image") !== 0)
                        ) {
                            generateFamilyQrDataUrl(qrPayload).then(function (dataUrl) {
                                if (dataUrl) iframeImg.setAttribute("src", dataUrl);
                                resolve();
                            });
                            return;
                        }
                        if (String(qrSrc).indexOf("data:image") === 0 && !isFamilyQrPlaceholderSrc(qrSrc)) {
                            resolve();
                            return;
                        }
                    }
                    var src = iframeImg.getAttribute("src") || "";
                    if (isFamilyQrPlaceholderSrc(src)) {
                        resolve();
                        return;
                    }
                    src = pdfProxyEmployeePhotoSrc(src, iframeImg);
                    try {
                        if (String(src).indexOf("data:") !== 0 && String(src).indexOf("http") !== 0) {
                            src = new URL(src, appRoot()).href;
                        }
                    } catch (urlErr) {
                        /* keep src */
                    }
                    fetchResourceAsDataUrl(src).then(function (dataUrl) {
                        if (!dataUrl) {
                            resolve();
                            return;
                        }
                        if (isLogo) {
                            dataUrlWithHeaderLogoDarken(dataUrl).then(function (darkUrl) {
                                if (darkUrl) iframeImg.setAttribute("src", darkUrl);
                                resolve();
                            });
                            return;
                        }
                        iframeImg.setAttribute("src", dataUrl);
                        resolve();
                    });
                })
            );
        });
        return Promise.all(tasks);
    }

    function cr80PdfCaptureOverrideCss(printKind) {
        var w = printKind === "family" ? 540 : 330;
        var h = printKind === "family" ? 340 : 520;
        return (
            "body.print-card-preview > .card-print-root," +
            "body.print-family-card-preview > .card-print-root{" +
            "display:block!important;visibility:visible!important;position:relative!important;" +
            "width:" + w + "px!important;margin:0!important;padding:0!important;}" +
            "body.print-card-preview .card-print-page," +
            "body.print-family-card-preview .card-print-page{" +
            "display:block!important;visibility:visible!important;" +
            "width:" + w + "px!important;height:" + h + "px!important;" +
            "min-width:" + w + "px!important;min-height:" + h + "px!important;" +
            "max-width:" + w + "px!important;max-height:" + h + "px!important;" +
            "overflow:hidden!important;box-sizing:border-box!important;}" +
            "body.print-card-preview .card-print-root .id-card," +
            "body.print-family-card-preview .card-print-root .id-card," +
            "body.print-family-card-preview .family-id-card-aspect{" +
            "width:" + w + "px!important;height:" + h + "px!important;" +
            "box-shadow:none!important;transform:none!important;}"
        );
    }

    function cr80EmployeePrintInlineCss() {
        return (
            "@page { size: 330px 520px; margin: 0 !important; }" +
            "*, *::before, *::after { box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }" +
            "html, body { margin: 0 !important; padding: 0 !important; width: 330px !important; height: auto !important; background: #fff !important; overflow: visible !important; }" +
            ".card-print-root { display: block !important; width: 330px !important; margin: 0 !important; padding: 0 !important; }" +
            "body.print-card-preview > .card-print-root { display: block !important; visibility: visible !important; }" +
            ".card-print-page--front, .card-print-page--back { display: block !important; width: 330px !important; height: 520px !important; min-height: 520px !important; max-height: 520px !important; margin: 0 !important; padding: 0 !important; overflow: hidden !important; page-break-inside: avoid !important; break-inside: avoid !important; }" +
            ".card-print-page--front { page-break-after: always !important; break-after: page !important; }" +
            ".card-print-page--back { page-break-after: auto !important; break-after: auto !important; }" +
            ".card-print-root .id-card { width: 330px !important; height: 520px !important; min-width: 330px !important; min-height: 520px !important; max-width: 330px !important; max-height: 520px !important; box-shadow: none !important; transform: none !important; margin: 0 !important; }" +
            ".card-print-root .id-card.front-card,.card-print-root .front-card{background-color:#d5bd73!important;-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important;}" +
            ".card-print-root .grade-badge{background-color:#b8985a!important;-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important;}" +
            ".card-print-root .header-logo img,.card-print-root .header-logo img{filter:brightness(0.82) contrast(1.08)!important;-webkit-filter:brightness(0.82) contrast(1.08)!important;}" +
            cr80PdfCaptureOverrideCss("employee")
        );
    }

    function buildCr80PrintDocumentHtml(options) {
        options = options || {};
        var bodyClass = options.bodyClass || "print-card-preview";
        var rootOuterHtml = options.rootHtml || "";
        var siteCss = appRoot() + "Site.css?v=18";
        var empCardCss = appRoot() + "Content/emp-id-card.css?v=10";
        var baseHref = appRoot();
        var inline =
            options.printKind === "family" ? cr80FamilyPrintInlineCss() : cr80EmployeePrintInlineCss();
        return (
            "<!DOCTYPE html><html lang=\"en\" class=\"" + bodyClass + "\"><head><meta charset=\"utf-8\" />" +
            "<base href=\"" + baseHref.replace(/"/g, "%22") + "\" />" +
            "<title>CR80 ID Card</title>" +
            "<link rel=\"stylesheet\" href=\"" + siteCss + "\" />" +
            (options.printKind === "family" ? "" : ("<link rel=\"stylesheet\" href=\"" + empCardCss + "\" />")) +
            "<style>" + inline + "</style></head>" +
            "<body class=\"" + bodyClass + "\">" +
            rootOuterHtml +
            "</body></html>"
        );
    }

    function mountCr80PrintDocument(options, onReady) {
        options = options || {};
        var root = options.root;
        if (!root || typeof onReady !== "function") return null;

        var printKind = options.printKind || "employee";
        var pageW = printKind === "family" ? 540 : 330;
        var pageH = printKind === "family" ? 340 : 520;
        var forPdf = !!options.forPdf;

        var iframe = document.createElement("iframe");
        iframe.setAttribute("title", forPdf ? "CR80 PDF" : "CR80 print");
        iframe.setAttribute("aria-hidden", "true");
        if (forPdf) {
            iframe.style.cssText =
                "position:fixed;left:0;top:0;width:" + pageW + "px;height:" + (pageH * 2 + 40) +
                "px;border:0;opacity:0;pointer-events:none;z-index:-1;overflow:hidden;";
        } else {
            iframe.style.cssText =
                "position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden;pointer-events:none;";
        }
        document.body.appendChild(iframe);

        var html = buildCr80PrintDocumentHtml({
            bodyClass: options.bodyClass || "print-card-preview",
            printKind: printKind,
            rootHtml: root.outerHTML
        });

        var win = iframe.contentWindow;
        var idoc = win.document;
        idoc.open();
        idoc.write(html);
        idoc.close();
        if (forPdf) {
            try {
                absolutizeDocumentImages(idoc, win.location.href);
            } catch (absErr) {
                /* ignore */
            }
        }

        function cleanup() {
            setTimeout(function () {
                if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
            }, forPdf ? 200 : 3000);
        }

        var fired = false;
        function fireReady() {
            if (fired) return;
            fired = true;
            onReady({
                iframe: iframe,
                win: win,
                idoc: idoc,
                cleanup: cleanup,
                printKind: printKind,
                pageW: pageW,
                pageH: pageH,
                previewSource: options.previewSource || null
            });
        }

        var links = idoc.querySelectorAll('link[rel="stylesheet"]');
        var afterCssMs = forPdf ? 900 : 120;
        var fallbackMs = forPdf ? 5500 : 2800;
        if (!links.length) {
            setTimeout(fireReady, forPdf ? 1500 : fallbackMs);
        } else {
            links.forEach(function (link) {
                link.addEventListener("load", function () {
                    setTimeout(fireReady, afterCssMs);
                });
                link.addEventListener("error", function () {
                    setTimeout(fireReady, afterCssMs);
                });
            });
            setTimeout(fireReady, fallbackMs);
        }

        return iframe;
    }

    function printCr80InIframe(options) {
        options = options || {};
        if (!options.root) return;

        mountCr80PrintDocument(options, function (ctx) {
            prepareIframeImagesForPdf(ctx.idoc, options.previewSource || null)
                .then(function () {
                    return waitForDocumentImages(ctx.idoc, 12000);
                })
                .then(function () {
                    ctx.win.focus();
                    ctx.win.print();
                })
                .catch(function () {
                    try {
                        ctx.win.focus();
                        ctx.win.print();
                    } catch (printErr) {
                        /* ignore */
                    }
                })
                .finally(function () {
                    ctx.cleanup();
                });
        });
    }

    function cr80PdfFilename(printKind) {
        var isFamily = printKind === "family";
        var rfidEl = document.getElementById(isFamily ? "printFamilyRfidNumber" : "printCardRfidNumber");
        var idEl = document.getElementById(isFamily ? "printFamilyRecordId" : "printCardRecordId");
        var part =
            (rfidEl && rfidEl.value && String(rfidEl.value).trim()) ||
            (idEl && idEl.value && String(idEl.value).trim()) ||
            "card";
        part = String(part).replace(/[^\w\-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
        if (!part) part = "card";
        return (isFamily ? "family-id-" : "employee-id-") + part + ".pdf";
    }

    function downloadCr80PdfFromDocument(ctx) {
        var jsPDF = window.jspdf && window.jspdf.jsPDF;
        var html2canvas = window.html2canvas;
        if (!jsPDF || !html2canvas) {
            recordsSweetAlert(
                "error",
                "PDF unavailable",
                "PDF libraries did not load. Refresh the page and try again."
            );
            ctx.cleanup();
            return;
        }
        var rootEl = ctx.idoc.querySelector(".card-print-root");
        if (!rootEl) {
            recordsSweetAlert("error", "PDF failed", "Card content was not found.");
            ctx.cleanup();
            return;
        }

        var btnPdf = document.getElementById("btnDownloadCardPdf");
        setPrintActionButtonState(btnPdf, false, "Generating PDF…");
        if (btnPdf) btnPdf.textContent = "Generating…";

        function finishPdfUi() {
            if (btnPdf) btnPdf.innerHTML = svgPdf + " Download PDF";
            syncPrintCardButton();
            ctx.cleanup();
        }

        prepareIframeImagesForPdf(ctx.idoc, ctx.previewSource)
            .then(function () {
                return waitForDocumentImages(ctx.idoc, 12000);
            })
            .then(function () {
                rootEl.style.setProperty("display", "block", "important");
                rootEl.style.setProperty("visibility", "visible", "important");

                var pages = Array.prototype.slice.call(rootEl.querySelectorAll(".card-print-page"));
                if (!pages.length) pages = [rootEl];

                var orientation = ctx.pageW > ctx.pageH ? "landscape" : "portrait";
                var pdf = new jsPDF({
                    unit: "px",
                    format: [ctx.pageW, ctx.pageH],
                    orientation: orientation,
                    compress: true
                });

                var chain = Promise.resolve();
                pages.forEach(function (page, index) {
                    chain = chain.then(function () {
                        page.style.setProperty("display", "block", "important");
                        page.style.setProperty("visibility", "visible", "important");
                        return html2canvas(page, {
                            scale: 2,
                            useCORS: true,
                            allowTaint: true,
                            backgroundColor: "#ffffff",
                            logging: false,
                            width: ctx.pageW,
                            height: ctx.pageH,
                            windowWidth: ctx.pageW,
                            windowHeight: ctx.pageH,
                            scrollX: 0,
                            scrollY: 0,
                            window: ctx.win
                        }).then(function (canvas) {
                            if (!canvas || !canvas.width) {
                                throw new Error("Empty card capture.");
                            }
                            var imgData = canvas.toDataURL("image/jpeg", 0.98);
                            if (index > 0) {
                                pdf.addPage([ctx.pageW, ctx.pageH], orientation);
                            }
                            pdf.addImage(imgData, "JPEG", 0, 0, ctx.pageW, ctx.pageH, undefined, "FAST");
                        });
                    });
                });

                return chain.then(function () {
                    pdf.save(cr80PdfFilename(ctx.printKind));
                    finishPdfUi();
                });
            })
            .catch(function (err) {
                finishPdfUi();
                recordsSweetAlert(
                    "error",
                    "PDF failed",
                    (err && err.message) || "Could not generate PDF. Try Print → Save as PDF."
                );
            });
    }

    function downloadCr80InIframe(options) {
        options = options || {};
        if (!options.root) return;
        options.forPdf = true;
        mountCr80PrintDocument(options, downloadCr80PdfFromDocument);
    }

    function buildEmployeeCr80PrintRoot(area) {
        var front = area.querySelector(".front-card");
        var back = area.querySelector(".back-card");
        if (!front || !back) return null;

        var root = document.createElement("div");
        root.className = "card-print-root";

        var pageFront = document.createElement("div");
        pageFront.className = "card-print-page card-print-page--front";
        pageFront.appendChild(front.cloneNode(true));

        var pageBack = document.createElement("div");
        pageBack.className = "card-print-page card-print-page--back";
        pageBack.appendChild(back.cloneNode(true));

        root.appendChild(pageFront);
        root.appendChild(pageBack);
        return root;
    }

    function buildFamilyCr80PrintRoot(area) {
        var front = area.querySelector(".family-id-card-front-side");
        var back = area.querySelector(".family-id-card-back-side");
        if (!front || !back) return null;

        var root = document.createElement("div");
        root.className = "card-print-root";

        var pageFront = document.createElement("div");
        pageFront.className = "card-print-page card-print-page--family-front";
        pageFront.appendChild(front.cloneNode(true));

        var pageBack = document.createElement("div");
        pageBack.className = "card-print-page card-print-page--family-back";
        pageBack.appendChild(back.cloneNode(true));

        root.appendChild(pageFront);
        root.appendChild(pageBack);
        return root;
    }

    function printCardPreviewOnly() {
        if (activePrintTab() === "family") {
            printFamilyCardPreviewOnly();
            return;
        }
        if (!printAssignmentIsComplete()) {
            recordsSweetAlert(
                "warning",
                "Complete print & assignment",
                "Fill RFID number, ETAG, print date, and issued by before printing."
            );
            return;
        }
        var area = document.getElementById("printCardPreviewArea");
        if (!area) return;

        var root = buildEmployeeCr80PrintRoot(area);
        if (!root) return;

        printCr80InIframe({
            root: root,
            bodyClass: "print-card-preview",
            printKind: "employee"
        });
    }

    function printFamilyCardPreviewOnly() {
        if (!printFamilyAssignmentIsComplete()) {
            recordsSweetAlert(
                "warning",
                "Complete print & assignment",
                "Fill RFID number, ETAG, print date, and issued by for this family card before printing."
            );
            return;
        }
        var area = document.getElementById("printCardPreviewAreaFamily");
        if (!area) return;

        var familyIdx = getSelectedFamilyCardIndex();
        var familyRecord = printModalFamilyCards[familyIdx] || printModalFamilyCards[0];

        prepareFamilyCr80PrintRoot(area, familyRecord).then(function (root) {
            if (!root) return;

            printCr80InIframe({
                root: root,
                previewSource: area,
                bodyClass: "print-family-card-preview",
                printKind: "family"
            });
        });
    }

    function downloadCardPreviewPdf() {
        if (activePrintTab() === "family") {
            downloadFamilyCardPreviewPdf();
            return;
        }
        if (!printAssignmentIsComplete()) {
            recordsSweetAlert(
                "warning",
                "Complete print & assignment",
                "Fill RFID number, ETAG, print date, and issued by before downloading PDF."
            );
            return;
        }
        var area = document.getElementById("printCardPreviewArea");
        if (!area) return;

        var root = buildEmployeeCr80PrintRoot(area);
        if (!root) return;

        downloadCr80InIframe({
            root: root,
            previewSource: area,
            bodyClass: "print-card-preview",
            printKind: "employee"
        });
    }

    function downloadFamilyCardPreviewPdf() {
        if (!printFamilyAssignmentIsComplete()) {
            recordsSweetAlert(
                "warning",
                "Complete print & assignment",
                "Fill RFID number, ETAG, print date, and issued by for this family card before downloading PDF."
            );
            return;
        }
        var area = document.getElementById("printCardPreviewAreaFamily");
        if (!area) return;

        var familyIdx = getSelectedFamilyCardIndex();
        var familyRecord = printModalFamilyCards[familyIdx] || printModalFamilyCards[0];

        prepareFamilyCr80PrintRoot(area, familyRecord).then(function (root) {
            if (!root) return;

            downloadCr80InIframe({
                root: root,
                previewSource: area,
                bodyClass: "print-family-card-preview",
                printKind: "family"
            });
        });
    }

    function showDetail(id) {
        var body = document.getElementById("detailBody");
        var title = document.getElementById("detailModalTitle");
        if (title) title.textContent = "Record " + id;
        body.innerHTML = '<p class="detail-loading">Loading…</p>';
        openModal();

        fetchJson(recordsApiUrl("action=detail&id=" + encodeURIComponent(id)), { cache: "no-store" })
            .then(function (payload) {
                if (!payload || !payload.Ok || !payload.Record) {
                    body.innerHTML = "<p class=\"detail-loading\">" + esc((payload && payload.Error) || "Unable to load details.") + "</p>";
                    return;
                }
                var r = payload.Record;
                var name = primaryName(r);
                if (title) {
                    if (isFamilyRecordsScope()) {
                        title.textContent = name ? name + " (" + (r.EmpId || "") + ")" : "Family record " + (r.EmpId || "—");
                    } else {
                        title.textContent = name ? name + " (" + (r.EmpId || "") + ")" : "Employee " + (r.EmpId || "—");
                    }
                }
                try {
                    if (isFamilyRecordsScope()) {
                        body.innerHTML = renderFamilyDetail(r, (payload.FamilyCards && payload.FamilyCards[0]) || null);
                    } else {
                        body.innerHTML = renderDetail(r);
                    }
                } catch (renderErr) {
                    body.innerHTML = "<p class=\"detail-loading\">" + esc((renderErr && renderErr.message) || "Could not display record details.") + "</p>";
                }
            })
            .catch(function (err) {
                body.innerHTML = "<p class=\"detail-loading\">" + esc((err && err.message) || "Network error while loading details.") + "</p>";
            });
    }

    var newRequestFormReady = false;

    function recordsFormSaveUrl() {
        var root = window.RFID_APP_ROOT || "./";
        if (root.charAt(root.length - 1) !== "/") root += "/";
        return root + "RfidFormSave.ashx";
    }

    function ensureNewRequestForm() {
        if (!window.RfidForm || newRequestFormReady) return;
        RfidForm.configure({
            ajaxSaveUrl: recordsFormSaveUrl(),
            recordsLookupUrl: recordsApiUrl(""),
            onSaveSuccess: function () {
                closeNewRequestModal();
                loadRecords();
            }
        });
        RfidForm.init();
        newRequestFormReady = true;
        applyNewRequestPermissionUi();
    }

    function applyNewRequestPermissionUi() {
        var saveBtns = [
            document.getElementById("btnNewRequestSave"),
            document.getElementById("btnSaveAside")
        ];
        for (var i = 0; i < saveBtns.length; i++) {
            if (saveBtns[i]) saveBtns[i].style.display = can("formSave") ? "" : "none";
        }
        var clearBtn = document.getElementById("btnClear");
        if (clearBtn) clearBtn.style.display = can("formClear") ? "" : "none";
    }

    function openNewRequestModal() {
        if (!can("form")) return;
        ensureNewRequestForm();
        if (window.RfidForm && RfidForm.openWithMode) RfidForm.openWithMode("default");
        else if (window.RfidForm && RfidForm.resetFormValues) RfidForm.resetFormValues();
        document.getElementById("newRequestModal").classList.remove("is-hidden");
        document.body.style.overflow = "hidden";
    }

    function openAddFamilyModal(empId) {
        if (!can("form")) return;
        ensureNewRequestForm();
        if (window.RfidForm && RfidForm.openWithMode) RfidForm.openWithMode("familyOnly");
        if (empId) {
            var empEl = document.getElementById("txtEmpId");
            if (empEl) {
                empEl.value = String(empId).trim();
                empEl.dispatchEvent(new Event("blur"));
            }
        }
        document.getElementById("newRequestModal").classList.remove("is-hidden");
        document.body.style.overflow = "hidden";
    }

    function closeNewRequestModal() {
        var modal = document.getElementById("newRequestModal");
        if (modal) modal.classList.add("is-hidden");
        var othersOpen = ["detailModal", "printCardModal", "editModal", "statusChangeModal", "voucherModal"].some(function (mid) {
            var m = document.getElementById(mid);
            return m && !m.classList.contains("is-hidden");
        });
        if (!othersOpen) document.body.style.overflow = "";
    }

    function bindEvents() {
        document.getElementById("btnRefreshRecords").addEventListener("click", loadRecords);
        var assignTabs = document.getElementById("assignRecordsTabs");
        if (assignTabs) {
            assignTabs.addEventListener("click", function (e) {
                var btn = e.target.closest(".assign-records-tab");
                if (!btn) return;
                setAssignStatusTab(btn.getAttribute("data-assign-tab"));
            });
        }
        var lnkNew = document.getElementById("lnkNewRequest");
        if (lnkNew) {
            lnkNew.addEventListener("click", function (e) {
                e.preventDefault();
                openNewRequestModal();
            });
        }
        var lnkFam = document.getElementById("lnkAddFamily");
        if (lnkFam) {
            lnkFam.addEventListener("click", function (e) {
                e.preventDefault();
                openAddFamilyModal("");
            });
        }
        var nrClose = document.getElementById("newRequestClose");
        var nrBackdrop = document.getElementById("newRequestBackdrop");
        if (nrClose) nrClose.addEventListener("click", closeNewRequestModal);
        if (nrBackdrop) nrBackdrop.addEventListener("click", closeNewRequestModal);
        var nrCloseFoot = document.getElementById("newRequestCloseFoot");
        if (nrCloseFoot) nrCloseFoot.addEventListener("click", closeNewRequestModal);
        document.getElementById("detailClose").addEventListener("click", closeModal);
        document.getElementById("detailCloseFoot").addEventListener("click", closeModal);
        document.getElementById("detailBackdrop").addEventListener("click", closeModal);
        document.addEventListener("keydown", function (e) {
            if (e.key !== "Escape") return;
            var cap = document.getElementById("captchaModal");
            if (cap && !cap.classList.contains("is-hidden")) return;
            if (!document.getElementById("newRequestModal").classList.contains("is-hidden")) {
                closeNewRequestModal();
                return;
            }
            if (!document.getElementById("statusChangeModal").classList.contains("is-hidden")) {
                closeStatusChangeModal();
                return;
            }
            if (!document.getElementById("printCardModal").classList.contains("is-hidden")) {
                closePrintModal();
                return;
            }
            if (!document.getElementById("voucherModal").classList.contains("is-hidden")) {
                closeVoucherModal();
                return;
            }
            if (!document.getElementById("editModal").classList.contains("is-hidden")) {
                closeEditModal();
                return;
            }
            closeModal();
        });

        $("#recordsTable").on("click", ".btn-edit", function () {
            var id = this.getAttribute("data-id");
            if (id) showEdit(id);
        });

        document.getElementById("editPhotoFile").addEventListener("change", function () {
            var file = this.files && this.files[0];
            if (!file) return;
            var url = URL.createObjectURL(file);
            var img = document.getElementById("editPhotoImg");
            var ph = document.getElementById("editPhotoPh");
            if (img) {
                img.onload = function () {
                    img.classList.remove("is-hidden");
                    if (ph) ph.classList.add("is-hidden");
                    URL.revokeObjectURL(url);
                };
                img.src = url;
            }
        });

        $("#recordsTable").on("click", ".btn-view", function () {
            var id = this.getAttribute("data-id");
            if (id) showDetail(id);
        });

        $("#recordsTable").on("click", ".btn-print-card", function () {
            if (this.disabled || this.classList.contains("is-disabled")) return;
            var empId = (this.getAttribute("data-emp-id") || "").trim();
            showPrintCard(this.getAttribute("data-id"), { empId: empId });
        });

        $("#recordsTable").on("click", ".btn-voucher", function () {
            var id = this.getAttribute("data-id");
            if (id) showVoucher(id);
        });

        $("#recordsTable").on("keydown", ".assign-rfid-input", function (e) {
            if (e.key === "Enter") {
                e.preventDefault();
                this.blur();
            }
        });
        $("#recordsTable").on("blur", ".assign-rfid-input", function () {
            saveAssignGridRfid(this);
        });

        var voucherClose = document.getElementById("voucherClose");
        var voucherBackdrop = document.getElementById("voucherBackdrop");
        var voucherCloseFoot = document.getElementById("voucherCloseFoot");
        if (voucherClose) voucherClose.addEventListener("click", closeVoucherModal);
        if (voucherBackdrop) voucherBackdrop.addEventListener("click", closeVoucherModal);
        if (voucherCloseFoot) voucherCloseFoot.addEventListener("click", closeVoucherModal);
        var btnVoucherPrint = document.getElementById("btnVoucherPrint");
        if (btnVoucherPrint) btnVoucherPrint.addEventListener("click", printVoucherPreview);
        var btnVoucherMarkPaid = document.getElementById("btnVoucherMarkPaid");
        if (btnVoucherMarkPaid) btnVoucherMarkPaid.addEventListener("click", markVoucherPaid);
        var btnVoucherMarkUnpaid = document.getElementById("btnVoucherMarkUnpaid");
        if (btnVoucherMarkUnpaid) btnVoucherMarkUnpaid.addEventListener("click", markVoucherUnpaid);

        $("#recordsTable").on("change", ".status-switch__input", function () {
            var input = this;
            var label = input.closest(".status-switch");
            if (!label || input.disabled) return;
            var id = label.getAttribute("data-id");
            if (!id) return;
            var newStatus = input.checked ? "Active" : "Inactive";
            input.checked = !input.checked;
            refreshSwitchUi(label);
            openStatusChangeModal(id, newStatus, { inputEl: input, label: label });
        });

        $("#recordsTable").on("click", ".status-pill-btn", function () {
            var btn = this;
            if (btn.disabled) return;
            var id = btn.getAttribute("data-id");
            if (!id) return;
            var active = btn.getAttribute("data-active") === "true";
            var newStatus = active ? "Inactive" : "Active";
            openStatusChangeModal(id, newStatus, { pillBtn: btn });
        });

        document.getElementById("statusChangeClose").addEventListener("click", closeStatusChangeModal);
        document.getElementById("statusChangeCancel").addEventListener("click", closeStatusChangeModal);
        document.getElementById("statusChangeBackdrop").addEventListener("click", closeStatusChangeModal);
        document.getElementById("btnConfirmStatusChange").addEventListener("click", confirmStatusChange);

        document.getElementById("printCardClose").addEventListener("click", closePrintModal);
        document.getElementById("printCardCloseFoot").addEventListener("click", closePrintModal);
        document.getElementById("printCardBackdrop").addEventListener("click", closePrintModal);
        document.getElementById("btnPrintCardPreview").addEventListener("click", printCardPreviewOnly);
        var btnDownloadPdf = document.getElementById("btnDownloadCardPdf");
        if (btnDownloadPdf) {
            btnDownloadPdf.innerHTML = svgPdf + " Download PDF";
            btnDownloadPdf.addEventListener("click", downloadCardPreviewPdf);
        }
        $("#printCardModal").on(
            "input change",
            "#printCardRfidNumber, #printCardEtag, #printCardPrintDate, #printCardIssuedBy, #printFamilyRfidNumber, #printFamilyEtag, #printFamilyPrintDate, #printFamilyIssuedBy",
            syncPrintCardButton
        );
        var btnSavePrint = document.getElementById("btnSavePrintAssignment");
        if (btnSavePrint) {
            if (!can("print") && !can("edit")) {
                btnSavePrint.classList.add("is-hidden");
            } else {
                btnSavePrint.addEventListener("click", savePrintAssignment);
            }
        }
        document.getElementById("editClose").addEventListener("click", closeEditModal);
        document.getElementById("editCloseFoot").addEventListener("click", closeEditModal);
        document.getElementById("editBackdrop").addEventListener("click", closeEditModal);
        document.getElementById("btnSaveEdit").addEventListener("click", saveEditProfile);
    }

    document.addEventListener("DOMContentLoaded", function () {
        var form = document.getElementById("form1");
        if (form) {
            form.addEventListener("submit", function (ev) {
                ev.preventDefault();
                return false;
            });
        }
        bindEvents();
        loadRecords();
    });
})();
