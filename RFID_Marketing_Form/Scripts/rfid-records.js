(function () {
    "use strict";

    var table = null;
    var cachedRows = [];

    function esc(text) {
        if (text == null) return "";
        return String(text)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;");
    }

    function apiOk(payload) {
        return payload && (payload.Ok === true || payload.ok === true);
    }

    function apiError(payload) {
        if (!payload) return "";
        return payload.Error || payload.error || "";
    }

    function fetchJson(url, options) {
        return fetch(url, options || {}).then(function (res) {
            return res.text().then(function (text) {
                if (!res.ok) {
                    throw new Error("Server error (" + res.status + "). Rebuild the project and try again.");
                }
                if (!text || !text.trim()) {
                    throw new Error("Empty response from server.");
                }
                try {
                    return JSON.parse(text);
                } catch (e) {
                    throw new Error("Could not read server response.");
                }
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
        var active = isActiveStatus(record.Status);
        var id = esc(record.Id);
        if (!active) {
            return (
                '<button type="button" class="btn-print-card is-disabled" data-id="' + id + '" disabled ' +
                'title="Print is only available for active records">Print Card</button>'
            );
        }
        return '<button type="button" class="btn-print-card" data-id="' + id + '">Print Card</button>';
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

    function statusToggleCell(record) {
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
                esc(r.IssuedBy || "—"),
                approvedBadge(r.IsApproved),
                esc(r.CreatedDate || "—"),
                statusToggleCell(r),
                '<div class="records-actions">' +
                '<button type="button" class="btn-view" data-id="' + esc(r.Id) + '">View details</button>' +
                '<button type="button" class="btn-edit" data-id="' + esc(r.Id) + '">Edit</button>' +
                printCardButtonHtml(r) +
                "</div>"
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
                    search: "Search records:",
                    lengthMenu: "Show _MENU_ rows",
                    info: "Showing _START_ to _END_ of _TOTAL_ records",
                    infoEmpty: "No records to show",
                    zeroRecords: "No matching records found",
                    paginate: { first: "First", last: "Last", next: "Next", previous: "Prev" }
                },
                columnDefs: [
                    { targets: [0], className: "rfid-mono" },
                    { targets: [2], orderable: true },
                    { targets: [7], className: "dt-status", orderable: false },
                    { targets: [8], className: "dt-actions" }
                ]
            });
        } else {
            table.clear();
            table.rows.add(data);
            table.draw();
        }
    }

    function syncCachedStatus(id, status) {
        for (var i = 0; i < cachedRows.length; i++) {
            if (String(cachedRows[i].Id) === String(id)) {
                cachedRows[i].Status = status;
                break;
            }
        }
        updateStats(cachedRows);
    }

    function setRecordStatus(id, status, inputEl) {
        var body = new URLSearchParams();
        body.append("id", id);
        body.append("status", status);

        return fetch("RfidRecords.ashx?action=setstatus", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: body.toString(),
            credentials: "same-origin"
        })
            .then(function (res) { return res.json(); })
            .then(function (payload) {
                if (!payload || !payload.Ok) {
                    throw new Error((payload && payload.Error) || "Unable to update status.");
                }
                var newStatus = payload.Status || status;
                syncCachedStatus(id, newStatus);
                setPrintButtonForRecord(id, isActiveStatus(newStatus));
                showAlert("Record #" + id + " is now " + newStatus + ".", false);
                return payload;
            })
            .catch(function (err) {
                showAlert(err.message || "Failed to update status.", true);
                if (inputEl) {
                    inputEl.checked = !inputEl.checked;
                    refreshSwitchUi(inputEl.closest(".status-switch"));
                }
            })
            .finally(function () {
                if (inputEl) inputEl.disabled = false;
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
        showAlert("");
        fetch("RfidRecords.ashx?action=list", { cache: "no-store" })
            .then(function (res) { return res.json(); })
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
            .catch(function () {
                showAlert("Network error while loading records.", true);
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

    function renderPrintCardLayout(record) {
        var name = primaryName(record);
        var subtitle = name
            ? ("Employee " + (record.EmpId || "—") + " · " + name)
            : ("Record #" + (record.Id || "—"));

        return (
            '<article class="print-card-layout">' +
            '<header class="print-card-layout__head">' +
            "<h3>Employee ID card preview</h3>" +
            "<p>" + esc(subtitle) + "</p>" +
            "</header>" +
            '<div class="print-card-layout__split">' +
            '<section class="print-card-layout__cards">' +
            '<p class="print-card-layout__cards-title">Card preview (front &amp; back)</p>' +
            renderIdCardBlock(record) +
            "</section>" +
            '<section class="print-card-layout__form">' +
            '<p class="print-card-layout__form-title">Assignment details</p>' +
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
            roField("RFID number", record.RfidNumber) +
            roField("Status", record.Status) +
            roField("Issue date", record.IssueDate) +
            roField("Expiry date", record.ExpiryDate) +
            roField("Print date", record.PrintDate) +
            roField("Created date", record.CreatedDate) +
            roField("Issued by", record.IssuedBy) +
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

    function openPrintModal() {
        document.getElementById("printCardModal").classList.remove("is-hidden");
        document.body.style.overflow = "hidden";
    }

    function closePrintModal() {
        document.getElementById("printCardModal").classList.add("is-hidden");
        if (document.getElementById("detailModal").classList.contains("is-hidden")) {
            document.body.style.overflow = "";
        }
    }

    function showPrintCard(id) {
        var body = document.getElementById("printCardBody");
        body.innerHTML = '<p class="detail-loading">Loading…</p>';
        openPrintModal();

        fetch("RfidRecords.ashx?action=detail&id=" + encodeURIComponent(id), { cache: "no-store" })
            .then(function (res) { return res.json(); })
            .then(function (payload) {
                if (!payload || !payload.Ok || !payload.Record) {
                    body.innerHTML = "<p class=\"detail-loading\">" + esc((payload && payload.Error) || "Unable to load record.") + "</p>";
                    return;
                }
                body.innerHTML = renderPrintCardLayout(payload.Record);
            })
            .catch(function () {
                body.innerHTML = '<p class="detail-loading">Network error while loading record.</p>';
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

    function showEdit(id) {
        hideEditError();
        openEditModal();
        document.getElementById("editName").value = "";
        showEditError("");
        var loading = "Loading…";
        document.getElementById("editModalTitle").textContent = loading;

        fetch("RfidRecords.ashx?action=detail&id=" + encodeURIComponent(id), { cache: "no-store" })
            .then(function (res) { return res.json(); })
            .then(function (payload) {
                if (!payload || !payload.Ok || !payload.Record) {
                    showEditError((payload && payload.Error) || "Unable to load record.");
                    return;
                }
                populateEditForm(payload.Record);
            })
            .catch(function () {
                showEditError("Network error while loading record.");
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

            return fetchJson("RfidRecords.ashx?action=updateprofile", {
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

    function showDetail(id) {
        var body = document.getElementById("detailBody");
        var title = document.getElementById("detailModalTitle");
        if (title) title.textContent = "Record " + id;
        body.innerHTML = '<p class="detail-loading">Loading…</p>';
        openModal();

        fetch("RfidRecords.ashx?action=detail&id=" + encodeURIComponent(id), { cache: "no-store" })
            .then(function (res) { return res.json(); })
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
                body.innerHTML = renderDetail(r);
            })
            .catch(function () {
                body.innerHTML = '<p class="detail-loading">Network error while loading details.</p>';
            });
    }

    function bindEvents() {
        document.getElementById("btnRefreshRecords").addEventListener("click", loadRecords);
        document.getElementById("detailClose").addEventListener("click", closeModal);
        document.getElementById("detailCloseFoot").addEventListener("click", closeModal);
        document.getElementById("detailBackdrop").addEventListener("click", closeModal);
        document.addEventListener("keydown", function (e) {
            if (e.key !== "Escape") return;
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
            var status = input.checked ? "Active" : "Inactive";
            refreshSwitchUi(label);
            input.disabled = true;
            setRecordStatus(id, status, input);
        });

        document.getElementById("printCardClose").addEventListener("click", closePrintModal);
        document.getElementById("printCardCloseFoot").addEventListener("click", closePrintModal);
        document.getElementById("printCardBackdrop").addEventListener("click", closePrintModal);
        document.getElementById("btnPrintCardPreview").addEventListener("click", printCardPreviewOnly);
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
