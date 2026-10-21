using System;
using System.Data;
using System.Web.UI;
using System.Web.UI.WebControls;
using System.IO; // ADDED FOR FILE UPLOAD

namespace EmployeeCardSystem
{
    public partial class MyRequests : System.Web.UI.Page
    {
        private string LoggedEmpID
        {
            get { return Session["EmpID"] != null ? Session["EmpID"].ToString() : ""; }
        }

        // NEW: ViewState properties for the Photo Upload Modal
        private string UploadEmpID
        {
            get { return ViewState["UploadEmpID"] != null ? ViewState["UploadEmpID"].ToString() : ""; }
            set { ViewState["UploadEmpID"] = value; }
        }

        private long UploadRequestID
        {
            get { return ViewState["UploadRequestID"] != null ? Convert.ToInt64(ViewState["UploadRequestID"]) : 0; }
            set { ViewState["UploadRequestID"] = value; }
        }

        protected void Page_Load(object sender, EventArgs e)
        {
            if (Session["LoggedIn"] == null || !(bool)Session["LoggedIn"])
            {
                Response.Redirect("Login.aspx");
                return;
            }

            if (Session["IsHOD"] != null && (bool)Session["IsHOD"])
            {
                Response.Redirect("HODApprovals.aspx");
                return;
            }

            lblUserTop.Text = LoggedEmpID;

            if (!IsPostBack)
            {
                LoadMyRequests();
                LoadFamilyRequests();
            }
            else
            {
                if (ViewState["RfidModalOpen"] != null && ViewState["RfidModalOpen"].ToString() == "1")
                {
                    ClientScript.RegisterStartupScript(this.GetType(), "reopen",
                        "setTimeout(function(){ showRFIDModal(); }, 100);", true);
                }
                else if (ViewState["OpenViewModal"] != null)
                {
                    string which = ViewState["OpenViewModal"].ToString();
                    if (which == "details")
                    {
                        ClientScript.RegisterStartupScript(this.GetType(), "reopenDet",
                            "setTimeout(function(){ showViewDetailsModal(); }, 100);", true);
                    }
                    else if (which == "card")
                    {
                        ClientScript.RegisterStartupScript(this.GetType(), "reopenCard",
                            "setTimeout(function(){ showPrintCardViewModal(); }, 100);", true);
                    }
                }
            }
        }

        // --- TAB SWITCHING LOGIC ---
        protected void btnTabEmp_Click(object sender, EventArgs e)
        {
            mvMyRequests.ActiveViewIndex = 0;
            btnTabEmp.CssClass = "tab-btn active-tab";
            btnTabFam.CssClass = "tab-btn";
        }

        protected void btnTabFam_Click(object sender, EventArgs e)
        {
            mvMyRequests.ActiveViewIndex = 1;
            btnTabFam.CssClass = "tab-btn active-tab";
            btnTabEmp.CssClass = "tab-btn";
        }

        private void LoadMyRequests()
        {
            try
            {
                DataTable dt = DatabaseHelper.GetAllForwardedRequests();
                gvMyRequests.DataSource = dt;
                gvMyRequests.DataBind();
            }
            catch (Exception ex)
            {
                lblMsg.Text = "Error: " + ex.Message;
                pnlMsg.Visible = true;
                pnlMsg.CssClass = "alert alert-error";
            }
        }

        private void LoadFamilyRequests()
        {
            try
            {
                DataTable dt = DatabaseHelper.GetAllForwardedFamilyRequests();
                gvFamilyRequests.DataSource = dt;
                gvFamilyRequests.DataBind();
            }
            catch (Exception ex)
            {
                // Silently fail or add error handling
            }
        }

