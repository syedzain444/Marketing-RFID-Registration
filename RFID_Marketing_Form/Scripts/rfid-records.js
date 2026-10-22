(function () {
    "use strict";

    var table = null;
    var cachedRows = [];
    var statusChangeCtx = null;

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
    var svgMore = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="6" r="1.5" fill="currentColor"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/><circle cx="12" cy="18" r="1.5" fill="currentColor"/></svg>';

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
        return "RfidRecords.ashx" + (query ? "?" + query : "");
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

    function statusBadge(status) {
        var s = (status || "").toLowerCase();
        if (s === "active") return '<span class="badge badge--active">Active</span>';
        if (s === "inactive") return '<span class="badge badge--inactive">Inactive</span>';
        return '<span class="badge badge--muted">' + esc(status || "—") + "</span>";
    }

    function printCardButtonHtml(record) {
        if (!can("print")) {
            return "";
        }
        var active = isActiveStatus(record.Status);
        var id = esc(record.Id);
        if (!active) {
            return (
                '<button type="button" class="btn-print-card is-disabled" data-id="' + id + '" disabled ' +
                'title="Print is only available for active records">' + svgPrint + " Print Card</button>"
            );
        }
        return '<button type="button" class="btn-print-card" data-id="' + id + '">' + svgPrint + " Print Card</button>";
    }

    function setPrintButtonForRecord(id, active) {
        var btn = document.querySelector('.btn-print-card[data-id="' + id + '"]');
        if (!btn) return;
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
        var dash = document.body.classList.contains("dashboard-v2");
        if (dash) {
            return statusPillHtml(record, can("status"));
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
        for (var i = 0; i < cachedRows.length; i++) {
            if (String(cachedRows[i].Id) === String(id)) return cachedRows[i];
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
        var approved = 0;
        for (var i = 0; i < rows.length; i++) {
            if ((rows[i].Status || "").toLowerCase() === "active") active++;
            if ((rows[i].IsApproved || "").toLowerCase() === "yes") approved++;
        }
        document.getElementById("statTotal").textContent = String(total);
        document.getElementById("statActive").textContent = String(active);
        document.getElementById("statApproved").textContent = String(approved);
    }

    function renderTableRows(rows) {
        var data = [];
        for (var i = 0; i < rows.length; i++) {
            var r = rows[i];
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
                (function () {
                    var parts = ['<div class="records-actions">'];
                    if (can("view")) {
                        parts.push('<button type="button" class="btn-view" data-id="' + esc(r.Id) + '">' + svgView + " View details</button>");
                    }
                    if (can("edit")) {
                        parts.push('<button type="button" class="btn-edit" data-id="' + esc(r.Id) + '">' + svgEdit + " Edit</button>");
                    }
                    parts.push(printCardButtonHtml(r));
                    parts.push('<button type="button" class="btn-row-more" aria-label="More actions">' + svgMore + "</button>");
                    parts.push("</div>");
                    return parts.join("");
                })()
            ]);
        }
        return data;
    }

    function initOrRefreshTable(rows) {
        cachedRows = rows || [];
        var data = renderTableRows(cachedRows);
        if (!table) {
            table = $("#recordsTable").DataTable({
                data: data,
                order: [[0, "desc"]],
                pageLength: 15,
                lengthMenu: [[10, 15, 25, 50, -1], [10, 15, 25, 50, "All"]],
                language: {
                    search: "",
                    searchPlaceholder: "Search by name, ID or RFID tag",
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
                columnDefs: [
                    { targets: [0], className: "rfid-mono" },
                    { targets: [2], orderable: true },
                    { targets: [7], className: "dt-status", orderable: false },
                    { targets: [8], className: "dt-status-remarks" },
                    { targets: [9], className: "dt-actions" }
                ]
            });
        } else {
            table.clear();
            table.rows.add(data);
            table.draw();
        }
    }

    function syncCachedStatusChange(id, status, remarks) {
        for (var i = 0; i < cachedRows.length; i++) {
            if (String(cachedRows[i].Id) === String(id)) {
                cachedRows[i].Status = status;
                if (remarks != null) cachedRows[i].StatusRemarks = remarks;
                break;
            }
        }
        updateStats(cachedRows);
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
                syncCachedStatusChange(id, newStatus, newRemarks);
                setPrintButtonForRecord(id, isActiveStatus(newStatus));
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
                updateStats(rows);
                initOrRefreshTable(rows);
            })
            .catch(function (err) {
                showAlert((err && err.message) || "Network error while loading records.", true);
                initOrRefreshTable([]);
            });
    }

    function resolvePhotoUrl(path) {
        if (window.RfidPhotos) {
            return window.RfidPhotos.displayUrl(path);
        }
        if (!path) return "";
        var p = String(path).trim();
        if (/^https?:\/\//i.test(p)) return p;
        p = p.replace(/\\/g, "/").replace(/^\/+/, "");
        return "EmpPhoto.ashx?p=" + encodeURIComponent(p);
    }

    function resolvePhotoFallback(path) {
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
        var url = resolvePhotoUrl(record.PhotoPath);
        var fallback = resolvePhotoFallback(record.PhotoPath);
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

    function familyQrUrl(family) {
        var text =
            "Name: " + (family.CardName || "") +
            "\nCNIC: " + (family.Cnic || "") +
            "\nEmp ID: " + (family.EmpId || "") +
            "\nRelation: " + formatRelationshipLabel(family.Relationship);
        return "https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=" + encodeURIComponent(text);
    }

    function renderFamilyIdCardBlock(family) {
        var root = appRoot();
        var logoN = root + "Images/logoN.png";
        var logoB = root + "Images/LogoB.png";
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
            '<img class="logo-n" src="' + esc(logoN) + '" alt="" onerror="this.onerror=null;this.src=\'' + esc(fallbackLogo) + "';\" />" +
            '<div class="family-id-card-front__titles">' +
            "<h2>BAHRIA TOWN</h2><h2 class=\"family-id-card-front__titles-city\">KARACHI</h2><h3>EMPLOYEE FAMILY</h3></div></div>" +
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
            '<img class="logo-b" src="' + esc(logoB) + '" alt="" onerror="this.onerror=null;this.src=\'' + esc(fallbackLogo) + "';\" />" +
            "<p>24/7 Call</p><p>(021) 38771555 Ext-685</p><p>www.btkarachi.com</p>" +
            '<img class="family-id-card-back__sign" src="' + esc(sign) + '" alt="" onerror="this.style.display=\'none\'" />' +
            "<p>Issuing Authority</p><p>Director Security Bahria Town</p></div>" +
            '<div class="family-id-card-back__vrule"></div>' +
            '<div class="family-id-card-back__right">' +
            '<img class="family-id-card-back__qr" src="' + esc(familyQrUrl(family)) + '" alt="QR code" />' +
            "<ul><li>This card is for employee family members only.</li><li>Pass only carried by authorized person.</li>" +
            "<li>Photocopy of this pass is not allowed.</li><li>Pass is non-transferable.</li></ul>" +
            "<div><p>If Found.</p><p>Please return to</p><p>Bahria Town (Pvt) Ltd.</p></div></div></div></div></div></div>"
        );
    }

    function renderIdCardBlock(record) {
        var name = (record.EmployeeName || record.EmpId || "—");
        if (name !== "—") name = String(name).toUpperCase();
        var dgn = record.Designation ? String(record.Designation).toUpperCase() : "—";
        var dept = record.Department ? String(record.Department).toUpperCase() : "—";
        var proj = record.ProjectLocation ? String(record.ProjectLocation).toUpperCase() : "—";
        var photoUrl = resolvePhotoUrl(record.PhotoPath);
        var fallback = window.RfidPhotos ? window.RfidPhotos.publicUrl(record.PhotoPath) : "";
        var logo = appRoot() + "Images/logo.png";
        var sign = appRoot() + "Images/signature.png";
        var img =
            photoUrl
                ? ('<img src="' + esc(photoUrl) + '" alt="" data-fallback="' + esc(fallback) + '" ' +
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
            '<div class="grade-badge">EMPLOYEE</div></div></div>' +
            '<div class="card-print-page card-print-page--back">' +
            '<div class="id-card back-card">' +
            '<div class="back-details">' +
            '<div class="back-row"><span class="back-label">Joining Date:</span><span class="back-value">' + esc(formatCardBackDate(record.JoiningDate)) + "</span></div>" +
            '<div class="back-row"><span class="back-label">Issue Date:</span><span class="back-value">' + esc(formatCardBackDate(record.IssueDate)) + "</span></div>" +
            '<div class="back-row"><span class="back-label">Expiry Date:</span><span class="back-value">' + esc(formatCardBackDate(record.ExpiryDate)) + "</span></div>" +
            '<div class="back-row"><span class="back-label">Blood Group:</span><span class="back-value">' + esc(valOrDash(record.BloodGroup)) + "</span></div>" +
            '<div class="back-row"><span class="back-label">CNIC:</span><span class="back-value">' + esc(valOrDash(record.Cnic)) + "</span></div>" +
            '<div class="back-row"><span class="back-label">Emergency #:</span><span class="back-value">' + esc(valOrDash(record.EmergencyNo)) + "</span></div>" +
            "</div>" +
            '<div class="back-notes">' +
            "<p>The Employee ID card is replaceable if there is a change in employee's designation or department.</p>" +
            "<p><strong>Return:</strong> The Employee ID card is property of Bahria Town (Pvt) Ltd. and must be returned to HR Department upon the disengagement of services.</p>" +
            '<div class="authority-container">' +
            '<div class="authority-text"><strong>Issuing Authority:</strong><br />HR Department Bahria Town</div>' +
            '<div class="authority-sign"><img src="' + esc(sign) + '" alt="" onerror="this.style.display=\'none\'" /><div class="sign-line"></div></div>' +
            "</div></div>" +
            '<div class="back-footer">' +
            "<p><strong>If found please return to</strong></p>" +
            "<p>HR Department.</p>" +
            "<p>Nagori Stop Super Highway 9KM from Toll Plaza</p>" +
            "<p>0800-00100</p>" +
            "<p>www.bahriatown.com</p></div></div></div></div>"
        );
    }

    function printAssignmentFieldsHtml(record) {
        var printIso = displayDateToIso(record.PrintDate);
        var createdDisplay = record.CreatedDate && String(record.CreatedDate).trim() ? record.CreatedDate : "—";
        return (
            '<div class="print-assign-fields">' +
            '<input type="hidden" id="printCardRecordId" value="' + esc(record.Id != null ? String(record.Id) : "") + '" />' +
            '<div class="edit-field edit-field--full">' +
            '<label for="printCardRfidNumber">RFID number</label>' +
            '<input type="text" id="printCardRfidNumber" class="edit-input rfid-mono" maxlength="50" placeholder="e.g. 123456" value="' + esc(record.RfidNumber || "") + '" />' +
            '<p class="print-assign-hint">Assign the physical card tag before printing.</p>' +
            "</div>" +
            '<div class="edit-field">' +
            '<label for="printCardPrintDate">Print date</label>' +
            '<input type="date" id="printCardPrintDate" class="edit-input" value="' + esc(printIso) + '" />' +
            "</div>" +
            '<div class="edit-field">' +
            '<label for="printCardIssuedBy">Issued by</label>' +
            '<input type="text" id="printCardIssuedBy" class="edit-input" maxlength="50" placeholder="Name" value="' + esc(record.IssuedBy || "") + '" />' +
            "</div>" +
            '<div class="edit-field edit-field--full">' +
            "<label>Created date</label>" +
            '<div class="print-assign-readonly" id="printCardCreatedDisplay" title="Set automatically when the record is saved from the RFID form">' +
            esc(createdDisplay) +
            "</div>" +
            '<p class="print-assign-hint">System date when the record was created (not editable).</p>' +
            "</div>" +
            '<p id="printAssignError" class="edit-form-error is-hidden" role="alert"></p>' +
            "</div>"
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
            '<p class="print-card-layout__form-title">Print &amp; assignment</p>' +
            printAssignmentFieldsHtml(record) +
            '<p class="print-card-layout__form-title print-card-layout__form-title--sub">Other details</p>' +
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
            roField("Issue date", record.IssueDate) +
            roField("Expiry date", record.ExpiryDate) +
            roField("Approved", record.IsApproved) +
            roField("Approved date", record.ApprovedDate) +
            roField("Approver ID", record.ApproveId) +
            roField("Forward to HOD", record.IsForwardHod) +
            roField("Forwarded by", record.ForwardBy) +
            roField("Forwarded on", record.ForwardOn) +
            roField("HOD remarks", record.HodRemarks, { half: true }) +
            roField("Requester remarks", record.RequesterRemarks, { half: true }) +
            "</div></section></div></article>"
        );
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
                setFamilyPreviewSide("front");
            });
        }

        document.querySelectorAll(".family-side-btn").forEach(function (btn) {
            btn.addEventListener("click", function () {
                setFamilyPreviewSide(btn.getAttribute("data-family-side"));
            });
        });

        if (familyCards.length) {
            setFamilyPreviewSide("front");
        }
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
        if (document.getElementById("detailModal").classList.contains("is-hidden")) {
            document.body.style.overflow = "";
        }
    }

    function showPrintAssignError(msg) {
        var el = document.getElementById("printAssignError");
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

    function printAssignmentIsComplete() {
        var rfidEl = document.getElementById("printCardRfidNumber");
        var printEl = document.getElementById("printCardPrintDate");
        var issuedEl = document.getElementById("printCardIssuedBy");
        var createdEl = document.getElementById("printCardCreatedDisplay");
        var rfid = rfidEl ? String(rfidEl.value || "").trim() : "";
        var printDate = printEl ? String(printEl.value || "").trim() : "";
        var issuedBy = issuedEl ? String(issuedEl.value || "").trim() : "";
        var created = createdEl ? String(createdEl.textContent || "").trim() : "";
        if (!rfid || !printDate || !issuedBy) {
            return false;
        }
        if (!created || created === "—" || created === "-") {
            return false;
        }
        return true;
    }

    function activePrintTab() {
        var active = document.querySelector(".print-card-tab.is-active");
        return active ? active.getAttribute("data-print-tab") : "employee";
    }

    function syncPrintCardButton() {
        var btn = document.getElementById("btnPrintCardPreview");
        if (!btn) return;
        if (activePrintTab() === "family") {
            var famOk = !!document.getElementById("printCardPreviewAreaFamily");
            btn.disabled = !famOk;
            btn.classList.toggle("is-disabled", !famOk);
            btn.setAttribute("aria-disabled", famOk ? "false" : "true");
            btn.removeAttribute("title");
            return;
        }
        var ok = printAssignmentIsComplete();
        btn.disabled = !ok;
        btn.classList.toggle("is-disabled", !ok);
        btn.setAttribute("aria-disabled", ok ? "false" : "true");
        if (!ok) {
            btn.setAttribute("title", "Fill RFID number, print date, issued by, and ensure created date is set.");
        } else {
            btn.removeAttribute("title");
        }
    }

    function savePrintAssignment() {
        var idEl = document.getElementById("printCardRecordId");
        var id = idEl ? idEl.value : "";
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
        body.append("id", id);
        body.append("issuedBy", (document.getElementById("printCardIssuedBy") || {}).value || "");
        body.append("printDate", (document.getElementById("printCardPrintDate") || {}).value || "");
        body.append("rfidNumber", (document.getElementById("printCardRfidNumber") || {}).value || "");

        fetchJson(recordsApiUrl("action=updateprintassignment"), {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: body.toString()
        })
            .then(function (payload) {
                if (!payload || !payload.Ok || !payload.Record) {
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
                    "Print and assignment details were saved for record #" + id + "."
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

    function showPrintCard(id) {
        var body = document.getElementById("printCardBody");
        body.innerHTML = '<p class="detail-loading">Loading…</p>';
        openPrintModal();

        fetchJson(recordsApiUrl("action=detail&id=" + encodeURIComponent(id)), { cache: "no-store" })
            .then(function (payload) {
                if (!payload || !payload.Ok || !payload.Record) {
                    body.innerHTML = "<p class=\"detail-loading\">" + esc((payload && payload.Error) || "Unable to load record.") + "</p>";
                    return;
                }
                var family = payload.FamilyCards || [];
                body.innerHTML = renderPrintCardLayout(payload.Record, family);
                bindPrintCardUi(payload.Record, family);
                syncPrintCardButton();
            })
            .catch(function (err) {
                body.innerHTML = "<p class=\"detail-loading\">" + esc((err && err.message) || "Network error while loading record.") + "</p>";
            });
    }

    function setEditPhotoPreview(path) {
        var img = document.getElementById("editPhotoImg");
        var ph = document.getElementById("editPhotoPh");
        var url = resolvePhotoUrl(path);
        var fallback = window.RfidPhotos ? window.RfidPhotos.publicUrl(path) : "";
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

    function populateEditForm(record) {
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

    function findCachedRecord(id) {
        var key = String(id);
        for (var i = 0; i < cachedRows.length; i++) {
            if (String(cachedRows[i].Id) === key) {
                return cachedRows[i];
            }
        }
        return null;
    }

    function resetEditForm() {
        var ids = [
            "editRecordId", "editPhotoPath", "editEmpId", "editName", "editDesignation",
            "editDepartment", "editProject", "editJoiningDate", "editBloodGroup", "editCnic", "editEmergencyNo"
        ];
        ids.forEach(function (elId) {
            var el = document.getElementById(elId);
            if (el) el.value = "";
        });
        var file = document.getElementById("editPhotoFile");
        if (file) file.value = "";
        setEditPhotoPreview("");
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
                populateEditForm(payload.Record);
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

        var btn = document.getElementById("btnSaveEdit");
        var btnLabel = btn.textContent;
        btn.disabled = true;
        btn.textContent = "Saving…";

        function postProfile(photoPath) {
            var body = new URLSearchParams();
            body.append("id", id);
            body.append("employeeName", document.getElementById("editName").value.trim());
            body.append("designation", document.getElementById("editDesignation").value.trim());
            body.append("department", document.getElementById("editDepartment").value.trim());
            body.append("projectLocation", document.getElementById("editProject").value.trim());
            body.append("joiningDate", document.getElementById("editJoiningDate").value.trim());
            body.append("bloodGroup", document.getElementById("editBloodGroup").value.trim());
            body.append("cnic", document.getElementById("editCnic").value.trim());
            body.append("emergencyNo", document.getElementById("editEmergencyNo").value.trim());
            body.append("photoPath", photoPath || "");

            return fetchJson(recordsApiUrl("action=updateprofile"), {
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
            pathPromise = window.RfidPhotos.uploadFile(file).then(function (data) {
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
                showAlert("Employee profile saved for record #" + id + ".", false);
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

    function printCardPreviewOnly() {
        if (activePrintTab() === "family") {
            printFamilyCardPreviewOnly();
            return;
        }
        if (!printAssignmentIsComplete()) {
            recordsSweetAlert(
                "warning",
                "Complete print & assignment",
                "Fill RFID number, print date, and issued by before printing."
            );
            return;
        }
        var area = document.getElementById("printCardPreviewArea");
        if (!area) return;

        var front = area.querySelector(".front-card");
        var back = area.querySelector(".back-card");
        if (!front || !back) return;

        var root = document.createElement("div");
        root.className = "card-print-root";
        root.setAttribute("aria-hidden", "true");

        var pageFront = document.createElement("div");
        pageFront.className = "card-print-page card-print-page--front";
        pageFront.appendChild(front.cloneNode(true));

        var pageBack = document.createElement("div");
        pageBack.className = "card-print-page card-print-page--back";
        pageBack.appendChild(back.cloneNode(true));

        root.appendChild(pageFront);
        root.appendChild(pageBack);
        document.body.appendChild(root);
        document.body.classList.add("print-card-preview");

        function cleanup() {
            document.body.classList.remove("print-card-preview");
            if (root.parentNode) root.parentNode.removeChild(root);
            window.removeEventListener("afterprint", cleanup);
        }

        window.addEventListener("afterprint", cleanup);
        window.print();
        setTimeout(cleanup, 3000);
    }

    function printFamilyCardPreviewOnly() {
        var area = document.getElementById("printCardPreviewAreaFamily");
        if (!area) return;
        var front = area.querySelector(".family-id-card-front-side");
        var back = area.querySelector(".family-id-card-back-side");
        if (!front || !back) return;

        var root = document.createElement("div");
        root.className = "card-print-root";
        root.setAttribute("aria-hidden", "true");

        var pageFront = document.createElement("div");
        pageFront.className = "card-print-page card-print-page--family-front";
        pageFront.appendChild(front.cloneNode(true));

        var pageBack = document.createElement("div");
        pageBack.className = "card-print-page card-print-page--family-back";
        pageBack.appendChild(back.cloneNode(true));

        root.appendChild(pageFront);
        root.appendChild(pageBack);
        document.body.appendChild(root);
        document.body.classList.add("print-family-card-preview");

        function cleanup() {
            document.body.classList.remove("print-family-card-preview");
            if (root.parentNode) root.parentNode.removeChild(root);
            window.removeEventListener("afterprint", cleanup);
        }

        window.addEventListener("afterprint", cleanup);
        window.print();
        setTimeout(cleanup, 3000);
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
                    title.textContent = name ? name + " (" + (r.EmpId || "") + ")" : "Employee " + (r.EmpId || "—");
                }
                try {
                    body.innerHTML = renderDetail(r);
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
        var othersOpen = ["detailModal", "printCardModal", "editModal", "statusChangeModal"].some(function (mid) {
            var m = document.getElementById(mid);
            return m && !m.classList.contains("is-hidden");
        });
        if (!othersOpen) document.body.style.overflow = "";
    }

    function bindEvents() {
        document.getElementById("btnRefreshRecords").addEventListener("click", loadRecords);
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
            var id = this.getAttribute("data-id");
            if (id) showPrintCard(id);
        });

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
        $("#printCardModal").on("input change", "#printCardRfidNumber, #printCardPrintDate, #printCardIssuedBy", syncPrintCardButton);
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
