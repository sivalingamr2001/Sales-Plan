using System;
using System.Collections.Generic;
using System.Data;
using System.Linq;
using System.Text.RegularExpressions;
using System.Threading;
using System.Threading.Tasks;
using Newtonsoft.Json.Linq;
using Serilog;
using DynamicTransaction.Interfaces;
using DynamicTransaction.Models;
using DynamicTransaction.Services;
using Server.Interfaces;
using Server.Models;
using Server.Infrastructure.Queries;

namespace Server.Services;

public class SalesPlanService : ISalesPlanServices
{
    private readonly IDynamicQueryExecutor _queryExecutor;
    private readonly IDbConnectionFactory _connectionFactory;
    private readonly Serilog.ILogger _logger;
    private readonly string _hostName;

    public SalesPlanService(
        IDynamicQueryExecutor queryExecutor,
        IDbConnectionFactory connectionFactory,
        Serilog.ILogger logger)
    {
        _queryExecutor = queryExecutor ?? throw new ArgumentNullException(nameof(queryExecutor));
        _connectionFactory = connectionFactory ?? throw new ArgumentNullException(nameof(connectionFactory));
        _logger = logger ?? throw new ArgumentNullException(nameof(logger));
        _hostName = System.Net.Dns.GetHostName();
    }

    public async Task<dynamic> ExecuteDynamicQueryAsync(FetchConfig config, CancellationToken cancellationToken)
    {
        string queryText;
        if (config.QueryNumber == 28)
        {
            queryText = @"
                SELECT 
                    TO_CHAR(trx_date, 'MON-YY') AS Month,
                    SUM(quantity_invoiced) AS Sales
                FROM 
                    jan_all_ou_sales_t2
                WHERE 
                    bill_to_customer_id = :CustomerId
                    AND organization_id = :OrgId
                    AND inventory_item_id = :InventoryId
                    AND trx_date BETWEEN add_months(trunc(SYSDATE, 'MM'), -6) AND trunc(SYSDATE, 'MM') - 1
                    AND ord_empt_status = 'N'
                    AND stk_tfr_flg = 'N'
                GROUP BY 
                    TO_CHAR(trx_date, 'MON-YY'),
                    trunc(trx_date, 'MM')
                ORDER BY 
                    trunc(trx_date, 'MM') ASC";
        }
        else
        {
            queryText = SalesPlanQueries.GetQueryText(config.QueryNumber);
        }
        
        _logger.Information("Executing Dynamic Query {QueryNumber} on Host {HostName} with FetchConfig: {@FetchConfig}", 
            config.QueryNumber, _hostName, config);

        try
        {
            await using var wrapper = _connectionFactory.CreateConnection();
            var connection = wrapper.Connection;
            
            if (connection.State == ConnectionState.Closed)
            {
                if (connection is System.Data.Common.DbConnection dbConn)
                    await dbConn.OpenAsync(cancellationToken).ConfigureAwait(false);
                else
                    connection.Open();
            }

            string baseSelect = queryText;

            if (config.QueryNumber == 16)
            {
                bool useSubRegion = false;
                if (config.InputParameters.TryGetValue("UseSubRegion", out var useSubRegToken))
                {
                    useSubRegion = useSubRegToken.Value<bool>();
                }

                string filterClause = useSubRegion 
                    ? "AND a.region = :Region" 
                    : "AND a.parent_region = :Region";

                baseSelect = string.Format(baseSelect, filterClause);
            }

            if (config.QueryNumber == 17)
            {
                baseSelect = baseSelect.Replace("A.REGION IN :Regions", "instr(:Regions, ',' || A.REGION || ',') > 0");
                
                if (config.InputParameters.TryGetValue("Regions", out var regionsToken))
                {
                    if (regionsToken.Type == JTokenType.Array)
                    {
                        var regionsArray = regionsToken.ToObject<string[]>() ?? Array.Empty<string>();
                        config.InputParameters["Regions"] = "," + string.Join(",", regionsArray) + ",";
                    }
                    else
                    {
                        config.InputParameters["Regions"] = "," + regionsToken.ToString() + ",";
                    }
                }
            }

            // Apply Server-side filtering
            if (config.EnableServerSideFiltering && config.FilterConditions != null && config.FilterConditions.Count > 0)
            {
                baseSelect = $"SELECT * FROM ({baseSelect}) filter_base WHERE 1=1";
                for (int i = 0; i < config.FilterConditions.Count; i++)
                {
                    var filter = config.FilterConditions[i];
                    if (string.IsNullOrWhiteSpace(filter.Field) || !Regex.IsMatch(filter.Field, @"^[a-zA-Z0-9_\.]+$"))
                        continue;

                    string paramName = $"FilterVal_{i}";
                    string op = filter.Operator.ToLowerInvariant();
                    string filterClause = op switch
                    {
                        "eq" => $"AND {filter.Field} = :{paramName}",
                        "neq" => $"AND {filter.Field} != :{paramName}",
                        "gt" => $"AND {filter.Field} > :{paramName}",
                        "lt" => $"AND {filter.Field} < :{paramName}",
                        "gte" => $"AND {filter.Field} >= :{paramName}",
                        "lte" => $"AND {filter.Field} <= :{paramName}",
                        "contains" => $"AND {filter.Field} LIKE '%' || :{paramName} || '%'",
                        "startswith" => $"AND {filter.Field} LIKE :{paramName} || '%'",
                        "endswith" => $"AND {filter.Field} LIKE '%' || :{paramName}",
                        _ => $"AND {filter.Field} = :{paramName}"
                    };

                    baseSelect += $" {filterClause}";
                    config.InputParameters[paramName] = filter.Value != null ? JToken.FromObject(filter.Value) : JValue.CreateNull();
                }
            }

            // Apply Server-side sorting
            if (config.EnableServerSideSorting && !string.IsNullOrWhiteSpace(config.SortField))
            {
                if (Regex.IsMatch(config.SortField, @"^[a-zA-Z0-9_\.]+$"))
                {
                    string dir = (config.SortDirection ?? "asc").ToLowerInvariant() == "desc" ? "DESC" : "ASC";
                    baseSelect = $"SELECT * FROM ({baseSelect}) sort_base ORDER BY {config.SortField} {dir}";
                }
            }

            // Get total count
            int totalCount = await QueryExecutor.GetTotalCountAsync(connection, baseSelect, config.InputParameters).ConfigureAwait(false);

            // Apply Pagination
            int limit = config.Count <= 0 ? 10 : config.Count;
            int offset = (config.PageNumber - 1) * limit;
            
            string paginatedSelect = $"{baseSelect} OFFSET :OffsetLimit ROWS FETCH NEXT :CountLimit ROWS ONLY";
            config.InputParameters["OffsetLimit"] = offset;
            config.InputParameters["CountLimit"] = limit;

            // Execute the query
            var dataArray = await QueryExecutor.ExecuteQueryWithParametersAsync(connection, paginatedSelect, config.InputParameters).ConfigureAwait(false);

            _logger.Information("Successfully executed Dynamic Query {QueryNumber} on Host {HostName}. TotalCount: {TotalCount}, Returned: {RowCount}", 
                config.QueryNumber, _hostName, totalCount, dataArray.Count);

            return new
            {
                Data = dataArray,
                TotalCount = totalCount
            };
        }
        catch (Exception ex)
        {
            _logger.Error(ex, "Failed to execute Dynamic Query {QueryNumber} on Host {HostName} with FetchConfig: {@FetchConfig}", 
                config.QueryNumber, _hostName, config);
            throw;
        }
    }

