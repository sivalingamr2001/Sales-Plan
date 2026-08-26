namespace Server.Models;

public class UpdateBinDataDto
{
    public long BinLineId { get; set; }
    public string? TargetMonth { get; set; }
    public int? EmergencyFlag { get; set; }
    public string? CompProductFlag { get; set; }
}
