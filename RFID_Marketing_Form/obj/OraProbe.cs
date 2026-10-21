using System;
using Oracle.ManagedDataAccess.Client;
class P {
  static void Main() {
    var cs = "User Id=SPERS;Password=sma;Data Source=(DESCRIPTION=(ADDRESS=(PROTOCOL=TCP)(HOST=172.16.10.60)(PORT=1521))(CONNECT_DATA=(SID=orcl)));Connection Timeout=15;";
    using (var conn = new OracleConnection(cs)) {
      conn.Open();
      var sql = @"SELECT table_name, column_name FROM all_tab_columns WHERE owner='SPERS' AND (
        column_name LIKE '%EMP%NAME%' OR column_name IN ('EMP_NAME','FULL_NAME','NAME','CARD_NAME','EMPLOYEE_NAME')
      ) AND table_name NOT LIKE 'BIN$%' ORDER BY table_name, column_id";
      using (var cmd = conn.CreateCommand()) {
        cmd.CommandText = sql;
        using (var r = cmd.ExecuteReader()) {
          while (r.Read()) Console.WriteLine(r.GetString(0) + "." + r.GetString(1));
        }
      }
    }
  }
}
