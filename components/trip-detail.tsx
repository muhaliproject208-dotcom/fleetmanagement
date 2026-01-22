"use client"

import { useState } from "react"

interface TripDetailProps {
  trip: any
  onApprovalComplete: () => void
}

export default function TripDetail({ trip, onApprovalComplete }: TripDetailProps) {
  const [approving, setApproving] = useState(false)
  const [approverName, setApproverName] = useState("")
  const [notes, setNotes] = useState("")
  const [error, setError] = useState<string | null>(null)

  const handleApprove = async (approved: boolean) => {
    if (!approverName.trim()) {
      setError("Please enter approver name")
      return
    }

    setApproving(true)
    setError(null)

    try {
      const response = await fetch(`/api/trips/${trip.id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          approved,
          approver_name: approverName,
          notes,
          signature: "", // Can be filled from signature pad
        }),
      })

      const data = await response.json()

      if (data.success) {
        onApprovalComplete()
      } else {
        setError(data.error || "Failed to process approval")
      }
    } catch (err) {
      setError("An error occurred")
    } finally {
      setApproving(false)
    }
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6 space-y-6">
      <div>
        <h3 className="text-lg font-bold text-gray-900 mb-4">Trip Details</h3>

        <div className="space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-600">Trip ID:</span>
            <span className="font-medium text-gray-900">{trip.id.slice(0, 8)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Route:</span>
            <span className="font-medium text-gray-900">{trip.route}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Date:</span>
            <span className="font-medium text-gray-900">{new Date(trip.trip_date).toLocaleDateString()}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Score:</span>
            <span className="font-bold text-green-600">{trip.aggregate_score}%</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Risk Level:</span>
            <span
              className={`capitalize font-semibold ${
                trip.risk_level === "low"
                  ? "text-green-600"
                  : trip.risk_level === "medium"
                    ? "text-yellow-600"
                    : trip.risk_level === "high"
                      ? "text-orange-600"
                      : "text-red-600"
              }`}
            >
              {trip.risk_level}
            </span>
          </div>
        </div>
      </div>

      <div className="border-t pt-6">
        <h4 className="font-semibold text-gray-900 mb-4">Approval</h4>

        {error && <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm mb-4">{error}</div>}

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Approver Name</label>
            <input
              type="text"
              value={approverName}
              onChange={(e) => setApproverName(e.target.value)}
              placeholder="Your name"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional approval notes"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 text-sm"
              rows={3}
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button
              onClick={() => handleApprove(true)}
              disabled={approving}
              className="flex-1 py-2 px-4 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 font-medium text-sm"
            >
              {approving ? "Processing..." : "Approve"}
            </button>
            <button
              onClick={() => handleApprove(false)}
              disabled={approving}
              className="flex-1 py-2 px-4 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 font-medium text-sm"
            >
              {approving ? "Processing..." : "Reject"}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