    public async Task<int> InsertSalesPlanWeekLine(IEnumerable<SalesPlanWeekLineRequest> payloads, CancellationToken cancellationToken)
    {
        var items = payloads?.ToArray() ?? Array.Empty<SalesPlanWeekLineRequest>();
        _logger.Information("InsertSalesPlanWeekLine called on Host {HostName} with Count: {PayloadCount}", _hostName, items.Length);
        try
        {
            var sql = SalesPlanQueries.GetQueryText(5);
            int totalAffected = 0;

            totalAffected = await _queryExecutor.ExecuteInTransactionAsync(async tx =>
            {
                int rows = 0;
                foreach (var item in items)
                {
                    if (item == null) continue;
                    var parameters = new
                    {
                        REGION = item.REGION,
                        SUB_REGION = item.SUB_REGION,
                        ORG = item.ORG,
                        ORDERED_ITEM = item.ORDERED_ITEM,
                        RRS_CAT = item.RRS_CAT,
                        OA_QTY = item.OA_QTY,
                        RSV_SOURCE = item.RSV_SOURCE,
                        ORD_FF_DT = item.ORD_FF_DT,
                        ORD_FF_WK = item.ORD_FF_WK,
                        SCHEDULE_SHIP_DATE = item.SCHEDULE_SHIP_DATE,
                        HEADER_ID = item.HEADER_ID,
                        LINE_ID = item.LINE_ID,
                        LINE_NUM = item.LINE_NUM,
                        INVENTORY_ITEM_ID = item.INVENTORY_ITEM_ID,
                        CUSTOMER_ID = item.CUSTOMER_ID,
                        ORDER_NUMBER = item.ORDER_NUMBER,
                        ORDERED_DATE = item.ORDERED_DATE,
                        BILL_TO_CUST_NAME = item.BILL_TO_CUST_NAME,
                        ORD_TYPE = item.ORD_TYPE,
                        ASSEMBLY_METHOD2 = item.ASSEMBLY_METHOD2,
                        PEND_QTY = item.PEND_QTY,
                        ASSEMBLY_METHOD = item.ASSEMBLY_METHOD,
                        APP_BY_NAME = item.APP_BY_NAME,
                        TARGET_MON_FINAL = item.TARGET_MON_FINAL,
                        SET_NAME = item.SET_NAME
                    };

                    rows += await _queryExecutor.ExecuteAsync(sql, parameters, transaction: tx, cancellationToken: cancellationToken).ConfigureAwait(false);
                }
                return rows;
            }, cancellationToken: cancellationToken).ConfigureAwait(false);

            _logger.Information("InsertSalesPlanWeekLine successfully executed on Host {HostName}. Total rows inserted: {TotalRows}", _hostName, totalAffected);
            return totalAffected;
        }
        catch (Exception ex)
        {
            _logger.Error(ex, "InsertSalesPlanWeekLine failed on Host {HostName}", _hostName);
            throw;
        }
    }

