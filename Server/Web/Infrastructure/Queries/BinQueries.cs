namespace Server.Infrastructure.Queries;

public class BinQueries
{
    public const string GetAllRegionDetails = @"
            SELECT DISTINCT
                TER_NAME AS Region, 
                DR_REGION AS SubRegion 
            FROM jan_bms_login_v";

    public const string GetAllBin = @"
        SELECT
            customer_id,
            rep_id,
            inventory_item_id,
            organization_id,
            cust_name,
            region,
            parent_region,
            item_no,
            SUM(tbr_qty) req_qty,
            jan_orgcode(organization_id) org,
            (
                SELECT DISTINCT description
                FROM mtl_system_items
                WHERE inventory_item_id = a.inventory_item_id
                    AND organization_id = a.organization_id
            ) description,
            (
                SELECT ams_flag
                FROM jan_item_master_tab
                WHERE inventory_item_id = a.inventory_item_id
                    AND organization_id = a.organization_id
            ) ams_cat,
            '' target_mon_final,
            '' ho_target_month,
            '' prod_commit_month,
            '' branch_target_month,
            0 exception_qty,
            bin_ff_dt,
            bin_line_id,
            jan_sales_rrs_category(organization_id, inventory_item_id) rrs_cat,
            '' branch_validated_date,
            '' comp_product_flag,
            '' emergency_flag,
            '' bin_wk_no
        FROM
            jan_sp_wk_bin_t a
        WHERE
                1 = 1
            AND
                (
                    (:IsHO = 1 AND branch_validated_date IS NOT NULL)
                    OR
                    (:IsHO = 0 AND branch_target_month IS NULL)
                )
            {0}
        GROUP BY
            customer_id,
            rep_id,
            inventory_item_id,
            organization_id,
            cust_name,
            region,
            parent_region,
            item_no,
            bin_ff_dt,
            bin_line_id";


    //get bin 
    public const string GetCustomerReplenishmentBinSql = @"
    SELECT A.*,
        (select customer_class_code from ra_customers where customer_id=a.customer_id)customer_class_code,
        (select customer_category from jan_pick_forward_control where bill_to_customer_id=a.customer_id)customer_category
        FROM JAN_CUSTOMER_REPLENISHMENT_T A 
        WHERE A.END_DATE IS NULL
      AND (
        :RegionHoCheck = 'HO' 
        OR A.REGION IN :Regions
      )";

    /// <summary>
    /// Retrieves inventory item ID based on the Segment1 item code.
    /// </summary>
    public const string GetInventoryItemDetails = @"
        SELECT 
            InventoryItemId,
            ItemCode,
            Description
        FROM (
            SELECT DISTINCT
                INVENTORY_ITEM_ID AS InventoryItemId,
                TRIM(SEGMENT1) AS ItemCode,
                TRIM(DESCRIPTION) AS Description
            FROM
                MTL_SYSTEM_ITEMS
            WHERE
                UPPER(SEGMENT1) LIKE '%' || UPPER(:Search) || '%'
                AND CUSTOMER_ORDER_ENABLED_FLAG = 'Y' 
                AND organization_id IN (
                    SELECT organization_id 
                    FROM org_organization_definitions 
                    WHERE operating_unit = 103
                )
        )
        ORDER BY 
            LENGTH(ItemCode) ASC,
            ItemCode ASC";

    public const string GetInventoryItemCount = @"
        SELECT COUNT(DISTINCT INVENTORY_ITEM_ID)
        FROM
            MTL_SYSTEM_ITEMS
        WHERE
            UPPER(SEGMENT1) LIKE '%' || UPPER(:Search) || '%'
            AND CUSTOMER_ORDER_ENABLED_FLAG = 'Y'";

    public const string GetOrganationIdByOperatingUnitIdAndInventoryId = @"
        select DISTINCT SHIP_FROM_ORG_ID AS organizationId, JAN_ORGCODE(SHIP_FROM_ORG_ID) AS organizationCode 
        from jan_oa_bin_demand_rsv_n 
        where INVENTORY_ITEM_ID = :InventoryId and region=:Region";

