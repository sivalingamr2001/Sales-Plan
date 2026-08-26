export const DashboardPage = () => {
  const { currentUserRole, currentUser, currentRegion } = useAuth()
  const canViewPendingBin = currentRegion === "HO" && currentUserRole !== "user"
  const [filterMode, setFilterMode] = useState<"ORDER" | "BIN SP" | "BIN MASTER" | "SP BIN PEND">("ORDER")

  const buildSetName = useCallback(
    (targetMonth: string | null | undefined): string => {
      if (!targetMonth) return "UNKNOWN-SET"

      // Matches 4 digits (year) followed by 2 digits (month)
      const match = targetMonth.trim().match(/^(\d{4})(\d{2})$/)
      if (!match) return "UNKNOWN-SET"

      const [_, year, monthNum] = match

      // Map month numbers to 3-letter abbreviations
      const months: Record<string, string> = {
        "01": "JAN",
        "02": "FEB",
        "03": "MAR",
        "04": "APR",
        "05": "MAY",
        "06": "JUN",
        "07": "JUL",
        "08": "AUG",
        "09": "SEP",
        "10": "OCT",
        "11": "NOV",
        "12": "DEC",
      }

      const monthLetter = months[monthNum]
      if (!monthLetter) return "UNKNOWN-SET"

      return `${monthLetter}-${year}-SET`
    },
    []
  )

  return (
    <div className="flex h-[calc(100vh-45px)] flex-col gap-6 overflow-y-auto bg-slate-50 p-0">
      <div className="mx-auto flex w-full flex-col">
        <SalesPlanFilterBar
          activeRegion={s.activeRegion}
          canViewPendingBin={canViewPendingBin}
          subRegionStr={s.subRegionStr}
          customerList={s.customerList}
          selectedCustomer={s.selectedCustomer}
          setSelectedCustomer={s.setSelectedCustomer}
          orderedItemInput={s.orderedItemInput}
          setOrderedItemInput={s.setOrderedItemInput}
          includeBin={s.includeBin}
          setIncludeBin={s.setIncludeBin}
          loadingCustomers={s.loadingCustomers}
          loadingConsolidated={s.loadingConsolidated}
          onSubmit={s.handleSalesPlanQuerySubmit}
          filterMode={filterMode}
          setFilterMode={setFilterMode}
        />

        //Tables
      </div>
    </div>
  )
}
