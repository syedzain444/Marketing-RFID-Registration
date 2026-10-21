var RfidForm = (function () {
    var bypass = false;
    var submitted = false;
    var saveLabel = "Save Record";
    var photoObjectUrl = null;
    var captchaKey = null;
    var pendingSaveBtn = null;

    function val(id) {
        var el = document.getElementById(id);
        return el ? (el.value || "").trim() : "";
    }

    function radioInputs(id) {
        var root = document.getElementById(id);
        var inputs = root ? root.querySelectorAll("input[type=\"radio\"]") : [];
        if (!inputs.length && id === "rblStatus") {
            inputs = document.querySelectorAll("input[name=\"rblStatus\"]");
        }
        return inputs;
    }

    function radioValue(id) {
        var inputs = radioInputs(id);
        for (var i = 0; i < inputs.length; i++) {
            if (inputs[i].checked) return inputs[i].value;
        }
        return "";
    }

    function setError(field, message) {
        var box = document.querySelector('.field[data-field="' + field + '"]');
        var slot = document.getElementById("err-" + field);
        if (box) box.classList.toggle("has-error", !!message);
        if (slot) slot.textContent = message || "";
    }

    function clearErrors() {
        var fields = document.querySelectorAll(".field[data-field]");
        for (var i = 0; i < fields.length; i++) {
            fields[i].classList.remove("has-error");
        }
        var slots = document.querySelectorAll(".field-error");
        for (var j = 0; j < slots.length; j++) slots[j].textContent = "";
    }

    function escapeHtml(value) {
        return String(value || "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;");
    }

    function isDbText(text) {
        var t = String(text || "").toLowerCase();
        return t.indexOf("oracle") >= 0 || t.indexOf("password") >= 0 || t.indexOf("web.config") >= 0
            || t.indexOf("spers") >= 0 || t.indexOf("sid orcl") >= 0 || t.indexOf("ora-") >= 0
            || t.indexOf("database") >= 0;
    }

    function isDuplicateText(text) {
        var t = String(text || "").toLowerCase();
        return t.indexOf("duplicate") >= 0
            || t.indexOf("already has an open rfid") >= 0
            || t.indexOf("already on file") >= 0
            || t.indexOf("cannot be saved again") >= 0;
    }

    var swalTheme = {
        confirmButtonColor: "#004d4d",
        cancelButtonColor: "#6b7b7b"
    };

    function swalIcon(kind, success) {
        if (success) return "success";
        if (kind === "validation") return "warning";
        return "error";
    }

    function swalBody(messages, kind) {
        var kept = [];
        if (messages) {
            for (var i = 0; i < messages.length; i++) {
                if (!isDbText(messages[i])) kept.push(messages[i]);
            }
        }
        if (!kept.length) {
            if (kind === "success") return { text: "Your record was saved successfully." };
            if (kind === "validation") return { text: "Please correct the highlighted fields and try again." };
            return { text: "The record could not be saved. Please review the form and try again." };
        }
        if (kept.length === 1) return { text: kept[0] };
        var html = "<ul style=\"margin:0;padding-left:1.15em;text-align:left;\">";
        for (var j = 0; j < kept.length; j++) html += "<li>" + escapeHtml(kept[j]) + "</li>";
        html += "</ul>";
        return { html: html };
    }

    function showSweetAlert(kind, title, messages) {
        if (isDuplicateText(title)) title = "Some fields need attention";
        if (isDbText(title)) title = "Unable to save";
        var body = swalBody(messages, kind);
        if (typeof Swal === "undefined") return Promise.resolve();
        var opts = {
            icon: swalIcon(kind, kind === "success"),
            title: title,
            confirmButtonText: "OK",
            confirmButtonColor: swalTheme.confirmButtonColor
        };
        if (body.html) opts.html = body.html;
        else opts.text = body.text;
        return Swal.fire(opts);
    }

    function showNotice(kind, title, messages) {
        return showSweetAlert(kind, title, messages);
    }

    function paint(issues, showAlert) {
        if (showAlert === undefined) showAlert = true;
        clearErrors();
        var messages = [];
        for (var i = 0; i < issues.length; i++) {
            setError(issues[i].field, issues[i].message);
            if (issues[i].message) messages.push(issues[i].message);
        }
        if (!messages.length) return;
        if (showAlert) {
            showNotice("validation", "Some fields need attention", messages);
        }
        var first = document.querySelector('.field[data-field="' + issues[0].field + '"]');
        if (first && showAlert) {
            first.classList.remove("shake");
            void first.offsetWidth;
            first.classList.add("shake");
        }
    }

    function issue(field, message) {
        return { field: field, message: message };
    }

    function isBlank(value) { return !value; }

    function personOk(value, max) {
        if (!value || value.length > max) return false;
        return /^[A-Za-z0-9 .,'-]+$/.test(value);
    }

    function parseIso(value) {
        if (!value) return null;
        var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
        if (!m) return "bad";
        var d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
        if (d.getFullYear() !== Number(m[1]) || d.getMonth() !== Number(m[2]) - 1 || d.getDate() !== Number(m[3])) return "bad";
        return d;
    }

    function startOfDay(d) {
        return new Date(d.getFullYear(), d.getMonth(), d.getDate());
    }

    function localIssues() {
        var issues = [];
        var emp = val("txtEmpId");
        var rfid = val("txtRfid");
        var status = radioValue("rblStatus");
        var issuedBy = val("txtIssuedBy");
        var forward = radioValue("rblForward");
        var forwardBy = val("txtForwardBy");
        var approved = radioValue("rblApproved");
        var issueDate = parseIso(val("txtIssueDate"));
        var expiry = parseIso(val("txtExpiryDate"));
        var printDate = parseIso(val("txtPrintDate"));
        var created = parseIso(val("txtCreatedDate"));
        var approvedDate = parseIso(val("txtApprovedDate"));
        var forwardOn = parseIso(val("txtForwardOn"));
        var today = startOfDay(new Date());

        if (!emp) issues.push(issue("emp", "Employee ID is required."));
        else if (emp.length > 20 || !/^[A-Za-z0-9][A-Za-z0-9\-\/_.]*$/.test(emp)) issues.push(issue("emp", "Employee ID must be 1 to 20 characters: letters, numbers, hyphen, slash, underscore, or dot."));

        if (!rfid) issues.push(issue("rfid", "RFID number is required."));
        else if (rfid.length < 4 || rfid.length > 50 || !/^[A-Za-z0-9:\- ]+$/.test(rfid)) issues.push(issue("rfid", "RFID number must be 4 to 50 characters: letters, numbers, spaces, hyphens, or colons."));

        if (!status) issues.push(issue("status", "Status is required."));
        else if (status !== "Active" && status !== "Inactive") issues.push(issue("status", "Status must be Active or Inactive."));
        if (!issuedBy) issues.push(issue("issuedBy", "Issued by is required."));
        else if (!personOk(issuedBy, 50)) issues.push(issue("issuedBy", "Issued by must be 1 to 50 characters: letters, numbers, spaces, and . ' -"));

        if (isBlank(val("txtCreatedDate"))) issues.push(issue("created", "Created date is required."));
        else if (created === "bad") issues.push(issue("created", "Created date is not a valid date."));
        else if (created > today || created < new Date(2000, 0, 1)) issues.push(issue("created", "Created date must be between 01 Jan 2000 and today."));

        if (isBlank(val("txtIssueDate"))) issues.push(issue("issue", "Issue date is required."));
        else if (issueDate === "bad") issues.push(issue("issue", "Issue date is not a valid date."));
        else {
            var maxIssue = new Date(today.getFullYear(), today.getMonth(), today.getDate());
            maxIssue.setDate(maxIssue.getDate() + 30);
            if (issueDate < new Date(2000, 0, 1) || issueDate > maxIssue) issues.push(issue("issue", "Issue date must be between 01 Jan 2000 and 30 days from today."));
        }

        if (expiry === "bad") issues.push(issue("expiry", "Expiry date is not a valid date."));
        if (printDate === "bad") issues.push(issue("print", "Print date is not a valid date."));
        if (approvedDate === "bad") issues.push(issue("approvedDate", "Approved date is not a valid date."));
        if (forwardOn === "bad") issues.push(issue("forwardOn", "Forwarded on is not a valid date."));

        if (issueDate && expiry && expiry !== "bad" && issueDate !== "bad" && expiry <= issueDate) issues.push(issue("expiry", "Expiry date must be after the issue date."));
        if (printDate && issueDate && printDate !== "bad" && issueDate !== "bad" && printDate < issueDate) issues.push(issue("print", "Print date cannot be before the issue date."));

        if (forward === "Y") {
            if (!forwardBy) issues.push(issue("forwardBy", "Forwarded by is required when the request goes to the HOD."));
            else if (!personOk(forwardBy, 100)) issues.push(issue("forwardBy", "Forwarded by must be 1 to 100 characters: letters, numbers, spaces, and . ' -"));
            if (isBlank(val("txtForwardOn"))) issues.push(issue("forwardOn", "Forwarded on is required when the request goes to the HOD."));
        } else {
            if (forwardBy) issues.push(issue("forwardBy", "Clear Forwarded by, or set Forward to HOD to Yes."));
            if (val("txtForwardOn")) issues.push(issue("forwardOn", "Clear Forwarded on, or set Forward to HOD to Yes."));
        }
        if (forwardOn && created && forwardOn !== "bad" && created !== "bad" && forwardOn < created) issues.push(issue("forwardOn", "Forwarded on cannot be before the created date."));

        if (approved === "Y") {
            if (isBlank(val("txtApprovedDate"))) issues.push(issue("approvedDate", "Approved date is required when the request is approved."));
        } else {
            if (val("txtApprovedDate")) issues.push(issue("approvedDate", "Clear the approved date, or set Approved to Yes."));
        }
        if (approvedDate && created && approvedDate !== "bad" && created !== "bad" && approvedDate < created) issues.push(issue("approvedDate", "Approved date cannot be before the created date."));

        return issues;
    }

    function dismissBanner() { }

    function applyServerFieldErrors(fields) {
        if (!fields || !fields.length) return;
        for (var i = 0; i < fields.length; i++) {
            var field = document.querySelector('.field[data-field="' + fields[i] + '"]');
            if (field) field.classList.add("has-error");
        }
    }

    function resetFormValues() {
        var ids = ["txtEmpId", "txtRfid", "txtPhotoPath", "txtCardName", "txtDesignation", "txtDepartment", "txtProject", "txtJoiningDate", "txtBloodGroup", "txtCnic", "txtEmergencyNo", "txtGrade", "txtIssuedBy", "txtPrintDate", "txtApprovedDate", "txtApproveId", "txtForwardBy", "txtForwardOn", "txtHodRemarks", "txtRequesterRemarks"];
        for (var i = 0; i < ids.length; i++) {
            var el = document.getElementById(ids[i]);
            if (el) el.value = "";
        }
        var today = startOfDay(new Date());
        var iso = addMonths(today.getFullYear() + "-" + pad(today.getMonth() + 1) + "-" + pad(today.getDate()), 0);
        var issue = document.getElementById("txtIssueDate");
        var created = document.getElementById("txtCreatedDate");
        var expiry = document.getElementById("txtExpiryDate");
        if (issue) issue.value = iso;
        if (created) created.value = iso;
        if (expiry) expiry.value = addMonths(iso, 12);
        setRadio("rblStatus", "Active");
        setRadio("rblForward", "N");
        setRadio("rblApproved", "");
        revokePhotoObjectUrl();
        var pick = document.getElementById("filePhotoPick");
        if (pick) pick.value = "";
        closeCaptchaModal();
        setHiddenField("captchaKey", "");
        setHiddenField("captchaAnswer", "");
        clearErrors();
        submitted = false;
        refreshPreview();
        syncConditional();
        updateCounters();
        refreshMeter();
    }

    function handleSaveResult(payload) {
        if (!payload) return;
        if (typeof Swal !== "undefined") Swal.close();
        applyServerFieldErrors(payload.fields);
        var saved = payload.success === true;
        var kind = saved ? "success" : (payload.kind || "error");
        var title = payload.title || (saved ? "Saved" : "Some fields need attention");
        showSweetAlert(kind, title, payload.messages || []).then(function () {
            if (payload.reset && saved) resetFormValues();
        });
    }

    function flushPendingSaveResult() {
        if (window.__rfidSavePayload) {
            handleSaveResult(window.__rfidSavePayload);
            window.__rfidSavePayload = null;
        }
    }

    function formatPretty(iso) {
        var d = parseIso(iso);
        if (!d || d === "bad") return "—";
        var months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        return d.getDate() + " " + months[d.getMonth()] + " " + d.getFullYear();
    }

    function setPreviewLabel(id, text) {
        var el = document.getElementById(id);
        if (!el) return;
        var t = text && String(text).trim();
        el.textContent = t ? t : "—";
    }

    function refreshPreview() {
        setPreviewLabel("lblEmpID", val("txtEmpId"));
        setPreviewLabel("lblName", val("txtCardName"));
        setPreviewLabel("lblDesignation", val("txtDesignation"));
        setPreviewLabel("lblDepartment", val("txtDepartment"));
        setPreviewLabel("lblProject", val("txtProject"));
        var joiningIso = val("txtJoiningDate");
        setPreviewLabel("lblJoiningDate", joiningIso ? formatPretty(joiningIso) : "");
        setPreviewLabel("lblBloodGroup", val("txtBloodGroup"));
        setPreviewLabel("lblCnic", val("txtCnic"));
        setPreviewLabel("lblEmergencyNo", val("txtEmergencyNo"));
        setPreviewLabel("lblGradeBadge", val("txtGrade"));
        updatePassPhoto();
    }

    function updatePassPhoto() {
        var img = document.getElementById("imgEmpPhoto");
        var ph = document.getElementById("passPhotoPlaceholder");
        if (!img) return;
        var src = photoObjectUrl;
        if (!src) {
            var path = val("txtPhotoPath");
            if (window.RfidPhotos) {
                src = window.RfidPhotos.displayUrl(path);
            } else if (/^https?:\/\//i.test(path)) {
                src = path;
            } else if (path) {
                var p = path.replace(/\\/g, "/").replace(/^\/+/, "");
                src = "EmpPhoto.ashx?p=" + encodeURIComponent(p);
            }
        }
        if (src) {
            img.onload = function () {
                img.classList.remove("is-hidden");
                if (ph) ph.hidden = true;
            };
            img.onerror = function () {
                img.classList.add("is-hidden");
                if (ph) {
                    ph.hidden = false;
                    ph.textContent = "Photo unavailable";
                }
            };
            img.src = src;
        } else {
            img.removeAttribute("src");
            img.classList.add("is-hidden");
            if (ph) {
                ph.hidden = false;
                ph.textContent = "Photo unavailable";
            }
        }
    }

    function revokePhotoObjectUrl() {
        if (photoObjectUrl) {
            URL.revokeObjectURL(photoObjectUrl);
            photoObjectUrl = null;
        }
    }

    function syncConditional() {
        var forward = radioValue("rblForward");
        var approved = radioValue("rblApproved");
        toggleCond("expiry", false);
        toggleCond("print", false);
        toggleCond("forward", forward === "Y");
        toggleCond("approved", approved === "Y");
        toggleCond("hod", false);
    }

    function toggleCond(name, on) {
        var nodes = document.querySelectorAll('[data-cond="' + name + '"]');
        for (var i = 0; i < nodes.length; i++) nodes[i].classList.toggle("on", on);
    }

    function refreshMeter() {
        var issues = localIssues();
        var bad = {};
        for (var i = 0; i < issues.length; i++) bad[issues[i].field] = true;
        var base = ["emp", "rfid", "status", "issue", "issuedBy"];
        var ready = 0;
        for (var b = 0; b < base.length; b++) {
            var li = document.querySelector('[data-check="' + base[b] + '"]');
            var ok = !bad[base[b]] && filled(base[b]);
            if (li) li.classList.toggle("done", ok);
            if (ok) ready++;
        }
        var extraBad = bad.expiry || bad.print || bad.forward || bad.forwardBy || bad.forwardOn || bad.approved || bad.approvedDate || bad.created;
        var extra = document.querySelector('[data-check="extra"]');
        var extraOk = !extraBad && !bad.created && val("txtCreatedDate").length > 0;
        if (extra) extra.classList.toggle("done", extraOk);
        if (extraOk) ready++;
        var total = 6;
        document.getElementById("meterCount").textContent = ready + " of " + total + " done";
        var seg = document.getElementById("meterSeg");
        if (seg) {
            var parts = seg.querySelectorAll("span");
            for (var s = 0; s < parts.length; s++) {
                parts[s].classList.toggle("on", s < ready);
            }
        }
        var asideBtn = document.getElementById("btnSaveAside");
        if (asideBtn) {
            asideBtn.disabled = ready < total;
            asideBtn.classList.toggle("is-ready", ready >= total);
        }
    }

    function filled(key) {
        if (key === "emp") return val("txtEmpId").length > 0;
        if (key === "rfid") return val("txtRfid").length >= 4;
        if (key === "status") return radioValue("rblStatus").length > 0;
        if (key === "issue") return val("txtIssueDate").length > 0;
        if (key === "issuedBy") return val("txtIssuedBy").length > 0;
        return false;
    }

    function updateCounters() {
        var remarks = document.getElementById("txtRequesterRemarks");
        var hod = document.getElementById("txtHodRemarks");
        if (remarks) document.getElementById("remarksCount").textContent = remarks.value.length + "/500";
        if (hod) document.getElementById("hodCount").textContent = hod.value.length + "/500";
    }

    function setHiddenField(name, value) {
        var form = document.getElementById("form1");
        if (!form) return;
        var el = form.querySelector('input[type="hidden"][name="' + name + '"]');
        if (!el) {
            el = document.createElement("input");
            el.type = "hidden";
            el.name = name;
            form.appendChild(el);
        }
        el.value = value || "";
    }

    function closeCaptchaModal() {
        var modal = document.getElementById("captchaModal");
        if (modal) modal.classList.add("is-hidden");
        captchaKey = null;
        pendingSaveBtn = null;
        var err = document.getElementById("captchaError");
        if (err) err.hidden = true;
    }

    function loadCaptcha() {
        return fetch("Captcha.ashx", { method: "GET", cache: "no-store" })
            .then(function (res) { return res.json(); })
            .catch(function () { return null; });
    }

    function openCaptchaModal(saveBtn) {
        pendingSaveBtn = saveBtn || document.getElementById("btnSave");
        var modal = document.getElementById("captchaModal");
        var q = document.getElementById("captchaQuestion");
        var input = document.getElementById("captchaInput");
        var err = document.getElementById("captchaError");
        if (!modal || !q || !input) return;
        if (err) err.hidden = true;
        input.value = "";
        q.textContent = "Loading…";
        modal.classList.remove("is-hidden");
        input.focus();
        loadCaptcha().then(function (data) {
            if (!data || !data.ok) {
                q.textContent = "Could not load captcha.";
                captchaKey = null;
                return;
            }
            captchaKey = data.key;
            q.textContent = "What is " + data.a + " + " + data.b + "?";
        });
    }

    function confirmCaptchaAndSave() {
        var input = document.getElementById("captchaInput");
        var err = document.getElementById("captchaError");
        var answer = input ? input.value.trim() : "";
        if (!captchaKey || !answer) {
            if (err) {
                err.textContent = "Enter the answer shown above.";
                err.hidden = false;
            }
            return;
        }
        setHiddenField("captchaKey", captchaKey);
        setHiddenField("captchaAnswer", answer);
        closeCaptchaModal();
        bypass = true;
        var btn = pendingSaveBtn || document.getElementById("btnSave");
        if (typeof Swal !== "undefined") {
            Swal.fire({
                title: "Saving record…",
                allowOutsideClick: false,
                allowEscapeKey: false,
                didOpen: function () {
                    Swal.showLoading();
                }
            });
        }
        if (btn) btn.click();
    }

    function addMonths(iso, months) {
        var d = parseIso(iso) || startOfDay(new Date());
        if (d === "bad") d = startOfDay(new Date());
        var day = d.getDate();
        d.setDate(1);
        d.setMonth(d.getMonth() + months);
        var last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
        d.setDate(Math.min(day, last));
        var m = String(d.getMonth() + 1);
        var dayText = String(d.getDate());
        if (m.length < 2) m = "0" + m;
        if (dayText.length < 2) dayText = "0" + dayText;
        return d.getFullYear() + "-" + m + "-" + dayText;
    }

    function validateBeforeSubmit() {
        if (bypass) {
            bypass = false;
            return true;
        }
        submitted = true;
        var issues = localIssues();
        paint(issues);
        if (issues.length) return false;
        openCaptchaModal(document.getElementById("btnSave"));
        return false;
    }

    function clearForm() {
        resetFormValues();
        showSweetAlert("success", "Form cleared", ["All fields were reset. Issue date is today; expiry is one year out."]);
    }

    function pad(n) { return n < 10 ? "0" + n : String(n); }

    function setRadio(id, value) {
        var inputs = radioInputs(id);
        for (var i = 0; i < inputs.length; i++) inputs[i].checked = inputs[i].value === value;
    }

    function bind() {
        var watch = ["txtEmpId", "txtRfid", "txtPhotoPath", "txtCardName", "txtDesignation", "txtDepartment", "txtProject", "txtJoiningDate", "txtBloodGroup", "txtCnic", "txtEmergencyNo", "txtGrade", "txtIssueDate", "txtExpiryDate", "txtPrintDate", "txtIssuedBy", "txtCreatedDate", "txtRequesterRemarks", "txtHodRemarks", "txtForwardBy", "txtForwardOn", "txtApprovedDate", "txtApproveId"];
        for (var i = 0; i < watch.length; i++) {
            var el = document.getElementById(watch[i]);
            if (!el) continue;
            el.addEventListener("input", onEdit);
            el.addEventListener("change", onEdit);
        }
        var radios = document.querySelectorAll("input[name=\"rblStatus\"], #rblForward input, #rblApproved input");
        for (var r = 0; r < radios.length; r++) radios[r].addEventListener("change", onEdit);
        var chips = document.querySelectorAll(".chip-btn");
        for (var c = 0; c < chips.length; c++) {
            chips[c].addEventListener("click", function () {
                var months = Number(this.getAttribute("data-months"));
                var base = val("txtIssueDate");
                document.getElementById("txtExpiryDate").value = addMonths(base, months);
                onEdit();
            });
        }
        document.getElementById("btnClear").addEventListener("click", clearForm);
        var pick = document.getElementById("filePhotoPick");
        if (pick) {
            pick.addEventListener("change", function () {
                revokePhotoObjectUrl();
                var file = pick.files && pick.files[0];
                if (!file) {
                    updatePassPhoto();
                    return;
                }
                photoObjectUrl = URL.createObjectURL(file);
                updatePassPhoto();
                var pathBox = document.getElementById("txtPhotoPath");
                if (pathBox) {
                    pathBox.value = "Uploading…";
                }
                if (window.RfidPhotos && window.RfidPhotos.uploadFile) {
                    window.RfidPhotos.uploadFile(file).then(function (data) {
                        if (data && data.ok && data.path) {
                            if (pathBox) pathBox.value = data.path;
                            revokePhotoObjectUrl();
                            updatePassPhoto();
                            onEdit();
                            return;
                        }
                        if (pathBox) pathBox.value = "Photos/" + file.name;
                        if (typeof Swal !== "undefined") {
                            Swal.fire({ icon: "warning", title: "Photo not uploaded", text: (data && data.error) || "Save the file into Photos manually or try again." });
                        }
                        onEdit();
                    }).catch(function () {
                        if (pathBox) pathBox.value = "Photos/" + file.name;
                        if (typeof Swal !== "undefined") {
                            Swal.fire({ icon: "error", title: "Photo upload failed", text: "Check that PhotoUpload.ashx is reachable, then try Browse again." });
                        }
                        onEdit();
                    });
                } else if (pathBox) {
                    pathBox.value = "Photos/" + file.name;
                    onEdit();
                }
            });
        }
        var asideSave = document.getElementById("btnSaveAside");
        if (asideSave) {
            asideSave.addEventListener("click", function () {
                var btn = document.getElementById("btnSave");
                if (btn) btn.click();
            });
        }
        var capCancel = document.getElementById("captchaCancel");
        var capBackdrop = document.getElementById("captchaBackdrop");
        var capConfirm = document.getElementById("captchaConfirm");
        var capInput = document.getElementById("captchaInput");
        if (capCancel) capCancel.addEventListener("click", closeCaptchaModal);
        if (capBackdrop) capBackdrop.addEventListener("click", closeCaptchaModal);
        if (capConfirm) capConfirm.addEventListener("click", confirmCaptchaAndSave);
        if (capInput) {
            capInput.addEventListener("keydown", function (ev) {
                if (ev.key === "Enter") {
                    ev.preventDefault();
                    confirmCaptchaAndSave();
                }
            });
        }
    }

    function onEdit() {
        refreshPreview();
        syncConditional();
        updateCounters();
        refreshMeter();
        if (!submitted) return;
        var issues = localIssues();
        paint(issues, false);
        if (!issues.length) submitted = false;
    }

    function init() {
        bind();
        onEdit();
        flushPendingSaveResult();
    }

    return {
        init: init,
        validateBeforeSubmit: validateBeforeSubmit,
        dismissBanner: dismissBanner,
        handleSaveResult: handleSaveResult,
        resetFormValues: resetFormValues
    };
})();

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", RfidForm.init);
else RfidForm.init();