        protected void gvMyRequests_RowCommand(object sender, GridViewCommandEventArgs e)
        {
            if (e.CommandName == "ViewDetails" || e.CommandName == "PrintCard")
            {
                long requestId;
                if (!long.TryParse(e.CommandArgument.ToString(), out requestId))
                {
                    return;
                }

                DataRow row = DatabaseHelper.GetRequestById(requestId);
                if (row == null)
                {
                    return;
                }

                string empId = row["EMP_ID"].ToString();
                Employee emp = DatabaseHelper.GetEmployeeById(empId);
                BindRequestReadonlyFields(row, emp);

                string subtitle = BuildModalSubtitle(row, emp);
                lblDetModalSubtitle.Text = subtitle;
                lblPcModalSubtitle.Text = subtitle;

                if (e.CommandName == "ViewDetails")
                {
                    ViewState["OpenViewModal"] = "details";
                    ClientScript.RegisterStartupScript(this.GetType(), "showDet",
                        "setTimeout(function(){ showViewDetailsModal(); }, 100);", true);
                }
                else
                {
                    BindPrintCardPreview(row, emp);
                    ViewState["OpenViewModal"] = "card";
                    ClientScript.RegisterStartupScript(this.GetType(), "showPc",
                        "setTimeout(function(){ showPrintCardViewModal(); }, 100);", true);
                }

                return;
            }

            if (e.CommandName == "AssignRFID")
            {
                long requestId;
                if (!long.TryParse(e.CommandArgument.ToString(), out requestId)) return;

                DataRow row = DatabaseHelper.GetRequestById(requestId);
                if (row == null) return;

                string empId = row["EMP_ID"].ToString();
                ViewState["AssignRequestId"] = requestId;
                ViewState["AssignEmpID"] = empId;
                ViewState["RfidValidated"] = null;
                ViewState["RfidModalOpen"] = "1";

                hfKeepRfid.Value = "0";

                LoadEmployeeForPrint(empId);

                lblModalEmp.Text = empId;
                lblModalIssueDate.Text = DateTime.Now.ToString("dd-MMM-yyyy");
                lblModalExpiryDate.Text = DateTime.Now.AddYears(1).ToString("dd-MMM-yyyy");
                lblModalIssuedBy.Text = LoggedEmpID;

                btnConfirmRFID.Text = "✓ Validate RFID";

                ClientScript.RegisterStartupScript(this.GetType(), "show",
                    "setTimeout(function(){ showRFIDModal(); }, 100);", true);
            }
        }

        // NEW: Handle Family Grid Commands
        protected void gvFamilyRequests_RowCommand(object sender, GridViewCommandEventArgs e)
        {
            if (e.CommandName == "UploadPhoto")
            {
                long requestId = Convert.ToInt64(e.CommandArgument);

                DataTable dt = DatabaseHelper.GetFamilyRequestFullDetail(requestId);
                if (dt.Rows.Count > 0)
                {
                    DataRow r = dt.Rows[0];
                    UploadRequestID = requestId;
                    UploadEmpID = r["EMP_ID"].ToString();

                    lblPhotoEmp.Text = r["EMP_ID"].ToString() + " - " + r["ENAME"].ToString();
                    lblPhotoDep.Text = r["DEP_NAME"].ToString();

                    ClientScript.RegisterStartupScript(this.GetType(), "showPhoto",
                        "setTimeout(function(){ showPhotoUploadModal(); }, 100);", true);
                }
            }
            else if (e.CommandName == "AssignFamRFID")
            {
                // NEW: Trigger the RFID Modal for Family Cards
                long requestId = Convert.ToInt64(e.CommandArgument);
                DataTable dt = DatabaseHelper.GetFamilyRequestFullDetail(requestId);
                if (dt.Rows.Count == 0) return;

                DataRow r = dt.Rows[0];
                string empId = r["EMP_ID"].ToString();

                ViewState["IsFamilyPrint"] = "1";
                ViewState["AssignRequestId"] = requestId;
                ViewState["AssignEmpID"] = empId;
                ViewState["RfidValidated"] = null;
                ViewState["RfidModalOpen"] = "1";
                hfKeepRfid.Value = "0";

                // Populate Modal Info
                lblModalEmp.Text = r["EMP_ID"].ToString() + " - " + r["ENAME"].ToString() + " (Dependent: " + r["DEP_NAME"].ToString() + ")";
                lblModalIssueDate.Text = DateTime.Now.ToString("dd-MMM-yyyy");
                lblModalExpiryDate.Text = DateTime.Now.AddYears(1).ToString("dd-MMM-yyyy");
                lblModalIssuedBy.Text = LoggedEmpID;

                btnConfirmRFID.Text = "✓ Validate RFID";

                ClientScript.RegisterStartupScript(this.GetType(), "show",
                    "setTimeout(function(){ showRFIDModal(); }, 100);", true);
            }
        }

