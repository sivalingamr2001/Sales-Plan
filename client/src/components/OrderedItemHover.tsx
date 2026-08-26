
interface OrderedItemHoverProps {
  item: string
  inventoryItemId: number
}

export const OrderedItemHover = ({ item, inventoryItemId }: OrderedItemHoverProps) => {
  return (
    <span
      className="font-semibold text-slate-700 hover:text-blue-600 transition-colors"
      title={`Inventory Item ID: ${inventoryItemId}`}
    >
      {item}
    </span>
  )
}
