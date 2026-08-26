import { useState, useEffect, useCallback } from "react"
import { createPortal } from "react-dom"
import { useAuth } from "@/context/AuthContext"
import { useSalesPlanDashboard } from "@/hooks/useSalesPlanDashboard"
import { useColumns, getCurrentTargetMonthOptions } from "@/components/column"
import DynamicTable from "@/components/DynamicTable"
import { salesPlanApi } from "@/api/salePlanApi"
import { Spinner } from "@/components/ui/spinner"
import { toast } from "sonner"
import {
  Search,
  Plus,
  Trash2,
  CheckCircle2,
  FileCheck,
  Package,
  Layers,
  Database,
  Info,
  ArrowLeft,
  Eye,
  Edit2,
  LineChart,
  Loader2
} from "lucide-react"
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Label, LabelList, Line } from "recharts"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import type { Button, Input } from "@base-ui/react"

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
  const [itemSearchText, setItemSearchText] = useState("")
  const [itemSuggestions, setItemSuggestions] = useState<any[]>([])
  const [selectedItem, setSelectedItem] = useState<any>(null)

  // Edit Modal state for BIN SP tab row updating
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [selectedBinSpRow, setSelectedBinSpRow] = useState<any>(null)
  const [editForm, setEditForm] = useState({
    targetMonth: "",
    emergencyFlag: 0,
    compProductFlag: "FG"
  })

  // Recharts Chart State
  const [monthlySalesData, setMonthlySalesData] = useState<any[]>([])
  const [loadingChart, setLoadingChart] = useState(false)

  const [binForm, setBinForm] = useState({
    customerId: 0,
    custName: "",
    organizationId: 0,
    org: "",
    inventoryItemId: 0,
    itemNo: "",
    description: "",
    tbrQty: 0,
    binCat: "",
    stockType: "FG",
    binLocation: ""
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

  // Fetch item details suggestions for create bin modal
  useEffect(() => {
    if (itemSearchText.trim().length >= 2) {
      salesPlanApi.getInventoryItemDetails(itemSearchText)
        .then((res) => {
          setItemSuggestions((res as any).data || [])
        })
        .catch((err) => console.error("Error fetching items:", err))
    } else {
      setItemSuggestions([])
    }
  }, [itemSearchText])

  // Fetch chart data when Customer, Item, and Org are resolved
  const fetchMonthlyChart = useCallback(async (customerId: number, orgId: number, inventoryItemId: number) => {
    setLoadingChart(true)
    try {
      const res = await salesPlanApi.getMonthlyQuantity(customerId, orgId, inventoryItemId)
      setMonthlySalesData(res.data || [])
    } catch (err) {
      console.error("Failed to load chart data:", err)
      setMonthlySalesData([])
    } finally {
      setLoadingChart(false)
    }
  }, [])

  useEffect(() => {
    if (binForm.customerId && binForm.inventoryItemId && binForm.organizationId) {
      fetchMonthlyChart(binForm.customerId, binForm.organizationId, binForm.inventoryItemId)
    } else {
      setMonthlySalesData([])
    }
  }, [binForm.customerId, binForm.inventoryItemId, binForm.organizationId, fetchMonthlyChart])

  const handleItemSelect = async (item: any) => {
    setSelectedItem(item)
    setItemSearchText(item.ITEM_NO)
    setItemSuggestions([])

    // Fetch matching Org for this item in this region
    try {
      const region = s.activeRegion
      const orgRes = await salesPlanApi.getOrgIdByInventoryIdAndOuId(item.INVENTORY_ITEM_ID, region)
      const orgInfo = (orgRes as any).data
      if (orgInfo) {
        setBinForm((prev) => ({
          ...prev,
          inventoryItemId: item.INVENTORY_ITEM_ID,
          itemNo: item.ITEM_NO,
          description: item.DESCRIPTION || "",
          organizationId: orgInfo.ORGANIZATION_ID,
          org: orgInfo.ORG_CODE || ""
        }))
      } else {
        setBinForm((prev) => ({
          ...prev,
          inventoryItemId: item.INVENTORY_ITEM_ID,
          itemNo: item.ITEM_NO,
          description: item.DESCRIPTION || ""
        }))
      }
    } catch (err) {
      console.error("Failed to fetch matching org details:", err)
    }
  }

  const handleCreateBinSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!binForm.inventoryItemId || !binForm.organizationId) {
      toast.error("Please select a valid item and organization.")
      return
    }

    try {
      const customer = s.customerList.find((c: any) => c.CUSTOMER_ID === Number(binForm.customerId))
      const finalForm = {
        ...binForm,
        customerId: binForm.customerId || null,
        custName: customer ? customer.CUSTOMER_NAME : null,
        region: s.subRegionStr || s.activeRegion,
        createdBy: currentUser?.username || null
      }

      await salesPlanApi.createBinRecord(finalForm as any, currentUser?.username)
      toast.success("Replenishment bin created successfully.")
      setIsModalOpen(false)
      // Reset form
      setBinForm({
        customerId: 0,
        custName: "",
        organizationId: 0,
        org: "",
        inventoryItemId: 0,
        itemNo: "",
        description: "",
        tbrQty: 0,
        binCat: "",
        stockType: "FG",
        binLocation: ""
      })
      setItemSearchText("")
      // Reload rep bins
      await s.loadRepBinData()
    } catch (err: any) {
      console.error(err)
      toast.error(err.response?.data?.message || "Failed to create replenishment bin.")
    }
  }

  // Action: Update Replenishment Bin master Row Qty
  const handleUpdateBinQty = async (row: any) => {
    try {
      await s.updateRepBinRecord(row)
      toast.success("Replenishment quantity updated.")
    } catch (err) {
      toast.error("Failed to update replenishment quantity.")
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

  // Action: Reject/Delete Replenishment Bin
  const handleDeleteBinMaster = async (row: any) => {
    const reason = window.prompt("Please enter a reason for deletion:")
    if (reason === null) return
    if (!reason.trim()) {
      toast.error("A reason is required to delete.")
      return
    }

    try {
      await salesPlanApi.deleteBinMasterData({ REP_ID: row.REP_ID, reason })
      toast.success("Replenishment bin deleted.")
      if (showPendingBins) {
        await s.loadPendingRepBinData()
      } else {
        await s.loadRepBinData()
      }
    } catch (err) {
      toast.error("Failed to delete replenishment bin.")
    }
  }

  // BIN SP: row editing modal handlers
  const openEditModal = (row: any) => {
    setSelectedBinSpRow(row)
    setEditForm({
      targetMonth: row.TARGET_MON_FINAL || "",
      emergencyFlag: Number(row.EMERGENCY_FLAG || 0),
      compProductFlag: row.STOCK_TYPE || "FG"
    })
    setIsEditModalOpen(true)
  }

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedBinSpRow) return

    try {
      await salesPlanApi.updateBinData({
        binLineId: selectedBinSpRow.REP_ID || selectedBinSpRow.BIN_LINE_ID,
        targetMonth: editForm.targetMonth || null,
        emergencyFlag: editForm.emergencyFlag,
        compProductFlag: editForm.compProductFlag
      })
      toast.success("BIN SP row updated successfully.")
      setIsEditModalOpen(false)
      setSelectedBinSpRow(null)
      // Refresh bins data
      await s.loadRepBinData()
    } catch (err: any) {
      console.error(err)
      toast.error(err.response?.data?.message || "Failed to update BIN SP row.")
    }
  }

  return (
    <div className="flex h-full flex-col bg-slate-50">
      {/* Portal destination slot rendering for tabs */}
      {filterSlot && createPortal(
        <div className="flex bg-slate-100 p-1 rounded-xl gap-1 shrink-0">
          <button
            onClick={() => {
              setFilterMode("ORDER")
              setOrderView("CONSOLIDATED")
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${filterMode === "ORDER"
              ? "bg-white text-blue-600 shadow-sm"
              : "text-slate-600 hover:text-slate-900"
              }`}
          >
            <Layers className="h-3.5 w-3.5" />
            ORDER
          </button>
          <button
            onClick={() => setFilterMode("BIN MASTER")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${filterMode === "BIN MASTER"
              ? "bg-white text-blue-600 shadow-sm"
              : "text-slate-600 hover:text-slate-900"
              }`}
          >
            <Database className="h-3.5 w-3.5" />
            BIN MASTER
          </button>
          <button
            onClick={() => setFilterMode("BIN SP")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${filterMode === "BIN SP"
              ? "bg-white text-blue-600 shadow-sm"
              : "text-slate-600 hover:text-slate-900"
              }`}
          >
            <Package className="h-3.5 w-3.5" />
            BIN SP
          </button>
          {canViewPendingBin && (
            <button
              onClick={() => setFilterMode("SP BIN PEND")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${filterMode === "SP BIN PEND"
                ? "bg-white text-blue-600 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
                }`}
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
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
                  onClick={() => setIsModalOpen(true)}
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
                              onClick={() => handleUpdateBinQty(params.data)}
                              title="Update Qty"
                              className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                            >
                              <FileCheck className="h-4 w-4" />
                            </button>
                          )}
                          <button
                            onClick={() => handleDeleteBinMaster(params.data)}
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
                            onClick={() => openEditModal(params.data)}
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
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-none shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wider flex items-center gap-2">
                <Plus className="h-4 w-4 text-blue-600" />
                Create Replenishment Bin
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold"
              >
                &times;
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-0 flex flex-col lg:flex-row gap-0">
              {/* Form Side */}
              <form onSubmit={handleCreateBinSubmit} className="flex-1 space-y-4">
                {/* Item lookup */}
                <div className="relative flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Item Number</label>
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                    <input
                      type="text"
                      required
                      placeholder="Search by item no..."
                      value={itemSearchText}
                      onChange={(e) => {
                        setItemSearchText(e.target.value)
                        if (!e.target.value) {
                          setSelectedItem(null)
                        }
                      }}
                      className="w-full rounded-lg border border-slate-200 pl-9 pr-3 py-2 text-sm outline-none focus:border-blue-500"
                    />
                  </div>
                  {itemSuggestions.length > 0 && (
                    <ul className="absolute left-0 right-0 top-[100%] bg-white border border-slate-200 rounded-lg shadow-lg z-[60] max-h-40 overflow-y-auto mt-1">
                      {itemSuggestions.map((item) => (
                        <li
                          key={item.INVENTORY_ITEM_ID}
                          onClick={() => handleItemSelect(item)}
                          className="px-4 py-2 hover:bg-slate-100 cursor-pointer text-xs flex justify-between border-b border-slate-100 last:border-0"
                        >
                          <span className="font-semibold text-slate-700">{item.ITEM_NO}</span>
                          <span className="text-slate-400 truncate max-w-[150px]">{item.DESCRIPTION}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {selectedItem && (
                  <div className="bg-blue-50/70 border border-blue-100 p-3 rounded-lg flex gap-2">
                    <Info className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
                    <div className="text-xs text-blue-700">
                      <p className="font-bold">{selectedItem.ITEM_NO}</p>
                      <p className="mt-0.5 text-[11px] leading-relaxed">{selectedItem.DESCRIPTION}</p>
                    </div>
                  </div>
                )}

                {/* Customer selection */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Customer</label>
                  <select
                    required
                    value={binForm.customerId}
                    onChange={(e) => setBinForm((prev) => ({ ...prev, customerId: Number(e.target.value) }))}
                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500"
                  >
                    <option value="">Select Customer</option>
                    {s.customerList.map((cust) => (
                      <option key={cust.CUSTOMER_ID} value={cust.CUSTOMER_ID}>
                        {cust.CUSTOMER_NAME}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase">Organization</label>
                    <input
                      type="text"
                      required
                      readOnly
                      placeholder="Auto-resolved org"
                      value={binForm.org}
                      className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none cursor-not-allowed"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase">Stock Type</label>
                    <select
                      value={binForm.stockType}
                      onChange={(e) => setBinForm((prev) => ({ ...prev, stockType: e.target.value }))}
                      className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500"
                    >
                      <option value="FG">FG</option>
                      <option value="FC">FC</option>
                      <option value="RM">RM</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase">Bin Category</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Standard"
                      value={binForm.binCat}
                      onChange={(e) => setBinForm((prev) => ({ ...prev, binCat: e.target.value }))}
                      className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase">ROQ / TBR Qty</label>
                    <input
                      type="number"
                      required
                      min={1}
                      value={binForm.tbrQty || ""}
                      onChange={(e) => setBinForm((prev) => ({ ...prev, tbrQty: Number(e.target.value) }))}
                      className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500"
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Bin Location</label>
                  <input
                    type="text"
                    placeholder="e.g. Warehouse A1"
                    value={binForm.binLocation}
                    onChange={(e) => setBinForm((prev) => ({ ...prev, binLocation: e.target.value }))}
                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500"
                  />
                </div>

                <div className="pt-4 border-t border-slate-200 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-100 text-xs font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-sm"
                  >
                    Create Bin
                  </button>
                </div>
              </form>

              {/* Chart Side */}
              <div className="w-full lg:w-72 bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col justify-between shrink-0">
                <div>
                  <h4 className="font-bold text-slate-700 text-xs uppercase tracking-wider mb-2">
                    Monthly Quantity History
                  </h4>
                  <p className="text-[10px] text-slate-400 mb-4 leading-relaxed">
                    Visualizes 6-month invoiced sales quantity history for the selected combination.
                  </p>
                </div>

                <div className="flex-1 flex items-center justify-center min-h-[160px]">
                  {loadingChart ? (
                    <div className="flex flex-col items-center gap-1.5">
                      <Spinner className="h-5 w-5 text-blue-500 animate-spin" />
                      <span className="text-[10px] text-slate-400">Loading chart data...</span>
                    </div>
                  ) : monthlySalesData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={160}>
                      <BarChart data={monthlySalesData}>
                        <XAxis dataKey="Month" stroke="#94a3b8" fontSize={9} tickLine={false} axisLine={false} />
                        <YAxis stroke="#94a3b8" fontSize={9} tickLine={false} axisLine={false} />
                        <Tooltip contentStyle={{ fontSize: "10px", borderRadius: "6px" }} />
                        <Bar dataKey="Sales" fill="#3b82f6" radius={[3, 3, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="text-center py-6">
                      <Info className="h-5 w-5 text-slate-300 mx-auto mb-1.5" />
                      <p className="text-[10px] text-slate-400 italic">
                        Select a customer and item to trace monthly statistics.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Row Edit Modal for BIN SP */}
      {isEditModalOpen && selectedBinSpRow && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden flex flex-col">
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wider flex items-center gap-2">
                <Edit2 className="h-4 w-4 text-blue-600" />
                Update BIN SP Row
              </h3>
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="p-0 space-y-4">
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-xs space-y-1 text-slate-600">
                <p><span className="font-semibold text-slate-700">Item No:</span> {selectedBinSpRow.ITEM_NO}</p>
                <p><span className="font-semibold text-slate-700">Customer:</span> {selectedBinSpRow.CUSTOMER_NAME}</p>
              </div>

              {/* Target Month Select */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase">Target Month</label>
                <select
                  required
                  value={editForm.targetMonth}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, targetMonth: e.target.value }))}
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500"
                >
                  <option value="">Select Month</option>
                  {getCurrentTargetMonthOptions().map((opt: any) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Stock Type Select */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase">Stock Type</label>
                <select
                  required
                  value={editForm.compProductFlag}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, compProductFlag: e.target.value }))}
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500"
                >
                  <option value="FG">FG</option>
                  <option value="FC">FC</option>
                  <option value="RM">RM</option>
                </select>
              </div>

              {/* Emergency Flag Select */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase">Emergency Bin Flag</label>
                <select
                  value={editForm.emergencyFlag}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, emergencyFlag: Number(e.target.value) }))}
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500"
                >
                  <option value={0}>Normal Bin</option>
                  <option value={1}>Emergency Bin</option>
                </select>
              </div>

              <div className="pt-4 border-t border-slate-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-100 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-sm"
                >
                  Update Row
                </button>
              </div>
            </form>
          </div>

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
      )}
    </div>
  )
}