        // NEW: Handle Photo Upload
        protected void btnSavePhoto_Click(object sender, EventArgs e)
        {
            if (!fuDependentPhoto.HasFile)
            {
                ShowPhotoError("Please select an image file.");
                return;
            }

            try
            {
                string ext = System.IO.Path.GetExtension(fuDependentPhoto.FileName).ToLower();
                if (ext != ".jpg" && ext != ".jpeg" && ext != ".png")
                {
                    ShowPhotoError("Only JPG and PNG files are allowed.");
                    return;
                }

                // Generate unique filename: Emp{empId}Dependentpic{ext}
                string fileName = "Emp" + UploadEmpID + "Dependentpic" + ext;

                // Ensure directory exists
                string folderPath = Server.MapPath("~/Images/EmpFamilyPictures/");
                if (!System.IO.Directory.Exists(folderPath))
                {
                    System.IO.Directory.CreateDirectory(folderPath);
                }

                // Save File
                string fullPath = System.IO.Path.Combine(folderPath, fileName);
                fuDependentPhoto.SaveAs(fullPath);

                // Save path to DB (Relative path)
                string dbPath = "~/Images/EmpFamilyPictures/" + fileName;

                string err;
                if (DatabaseHelper.SaveFamilyPhotoPath(UploadRequestID, dbPath, out err))
                {
                    // Success
                    ClientScript.RegisterStartupScript(this.GetType(), "closeModal", "hidePhotoUploadModal();", true);
                    LoadFamilyRequests(); // Reload grid to show new button

                    lblMsg.Text = "✅ Photo uploaded successfully. You can now assign RFID & Print.";
                    pnlMsg.Visible = true;
                    pnlMsg.CssClass = "alert alert-success";
                }
                else
                {
                    ShowPhotoError("DB Error: " + err);
                }
            }
            catch (Exception ex)
            {
                ShowPhotoError("Upload Error: " + ex.Message);
            }
        }

        private void ShowPhotoError(string msg)
        {
            ClientScript.RegisterStartupScript(this.GetType(), "err",
                "showPhotoUploadModal(); document.getElementById('photoError').innerText = '" + EscapeJs(msg) + "'; document.getElementById('photoError').style.display = 'block';", true);
        }

