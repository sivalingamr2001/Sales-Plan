using Microsoft.AspNetCore.Mvc;
using Server.Interfaces;
using Server.Models;
using Server.Services;

namespace Server.Controllers;

[ApiController]
[Route("api/[controller]")]
public class SalesPlanController(ISalesPlanServices salesPlanServices) : ControllerBase
{
    private readonly ISalesPlanServices _salesPlanServices = salesPlanServices;

    [HttpGet]
    public async Task<ActionResult<IEnumerable<dynamic>>> GetSalesPlan(
        [FromQuery] string? custName,
        [FromQuery] long? ordId,
        [FromQuery] string? itemNo,
        [FromQuery] string? parentRegion,
        CancellationToken cancellationToken)
    {
        var result = await _salesPlanServices.GetSalesPlan(custName, ordId, itemNo, parentRegion, cancellationToken);
        return Ok(result);
    }

    [HttpGet("bin-rsv-pend-list")]
    public async Task<ActionResult<IEnumerable<dynamic>>> GetAllBinRsvHoPendList(
        CancellationToken cancellationToken)
    {
        var result = await _salesPlanServices.GetAllBinRsvHoPendList(cancellationToken);
        return Ok(result);
    }

    [HttpGet("consolidated")]
    public async Task<ActionResult<IEnumerable<dynamic>>> GetSalesPlanConsolidated(
        CancellationToken cancellationToken)
    {
        var result = await _salesPlanServices.GetConsolidatedDataDynamicAsync(cancellationToken);
        return Ok(result);
    }

    [HttpGet("breakdown")]
    public async Task<ActionResult<IEnumerable<dynamic>>> GetSalesPlanBreakdown(
        [FromQuery] string? orderedItem,
        CancellationToken cancellationToken)
    {
        var result = await _salesPlanServices.GetBreakdownDataDynamicAsync(orderedItem, cancellationToken);
        return Ok(result);
    }

    [HttpPost("create-line")]
    public async Task<IActionResult> InsertSalesPlanWeekLine([FromBody] IEnumerable<SalesPlanWeekLineRequest> payload, CancellationToken cancellationToken)
    {
        try
        {
            if (payload == null || !payload.Any())
            {
                return BadRequest("The collection payload cannot be null or empty.");
            }

            int rowsAffected = await _salesPlanServices.InsertSalesPlanWeekLine(payload, cancellationToken);

            return Ok(new { Success = true, RowsAffected = rowsAffected });
        }
        catch (OperationCanceledException)
        {
            return StatusCode(499, "Request cancelled.");
        }
        catch (Exception)
        {
            return StatusCode(500, "Internal Server Error.");
        }
    }

    [HttpPost("insert-bin-data")]
    public async Task<IActionResult> InsertBinSpData(
        [FromBody] IEnumerable<SalesPlanWeekLineRequest> payload,
        CancellationToken cancellationToken)
    {
        try
        {
            if (payload == null || !payload.Any())
            {
                return BadRequest("The collection payload cannot be null or empty.");
            }

            if (payload.Any(item => !item.OA_QTY.HasValue || !item.PEND_QTY.HasValue))
            {
                return BadRequest("OA_QTY and PEND_QTY are required for every BIN SP row.");
            }

            int rowsAffected = await _salesPlanServices.InsertBinSpDataAsync(payload, cancellationToken);
            return Ok(new { Success = true, RowsAffected = rowsAffected });
        }
        catch (OperationCanceledException)
        {
            return StatusCode(499, "Request cancelled.");
        }
        catch (ArgumentException ex)
        {
            return BadRequest(ex.Message);
        }
        // =========================================================================
        // ADDED: Explicitly catch validation limits to send back to React UI
        // =========================================================================
        catch (InvalidOperationException ex) when (ex.Message.Contains("ROQ_LIMIT_EXCEEDED"))
        {
            return BadRequest(new { message = ex.Message });
        }
        // =========================================================================
        catch (Exception ex)
        {
            // Log the actual exception details internally here via your logger if available
            return StatusCode(500, ex);
        }
    }

