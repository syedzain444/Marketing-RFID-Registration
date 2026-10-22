using System;
using System.Collections.Generic;
using System.Globalization;
using System.Web;
using System.Web.Script.Serialization;
using RFID_Marketing_Form;

namespace RFID_Marketing_Form.Data
{
    public static class RfidFormSaveService
    {
        public static SaveResult SaveFromRequest(HttpContext context)
        {
            if (context == null)
            {
                return new SaveResult
                {
                    Success = false,
                    Kind = "error",
                    Title = "Unable to save",
                    Messages = new List<string> { "Request context is missing." },
                    Fields = new List<string>()
                };
            }

            var captchaKey = GetFormValue(context, "captchaKey");
            var captchaAnswer = GetFormValue(context, "captchaAnswer");
            if (!Captcha.TryValidate(context, captchaKey, captchaAnswer))
            {
                return new SaveResult
                {
                    Success = false,
                    Kind = "validation",
                    Title = "Captcha required",
                    Messages = new List<string> { "Enter the correct answer in the captcha dialog to save." },
                    Fields = new List<string>()
                };
            }

            var isFamily = IsTruthy(GetFormValue(context, "isFamilyCard"));
            var familyOnly = IsTruthy(GetFormValue(context, "familyOnlyMode"));
            string uploadedEmployeePhoto;
            string uploadedFamilyPhoto;
            PhotoStorage.TrySavePostedPhoto(context, "employeePhoto", out uploadedEmployeePhoto);
            PhotoStorage.TrySavePostedPhoto(context, "familyPhoto", out uploadedFamilyPhoto);

            var repo = new RfidRepository();
            if (isFamily)
            {
                var family = ReadFamilyInputFromRequest(context);
                var empInput = ReadInputFromRequest(context);
                ApplyPhotoPath(
                    family,
                    uploadedFamilyPhoto,
                    GetFormValue(context, "txtFamilyPhotoPath"));
                if (!familyOnly)
                {
                    ApplyPhotoPath(
                        empInput,
                        uploadedEmployeePhoto,
                        GetFormValue(context, "txtPhotoPath"));
                }

                var empExists = repo.EmployeeRecordExists(family.EmpId);
                if (familyOnly)
                {
                    if (!empExists)
                    {
                        return SaveResult.FromIssues(
                            "validation",
                            "Some fields need attention",
                            new List<FieldIssue>
                            {
                                new FieldIssue
                                {
                                    Key = "emp",
                                    Message = "No RFID assignment exists for this Employee ID. Create the employee record first, or use New request with Family card to save both together."
                                }
                            });
                    }

                    return repo.SaveFamilyCard(family);
                }

                if (!empExists)
                {
                    var empResult = repo.Save(empInput);
                    if (!empResult.Success)
                    {
                        return empResult;
                    }

                    var familyResult = repo.SaveFamilyCard(family);
                    if (familyResult.Success && empResult.Messages != null && empResult.Messages.Count > 0)
                    {
                        if (familyResult.Messages == null)
                        {
                            familyResult.Messages = new List<string>();
                        }

                        familyResult.Messages.Insert(0, empResult.Messages[0]);
                        familyResult.Title = "Employee and family card saved";
                    }

                    return familyResult;
                }

                return repo.SaveFamilyCard(family);
            }

            var input = ReadInputFromRequest(context);
            ApplyPhotoPath(input, uploadedEmployeePhoto, GetFormValue(context, "txtPhotoPath"));

            if (string.IsNullOrWhiteSpace(input.EmpId))
            {
                return new SaveResult
                {
                    Success = false,
                    Kind = "validation",
                    Title = "Some fields need attention",
                    Messages = new List<string> { "Employee ID is required." },
                    Fields = new List<string> { "emp" }
                };
            }

            return repo.Save(input);
        }

        private static bool IsTruthy(string value)
        {
            value = (value ?? string.Empty).Trim();
            return value.Equals("Y", StringComparison.OrdinalIgnoreCase)
                || value.Equals("true", StringComparison.OrdinalIgnoreCase)
                || value.Equals("1", StringComparison.OrdinalIgnoreCase)
                || value.Equals("on", StringComparison.OrdinalIgnoreCase);
        }

