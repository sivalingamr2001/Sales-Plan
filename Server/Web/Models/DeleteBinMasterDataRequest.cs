namespace Server.Models;

public class DeleteBinMasterDataRequest
{
    public int REP_ID { get; set; }
    public string Reason { get; set; } = string.Empty;
}
