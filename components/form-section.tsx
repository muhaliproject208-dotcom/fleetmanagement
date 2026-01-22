"use client"
import type { FormSection as FormSectionType, FormItem } from "@/lib/form-config"

interface FormSectionProps {
  section: FormSectionType
  formData: { [key: string]: any }
  onFieldChange: (fieldId: string, value: any) => void
}

export default function FormSection({ section, formData, onFieldChange }: FormSectionProps) {
  return (
    <div className="border-t pt-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-6">{section.title}</h3>
      <div className="space-y-6">
        {section.items.map((item) => (
          <FormField
            key={item.id}
            item={item}
            value={formData[item.id]}
            onChange={(value) => onFieldChange(item.id, value)}
          />
        ))}
      </div>
    </div>
  )
}

interface FormFieldProps {
  item: FormItem
  value: any
  onChange: (value: any) => void
}

function FormField({ item, value, onChange }: FormFieldProps) {
  return (
    <div className="flex items-start gap-4">
      {item.type === "checkbox" && (
        <label className="flex items-center gap-3 cursor-pointer flex-1">
          <input
            type="checkbox"
            checked={value || false}
            onChange={(e) => onChange(e.target.checked)}
            className="w-5 h-5"
          />
          <span className="text-gray-700">
            {item.label}
            {item.critical && <span className="text-red-500 ml-2">*</span>}
          </span>
        </label>
      )}

      {item.type === "radio" && (
        <div className="flex-1">
          <label className="text-gray-700 block mb-3">
            {item.label}
            {item.critical && <span className="text-red-500 ml-2">*</span>}
          </label>
          <div className="flex gap-6">
            {item.options?.map((option) => (
              <label key={option.value} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  checked={value === option.value}
                  onChange={() => onChange(option.value)}
                  className="w-4 h-4"
                />
                <span className="text-gray-600">{option.label}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      {item.type === "select" && (
        <div className="flex-1">
          <label className="text-gray-700 block mb-2">
            {item.label}
            {item.critical && <span className="text-red-500 ml-2">*</span>}
          </label>
          <select
            value={value || ""}
            onChange={(e) => onChange(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
          >
            <option value="">Select an option...</option>
            {item.options?.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      )}

      {item.type === "text" && (
        <div className="flex-1">
          <label className="text-gray-700 block mb-2">
            {item.label}
            {item.critical && <span className="text-red-500 ml-2">*</span>}
          </label>
          <input
            type="text"
            value={value || ""}
            onChange={(e) => onChange(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
          />
        </div>
      )}

      {item.type === "textarea" && (
        <div className="flex-1">
          <label className="text-gray-700 block mb-2">
            {item.label}
            {item.critical && <span className="text-red-500 ml-2">*</span>}
          </label>
          <textarea
            value={value || ""}
            onChange={(e) => onChange(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
            rows={3}
          />
        </div>
      )}
    </div>
  )
}
