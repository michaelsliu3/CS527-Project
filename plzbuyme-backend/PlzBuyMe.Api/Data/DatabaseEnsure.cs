using System.Net.Sockets;
using System.Net;
using MySqlConnector;

namespace PlzBuyMe.Api.Data;

/// <summary>
/// Ensures the MySQL database exists before running migrations (MySQL does not auto-create the database on connect).
/// </summary>
public static class DatabaseEnsure
{
    public static void EnsureDatabaseExists(string connectionString)
    {
        if (string.IsNullOrWhiteSpace(connectionString))
            return;

        var builder = new MySqlConnectionStringBuilder(connectionString);
        var database = builder.Database;
        if (string.IsNullOrWhiteSpace(database))
            return;

        // Skip connection attempt if MySQL server is not reachable (avoids driver logging "database ''" error).
        if (!IsServerReachable(builder.Server, (uint)(builder.Port > 0 ? builder.Port : 3306)))
            return;

        builder.Database = "";
        try
        {
            using var connection = new MySqlConnection(builder.ConnectionString);
            connection.Open();
            using var cmd = connection.CreateCommand();
            cmd.CommandText = $"CREATE DATABASE IF NOT EXISTS `{database.Replace("`", "``")}`";
            cmd.ExecuteNonQuery();
        }
        catch (MySqlException)
        {
            // MySQL unreachable after TCP check; Migrate/Seed will be skipped by caller
        }
    }

    private static bool IsServerReachable(string server, uint port)
    {
        try
        {
            var host = server == "localhost" || server == "127.0.0.1"
                ? IPAddress.Loopback
                : Dns.GetHostAddresses(server)[0];
            using var client = new TcpClient();
            return client.ConnectAsync(host, (int)port).Wait(TimeSpan.FromSeconds(1));
        }
        catch
        {
            return false;
        }
    }
}