        protected void btnConfirmRFID_Click(object sender, EventArgs e)
        {
            long requestId = 0;
            long.TryParse(ViewState["AssignRequestId"] != null ? ViewState["AssignRequestId"].ToString() : "0", out requestId);
            string empId = ViewState["AssignEmpID"] != null ? ViewState["AssignEmpID"].ToString() : "";
            string rfidNumber = txtRFID.Text.Trim();

            bool isValidated = (ViewState["RfidValidated"] != null && ViewState["RfidValidated"].ToString() == "1");

            if (!isValidated)
            {
                if (string.IsNullOrEmpty(rfidNumber))
                {
                    ViewState["RfidModalOpen"] = "1";
                    hfKeepRfid.Value = "1";
                    ClientScript.RegisterStartupScript(this.GetType(), "err",
                        "setTimeout(function(){ showRFIDModal(); showRFIDError('❌ Please scan or enter RFID.'); }, 100);", true);
                    return;
                }

                try
                {
                    RFIDCheckResult existing = DatabaseHelper.CheckRFIDExists(rfidNumber);
                    if (!existing.IsAvailable && existing.Status == "ACTIVE")
                    {
                        bool sameEmp = !string.IsNullOrEmpty(existing.ExistingEmpID)
                                       && existing.ExistingEmpID.Equals(empId, StringComparison.OrdinalIgnoreCase);
                        if (!sameEmp)
                        {
                            string msg = "RFID already ACTIVE for: " + existing.ExistingEmpID + " - " + existing.ExistingEmpName;
                            ViewState["RfidModalOpen"] = "1";
                            hfKeepRfid.Value = "1";
                            ClientScript.RegisterStartupScript(this.GetType(), "err",
                                "setTimeout(function(){ showRFIDModal(); showRFIDError('❌ " + EscapeJs(msg) + "'); }, 100);", true);
                            return;
                        }
                    }

                    ViewState["RfidValidated"] = "1";
                    ViewState["RfidModalOpen"] = "1";
                    btnConfirmRFID.Text = "✓ Confirm & Print";
                    hfKeepRfid.Value = "1";

                    ClientScript.RegisterStartupScript(this.GetType(), "ok",
                        "setTimeout(function(){ showRFIDModal(); showRFIDOk('✅ RFID is available. Click CONFIRM & PRINT.'); }, 100);", true);
                    return;
                }
                catch (Exception ex)
                {
                    ViewState["RfidModalOpen"] = "1";
                    hfKeepRfid.Value = "1";
                    ClientScript.RegisterStartupScript(this.GetType(), "err",
                        "setTimeout(function(){ showRFIDModal(); showRFIDError('❌ " + EscapeJs(ex.Message) + "'); }, 100);", true);
                    return;
                }
            }

            try
            {
                string err;
                bool ok = false;

                // Check if this is a Family Card or Employee Card
                if (ViewState["IsFamilyPrint"] != null && ViewState["IsFamilyPrint"].ToString() == "1")
                {
                    // FAMILY CARD ASSIGNMENT
                    ok = DatabaseHelper.AssignFamilyRFIDAndPrint(requestId, rfidNumber, LoggedEmpID, out err);

                    if (ok)
                    {
                        // Clear states and redirect to the print preview page
                        ViewState["IsFamilyPrint"] = null;
                        ViewState["RfidValidated"] = null;
                        ViewState["RfidModalOpen"] = null;
                        hfKeepRfid.Value = "0";

                        ClientScript.RegisterStartupScript(this.GetType(), "ok",
                            "hideRFIDModal(); window.location.href='EmpFamilyCard.aspx?id=" + requestId + "';", true);
                        return;
                    }
                }
                else
                {
                    // EMPLOYEE CARD ASSIGNMENT (Existing Logic)
                    ok = DatabaseHelper.AssignRFIDAndPrint(requestId, rfidNumber, LoggedEmpID, out err);

                    if (ok)
                    {
                        ViewState["RfidValidated"] = null;
                        ViewState["RfidModalOpen"] = null;
                        ViewState["PreviewEmpID"] = empId;
                        ViewState["PreviewRfid"] = rfidNumber;
                        btnConfirmRFID.Text = "✓ Validate RFID";
                        hfKeepRfid.Value = "0";

                        LoadPreviewCard(empId, rfidNumber);

                        ClientScript.RegisterStartupScript(this.GetType(), "ok",
                            "hideRFIDModal(); setTimeout(function(){ showConfirmPrintModal(); }, 200);", true);

                        LoadMyRequests();
                        return;
                    }
                }

                // Error Handling (applies to both if ok == false)
                if (!ok)
                {
                    ViewState["RfidValidated"] = null;
                    ViewState["RfidModalOpen"] = "1";
                    btnConfirmRFID.Text = "✓ Validate RFID";
                    hfKeepRfid.Value = "1";

                    ClientScript.RegisterStartupScript(this.GetType(), "err",
                        "setTimeout(function(){ showRFIDModal(); showRFIDError('❌ " + EscapeJs(err) + "'); }, 100);", true);
                    return;
                }
            }
            catch (Exception ex)
            {
                ViewState["RfidValidated"] = null;
                ViewState["RfidModalOpen"] = "1";
                btnConfirmRFID.Text = "✓ Validate RFID";
                hfKeepRfid.Value = "1";

                ClientScript.RegisterStartupScript(this.GetType(), "err",
                    "setTimeout(function(){ showRFIDModal(); showRFIDError('❌ " + EscapeJs(ex.Message) + "'); }, 100);", true);
            }
        }

