import { toast } from "sonner"
import type { RegionDetailsDto } from "./authApi"
import { apiClient } from "./axiosClient"
import type {
  SalesPlan,
  SalesPlanConsolidatedData,
  SalesPlanBrkUp,
  SalesPlanWeekLineRequest,
  UpdateHOTargetMonthRequest,
  BreakupExceptionQtyRequest,
  OrganizationDto,
  InventoryItemDto,
  CreateBinRecordDto,
  MonthlySalesQuantity,
} from "./types"

export type { SalesPlan, SalesPlanConsolidatedData, SalesPlanBrkUp }

export const salesPlanApi = {
  getSalesPlans: (
    customerName?: string,
    orderedItem?: string,
    parentRegion?: string
  ) =>
    apiClient.get<SalesPlan[]>("/SalesPlan", {
      params: {
        custName: customerName,
        ordId:
          orderedItem && !Number.isNaN(Number(orderedItem))
            ? Number(orderedItem)
            : undefined,
        itemNo: orderedItem || undefined,
        parentRegion: parentRegion || undefined,
      },
    }),

  getSalesPlansConsolidated: () =>
    apiClient.get<SalesPlanConsolidatedData[]>("/SalesPlan/consolidated"),

  getSalesPlansBreakdown: (orderedItem?: string) =>
    apiClient.get<SalesPlanBrkUp[]>("/SalesPlan/breakdown", {
      params: { orderedItem },
    }),

  getSalesPlansFullBreakdown: () =>
    apiClient.get<SalesPlanBrkUp[]>("/SalesPlan/full_breakdown"),

  getBinRsvHoPendingList: () =>
    apiClient.get<SalesPlanBrkUp[]>("/SalesPlan/bin-rsv-pend-list"),

  insertSalesPlans: async (
    payload: SalesPlanWeekLineRequest[]
  ): Promise<any> => {
    try {
      const response = await apiClient.post("/SalesPlan/create-line", payload)
      return response.data
    } catch (error) {
      throw error
    }
  },

  updateHOTargetMonth: async (
    payload: UpdateHOTargetMonthRequest[]
  ): Promise<any> => {
    try {
      const response = await apiClient.post(
        "/SalesPlan/update-ho-target-month",
        payload
      )
      return response.data
    } catch (error) {
      throw error
    }
  },

  getBreakupExceptionQty: async (
    payload: BreakupExceptionQtyRequest
  ): Promise<any> => {
    try {
      const response = await apiClient.post(
        "/SalesPlan/breakup-exception-qty",
        payload
      )
      return response.data
    } catch (error) {
      throw error
    }
  },

  getMonthlyQuantity: (
    customerId: number,
    orgId: number,
    inventoryId: number
  ) =>
    apiClient.get<MonthlySalesQuantity[]>("/SalesPlan/monthly-quantity", {
      params: { customerId, orgId, inventoryId },
    }),

  getExceptionDetails: (inventoryId: number) =>
    apiClient.get<any[]>("/SalesPlan/exception-details", {
      params: { inventoryId },
    }),

  getAllBins: (region: string) =>
    apiClient.get<any[]>("/SalesPlan/bins", {
      params: { region },
    }),

  createBinRecord: async (
    payload: CreateBinRecordDto,
    createdBy?: string | null
  ): Promise<any> => {
    try {
      const requestPayload = {
        ...payload,
        createdBy: createdBy ?? payload.createdBy,
        lastUpdateBy: createdBy ?? payload.lastUpdateBy,
      }
      const response = await apiClient.post("/SalesPlan/bin", requestPayload)
      return response.data
    } catch (error) {
      throw error
    }
  },

  getPendingRepBins: () =>
    apiClient.get<any[]>("/SalesPlan/pending-replenishment-bins"),

  approveBinRecord: (payload: { repId: number; approvedBy: string }) =>
    apiClient.post("/SalesPlan/approve-bin", payload),

  deleteBinMasterData: (payload: { REP_ID: number; reason: string }) =>
    apiClient.delete("/SalesPlan/bin-master", { data: payload }),

  insertBinData: async (payload: SalesPlanWeekLineRequest[]): Promise<any> => {
    try {
      const response = await apiClient.post(
        "/SalesPlan/insert-bin-data",
        payload
      )
      return response.data
    } catch (error) {
      throw error
    }
  },

  updateBinData: async (payload: {
    binLineId: number
    targetMonth: string | null
    emergencyFlag: number | null
    compProductFlag: string | null
  }): Promise<any> => {
    try {
      if (payload?.targetMonth === null) {
        toast.error("Target Month cannot be null. Please select a value.")
        return
      }

      if (payload?.compProductFlag === null) {
        toast.error("Comp Product Flag cannot be null. Please select a value.")
        return
      }

      if (payload?.emergencyFlag === null) {
        toast.error("Emergency Flag cannot be null. Please select a value.")
        return
      }

      const response = await apiClient.put("/SalesPlan/bin-data", {
        binLineId: payload.binLineId,
        targetMonth: payload.targetMonth,
        emergencyFlag: payload.emergencyFlag,
        compProductFlag: payload.compProductFlag,
      })
      return response.data
    } catch (error) {
      throw error
    }
  },
  updateRepBinData: async (payload: {
    binQty: number
    repId: string
    updatedBy?: string | null
  }): Promise<any> => {
    try {
      const response = await apiClient.put("/SalesPlan/rep-bin-data", null, {
        params: {
          binQty: payload.binQty,
          repId: payload.repId,
          updatedBy: payload.updatedBy,
        },
      })
      return response.data
    } catch (error) {
      throw error
    }
  },

  getAllBinsWithRegion: (region: string) =>
    apiClient.get<any[]>("/SalesPlan/bins-with-region", {
      params: { region },
    }),

  getCustomerReplenishmentBins: (regionStr: string) =>
    apiClient.get<any[]>("/SalesPlan/customer-replenishment-bin", {
      params: { regionStr },
    }),

  getInventoryItemDetails: (search?: string) =>
    apiClient.get<InventoryItemDto>("/SalesPlan/inventory-items", {
      params: { search },
    }),

  getOrgIdByInventoryIdAndOuId: (inventoryId: number, region: string) =>
    apiClient.get<OrganizationDto>("/SalesPlan/org-by-inventory-and-ou", {
      params: { inventoryId, region },
    }),

  getAllRegionDetails: () =>
    apiClient.get<RegionDetailsDto[]>("/SalesPlan/regions"),
}
