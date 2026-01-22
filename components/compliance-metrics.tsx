"use client"

interface ComplianceMetricsProps {
  data: any
}

export default function ComplianceMetrics({ data }: ComplianceMetricsProps) {
  const complianceRate = data?.total_trips > 0 ? Math.round((data?.approved / data?.total_trips) * 100) : 0
  const avgScore = data?.average_score || 0

  const metrics = [
    {
      title: "Compliance Rate",
      value: `${complianceRate}%`,
      description: "Approved out of total trips",
      trend: complianceRate > 75 ? "up" : complianceRate > 50 ? "stable" : "down",
    },
    {
      title: "Average Safety Score",
      value: `${avgScore}%`,
      description: "Mean score across all trips",
      trend: avgScore > 85 ? "up" : avgScore > 70 ? "stable" : "down",
    },
    {
      title: "Submission Rate",
      value: `${data?.pending > 0 ? Math.round((data?.pending / (data?.pending + data?.approved + data?.rejected)) * 100) : 0}%`,
      description: "Awaiting approval",
      trend: "neutral",
    },
  ]

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h3 className="text-lg font-bold text-gray-900 mb-6">Compliance Metrics</h3>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {metrics.map((metric, index) => (
          <div key={index} className="border rounded-lg p-4">
            <p className="text-xs font-medium text-gray-600 uppercase tracking-wide">{metric.title}</p>
            <p className="text-3xl font-bold text-gray-900 mt-3">{metric.value}</p>
            <p className="text-xs text-gray-600 mt-2">{metric.description}</p>

            <div className="mt-4 pt-4 border-t">
              {metric.trend === "up" && <span className="text-xs font-semibold text-green-600">Trending Up</span>}
              {metric.trend === "down" && <span className="text-xs font-semibold text-red-600">Trending Down</span>}
              {metric.trend === "stable" && <span className="text-xs font-semibold text-yellow-600">Stable</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
