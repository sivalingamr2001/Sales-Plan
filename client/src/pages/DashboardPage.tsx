import React, { useState, useEffect } from "react"
import { useAuth } from "@/context/AuthContext"
import { useSalesPlanDashboard } from "@/hooks/useSalesPlanDashboard"
import { useColumns } from "@/components/column"
import DynamicTable from "@/components/DynamicTable"
import { salesPlanApi } from "@/api/salePlanApi"
import { toast } from "sonner"
import {
  Search,
  Plus,
  Trash2,
  CheckCircle2,
  FileCheck,
  TrendingUp,
  Package,
  Layers,
  Database,
  Info
} from "lucide-react"

export const DashboardPage = () => {
  const { currentRegion, currentUserRole, currentUser } = useAuth()
  const s = useSalesPlanDashboard()
  const cols = useColumns()

  const canViewPendingBin = currentRegion?.region === "HO" && currentUserRole !== "user"
  const [filterMode, setFilterMode] = useState<"ORDER" | "BIN SP" | "BIN MASTER" | "SP BIN PEND">("ORDER")

  // ag-Grid API references for getting selections
  const [orderGridApi, setOrderGridApi] = useState<any>(null)
  const [binSpGridApi, setBinSpGridApi] = useState<any>(null)

  // Creation Modal state for Bins
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [itemSearchText, setItemSearchText] = useState("")
  const [itemSuggestions, setItemSuggestions] = useState<any[]>([])
  const [selectedItem, setSelectedItem] = useState<any>(null)

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

  // Trigger loading initial data or switching tabs data loading
  useEffect(() => {
    if (filterMode === "BIN SP") {
      s.loadBinData()
    } else if (filterMode === "BIN MASTER") {
      s.loadRepBinData()
    } else if (filterMode === "SP BIN PEND") {
      s.loadPendingRepBinData()
      s.loadBinRsvHoPendingData()
    }
  }, [filterMode])

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
      // Find customer name if custom selection is made
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
      setSelectedItem(null)
      // Reload rep bins
      await s.loadRepBinData()
    } catch (err: any) {
      console.error(err)
      toast.error(err.response?.data?.message || "Failed to create replenishment bin.")
    }
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

  // Action: Insert BIN SP Data
  const handleInsertBinSp = async () => {
    if (!binSpGridApi) return
    const selectedRows = binSpGridApi.getSelectedRows()
    if (selectedRows.length === 0) {
      toast.error("Please select at least one row in the bin sp table.")
      return
    }

    try {
      await salesPlanApi.insertBinData(selectedRows)
      toast.success("BIN SP rows inserted successfully.")
      await s.loadBinData()
    } catch (err: any) {
      console.error(err)
      toast.error(err.response?.data?.message || "Failed to insert BIN SP data.")
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
      if (filterMode === "BIN MASTER") {
        await s.loadRepBinData()
      } else {
        await s.loadPendingRepBinData()
      }
    } catch (err) {
      toast.error("Failed to delete replenishment bin.")
    }
  }

  return (
    <div className="flex h-full flex-col bg-slate-50">
      {/* Header and Query Bar */}
      <section className="bg-white border-b border-slate-200 px-6 py-4 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-800 tracking-tight flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-blue-600" />
              Sales Plan Control Hub
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Active Region: <span className="font-semibold text-slate-700">{s.activeRegion}</span> | Logged In as: <span className="font-semibold text-slate-700">{currentUser?.username}</span>
            </p>
          </div>

          {/* Tab Selection */}
          <div className="flex bg-slate-100 p-1 rounded-xl gap-1 self-start lg:self-center">
            <button
              onClick={() => setFilterMode("ORDER")}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
                filterMode === "ORDER"
                  ? "bg-white text-blue-600 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Layers className="h-3.5 w-3.5" />
              Sales Plan
            </button>
            <button
              onClick={() => setFilterMode("BIN SP")}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
                filterMode === "BIN SP"
                  ? "bg-white text-blue-600 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Package className="h-3.5 w-3.5" />
              BIN SP
            </button>
            <button
              onClick={() => setFilterMode("BIN MASTER")}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
                filterMode === "BIN MASTER"
                  ? "bg-white text-blue-600 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Database className="h-3.5 w-3.5" />
              Bin Master
            </button>
            {canViewPendingBin && (
              <button
                onClick={() => setFilterMode("SP BIN PEND")}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
                  filterMode === "SP BIN PEND"
                    ? "bg-white text-blue-600 shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                HO Approvals
              </button>
            )}
          </div>
        </div>

        {/* Filter Controls (Available only for relevant tabs) */}
        {filterMode === "ORDER" && (
          <form onSubmit={s.handleSalesPlanQuerySubmit} className="mt-4 flex flex-wrap gap-3 items-center">
            <div className="flex flex-col gap-1 min-w-[200px]">
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

            <div className="flex flex-col gap-1 min-w-[220px]">
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

            <div className="flex flex-col gap-1 min-w-[220px]">
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
        )}
      </section>

      {/* Main Grid Workspace */}
      <main className="flex-1 min-h-0 overflow-hidden p-6">
        {filterMode === "ORDER" && (
          <div className="h-full flex flex-col gap-6">
            {/* Consolidated Summary */}
            <div className="flex-[2] min-h-[180px] bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm flex flex-col">
              <div className="px-4 py-2.5 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
                <span className="text-xs font-bold text-slate-600 uppercase flex items-center gap-1.5">
                  <Layers className="h-4 w-4 text-slate-500" />
                  Consolidated Overview
                </span>
                <span className="text-[10px] text-slate-400 italic">Click an item code to query detail structure</span>
              </div>
              <div className="flex-1 min-h-0">
                <DynamicTable
                  rowData={s.consolidatedData}
                  columnDefs={cols.consolidatedColumns}
                  isLoading={s.loadingConsolidated}
                  density="compact"
                  onRowClicked={(event) => {
                    if (event.data?.ORDER_ITEM) {
                      s.onConsolidatedRowClick(event.data.ORDER_ITEM)
                    }
                  }}
                  rowSelection={{ mode: "singleRow" }}
                />
              </div>
            </div>

            {/* Detailed Orders Grid */}
            <div className="flex-[3] min-h-[250px] bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm flex flex-col">
              <div className="px-4 py-2.5 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
                <span className="text-xs font-bold text-slate-600 uppercase flex items-center gap-1.5">
                  <Database className="h-4 w-4 text-slate-500" />
                  Detail Structure Plans
                </span>
                <button
                  onClick={handleSaveOrders}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs px-3 py-1 rounded-md shadow-sm transition-all flex items-center gap-1"
                >
                  <FileCheck className="h-3.5 w-3.5" />
                  Save Sales Plan
                </button>
              </div>
              <div className="flex-1 min-h-0">
                <DynamicTable
                  rowData={s.salesPlanData}
                  columnDefs={cols.salesPlanColumns}
                  isLoading={s.loadingSalesPlans}
                  onGridReady={(api) => setOrderGridApi(api)}
                  density="standard"
                />
              </div>
            </div>
          </div>
        )}

        {filterMode === "BIN SP" && (
          <div className="h-full bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm flex flex-col">
            <div className="px-4 py-2.5 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
              <span className="text-xs font-bold text-slate-600 uppercase flex items-center gap-1.5">
                <Package className="h-4 w-4 text-slate-500" />
                BIN SP Workspace
              </span>
              <button
                onClick={handleInsertBinSp}
                className="bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs px-3 py-1 rounded-md shadow-sm transition-all flex items-center gap-1"
              >
                <Plus className="h-3.5 w-3.5" />
                Insert BIN SP Data
              </button>
            </div>
            <div className="flex-1 min-h-0">
              <DynamicTable
                rowData={s.globalBinData}
                columnDefs={cols.binColumns}
                isLoading={s.loadingBin}
                onGridReady={(api) => setBinSpGridApi(api)}
              />
            </div>
          </div>
        )}

        {filterMode === "BIN MASTER" && (
          <div className="h-full bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm flex flex-col">
            <div className="px-4 py-2.5 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
              <span className="text-xs font-bold text-slate-600 uppercase flex items-center gap-1.5">
                <Database className="h-4 w-4 text-slate-500" />
                Replenishment Bins Registry
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setIsModalOpen(true)}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs px-3 py-1.5 rounded-lg shadow-sm transition-all flex items-center gap-1"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Create Replenishment Bin
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
                          <button
                            onClick={() => handleUpdateBinQty(params.data)}
                            title="Update Qty"
                            className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                          >
                            <FileCheck className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteBinMaster(params.data)}
                            title="Delete"
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

        {filterMode === "SP BIN PEND" && canViewPendingBin && (
          <div className="h-full flex flex-col gap-6">
            {/* HO Pending Replenishment Bins */}
            <div className="flex-1 bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm flex flex-col">
              <div className="px-4 py-2.5 border-b border-slate-100 bg-slate-50">
                <span className="text-xs font-bold text-slate-600 uppercase flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  HO Pending Replenishment Approval
                </span>
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
                            <button
                              onClick={() => handleApproveBin(params.data)}
                              title="Approve"
                              className="p-1 text-emerald-600 hover:bg-emerald-50 rounded"
                            >
                              <CheckCircle2 className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteBinMaster(params.data)}
                              title="Delete/Reject"
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

            {/* Pending BIN RSV Rows */}
            <div className="flex-1 bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm flex flex-col">
              <div className="px-4 py-2.5 border-b border-slate-100 bg-slate-50">
                <span className="text-xs font-bold text-slate-600 uppercase flex items-center gap-1.5">
                  <Package className="h-4 w-4 text-orange-500" />
                  HO Pending BIN RSV Detail Rows
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
          </div>
        )}
      </main>

      {/* Reusable creation modal for replenishment bin */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col">
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

            <form onSubmit={handleCreateBinSubmit} className="p-6 overflow-y-auto space-y-4 max-h-[75vh]">
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
                  <ul className="absolute left-0 right-0 top-[100%] bg-white border border-slate-200 rounded-lg shadow-lg z-[60] max-h-48 overflow-y-auto mt-1">
                    {itemSuggestions.map((item) => (
                      <li
                        key={item.INVENTORY_ITEM_ID}
                        onClick={() => handleItemSelect(item)}
                        className="px-4 py-2 hover:bg-slate-100 cursor-pointer text-xs flex justify-between border-b border-slate-100 last:border-0"
                      >
                        <span className="font-semibold text-slate-700">{item.ITEM_NO}</span>
                        <span className="text-slate-400 truncate max-w-[220px]">{item.DESCRIPTION}</span>
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
                {/* Org Code */}
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

                {/* Stock Type */}
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
                {/* Bin Category */}
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

                {/* TBR / ROQ Qty */}
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

              {/* Bin Location */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase">Bin Location (Optional)</label>
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
          </div>
        </div>
      )}
    </div>
  )
}
