using Microsoft.AspNetCore.Mvc;
using Server.Interfaces;
using Server.Models;

namespace Server.Controllers;

[ApiController]
[Route("api/[controller]")]
public class SalesPlanController(ISalesPlanServices salesPlanServices) : ControllerBase
{
    private readonly ISalesPlanServices _salesPlanServices = salesPlanServices;

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
        catch (InvalidOperationException ex) when (ex.Message.Contains("ROQ_LIMIT_EXCEEDED"))
        {
            return BadRequest(new { message = ex.Message });
        }
        catch (Exception ex)
        {
            return StatusCode(500, ex.Message);
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

    [HttpPost("execute-query")]
    public async Task<IActionResult> ExecuteQuery(
        [FromBody] DynamicTransaction.Models.FetchConfig config,
        CancellationToken cancellationToken)
    {
        if (config == null)
        {
            return BadRequest("FetchConfig cannot be null.");
        }

        try
        {
            var result = await _salesPlanServices.ExecuteDynamicQueryAsync(config, cancellationToken);
            return Ok(result);
        }
        catch (OperationCanceledException)
        {
            return StatusCode(499, "Request cancelled.");
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = ex.Message });
        }
    }
}