    public async Task<int> InsertBinSpDataAsync(IEnumerable<SalesPlanWeekLineRequest> payloads, CancellationToken cancellationToken)
    {
        var items = payloads?.ToArray() ?? Array.Empty<SalesPlanWeekLineRequest>();
        _logger.Information("InsertBinSpDataAsync called on Host {HostName} with Count: {PayloadCount}", _hostName, items.Length);
        try
        {
            var insertSql = SalesPlanQueries.GetQueryText(6);
            int totalAffected = 0;

            totalAffected = await _queryExecutor.ExecuteInTransactionAsync(async tx =>
            {
                int rows = 0;
                foreach (var item in items)
                {
                    if (item == null) continue;
                    // 1. ROQ Limit Check
                    int roq = await _queryExecutor.ExecuteScalarAsync<int>(
                        "SELECT nvl(MAX(ROQ), 0) FROM JAN_CUSTOMER_REPLENISHMENT_T WHERE REP_ID = :RepId AND END_DATE IS NULL",
                        new { RepId = item.REP_ID },
                        transaction: tx,
                        cancellationToken: cancellationToken
                    ).ConfigureAwait(false);

                    if (roq == 0)
                    {
                        roq = await _queryExecutor.ExecuteScalarAsync<int>(
                            "SELECT nvl(MAX(ROQ), 0) FROM JAN_CUSTOMER_REPLENISHMENT_TEMP WHERE REP_ID = :RepId AND END_DATE IS NULL",
                            new { RepId = item.REP_ID },
                            transaction: tx,
                            cancellationToken: cancellationToken
                        ).ConfigureAwait(false);
                    }

                    if (item.PEND_QTY > roq)
                    {
                        var errorMsg = $"ROQ_LIMIT_EXCEEDED: Requested quantity ({item.PEND_QTY}) exceeds replenishment limit ROQ ({roq}) for RepId {item.REP_ID}.";
                        _logger.Warning("ROQ limit validation failed on Host {HostName}. Details: {Message}", _hostName, errorMsg);
                        throw new InvalidOperationException(errorMsg);
                    }

                    // 2. Perform insert
                    var parameters = new
                    {
                        REGION = item.REGION,
                        SUB_REGION = item.SUB_REGION,
                        ORG = item.ORG,
                        ORDERED_ITEM = item.ORDERED_ITEM,
                        RRS_CAT = item.RRS_CAT,
                        OA_QTY = item.OA_QTY,
                        RSV_SOURCE = item.RSV_SOURCE,
                        ORD_FF_DT = item.ORD_FF_DT,
                        ORD_FF_WK = item.ORD_FF_WK,
                        SCHEDULE_SHIP_DATE = item.SCHEDULE_SHIP_DATE,
                        HEADER_ID = item.HEADER_ID,
                        LINE_NUM = item.LINE_NUM,
                        INVENTORY_ITEM_ID = item.INVENTORY_ITEM_ID,
                        CUSTOMER_ID = item.CUSTOMER_ID,
                        ORDER_NUMBER = item.ORDER_NUMBER,
                        ORDERED_DATE = item.ORDERED_DATE,
                        CUSTOMER_NAME = item.CUSTOMER_NAME ?? item.BILL_TO_CUST_NAME,
                        ORD_TYPE = item.ORD_TYPE,
                        ASSEMBLY_METHOD2 = item.ASSEMBLY_METHOD2,
                        PEND_QTY = item.PEND_QTY,
                        ASSEMBLY_METHOD = item.ASSEMBLY_METHOD,
                        APP_BY_NAME = item.APP_BY_NAME,
                        TARGET_MON_FINAL = item.TARGET_MON_FINAL,
                        SET_NAME = item.SET_NAME,
                        REP_ID = item.REP_ID
                    };

                    rows += await _queryExecutor.ExecuteAsync(insertSql, parameters, transaction: tx, cancellationToken: cancellationToken).ConfigureAwait(false);
                }
                return rows;
            }, cancellationToken: cancellationToken).ConfigureAwait(false);

            _logger.Information("InsertBinSpDataAsync successfully executed on Host {HostName}. Total rows inserted: {TotalRows}", _hostName, totalAffected);
            return totalAffected;
        }
        catch (Exception ex)
        {
            _logger.Error(ex, "InsertBinSpDataAsync failed on Host {HostName}", _hostName);
            throw;
        }
    }

