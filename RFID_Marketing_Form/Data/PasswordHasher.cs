using System;
using System.Security.Cryptography;
using System.Text;

namespace RFID_Marketing_Form.Data
{
    public static class PasswordHasher
    {
        private const int SaltBytes = 16;
        private const int HashBytes = 32;
        private const int Iterations = 10000;

        public static string HashPassword(string password)
        {
            if (password == null)
            {
                throw new ArgumentNullException("password");
            }

            var salt = new byte[SaltBytes];
            using (var rng = new RNGCryptoServiceProvider())
            {
                rng.GetBytes(salt);
            }

            var hash = Pbkdf2(password, salt, Iterations, HashBytes);
            return "v1|" + Iterations + "|" + Convert.ToBase64String(salt) + "|" + Convert.ToBase64String(hash);
        }

        public static bool Verify(string password, string stored)
        {
            if (string.IsNullOrEmpty(password) || string.IsNullOrEmpty(stored))
            {
                return false;
            }

            var parts = stored.Split('|');
            if (parts.Length != 4 || parts[0] != "v1")
            {
                return false;
            }

            int iterations;
            if (!int.TryParse(parts[1], out iterations) || iterations < 1000)
            {
                return false;
            }

            byte[] salt;
            byte[] expected;
            try
            {
                salt = Convert.FromBase64String(parts[2]);
                expected = Convert.FromBase64String(parts[3]);
            }
            catch (FormatException)
            {
                return false;
            }

            var actual = Pbkdf2(password, salt, iterations, expected.Length);
            return FixedTimeEquals(actual, expected);
        }

        private static byte[] Pbkdf2(string password, byte[] salt, int iterations, int bytes)
        {
            using (var derive = new Rfc2898DeriveBytes(password, salt, iterations))
            {
                return derive.GetBytes(bytes);
            }
        }

        private static bool FixedTimeEquals(byte[] a, byte[] b)
        {
            if (a == null || b == null || a.Length != b.Length)
            {
                return false;
            }

            var diff = 0;
            for (var i = 0; i < a.Length; i++)
            {
                diff |= a[i] ^ b[i];
            }

            return diff == 0;
        }
    }
}
