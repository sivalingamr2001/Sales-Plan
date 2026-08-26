using DynamicTransaction.Interfaces;
using Oracle.ManagedDataAccess.Client;
using System.Data;
using System.Data.Common;

namespace ServerInfrastructure.Data;

public sealed class OracleConnectionWrapper : IAsyncDbConnectionWrapper
{
    public IDbConnection Connection { get; }

    public OracleConnectionWrapper(IDbConnection connection)
    {
        Connection = connection ?? throw new ArgumentNullException(nameof(connection));
    }

    public void Dispose()
    {
        Connection?.Dispose();
    }

    public async ValueTask DisposeAsync()
    {
        if (Connection is DbConnection commonConn)
        {
            await commonConn.DisposeAsync().ConfigureAwait(false);
        }
        else
        {
            Connection?.Dispose();
        }
    }
}

public sealed class AppOracleDbConnectionFactory : IDbConnectionFactory
{
    private readonly string _connectionString;

    public AppOracleDbConnectionFactory(string connectionString)
    {
        if (string.IsNullOrWhiteSpace(connectionString))
            throw new ArgumentException("Connection string cannot be empty", nameof(connectionString));

        _connectionString = connectionString;
    }

    public IAsyncDbConnectionWrapper CreateConnection(string? connectionStringOverride = null)
    {
        string finalConnectionString = !string.IsNullOrWhiteSpace(connectionStringOverride)
            ? connectionStringOverride
            : _connectionString;

        var oracleConn = new OracleConnection(finalConnectionString);
        return new OracleConnectionWrapper(oracleConn);
    }
}