    public const string insertRepBinSql = @"
        INSERT INTO JAN_CUSTOMER_REPLENISHMENT_TEMP (
        rep_id,
        organization_id,
        org,
        inventory_item_id,
        item_no,
        description,
        customer_id,
        CUSTOMER_NAME,
        roq,
        start_date,
        created_by,
        created_date,
        last_update_by,
        last_update_date,
        bin_fulfillment_days,
        no_of_schedules,
        bin_category,
        region,
        STOCK_TYPE,
        BIN_LOCATION,
        APPROVALFLAG
        ) VALUES (
        jan_rep_id.NEXTVAL,
        :OrganizationId,
        :Org,
        :InventoryItemId,
        :ItemNo,
        :Description,
        :CustomerId,
        :CustName,
        :ROQ,
        SYSDATE,
        :CreatedBy,
        SYSDATE,
        null,
        null,
        7,
        4,
        :BinCat,
        :Region,
        :StockType,
        :BinLocation,
        'N'
        )";

    public const string GetPendingRepBinsSql = @"
        SELECT A.*,
            (SELECT customer_class_code FROM ra_customers WHERE customer_id = A.customer_id) customer_class_code,
            (SELECT customer_category FROM jan_pick_forward_control WHERE bill_to_customer_id = A.customer_id) customer_category
        FROM JAN_CUSTOMER_REPLENISHMENT_TEMP A
        WHERE A.APPROVALFLAG = 'N'
          AND A.END_DATE IS NULL";

    public const string ApproveInsertRepBinSql = @"
        INSERT INTO JAN_CUSTOMER_REPLENISHMENT_T (
        rep_id,
        organization_id,
        org,
        inventory_item_id,
        item_no,
        description,
        customer_id,
        CUSTOMER_NAME,
        roq,
        start_date,
        created_by,
        created_date,
        last_update_by,
        last_update_date,
        bin_fulfillment_days,
        no_of_schedules,
        bin_category,
        region,
        STOCK_TYPE,
        BIN_LOCATION
                )
                SELECT
                        rep_id,
                        organization_id,
                        org,
                        inventory_item_id,
                        item_no,
                        description,
                        customer_id,
                        customer_name,
                        roq,
                        start_date,
                        created_by,
                        created_date,
                        last_update_by,
                        last_update_date,
                        bin_fulfillment_days,
                        no_of_schedules,
                        bin_category,
                        region,
                        stock_type,
                        bin_location
                FROM JAN_CUSTOMER_REPLENISHMENT_TEMP
                WHERE rep_id = :RepId
                    AND approvalflag = 'N'";

    public const string AfterApproveUpdateSql = @"
        UPDATE JAN_CUSTOMER_REPLENISHMENT_TEMP
                SET APPROVALFLAG = 'Y',
                        APPROVEDBY = :ApprovedBy
                WHERE REP_ID = :RepId
                    AND APPROVALFLAG = 'N'";

    public const string GetActiveRepBinCountSql = @"
                SELECT COUNT(*)
                FROM JAN_CUSTOMER_REPLENISHMENT_T
                WHERE END_DATE IS NULL
                    AND REGION = :Region
                    AND INVENTORY_ITEM_ID = :InventoryItemId
                    AND ORGANIZATION_ID = :OrganizationId
                    AND CUSTOMER_ID = :CustomerId
                    AND STOCK_TYPE = :StockType";

    public const string CloseActiveRepBinsSql = @"
                UPDATE JAN_CUSTOMER_REPLENISHMENT_T
                SET END_DATE = TO_DATE(:EndDate, 'YYYY-MM-DD'),
                        LAST_UPDATE_BY = :LastUpdateBy,
                        LAST_UPDATE_DATE = SYSDATE
                WHERE END_DATE IS NULL
                    AND REGION = :Region
                    AND INVENTORY_ITEM_ID = :InventoryItemId
                    AND ORGANIZATION_ID = :OrganizationId
                    AND CUSTOMER_ID = :CustomerId
                    AND STOCK_TYPE = :StockType";

    public const string updateRepBinSql = @"
        UPDATE JAN_CUSTOMER_REPLENISHMENT_T
        SET ROQ = :BinQty,
        LAST_UPDATE_BY = :LastUpdateBy,
        LAST_UPDATE_DATE = TO_DATE('06-03-25', 'DD-MM-YY')
        WHERE rep_id = :RepId AND end_date is null";
}
