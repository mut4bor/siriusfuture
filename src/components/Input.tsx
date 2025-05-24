import { HTMLInputTypeAttribute } from 'react';

interface Props {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  label?: React.ReactNode;
  type?: HTMLInputTypeAttribute;
}

const Input = ({
  value,
  onChange,
  placeholder,
  className,
  label,
  type = 'text',
}: Props) => {
  return (
    <label className="flex flex-row gap-2 items-center">
      {label && <span>{label}</span>}
      <input
        className={`bg-[#555] text-white p-2 rounded hover:bg-[#444] active:bg-[#333] ${className}`}
        type={type}
        value={value}
        onChange={event => onChange(event.target.value)}
        placeholder={placeholder}
      />
    </label>
  );
};

export default Input;