    public async Task<int> UpdateHOTargetMonth(IEnumerable<UpdateHOTargetMonthRequest> payloads, CancellationToken cancellationToken)
    {
        var items = payloads?.ToArray() ?? Array.Empty<UpdateHOTargetMonthRequest>();
        _logger.Information("UpdateHOTargetMonth called on Host {HostName} with Count: {PayloadCount}", _hostName, items.Length);
        try
        {
            var updateWkLinesSql = SalesPlanQueries.GetQueryText(7);
            var updateGuideTabSql = SalesPlanQueries.GetQueryText(8);
            int totalAffected = 0;

            totalAffected = await _queryExecutor.ExecuteInTransactionAsync(async tx =>
            {
                int rows = 0;
                foreach (var item in items)
                {
                    if (item == null) continue;
                    var parameters = new
                    {
                        REGION = item.REGION,
                        HO_TARGET_MONTH = item.HO_TARGET_MONTH,
                        HEADER_ID = item.HEADER_ID,
                        LINE_ID = item.LINE_ID
                    };
                    
                    rows += await _queryExecutor.ExecuteAsync(updateWkLinesSql, parameters, transaction: tx, cancellationToken: cancellationToken).ConfigureAwait(false);
                    await _queryExecutor.ExecuteAsync(updateGuideTabSql, parameters, transaction: tx, cancellationToken: cancellationToken).ConfigureAwait(false);
                }
                return rows;
            }, cancellationToken: cancellationToken).ConfigureAwait(false);

            _logger.Information("UpdateHOTargetMonth successfully executed on Host {HostName}. Total updates: {TotalRows}", _hostName, totalAffected);
            return totalAffected;
        }
        catch (Exception ex)
        {
            _logger.Error(ex, "UpdateHOTargetMonth failed on Host {HostName}", _hostName);
            throw;
        }
    }

