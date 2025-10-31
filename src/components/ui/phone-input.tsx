import React from "react";
import PhoneInput from "react-phone-number-input";
import "react-phone-number-input/style.css";
import { cn } from "@/lib/utils";

interface PhoneInputProps {
  value: string;
  onChange: (value: string | undefined) => void;
  disabled?: boolean;
  className?: string;
  placeholder?: string;
  required?: boolean;
}

export const PhoneNumberInput = React.forwardRef<HTMLInputElement, PhoneInputProps>(
  ({ value, onChange, disabled, className, placeholder, required }, ref) => {
    return (
      <PhoneInput
        international
        defaultCountry="US"
        value={value}
        onChange={onChange}
        disabled={disabled}
        placeholder={placeholder || "+1 (555) 123-4567"}
        className={cn(
          "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background",
          "focus-within:outline-none focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2",
          "disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        numberInputProps={{
          className: "outline-none bg-transparent w-full",
          required: required,
        }}
      />
    );
  }
);

PhoneNumberInput.displayName = "PhoneNumberInput";