    [HttpPost("update-ho-target-month")]
    public async Task<IActionResult> UpdateHOTargetMonth([FromBody] IEnumerable<UpdateHOTargetMonthRequest> payload, CancellationToken cancellationToken)
    {
        try
        {
            if (payload == null || !payload.Any())
            {
                return BadRequest("The collection payload cannot be null or empty.");
            }

            int rowsAffected = await _salesPlanServices.UpdateHOTargetMonth(payload, cancellationToken);

            return Ok(new { Success = true, RowsAffected = rowsAffected });
        }
        catch (OperationCanceledException)
        {
            return StatusCode(499, "Request cancelled.");
        }
        catch (Exception)
        {
            return StatusCode(500, "Internal Server Error.");
        }
    }

    [HttpPost("breakup-exception-qty")]
    public async Task<ActionResult> GetBreakupExceptionQty([FromBody] BreakupExceptionQtyRequest request, CancellationToken cancellationToken)
    {
        try
        {
            if (request == null)
            {
                return BadRequest("Request cannot be null.");
            }

            // Deconstruct the tuple values from the service layer
            var (exceptionQty, excessQty) = await _salesPlanServices.GetBreakupExceptionQty(request, cancellationToken);

            return Ok(new
            {
                Success = true,
                ExceptionQty = exceptionQty,
                ExcessQty = excessQty
            });
        }
        catch (OperationCanceledException)
        {
            return StatusCode(499, "Request cancelled.");
        }
        catch (Exception)
        {
            return StatusCode(500, "Internal Server Error.");
        }
    }

    [HttpGet("full_breakdown")]
    public async Task<ActionResult<IEnumerable<dynamic>>> GetSalesPlanFullBreakdown(
      CancellationToken cancellationToken)
    {
        var result = await _salesPlanServices.GetBreakdownDataDynamicFullAsync(cancellationToken);
        return Ok(result);
    }

    // --- New Integrated Endpoints ---

    [HttpGet("bins")]
    public async Task<ActionResult<IEnumerable<dynamic>>> GetAllBin(
        [FromQuery] string region,
        CancellationToken cancellationToken)
    {
        var result = await _salesPlanServices.GetAllBinAsync(region, cancellationToken);
        return Ok(result);
    }

