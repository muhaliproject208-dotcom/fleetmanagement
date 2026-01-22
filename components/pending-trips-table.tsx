"use client"

interface PendingTripsTableProps {
  trips: any[]
  selectedTrip: any
  onSelectTrip: (trip: any) => void
}

export default function PendingTripsTable({ trips, selectedTrip, onSelectTrip }: PendingTripsTableProps) {
  const getRiskColor = (riskLevel: string) => {
    switch (riskLevel) {
      case "low":
        return "bg-green-100 text-green-800"
      case "medium":
        return "bg-yellow-100 text-yellow-800"
      case "high":
        return "bg-orange-100 text-orange-800"
      case "critical":
        return "bg-red-100 text-red-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    })
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead className="bg-gray-50 border-b">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900">Driver</th>
            <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900">Route</th>
            <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900">Date</th>
            <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900">Score</th>
            <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900">Risk</th>
          </tr>
        </thead>
        <tbody>
          {trips.map((trip) => (
            <tr
              key={trip.id}
              onClick={() => onSelectTrip(trip)}
              className={`border-b cursor-pointer transition ${
                selectedTrip?.id === trip.id ? "bg-green-50" : "hover:bg-gray-50"
              }`}
            >
              <td className="px-6 py-4 text-sm text-gray-900">{trip.driver_name || "Driver"}</td>
              <td className="px-6 py-4 text-sm text-gray-700">{trip.route}</td>
              <td className="px-6 py-4 text-sm text-gray-600">{formatDate(trip.trip_date)}</td>
              <td className="px-6 py-4 text-sm font-semibold text-gray-900">{trip.aggregate_score}%</td>
              <td className="px-6 py-4">
                <span
                  className={`px-3 py-1 rounded-full text-xs font-medium capitalize ${getRiskColor(trip.risk_level)}`}
                >
                  {trip.risk_level}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
