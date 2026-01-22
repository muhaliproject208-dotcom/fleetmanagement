"use client"

interface AnalyticsCardsProps {
  data: any
}

export default function AnalyticsCards({ data }: AnalyticsCardsProps) {
  const cards = [
    {
      title: "Total Trips",
      value: data?.total_trips || 0,
      color: "bg-blue-50 text-blue-600",
      borderColor: "border-blue-200",
    },
    {
      title: "Approved",
      value: data?.approved || 0,
      color: "bg-green-50 text-green-600",
      borderColor: "border-green-200",
    },
    {
      title: "Pending",
      value: data?.pending || 0,
      color: "bg-yellow-50 text-yellow-600",
      borderColor: "border-yellow-200",
    },
    {
      title: "Rejected",
      value: data?.rejected || 0,
      color: "bg-red-50 text-red-600",
      borderColor: "border-red-200",
    },
    {
      title: "Average Score",
      value: `${data?.average_score || 0}%`,
      color: "bg-purple-50 text-purple-600",
      borderColor: "border-purple-200",
    },
  ]

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
      {cards.map((card, index) => (
        <div key={index} className={`${card.color} p-6 rounded-lg border ${card.borderColor}`}>
          <p className="text-sm font-medium text-gray-700">{card.title}</p>
          <p className="text-3xl font-bold mt-2">{card.value}</p>
        </div>
      ))}
    </div>
  )
}