        private void LoadPreviewCard(string empId, string rfidNumber)
        {
            Employee emp = DatabaseHelper.GetEmployeeById(empId);
            if (emp == null)
            {
                lblMsg.Text = "❌ Employee data not found. Cannot print card.";
                pnlMsg.CssClass = "alert alert-error";
                pnlMsg.Visible = true;
                return;
            }

            string errors = "";

            if (string.IsNullOrWhiteSpace(emp.EMP_ID)) errors += "• Employee ID missing<br/>";
            if (string.IsNullOrWhiteSpace(emp.ENAME)) errors += "• Name missing<br/>";
            if (string.IsNullOrWhiteSpace(emp.DGN_NM)) errors += "• Designation missing<br/>";
            if (string.IsNullOrWhiteSpace(emp.DPT_NM)) errors += "• Department missing<br/>";
            if (string.IsNullOrWhiteSpace(emp.PRJ_NM)) errors += "• Project/Location missing<br/>";
            if (!emp.DT_JOIN.HasValue) errors += "• Joining Date missing<br/>";
            if (string.IsNullOrWhiteSpace(emp.BLD_GRP)) errors += "• Blood Group missing<br/>";
            if (string.IsNullOrWhiteSpace(emp.CNIC)) errors += "• CNIC missing<br/>";
            if (string.IsNullOrWhiteSpace(emp.PH_CELL2)) errors += "• Emergency Number (PH_CELL2) missing<br/>";

            if (!string.IsNullOrEmpty(errors))
            {
                lblMsg.Text = "❌ <strong>Card cannot be printed.</strong> Please update following fields in employee record:<br/><br/>" + errors;
                pnlMsg.CssClass = "alert alert-error";
                pnlMsg.Visible = true;

                ClientScript.RegisterStartupScript(this.GetType(), "blockPrint",
                    "hideRFIDModal(); alert('❌ Card cannot be printed. Following fields are missing:\\n\\n" +
                    errors.Replace("<br/>", "\\n").Replace("<strong>", "").Replace("</strong>", "").Replace("• ", "- ") +
                    "\\nPlease update employee record first.');", true);
                return;
            }

            lblConfirmEmp.Text = empId + " - " + emp.ENAME.ToUpper();
            lblConfirmRfid.Text = rfidNumber;
            lblConfirmIssue.Text = DateTime.Now.ToString("dd-MMM-yyyy");
            lblConfirmExpiry.Text = DateTime.Now.AddYears(1).ToString("dd-MMM-yyyy");

            lblEmpIDPrev.Text = emp.EMP_ID;
            lblNamePrev.Text = emp.ENAME.ToUpper();
            lblDesignationPrev.Text = emp.DGN_NM.ToUpper();
            lblDepartmentPrev.Text = emp.DPT_NM.ToUpper();
            lblProjectPrev.Text = emp.PRJ_NM.ToUpper();

            string grade = emp.GRD_AB ?? "";
            string digits = System.Text.RegularExpressions.Regex.Replace(grade, @"[^\d]", "");
            int gradeNum = 0;
            int.TryParse(digits, out gradeNum);

            lblGradeBadgePrev.Text = gradeNum > 5 ? "OFFICIAL" : "EMPLOYEE";

            string photoUrl = "http://172.16.10.54/EImages/EImages/" + empId + ".jpg";
            imgEmpPhotoPrev.ImageUrl = photoUrl;
            imgEmpPhotoPrev.Attributes["onerror"] = "this.src='images/default-user.jpg'";
            imgLogoPrev.ImageUrl = "~/RFID_Marketing_Form/Images/logo.png";

            //lblCardIDPrev.Text = emp.EMP_ID;
            lblJoiningDatePrev.Text = emp.DT_JOIN.Value.ToString("dd-MMM-yy");
            lblCNICBackPrev.Text = emp.CNIC;
            lblBloodGroupPrev.Text = emp.BLD_GRP;
            lblEmergencyPrev.Text = emp.PH_CELL2;

            lblIssueDatePrev.Text = DateTime.Now.ToString("dd-MMM-yy");
            lblExpiryDatePrev.Text = DateTime.Now.AddYears(1).ToString("dd-MMM-yy");
        }

