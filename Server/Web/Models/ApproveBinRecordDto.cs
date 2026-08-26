namespace Server.Models;

public class ApproveBinRecordDto
{
    public int RepId { get; set; }
    public string ApprovedBy { get; set; } = string.Empty;
}
