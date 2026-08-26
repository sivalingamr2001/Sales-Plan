import { salesPlanApi } from "@/api/salePlanApi"
import { useColumns } from "@/components/column"
import DynamicTable from "@/components/DynamicTable"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useAuth } from "@/context/AuthContext"
import { useSalesPlanDashboard } from "@/hooks/useSalesPlanDashboard"
import {
  ArrowLeft,
  CheckCircle2,
  Database,
  Edit2,
  Eye,
  FileCheck,
  Layers,
  Loader2,
  Package,
  Plus,
  Search,
  Trash2
} from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { createPortal } from "react-dom"
import { CartesianGrid, LabelList, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { toast } from "sonner"

export const DashboardPage = () => {
  const { currentRegion, currentUserRole, currentUser } = useAuth()
  const s = useSalesPlanDashboard()
  const cols = useColumns()

  const canViewPendingBin = currentRegion?.region === "HO" && currentUserRole !== "user"
  const [filterMode, setFilterMode] = useState<"ORDER" | "BIN MASTER" | "BIN SP" | "SP BIN PEND">("ORDER")

  // Sub-views inside ORDER tab (one table at a time)
  // "CONSOLIDATED" (default summary)
  // "DETAILS" (search results details grid)
  // "BREAKUP" (breakup for selected consolidated item)
  // "FULL_BREAKUP" (full breakup trace)
  const [orderView, setOrderView] = useState<"CONSOLIDATED" | "DETAILS" | "BREAKUP" | "FULL_BREAKUP">("CONSOLIDATED")
  const [selectedOrderItem, setSelectedOrderItem] = useState<string>("")

  // Filter slot Portal element
  const [filterSlot, setFilterSlot] = useState<HTMLElement | null>(null)

  // Bin Master sub-view: whether to show approval pending replenishment bins
  const [showPendingBins, setShowPendingBins] = useState(false)

  // Grid APIs for capturing selections
  const [orderGridApi, setOrderGridApi] = useState<any>(null)

  // Creation Modal state for Bins
  const [isModalOpen, setIsModalOpen] = useState(false)

  // Dialog States and Helpers
  const [mode, setMode] = useState<"create" | "edit">("create")
  const [selectedRow, setSelectedRow] = useState<any>(null)
  const [submitting, setSubmitting] = useState(false)
  const [itemSearchLoading, setItemSearchLoading] = useState(false)
  const [showItemOptions, setShowItemOptions] = useState(false)
  const [itemSearchResults, setItemSearchResults] = useState<any[]>([])
  const [organizationOptions, setOrganizationOptions] = useState<any[]>([])
  const [itemOrganization, setItemOrganization] = useState<any>(null)
  const [showCustomerOptions, setShowCustomerOptions] = useState(false)
  const customerSearchLoading = false
  const [trendYears, setTrendYears] = useState("")
  const [monthlySales, setMonthlySales] = useState<any[]>([])
  const [monthlySalesLoading, setMonthlySalesLoading] = useState(false)
  const [ahoAverage, setAhoAverage] = useState<number | string>(0)

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteRow, setDeleteRow] = useState<any>(null)
  const [deleteReason, setDeleteReason] = useState("")

  const [duplicateDialogOpen, setDuplicateDialogOpen] = useState(false)
  const [duplicatePayload, setDuplicatePayload] = useState<any>(null)

  const regionOptions = ["SOUTH", "NORTH", "EAST", "WEST", "HO"]
  const binOptions = ["CHENNAI WH", "DELHI WH", "KOLKATA WH", "MUMBAI WH"]
  const fixedLocationOrganizations: Record<string, any[]> = {
    "CHENNAI WH": [{ OrganizationId: 81, Organization: "MDU" }],
    "DELHI WH": [{ OrganizationId: 82, Organization: "DEL" }],
    "KOLKATA WH": [{ OrganizationId: 83, Organization: "CAL" }],
    "MUMBAI WH": [{ OrganizationId: 84, Organization: "BOM" }]
  }

  const getLocationForOrganization = (org: any) => {
    if (!org) return ""
    if (org.Organization === "MDU") return "CHENNAI WH"
    if (org.Organization === "DEL") return "DELHI WH"
    if (org.Organization === "CAL") return "KOLKATA WH"
    if (org.Organization === "BOM") return "MUMBAI WH"
    return ""
  }

  const formatTrendMonth = (mon: string) => {
    if (!mon) return ""
    return mon
  }

  const [form, setForm] = useState({
    REP_ID: 0,
    ITEM_NO: "",
    DESCRIPTION: "",
    ORG: "",
    ORGANIZATION_ID: null as number | null,
    INVENTORY_ITEM_ID: null as number | null,
    BIN_LOCATION: "",
    CUSTOMER_NAME: "",
    CUSTOMER_ID: null as number | null,
    REGION: "",
    BIN_CATEGORY: "",
    ROQ: 0,
    STOCK_TYPE: "FG",
  })

  // Resolve Portal element target
  useEffect(() => {
    setFilterSlot(document.getElementById("sales-plan-filter-slot"))
  }, [])

  // Sync data loading with tabs and views
  useEffect(() => {
    if (filterMode === "BIN SP") {
      s.loadRepBinData() // Load standard replenishment bins
    } else if (filterMode === "BIN MASTER") {
      if (showPendingBins) {
        s.loadPendingRepBinData()
      } else {
        s.loadRepBinData()
      }
    } else if (filterMode === "SP BIN PEND") {
      s.loadBinRsvHoPendingData()
    }
  }, [filterMode, showPendingBins])

  // Load full breakup tracing if view is active
  useEffect(() => {
    if (orderView === "FULL_BREAKUP") {
      s.fetchFullBreakdownDetails()
    }
  }, [orderView])


  // Item Autocomplete search for dialog form
  useEffect(() => {
    if (form.ITEM_NO && !form.INVENTORY_ITEM_ID && form.ITEM_NO.trim().length >= 2) {
      setItemSearchLoading(true)
      salesPlanApi.getInventoryItemDetails(form.ITEM_NO)
        .then((res: any) => {
          const items = res.data || []
          setItemSearchResults(items.map((it: any) => ({
            ItemName: it.ITEM_NO,
            Description: it.DESCRIPTION,
            Organization: it.ORG || "",
            OrganizationId: it.ORGANIZATION_ID || null,
            InventoryItemId: it.INVENTORY_ITEM_ID
          })))
        })
        .catch((err) => console.error("Error searching items:", err))
        .finally(() => setItemSearchLoading(false))
    } else {
      setItemSearchResults([])
    }
  }, [form.ITEM_NO, form.INVENTORY_ITEM_ID])

  // Filtered customers for customer autocomplete in dialog form
  const filteredCustomers = useMemo(() => {
    if (!form.CUSTOMER_NAME) return s.customerList
    const query = form.CUSTOMER_NAME.toLowerCase()
    return s.customerList.filter((c: any) =>
      c.CUSTOMER_NAME.toLowerCase().includes(query)
    )
  }, [form.CUSTOMER_NAME, s.customerList])

  // Load monthly trend history statistics chart inside Create/Edit Dialog modal
  useEffect(() => {
    if (form.CUSTOMER_ID && form.INVENTORY_ITEM_ID && form.ORGANIZATION_ID) {
      setMonthlySalesLoading(true)
      salesPlanApi.getMonthlyQuantity(
        form.CUSTOMER_ID,
        form.ORGANIZATION_ID,
        form.INVENTORY_ITEM_ID
      )
      .then((res: any) => {
        const salesData = res.data || []
        setMonthlySales(salesData)
        if (salesData.length > 0) {
          const total = salesData.reduce((sum: number, entry: any) => sum + (Number(entry.SALES) || 0), 0)
          const avg = (total / salesData.length).toFixed(1)
          setAhoAverage(avg)
          const firstMonth = salesData[0]?.MONTH || ""
          const lastMonth = salesData[salesData.length - 1]?.MONTH || ""
          setTrendYears(`${firstMonth} - ${lastMonth}`)
        } else {
          setAhoAverage(0)
          setTrendYears("")
        }
      })
      .catch((err) => {
        console.error("Failed to load monthly sales trend:", err)
        setMonthlySales([])
        setAhoAverage(0)
        setTrendYears("")
      })
      .finally(() => setMonthlySalesLoading(false))
    } else {
      setMonthlySales([])
      setAhoAverage(0)
      setTrendYears("")
    }
  }, [form.CUSTOMER_ID, form.INVENTORY_ITEM_ID, form.ORGANIZATION_ID])

  const handleClearForm = () => {
    setForm({
      REP_ID: 0,
      ITEM_NO: "",
      DESCRIPTION: "",
      ORG: "",
      ORGANIZATION_ID: null,
      INVENTORY_ITEM_ID: null,
      BIN_LOCATION: "",
      CUSTOMER_NAME: "",
      CUSTOMER_ID: null,
      REGION: "",
      BIN_CATEGORY: "",
      ROQ: 0,
      STOCK_TYPE: "FG",
    })
    setOrganizationOptions([])
    setItemOrganization(null)
  }

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e && e.preventDefault) e.preventDefault()
    if (!form.INVENTORY_ITEM_ID || !form.ORGANIZATION_ID || !form.CUSTOMER_ID) {
      toast.error("Please fill in all required fields.")
      return
    }

    setSubmitting(true)
    try {
      if (mode === "create") {
        const payload = {
          customerId: form.CUSTOMER_ID,
          custName: form.CUSTOMER_NAME,
          organizationId: form.ORGANIZATION_ID,
          org: form.ORG,
          inventoryItemId: form.INVENTORY_ITEM_ID,
          itemNo: form.ITEM_NO,
          description: form.DESCRIPTION,
          tbrQty: form.ROQ,
          binCat: form.BIN_CATEGORY,
          stockType: form.STOCK_TYPE,
          binLocation: form.BIN_LOCATION,
          region: form.REGION || s.subRegionStr || s.activeRegion,
        }

        try {
          await salesPlanApi.createBinRecord(payload as any, currentUser?.username)
          toast.success("Replenishment bin created successfully.")
          setIsModalOpen(false)
          handleClearForm()
          s.loadRepBinData()
        } catch (err: any) {
          if (err.response?.status === 409 || err.response?.data?.message?.includes("already exists")) {
            setDuplicatePayload(form)
            setDuplicateDialogOpen(true)
          } else {
            throw err
          }
        }
      } else {
        // Edit mode (updating ROQ)
        await s.updateRepBinRecord({
          REP_ID: form.REP_ID,
          ROQ: form.ROQ
        } as any)
        toast.success("Replenishment bin updated.")
        setIsModalOpen(false)
        handleClearForm()
        s.loadRepBinData()
      }
    } catch (err: any) {
      console.error(err)
      toast.error(err.response?.data?.message || "Failed to submit bin record.")
    } finally {
      setSubmitting(false)
    }
  }

  const handleConfirmDelete = async () => {
    if (!deleteRow) return
    setDeleting(true)
    try {
      await salesPlanApi.deleteBinMasterData({
        REP_ID: deleteRow.REP_ID,
        reason: deleteReason
      })
      toast.success("Replenishment bin deleted successfully.")
      setDeleteDialogOpen(false)
      setDeleteRow(null)
      setDeleteReason("")
      if (showPendingBins) {
        s.loadPendingRepBinData()
      } else {
        s.loadRepBinData()
      }
    } catch (err) {
      console.error(err)
      toast.error("Failed to delete replenishment bin.")
    } finally {
      setDeleting(false)
    }
  }



  // Handle Search submit: queries data and changes subview to DETAILS
  const handleQuerySubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const customerQuery = s.selectedCustomer.trim()
    const itemQuery = s.orderedItemInput.trim()

    if (!customerQuery && !itemQuery) {
      toast.error("Please select a customer or enter an item code.")
      return
    }

    await s.handleSalesPlanQuerySubmit(e)
    setOrderView("DETAILS")
  }

  // Action: Save Sales Plan Orders from Selected rows in detail grid
  const handleSaveOrders = async () => {
    if (!orderGridApi) return
    const selectedRows = orderGridApi.getSelectedRows()
    if (selectedRows.length === 0) {
      toast.error("Please select at least one row in the orders table.")
      return
    }
    await s.saveSalesPlanOrders(selectedRows)
  }

  // Action: Approve Replenishment Bin
  const handleApproveBin = async (row: any) => {
    try {
      await s.approveRepBinRecord(row)
      toast.success("Replenishment bin approved.")
      await s.loadPendingRepBinData()
    } catch (err) {
      toast.error("Failed to approve replenishment bin.")
    }
  }


  // Action: Trigger edit modal dialog for updating replenishment bin
  const handleUpdateBinQty = (row: any) => {
    setMode("edit")
    setSelectedRow(row)
    setForm({
      REP_ID: row.REP_ID,
      ITEM_NO: row.ITEM_NO || "",
      DESCRIPTION: row.DESCRIPTION || "",
      ORG: row.ORG || "",
      ORGANIZATION_ID: row.ORGANIZATION_ID || null,
      INVENTORY_ITEM_ID: row.INVENTORY_ITEM_ID || null,
      BIN_LOCATION: row.BIN_LOCATION || "",
      CUSTOMER_NAME: row.CUSTOMER_NAME || "",
      CUSTOMER_ID: row.CUSTOMER_ID || null,
      REGION: row.REGION || "",
      BIN_CATEGORY: row.BIN_CATEGORY || "",
      ROQ: row.ROQ || 0,
      STOCK_TYPE: row.STOCK_TYPE || "FG"
    })
    if (row.ORGANIZATION_ID) {
      setOrganizationOptions([{ OrganizationId: row.ORGANIZATION_ID, Organization: row.ORG }])
      setItemOrganization({ OrganizationId: row.ORGANIZATION_ID, Organization: row.ORG })
    }
    setIsModalOpen(true)
  }

  // Action: Trigger delete confirmation modal dialog
  const handleDeleteBinMaster = (row: any) => {
    setDeleteRow(row)
    setDeleteReason("")
    setDeleteDialogOpen(true)
  }

  return (
    <div className="flex h-full flex-col bg-slate-50">
      {filterSlot && createPortal(
        <div className="flex bg-slate-100 p-0.5 rounded-lg gap-0.5 shrink-0">
          <button
            onClick={() => {
              setFilterMode("ORDER")
              setOrderView("CONSOLIDATED")
            }}
            className={`flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold transition-all ${filterMode === "ORDER"
              ? "bg-white text-blue-600 shadow-sm"
              : "text-slate-600 hover:text-slate-900"
              }`}
          >
            <Layers className="h-3 w-3" />
            ORDER
          </button>
          <button
            onClick={() => setFilterMode("BIN MASTER")}
            className={`flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold transition-all ${filterMode === "BIN MASTER"
              ? "bg-white text-blue-600 shadow-sm"
              : "text-slate-600 hover:text-slate-900"
              }`}
          >
            <Database className="h-3 w-3" />
            BIN MASTER
          </button>
          <button
            onClick={() => setFilterMode("BIN SP")}
            className={`flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold transition-all ${filterMode === "BIN SP"
              ? "bg-white text-blue-600 shadow-sm"
              : "text-slate-600 hover:text-slate-900"
              }`}
          >
            <Package className="h-3 w-3" />
            BIN SP
          </button>
          {canViewPendingBin && (
            <button
              onClick={() => setFilterMode("SP BIN PEND")}
              className={`flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold transition-all ${filterMode === "SP BIN PEND"
                ? "bg-white text-blue-600 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
                }`}
            >
              <CheckCircle2 className="h-3 w-3" />
              SP BIN PEND
            </button>
          )}
        </div>,
        filterSlot
      )}

      {/* Filter and Query section inside dashboard for ORDER tab */}
      {filterMode === "ORDER" && orderView === "CONSOLIDATED" && (
        <section className="bg-white border-b border-slate-200 px-6 py-3 shadow-sm">
          <form onSubmit={handleQuerySubmit} className="flex flex-wrap gap-3 items-center">
            <div className="flex flex-col gap-1 min-w-[180px]">
              <label className="text-[10px] font-bold text-slate-400 uppercase">Sub Region</label>
              <select
                value={s.selectedSubRegion}
                onChange={(e) => s.setSelectedSubRegion(e.target.value)}
                className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium outline-none focus:border-blue-500 focus:bg-white"
              >
                <option value="">Select Sub-Region</option>
                <option value="SOUTH">SOUTH</option>
                <option value="NORTH">NORTH</option>
                <option value="EAST">EAST</option>
                <option value="WEST">WEST</option>
              </select>
            </div>

            <div className="flex flex-col gap-1 min-w-[200px]">
              <label className="text-[10px] font-bold text-slate-400 uppercase">Customer</label>
              <select
                value={s.selectedCustomer}
                onChange={(e) => s.setSelectedCustomer(e.target.value)}
                disabled={!s.selectedSubRegion || s.loadingCustomers}
                className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium outline-none focus:border-blue-500 focus:bg-white disabled:opacity-50"
              >
                <option value="">All Customers</option>
                {s.customerList.map((cust) => (
                  <option key={cust.CUSTOMER_ID} value={cust.CUSTOMER_NAME}>
                    {cust.CUSTOMER_NAME}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1 min-w-[200px]">
              <label className="text-[10px] font-bold text-slate-400 uppercase">Ordered Item / Order No</label>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Enter code or number"
                  value={s.orderedItemInput}
                  onChange={(e) => s.setOrderedItemInput(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 pl-8 pr-3 py-1.5 text-xs font-medium outline-none focus:border-blue-500 focus:bg-white"
                />
              </div>
            </div>

            <div className="flex items-center gap-2 mt-4">
              <input
                type="checkbox"
                id="includeBinCheck"
                checked={s.includeBin}
                onChange={(e) => s.setIncludeBin(e.target.checked)}
                className="rounded text-blue-600 focus:ring-blue-500 h-4 w-4 border-slate-300"
              />
              <label htmlFor="includeBinCheck" className="text-xs font-semibold text-slate-600 cursor-pointer">
                Include Bin SP Data
              </label>
            </div>

            <button
              type="submit"
              disabled={s.loadingConsolidated}
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs px-4 py-2 rounded-lg mt-4 shadow-sm flex items-center gap-1.5 transition-all disabled:opacity-50"
            >
              Query Plan
            </button>
          </form>
        </section>
      )}

      {/* Main Grid Workspace */}
      <main className="flex-1 min-h-0 overflow-hidden p-0">
        {filterMode === "ORDER" && (
          <div className="h-full flex flex-col bg-white rounded-none border border-slate-200 overflow-hidden shadow-sm">
            {/* View navigation headers */}
            <div className="px-4 py-2.5 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
              <div className="flex items-center gap-3">
                {orderView !== "CONSOLIDATED" && (
                  <button
                    onClick={() => {
                      setOrderView("CONSOLIDATED")
                    }}
                    className="p-1 text-slate-600 hover:bg-slate-200 rounded-md transition-colors flex items-center gap-1 font-semibold text-xs"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Back
                  </button>
                )}
                <span className="text-xs font-bold text-slate-600 uppercase flex items-center gap-1.5">
                  <Layers className="h-4 w-4 text-slate-500" />
                  {orderView === "CONSOLIDATED" && "Consolidated Overview Summary"}
                  {orderView === "DETAILS" && "Detailed Sales Plan Orders"}
                  {orderView === "BREAKUP" && `Breakup details for item: ${selectedOrderItem}`}
                  {orderView === "FULL_BREAKUP" && "Full Trace Breakdown Overview"}
                </span>
              </div>

              {orderView === "CONSOLIDATED" && (
                <button
                  onClick={() => setOrderView("FULL_BREAKUP")}
                  className="bg-slate-700 hover:bg-slate-800 text-white font-semibold text-[10px] uppercase px-3 py-1.5 rounded-lg shadow-sm transition-all flex items-center gap-1"
                >
                  <Eye className="h-3.5 w-3.5" />
                  Full Breakup View
                </button>
              )}

              {orderView === "DETAILS" && (
                <button
                  onClick={handleSaveOrders}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs px-3 py-1 rounded-md shadow-sm transition-all flex items-center gap-1"
                >
                  <FileCheck className="h-3.5 w-3.5" />
                  Save Sales Plan
                </button>
              )}
            </div>

            {/* Grid displaying single table at a time */}
            <div className="flex-1 min-h-0">
              {orderView === "CONSOLIDATED" && (
                <DynamicTable
                  rowData={s.consolidatedData}
                  columnDefs={cols.consolidatedColumns}
                  isLoading={s.loadingConsolidated}
                  density="compact"
                  onRowClicked={(event) => {
                    if (event.data?.ORDER_ITEM) {
                      setSelectedOrderItem(event.data.ORDER_ITEM)
                      s.onConsolidatedRowClick(event.data.ORDER_ITEM)
                      setOrderView("BREAKUP")
                    }
                  }}
                  rowSelection={{ mode: "singleRow" }}
                />
              )}

              {orderView === "DETAILS" && (
                <DynamicTable
                  rowData={s.salesPlanData}
                  columnDefs={cols.salesPlanColumns}
                  isLoading={s.loadingSalesPlans}
                  onGridReady={(api) => setOrderGridApi(api)}
                  density="standard"
                />
              )}

              {orderView === "BREAKUP" && (
                <DynamicTable
                  rowData={s.breakupData}
                  columnDefs={cols.breakupColumns}
                  isLoading={s.loadingBreakup}
                  density="standard"
                />
              )}

              {orderView === "FULL_BREAKUP" && (
                <DynamicTable
                  rowData={s.fullBreakupData}
                  columnDefs={cols.breakupColumns}
                  isLoading={s.loadingFullBreakup}
                  density="standard"
                />
              )}
            </div>
          </div>
        )}

        {filterMode === "BIN MASTER" && (
          <div className="h-full bg-white rounded-none border border-slate-200 overflow-hidden shadow-sm flex flex-col">
            <div className="px-4 py-2.5 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
              <span className="text-xs font-bold text-slate-600 uppercase flex items-center gap-1.5">
                <Database className="h-4 w-4 text-slate-500" />
                {showPendingBins ? "Approval Pending Replenishment Bins" : "Active Replenishment Bins"}
              </span>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => setShowPendingBins((p) => !p)}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm transition-all"
                >
                  {showPendingBins ? "Show Active Bins" : "Show Pending Bins"}
                </button>
                <button
                  onClick={() => {
                    setMode("create")
                    handleClearForm()
                    setIsModalOpen(true)
                  }}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs px-3 py-1.5 rounded-lg shadow-sm transition-all flex items-center gap-1"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Create New Bin
                </button>
              </div>
            </div>

            <div className="flex-1 min-h-0">
              <DynamicTable
                rowData={s.repBinData}
                columnDefs={[
                  ...cols.binColumns,
                  {
                    headerName: "Actions",
                    width: 140,
                    pinned: "right",
                    cellRenderer: (params: any) => {
                      return (
                        <div className="flex items-center gap-2 h-full">
                          {showPendingBins ? (
                            <button
                              onClick={() => handleApproveBin(params.data)}
                              title="Approve Bin"
                              className="p-1 text-emerald-600 hover:bg-emerald-50 rounded"
                            >
                              <CheckCircle2 className="h-4 w-4" />
                            </button>
                          ) : (
                            <button
                              onClick={() => {
                                setMode("edit")
                                setSelectedRow(params.data)
                                setForm({
                                  REP_ID: params.data.REP_ID,
                                  ITEM_NO: params.data.ITEM_NO || "",
                                  DESCRIPTION: params.data.DESCRIPTION || "",
                                  ORG: params.data.ORG || "",
                                  ORGANIZATION_ID: params.data.ORGANIZATION_ID || null,
                                  INVENTORY_ITEM_ID: params.data.INVENTORY_ITEM_ID || null,
                                  BIN_LOCATION: params.data.BIN_LOCATION || "",
                                  CUSTOMER_NAME: params.data.CUSTOMER_NAME || "",
                                  CUSTOMER_ID: params.data.CUSTOMER_ID || null,
                                  REGION: params.data.REGION || "",
                                  BIN_CATEGORY: params.data.BIN_CATEGORY || "",
                                  ROQ: params.data.ROQ || 0,
                                  STOCK_TYPE: params.data.STOCK_TYPE || "FG"
                                })
                                if (params.data.ORGANIZATION_ID) {
                                  setOrganizationOptions([{ OrganizationId: params.data.ORGANIZATION_ID, Organization: params.data.ORG }])
                                  setItemOrganization({ OrganizationId: params.data.ORGANIZATION_ID, Organization: params.data.ORG })
                                }
                                setIsModalOpen(true)
                              }}
                              title="Update Qty"
                              className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                            >
                              <FileCheck className="h-4 w-4" />
                            </button>
                          )}
                          <button
                            onClick={() => {
                              setDeleteRow(params.data)
                              setDeleteReason("")
                              setDeleteDialogOpen(true)
                            }}
                            title="Delete Master Bin"
                            className="p-1 text-red-600 hover:bg-red-50 rounded"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      )
                    }
                  }
                ]}
                isLoading={s.loadingBin}
              />
            </div>
          </div>
        )}

        {filterMode === "BIN SP" && (
          <div className="h-full bg-white rounded-none border border-slate-200 overflow-hidden shadow-sm flex flex-col">
            <div className="px-4 py-2.5 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
              <span className="text-xs font-bold text-slate-600 uppercase flex items-center gap-1.5">
                <Package className="h-4 w-4 text-slate-500" />
                BIN SP Replenishment Updating
              </span>
            </div>
            <div className="flex-1 min-h-0">
              <DynamicTable
                rowData={s.repBinData}
                columnDefs={[
                  ...cols.binColumns,
                  {
                    headerName: "Actions",
                    width: 100,
                    pinned: "right",
                    cellRenderer: (params: any) => {
                      return (
                        <div className="flex items-center justify-center h-full">
                          <button
                            onClick={() => handleUpdateBinQty(params.data)}
                            title="Edit Row Data"
                            className="p-1 text-blue-600 hover:bg-blue-50 rounded flex items-center gap-1 text-xs font-semibold"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                            Edit
                          </button>
                        </div>
                      )
                    }
                  }
                ]}
                isLoading={s.loadingBin}
              />
            </div>
          </div>
        )}

        {filterMode === "SP BIN PEND" && (
          <div className="h-full bg-white rounded-none border border-slate-200 overflow-hidden shadow-sm flex flex-col">
            <div className="px-4 py-2.5 border-b border-slate-100 bg-slate-50">
              <span className="text-xs font-bold text-slate-600 uppercase flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-orange-500" />
                SP BIN PEND - Pending HO BIN RSV Rows
              </span>
            </div>
            <div className="flex-1 min-h-0">
              <DynamicTable
                rowData={s.binRsvHoPendingData}
                columnDefs={cols.pendBinColumn}
                isLoading={s.loadingBin}
              />
            </div>
          </div>
        )}
      </main>

      {/* Creation modal for replenishment bin (includes Recharts monthly quantity chart) */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
            <DialogContent className="max-h-[calc(100vh-2rem)] content-start overflow-hidden sm:max-w-200">
              <DialogHeader className="flex-row items-start justify-between gap-4">
                <div className="min-w-0">
                  <DialogTitle>
                    {mode === "create" ? "Create" : "Update"}
                  </DialogTitle>
                  <DialogDescription>
                    {mode === "create"
                      ? "Create a new bin record for a customer and item combination"
                      : "Update the ROQ for the selected bin record"}
                    <span className="ml-1 inline font-semibold text-blue-900">
                      {selectedRow?.ITEM_NO}
                    </span>
                  </DialogDescription>
                </div>
                <div className="flex shrink-0 items-center gap-2 pt-0.5">
                  <Button
                    variant="outline"
                    onClick={handleClearForm}
                    disabled={submitting}
                  >
                    Clear
                  </Button>
                  <Button onClick={handleSubmit} disabled={submitting}>
                    {submitting
                      ? "Saving..."
                      : mode === "create"
                        ? "Create Rep Bin"
                        : "Save Changes"}
                  </Button>
                </div>
              </DialogHeader>

              <div className="grid gap-4 py-2 md:grid-cols-3">
                <div className="contents">
                  <div className="grid gap-2">
                    <Label htmlFor="item-no">Item No</Label>
                    <div className="relative">
                      <Input
                        id="item-no"
                        value={form.ITEM_NO}
                        onChange={(event) => {
                          setForm((prev) => ({
                            ...prev,
                            ITEM_NO: event.target.value,
                            INVENTORY_ITEM_ID: null,
                            ORGANIZATION_ID: null,
                            ORG: "",
                          }))
                          setOrganizationOptions([])
                          setItemOrganization(null)
                        }}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.preventDefault()
                            event.stopPropagation()
                          }
                        }}
                        onFocus={() => {
                          if (!form.INVENTORY_ITEM_ID) setShowItemOptions(true)
                        }}
                        placeholder="Search item by code"
                        disabled={mode === "edit" || itemSearchLoading}
                      />
                      {itemSearchLoading ? (
                        <div className="absolute inset-y-0 right-2 flex items-center text-slate-400">
                          <Loader2 className="h-4 w-4 animate-spin" />
                        </div>
                      ) : null}
                      {showItemOptions && itemSearchResults.length > 0 ? (
                        <div className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-md border border-slate-200 bg-white shadow-lg">
                          {itemSearchResults.map((item) => (
                            <button
                              key={`${item.InventoryItemId}-${item.OrganizationId}`}
                              type="button"
                              className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-slate-100"
                              onMouseDown={(event) => event.preventDefault()}
                              onClick={() => {
                                const selectedOrganization = item.OrganizationId
                                  ? {
                                    OrganizationId: item.OrganizationId,
                                    Organization: item.Organization,
                                  }
                                  : null
                                setOrganizationOptions(
                                  selectedOrganization ? [selectedOrganization] : []
                                )
                                setItemOrganization(selectedOrganization)
                                setForm((prev) => ({
                                  ...prev,
                                  ITEM_NO: item.ItemName,
                                  DESCRIPTION: item.Description,
                                  ORG: item.Organization,
                                  ORGANIZATION_ID: item.OrganizationId,
                                  INVENTORY_ITEM_ID: item.InventoryItemId,
                                  BIN_LOCATION:
                                    getLocationForOrganization(
                                      selectedOrganization
                                    ) || prev.BIN_LOCATION,
                                }))
                                setItemSearchResults([])
                                setShowItemOptions(false)
                              }}
                            >
                              <span className="flex-1">
                                <span className="block font-medium text-slate-800">
                                  {item.ItemName}
                                </span>
                                <span className="text-xs text-slate-500">
                                  {item.Description}
                                </span>
                              </span>
                              <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                                {item.Organization}
                              </span>
                            </button>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="organization">Organization</Label>
                    <select
                      id="organization"
                      value={form.ORGANIZATION_ID ?? ""}
                      onChange={(event) => {
                        const organizationId = Number(event.target.value)
                        const selectedOrg = organizationOptions.find(
                          (option) => option.OrganizationId === organizationId
                        )
                        setForm((prev) => ({
                          ...prev,
                          ORG: selectedOrg?.Organization ?? "",
                          ORGANIZATION_ID: selectedOrg?.OrganizationId ?? null,
                        }))
                      }}
                      className="h-7 w-full rounded-md border border-slate-300 bg-white px-2 text-sm text-slate-700 outline-none"
                      disabled={mode === "edit" || !organizationOptions.length}
                    >
                      <option value="">
                        {organizationOptions.length ? "Select organization" : ""}
                      </option>
                      {organizationOptions.map((option) => (
                        <option
                          key={option.OrganizationId}
                          value={option.OrganizationId}
                        >
                          {option.Organization}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="bin-location">Bin Location</Label>
                    <select
                      id="bin-location"
                      value={form.BIN_LOCATION || ""}
                      onChange={(event) => {
                        const location = event.target.value
                        const locationOrganizations =
                          fixedLocationOrganizations[location]
                        const selectedOrganization = locationOrganizations
                          ? locationOrganizations.length === 1
                            ? locationOrganizations[0]
                            : (locationOrganizations.find(
                              (organization) =>
                                organization.OrganizationId ===
                                itemOrganization?.OrganizationId
                            ) ?? null)
                          : null

                        setOrganizationOptions(locationOrganizations ?? [])
                        setForm((prev) => ({
                          ...prev,
                          BIN_LOCATION: location,
                          ORGANIZATION_ID:
                            selectedOrganization?.OrganizationId ?? null,
                          ORG: selectedOrganization?.Organization ?? "",
                        }))
                      }}
                      className="h-7 w-full rounded-md border border-slate-300 bg-white px-2 text-sm text-slate-700 outline-none"
                    >
                      <option value="">Select location</option>
                      {binOptions.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid gap-2 md:col-span-3">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={form.DESCRIPTION}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        DESCRIPTION: event.target.value,
                      }))
                    }
                    placeholder="Enter item description"
                    disabled
                  />
                </div>

                {/* <div className="grid gap-2">
              <Label htmlFor="bin-location">Bin Location</Label>
              <select
                id="bin-location"
                value={form.BIN_LOCATION || ""}
                onChange={(event) => {
                  const location = event.target.value
                  const locationOrganizations =
                    fixedLocationOrganizations[location]
                  const selectedOrganization = locationOrganizations
                    ? locationOrganizations.length === 1
                      ? locationOrganizations[0]
                      : locationOrganizations.find(
                        (organization) =>
                          organization.OrganizationId ===
                          itemOrganization?.OrganizationId
                      ) ?? null
                    : null

                  setOrganizationOptions(locationOrganizations ?? [])
                  setForm((prev) => ({
                    ...prev,
                    BIN_LOCATION: location,
                    ORGANIZATION_ID:
                      selectedOrganization?.OrganizationId ?? null,
                    ORG: selectedOrganization?.Organization ?? "",
                  }))
                }}
                className="h-7 w-full rounded-md border border-slate-300 bg-white px-2 text-sm text-slate-700 outline-none"
              >
                <option value="">Select location</option>
                {binOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div> */}

                <div className="grid gap-2">
                  <Label htmlFor="customer-name">Customer Name</Label>
                  <div className="relative">
                    <Input
                      id="customer-name"
                      value={form.CUSTOMER_NAME}
                      onChange={(event) =>
                        setForm((prev) => ({
                          ...prev,
                          CUSTOMER_NAME: event.target.value,
                          CUSTOMER_ID: null,
                          CUSTOMER_CATEGORY: "",
                          BIN_CATEGORY: "",
                        }))
                      }
                      onFocus={() => setShowCustomerOptions(true)}
                      onBlur={() =>
                        window.setTimeout(() => setShowCustomerOptions(false), 120)
                      }
                      placeholder="Search customer name"
                      disabled={mode === "edit"}
                    />
                    {customerSearchLoading ? (
                      <div className="absolute inset-y-0 right-2 flex items-center text-slate-400">
                        <Loader2 className="h-4 w-4 animate-spin" />
                      </div>
                    ) : null}
                    {showCustomerOptions && filteredCustomers.length > 0 ? (
                      <div className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-md border border-slate-200 bg-white shadow-lg">
                        {filteredCustomers.map((customer) => (
                          <button
                            key={customer.CUSTOMER_ID}
                            type="button"
                            className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-slate-100"
                            onMouseDown={(event) => event.preventDefault()}
                            onClick={() => {
                              setForm((prev) => ({
                                ...prev,
                                CUSTOMER_NAME: customer.CUSTOMER_NAME,
                                CUSTOMER_ID: customer.CUSTOMER_ID,
                                REGION: customer.REGION?.trim() || prev.REGION,
                                CUSTOMER_CATEGORY: customer.CUSTOMER_CATEGORY ?? "",
                                BIN_CATEGORY:
                                  customer.CUSTOMER_CLASS_CODE?.toUpperCase() ===
                                    "DEALER"
                                    ? "B4"
                                    : "B1",
                              }))
                              setShowCustomerOptions(false)
                            }}
                          >
                            <span className="font-medium text-slate-800">
                              {customer.CUSTOMER_NAME}
                            </span>
                          </button>
                        ))}
                      </div>
                    ) : null}
                    {showCustomerOptions &&
                      !customerSearchLoading &&
                      !filteredCustomers.length &&
                      form.CUSTOMER_NAME.trim() ? (
                      <div className="absolute z-20 mt-1 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-500 shadow-lg">
                        No customer found for this search.
                      </div>
                    ) : null}
                  </div>
                </div>

                <div className="contents">
                  <div className="grid gap-2">
                    <Label htmlFor="region">Region</Label>
                    <select
                      id="region"
                      value={form.REGION}
                      onChange={(event) =>
                        setForm((prev) => ({ ...prev, REGION: event.target.value }))
                      }
                      className="h-8 w-full rounded-md border border-slate-300 bg-white px-2 text-sm text-slate-700 outline-none"
                      disabled={mode === "edit"}
                    >
                      <option value="">
                        {regionOptions.length
                          ? "Select region"
                          : "No regions available"}
                      </option>
                      {regionOptions.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                    {/* {form.CUSTOMER_NAME && (
                  <div>
                    <span className="text-xs text-slate-500">
                      Customer category: {customerOptions.find((customer) => customer.CUSTOMER_ID === form.CUSTOMER_ID)?.CUSTOMER_CATEGORY ?? "Not available"}
                    </span>
                    <span className="text-xs text-slate-500">
                      Customer class code: {customerOptions.find((customer) => customer.CUSTOMER_ID === form.CUSTOMER_ID)?.CUSTOMER_CLASS_CODE ?? "Not available"}
                    </span>
                  </div>
                )} */}
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="bin-category">Bin Category</Label>
                    <select
                      id="bin-category"
                      value={form.BIN_CATEGORY}
                      onChange={(event) =>
                        setForm((prev) => ({
                          ...prev,
                          BIN_CATEGORY: event.target.value,
                        }))
                      }
                      className="h-8 w-full rounded-md border border-slate-300 bg-white px-2 text-sm text-slate-700 outline-none"
                      disabled
                    >
                      <option value="">Select Bin Category</option>
                      <option value="B1">B1</option>
                      <option value="B4">B4</option>
                    </select>
                  </div>
                </div>

                {form.CUSTOMER_ID ? (
                  <div className="col-span-full rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-800">
                          Customer sales trend {trendYears ? `(${trendYears})` : ""}
                        </p>
                        <p className="text-xs text-slate-500">
                          Last 12 months for {form.CUSTOMER_NAME}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-[11px] tracking-wide text-slate-500 uppercase">
                          Average
                        </p>
                        <p className="text-lg font-semibold text-blue-700">
                          {monthlySalesLoading ? "..." : ahoAverage}
                        </p>
                      </div>
                    </div>
                    <div className="h-28 w-full">
                      {monthlySalesLoading ? (
                        <div className="flex h-full items-center justify-center text-xs text-slate-500">
                          Loading monthly sales...
                        </div>
                      ) : monthlySales.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart
                            data={monthlySales.map((entry) => ({
                              month: formatTrendMonth(entry.MONTH),
                              sales: Number.isFinite(Number(entry.SALES))
                                ? Number(entry.SALES)
                                : 0,
                            }))}
                            margin={{ top: 4, right: 8, left: -24, bottom: 0 }}
                          >
                            <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" />
                            <XAxis
                              dataKey="month"
                              tick={{ fontSize: 10 }}
                              tickLine={false}
                            />
                            <YAxis
                              tick={{ fontSize: 10 }}
                              tickLine={false}
                              axisLine={false}
                            />
                            <Tooltip />
                            <Line
                              type="monotone"
                              dataKey="sales"
                              name="Sales"
                              stroke="#2563eb"
                              strokeWidth={2}
                              dot={{ r: 2, fill: "#2563eb" }}
                            >
                              <LabelList
                                dataKey="sales"
                                position="top"
                                offset={6}
                                fill="#334155"
                                fontSize={10}
                              />
                            </Line>
                          </LineChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="flex h-full items-center justify-center text-xs text-slate-500">
                          No monthly sales found.
                        </div>
                      )}
                    </div>
                  </div>
                ) : null}

                <div className="grid gap-2">
                  <Label htmlFor="roq">Bin Qty</Label>
                  <Input
                    id="roq"
                    type="number"
                    value={form.ROQ === 0 ? "" : form.ROQ}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        ROQ: Number(event.target.value),
                      }))
                    }
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="roq">Stock Type</Label>
                  <select
                    id="stock-type"
                    value={form.STOCK_TYPE || ""}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        STOCK_TYPE: event.target.value,
                      }))
                    }
                    className="h-8 w-full rounded-md border border-slate-300 bg-white px-2 text-sm text-slate-700 outline-none"
                    disabled={mode === "edit"}
                  >
                    <option value="">Select Stock Type</option>
                    <option value="FG">FG</option>
                    <option value="FC">FC</option>
                    <option value="RM">RM</option>
                  </select>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog
            open={deleteDialogOpen}
            onOpenChange={(open) => {
              if (!deleting) setDeleteDialogOpen(open)
            }}
          >
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Delete Bin</DialogTitle>
                <DialogDescription>
                  Enter a reason for deleting bin {deleteRow?.REP_ID}.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-2 py-2">
                <Label htmlFor="delete-reason">Reason</Label>
                <Input
                  id="delete-reason"
                  value={deleteReason}
                  onChange={(event) => setDeleteReason(event.target.value)}
                  placeholder="Enter delete reason"
                  autoFocus
                  disabled={deleting}
                />
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setDeleteDialogOpen(false)}
                  disabled={deleting}
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => void handleConfirmDelete()}
                  disabled={deleting || !deleteReason.trim()}
                >
                  {deleting ? "Deleting..." : "Delete"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={duplicateDialogOpen} onOpenChange={setDuplicateDialogOpen}>
            <DialogContent className="overflow-hidden border-slate-200 shadow-xl sm:max-w-180">
              <DialogHeader className="space-y-2">
                <DialogTitle className="flex items-center gap-2 text-xl font-bold text-amber-700">
                  Active Master Bin Already Exists
                </DialogTitle>
                <DialogDescription className="leading-normal text-slate-600">
                  A bin already exists matching this configuration.
                </DialogDescription>
              </DialogHeader>

              {/* Metadata Details Card */}
              <div className="my-2 rounded-xl border border-slate-100 bg-slate-50/70 p-4">
                <div className="mb-3 text-xs font-semibold tracking-wider text-slate-500 uppercase">
                  Existing Bin Configuration
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                  <p className="text-slate-600">
                    <span className="font-medium text-slate-900">Item No:</span>{" "}
                    {duplicatePayload?.ITEM_NO}
                  </p>
                  <p className="text-slate-600">
                    <span className="font-medium text-slate-900">Customer:</span>{" "}
                    {duplicatePayload?.CUSTOMER_NAME}
                  </p>
                  <p className="text-slate-600">
                    <span className="font-medium text-slate-900">Region:</span>{" "}
                    {duplicatePayload?.REGION}
                  </p>
                  <p className="text-slate-600">
                    <span className="font-medium text-slate-900">Org:</span>{" "}
                    {duplicatePayload?.ORG}
                  </p>
                  <p className="text-slate-600">
                    <span className="font-medium text-slate-900">Stock Type:</span>{" "}
                    {duplicatePayload?.STOCK_TYPE}
                  </p>
                  <p className="text-slate-600">
                    <span className="font-medium text-slate-900">Category:</span>{" "}
                    {duplicatePayload?.BIN_CATEGORY}
                  </p>
                  <p className="text-slate-600">
                    <span className="font-medium text-slate-900">Location:</span>{" "}
                    {duplicatePayload?.BIN_LOCATION || "N/A"}
                  </p>
                  <p className="text-slate-600">
                    <span className="font-medium text-slate-900">Bin Qty:</span>{" "}
                    {duplicatePayload?.ROQ}
                  </p>
                </div>
              </div>

              <DialogFooter className="mt-4 flex items-center justify-end gap-2 border-t border-slate-100 pt-4">
                <Button
                  variant="outline"
                  className="min-w-20 border-slate-200 bg-emerald-300 text-slate-700 hover:bg-destructive"
                  onClick={() => setDuplicateDialogOpen(false)}
                  disabled={submitting}
                >
                  Ok
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
    </div>
  )
}
