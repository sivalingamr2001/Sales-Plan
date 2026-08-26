using DynamicTransaction.Interfaces;
using Server.Infrastructure.Queries;
using Server.Interfaces;
using Server.Models;

namespace Server.Services;

public class AuthServices(IDynamicQueryExecutor queryExecutor, ILogger<AuthServices> logger) : IAuthServices
{
    private readonly IDynamicQueryExecutor _queryExecutor = queryExecutor;
    private readonly ILogger<AuthServices> _logger = logger;

    public async Task<RegionDetailsDto?> GetRegionDetailsAfterLoginAsync(string username, string password, CancellationToken cancellationToken = default)
    {
        _logger.LogInformation("Attempting to retrieve login region details for User: {Username}", username);

        try
        {
            var result = await _queryExecutor.QuerySingleOrDefaultAsync<RegionDetailsDto>(
                AuthQueries.GetRegionDetailsAfterLogin,
                new { Uname = username, Password = password },
                cancellationToken: cancellationToken);

            if (result == null)
            {
                _logger.LogWarning("No region details found for User: {Username}", username);
            }
            else
            {
                _logger.LogDebug("Successfully retrieved region details for User: {Username}. Region: {RegionName}", username, result.Region);
            }

            return result;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Database operation failed while fetching login region details for User: {Username}", username);
            throw;
        }
    }

    public async Task<IEnumerable<RegionDetailsDto>> GetAllRegionDetailsAsync(CancellationToken cancellationToken = default)
    {
        _logger.LogInformation("Fetching all available region details.");

        try
        {
            var regions = await _queryExecutor.QueryAsync<RegionDetailsDto>(
                AuthQueries.GetAllRegionDetails,
                cancellationToken: cancellationToken);

            _logger.LogDebug("Successfully retrieved region details records.");
            return regions;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Database operation failed while fetching all region details.");
            throw;
        }
    }

    public async Task<IEnumerable<dynamic>> GetCustomerNameByRegionAsync(string region, string searchTerm, CancellationToken cancellationToken = default)
    {
        _logger.LogInformation("Searching customer names. Region Filter: {Region}, Search Term: {SearchTerm}", region, searchTerm);

        var formattedSearch = $"%{searchTerm}%";

        try
        {
            if (string.Equals(region, "HO", StringComparison.OrdinalIgnoreCase))
            {
                return await _queryExecutor.QueryAsync<dynamic>(
                    AuthQueries.GetCustomersNoFilterBySearch,
                    new { searchTerm = formattedSearch },
                    cancellationToken: cancellationToken);
            }

            string[] regionArray = string.IsNullOrWhiteSpace(region)
                ? Array.Empty<string>()
                : region.Split(',').Select(r => r.Trim()).ToArray();

            return await _queryExecutor.QueryAsync<dynamic>(
                AuthQueries.GetCustomerNameByRegionAndSearch,
                new { region = regionArray, searchTerm = formattedSearch },
                cancellationToken: cancellationToken);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Database operation failed searching customers for Region: {Region} with Search Term: {SearchTerm}", region, searchTerm);
            throw;
        }
    }
}