        protected void btnDoPrint_Click(object sender, EventArgs e)
        {
            string empId = ViewState["PreviewEmpID"] != null ? ViewState["PreviewEmpID"].ToString() : "";
            if (string.IsNullOrEmpty(empId))
            {
                Response.Redirect("MyRequests.aspx");
                return;
            }

            LoadEmployeeForPrint(empId);

            lblMsg.Text = "✅ Card sent to FARGO DTC1500 for Employee " + empId +
                          ". Verify: CR-80 Portrait · Duplex ON · Page 1 = Front, Page 2 = Back.";
            pnlMsg.CssClass = "alert alert-success";
            pnlMsg.Visible = true;

            string script =
                "hideConfirmPrintModal();" +
                "setTimeout(function(){" +
                "  document.body.offsetHeight;" +
                "  window.focus();" +
                "  window.print();" +
                "}, 600);";

            ClientScript.RegisterStartupScript(this.GetType(), "printNow", script, true);
        }

        private void LoadEmployeeForPrint(string empId)
        {
            Employee emp = DatabaseHelper.GetEmployeeById(empId);
            if (emp == null) return;

            lblEmpID.Text = string.IsNullOrEmpty(emp.EMP_ID) ? "N/A" : emp.EMP_ID;
            lblName.Text = string.IsNullOrEmpty(emp.ENAME) ? "N/A" : emp.ENAME.ToUpper();
            lblDesignation.Text = string.IsNullOrEmpty(emp.DGN_NM) ? "N/A" : emp.DGN_NM.ToUpper();
            lblDepartment.Text = string.IsNullOrEmpty(emp.DPT_NM) ? "N/A" : emp.DPT_NM.ToUpper();
            lblProject.Text = string.IsNullOrEmpty(emp.PRJ_NM) ? "N/A" : emp.PRJ_NM.ToUpper();

            string grade = emp.GRD_AB ?? "";
            string digits = System.Text.RegularExpressions.Regex.Replace(grade, @"[^\d]", "");
            int gradeNum = 0;
            int.TryParse(digits, out gradeNum);

            lblGradeBadge.Text = gradeNum > 5 ? "OFFICIAL" : "EMPLOYEE";

            string photoUrl = "http://172.16.10.54/EImages/EImages/" + empId + ".jpg";
            imgEmpPhoto.ImageUrl = photoUrl;
            imgEmpPhoto.Attributes["onerror"] = "this.src='images/default-user.jpg'";
            imgLogo.ImageUrl = "~/RFID_Marketing_Form/Images/logo.png";

            //lblCardID.Text = string.IsNullOrEmpty(emp.EMP_ID) ? "N/A" : emp.EMP_ID;
            lblJoiningDate.Text = emp.DT_JOIN.HasValue ? emp.DT_JOIN.Value.ToString("dd-MMM-yy") : "—";
            lblCNICBack.Text = string.IsNullOrEmpty(emp.CNIC) ? "—" : emp.CNIC;
            lblBloodGroup.Text = string.IsNullOrEmpty(emp.BLD_GRP) ? "—" : emp.BLD_GRP;
            lblEmergency.Text = string.IsNullOrEmpty(emp.PH_CELL2) ? "—" : emp.PH_CELL2;

            lblIssueDate.Text = DateTime.Now.ToString("dd-MMM-yy");
            lblExpiryDate.Text = "AS PER RENEWAL";
        }