        private static FamilyCardInput ReadFamilyInputFromRequest(HttpContext context)
        {
            return new FamilyCardInput
            {
                EmpId = GetFormValue(context, "txtEmpId"),
                CardName = GetFormValue(context, "txtFamilyCardName"),
                Relationship = GetFormValue(context, "txtFamilyRelationship"),
                Cnic = GetFormValue(context, "txtFamilyCnic"),
                RfidNumber = GetFormValue(context, "txtFamilyRfidNumber"),
                Status = GetFormValue(context, "rblStatus"),
                IssueDateText = GetFormValue(context, "txtIssueDate"),
                ExpiryDateText = GetFormValue(context, "txtExpiryDate"),
                IssuedBy = GetFormValue(context, "txtIssuedBy"),
                PrintDateText = GetFormValue(context, "txtPrintDate"),
                IsApproved = GetFormValue(context, "rblApproved"),
                ApprovedDateText = GetFormValue(context, "txtApprovedDate"),
                ApproveIdText = GetFormValue(context, "txtApproveId"),
                HodRemarks = GetFormValue(context, "txtHodRemarks"),
                IsForwardHod = GetFormValue(context, "rblForward"),
                ForwardBy = GetFormValue(context, "txtForwardBy"),
                ForwardOnText = GetFormValue(context, "txtForwardOn"),
                RequesterRemarks = GetFormValue(context, "txtRequesterRemarks"),
                PhotoPath = GetFormValue(context, "txtFamilyPhotoPath")
            };
        }

        private static void ApplyPhotoPath(RfidInput input, string uploadedPath, string formPath)
        {
            if (input == null)
            {
                return;
            }

            var path = !string.IsNullOrWhiteSpace(uploadedPath) ? uploadedPath : formPath;
            input.PhotoPathText = path ?? string.Empty;
            input.PhotoPath = path ?? string.Empty;
        }

        private static void ApplyPhotoPath(FamilyCardInput input, string uploadedPath, string formPath)
        {
            if (input == null)
            {
                return;
            }

            input.PhotoPath = !string.IsNullOrWhiteSpace(uploadedPath) ? uploadedPath : (formPath ?? string.Empty);
        }

        public static Dictionary<string, object> BuildClientPayload(SaveResult result, bool resetAfterSuccess)
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

            return new Dictionary<string, object>
            {
                { "success", result.Success },
                { "kind", kind },
                { "title", title },
                { "messages", visible },
                { "fields", fields },
                { "newId", result.NewId },
                { "table", result.TableName },
                { "reset", resetAfterSuccess && result.Success }
            };
        }

        public static string SerializeClientPayload(SaveResult result, bool resetAfterSuccess)
        {
            return new JavaScriptSerializer().Serialize(BuildClientPayload(result, resetAfterSuccess));
        }

        private static RfidInput ReadInputFromRequest(HttpContext context)
        {
            return new RfidInput
            {
                EmpId = GetFormValue(context, "txtEmpId"),
                RfidNumber = string.Empty,
                Status = GetFormValue(context, "rblStatus"),
                IssueDateText = GetFormValue(context, "txtIssueDate"),
                ExpiryDateText = GetFormValue(context, "txtExpiryDate"),
                IsApproved = GetFormValue(context, "rblApproved"),
                ApprovedDateText = GetFormValue(context, "txtApprovedDate"),
                ApproveIdText = GetFormValue(context, "txtApproveId"),
                HodRemarks = GetFormValue(context, "txtHodRemarks"),
                IsForwardHod = GetFormValue(context, "rblForward"),
                ForwardBy = GetFormValue(context, "txtForwardBy"),
                ForwardOnText = GetFormValue(context, "txtForwardOn"),
                RequesterRemarks = GetFormValue(context, "txtRequesterRemarks"),
                CardName = GetFormValue(context, "txtCardName"),
                Designation = GetFormValue(context, "txtDesignation"),
                Department = GetFormValue(context, "txtDepartment"),
                ProjectLocation = GetFormValue(context, "txtProject"),
                JoiningDateText = GetFormValue(context, "txtJoiningDate"),
                BloodGroup = GetFormValue(context, "txtBloodGroup"),
                Cnic = GetFormValue(context, "txtCnic"),
                EmergencyNo = GetFormValue(context, "txtEmergencyNo"),
                PhotoPathText = GetFormValue(context, "txtPhotoPath")
            };
        }

        private static string GetFormValue(HttpContext context, string staticId)
        {
            var request = context.Request;
            if (request == null || request.Form == null || string.IsNullOrEmpty(staticId))
            {
                return string.Empty;
            }

            var direct = request.Form[staticId];
            if (!string.IsNullOrEmpty(direct))
            {
                return direct.Trim();
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
                        return value.Trim();
                    }
                }
            }

            return string.Empty;
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