    public async Task<(int ExceptionQty, int ExcessQty)> GetBreakupExceptionQty(BreakupExceptionQtyRequest request, CancellationToken cancellationToken)
    {
        var payload = new { request.ORG, request.INVENTORY_ITEM_ID, request.SELECTED_MONTH, request.LINE_ID };
        _logger.Information("GetBreakupExceptionQty called on Host {HostName} with Payload {@Payload}", _hostName, payload);
        try
        {
            var sql = SalesPlanQueries.GetQueryText(9);
            var parameters = new
            {
                ORG = request.ORG,
                INVENTORY_ITEM_ID = request.INVENTORY_ITEM_ID,
                SELECTED_MONTH = request.SELECTED_MONTH,
                LINE_ID = request.LINE_ID
            };

            var result = await _queryExecutor.QueryFirstOrDefaultAsync<dynamic>(sql, parameters, cancellationToken: cancellationToken).ConfigureAwait(false);
            if (result == null)
            {
                return (0, 0);
            }

            int exceptionQty = result.EXCEPTION_QTY != null ? Convert.ToInt32(result.EXCEPTION_QTY) : 0;
            int excessQty = result.EXCESS_QTY != null ? Convert.ToInt32(result.EXCESS_QTY) : 0;
            return (exceptionQty, excessQty);
        }
        catch (Exception ex)
        {
            _logger.Error(ex, "GetBreakupExceptionQty failed on Host {HostName} with Payload {@Payload}", _hostName, payload);
            throw;
        }
    }

    public async Task<int> CreateBinRecordAsync(CreateBinRecordDto dto, CancellationToken cancellationToken)
    {
        _logger.Information("CreateBinRecordAsync called on Host {HostName} with Payload {@Payload}", _hostName, dto);
        try
        {
            // 1. Check duplicate
            var countSql = SalesPlanQueries.GetQueryText(25);
            var countParams = new
            {
                Region = dto.Region,
                InventoryItemId = dto.InventoryItemId,
                OrganizationId = dto.OrganizationId,
                CustomerId = dto.CustomerId,
                StockType = dto.StockType
            };

            int activeCount = await _queryExecutor.ExecuteScalarAsync<int>(countSql, countParams, cancellationToken: cancellationToken).ConfigureAwait(false);
            if (activeCount > 0)
            {
                throw new InvalidOperationException("An active replenishment bin already exists for this combination.");
            }

            // 2. Insert record
            var insertSql = SalesPlanQueries.GetQueryText(21);
            var insertParams = new
            {
                OrganizationId = dto.OrganizationId,
                Org = dto.Org,
                InventoryItemId = dto.InventoryItemId,
                ItemNo = dto.ItemNo,
                Description = dto.Description,
                CustomerId = dto.CustomerId,
                CustName = dto.CustName,
                ROQ = dto.TbrQty,
                CreatedBy = dto.CreatedBy,
                BinCat = dto.BinCat,
                Region = dto.Region,
                StockType = dto.StockType,
                BinLocation = dto.BinLocation
            };

            return await _queryExecutor.ExecuteAsync(insertSql, insertParams, cancellationToken: cancellationToken).ConfigureAwait(false);
        }
        catch (Exception ex)
        {
            _logger.Error(ex, "CreateBinRecordAsync failed on Host {HostName} with Payload {@Payload}", _hostName, dto);
            throw;
        }
    }

    public async Task<bool> UpdateBinDataAsync(UpdateBinDataDto dto, CancellationToken cancellationToken)
    {
        _logger.Information("UpdateBinDataAsync called on Host {HostName} with Payload {@Payload}", _hostName, dto);
        try
        {
            var sql = SalesPlanQueries.GetQueryText(11);
            var parameters = new
            {
                TargetMonth = dto.TargetMonth,
                EmergencyFlag = dto.EmergencyFlag,
                CompProductFlag = dto.CompProductFlag,
                BinLineId = dto.BinLineId
            };

            int affected = await _queryExecutor.ExecuteAsync(sql, parameters, cancellationToken: cancellationToken).ConfigureAwait(false);
            return affected > 0;
        }
        catch (Exception ex)
        {
            _logger.Error(ex, "UpdateBinDataAsync failed on Host {HostName} with Payload {@Payload}", _hostName, dto);
            throw;
        }
    }

    public async Task<int> UpdateRepBinDataAsync(int binQty, string repId, string updatedBy, CancellationToken cancellationToken)
    {
        var payload = new { binQty, repId, updatedBy };
        _logger.Information("UpdateRepBinDataAsync called on Host {HostName} with Payload {@Payload}", _hostName, payload);
        try
        {
            var sql = SalesPlanQueries.GetQueryText(27);
            var parameters = new
            {
                BinQty = binQty,
                RepId = repId,
                LastUpdateBy = updatedBy
            };

            return await _queryExecutor.ExecuteAsync(sql, parameters, cancellationToken: cancellationToken).ConfigureAwait(false);
        }
        catch (Exception ex)
        {
            _logger.Error(ex, "UpdateRepBinDataAsync failed on Host {HostName} with Payload {@Payload}", _hostName, payload);
            throw;
        }
    }

