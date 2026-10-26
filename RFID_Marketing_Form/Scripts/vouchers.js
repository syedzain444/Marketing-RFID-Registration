(function () {
    "use strict";

    var table = null;
    var allRows = [];
    var activeFilter = "all";
    var statusCtx = null;
    var previewVoucher = null;

    function perms() {
        return window.VOUCHER_PERMISSIONS || {};
    }

    function canManage() {
        return perms().manage === true;
    }

    function esc(text) {
        return window.RfidVoucherRender ? RfidVoucherRender.esc(text) : String(text || "");
    }

    function showAlert(msg, isError) {
        var el = document.getElementById("vouchersAlert");
        if (!el) return;
        el.textContent = msg || "";
        el.classList.toggle("is-hidden", !msg);
        el.classList.toggle("is-error", !!isError);
    }

    function fetchJson(url, options) {
        var opts = options || { credentials: "same-origin" };
        return fetch(url, opts).then(function (res) {
            return res.text().then(function (text) {
                var payload;
                try {
                    payload = JSON.parse(text);
                } catch (e) {
                    throw new Error("Could not read server response.");
                }
                if (!payload || payload.Ok !== true) {
                    throw new Error((payload && payload.Error) || "Server error.");
                }
                return payload;
            });
        });
    }

    function isPaid(status) {
        return (status || "").toUpperCase() === "PAID";
    }

    function statusPill(v) {
        var paid = isPaid(v.Status);
        var cls = paid ? "voucher-pill voucher-pill--paid" : "voucher-pill voucher-pill--unpaid";
        var label = paid ? "Paid" : "Unpaid";
        if (!canManage()) {
            return '<span class="' + cls + '">' + label + "</span>";
        }
        return (
            '<button type="button" class="' + cls + ' voucher-pill-btn" data-id="' + esc(v.VoucherId) + '" data-paid="' +
            (paid ? "1" : "0") + '" title="Click to change status">' +
            label +
            "</button>"
        );
    }

    function updateStats(rows) {
        var total = rows.length;
        var paid = 0;
        var cardTotal = 0;
        for (var i = 0; i < rows.length; i++) {
            if (isPaid(rows[i].Status)) paid++;
            var n = parseInt(rows[i].CardCount, 10);
            cardTotal += isNaN(n) || n < 1 ? 1 : n;
        }
        document.getElementById("statVoucherTotal").textContent = String(total);
        document.getElementById("statVoucherPaid").textContent = String(paid);
        document.getElementById("statVoucherUnpaid").textContent = String(total - paid);
        var cardEl = document.getElementById("statVoucherCards");
        if (cardEl) cardEl.textContent = String(cardTotal);
    }

    function filterRows(rows) {
        if (activeFilter === "paid") {
            return rows.filter(function (r) {
                return isPaid(r.Status);
            });
        }
        if (activeFilter === "generated") {
            return rows.filter(function (r) {
                return !isPaid(r.Status);
            });
        }
        return rows;
    }

    function renderTableData(rows) {
        var data = [];
        for (var i = 0; i < rows.length; i++) {
            var v = rows[i];
            data.push([
                esc(v.VoucherId),
                '<span class="rfid-mono">' + esc(v.VoucherNo) + "</span>",
                esc(v.EmployeeName || "—"),
                '<strong class="voucher-amt">' + esc(RfidVoucherRender.formatAmount(v.Amount)) + "</strong>",
                esc(v.RecordScope || "—"),
                '<span class="voucher-card-count" title="CARD_COUNT">' + esc(String(v.CardCount != null ? v.CardCount : 1)) + "</span>",
                statusPill(v),
                esc(v.GeneratedOn || "—") + (v.GeneratedBy ? '<br><span class="voucher-meta">' + esc(v.GeneratedBy) + "</span>" : ""),
                v.PaidOn
                    ? esc(v.PaidOn) + (v.PaidBy ? '<br><span class="voucher-meta">' + esc(v.PaidBy) + "</span>" : "")
                    : "—",
                '<div class="voucher-row-actions">' +
                    '<button type="button" class="btn-voucher-view" data-id="' + esc(v.VoucherId) + '">View</button>' +
                    (canManage()
                        ? (isPaid(v.Status)
                            ? '<button type="button" class="btn-voucher-toggle btn-voucher-toggle--unpaid" data-id="' +
                              esc(v.VoucherId) +
                              '" data-paid="1" title="Set STATUS to GENERATED in database">Mark unpaid</button>'
                            : '<button type="button" class="btn-voucher-toggle btn-voucher-toggle--paid" data-id="' +
                              esc(v.VoucherId) +
                              '" data-paid="0" title="Set STATUS to PAID in database">Mark paid</button>')
                        : "") +
                    "</div>"
            ]);
        }
        return data;
    }

    function refreshTable() {
        var rows = filterRows(allRows);
        updateStats(allRows);
        if (!table) return;
        table.clear();
        table.rows.add(renderTableData(rows));
        table.draw(false);
    }

    function loadVouchers() {
        showAlert("", false);
        fetchJson("CardVouchers.ashx?action=list&status=all")
            .then(function (payload) {
                allRows = payload.Vouchers || [];
                refreshTable();
            })
            .catch(function (err) {
                showAlert(err.message || "Could not load vouchers.", true);
            });
    }

    function openPreview(voucherId) {
        var body = document.getElementById("voucherPreviewBody");
        if (body) body.innerHTML = '<p class="detail-loading">Loading…</p>';
        document.getElementById("voucherPreviewModal").classList.remove("is-hidden");
        document.body.style.overflow = "hidden";

        fetchJson("CardVouchers.ashx?action=get&id=" + encodeURIComponent(voucherId))
            .then(function (payload) {
                previewVoucher = payload.Voucher;
                if (!previewVoucher) throw new Error("Voucher not found.");
                document.getElementById("voucherPreviewSub").textContent =
                    (previewVoucher.VoucherNo || "") +
                    " · " +
                    (previewVoucher.EmployeeName || "") +
                    (previewVoucher.GeneratedBy ? " · " + previewVoucher.GeneratedBy : "");
                RfidVoucherRender.applyStatusBadge(document.getElementById("voucherPreviewStatus"), previewVoucher.Status);
                body.innerHTML = RfidVoucherRender.renderGrid(previewVoucher);
            })
            .catch(function (err) {
                if (body) body.innerHTML = '<p class="detail-loading">' + esc(err.message) + "</p>";
            });
    }

    function closePreview() {
        document.getElementById("voucherPreviewModal").classList.add("is-hidden");
        previewVoucher = null;
        if (!document.getElementById("voucherStatusModal").classList.contains("is-hidden")) return;
        document.body.style.overflow = "";
    }

    function openStatusModal(voucherId, targetPaid) {
        var row = null;
        for (var i = 0; i < allRows.length; i++) {
            if (String(allRows[i].VoucherId) === String(voucherId)) {
                row = allRows[i];
                break;
            }
        }
        if (!row) return;

        statusCtx = { voucher: row, targetStatus: targetPaid ? "PAID" : "GENERATED" };
        document.getElementById("voucherStatusSub").textContent =
            row.VoucherNo + " · " + (row.EmployeeName || "—") + " · Rs " + RfidVoucherRender.formatAmount(row.Amount);
        document.getElementById("voucherStatusTitle").textContent = targetPaid ? "Mark as paid" : "Mark as unpaid";
        RfidVoucherRender.applyStatusBadge(document.getElementById("voucherStatusFrom"), row.Status);
        RfidVoucherRender.applyStatusBadge(document.getElementById("voucherStatusTo"), targetPaid ? "PAID" : "GENERATED");
        document.getElementById("voucherStatusError").classList.add("is-hidden");
        document.getElementById("voucherStatusModal").classList.remove("is-hidden");
        document.body.style.overflow = "hidden";
    }

    function closeStatusModal() {
        document.getElementById("voucherStatusModal").classList.add("is-hidden");
        statusCtx = null;
        if (document.getElementById("voucherPreviewModal").classList.contains("is-hidden")) {
            document.body.style.overflow = "";
        }
    }

    function confirmStatusChange() {
        if (!statusCtx || !statusCtx.voucher) return;
        var errEl = document.getElementById("voucherStatusError");
        var btn = document.getElementById("btnConfirmVoucherStatus");
        if (btn) btn.disabled = true;
        var fd = new FormData();
        fd.append("action", "setstatus");
        fd.append("id", String(statusCtx.voucher.VoucherId));
        fd.append("status", statusCtx.targetStatus);

        fetchJson("CardVouchers.ashx", { method: "POST", body: fd })
            .then(function (payload) {
                var updated = payload.Voucher;
                if (!updated) throw new Error("Update failed.");
                for (var i = 0; i < allRows.length; i++) {
                    if (String(allRows[i].VoucherId) === String(updated.VoucherId)) {
                        allRows[i] = updated;
                        break;
                    }
                }
                refreshTable();
                closeStatusModal();
                showAlert("Voucher status updated in database.", false);
            })
            .catch(function (err) {
                if (errEl) {
                    errEl.textContent = err.message || "Could not update status.";
                    errEl.classList.remove("is-hidden");
                }
            })
            .finally(function () {
                if (btn) btn.disabled = false;
            });
    }

    function bindEvents() {
        document.getElementById("btnRefreshVouchers").addEventListener("click", loadVouchers);

        document.querySelectorAll(".voucher-chip").forEach(function (chip) {
            chip.addEventListener("click", function () {
                document.querySelectorAll(".voucher-chip").forEach(function (c) {
                    c.classList.remove("is-active");
                });
                chip.classList.add("is-active");
                activeFilter = chip.getAttribute("data-filter") || "all";
                refreshTable();
            });
        });

        $("#vouchersTable").on("click", ".btn-voucher-view", function () {
            var id = this.getAttribute("data-id");
            if (id) openPreview(id);
        });

        $("#vouchersTable").on("click", ".btn-voucher-toggle, .voucher-pill-btn", function () {
            if (!canManage()) return;
            var id = this.getAttribute("data-id");
            var paid = this.getAttribute("data-paid") === "1";
            if (id) openStatusModal(id, !paid);
        });

        document.getElementById("voucherPreviewClose").addEventListener("click", closePreview);
        document.getElementById("voucherPreviewCloseFoot").addEventListener("click", closePreview);
        document.getElementById("voucherPreviewBackdrop").addEventListener("click", closePreview);
        document.getElementById("btnVoucherPreviewPrint").addEventListener("click", function () {
            RfidVoucherRender.printFromContainer("#voucherPreviewBody .voucher-grid");
        });

        document.getElementById("voucherStatusClose").addEventListener("click", closeStatusModal);
        document.getElementById("voucherStatusCancel").addEventListener("click", closeStatusModal);
        document.getElementById("voucherStatusBackdrop").addEventListener("click", closeStatusModal);
        document.getElementById("btnConfirmVoucherStatus").addEventListener("click", confirmStatusChange);
    }

    document.addEventListener("DOMContentLoaded", function () {
        table = $("#vouchersTable").DataTable({
            order: [[0, "desc"]],
            pageLength: 25,
            columnDefs: [
                { targets: [5], className: "dt-center" },
                { targets: [6, 9], orderable: false }
            ]
        });
        bindEvents();
        loadVouchers();
    });
})();
