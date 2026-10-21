using System;
using System.Collections.Generic;
using System.Globalization;
using System.Web;
using System.Web.Script.Serialization;
using System.Web.UI;
using System.Web.UI.WebControls;
using RFID_Marketing_Form.Data;

namespace RFID_Marketing_Form
{
    public partial class _Default : Page
    {
        private readonly RfidRepository repository = new RfidRepository();

        protected void Page_Load(object sender, EventArgs e)
        {
            if (form1 != null)
            {
                form1.Enctype = "multipart/form-data";
            }

            if (!IsPostBack)
            {
                ApplyDefaultDates();
            }
        }

        protected void btnSave_Click(object sender, EventArgs e)
        {
            try
            {
                var captchaKey = GetFormValue("captchaKey");
                var captchaAnswer = GetFormValue("captchaAnswer");
                if (!Captcha.TryValidate(Context, captchaKey, captchaAnswer))
                {
                    EmitSweetAlert(new SaveResult
                    {
                        Success = false,
                        Kind = "validation",
                        Title = "Captcha required",
                        Messages = new List<string> { "Enter the correct answer in the captcha dialog to save." },
                        Fields = new List<string>()
                    }, false);
                    return;
                }

                var input = ReadInputForSave();
                string uploadedPhotoPath;
                if (PhotoStorage.TrySavePostedPhoto(Context, out uploadedPhotoPath))
                {
                    input.PhotoPathText = uploadedPhotoPath;
                    input.PhotoPath = uploadedPhotoPath;
                    SetTextBoxText("txtPhotoPath", uploadedPhotoPath);
                }

                if (string.IsNullOrWhiteSpace(input.EmpId) || string.IsNullOrWhiteSpace(input.RfidNumber))
                {
                    EmitSweetAlert(new SaveResult
                    {
                        Success = false,
                        Kind = "validation",
                        Title = "Some fields need attention",
                        Messages = new List<string> { "Employee ID and RFID number were not received on save. Refresh the page and try again." },
                        Fields = new List<string> { "emp", "rfid" }
                    }, false);
                    return;
                }

                var result = repository.Save(input);
                if (result.Success)
                {
                    ResetFormFields();
                }

                EmitSweetAlert(result, result.Success);
            }
            catch (Exception ex)
            {
                EmitSweetAlert(new SaveResult
                {
                    Success = false,
                    Kind = "error",
                    Title = "Unable to save",
                    Messages = new List<string> { SafeUserMessage(ex) },
                    Fields = new List<string>()
                }, false);
            }
        }

        private static string SafeUserMessage(Exception ex)
        {
            if (ex == null)
            {
                return "An unexpected error occurred while saving.";
            }

            if (ex is NullReferenceException)
            {
                return "The form could not be read. Refresh the page and try again.";
            }

            return "An unexpected error occurred while saving.";
        }

        private void ApplyDefaultDates()
        {
            var today = DateTime.Today;
            var iso = today.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);
            SetTextBoxText("txtIssueDate", iso);
            SetTextBoxText("txtCreatedDate", iso);
            SetTextBoxText("txtExpiryDate", today.AddYears(1).ToString("yyyy-MM-dd", CultureInfo.InvariantCulture));
        }

        private void ResetFormFields()
        {
            SetTextBoxText("txtEmpId", string.Empty);
            SetTextBoxText("txtRfid", string.Empty);
            SetTextBoxText("txtPhotoPath", string.Empty);
            SetTextBoxText("txtCardName", string.Empty);
            SetTextBoxText("txtDesignation", string.Empty);
            SetTextBoxText("txtDepartment", string.Empty);
            SetTextBoxText("txtProject", string.Empty);
            SetTextBoxText("txtJoiningDate", string.Empty);
            SetTextBoxText("txtBloodGroup", string.Empty);
            SetTextBoxText("txtCnic", string.Empty);
            SetTextBoxText("txtEmergencyNo", string.Empty);
            SetTextBoxText("txtGrade", string.Empty);
            SetTextBoxText("txtPrintDate", string.Empty);
            SetTextBoxText("txtIssuedBy", string.Empty);
            SetTextBoxText("txtForwardBy", string.Empty);
            SetTextBoxText("txtForwardOn", string.Empty);
            SetTextBoxText("txtHodRemarks", string.Empty);
            SetTextBoxText("txtApprovedDate", string.Empty);
            SetTextBoxText("txtApproveId", string.Empty);
            SetTextBoxText("txtRequesterRemarks", string.Empty);

            ApplyDefaultDates();
            SetRadioListValue("rblStatus", "Active");
            SetRadioListValue("rblForward", "N");
            SetRadioListValue("rblApproved", string.Empty);
        }