    public async Task<int> ApproveBinRecordAsync(ApproveBinRecordDto dto, CancellationToken cancellationToken)
    {
        _logger.Information("ApproveBinRecordAsync called on Host {HostName} with Payload {@Payload}", _hostName, dto);
        try
        {
            int totalAffected = 0;

            totalAffected = await _queryExecutor.ExecuteInTransactionAsync(async tx =>
            {
                // 1. Get pending record details
                var queryPendingSql = "SELECT region, inventory_item_id as InventoryItemId, organization_id as OrganizationId, customer_id as CustomerId, stock_type as StockType FROM JAN_CUSTOMER_REPLENISHMENT_TEMP WHERE REP_ID = :RepId AND APPROVALFLAG = 'N'";
                var tempRecord = await _queryExecutor.QueryFirstOrDefaultAsync<TempBinRecord>(queryPendingSql, new { RepId = dto.RepId }, transaction: tx, cancellationToken: cancellationToken).ConfigureAwait(false);
                
                if (tempRecord == null)
                {
                    return 0;
                }

                // 2. Close active bin records for this combination
                var closeSql = SalesPlanQueries.GetQueryText(26);
                var closeParams = new
                {
                    EndDate = DateTime.UtcNow.ToString("yyyy-MM-dd"),
                    LastUpdateBy = dto.ApprovedBy,
                    Region = tempRecord.Region,
                    InventoryItemId = tempRecord.InventoryItemId,
                    OrganizationId = tempRecord.OrganizationId,
                    CustomerId = tempRecord.CustomerId,
                    StockType = tempRecord.StockType
                };
                await _queryExecutor.ExecuteAsync(closeSql, closeParams, transaction: tx, cancellationToken: cancellationToken).ConfigureAwait(false);

                // 3. Approve and copy
                var approveInsertSql = SalesPlanQueries.GetQueryText(23);
                await _queryExecutor.ExecuteAsync(approveInsertSql, new { RepId = dto.RepId }, transaction: tx, cancellationToken: cancellationToken).ConfigureAwait(false);

                // 4. Update status in temp
                var afterApproveUpdateSql = SalesPlanQueries.GetQueryText(24);
                var updateParams = new
                {
                    ApprovedBy = dto.ApprovedBy,
                    RepId = dto.RepId
                };
                return await _queryExecutor.ExecuteAsync(afterApproveUpdateSql, updateParams, transaction: tx, cancellationToken: cancellationToken).ConfigureAwait(false);

            }, cancellationToken: cancellationToken).ConfigureAwait(false);

            _logger.Information("ApproveBinRecordAsync successfully executed on Host {HostName}. Status: {Status}", _hostName, totalAffected > 0 ? "Approved" : "Not Found");
            return totalAffected;
        }
        catch (Exception ex)
        {
            _logger.Error(ex, "ApproveBinRecordAsync failed on Host {HostName} with Payload {@Payload}", _hostName, dto);
            throw;
        }
    }

    public async Task<int> DeleteBinMasterDataAsync(DeleteBinMasterDataRequest request, CancellationToken cancellationToken)
    {
        _logger.Information("DeleteBinMasterDataAsync called on Host {HostName} with Payload {@Payload}", _hostName, request);
        try
        {
            var sql = SalesPlanQueries.GetQueryText(14);
            var parameters = new
            {
                reason = request.Reason,
                REP_ID = request.REP_ID
            };

            return await _queryExecutor.ExecuteAsync(sql, parameters, cancellationToken: cancellationToken).ConfigureAwait(false);
        }
        catch (Exception ex)
        {
            _logger.Error(ex, "DeleteBinMasterDataAsync failed on Host {HostName} with Payload {@Payload}", _hostName, request);
            throw;
        }
    }

    private class TempBinRecord
    {
        public string Region { get; set; } = string.Empty;
        public int InventoryItemId { get; set; }
        public int OrganizationId { get; set; }
        public int CustomerId { get; set; }
        public string StockType { get; set; } = string.Empty;
    }
}
