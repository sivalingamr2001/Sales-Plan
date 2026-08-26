using Server.Models;

namespace Server.Interfaces;

public interface ISalesPlanServices
{
    Task<IEnumerable<dynamic>> GetSalesPlan(string? custName, long? ordId, string? itemNo, string? parentRegion, CancellationToken cancellationToken);
    Task<IEnumerable<dynamic>> GetConsolidatedDataDynamicAsync(CancellationToken cancellationToken);
    Task<IEnumerable<dynamic>> GetBreakdownDataDynamicAsync(string? orderedItem, CancellationToken cancellationToken);
    Task<int> InsertSalesPlanWeekLine(IEnumerable<SalesPlanWeekLineRequest> payloads, CancellationToken cancellationToken);
    Task<int> InsertBinSpDataAsync(IEnumerable<SalesPlanWeekLineRequest> payloads, CancellationToken cancellationToken);
    Task<int> UpdateHOTargetMonth(IEnumerable<UpdateHOTargetMonthRequest> payloads, CancellationToken cancellationToken);
    Task<(int ExceptionQty, int ExcessQty)> GetBreakupExceptionQty(BreakupExceptionQtyRequest request, CancellationToken cancellationToken);
    Task<IEnumerable<dynamic>> GetBreakdownDataDynamicFullAsync(CancellationToken cancellationToken);
    Task<IEnumerable<dynamic>> GetAllBinAsync(string region, CancellationToken cancellationToken);
    Task<int> CreateBinRecordAsync(CreateBinRecordDto dto, CancellationToken cancellationToken);
    Task<bool> UpdateBinDataAsync(UpdateBinDataDto dto, CancellationToken cancellationToken);
    Task<int> UpdateRepBinDataAsync(int binQty, string repId, string updatedBy, CancellationToken cancellationToken);
    Task<IEnumerable<dynamic>> GetAllBinWithRegionAsync(string region, CancellationToken cancellationToken);
    Task<IEnumerable<dynamic>> GetCustomerReplenishmentBinAsync(string regionStr, CancellationToken cancellationToken);
    Task<IEnumerable<dynamic>> GetPendingRepBinsAsync(CancellationToken cancellationToken);
    Task<int> ApproveBinRecordAsync(ApproveBinRecordDto dto, CancellationToken cancellationToken);
    Task<int> DeleteBinMasterDataAsync(DeleteBinMasterDataRequest request, CancellationToken cancellationToken);
    Task<List<InventoryItemDto>> GetInventoryItemDetailsAsync(string? search, CancellationToken cancellationToken = default);
    Task<OrganizationDto> GetOrgIdByInventoryIdAndOuIdAsync(int inventoryId, string region, CancellationToken cancellationToken = default);
    Task<IEnumerable<RegionDetailsDto>> GetAllRegionDetailsAsync(CancellationToken cancellationToken = default);
    Task<IEnumerable<dynamic>> GetExceptionDetailsByInventoryIdAsync(int inventoryId, CancellationToken cancellationToken);
    Task<IEnumerable<dynamic>> GetMonthlySalesQtyAsync(long customerId, long orgId, int inventoryId, CancellationToken cancellationToken);
    Task<IEnumerable<dynamic>> GetAllBinRsvHoPendList(CancellationToken cancellationToken);
}
