(function (global) {
    "use strict";

    function esc(text) {
        if (text == null) return "";
        return String(text)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;");
    }

    function appRoot() {
        var root = global.RFID_APP_ROOT || "/";
        if (root.charAt(root.length - 1) !== "/") root += "/";
        return root;
    }

    function formatAmount(amount) {
        var n = Number(amount);
        if (isNaN(n)) return "0";
        return Math.round(n).toLocaleString("en-PK");
    }

    function statusLabel(status) {
        return (status || "").toUpperCase() === "PAID" ? "Paid" : "Unpaid";
    }

    function applyStatusBadge(el, status) {
        if (!el) return;
        var paid = (status || "").toUpperCase() === "PAID";
        el.textContent = paid ? "Paid" : "Unpaid";
        el.classList.toggle("voucher-status-badge--paid", paid);
        el.classList.toggle("voucher-status-badge--generated", !paid);
    }

    function buildCopyHtml(copyName, v) {
        var date = esc(v.GeneratedOn || "");
        var amount = formatAmount(v.Amount);
        var words = esc(v.AmountWords || "");
        var logo = esc(appRoot() + "Images/LogoB.png");
        return (
            '<div class="voucher-copy">' +
            '<div class="voucher-copy__label">' + esc(copyName) + "</div>" +
            '<div class="voucher-copy__brand">' +
            '<img src="' + logo + '" alt="Bahria Town" />' +
            "<h3>Bahria Town Karachi Project</h3>" +
            "<p>Commercial RFID card</p></div>" +
            '<div class="voucher-copy__row">' +
            "<div><span>Date:</span> <strong>" + date + "</strong></div>" +
            '<div class="voucher-copy__no">' + esc(v.VoucherNo || "") + "</div></div>" +
            '<div class="voucher-copy__fields">' +
            '<div class="voucher-copy__line"><span><strong>Ref:</strong> ' + esc(v.RefNo || "—") + "</span>" +
            '<span><strong>Category:</strong> ' + esc(v.CategoryName || "—") + "</span></div>" +
            '<div class="voucher-copy__line"><span><strong>Name:</strong> ' + esc(v.EmployeeName || "—") + "</span></div>" +
            '<div class="voucher-copy__line"><span><strong>CNIC:</strong> ' + esc(v.Cnic || "—") + "</span>" +
            '<span><strong>No of Cards:</strong> ' + esc(String(v.CardCount || 1)) + "</span></div></div>" +
            '<div class="voucher-copy__bank">' +
            "<div><strong>Account Title:</strong> BAHRIA TOWN (PVT) LTD COMMERCIAL RFID CARD</div>" +
            '<div class="voucher-copy__amount">Amount Rs: <strong>' + amount + "</strong></div>" +
            '<div><strong>Amount In Words:</strong> <em>' + words + "</em></div></div>" +
            '<div class="voucher-copy__fields voucher-copy__fields--extra">' +
            '<div class="voucher-copy__line"><span><strong>DD/PO No:</strong></span><span class="voucher-copy__blank"></span></div>' +
            '<div class="voucher-copy__line"><span><strong>Drawn on Bank:</strong></span><span class="voucher-copy__blank"></span></div>' +
            '<div class="voucher-copy__line"><span><strong>Depositor Name:</strong></span><span class="voucher-copy__blank"></span></div>' +
            '<div class="voucher-copy__line"><span><strong>Depositor CNIC:</strong></span><span class="voucher-copy__blank"></span></div></div>' +
            '<div class="voucher-copy__sig-row">' +
            '<div class="voucher-copy__sig"><div>Depositor Name / Sign</div></div>' +
            '<div class="voucher-copy__sig"><div>Contact No.</div></div></div>' +
            '<div class="voucher-copy__fine">Cash/Cheque should always be deposited at the respective counter and electronic computer generated receipt printed through flatbed printer on deposit slip/challan should be obtained before leaving the counter.</div>' +
            '<div class="voucher-copy__urdu">براہ کرم رقم جمع کرواتے وقت کمپیوٹرائزڈ رسید ضرور حاصل کریں۔</div>' +
            "</div>"
        );
    }

    function renderGrid(v) {
        return (
            '<div class="voucher-grid">' +
            buildCopyHtml("Bank Copy", v) +
            buildCopyHtml("Bahria Copy", v) +
            buildCopyHtml("Customer Copy", v) +
            "</div>"
        );
    }

    function printInlineCss() {
        return (
            "@page { size: A4 landscape; margin: 5mm; }" +
            "*, *::before, *::after { box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }" +
            "html, body { margin: 0 !important; padding: 0 !important; background: #fff !important; }" +
            ".voucher-print-root { padding: 0; background: #fff; }" +
            ".voucher-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; width: 100%; }" +
            ".voucher-copy { background: #fff; border-right: 2px dashed #94a3b8; padding: 0 10px 8px 0; font-size: 10px; color: #0f172a; page-break-inside: avoid; break-inside: avoid; }" +
            ".voucher-copy:last-child { border-right: 0; padding-right: 0; }" +
            ".voucher-copy__label { text-align: right; font-weight: 800; font-size: 9px; text-transform: uppercase; letter-spacing: 0.06em; color: #475569; margin-bottom: 6px; }" +
            ".voucher-copy__brand { text-align: center; margin-bottom: 6px; }" +
            ".voucher-copy__brand img { height: 48px; width: auto; object-fit: contain; margin: 0 auto 4px; display: block; }" +
            ".voucher-copy__brand h3 { margin: 0; font-size: 11px; font-weight: 800; text-transform: uppercase; }" +
            ".voucher-copy__brand p { margin: 2px 0 0; font-size: 10px; font-weight: 700; color: #334155; }" +
            ".voucher-copy__row { display: flex; justify-content: space-between; align-items: center; gap: 6px; margin-top: 6px; }" +
            ".voucher-copy__no { background: #e2e8f0; border: 1px solid #94a3b8; padding: 3px 8px; font-family: monospace; font-weight: 800; font-size: 10px; border-radius: 4px; }" +
            ".voucher-copy__fields { margin-top: 6px; font-weight: 600; }" +
            ".voucher-copy__line { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 2px 6px; border-bottom: 1px solid #cbd5e1; padding-bottom: 2px; margin-bottom: 4px; }" +
            ".voucher-copy__bank { border-top: 2px solid #0f172a; margin-top: 6px; padding-top: 6px; }" +
            ".voucher-copy__amount { font-weight: 900; font-size: 12px; }" +
            ".voucher-copy__urdu { font-family: 'Noto Nastaliq Urdu', serif; direction: rtl; text-align: center; font-weight: 700; font-size: 12px; margin-top: 4px; padding-top: 4px; border-top: 1px solid #cbd5e1; }" +
            ".voucher-copy__fine { font-size: 7px; line-height: 1.35; color: #64748b; margin-top: 6px; padding-top: 4px; border-top: 1px solid #e2e8f0; }" +
            ".voucher-copy__blank { border-bottom: 1px solid #0f172a; flex: 1; min-height: 12px; margin: 0 4px; }" +
            ".voucher-copy__sig { text-align: center; margin-top: 14px; font-size: 9px; font-weight: 700; }" +
            ".voucher-copy__sig div { border-top: 1px solid #0f172a; padding-top: 3px; margin-top: 20px; }" +
            ".voucher-copy__sig-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }"
        );
    }

    function printFromContainer(containerSelector) {
        var grid = document.querySelector(containerSelector);
        if (!grid) return false;

        var clone = grid.cloneNode(true);
        var imgs = clone.querySelectorAll("img[src]");
        for (var i = 0; i < imgs.length; i++) {
            var src = imgs[i].getAttribute("src") || "";
            try {
                imgs[i].setAttribute("src", new URL(src, global.location.href).href);
            } catch (e) {
                /* keep */
            }
        }

        var fonts =
            "https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&family=Noto+Nastaliq+Urdu:wght@400;700&display=swap";
        var html =
            '<!DOCTYPE html><html lang="en"><head><meta charset="utf-8" /><title>Payment Voucher</title>' +
            '<link rel="stylesheet" href="' + esc(fonts) + '" /><style>' +
            printInlineCss() +
            'body{font-family:Inter,sans-serif;}</style></head><body><div class="voucher-print-root">' +
            clone.outerHTML +
            "</div></body></html>";

        var iframe = document.createElement("iframe");
        iframe.setAttribute("title", "Voucher print");
        iframe.style.cssText =
            "position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden;pointer-events:none;";
        document.body.appendChild(iframe);
        var win = iframe.contentWindow;
        win.document.open();
        win.document.write(html);
        win.document.close();

        function cleanup() {
            setTimeout(function () {
                if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
            }, 3000);
        }

        setTimeout(function () {
            try {
                win.focus();
                win.print();
            } finally {
                cleanup();
            }
        }, 400);

        return true;
    }

    global.RfidVoucherRender = {
        esc: esc,
        formatAmount: formatAmount,
        statusLabel: statusLabel,
        applyStatusBadge: applyStatusBadge,
        renderGrid: renderGrid,
        printFromContainer: printFromContainer
    };
})(window);
