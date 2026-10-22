var RfidForm = (function () {
    var bypass = false;
    var submitted = false;
    var saveLabel = "Save Record";
    var photoObjectUrl = null;
    var photoObjectUrls = { employee: null, family: null };
    var captchaKey = null;
    var pendingSaveBtn = null;
    var config = {
        ajaxSaveUrl: null,
        onSaveSuccess: null
    };
    var activeFormTab = "employee";
    var formMode = "default";
    var empLookupTimer = null;
    var recordsLookupUrl = null;

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

    function isFamilyMode() {
        if (formMode === "familyOnly") return true;
        var chk = document.getElementById("chkFamilyCard");
        return !!(chk && chk.checked);
    }

    function isFamilyOnlyMode() {
        return formMode === "familyOnly";
    }

    function setRecordsLookupUrl(url) {
        recordsLookupUrl = url || null;
    }

    function applyFormMode() {
        var root = document.querySelector(".new-request-form");
        if (root) root.classList.toggle("is-family-only", isFamilyOnlyMode());

        var toggleBar = document.getElementById("familyToggleBar");
        if (toggleBar) toggleBar.classList.toggle("is-hidden", isFamilyOnlyMode());

        var onlyIntro = document.getElementById("nrFamilyOnlyIntro");
        if (onlyIntro) onlyIntro.classList.toggle("is-hidden", !isFamilyOnlyMode());

        var panelIntro = document.getElementById("nrFamilyPanelIntro");
        if (panelIntro) panelIntro.classList.toggle("is-hidden", isFamilyOnlyMode());

        var badge = document.getElementById("nrFamilyPanelBadge");
        if (badge && !isFamilyOnlyMode()) {
            badge.textContent = isFamilyMode() ? "New employee: complete Employee tab too" : "Fill employee tab first for new hires";
        }

        var chk = document.getElementById("chkFamilyCard");
        if (chk) {
            if (isFamilyOnlyMode()) {
                chk.checked = true;
                chk.disabled = true;
            } else {
                chk.disabled = false;
            }
        }

        var saveBtn = document.getElementById("btnNewRequestSave");
        if (saveBtn) {
            saveBtn.textContent = isFamilyOnlyMode() ? "Save family card" : "Save record";
        }

        var heroTitle = document.getElementById("newRequestHeroTitle");
        if (heroTitle && isFamilyOnlyMode()) heroTitle.textContent = "Add family card";
        else if (heroTitle && !isFamilyMode()) heroTitle.textContent = "New assignment";

        syncFamilyMode();
        if (isFamilyOnlyMode()) setFormTab("family", false);
        clearEmpLookupHint();
        syncPhotoBrowseCaption();
        updatePassPhoto();
    }

    function clearEmpLookupHint() {
        var hint = document.getElementById("nrEmpLookupHint");
        if (!hint) return;
        hint.textContent = "";
        hint.classList.add("is-hidden");
        hint.classList.remove("is-found", "is-missing");
    }

    function scheduleEmpLookup() {
        if (!isFamilyOnlyMode() || !recordsLookupUrl) return;
        if (empLookupTimer) clearTimeout(empLookupTimer);
        empLookupTimer = setTimeout(runEmpLookup, 350);
    }

    function runEmpLookup() {
        empLookupTimer = null;
        var hint = document.getElementById("nrEmpLookupHint");
        if (!hint || !recordsLookupUrl) return;
        var emp = val("txtEmpId");
        if (!emp) {
            clearEmpLookupHint();
            return;
        }
        hint.textContent = "Checking employee ID…";
        hint.classList.remove("is-hidden", "is-found", "is-missing");
        fetch(recordsLookupUrl + (recordsLookupUrl.indexOf("?") >= 0 ? "&" : "?") + "action=lookupemp&empId=" + encodeURIComponent(emp), {
            cache: "no-store",
            credentials: "same-origin"
        })
            .then(function (res) {
                return res.json();
            })
            .then(function (data) {
                if (!data || !data.Ok) {
                    hint.textContent = "Could not verify employee ID.";
                    hint.classList.add("is-missing");
                    return;
                }
                if (data.Exists) {
                    hint.textContent = data.EmployeeName
                        ? "Employee on file: " + data.EmployeeName
                        : "Employee ID found in RFID assignments.";
                    hint.classList.add("is-found");
                } else {
                    hint.textContent = "No RFID assignment for this ID. Use New request to create the employee first.";
                    hint.classList.add("is-missing");
                }
            })
            .catch(function () {
                hint.textContent = "Could not verify employee ID.";
                hint.classList.add("is-missing");
            });
    }

    function getHeroPreviewTab() {
        if (!isFamilyMode()) return "employee";
        return activeFormTab;
    }

    function activePhotoContext() {
        if (isFamilyOnlyMode()) return "family";
        if (isFamilyMode() && activeFormTab === "family") return "family";
        return "employee";
    }

    function syncPhotoBrowseCaption() {
        var cap = document.getElementById("photoBrowseCaption");
        if (!cap) return;
        cap.textContent = activePhotoContext() === "family" ? "Family photo" : "Employee photo";
    }

    function setFormTab(tab, animate) {
        if (animate === undefined) animate = true;
        tab = tab === "family" ? "family" : "employee";
        if (!isFamilyMode()) tab = "employee";
        activeFormTab = tab;

        var track = document.getElementById("nrPanelsTrack");
        var viewport = document.querySelector(".nr-panels-viewport");
        if (track) {
            track.classList.toggle("is-tab-family", tab === "family");
            if (!animate) {
                track.style.transition = "none";
                void track.offsetWidth;
                track.style.transition = "";
            }
        }
        if (viewport) viewport.classList.toggle("is-tab-family", tab === "family");

        var tabEmp = document.getElementById("nrTabEmployee");
        var tabFam = document.getElementById("nrTabFamily");
        if (tabEmp) {
            tabEmp.classList.toggle("is-active", tab === "employee");
            tabEmp.setAttribute("aria-selected", tab === "employee" ? "true" : "false");
        }
        if (tabFam) {
            tabFam.classList.toggle("is-active", tab === "family");
            tabFam.setAttribute("aria-selected", tab === "family" ? "true" : "false");
        }

        var root = document.querySelector(".new-request-form");
        if (root) {
            root.classList.toggle("is-tab-employee", tab === "employee");
            root.classList.toggle("is-tab-family", tab === "family");
        }

        var panelEmp = document.getElementById("nrPanelEmployee");
        var panelFam = document.getElementById("nrPanelFamily");
        if (panelFam) panelFam.hidden = !isFamilyMode();
        if (panelEmp) {
            panelEmp.setAttribute("aria-hidden", isFamilyMode() && tab === "family" ? "true" : "false");
        }
        if (panelFam) {
            panelFam.setAttribute("aria-hidden", !isFamilyMode() || tab === "employee" ? "true" : "false");
        }

        updateFamilyCardIdPreview();
        refreshNewRequestHero();
        refreshMeter();
        syncPhotoBrowseCaption();
        updatePassPhoto();
    }

    function syncFamilyMode() {
        var on = isFamilyMode();
        var root = document.querySelector(".new-request-form");
        if (root) root.classList.toggle("is-family-mode", on);

        var tabs = document.getElementById("nrFormTabs");
        if (tabs) tabs.classList.toggle("is-hidden", !on);
        var panelFam = document.getElementById("nrPanelFamily");
        if (panelFam) panelFam.hidden = !on;

        var swText = document.querySelector(".family-switch__text");
        if (swText) swText.textContent = on ? (swText.getAttribute("data-on") || "On") : (swText.getAttribute("data-off") || "Off");
        var swLabel = document.querySelector(".family-switch");
        if (swLabel) swLabel.classList.toggle("is-on", on);

        if (on) {
            setFormTab(activeFormTab, false);
        } else {
            activeFormTab = "employee";
            setFormTab("employee", false);
            var root = document.querySelector(".new-request-form");
            if (root) {
                root.classList.remove("is-tab-family");
                root.classList.add("is-tab-employee");
            }
        }
    }

    function onFamilyToggleChange() {
        var on = isFamilyMode();
        syncFamilyMode();
        var badge = document.getElementById("nrFamilyPanelBadge");
        if (badge && !isFamilyOnlyMode()) {
            badge.textContent = on ? "New employee: complete Employee tab too" : "Fill employee tab first for new hires";
        }
        if (on) setFormTab("family", true);
        syncPhotoBrowseCaption();
        updatePassPhoto();
    }

    function updateFamilyCardIdPreview() {
        var preview = document.getElementById("txtFamilyCardIdPreview");
        if (!preview) return;
        var emp = val("txtEmpId");
        preview.value = emp ? emp + "-?" : "";
        preview.placeholder = emp ? "" : "Enter employee ID first";
    }

    function localIssues() {
        var issues = [];
        if (isFamilyMode()) {
            return localFamilyIssues();
        }
        var emp = val("txtEmpId");
        var status = radioValue("rblStatus");
        var forward = radioValue("rblForward");
        var forwardBy = val("txtForwardBy");
        var approved = radioValue("rblApproved");
        var today = startOfDay(new Date());
        var issueDate = parseIso(val("txtIssueDate"));
        var expiry = parseIso(val("txtExpiryDate"));
        var approvedDate = parseIso(val("txtApprovedDate"));
        var createdAnchor = parseIso(val("txtIssueDate"));
        if (createdAnchor === "bad" || !createdAnchor) {
            createdAnchor = today;
        }
        var forwardOn = parseIso(val("txtForwardOn"));

        if (!emp) issues.push(issue("emp", "Employee ID is required."));
        else if (emp.length > 20 || !/^[A-Za-z0-9][A-Za-z0-9\-\/_.]*$/.test(emp)) issues.push(issue("emp", "Employee ID must be 1 to 20 characters: letters, numbers, hyphen, slash, underscore, or dot."));

        if (!status) issues.push(issue("status", "Status is required."));
        else if (status !== "Active" && status !== "Inactive") issues.push(issue("status", "Status must be Active or Inactive."));
        if (isBlank(val("txtIssueDate"))) issues.push(issue("issue", "Issue date is required."));
        else if (issueDate === "bad") issues.push(issue("issue", "Issue date is not a valid date."));
        else {
            var maxIssue = new Date(today.getFullYear(), today.getMonth(), today.getDate());
            maxIssue.setDate(maxIssue.getDate() + 30);
            if (issueDate < new Date(2000, 0, 1) || issueDate > maxIssue) issues.push(issue("issue", "Issue date must be between 01 Jan 2000 and 30 days from today."));
        }

        if (expiry === "bad") issues.push(issue("expiry", "Expiry date is not a valid date."));
        if (approvedDate === "bad") issues.push(issue("approvedDate", "Approved date is not a valid date."));
        if (forwardOn === "bad") issues.push(issue("forwardOn", "Forwarded on is not a valid date."));

        if (issueDate && expiry && expiry !== "bad" && issueDate !== "bad" && expiry <= issueDate) issues.push(issue("expiry", "Expiry date must be after the issue date."));
        if (forward === "Y") {
            if (!forwardBy) issues.push(issue("forwardBy", "Forwarded by is required when the request goes to the HOD."));
            else if (!personOk(forwardBy, 100)) issues.push(issue("forwardBy", "Forwarded by must be 1 to 100 characters: letters, numbers, spaces, and . ' -"));
            if (isBlank(val("txtForwardOn"))) issues.push(issue("forwardOn", "Forwarded on is required when the request goes to the HOD."));
        } else {
            if (forwardBy) issues.push(issue("forwardBy", "Clear Forwarded by, or set Forward to HOD to Yes."));
            if (val("txtForwardOn")) issues.push(issue("forwardOn", "Clear Forwarded on, or set Forward to HOD to Yes."));
        }
        if (forwardOn && forwardOn !== "bad" && createdAnchor !== "bad" && forwardOn < createdAnchor) {
            issues.push(issue("forwardOn", "Forwarded on cannot be before the issue date."));
        }

        if (approved === "Y") {
            if (isBlank(val("txtApprovedDate"))) issues.push(issue("approvedDate", "Approved date is required when the request is approved."));
        } else {
            if (val("txtApprovedDate")) issues.push(issue("approvedDate", "Clear the approved date, or set Approved to Yes."));
        }
        if (approvedDate && approvedDate !== "bad" && createdAnchor !== "bad" && approvedDate < createdAnchor) {
            issues.push(issue("approvedDate", "Approved date cannot be before the issue date."));
        }

        return issues;
    }

    function localFamilyIssues() {
        var issues = [];
        var emp = val("txtEmpId");
        var status = radioValue("rblStatus");
        var forward = radioValue("rblForward");
        var forwardBy = val("txtForwardBy");
        var approved = radioValue("rblApproved");
        var today = startOfDay(new Date());
        var issueDate = parseIso(val("txtIssueDate"));
        var expiry = parseIso(val("txtExpiryDate"));
        var approvedDate = parseIso(val("txtApprovedDate"));
        var forwardOn = parseIso(val("txtForwardOn"));
        var name = val("txtFamilyCardName");
        var rel = val("txtFamilyRelationship");

        if (!emp) issues.push(issue("emp", "Employee ID is required."));
        else if (emp.length > 20 || !/^[A-Za-z0-9][A-Za-z0-9\-\/_.]*$/.test(emp)) {
            issues.push(issue("emp", "Employee ID must be 1 to 20 characters: letters, numbers, hyphen, slash, underscore, or dot."));
        }
        if (!name) issues.push(issue("familyName", "Family member name is required."));
        if (!rel) issues.push(issue("familyRelationship", "Relationship is required."));
        if (!status) issues.push(issue("status", "Status is required."));
        if (isBlank(val("txtIssueDate"))) issues.push(issue("issue", "Issue date is required."));
        else if (issueDate === "bad") issues.push(issue("issue", "Issue date is not a valid date."));
        if (expiry === "bad") issues.push(issue("expiry", "Expiry date is not a valid date."));
        if (issueDate && expiry && expiry !== "bad" && issueDate !== "bad" && expiry <= issueDate) {
            issues.push(issue("expiry", "Expiry date must be after the issue date."));
        }
        if (forward === "Y") {
            if (!forwardBy) issues.push(issue("forwardBy", "Forwarded by is required when the request goes to the HOD."));
            if (isBlank(val("txtForwardOn"))) issues.push(issue("forwardOn", "Forwarded on is required when the request goes to the HOD."));
        }
        if (approved === "Y" && isBlank(val("txtApprovedDate"))) {
            issues.push(issue("approvedDate", "Approved date is required when the request is approved."));
        }
        if (forwardOn === "bad") issues.push(issue("forwardOn", "Forwarded on is not a valid date."));
        if (approvedDate === "bad") issues.push(issue("approvedDate", "Approved date is not a valid date."));
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
        var ids = ["txtEmpId", "txtPhotoPath", "txtCardName", "txtDesignation", "txtDepartment", "txtProject", "txtJoiningDate", "txtBloodGroup", "txtCnic", "txtEmergencyNo", "txtGrade", "txtApprovedDate", "txtApproveId", "txtForwardBy", "txtForwardOn", "txtHodRemarks", "txtRequesterRemarks"];
        for (var i = 0; i < ids.length; i++) {
            var el = document.getElementById(ids[i]);
            if (el) el.value = "";
        }
        var today = startOfDay(new Date());
        var iso = addMonths(today.getFullYear() + "-" + pad(today.getMonth() + 1) + "-" + pad(today.getDate()), 0);
        var issue = document.getElementById("txtIssueDate");
        var expiry = document.getElementById("txtExpiryDate");
        if (issue) issue.value = iso;
        if (expiry) expiry.value = addMonths(iso, 12);
        setRadio("rblStatus", "Active");
        setRadio("rblForward", "N");
        setRadio("rblApproved", "");
        var famChk = document.getElementById("chkFamilyCard");
        if (famChk) {
            famChk.checked = isFamilyOnlyMode();
            if (!isFamilyOnlyMode()) famChk.disabled = false;
        }
        activeFormTab = isFamilyOnlyMode() ? "family" : "employee";
        ["txtFamilyCardName", "txtFamilyRelationship", "txtFamilyCnic", "txtFamilyRfidNumber", "txtFamilyCardIdPreview", "txtFamilyPhotoPath"].forEach(function (id) {
            var el = document.getElementById(id);
            if (el) el.value = "";
        });
        syncFamilyMode();
        applyFormMode();
        revokePhotoObjectUrl();
        var pickEmp = document.getElementById("filePhotoPick");
        var pickFam = document.getElementById("filePhotoPickFamily");
        if (pickEmp) pickEmp.value = "";
        if (pickFam) pickFam.value = "";
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
            if (saved && typeof config.onSaveSuccess === "function") {
                config.onSaveSuccess(payload);
            }
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

    function refreshNewRequestHero() {
        var titleEl = document.getElementById("newRequestHeroTitle");
        var subEl = document.getElementById("newRequestHeroSub");
        var chipsEl = document.getElementById("newRequestHeroChips");
        if (!titleEl && !subEl && !chipsEl) return;

        var emp = val("txtEmpId");
        var name = val("txtCardName");
        var previewTab = getHeroPreviewTab();
        var eyebrowEl = document.getElementById("newRequestHeroEyebrow");
        if (eyebrowEl) {
            if (!isFamilyMode()) eyebrowEl.textContent = "New RFID card request";
            else if (previewTab === "family") eyebrowEl.textContent = "Employee family card";
            else eyebrowEl.textContent = "Employee card · family request";
        }

        var displayName = previewTab === "family" ? val("txtFamilyCardName") : name;
        var rel = val("txtFamilyRelationship");
        if (titleEl) {
            if (previewTab === "family") {
                titleEl.textContent = displayName || "Family member";
            } else {
                titleEl.textContent = name || "New assignment";
            }
        }
        if (subEl) {
            if (previewTab === "family") {
                var relLabel = rel
                    ? rel.charAt(0) + rel.slice(1).toLowerCase().replace(/_/g, " ")
                    : "Relationship —";
                subEl.innerHTML = emp
                    ? relLabel + ' · Employee <span class="rfid-mono">' + escapeHtml(emp) + "</span>"
                    : relLabel;
            } else {
                subEl.innerHTML = emp
                    ? 'Employee ID <span class="rfid-mono">' + escapeHtml(emp) + "</span>"
                    : "Employee ID —";
            }
        }
        if (chipsEl) {
            var status = radioValue("rblStatus") || "Active";
            var approved = radioValue("rblApproved");
            var statusCls = status.toLowerCase() === "active" ? "badge badge--active" : "badge badge--muted";
            var apprText = approved === "Y" ? "Yes" : approved === "N" ? "No" : "Not set";
            var apprCls = approved === "Y" ? "badge badge--yes" : "badge badge--muted";
            var rfid = previewTab === "family" ? val("txtFamilyRfidNumber") : "—";
            var cardId = val("txtFamilyCardIdPreview");
            var tabBadge = isFamilyMode()
                ? '<span class="badge badge--muted">' + (previewTab === "family" ? "Family tab" : "Employee tab") + "</span>"
                : "";
            chipsEl.innerHTML =
                tabBadge +
                '<span class="' + statusCls + '">' + escapeHtml(status) + "</span>" +
                '<span class="' + apprCls + '">' + escapeHtml(apprText) + "</span>" +
                (previewTab === "family" && cardId
                    ? '<span class="badge badge--muted">Card <span class="rfid-mono">' + escapeHtml(cardId) + "</span></span>"
                    : "") +
                '<span class="badge badge--muted">RFID <span class="rfid-mono">' + escapeHtml(rfid || "—") + "</span></span>";
        }
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
        refreshNewRequestHero();
        updateFamilyCardIdPreview();
        updatePassPhoto();
    }

    function resolvePhotoDisplaySrc(path, objectUrl) {
        if (objectUrl) return objectUrl;
        path = (path || "").trim();
        if (!path || path === "Uploading…") return "";
        if (window.RfidPhotos) return window.RfidPhotos.displayUrl(path);
        if (/^https?:\/\//i.test(path)) return path;
        var p = path.replace(/\\/g, "/").replace(/^\/+/, "");
        return p ? "EmpPhoto.ashx?p=" + encodeURIComponent(p) : "";
    }

    function updatePassPhoto() {
        var img = document.getElementById("imgEmpPhoto");
        var ph = document.getElementById("passPhotoPlaceholder");
        if (!img) return;
        var ctx = activePhotoContext();
        var path = ctx === "family" ? val("txtFamilyPhotoPath") : val("txtPhotoPath");
        var src = resolvePhotoDisplaySrc(path, photoObjectUrls[ctx]);
        if (src) {
            img.onload = function () {
                img.classList.remove("is-hidden");
                img.classList.add("is-loaded");
                if (ph) ph.classList.add("is-hidden");
            };
            img.onerror = function () {
                img.classList.add("is-hidden");
                img.classList.remove("is-loaded");
                if (ph) {
                    ph.classList.remove("is-hidden");
                }
            };
            img.src = src;
        } else {
            img.removeAttribute("src");
            img.classList.add("is-hidden");
            img.classList.remove("is-loaded");
            if (ph) ph.classList.remove("is-hidden");
        }
    }

    function revokePhotoObjectUrl(which) {
        if (which) {
            if (photoObjectUrls[which]) {
                URL.revokeObjectURL(photoObjectUrls[which]);
                photoObjectUrls[which] = null;
            }
            return;
        }
        revokePhotoObjectUrl("employee");
        revokePhotoObjectUrl("family");
        photoObjectUrl = null;
    }

    function bindPhotoFileInput(pickEl, context) {
        if (!pickEl) return;
        pickEl.addEventListener("change", function () {
            revokePhotoObjectUrl(context);
            var file = pickEl.files && pickEl.files[0];
            var pathBox = document.getElementById(context === "family" ? "txtFamilyPhotoPath" : "txtPhotoPath");
            if (!file) {
                updatePassPhoto();
                return;
            }
            photoObjectUrls[context] = URL.createObjectURL(file);
            if (activePhotoContext() === context) updatePassPhoto();
            if (pathBox) pathBox.value = "Uploading…";
            function finishPath(path) {
                if (pathBox) pathBox.value = path || "";
                if (photoObjectUrls[context]) {
                    revokePhotoObjectUrl(context);
                }
                if (activePhotoContext() === context) updatePassPhoto();
                onEdit();
            }
            if (window.RfidPhotos && window.RfidPhotos.uploadFile) {
                window.RfidPhotos.uploadFile(file).then(function (data) {
                    if (data && data.ok && data.path) {
                        finishPath(data.path);
                        return;
                    }
                    finishPath("Photos/" + file.name);
                    if (typeof Swal !== "undefined") {
                        Swal.fire({
                            icon: "warning",
                            title: "Photo not uploaded",
                            text: (data && data.error) || "Save the file into Photos manually or try again."
                        });
                    }
                }).catch(function () {
                    finishPath("Photos/" + file.name);
                    if (typeof Swal !== "undefined") {
                        Swal.fire({
                            icon: "error",
                            title: "Photo upload failed",
                            text: "Check that PhotoUpload.ashx is reachable, then try Browse again."
                        });
                    }
                });
            } else {
                finishPath("Photos/" + file.name);
            }
        });
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
        var base = ["emp", "status", "issue"];
        var ready = 0;
        for (var b = 0; b < base.length; b++) {
            var li = document.querySelector('[data-check="' + base[b] + '"]');
            var ok = !bad[base[b]] && filled(base[b]);
            if (li) li.classList.toggle("done", ok);
            if (ok) ready++;
        }
        var extraBad = bad.expiry || bad.forward || bad.forwardBy || bad.forwardOn || bad.approved || bad.approvedDate;
        if (isFamilyMode()) {
            extraBad = extraBad || bad.familyName || bad.familyRelationship;
        }
        var extra = document.querySelector('[data-check="extra"]');
        var extraOk = !extraBad;
        if (isFamilyMode() && extraOk) {
            extraOk = val("txtFamilyCardName").length > 0 && val("txtFamilyRelationship").length > 0 && !bad.familyName && !bad.familyRelationship;
        }
        if (extra) extra.classList.toggle("done", extraOk);
        if (extraOk) ready++;
        var total = 4;
        var meterCount = document.getElementById("meterCount");
        if (meterCount) meterCount.textContent = ready + " of " + total + " done";
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
        var modalSave = document.getElementById("btnNewRequestSave");
        if (modalSave) {
            modalSave.disabled = ready < total;
            modalSave.classList.toggle("is-ready", ready >= total);
        }
    }

    function filled(key) {
        if (key === "emp") return val("txtEmpId").length > 0;
        if (key === "status") return radioValue("rblStatus").length > 0;
        if (key === "issue") return val("txtIssueDate").length > 0;
        if (key === "extra" && isFamilyMode()) {
            return val("txtFamilyCardName").length > 0 && val("txtFamilyRelationship").length > 0;
        }
        return false;
    }

    function updateCounters() {
        var remarks = document.getElementById("txtRequesterRemarks");
        var hod = document.getElementById("txtHodRemarks");
        var rc = document.getElementById("remarksCount");
        var hc = document.getElementById("hodCount");
        if (remarks && rc) rc.textContent = remarks.value.length + "/500";
        if (hod && hc) hc.textContent = hod.value.length + "/500";
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

    function buildSaveFormData() {
        var fd = new FormData();
        var textIds = [
            "txtEmpId", "txtPhotoPath", "txtCardName", "txtDesignation", "txtDepartment", "txtProject",
            "txtJoiningDate", "txtBloodGroup", "txtCnic", "txtEmergencyNo", "txtIssueDate", "txtExpiryDate",
            "txtForwardBy", "txtForwardOn", "txtHodRemarks", "txtApprovedDate", "txtApproveId", "txtRequesterRemarks"
        ];
        for (var i = 0; i < textIds.length; i++) {
            fd.append(textIds[i], val(textIds[i]));
        }
        fd.append("rblStatus", radioValue("rblStatus"));
        fd.append("rblForward", radioValue("rblForward"));
        fd.append("rblApproved", radioValue("rblApproved"));
        fd.append("isFamilyCard", isFamilyMode() ? "Y" : "N");
        fd.append("familyOnlyMode", isFamilyOnlyMode() ? "Y" : "N");
        fd.append("txtFamilyCardName", val("txtFamilyCardName"));
        fd.append("txtFamilyRelationship", val("txtFamilyRelationship"));
        fd.append("txtFamilyCnic", val("txtFamilyCnic"));
        fd.append("txtFamilyRfidNumber", val("txtFamilyRfidNumber"));
        fd.append("txtFamilyPhotoPath", val("txtFamilyPhotoPath"));
        var form = document.getElementById("form1");
        var keyEl = form ? form.querySelector('input[type="hidden"][name="captchaKey"]') : null;
        var ansEl = form ? form.querySelector('input[type="hidden"][name="captchaAnswer"]') : null;
        fd.append("captchaKey", keyEl ? keyEl.value : "");
        fd.append("captchaAnswer", ansEl ? ansEl.value : "");
        var pickEmp = document.getElementById("filePhotoPick");
        var pickFam = document.getElementById("filePhotoPickFamily");
        if (pickEmp && pickEmp.files && pickEmp.files[0]) {
            fd.append("employeePhoto", pickEmp.files[0]);
        }
        if (pickFam && pickFam.files && pickFam.files[0]) {
            fd.append("familyPhoto", pickFam.files[0]);
        }
        return fd;
    }

    function performAjaxSave() {
        if (!config.ajaxSaveUrl) return;
        fetch(config.ajaxSaveUrl, { method: "POST", body: buildSaveFormData(), credentials: "same-origin" })
            .then(function (res) {
                return res.json().catch(function () {
                    return null;
                });
            })
            .then(function (payload) {
                if (!payload) {
                    handleSaveResult({
                        success: false,
                        kind: "error",
                        title: "Unable to save",
                        messages: ["Unexpected response from the server."],
                        fields: []
                    });
                    return;
                }
                handleSaveResult(payload);
            })
            .catch(function () {
                handleSaveResult({
                    success: false,
                    kind: "error",
                    title: "Network error",
                    messages: ["Could not reach the save service. Check your connection and try again."],
                    fields: []
                });
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
        if (config.ajaxSaveUrl) {
            performAjaxSave();
            return;
        }
        bypass = true;
        var btn = pendingSaveBtn || document.getElementById("btnSave");
        if (btn) btn.click();
    }

    function triggerSaveFlow() {
        submitted = true;
        var issues = localIssues();
        paint(issues);
        if (issues.length) return;
        openCaptchaModal(document.getElementById("btnSaveAside") || document.getElementById("btnSave"));
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
        var watch = ["txtEmpId", "txtPhotoPath", "txtCardName", "txtDesignation", "txtDepartment", "txtProject", "txtJoiningDate", "txtBloodGroup", "txtCnic", "txtEmergencyNo", "txtGrade", "txtIssueDate", "txtExpiryDate", "txtRequesterRemarks", "txtHodRemarks", "txtForwardBy", "txtForwardOn", "txtApprovedDate", "txtApproveId", "txtFamilyCardName", "txtFamilyRelationship", "txtFamilyCnic", "txtFamilyRfidNumber"];
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
        var clearBtn = document.getElementById("btnClear");
        if (clearBtn) clearBtn.addEventListener("click", clearForm);
        var famChk = document.getElementById("chkFamilyCard");
        if (famChk) famChk.addEventListener("change", onFamilyToggleChange);
        var tabEmp = document.getElementById("nrTabEmployee");
        var tabFam = document.getElementById("nrTabFamily");
        if (tabEmp) {
            tabEmp.addEventListener("click", function () {
                if (isFamilyMode()) setFormTab("employee", true);
            });
        }
        if (tabFam) {
            tabFam.addEventListener("click", function () {
                if (isFamilyMode()) setFormTab("family", true);
            });
        }
        var btnPhotoBrowse = document.getElementById("btnPhotoBrowse");
        if (btnPhotoBrowse) {
            btnPhotoBrowse.addEventListener("click", function () {
                var ctx = activePhotoContext();
                var pick = document.getElementById(ctx === "family" ? "filePhotoPickFamily" : "filePhotoPick");
                if (pick) pick.click();
            });
        }
        var empInput = document.getElementById("txtEmpId");
        if (empInput) {
            empInput.addEventListener("input", function () {
                updateFamilyCardIdPreview();
                scheduleEmpLookup();
            });
            empInput.addEventListener("blur", runEmpLookup);
        }
        bindPhotoFileInput(document.getElementById("filePhotoPick"), "employee");
        bindPhotoFileInput(document.getElementById("filePhotoPickFamily"), "family");
        var asideSave = document.getElementById("btnSaveAside");
        if (asideSave) {
            asideSave.addEventListener("click", function () {
                if (config.ajaxSaveUrl) {
                    triggerSaveFlow();
                    return;
                }
                var btn = document.getElementById("btnSave");
                if (btn) btn.click();
            });
        }
        var modalSave = document.getElementById("btnNewRequestSave");
        if (modalSave) {
            modalSave.addEventListener("click", triggerSaveFlow);
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

    function configure(opts) {
        if (!opts) return;
        if (opts.ajaxSaveUrl) config.ajaxSaveUrl = opts.ajaxSaveUrl;
        if (opts.onSaveSuccess) config.onSaveSuccess = opts.onSaveSuccess;
        if (opts.recordsLookupUrl) setRecordsLookupUrl(opts.recordsLookupUrl);
    }

    function openWithMode(mode) {
        formMode = mode === "familyOnly" ? "familyOnly" : "default";
        resetFormValues();
        if (isFamilyOnlyMode() && val("txtEmpId")) runEmpLookup();
        refreshNewRequestHero();
    }

    function init() {
        bind();
        syncFamilyMode();
        syncPhotoBrowseCaption();
        onEdit();
        flushPendingSaveResult();
    }

    function boot() {
        if (!document.getElementById("txtEmpId")) return;
        if (document.getElementById("newRequestModal")) return;
        init();
    }

    return {
        init: init,
        configure: configure,
        boot: boot,
        openWithMode: openWithMode,
        validateBeforeSubmit: validateBeforeSubmit,
        dismissBanner: dismissBanner,
        handleSaveResult: handleSaveResult,
        resetFormValues: resetFormValues,
        triggerSaveFlow: triggerSaveFlow,
        syncFamilyMode: syncFamilyMode,
        setFormTab: setFormTab
    };
})();

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", RfidForm.boot);
else RfidForm.boot();
