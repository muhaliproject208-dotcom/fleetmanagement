"use client"

interface RiskDistributionChartProps {
  data: {
    low: number
    medium: number
    high: number
    critical: number
  }
}

export default function RiskDistributionChart({ data }: RiskDistributionChartProps) {
  const total = (data?.low || 0) + (data?.medium || 0) + (data?.high || 0) + (data?.critical || 0)

  const risks = [
    {
      label: "Low",
      value: data?.low || 0,
      color: "bg-green-500",
      percentage: total > 0 ? ((data?.low || 0) / total) * 100 : 0,
    },
    {
      label: "Medium",
      value: data?.medium || 0,
      color: "bg-yellow-500",
      percentage: total > 0 ? ((data?.medium || 0) / total) * 100 : 0,
    },
    {
      label: "High",
      value: data?.high || 0,
      color: "bg-orange-500",
      percentage: total > 0 ? ((data?.high || 0) / total) * 100 : 0,
    },
    {
      label: "Critical",
      value: data?.critical || 0,
      color: "bg-red-500",
      percentage: total > 0 ? ((data?.critical || 0) / total) * 100 : 0,
    },
  ]

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h3 className="text-lg font-bold text-gray-900 mb-6">Risk Distribution</h3>

      <div className="space-y-4">
        {risks.map((risk, index) => (
          <div key={index}>
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium text-gray-700">{risk.label}</span>
              <span className="text-sm font-semibold text-gray-900">{risk.value} trips</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div className={`${risk.color} h-2 rounded-full`} style={{ width: `${risk.percentage}%` }}></div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 pt-6 border-t">
        <div className="grid grid-cols-2 gap-4 text-center">
          <div>
            <p className="text-2xl font-bold text-green-600">{((data?.low || 0) / total) * 100 || 0}%</p>
            <p className="text-xs text-gray-600">Low Risk</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-red-600">{((data?.critical || 0) / total) * 100 || 0}%</p>
            <p className="text-xs text-gray-600">Critical</p>
          </div>
        </div>
      </div>
    </div>
  )
}