        private RfidInput ReadInputForSave()
        {
            return new RfidInput
            {
                EmpId = ReadPostedField("txtEmpId"),
                RfidNumber = ReadPostedField("txtRfid"),
                Status = ReadPostedField("rblStatus"),
                IssueDateText = ReadPostedField("txtIssueDate"),
                ExpiryDateText = ReadPostedField("txtExpiryDate"),
                IssuedBy = ReadPostedField("txtIssuedBy"),
                PrintDateText = ReadPostedField("txtPrintDate"),
                CreatedDateText = ReadPostedField("txtCreatedDate"),
                IsApproved = ReadPostedField("rblApproved"),
                ApprovedDateText = ReadPostedField("txtApprovedDate"),
                ApproveIdText = ReadPostedField("txtApproveId"),
                HodRemarks = ReadPostedField("txtHodRemarks"),
                IsForwardHod = ReadPostedField("rblForward"),
                ForwardBy = ReadPostedField("txtForwardBy"),
                ForwardOnText = ReadPostedField("txtForwardOn"),
                RequesterRemarks = ReadPostedField("txtRequesterRemarks"),
                CardName = ReadPostedField("txtCardName"),
                Designation = ReadPostedField("txtDesignation"),
                Department = ReadPostedField("txtDepartment"),
                ProjectLocation = ReadPostedField("txtProject"),
                JoiningDateText = ReadPostedField("txtJoiningDate"),
                BloodGroup = ReadPostedField("txtBloodGroup"),
                Cnic = ReadPostedField("txtCnic"),
                EmergencyNo = ReadPostedField("txtEmergencyNo"),
                PhotoPathText = ReadPostedField("txtPhotoPath")
            };
        }

        private string ReadPostedField(string id)
        {
            var box = FindControlById(id) as TextBox;
            if (box != null)
            {
                var text = box.Text;
                if (!string.IsNullOrWhiteSpace(text))
                {
                    return text.Trim();
                }
            }

            var list = FindControlById(id) as RadioButtonList;
            if (list != null)
            {
                var selected = list.SelectedValue;
                if (!string.IsNullOrEmpty(selected))
                {
                    return selected;
                }
            }

            return GetFormValue(id);
        }

        private string GetFormValue(string staticId)
        {
            var request = HttpContext.Current == null ? Request : HttpContext.Current.Request;
            if (request == null || request.Form == null || string.IsNullOrEmpty(staticId))
            {
                return string.Empty;
            }

            var direct = request.Form[staticId];
            if (!string.IsNullOrEmpty(direct))
            {
                return direct;
            }

            var keys = request.Form.AllKeys;
            if (keys == null)
            {
                return string.Empty;
            }

            for (var i = 0; i < keys.Length; i++)
            {
                var key = keys[i];
                if (string.IsNullOrEmpty(key))
                {
                    continue;
                }

                if (key.Equals(staticId, StringComparison.Ordinal)
                    || key.StartsWith(staticId + "$", StringComparison.Ordinal)
                    || key.StartsWith(staticId + ":", StringComparison.Ordinal))
                {
                    var value = request.Form[key];
                    if (!string.IsNullOrEmpty(value))
                    {
                        return value;
                    }
                }
            }

            return string.Empty;
        }

        private void SetTextBoxText(string id, string text)
        {
            var box = FindControlById(id) as TextBox;
            if (box != null)
            {
                box.Text = text ?? string.Empty;
            }
        }

