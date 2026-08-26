using Server.Models;

namespace Server.Interfaces;

public interface ISalesPlanServices
{
    Task<int> InsertSalesPlanWeekLine(IEnumerable<SalesPlanWeekLineRequest> payloads, CancellationToken cancellationToken);
    Task<int> InsertBinSpDataAsync(IEnumerable<SalesPlanWeekLineRequest> payloads, CancellationToken cancellationToken);
    Task<int> UpdateHOTargetMonth(IEnumerable<UpdateHOTargetMonthRequest> payloads, CancellationToken cancellationToken);
    Task<(int ExceptionQty, int ExcessQty)> GetBreakupExceptionQty(BreakupExceptionQtyRequest request, CancellationToken cancellationToken);
    Task<int> CreateBinRecordAsync(CreateBinRecordDto dto, CancellationToken cancellationToken);
    Task<bool> UpdateBinDataAsync(UpdateBinDataDto dto, CancellationToken cancellationToken);
    Task<int> UpdateRepBinDataAsync(int binQty, string repId, string updatedBy, CancellationToken cancellationToken);
    Task<int> ApproveBinRecordAsync(ApproveBinRecordDto dto, CancellationToken cancellationToken);
    Task<int> DeleteBinMasterDataAsync(DeleteBinMasterDataRequest request, CancellationToken cancellationToken);
    Task<dynamic> ExecuteDynamicQueryAsync(DynamicTransaction.Models.FetchConfig config, CancellationToken cancellationToken);
}