    [HttpPost("bin")]
    public async Task<IActionResult> CreateBinRecord(
        [FromBody] CreateBinRecordDto dto,
        CancellationToken cancellationToken)
    {
        try
        {
            if (dto == null)
            {
                return BadRequest("Payload cannot be null.");
            }

            int rowsAffected = await _salesPlanServices.CreateBinRecordAsync(dto, cancellationToken);
            return Ok(new { Success = true, RowsAffected = rowsAffected });
        }
        catch (OperationCanceledException)
        {
            return StatusCode(499, "Request cancelled.");
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new { message = ex.Message });
        }
        catch (Exception)
        {
            return StatusCode(500, "Internal Server Error.");
        }
    }

    [HttpPut("bin-data")]
    public async Task<IActionResult> UpdateBinData(
        [FromBody] UpdateBinDataDto dto,
        CancellationToken cancellationToken)
    {
        var success = await _salesPlanServices.UpdateBinDataAsync(dto, cancellationToken);

        if (!success)
        {
            return NotFound(new { message = $"Bin line item {dto.BinLineId} not found." });
        }

        return NoContent();
    }

    [HttpPut("rep-bin-data")]
    public async Task<IActionResult> UpdateRepBinData(
        [FromQuery] int binQty,
        [FromQuery] string repId,
        [FromQuery] string updatedBy,
        CancellationToken cancellationToken)
    {
        try
        {
            int rowsAffected = await _salesPlanServices.UpdateRepBinDataAsync(binQty, repId, updatedBy, cancellationToken);
            return Ok(new { Success = true, RowsAffected = rowsAffected });
        }
        catch (OperationCanceledException)
        {
            return StatusCode(499, "Request cancelled.");
        }
        catch (Exception)
        {
            return StatusCode(500, "Internal Server Error.");
        }
    }

    [HttpGet("bins-with-region")]
    public async Task<ActionResult<IEnumerable<dynamic>>> GetAllBinWithRegion(
        [FromQuery] string region,
        CancellationToken cancellationToken)
    {
        var result = await _salesPlanServices.GetAllBinWithRegionAsync(region, cancellationToken);
        return Ok(result);
    }

    [HttpGet("customer-replenishment-bin")]
    public async Task<ActionResult<IEnumerable<dynamic>>> GetCustomerReplenishmentBin(
        [FromQuery] string regionStr,
        CancellationToken cancellationToken)
    {
        var result = await _salesPlanServices.GetCustomerReplenishmentBinAsync(regionStr, cancellationToken);
        return Ok(result);
    }

    [HttpGet("pending-replenishment-bins")]
    public async Task<ActionResult<IEnumerable<dynamic>>> GetPendingRepBins(
        CancellationToken cancellationToken)
    {
        var result = await _salesPlanServices.GetPendingRepBinsAsync(cancellationToken);
        return Ok(result);
    }

    [HttpPost("approve-bin")]
    public async Task<IActionResult> ApproveBinRecord(
        [FromBody] ApproveBinRecordDto dto,
        CancellationToken cancellationToken)
    {
        try
        {
            if (dto == null || dto.RepId <= 0 || string.IsNullOrWhiteSpace(dto.ApprovedBy))
            {
                return BadRequest("RepId and ApprovedBy are required.");
            }

            int rowsAffected = await _salesPlanServices.ApproveBinRecordAsync(dto, cancellationToken);
            return rowsAffected == 0
                ? NotFound(new { message = $"Pending bin {dto.RepId} was not found." })
                : Ok(new { Success = true, RowsAffected = rowsAffected });
        }
        catch (OperationCanceledException)
        {
            return StatusCode(499, "Request cancelled.");
        }
        catch (Exception)
        {
            return StatusCode(500, "Internal Server Error.");
        }
    }

    [HttpDelete("bin-master")]
    public async Task<IActionResult> DeleteBinMasterData(
        [FromBody] DeleteBinMasterDataRequest request,
        CancellationToken cancellationToken)
    {
        if (request == null || request.REP_ID <= 0 || string.IsNullOrWhiteSpace(request.Reason))
        {
            return BadRequest("REP_ID and reason are required.");
        }

        try
        {
            var rowsAffected = await _salesPlanServices.DeleteBinMasterDataAsync(request, cancellationToken);
            return rowsAffected == 0
                ? NotFound(new { message = $"Pending bin {request.REP_ID} was not found." })
                : Ok(new { Success = true, RowsAffected = rowsAffected });
        }
        catch (OperationCanceledException)
        {
            return StatusCode(499, "Request cancelled.");
        }
        catch (Exception)
        {
            return StatusCode(500, "Internal Server Error.");
        }
    }

    [HttpGet("inventory-items")]
    public async Task<ActionResult<List<InventoryItemDto>>> GetInventoryItemDetails(
        [FromQuery] string? search,
        CancellationToken cancellationToken)
    {
        var result = await _salesPlanServices.GetInventoryItemDetailsAsync(search, cancellationToken);
        return Ok(result);
    }

    [HttpGet("org-by-inventory-and-ou")]
    public async Task<ActionResult<OrganizationDto>> GetOrgIdByInventoryIdAndOuId(
        [FromQuery] int inventoryId,
        [FromQuery] string region,
        CancellationToken cancellationToken)
    {
        var result = await _salesPlanServices.GetOrgIdByInventoryIdAndOuIdAsync(inventoryId, region, cancellationToken);
        return Ok(result);
    }

    [HttpGet("regions")]
    public async Task<ActionResult<IEnumerable<RegionDetailsDto>>> GetAllRegionDetails(
        CancellationToken cancellationToken)
    {
        var result = await _salesPlanServices.GetAllRegionDetailsAsync(cancellationToken);
        return Ok(result);
    }

    [HttpGet("exception-validation")]
    public async Task<ActionResult> ValidateExceptionQty(
        [FromQuery] int inventoryId,
        CancellationToken cancellationToken)
    {
            var result = await _salesPlanServices.GetBreakupExceptionQty(new BreakupExceptionQtyRequest { INVENTORY_ITEM_ID = inventoryId }, cancellationToken);
            return Ok(result);
    }

    [HttpGet("exception-details")]
    public async Task<ActionResult<IEnumerable<dynamic>>> GetExceptionDetails(
        [FromQuery] int inventoryId,
        CancellationToken cancellationToken)
    {
        var result = await _salesPlanServices.GetExceptionDetailsByInventoryIdAsync(
            inventoryId,
            cancellationToken);
        return Ok(result);
    }

    [HttpGet("monthly-quantity")]
    public async Task<IActionResult> GetMonthlyQuantity(
        [FromQuery] long customerId,
        [FromQuery] long orgId,
        [FromQuery] int inventoryId,
        CancellationToken cancellationToken)
    {
        var result = await _salesPlanServices.GetMonthlySalesQtyAsync(customerId, orgId, inventoryId, cancellationToken);
        return Ok(result);
    }
}
