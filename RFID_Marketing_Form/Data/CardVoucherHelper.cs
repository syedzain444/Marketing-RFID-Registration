using System;
using System.Globalization;

namespace RFID_Marketing_Form.Data
{
    public static class CardVoucherHelper
    {
        public static decimal DefaultAmount(string scope)
        {
            var key = string.Equals(scope, "FAMILY", StringComparison.OrdinalIgnoreCase)
                ? "VoucherDefaultAmountFamily"
                : "VoucherDefaultAmountEmployee";
            var raw = System.Configuration.ConfigurationManager.AppSettings[key];
            decimal amount;
            if (decimal.TryParse(raw, NumberStyles.Number, CultureInfo.InvariantCulture, out amount) && amount > 0)
            {
                return amount;
            }

            return string.Equals(scope, "FAMILY", StringComparison.OrdinalIgnoreCase) ? 3000m : 5000m;
        }

        public static string DefaultCategory(string scope)
        {
            var key = string.Equals(scope, "FAMILY", StringComparison.OrdinalIgnoreCase)
                ? "VoucherCategoryFamily"
                : "VoucherCategoryEmployee";
            var val = System.Configuration.ConfigurationManager.AppSettings[key];
            if (!string.IsNullOrWhiteSpace(val))
            {
                return val.Trim();
            }

            return string.Equals(scope, "FAMILY", StringComparison.OrdinalIgnoreCase)
                ? "Family RFID card"
                : "Commercial RFID card";
        }

        public static string ResolveRefNo(RfidRecord employee, FamilyCardRecord family)
        {
            if (employee != null && !string.IsNullOrWhiteSpace(employee.ProjectLocation))
            {
                return employee.ProjectLocation.Trim();
            }

            if (employee != null && !string.IsNullOrWhiteSpace(employee.EmpId))
            {
                return employee.EmpId.Trim();
            }

            if (family != null && !string.IsNullOrWhiteSpace(family.EmpId))
            {
                return family.EmpId.Trim();
            }

            return "N/A";
        }

        public static string NumberToWords(int number)
        {
            if (number == 0)
            {
                return "Zero";
            }

            if (number < 0)
            {
                return "Minus " + NumberToWords(Math.Abs(number));
            }

            var words = string.Empty;
            if (number / 100000 > 0)
            {
                words += NumberToWords(number / 100000) + " Lakh ";
                number %= 100000;
            }

            if (number / 1000 > 0)
            {
                words += NumberToWords(number / 1000) + " Thousand ";
                number %= 1000;
            }

            if (number / 100 > 0)
            {
                words += NumberToWords(number / 100) + " Hundred ";
                number %= 100;
            }

            if (number > 0)
            {
                if (words != string.Empty)
                {
                    words += "and ";
                }

                var unitsMap = new[]
                {
                    "Zero", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten",
                    "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"
                };
                var tensMap = new[]
                {
                    "Zero", "Ten", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"
                };

                if (number < 20)
                {
                    words += unitsMap[number];
                }
                else
                {
                    words += tensMap[number / 10];
                    if (number % 10 > 0)
                    {
                        words += "-" + unitsMap[number % 10];
                    }
                }
            }

            return words.Trim();
        }
    }
}