        protected void btnSearch_Click(object sender, EventArgs e)
        {
            Response.Redirect("Requester.aspx");
        }

        protected void btnLogout_Click(object sender, EventArgs e)
        {
            Session.Clear();
            Session.Abandon();
            Response.Redirect("Login.aspx");
        }

        private string EscapeJs(string s)
        {
            if (string.IsNullOrEmpty(s)) return "";
            return s.Replace("\\", "\\\\").Replace("'", "\\'").Replace("\"", "\\\"")
                    .Replace("\r", " ").Replace("\n", " ");
        }

        private static string CellText(DataRow row, string column)
        {
            if (row == null || !row.Table.Columns.Contains(column) || row[column] == DBNull.Value)
            {
                return "";
            }

            return row[column].ToString().Trim();
        }

        private static string DisplayOrDash(string value)
        {
            return string.IsNullOrWhiteSpace(value) ? "—" : value.Trim();
        }

        private static string FormatDateObject(object value, string format)
        {
            if (value == null || value == DBNull.Value)
            {
                return "—";
            }

            DateTime dt;
            if (value is DateTime)
            {
                dt = (DateTime)value;
            }
            else if (!DateTime.TryParse(value.ToString(), out dt))
            {
                return DisplayOrDash(value.ToString());
            }

            return dt.ToString(format);
        }

        private string BuildModalSubtitle(DataRow row, Employee emp)
        {
            string empId = CellText(row, "EMP_ID");
            string name = emp != null && !string.IsNullOrWhiteSpace(emp.ENAME)
                ? emp.ENAME
                : CellText(row, "ENAME");
            if (!string.IsNullOrWhiteSpace(name))
            {
                return "Employee " + empId + " · " + name;
            }

            return "Employee " + empId;
        }

        private void BindRequestReadonlyFields(DataRow row, Employee emp)
        {
            string reqId = CellText(row, "ID");
            string empId = CellText(row, "EMP_ID");
            string name = emp != null && !string.IsNullOrWhiteSpace(emp.ENAME) ? emp.ENAME : CellText(row, "ENAME");
            string dgn = emp != null && !string.IsNullOrWhiteSpace(emp.DGN_NM) ? emp.DGN_NM : CellText(row, "DGN_NM");
            string dept = emp != null ? emp.DPT_NM : "";
            string project = emp != null ? emp.PRJ_NM : "";

            SetReadonlyPair(lblDetReqId, lblPcDetReqId, reqId);
            SetReadonlyPair(lblDetEmpId, lblPcDetEmpId, empId);
            SetReadonlyPair(lblDetName, lblPcDetName, name);
            SetReadonlyPair(lblDetDesignation, lblPcDetDesignation, dgn);
            SetReadonlyPair(lblDetDepartment, lblPcDetDepartment, dept);
            SetReadonlyPair(lblDetProject, lblPcDetProject, project);
            SetReadonlyPair(lblDetStatus, lblPcDetStatus, CellText(row, "STATUS"));
            SetReadonlyPair(lblDetRfid, lblPcDetRfid, CellText(row, "RFID_NUMBER"));
            SetReadonlyPair(lblDetForwardBy, lblPcDetForwardBy, CellText(row, "FORWARD_HOD_BY"));
            SetReadonlyPair(lblDetForwardOn, lblPcDetForwardOn, FormatDateObject(row.Table.Columns.Contains("FORWARD_ON") ? row["FORWARD_ON"] : null, "dd-MMM-yyyy"));
            SetReadonlyPair(lblDetPrintedOn, lblPcDetPrintedOn, FormatDateObject(row.Table.Columns.Contains("PRINT_DATE") ? row["PRINT_DATE"] : null, "dd-MMM-yyyy"));
            SetReadonlyPair(lblDetHodRemarks, lblPcDetHodRemarks, CellText(row, "HOD_REMARKS"));
            SetReadonlyPair(lblDetRequesterRemarks, lblPcDetRequesterRemarks, CellText(row, "REQUESTER_REMARKS"));

            lblDetJoining.Text = emp != null && emp.DT_JOIN.HasValue ? emp.DT_JOIN.Value.ToString("dd-MMM-yyyy") : "—";
            lblDetCnic.Text = emp != null ? DisplayOrDash(emp.CNIC) : "—";
            lblDetBlood.Text = emp != null ? DisplayOrDash(emp.BLD_GRP) : "—";
            lblDetEmergency.Text = emp != null ? DisplayOrDash(emp.PH_CELL2) : "—";
        }

