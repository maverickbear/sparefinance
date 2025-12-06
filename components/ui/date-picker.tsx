"use client"

import * as React from "react"
import { parseDateInput, formatDateInput } from "@/src/infrastructure/utils/timestamp"
import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"

interface DatePickerProps {
  date?: Date
  onDateChange: (date: Date | undefined) => void
  placeholder?: string
  className?: string
  disabled?: boolean
  required?: boolean
  size?: "tiny" | "small" | "medium" | "large"
}

export function DatePicker({
  date,
  onDateChange,
  placeholder = "Pick a date",
  className,
  disabled = false,
  required = false,
  size = "medium",
}: DatePickerProps) {
  const [inputValue, setInputValue] = React.useState(
    date ? formatDateInput(date) : ""
  )

  // Update input value when date prop changes
  React.useEffect(() => {
    if (date) {
      setInputValue(formatDateInput(date))
    } else {
      setInputValue("")
    }
  }, [date])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setInputValue(value)

    // If the value matches YYYY-MM-DD format, try to parse it
    if (value.match(/^\d{4}-\d{2}-\d{2}$/)) {
      try {
        const parsedDate = parseDateInput(value)
        // Validate that the parsed date is valid
        if (!isNaN(parsedDate.getTime())) {
          onDateChange(parsedDate)
        }
      } catch (error) {
        // Invalid date, don't update
      }
    } else if (value === "") {
      onDateChange(undefined)
    }
  }

  const handleInputBlur = () => {
    // On blur, if the input doesn't match the format, reset to current date value
    if (inputValue && !inputValue.match(/^\d{4}-\d{2}-\d{2}$/)) {
      setInputValue(date ? formatDateInput(date) : "")
    }
  }

  return (
    <div className={cn("relative w-full", className)}>
      <Input
        type="date"
        value={inputValue}
        onChange={handleInputChange}
        onBlur={handleInputBlur}
        placeholder={placeholder || "YYYY-MM-DD"}
        disabled={disabled}
        required={required}
        size={size}
        className={cn("w-full", className)}
      />
    </div>
  )
}

