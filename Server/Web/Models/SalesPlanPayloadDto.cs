namespace Server.Models;

public class SalesPlanWeekLineRequest
{
    public string? REGION { get; set; }
    public string? SUB_REGION { get; set; }
    public string? ORG { get; set; }
    public string? ORDERED_ITEM { get; set; }
    public string? RRS_CAT { get; set; }
    public int? OA_QTY { get; set; }
    public string? RSV_SOURCE { get; set; }
    public string? ORD_FF_DT { get; set; }
    public string? ORD_FF_WK { get; set; }
    public string? SCHEDULE_SHIP_DATE { get; set; }
    public long HEADER_ID { get; set; }
    public long LINE_ID { get; set; }
    public int LINE_NUM { get; set; }
    public long INVENTORY_ITEM_ID { get; set; }
    public long CUSTOMER_ID { get; set; }
    public long ORDER_NUMBER { get; set; }
    public string? ORDERED_DATE { get; set; }
    public string? BILL_TO_CUST_NAME { get; set; }
    public string? ORD_TYPE { get; set; }
    public string? ASSEMBLY_METHOD2 { get; set; }
    public int? PEND_QTY { get; set; }
    public string? ASSEMBLY_METHOD { get; set; }
    public string? APP_BY_NAME { get; set; }
    public string? TARGET_MON_FINAL { get; set; }
    public string? SET_NAME { get; set; }
    public string? COM_PRODUCT_FLAG { get; set; }
    public int REP_ID { get; set; }
    public string? CUSTOMER_NAME { get; set; }
}

public class UpdateHOTargetMonthRequest
{
    public string? REGION { get; set; }
    public string? HO_TARGET_MONTH { get; set; }
    public long HEADER_ID { get; set; }
    public long LINE_ID { get; set; }
}

public class BreakupExceptionQtyRequest
{
    public string? ORG { get; set; }
    public long INVENTORY_ITEM_ID { get; set; }
    public string? SELECTED_MONTH { get; set; }
    public long LINE_ID { get; set; }
}
