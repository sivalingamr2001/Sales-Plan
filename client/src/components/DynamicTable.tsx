import { useEffect, useRef } from "react"
import {
  AllCommunityModule,
  ModuleRegistry,
  createGrid,
  themeBalham,
} from "ag-grid-community"
import { Loader } from "./Loader"

ModuleRegistry.registerModules([AllCommunityModule])

const rowHeights = { compact: 32, standard: 44, comfortable: 56 }

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
  const handlersRef = useRef({
    onGridReady,
    onSelectionChanged,
    onCellValueChanged,
    onRowClicked,
  })

  handlersRef.current = {
    onGridReady,
    onSelectionChanged,
    onCellValueChanged,
    onRowClicked,
  }

  useEffect(() => {
    if (!gridDivRef.current) return

    const api = createGrid(gridDivRef.current, {
      columnDefs,
      rowData,
      theme: themeBalham.withParams({
        accentColor: "#3b82f6",
        headerBackgroundColor: "#f8fafc",
        headerTextColor: "#334155",
        headerFontWeight: 700,
        oddRowBackgroundColor: "#ffffff",
        borderColor: "#cbd5e1",
        wrapperBorderRadius: 8,
        rowHoverColor: "#f1f5f9",
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
      ...(pagination
        ? {
            paginationPageSize,
            paginationPageSizeSelector,
          }
        : {
            domLayout: "autoHeight",
          }),
      rowHeight: rowHeights[density],
      animateRows: true,
      rowBuffer: 20,
      enableCellTextSelection: true,
      ensureDomOrder: true,
      rowClassRules,
      context,
      onSelectionChanged: (event: any) => {
        handlersRef.current.onSelectionChanged?.(event)
      },
      onCellValueChanged: (event: any) => {
        handlersRef.current.onCellValueChanged?.(event)
      },
      onRowClicked: (event: any) => {
        handlersRef.current.onRowClicked?.(event)
      },
    } as any)

    gridApiRef.current = api
    handlersRef.current.onGridReady?.(api)

    return () => {
      api.destroy()
      gridApiRef.current = null
    }
  }, [columnDefs])

  useEffect(() => {
    gridApiRef.current?.setGridOption("rowData", rowData)
  }, [rowData])

  useEffect(() => {
    if (!gridApiRef.current) return

    gridApiRef.current.setGridOption("pagination", pagination)

    if (pagination) {
      gridApiRef.current.setGridOption("domLayout", "normal")
      gridApiRef.current.setGridOption("paginationPageSize", paginationPageSize)
      gridApiRef.current.setGridOption(
        "paginationPageSizeSelector",
        paginationPageSizeSelector,
      )
    } else {
      gridApiRef.current.setGridOption("domLayout", "autoHeight")
    }
  }, [pagination, paginationPageSize, paginationPageSizeSelector])

  useEffect(() => {
    if (!gridApiRef.current) return

    gridApiRef.current.setGridOption("rowHeight", rowHeights[density])
    gridApiRef.current.resetRowHeights()
  }, [density])

  return (
    <div
      className={`relative w-full ${pagination ? "h-full min-h-[400px]" : "h-auto min-h-0"}`}
    >
      {isLoading && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-white/70 backdrop-blur-[1px]">
          <Loader isText={false} />
        </div>
      )}
      <div
        ref={gridDivRef}
        className={pagination ? "h-full w-full" : "w-full"}
      />
    </div>
  )
}
