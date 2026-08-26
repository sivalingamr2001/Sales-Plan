namespace Server.Models;

public class InventoryItemDto
{
    public long InventoryItemId { get; set; }
    public string ItemCode { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
}
