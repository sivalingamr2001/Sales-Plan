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
  ) => {
    const isOrderId = orderedItem && !Number.isNaN(Number(orderedItem))
    const inputParams: Record<string, any> = {
      parentRegion: parentRegion || "%",
    }

    let queryNumber = 2
    if (isOrderId) {
      queryNumber = 1
      inputParams.ordId = Number(orderedItem)
    } else {
      inputParams.custName = customerName || ""
      if (orderedItem) {
        inputParams.itemNo = orderedItem
      }
    }

    return apiClient
      .post<any>("/SalesPlan/execute-query", {
        QueryNumber: queryNumber,
        InputParameters: inputParams,
        EnableServerSideFiltering: false,
        Count: 100000,
        PageNumber: 1,
      })
      .then((res) => ({ ...res, data: res.data.data as SalesPlan[] }))
  },

  getSalesPlansConsolidated: () =>
    apiClient
      .post<any>("/SalesPlan/execute-query", {
        QueryNumber: 3,
        InputParameters: {},
        EnableServerSideFiltering: false,
        Count: 100000,
        PageNumber: 1,
      })
      .then((res) => ({ ...res, data: res.data.data as SalesPlanConsolidatedData[] })),

  getSalesPlansBreakdown: (orderedItem?: string) =>
    apiClient
      .post<any>("/SalesPlan/execute-query", {
        QueryNumber: 4,
        InputParameters: {
          OrderedItem: orderedItem || "",
        },
        EnableServerSideFiltering: false,
        Count: 100000,
        PageNumber: 1,
      })
      .then((res) => ({ ...res, data: res.data.data as SalesPlanBrkUp[] })),

  getSalesPlansFullBreakdown: () =>
    apiClient
      .post<any>("/SalesPlan/execute-query", {
        QueryNumber: 10,
        InputParameters: {},
        EnableServerSideFiltering: false,
        Count: 100000,
        PageNumber: 1,
      })
      .then((res) => ({ ...res, data: res.data.data as SalesPlanBrkUp[] })),

  getBinRsvHoPendingList: () =>
    apiClient
      .post<any>("/SalesPlan/execute-query", {
        QueryNumber: 13,
        InputParameters: {},
        EnableServerSideFiltering: false,
        Count: 100000,
        PageNumber: 1,
      })
      .then((res) => ({ ...res, data: res.data.data as SalesPlanBrkUp[] })),

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
    apiClient
      .post<any>("/SalesPlan/execute-query", {
        QueryNumber: 28,
        InputParameters: {
          CustomerId: customerId,
          OrgId: orgId,
          InventoryId: inventoryId,
        },
        EnableServerSideFiltering: false,
        Count: 100000,
        PageNumber: 1,
      })
      .then((res) => ({ ...res, data: res.data.data as MonthlySalesQuantity[] })),

  getExceptionDetails: (inventoryId: number) =>
    apiClient
      .post<any>("/SalesPlan/execute-query", {
        QueryNumber: 12,
        InputParameters: {
          InventoryId: inventoryId,
        },
        EnableServerSideFiltering: false,
        Count: 100000,
        PageNumber: 1,
      })
      .then((res) => ({ ...res, data: res.data.data as any[] })),

  getAllBins: (region: string) =>
    apiClient
      .post<any>("/SalesPlan/execute-query", {
        QueryNumber: 16,
        InputParameters: {
          IsHO: region === "HO" ? 1 : 0,
          Region: region,
          UseSubRegion: false,
        },
        EnableServerSideFiltering: false,
        Count: 100000,
        PageNumber: 1,
      })
      .then((res) => ({ ...res, data: res.data.data as any[] })),

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
    apiClient
      .post<any>("/SalesPlan/execute-query", {
        QueryNumber: 22,
        InputParameters: {},
        EnableServerSideFiltering: false,
        Count: 100000,
        PageNumber: 1,
      })
      .then((res) => ({ ...res, data: res.data.data as any[] })),

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
    apiClient
      .post<any>("/SalesPlan/execute-query", {
        QueryNumber: 16,
        InputParameters: {
          IsHO: region === "HO" ? 1 : 0,
          Region: region,
          UseSubRegion: true,
        },
        EnableServerSideFiltering: false,
        Count: 100000,
        PageNumber: 1,
      })
      .then((res) => ({ ...res, data: res.data.data as any[] })),

  getCustomerReplenishmentBins: (regionStr: string) => {
    const regionsList = !regionStr
      ? []
      : regionStr.split(",").map((r: string) => r.trim())
    return apiClient
      .post<any>("/SalesPlan/execute-query", {
        QueryNumber: 17,
        InputParameters: {
          RegionHoCheck: regionStr === "HO" ? "HO" : "OTHER",
          Regions: regionsList,
        },
        EnableServerSideFiltering: false,
        Count: 100000,
        PageNumber: 1,
      })
      .then((res) => ({ ...res, data: res.data.data as any[] }))
  },

  getInventoryItemDetails: (search?: string) =>
    apiClient
      .post<any>("/SalesPlan/execute-query", {
        QueryNumber: 18,
        InputParameters: {
          Search: search || "",
        },
        EnableServerSideFiltering: false,
        Count: 100,
        PageNumber: 1,
      })
      .then((res) => ({ ...res, data: res.data.data as InventoryItemDto[] })),

  getOrgIdByInventoryIdAndOuId: (inventoryId: number, region: string) =>
    apiClient
      .post<any>("/SalesPlan/execute-query", {
        QueryNumber: 20,
        InputParameters: {
          InventoryId: inventoryId,
          Region: region,
        },
        EnableServerSideFiltering: false,
        Count: 1,
        PageNumber: 1,
      })
      .then((res) => {
        const list = res.data.data as OrganizationDto[]
        return {
          ...res,
          data: list && list.length > 0 ? list[0] : (null as any),
        }
      }),

  getAllRegionDetails: () =>
    apiClient
      .post<any>("/SalesPlan/execute-query", {
        QueryNumber: 15,
        InputParameters: {},
        EnableServerSideFiltering: false,
        Count: 100000,
        PageNumber: 1,
      })
      .then((res) => ({ ...res, data: res.data.data as RegionDetailsDto[] })),
}
