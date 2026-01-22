"use client"

interface TripStatusChartProps {
  data: {
    approved: number
    pending: number
    rejected: number
  }
}

export default function TripStatusChart({ data }: TripStatusChartProps) {
  const total = (data?.approved || 0) + (data?.pending || 0) + (data?.rejected || 0)

  const statuses = [
    {
      label: "Approved",
      value: data?.approved || 0,
      color: "bg-green-500",
      percentage: total > 0 ? ((data?.approved || 0) / total) * 100 : 0,
    },
    {
      label: "Pending",
      value: data?.pending || 0,
      color: "bg-yellow-500",
      percentage: total > 0 ? ((data?.pending || 0) / total) * 100 : 0,
    },
    {
      label: "Rejected",
      value: data?.rejected || 0,
      color: "bg-red-500",
      percentage: total > 0 ? ((data?.rejected || 0) / total) * 100 : 0,
    },
  ]

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h3 className="text-lg font-bold text-gray-900 mb-6">Trip Status Distribution</h3>

      <div className="space-y-4">
        {statuses.map((status, index) => (
          <div key={index}>
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium text-gray-700">{status.label}</span>
              <span className="text-sm font-semibold text-gray-900">{status.value} trips</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div className={`${status.color} h-2 rounded-full`} style={{ width: `${status.percentage}%` }}></div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 pt-6 border-t flex justify-around text-center">
        <div>
          <p className="text-2xl font-bold text-green-600">{data?.approved || 0}</p>
          <p className="text-xs text-gray-600 mt-1">Approved</p>
        </div>
        <div>
          <p className="text-2xl font-bold text-yellow-600">{data?.pending || 0}</p>
          <p className="text-xs text-gray-600 mt-1">Pending</p>
        </div>
        <div>
          <p className="text-2xl font-bold text-red-600">{data?.rejected || 0}</p>
          <p className="text-xs text-gray-600 mt-1">Rejected</p>
        </div>
      </div>
    </div>
  )
}