        private static void SetReadonlyPair(Label left, Label right, string value)
        {
            string text = DisplayOrDash(value);
            left.Text = text;
            right.Text = text;
        }

        private void BindPrintCardPreview(DataRow row, Employee emp)
        {
            if (emp == null)
            {
                lblPcEmpId.Text = CellText(row, "EMP_ID");
                lblPcName.Text = DisplayOrDash(CellText(row, "ENAME"));
                lblPcDesignation.Text = DisplayOrDash(CellText(row, "DGN_NM"));
                lblPcDepartment.Text = "—";
                lblPcProject.Text = "—";
                lblPcGradeBadge.Text = "EMPLOYEE";
                imgPcPhoto.ImageUrl = "images/default-user.jpg";
                return;
            }

            lblPcEmpId.Text = DisplayOrDash(emp.EMP_ID);
            lblPcName.Text = string.IsNullOrEmpty(emp.ENAME) ? "—" : emp.ENAME.ToUpper();
            lblPcDesignation.Text = string.IsNullOrEmpty(emp.DGN_NM) ? "—" : emp.DGN_NM.ToUpper();
            lblPcDepartment.Text = string.IsNullOrEmpty(emp.DPT_NM) ? "—" : emp.DPT_NM.ToUpper();
            lblPcProject.Text = string.IsNullOrEmpty(emp.PRJ_NM) ? "—" : emp.PRJ_NM.ToUpper();
            lblPcGradeBadge.Text = ResolveGradeBadge(emp.GRD_AB);

            string empId = emp.EMP_ID ?? CellText(row, "EMP_ID");
            string photoUrl = "http://172.16.10.54/EImages/EImages/" + empId + ".jpg";
            imgPcPhoto.ImageUrl = photoUrl;
            imgPcPhoto.Attributes["onerror"] = "this.src='images/default-user.jpg'";
            imgPcLogo.ImageUrl = "~/RFID_Marketing_Form/Images/logo.png";
            imgPcSignature.ImageUrl = "~/images/signature.png";

            lblPcJoining.Text = emp.DT_JOIN.HasValue ? emp.DT_JOIN.Value.ToString("dd-MMM-yy") : "—";
            lblPcCnic.Text = DisplayOrDash(emp.CNIC);
            lblPcBlood.Text = DisplayOrDash(emp.BLD_GRP);
            lblPcEmergency.Text = DisplayOrDash(emp.PH_CELL2);

            DateTime issueDate = DateTime.Now;
            if (row.Table.Columns.Contains("PRINT_DATE") && row["PRINT_DATE"] != DBNull.Value)
            {
                DateTime parsed;
                if (DateTime.TryParse(row["PRINT_DATE"].ToString(), out parsed))
                {
                    issueDate = parsed;
                }
            }

            lblPcIssue.Text = issueDate.ToString("dd-MMM-yy");
            lblPcExpiry.Text = issueDate.AddYears(1).ToString("dd-MMM-yy");
        }

        private static string ResolveGradeBadge(string gradeAb)
        {
            string grade = gradeAb ?? "";
            string digits = System.Text.RegularExpressions.Regex.Replace(grade, @"[^\d]", "");
            int gradeNum = 0;
            int.TryParse(digits, out gradeNum);
            return gradeNum > 5 ? "OFFICIAL" : "EMPLOYEE";
        }
    }
}