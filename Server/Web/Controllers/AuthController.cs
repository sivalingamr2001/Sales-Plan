using Microsoft.AspNetCore.Mvc;
using Server.Interfaces;
using Server.Models;

namespace Backend.Controllers;

[ApiController]
[Route("api/[controller]")]
[Produces("application/json")]
public sealed class AuthController(IAuthServices authServices) : ControllerBase
{
    private readonly IAuthServices _authServices = authServices;

    [HttpPost("login")]
    public async Task<ActionResult<RegionDetailsDto>> GetRegionDetailsAfterLogin(
        [FromBody] LoginRequest request,
        CancellationToken cancellationToken)
    {
        var result = await _authServices.GetRegionDetailsAfterLoginAsync(
            request.Username, request.Password, cancellationToken);

        if (result is null)
            return Unauthorized(new { message = "Invalid credentials or region assignment not found." });

        return Ok(result);
    }

    [HttpGet("regions")]
    public async Task<ActionResult<IEnumerable<RegionDetailsDto>>> GetAllRegions(
        CancellationToken cancellationToken)
    {
        var regions = await _authServices.GetAllRegionDetailsAsync(cancellationToken);
        return Ok(regions);
    }

    [HttpPost("get-customer-name-by-region")]
    public async Task<ActionResult<RegionDetailsDto>> GetCustomerNameByRegion(
        [FromBody] CustomerSearchRequest request,
        CancellationToken cancellationToken)
    {
        var result = await _authServices.GetCustomerNameByRegionAsync(
            request.Region,
            request.SearchTerm,
            cancellationToken);

        if (result is null)
            return Unauthorized(new { message = "Invalid credentials or region assignment not found." });

        return Ok(result);
    }

    public class LoginRequest
    {
        public string Username { get; set; } = string.Empty;
        public string Password { get; set; } = string.Empty;
    }

    public class CustomerSearchRequest
    {
        public string Region { get; set; } = string.Empty;
        public string SearchTerm { get; set; } = string.Empty;
    }

}