        private void SetRadioListValue(string id, string value)
        {
            var list = FindControlById(id) as RadioButtonList;
            if (list == null || list.Items == null)
            {
                return;
            }

            var item = list.Items.FindByValue(value ?? string.Empty);
            if (item == null)
            {
                return;
            }

            list.ClearSelection();
            item.Selected = true;
        }

        private Control FindControlById(string id)
        {
            if (string.IsNullOrEmpty(id))
            {
                return null;
            }

            var pending = new Stack<Control>();
            pending.Push(this);

            while (pending.Count > 0)
            {
                var current = pending.Pop();
                if (current == null)
                {
                    continue;
                }

                if (string.Equals(current.ID, id, StringComparison.Ordinal))
                {
                    return current;
                }

                var children = current.Controls;
                if (children == null)
                {
                    continue;
                }

                for (var i = children.Count - 1; i >= 0; i--)
                {
                    pending.Push(children[i]);
                }
            }

            return null;
        }

        private void EmitSweetAlert(SaveResult result, bool resetAfter)
        {
            if (result == null)
            {
                result = new SaveResult
                {
                    Success = false,
                    Kind = "error",
                    Title = "Unable to save",
                    Messages = new List<string> { "No save result was returned." },
                    Fields = new List<string>()
                };
            }

            var kind = string.IsNullOrEmpty(result.Kind) ? "error" : result.Kind;
            var title = result.Title;
            var fields = result.Fields ?? new List<string>();
            var visible = new List<string>();
            if (result.Messages != null)
            {
                for (int i = 0; i < result.Messages.Count; i++)
                {
                    if (!IsDatabaseNotice(result.Messages[i]))
                    {
                        visible.Add(result.Messages[i]);
                    }
                }
            }

            if (IsDuplicateNotice(title))
            {
                title = "Some fields need attention";
            }

            if (IsDatabaseNotice(title))
            {
                title = "Unable to save";
                visible.Clear();
                visible.Add("Something went wrong while saving. Please try again or contact your administrator.");
            }

            if (visible.Count == 0)
            {
                if (result.Success)
                {
                    visible.Add("Your record was saved successfully.");
                }
                else if (kind == "validation")
                {
                    visible.Add("Please correct the highlighted fields and try again.");
                }
                else
                {
                    visible.Add("The record could not be saved. Please review the form and try again.");
                }
            }

            if (string.IsNullOrEmpty(title))
            {
                title = result.Success ? "Saved" : kind == "validation" ? "Some fields need attention" : "Unable to save";
            }

            var payload = new Dictionary<string, object>();
            payload["success"] = result.Success;
            payload["kind"] = kind;
            payload["title"] = title;
            payload["messages"] = visible;
            payload["fields"] = fields;
            payload["newId"] = result.NewId;
            payload["table"] = result.TableName;
            payload["reset"] = resetAfter && result.Success;

            var json = new JavaScriptSerializer().Serialize(payload);
            var script =
                "window.__rfidSavePayload=" + json + ";" +
                "if(window.RfidForm&&RfidForm.handleSaveResult){" +
                "RfidForm.handleSaveResult(window.__rfidSavePayload);window.__rfidSavePayload=null;" +
                "}";
            ClientScript.RegisterStartupScript(GetType(), "rfidSweet_" + Guid.NewGuid().ToString("N"), script, true);
        }

        private static bool IsDuplicateNotice(string message)
        {
            if (string.IsNullOrEmpty(message))
            {
                return false;
            }

            var text = message.ToLowerInvariant();
            return text.Contains("duplicate")
                || text.Contains("already has an open rfid")
                || text.Contains("already on file")
                || text.Contains("cannot be saved again");
        }

        private static bool IsDatabaseNotice(string message)
        {
            if (string.IsNullOrEmpty(message))
            {
                return false;
            }

            var text = message.ToLowerInvariant();
            return text.Contains("oracle")
                || text.Contains("password")
                || text.Contains("web.config")
                || text.Contains("spers")
                || text.Contains("sid orcl")
                || text.Contains("ora-")
                || text.Contains("database");
        }
    }
}
