import { useEffect, useRef } from "react"
import {
  AllCommunityModule,
  ModuleRegistry,
  createGrid,
  themeQuartz,
} from "ag-grid-community"
import { Loader } from "./Loader"

ModuleRegistry.registerModules([AllCommunityModule])

interface DynamicTableProps {
  rowData: any[]
  columnDefs: any[]
  onGridReady?: (api: any) => void
  rowSelection?: any
  pagination?: boolean
  paginationPageSize?: number
  paginationPageSizeSelector?: number[]
  onSelectionChanged?: (params: any) => void
  onCellValueChanged?: (params: any) => void
  rowClassRules?: any
  onRowClicked?: (params: any) => void
  isLoading?: boolean
  density?: "compact" | "standard" | "comfortable"
  context?: any
}

export default function DynamicTable({
  rowData,
  columnDefs,
  onGridReady,
  rowSelection,
  pagination = true,
  paginationPageSize = 50,
  paginationPageSizeSelector = [25, 50, 100, 200],
  onSelectionChanged,
  onCellValueChanged,
  rowClassRules,
  onRowClicked,
  isLoading = false,
  density = "standard",
  context,
}: DynamicTableProps) {
  const gridDivRef = useRef<HTMLDivElement | null>(null)
  const gridApiRef = useRef<any>(null)

  // Initialize ag-Grid
  useEffect(() => {
    if (!gridDivRef.current) return

    const heights = { compact: 32, standard: 44, comfortable: 56 }

    const api = createGrid(gridDivRef.current, {
      columnDefs,
      rowData,
      theme: themeQuartz.withParams({
        accentColor: "#3b82f6", // tailwind blue-500
        headerBackgroundColor: "#f8fafc", // tailwind slate-50
        headerTextColor: "#334155", // tailwind slate-700
        headerFontWeight: 700,
        oddRowBackgroundColor: "#ffffff",
        borderColor: "#cbd5e1", // tailwind slate-300
        wrapperBorderRadius: 8,
        rowHoverColor: "#f1f5f9", // tailwind slate-100
      }),
      defaultColDef: {
        sortable: true,
        filter: true,
        floatingFilter: false,
        resizable: true,
        minWidth: 100,
        editable: false,
      },
      rowSelection: rowSelection ?? {
        mode: "multiRow",
        checkboxes: true,
        headerCheckbox: true,
        enableClickSelection: false,
      },
      pagination,
      paginationPageSize,
      paginationPageSizeSelector,
      rowHeight: heights[density],
      animateRows: true,
      rowBuffer: 20,
      enableCellTextSelection: true,
      ensureDomOrder: true,
      rowClassRules,
      context,
      onSelectionChanged: (event: any) => {
        if (onSelectionChanged) onSelectionChanged(event)
      },
      onCellValueChanged: (event: any) => {
        if (onCellValueChanged) onCellValueChanged(event)
      },
      onRowClicked: (event: any) => {
        if (onRowClicked) onRowClicked(event)
      },
    } as any)

    gridApiRef.current = api
    if (onGridReady) {
      onGridReady(api)
    }

    return () => {
      api.destroy()
      gridApiRef.current = null
    }
  }, [columnDefs]) // Re-create grid when column definitions change

  // Update rowData dynamically without destroying grid
  useEffect(() => {
    if (gridApiRef.current) {
      gridApiRef.current.setGridOption("rowData", rowData)
    }
  }, [rowData])

  // Update density dynamically
  useEffect(() => {
    if (gridApiRef.current) {
      const heights = { compact: 32, standard: 44, comfortable: 56 }
      gridApiRef.current.setGridOption("rowHeight", heights[density])
      gridApiRef.current.resetRowHeights()
    }
  }, [density])

  return (
    <div className="relative h-full w-full min-h-[400px]">
      {isLoading && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-white/70 backdrop-blur-[1px]">
          <Loader isText={false} />
        </div>
      )}
      <div ref={gridDivRef} className="h-full w-full" />
    </div>
  )
}