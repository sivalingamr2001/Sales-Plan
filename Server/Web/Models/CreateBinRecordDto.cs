namespace Server.Models;

public class CreateBinRecordDto
{
    public int? CustomerId { get; set; }
    public int InventoryItemId { get; set; }
    public int OrganizationId { get; set; }
    public string? CustName { get; set; }
    public string? Region { get; set; }
    public string? ParentRegion { get; set; }
    public string? ItemNo { get; set; }
    public int TbrQty { get; set; }
    public string? BinCat { get; set; }
    public string? Org { get; set; }
    public string? Description { get; set; }
    public string? CreatedBy { get; set; }
    public string? LastUpdateBy { get; set; }
    public string? StockType { get; set; }
    public string? BinLocation { get; set; }
    public string? EndDate { get; set; }
}

public class OrganizationDto
{
    public int OrganizationId { get; set; }
    public string OrganizationCode { get; set; } = string.Empty;
}
