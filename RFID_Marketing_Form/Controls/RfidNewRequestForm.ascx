<%@ Control Language="C#" AutoEventWireup="true" %>
<div class="new-request-form rfid-form-root detail-fit">
    <header class="detail-mini new-request-hero">
        <div class="detail-mini__photo">
            <div class="detail-mini__frame detail-mini__frame--sm">
                <img id="imgEmpPhoto" class="detail-mini__img is-hidden" alt="" />
                <div id="passPhotoPlaceholder" class="detail-mini__ph" aria-hidden="false">
                    <svg viewBox="0 0 24 24" width="24" height="24" fill="none" aria-hidden="true">
                        <circle cx="12" cy="9" r="3.5" stroke="currentColor" stroke-width="1.5"/>
                        <path d="M5 20c1.2-3 3.4-4.5 7-4.5s5.8 1.5 7 4.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                    </svg>
                </div>
            </div>
            <button type="button" class="new-request-photo-browse" id="btnPhotoBrowse">
                <span id="photoBrowseCaption">Employee photo</span>
            </button>
            <input type="file" id="filePhotoPick" name="employeePhoto" class="visually-hidden" accept="image/*" tabindex="-1" aria-hidden="true" />
            <input type="file" id="filePhotoPickFamily" name="familyPhoto" class="visually-hidden" accept="image/*" tabindex="-1" aria-hidden="true" />
            <input type="text" id="txtPhotoPath" maxlength="500" class="visually-hidden" tabindex="-1" aria-hidden="true" />
            <input type="text" id="txtFamilyPhotoPath" maxlength="500" class="visually-hidden" tabindex="-1" aria-hidden="true" />
        </div>
        <div class="detail-mini__head">
            <p class="detail-mini__eyebrow" id="newRequestHeroEyebrow">New RFID card request</p>
            <h3 id="newRequestHeroTitle" class="detail-mini__title">New assignment</h3>
            <p id="newRequestHeroSub" class="detail-mini__sub">Employee ID —</p>
            <div id="newRequestHeroChips" class="detail-mini__chips" aria-live="polite">
                <span class="badge badge--active">Active</span>
                <span class="badge badge--muted">Approved —</span>
            </div>
        </div>
    </header>

    <div class="nr-toolbar">
        <div class="new-request-family-toggle nr-toolbar__toggle" id="familyToggleBar">
            <div class="new-request-family-toggle__copy">
                <strong class="new-request-family-toggle__title">Family card</strong>
                <p class="new-request-family-toggle__hint">Save a new employee and family together, or add family to someone already on file</p>
            </div>
            <label class="family-switch" for="chkFamilyCard">
                <input type="checkbox" id="chkFamilyCard" class="family-switch__input" />
                <span class="family-switch__track" aria-hidden="true"><span class="family-switch__thumb"></span></span>
                <span class="family-switch__text" data-off="Off" data-on="On">Off</span>
            </label>
        </div>
        <div class="nr-tabs is-hidden" id="nrFormTabs" role="tablist" aria-label="Employee or family form">
            <button type="button" class="nr-tabs__btn nr-tabs__btn--employee is-active" role="tab" id="nrTabEmployee" aria-selected="true" aria-controls="nrPanelEmployee" data-tab="employee">Employee</button>
            <button type="button" class="nr-tabs__btn nr-tabs__btn--family" role="tab" id="nrTabFamily" aria-selected="false" aria-controls="nrPanelFamily" data-tab="family">Family</button>
        </div>
    </div>

    <div class="nr-panels-viewport">
        <div class="nr-panels-track" id="nrPanelsTrack">
            <section class="nr-panel" id="nrPanelEmployee" role="tabpanel" aria-labelledby="nrTabEmployee">
                <div class="detail-fit-grid new-request-grid new-request-grid--dense" id="nrEmployeeFields">
                    <div class="detail-cell detail-cell--field field" data-field="emp">
                        <label class="detail-field-label" for="txtEmpId">Employee ID <span class="req">*</span></label>
                        <input type="text" id="txtEmpId" maxlength="20" class="nr-field-input" placeholder="25130" autocomplete="off" />
                    </div>
                    <div class="detail-cell detail-cell--field field" data-field="grade">
                        <label class="detail-field-label" for="txtGrade">Grade</label>
                        <input type="text" id="txtGrade" maxlength="30" class="nr-field-input" placeholder="Optional" />
                    </div>
                    <div class="detail-cell detail-cell--field field" data-field="cardName">
                        <label class="detail-field-label" for="txtCardName">Name</label>
                        <input type="text" id="txtCardName" maxlength="100" class="nr-field-input" placeholder="Full name" />
                    </div>
                    <div class="detail-cell detail-cell--field field" data-field="designation">
                        <label class="detail-field-label" for="txtDesignation">Designation</label>
                        <input type="text" id="txtDesignation" maxlength="100" class="nr-field-input" placeholder="Job title" />
                    </div>
                    <div class="detail-cell detail-cell--field field" data-field="department">
                        <label class="detail-field-label" for="txtDepartment">Department</label>
                        <input type="text" id="txtDepartment" maxlength="100" class="nr-field-input" placeholder="Department" />
                    </div>
                    <div class="detail-cell detail-cell--field field" data-field="project">
                        <label class="detail-field-label" for="txtProject">Project / Location</label>
                        <input type="text" id="txtProject" maxlength="100" class="nr-field-input" placeholder="Site" />
                    </div>
                    <div class="detail-cell detail-cell--field field" data-field="joining">
                        <label class="detail-field-label" for="txtJoiningDate">Joining date</label>
                        <input type="date" id="txtJoiningDate" class="nr-field-input nr-field-input--date" />
                    </div>
                    <div class="detail-cell detail-cell--field field" data-field="bloodGroup">
                        <label class="detail-field-label" for="txtBloodGroup">Blood group</label>
                        <input type="text" id="txtBloodGroup" maxlength="20" class="nr-field-input" placeholder="O+" />
                    </div>
                    <div class="detail-cell detail-cell--field field" data-field="cnic">
                        <label class="detail-field-label" for="txtCnic">CNIC</label>
                        <input type="text" id="txtCnic" maxlength="20" class="nr-field-input" placeholder="CNIC" />
                    </div>
                    <div class="detail-cell detail-cell--field field" data-field="emergencyNo">
                        <label class="detail-field-label" for="txtEmergencyNo">Emergency #</label>
                        <input type="text" id="txtEmergencyNo" maxlength="30" class="nr-field-input" placeholder="Contact" />
                    </div>
                </div>
            </section>
            <section class="nr-panel nr-panel--family" id="nrPanelFamily" role="tabpanel" aria-labelledby="nrTabFamily" hidden="hidden" aria-hidden="true">
                <p id="nrFamilyOnlyIntro" class="nr-family-only-intro is-hidden">Enter an employee ID that is already in RFID assignments, then complete the dependent details below.</p>
                <p class="nr-family-panel__intro" id="nrFamilyPanelIntro">Dependent card <span class="nr-family-panel__badge" id="nrFamilyPanelBadge">Fill employee tab first for new hires</span></p>
                <p id="nrEmpLookupHint" class="nr-emp-lookup-hint is-hidden" aria-live="polite"></p>
                <div class="detail-fit-grid new-request-grid new-request-grid--dense new-request-grid--family" id="nrFamilyFields">
                    <div class="detail-cell detail-cell--field field" data-field="familyName">
                        <label class="detail-field-label" for="txtFamilyCardName">Card holder name <span class="req">*</span></label>
                        <input type="text" id="txtFamilyCardName" maxlength="100" class="nr-field-input" placeholder="As on card" />
                    </div>
                    <div class="detail-cell detail-cell--field field" data-field="familyRelationship">
                        <label class="detail-field-label" for="txtFamilyRelationship">Relationship <span class="req">*</span></label>
                        <select id="txtFamilyRelationship" class="nr-field-input nr-field-select">
                            <option value="">Select…</option>
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
                    <div class="detail-cell detail-cell--field field" data-field="familyCnic">
                        <label class="detail-field-label" for="txtFamilyCnic">CNIC</label>
                        <input type="text" id="txtFamilyCnic" maxlength="20" class="nr-field-input" placeholder="42101-5200244-8" />
                    </div>
                    <div class="detail-cell detail-cell--field field" data-field="familyCardId">
                        <label class="detail-field-label" for="txtFamilyCardIdPreview">Card ID</label>
                        <input type="text" id="txtFamilyCardIdPreview" class="nr-field-input nr-field-input--readonly" readonly="readonly" placeholder="On save" tabindex="-1" />
                    </div>
                    <div class="detail-cell detail-cell--field field" data-field="familyRfid">
                        <label class="detail-field-label" for="txtFamilyRfidNumber">RFID number</label>
                        <input type="text" id="txtFamilyRfidNumber" maxlength="50" class="nr-field-input" placeholder="Optional" />
                    </div>
                </div>
            </section>
        </div>
    </div>

    <div class="nr-shared-strip">
        <div class="new-request-status-bar field" data-field="status">
            <span class="new-request-status-bar__label">Status</span>
            <div id="rblStatus" class="pills pills-segment pills-segment--on-white pills-compact">
                <label class="pill"><input type="radio" name="rblStatus" value="Active" checked="checked" /> Active</label>
                <label class="pill"><input type="radio" name="rblStatus" value="Inactive" /> Inactive</label>
            </div>
        </div>
        <div class="detail-fit-grid new-request-grid new-request-grid--dense new-request-grid--shared">
            <div class="detail-cell detail-cell--field field" data-field="issue">
                <label class="detail-field-label" for="txtIssueDate">Issue date <span class="req">*</span></label>
                <input type="date" id="txtIssueDate" class="nr-field-input nr-field-input--date" />
            </div>
            <div class="detail-cell detail-cell--field field" data-field="expiry">
                <label class="detail-field-label" for="txtExpiryDate">Expiry date</label>
                <input type="date" id="txtExpiryDate" class="nr-field-input nr-field-input--date" />
                <div class="chips-row chips-row--compact">
                    <button type="button" class="chip-btn" data-months="6">6m</button>
                    <button type="button" class="chip-btn" data-months="12">1y</button>
                    <button type="button" class="chip-btn" data-months="24">2y</button>
                </div>
            </div>
            <div class="detail-cell detail-cell--field field" data-field="forward">
                <span class="detail-field-label">Forward HOD</span>
                <div id="rblForward" class="pills pills-segment pills-compact pills-segment--on-white">
                    <label class="pill"><input type="radio" name="rblForward" value="N" checked="checked" /> No</label>
                    <label class="pill"><input type="radio" name="rblForward" value="Y" /> Yes</label>
                </div>
            </div>
            <div class="detail-cell detail-cell--field field" data-field="forwardBy">
                <label class="detail-field-label" for="txtForwardBy">Forwarded by</label>
                <input type="text" id="txtForwardBy" maxlength="100" class="nr-field-input" placeholder="Name" />
            </div>
            <div class="detail-cell detail-cell--field field" data-field="forwardOn">
                <label class="detail-field-label" for="txtForwardOn">Forwarded on</label>
                <input type="date" id="txtForwardOn" class="nr-field-input nr-field-input--date" />
            </div>
            <div class="detail-cell detail-cell--field field" data-field="approved">
                <span class="detail-field-label">Approved</span>
                <div id="rblApproved" class="pills pills-segment pills-compact pills-segment--on-white">
                    <label class="pill"><input type="radio" name="rblApproved" value="" checked="checked" /> —</label>
                    <label class="pill"><input type="radio" name="rblApproved" value="Y" /> Yes</label>
                    <label class="pill"><input type="radio" name="rblApproved" value="N" /> No</label>
                </div>
            </div>
            <div class="detail-cell detail-cell--field field" data-field="approvedDate">
                <label class="detail-field-label" for="txtApprovedDate">Approved date</label>
                <input type="date" id="txtApprovedDate" class="nr-field-input nr-field-input--date" />
            </div>
            <div class="detail-cell detail-cell--field field" data-field="approveId">
                <label class="detail-field-label" for="txtApproveId">Approver ID</label>
                <input type="text" id="txtApproveId" maxlength="10" class="nr-field-input" inputmode="numeric" />
            </div>
            <div class="detail-cell detail-cell--field detail-cell--wide field" data-field="hod">
                <label class="detail-field-label" for="txtHodRemarks">HOD remarks <span class="counter" id="hodCount">0/500</span></label>
                <input type="text" id="txtHodRemarks" maxlength="500" class="nr-field-input" placeholder="Optional" />
            </div>
            <div class="detail-cell detail-cell--field detail-cell--wide field" data-field="remarks">
                <label class="detail-field-label" for="txtRequesterRemarks">Requester remarks <span class="counter" id="remarksCount">0/500</span></label>
                <input type="text" id="txtRequesterRemarks" maxlength="500" class="nr-field-input" placeholder="Who asked, and why" />
            </div>
        </div>
    </div>

    <span id="lblEmpID" class="visually-hidden" aria-hidden="true">—</span>
    <span id="lblName" class="visually-hidden" aria-hidden="true">—</span>
    <span id="lblDesignation" class="visually-hidden" aria-hidden="true">—</span>
    <span id="lblDepartment" class="visually-hidden" aria-hidden="true">—</span>
    <span id="lblProject" class="visually-hidden" aria-hidden="true">—</span>
    <span id="lblJoiningDate" class="visually-hidden" aria-hidden="true">—</span>
    <span id="lblBloodGroup" class="visually-hidden" aria-hidden="true">—</span>
    <span id="lblCnic" class="visually-hidden" aria-hidden="true">—</span>
    <span id="lblEmergencyNo" class="visually-hidden" aria-hidden="true">—</span>
    <span id="lblGradeBadge" class="visually-hidden" aria-hidden="true">—</span>

    <button type="button" id="btnSaveAside" class="visually-hidden" tabindex="-1" aria-hidden="true">Save record</button>
    <button type="button" id="btnSave" class="visually-hidden" tabindex="-1" aria-hidden="true">Save Record</button>
</div>
