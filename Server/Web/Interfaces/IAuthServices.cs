using Server.Models;

namespace Server.Interfaces;

public interface IAuthServices
{
    /// <summary>
    /// Retrieves the assigned Region and SubRegion for a specific user after successful authentication.
    /// </summary>
    Task<RegionDetailsDto?> GetRegionDetailsAfterLoginAsync(string username, string password, CancellationToken cancellationToken = default);

    /// <summary>
    /// Retrieves a unique list of all available Regions and SubRegions within the system.
    /// </summary>
    Task<IEnumerable<RegionDetailsDto>> GetAllRegionDetailsAsync(CancellationToken cancellationToken = default);

    Task<IEnumerable<dynamic>> GetCustomerNameByRegionAsync(
       string region,
       string searchTerm,
       CancellationToken cancellationToken = default);
}
